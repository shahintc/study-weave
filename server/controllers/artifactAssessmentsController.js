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
} = require('../models');
const submissionNotifications = require('../services/submissionNotifications');

const VALID_ASSESSMENT_TYPES = ['bug_stage', 'solid', 'clone', 'snapshot'];
const VALID_STATUS_VALUES = ['draft', 'submitted', 'archived'];

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

  if (currentUser?.role === 'participant') {
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

    const studyArtifact = await StudyArtifact.findOne({
      where: { id: studyArtifactId, studyId },
      attributes: ['id', 'studyId'],
    });

    if (!studyArtifact) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Study artifact not found for the provided study.' });
    }

    await ensureStudyParticipantConsistency(studyId, studyParticipantId);
    const resolvedParticipantId = await resolveParticipantRecord({
      studyId,
      providedParticipantId: studyParticipantId,
      evaluatorUserId: req.user.id,
    });

    const normalizedPayload = payload && typeof payload === 'object' ? payload : {};

    if (sourceEvaluationId) {
      const evaluation = await Evaluation.findByPk(sourceEvaluationId);
      if (!evaluation || evaluation.studyId !== Number(studyId)) {
        await transaction.rollback();
        return res.status(400).json({ message: 'sourceEvaluationId does not belong to this study.' });
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
        studyParticipantId: resolvedParticipantId,
        evaluatorUserId: req.user.id,
        sourceEvaluationId,
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

    let notificationContext = null;
    if (status === 'submitted') {
      notificationContext = await submissionNotifications.handleArtifactSubmission({
        assessmentId: assessment.id,
        transaction,
      });
    }

    await transaction.commit();

    const createdRecord = await ArtifactAssessment.findByPk(assessment.id, {
      include: baseIncludes(true),
    });

    if (notificationContext) {
      submissionNotifications
        .sendResearcherNotification(notificationContext)
        .catch((error) => console.error('Artifact notification error:', error));
    }

    return res
      .status(201)
      .json({ assessment: formatAssessment(createdRecord), notificationQueued: Boolean(notificationContext) });
  } catch (error) {
    await transaction.rollback();
    const statusCode = error.message === 'INVALID_PARTICIPANT' ? 400 : 500;
    const message =
      error.message === 'INVALID_PARTICIPANT'
        ? 'studyParticipantId does not belong to the specified study.'
        : 'Unable to save artifact assessment at this time.';
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

    if (req.user.role === 'participant' && record.evaluatorUserId !== req.user.id) {
      return res.status(403).json({ message: 'You are not allowed to access this record.' });
    }

    return res.json({ assessment: formatAssessment(record) });
  } catch (error) {
    console.error('getArtifactAssessmentById error:', error);
    return res.status(500).json({ message: 'Unable to load artifact assessment.' });
  }
};

module.exports = {
  createArtifactAssessment,
  getArtifactAssessments,
  getArtifactAssessmentById,
};
