const { Op } = require('sequelize');
const {
  sequelize,
  ArtifactAssessment,
  ArtifactAssessmentItem,
  StudyArtifact,
  StudyParticipant,
  Study,
  Artifact,
  User,
  Evaluation,
  StudyComparison,
} = require('../models');
const { handleArtifactSubmission } = require('../services/submissionNotifications');

const VALID_ASSESSMENT_TYPES = ['bug_stage', 'solid', 'clone', 'snapshot', 'custom'];
const VALID_STATUS_VALUES = ['draft', 'submitted', 'archived'];
const computeDeadlinePassed = (timelineEnd) => {
  if (!timelineEnd) return false;
  const endDate = new Date(timelineEnd);
  if (Number.isNaN(endDate.getTime())) return false;
  return endDate.getTime() < Date.now();
};

const parseBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return fallback;
};

const baseIncludes = (withItems = true) => {
  const includes = [
    { model: Study, as: 'study', attributes: ['id', 'title', 'status'] },
    {
      model: StudyArtifact,
      as: 'studyArtifact',
      attributes: ['id', 'studyId', 'artifactId', 'label', 'orderIndex'],
      include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name', 'type'] }],
    },
    {
      model: StudyParticipant,
      as: 'studyParticipant',
      attributes: ['id', 'studyId', 'participantId', 'participationStatus'],
    },
    { model: User, as: 'evaluator', attributes: ['id', 'name', 'email', 'role'] },
    { model: Evaluation, as: 'sourceEvaluation', attributes: ['id', 'comparisonId', 'status'] },
    { model: Artifact, as: 'snapshotArtifact', attributes: ['id', 'name', 'type'] },
  ];

  if (withItems) {
    includes.push({
      model: ArtifactAssessmentItem,
      as: 'items',
      attributes: ['id', 'dimension', 'key', 'value', 'score', 'details', 'createdAt'],
    });
  }

  return includes;
};

const formatAssessment = (record) => {
  if (!record) {
    return null;
  }
  const plain = typeof record.get === 'function' ? record.get({ plain: true }) : record;
  plain.items = Array.isArray(plain.items) ? [...plain.items] : [];
  plain.items.sort((a, b) => {
    const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
  return plain;
};

const ensureStudyParticipantConsistency = async (studyId, studyParticipantId) => {
  if (!studyParticipantId) {
    return null;
  }
  const participant = await StudyParticipant.findByPk(studyParticipantId);
  if (!participant || participant.studyId !== Number(studyId)) {
    throw new Error('INVALID_PARTICIPANT');
  }
  return participant;
};

const resolveParticipantRecord = async ({ studyId, providedParticipantId, evaluatorUserId }) => {
  if (providedParticipantId) {
    return providedParticipantId;
  }
  const participant = await StudyParticipant.findOne({
    where: {
      studyId,
      participantId: evaluatorUserId,
    },
    attributes: ['id'],
  });
  return participant ? participant.id : null;
};

const buildWhereClause = (query, currentUser) => {
  const where = {};
  const normalized = (value) => (value ? Number(value) : null);

  const studyId = normalized(query.studyId);
  const studyArtifactId = normalized(query.studyArtifactId);
  const studyParticipantId = normalized(query.studyParticipantId);

  if (studyId) {
    where.studyId = studyId;
  }
  if (studyArtifactId) {
    where.studyArtifactId = studyArtifactId;
  }
  if (studyParticipantId) {
    where.studyParticipantId = studyParticipantId;
  }
  if (query.assessmentType && VALID_ASSESSMENT_TYPES.includes(query.assessmentType)) {
    where.assessmentType = query.assessmentType;
  }
  if (query.status && VALID_STATUS_VALUES.includes(query.status)) {
    where.status = query.status;
  }
  const includeArchived = parseBoolean(query.includeArchived, false);
  if (!includeArchived) {
    where.status = where.status || { [Op.ne]: 'archived' };
  }

  if (currentUser?.role === 'participant' || currentUser?.role === 'guest') {
    where.evaluatorUserId = currentUser.id;
  }

  return where;
};

const createArtifactAssessment = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    if (!req.user) {
      await transaction.rollback();
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const {
      studyId,
      studyArtifactId,
      assessmentType,
      payload = {},
      status = 'submitted',
      items = [],
      studyParticipantId,
      sourceEvaluationId = null,
      snapshotArtifactId = null,
      comparisonId: rawComparisonId = null,
    } = req.body;

    if (!studyId || !studyArtifactId || !assessmentType) {
      await transaction.rollback();
      return res.status(400).json({ message: 'studyId, studyArtifactId, and assessmentType are required.' });
    }

    if (!VALID_ASSESSMENT_TYPES.includes(assessmentType)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'assessmentType is invalid.' });
    }

    if (status && !VALID_STATUS_VALUES.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'status is invalid.' });
    }

    let normalizedComparisonId = null;
    if (rawComparisonId !== null && typeof rawComparisonId !== 'undefined' && rawComparisonId !== '') {
      normalizedComparisonId = Number(rawComparisonId);
      if (Number.isNaN(normalizedComparisonId)) {
        await transaction.rollback();
        return res.status(400).json({ message: 'comparisonId must be numeric when provided.' });
      }
    }

    const studyArtifact = await StudyArtifact.findOne({
      where: { id: studyArtifactId, studyId },
      attributes: ['id', 'studyId'],
    });

    if (!studyArtifact) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Study artifact not found for the provided study.' });
    }

    const study = await Study.findByPk(studyId, { attributes: ['id', 'isPublic', 'timelineEnd'] });
    if (!study) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Study not found.' });
    }

    await ensureStudyParticipantConsistency(studyId, studyParticipantId);
    const resolvedParticipantId = await resolveParticipantRecord({
      studyId,
      providedParticipantId: studyParticipantId,
      evaluatorUserId: req.user.id,
    });
    let participantRecord = null;
    if (resolvedParticipantId) {
      participantRecord = await StudyParticipant.findByPk(resolvedParticipantId);
    }

    if (req.user.role === 'guest') {
      if (!study.isPublic) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Guest submissions are limited to public studies.' });
      }
      if (computeDeadlinePassed(study.timelineEnd)) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Study deadline has passed.' });
      }
      if (!participantRecord) {
        participantRecord = await StudyParticipant.findOne({
          where: { studyId, participantId: req.user.id },
        });
      }
      if (!participantRecord) {
        await transaction.rollback();
        return res.status(404).json({ message: 'Guest enrollment not found for this study.' });
      }
      if (participantRecord.participantId !== req.user.id) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Guests cannot submit for other participants.' });
      }
      if (participantRecord.source && participantRecord.source !== 'public_guest') {
        await transaction.rollback();
        return res.status(403).json({ message: 'Guest access is limited to public guest enrollments.' });
      }
      if (
        participantRecord.guestSessionId &&
        req.user.guestSessionId &&
        participantRecord.guestSessionId !== req.user.guestSessionId
      ) {
        await transaction.rollback();
        return res.status(401).json({ message: 'Guest session mismatch. Please log in again.' });
      }
      if (participantRecord.expiresAt && new Date(participantRecord.expiresAt).getTime() < Date.now()) {
        await transaction.rollback();
        return res.status(403).json({ message: 'Guest enrollment has expired.' });
      }
    }

    const effectiveParticipantId = resolvedParticipantId || (participantRecord ? participantRecord.id : null);

    const duplicateWhere = {
      studyId,
      studyArtifactId,
      assessmentType,
      evaluatorUserId: req.user.id,
      status: 'submitted',
    };
    if (effectiveParticipantId) {
      duplicateWhere.studyParticipantId = effectiveParticipantId;
    }
    const existingSubmission = await ArtifactAssessment.findOne({ where: duplicateWhere });
    if (existingSubmission) {
      await transaction.rollback();
      return res.status(409).json({
        message: 'This artifact task was already submitted.',
        assessment: formatAssessment(existingSubmission),
      });
    }

    const normalizedPayload = payload && typeof payload === 'object' ? payload : {};

    let effectiveSourceEvaluationId = sourceEvaluationId || null;

    if (effectiveSourceEvaluationId) {
      const evaluation = await Evaluation.findByPk(effectiveSourceEvaluationId);
      if (!evaluation || evaluation.studyId !== Number(studyId)) {
        await transaction.rollback();
        return res.status(400).json({ message: 'sourceEvaluationId does not belong to this study.' });
      }
    } else {
      try {
        let comparisonId = await resolveComparisonIdForSubmission({
          studyId,
          studyArtifactId,
          providedComparisonId: normalizedComparisonId,
        });

        if (!comparisonId) {
          comparisonId = await ensureComparisonForArtifact({
            studyId,
            studyArtifactId,
            transaction,
          });
        }

        if (comparisonId) {
          const evaluation = await ensureEvaluationForAssessment({
            studyId,
            comparisonId,
            participantUserId: req.user.id,
            studyParticipantId: effectiveParticipantId,
            payload: normalizedPayload,
            transaction,
          });
          if (evaluation) {
            effectiveSourceEvaluationId = evaluation.id;
          }
        }
      } catch (comparisonError) {
        await transaction.rollback();
        if (comparisonError.message === 'INVALID_COMPARISON') {
          return res.status(400).json({ message: 'comparisonId does not belong to this study.' });
        }
        throw comparisonError;
      }
    }

    if (snapshotArtifactId) {
      const snapshot = await Artifact.findByPk(snapshotArtifactId);
      if (!snapshot) {
        await transaction.rollback();
        return res.status(400).json({ message: 'snapshotArtifactId does not reference a valid artifact.' });
      }
    }

    const assessment = await ArtifactAssessment.create(
      {
        studyId,
        studyArtifactId,
        studyParticipantId: effectiveParticipantId,
        evaluatorUserId: req.user.id,
        sourceEvaluationId: effectiveSourceEvaluationId,
        assessmentType,
        status,
        payload: normalizedPayload,
        snapshotArtifactId,
      },
      { transaction },
    );

    const normalizedItems = Array.isArray(items)
      ? items
          .map((item) => ({
            dimension: item?.dimension,
            key: item?.key,
            value: typeof item?.value === 'undefined' ? null : item.value,
            score:
              typeof item?.score === 'undefined' || item?.score === null
                ? null
                : Number(item.score),
            details:
              item?.details && typeof item.details === 'object'
                ? item.details
                : item?.details || null,
          }))
          .filter((entry) => entry.dimension && entry.key)
          .map((entry) => ({ ...entry, assessmentId: assessment.id }))
      : [];

    if (normalizedItems.length) {
      await ArtifactAssessmentItem.bulkCreate(normalizedItems, { transaction });
    }

    await handleArtifactSubmission({ assessmentId: assessment.id, transaction });

    await transaction.commit();

    const createdRecord = await ArtifactAssessment.findByPk(assessment.id, {
      include: baseIncludes(true),
    });

    return res.status(201).json({ assessment: formatAssessment(createdRecord) });
  } catch (error) {
    await transaction.rollback();
    let statusCode = 500;
    let message = 'Unable to save artifact assessment at this time.';

    if (error.message === 'INVALID_PARTICIPANT') {
      statusCode = 400;
      message = 'studyParticipantId does not belong to the specified study.';
    } else if (error.message === 'INVALID_COMPARISON') {
      statusCode = 400;
      message = 'comparisonId does not belong to the specified study.';
    }

    console.error('createArtifactAssessment error:', error);
    return res.status(statusCode).json({ message });
  }
};

const getArtifactAssessments = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const includeItems = parseBoolean(req.query.includeItems, true);
    const where = buildWhereClause(req.query, req.user);

    const assessments = await ArtifactAssessment.findAll({
      where,
      include: baseIncludes(includeItems),
      order: [['createdAt', 'DESC']],
    });

    return res.json({ assessments: assessments.map(formatAssessment) });
  } catch (error) {
    console.error('getArtifactAssessments error:', error);
    return res.status(500).json({ message: 'Unable to load artifact assessments right now.' });
  }
};

const getArtifactAssessmentById = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const includeItems = parseBoolean(req.query.includeItems, true);
    const record = await ArtifactAssessment.findByPk(req.params.id, {
      include: baseIncludes(includeItems),
    });

    if (!record) {
      return res.status(404).json({ message: 'Artifact assessment not found.' });
    }

    if ((req.user.role === 'participant' || req.user.role === 'guest') && record.evaluatorUserId !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to access this record.' });
    }

    return res.json({ assessment: formatAssessment(record) });
  } catch (error) {
    console.error('getArtifactAssessmentById error:', error);
    return res.status(500).json({ message: 'Unable to load artifact assessment.' });
  }
};

async function resolveComparisonIdForSubmission({ studyId, studyArtifactId, providedComparisonId }) {
  if (!studyId || !studyArtifactId) {
    return null;
  }

  if (providedComparisonId) {
    const comparison = await StudyComparison.findByPk(providedComparisonId, {
      attributes: ['id', 'studyId'],
    });
    if (!comparison || Number(comparison.studyId) !== Number(studyId)) {
      throw new Error('INVALID_COMPARISON');
    }
    return comparison.id;
  }

  const comparison = await StudyComparison.findOne({
    where: {
      studyId,
      [Op.or]: [
        { primaryArtifactId: studyArtifactId },
        { secondaryArtifactId: studyArtifactId },
      ],
    },
    attributes: ['id'],
    order: [['id', 'ASC']],
  });

  return comparison ? comparison.id : null;
}

async function ensureComparisonForArtifact({ studyId, studyArtifactId, transaction }) {
  // Create a minimal comparison so evaluations can be tracked in the reviewer queue
  const comparison = await StudyComparison.create(
    {
      studyId,
      primaryArtifactId: studyArtifactId,
      secondaryArtifactId: studyArtifactId,
      prompt: 'Autogenerated comparison',
      criteria: {},
      groundTruth: {},
    },
    { transaction },
  );
  return comparison.id;
}

async function ensureEvaluationForAssessment({
  studyId,
  comparisonId,
  participantUserId,
  studyParticipantId,
  payload,
  transaction,
}) {
  if (!comparisonId) {
    return null;
  }

  const [evaluation, created] = await Evaluation.findOrCreate({
    where: {
      studyId,
      comparisonId,
      participantId: participantUserId,
      studyParticipantId: studyParticipantId || null,
    },
    defaults: {
      studyId,
      comparisonId,
      participantId: participantUserId,
      studyParticipantId: studyParticipantId || null,
      status: 'submitted',
      reviewStatus: 'pending',
      submittedAt: new Date(),
      participantPayload: payload,
    },
    transaction,
  });

  if (!created) {
    const nextReviewStatus = evaluation.reviewStatus === 'resolved' ? evaluation.reviewStatus : 'pending';
    await evaluation.update(
      {
        status: 'submitted',
        reviewStatus: nextReviewStatus,
        participantPayload: payload,
        submittedAt: evaluation.submittedAt || new Date(),
      },
      { transaction },
    );
  }

  return evaluation;
}

module.exports = {
  createArtifactAssessment,
  getArtifactAssessments,
  getArtifactAssessmentById,
};
