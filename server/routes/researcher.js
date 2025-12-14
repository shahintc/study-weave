const express = require('express');
const { Op } = require('sequelize');
const {
  sequelize,
  Study,
  User,
  StudyParticipant,
  StudyArtifact,
  Artifact,
  Evaluation,
  ArtifactAssessment,
  CompetencyAssignment,
  CompetencyAssessment,
  ActionLog,
} = require('../models');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const ARTIFACT_MODE_OPTIONS = [
  { value: 'stage1', label: 'Bug labeling – Stage 1', assessmentType: 'bug_stage' },
  { value: 'solid', label: 'SOLID review', assessmentType: 'solid' },
  { value: 'clone', label: 'Patch clone check', assessmentType: 'clone' },
  { value: 'snapshot', label: 'Snapshot intent', assessmentType: 'snapshot' },
  { value: 'custom', label: 'Custom stage', assessmentType: 'custom' },
];

const ARTIFACT_MODE_SET = new Set(ARTIFACT_MODE_OPTIONS.map((mode) => mode.value));
const DEFAULT_ARTIFACT_MODE = 'stage1';

const resolveArtifactMode = (value) => (value && ARTIFACT_MODE_SET.has(value) ? value : DEFAULT_ARTIFACT_MODE);

router.get('/studies', async (req, res) => {
  try {
    const { researcherId } = req.query;
    const where = {};
    if (researcherId) {
      where.researcherId = researcherId;
    }
    const archivedParam = req.query.archived;
    if (typeof archivedParam !== 'undefined') {
      const normalized = String(archivedParam).toLowerCase();
      const isArchived = normalized === 'true' || normalized === '1' || normalized === 'yes';
      where.isArchived = isArchived;
    }

    const studies = await Study.findAll({
      where,
      include: [
        { model: User, as: 'researcher', attributes: ['id', 'name', 'email'] },
        {
          model: StudyParticipant,
          as: 'participants',
          include: [
            { model: User, as: 'participant', attributes: ['id', 'name'] },
            {
              model: ArtifactAssessment,
              as: 'artifactAssessments',
              attributes: ['id', 'status', 'createdAt', 'updatedAt'],
            },
          ],
        },
        {
          model: StudyArtifact,
          as: 'studyArtifacts',
          include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const studyIds = studies.map((study) => study.id);
    const qualityMap = await loadStudyQualitySignals(studyIds);

    const payload = studies.map((study) => formatStudyCard(study, qualityMap));
    res.json({ studies: payload });
  } catch (error) {
    console.error('Researcher studies error', error);
    res.status(500).json({ message: 'Unable to load studies right now' });
  }
});

router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    if (!req.user || (req.user.role !== 'researcher' && req.user.role !== 'admin')) {
      return res.status(403).json({ message: 'Only researchers can view these notifications.' });
    }

    const enrollments = await StudyParticipant.findAll({
      include: [
        {
          model: Study,
          as: 'study',
          attributes: ['id', 'title'],
          where: { researcherId: req.user.id },
        },
        { model: User, as: 'participant', attributes: ['id', 'name'] },
        {
          model: CompetencyAssignment,
          as: 'sourceAssignment',
          attributes: ['id', 'status', 'decision', 'submittedAt', 'reviewedAt'],
          required: false,
        },
      ],
      order: [['updatedAt', 'DESC']],
    });

    const competencyAssignments = await CompetencyAssignment.findAll({
      where: {
        researcherId: req.user.id,
      },
      include: [
        { model: User, as: 'participant', attributes: ['id', 'name'] },
        { model: CompetencyAssessment, as: 'assessment', attributes: ['id', 'title'] },
      ],
      order: [['updatedAt', 'DESC'], ['submittedAt', 'DESC']],
    });

    const studySubmissions = await ArtifactAssessment.findAll({
      where: {
        status: 'submitted',
      },
      include: [
        {
          model: Study,
          as: 'study',
          attributes: ['id', 'title', 'researcherId'],
          where: { researcherId: req.user.id },
        },
        { model: StudyArtifact, as: 'studyArtifact', attributes: ['id', 'label'] },
        {
          model: StudyParticipant,
          as: 'studyParticipant',
          attributes: ['id', 'participantId'],
          include: [{ model: User, as: 'participant', attributes: ['id', 'name'] }],
          required: false,
        },
        { model: User, as: 'evaluator', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const notifications = buildResearcherNotifications(enrollments, competencyAssignments, studySubmissions);
    return res.json({ notifications });
  } catch (error) {
    console.error('Researcher notifications fetch error', error);
    return res.status(500).json({ message: 'Unable to load notifications right now.' });
  }
});

router.patch('/studies/:studyId/archive', authMiddleware, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const studyId = Number(req.params.studyId);
    if (Number.isNaN(studyId)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid study id provided.' });
    }

    const study = await Study.findByPk(studyId, { transaction });
    if (!study) {
      await transaction.rollback();
      return res.status(404).json({ message: `Study ${studyId} was not found.` });
    }

    if (!canManageStudy(req.user, study)) {
      await transaction.rollback();
      return res.status(403).json({ message: 'You are not allowed to archive this study.' });
    }

    const previousStatus = study.status;
    study.status = 'archived';
    study.isArchived = true;
    await study.save({ transaction });
    await logStudyAction('archive', req.user, study, { previousStatus, newStatus: study.status }, transaction);
    await transaction.commit();

    const formatted = await loadStudyCard(study.id);
    return res.json({ study: formatted });
  } catch (error) {
    console.error('Archive study error', error);
    await transaction.rollback();
    return res.status(500).json({ message: 'Unable to archive this study right now.' });
  }
});

router.delete('/studies/:studyId', authMiddleware, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const studyId = Number(req.params.studyId);
    if (Number.isNaN(studyId)) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Invalid study id provided.' });
    }

    const study = await Study.findByPk(studyId, { transaction });
    if (!study) {
      await transaction.rollback();
      return res.status(404).json({ message: `Study ${studyId} was not found.` });
    }

    if (!canManageStudy(req.user, study)) {
      await transaction.rollback();
      return res.status(403).json({ message: 'You are not allowed to delete this study.' });
    }

    const snapshot = { title: study.title, status: study.status };
    await logStudyAction('delete', req.user, study, snapshot, transaction);
    await Study.destroy({ where: { id: studyId }, transaction });
    await transaction.commit();
    return res.json({ message: `Study "${snapshot.title}" was deleted.` });
  } catch (error) {
    console.error('Delete study error', error);
    await transaction.rollback();
    return res.status(500).json({ message: 'Unable to delete this study right now.' });
  }
});

router.get('/studies/:studyId/participants', authMiddleware, async (req, res) => {
  try {
    const studyId = Number(req.params.studyId);
    if (Number.isNaN(studyId)) {
      return res.status(400).json({ message: 'Invalid study id provided.' });
    }

    const study = await Study.findByPk(studyId, {
      include: [
        {
          model: StudyArtifact,
          as: 'studyArtifacts',
          include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name', 'type'] }],
        },
      ],
    });

    if (!study) {
      return res.status(404).json({ message: `Study ${studyId} was not found.` });
    }

    if (!canManageStudy(req.user, study)) {
      return res.status(403).json({ message: 'You are not allowed to access this study.' });
    }

    const artifactMeta = buildArtifactLookup(study.studyArtifacts || []);
    const metadata = normalizeJson(study.metadata);
    const defaultArtifactMode = resolveArtifactMode(metadata.defaultArtifactMode);
    const evaluationCriteria = normalizeCriteria(study.criteria);

    const participantRows = await StudyParticipant.findAll({
      where: { studyId: study.id },
      include: [
        { model: User, as: 'participant', attributes: ['id', 'name', 'email'] },
        {
          model: CompetencyAssignment,
          as: 'sourceAssignment',
          attributes: ['id', 'status', 'decision', 'score', 'submittedAt', 'reviewedAt'],
        },
        {
          model: ArtifactAssessment,
          as: 'artifactAssessments',
          attributes: ['id', 'assessmentType', 'status', 'createdAt', 'updatedAt', 'payload'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    return res.json({
      study: { id: String(study.id), title: study.title, evaluationCriteria },
      participants: participantRows.map((row) => formatParticipantDetail(row, artifactMeta.lookup, defaultArtifactMode)),
      studyArtifacts: artifactMeta.list,
      artifactModes: ARTIFACT_MODE_OPTIONS,
      defaultArtifactMode,
    });
  } catch (error) {
    console.error('Researcher participant progress error', error);
    return res.status(500).json({ message: 'Unable to load participant progress right now.' });
  }
});

router.patch(
  '/studies/:studyId/participants/:studyParticipantId/next-assignment',
  authMiddleware,
  async (req, res) => {
    try {
      const studyId = Number(req.params.studyId);
      const studyParticipantId = Number(req.params.studyParticipantId);
      if (Number.isNaN(studyId) || Number.isNaN(studyParticipantId)) {
        return res.status(400).json({ message: 'Invalid identifier provided.' });
      }

      const { mode, studyArtifactId } = req.body || {};
      if (!mode || !ARTIFACT_MODE_SET.has(mode)) {
        return res.status(400).json({ message: 'A valid artifact mode is required.' });
      }

      const study = await Study.findByPk(studyId, {
        include: [
          {
            model: StudyArtifact,
            as: 'studyArtifacts',
            include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name', 'type'] }],
          },
        ],
      });

      if (!study) {
        return res.status(404).json({ message: `Study ${studyId} was not found.` });
      }

      if (!canManageStudy(req.user, study)) {
        return res.status(403).json({ message: 'You are not allowed to update this study.' });
      }

      let normalizedStudyArtifactId = null;
      if (typeof studyArtifactId !== 'undefined' && studyArtifactId !== null && studyArtifactId !== '') {
        const parsedArtifactId = Number(studyArtifactId);
        if (Number.isNaN(parsedArtifactId)) {
          return res.status(400).json({ message: 'studyArtifactId must be numeric.' });
        }
        const belongsToStudy = (study.studyArtifacts || []).some(
          (artifact) => Number(artifact.id) === parsedArtifactId,
        );
        if (!belongsToStudy) {
          return res.status(400).json({ message: 'studyArtifactId does not belong to this study.' });
        }
        normalizedStudyArtifactId = parsedArtifactId;
      }

      const participant = await StudyParticipant.findOne({
        where: { id: studyParticipantId, studyId: study.id },
        include: [
          { model: User, as: 'participant', attributes: ['id', 'name', 'email'] },
          {
            model: CompetencyAssignment,
            as: 'sourceAssignment',
            attributes: ['id', 'status', 'decision', 'score', 'submittedAt', 'reviewedAt'],
          },
          {
            model: ArtifactAssessment,
            as: 'artifactAssessments',
            attributes: ['id', 'assessmentType', 'status', 'createdAt', 'updatedAt', 'payload'],
          },
        ],
      });

      if (!participant) {
        return res.status(404).json({ message: 'Study participant not found for this study.' });
      }

      participant.nextArtifactMode = mode;
      participant.nextStudyArtifactId = normalizedStudyArtifactId;
      await participant.save();

      const artifactMeta = buildArtifactLookup(study.studyArtifacts || []);
      const metadata = normalizeJson(study.metadata);
      const defaultArtifactMode = resolveArtifactMode(metadata.defaultArtifactMode);

      return res.json({ participant: formatParticipantDetail(participant, artifactMeta.lookup, defaultArtifactMode) });
    } catch (error) {
      console.error('Researcher assignment update error', error);
      return res.status(500).json({ message: 'Unable to update the next assignment right now.' });
    }
  },
);

async function loadStudyQualitySignals(studyIds = []) {
  const qualityMap = new Map();
  if (!studyIds.length) {
    return qualityMap;
  }

  const rows = await ArtifactAssessment.findAll({
    attributes: ['studyId', 'payload'],
    where: {
      studyId: { [Op.in]: studyIds },
      status: 'submitted',
    },
  });

  rows.forEach((row) => {
    const record = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    const score = extractAssessmentQualityScore(record.payload);
    if (score === null) {
      return;
    }
    const info = qualityMap.get(record.studyId) || { total: 0, count: 0 };
    info.total += score;
    info.count += 1;
    qualityMap.set(record.studyId, info);
  });

  return qualityMap;
}

function extractAssessmentQualityScore(rawPayload) {
  const payload = normalizeJson(rawPayload);
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const stars = payload.evaluationStarRatings;
  if (!stars || typeof stars !== 'object') {
    return null;
  }
  const values = Object.values(stars)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) {
    return null;
  }
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Number(average.toFixed(2));
}

function computeCompletionStats(participants = []) {
  if (!Array.isArray(participants) || participants.length === 0) {
    return { completedParticipants: 0, completionPercent: 0 };
  }
  const completedParticipants = participants.reduce((count, participant) => {
    const status = participant.participationStatus;
    const progress = Number(participant.progressPercent || 0);
    const hasSubmittedArtifact =
      Array.isArray(participant.artifactAssessments) &&
      participant.artifactAssessments.some((assessment) => assessment.status === 'submitted');
    const finished =
      status === 'completed' || progress >= 100 || Boolean(participant.completedAt) || hasSubmittedArtifact;
    return finished ? count + 1 : count;
  }, 0);
  const completionPercent = Math.min(
    100,
    Math.round((completedParticipants / participants.length) * 100),
  );
  return { completedParticipants, completionPercent };
}

function formatStudyCard(studyInstance, qualityMap) {
  const study = studyInstance.get({ plain: true });
  const metadata = normalizeJson(study.metadata);
  const participantCount = study.participants?.length || 0;
  const completionStats = computeCompletionStats(study.participants || []);

  const ratingInfo = qualityMap.get(Number(study.id));
  const avgRating =
    ratingInfo && ratingInfo.count ? Number((ratingInfo.total / ratingInfo.count).toFixed(1)) : 0;

  const participantTarget = metadata.participantTarget || participantCount || 0;
  const participantsList = (study.participants || []).map((participant) => ({
    id: String(participant.participantId),
    name: participant.participant?.name || `Participant ${participant.participantId}`,
  }));

  return {
    id: String(study.id),
    title: study.title,
    description: study.description,
    status: metadata.statusLabel || mapStatusToLabel(study.status),
    isPublic: study.isPublic,
    allowReviewers: Boolean(study.allowReviewers),
    health: metadata.health || inferHealth(study.status),
    progress: completionStats.completionPercent,
    completedParticipants: completionStats.completedParticipants,
    progressDelta: metadata.progressDelta ?? 0,
    participants: participantCount,
    participantTarget,
    avgRating,
    window: formatWindow(study.timelineStart, study.timelineEnd),
    nextMilestone: metadata.nextMilestone || 'Next milestone TBA',
    participantsList,
  };
}

function mapStatusToLabel(status) {
  switch (status) {
    case 'draft':
      return 'Planning';
    case 'active':
      return 'In field';
    case 'completed':
      return 'Completed';
    case 'archived':
      return 'Archived';
    default:
      return 'In progress';
  }
}

function inferHealth(status) {
  if (status === 'active' || status === 'completed') {
    return 'on-track';
  }
  if (status === 'draft') {
    return 'planning';
  }
  return 'attention';
}

function formatWindow(start, end) {
  if (!start && !end) {
    return 'Timeline TBA';
  }
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  if (start && end) {
    return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
  }
  if (start) {
    return `Starts ${fmt.format(new Date(start))}`;
  }
  return `Ends ${fmt.format(new Date(end))}`;
}

function normalizeJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeTimerSnapshot(timer) {
  if (!timer || typeof timer !== 'object') {
    return null;
  }
  const elapsedMs = Math.max(0, Number(timer.elapsedMs) || 0);
  return {
    elapsedMs,
    running: Boolean(timer.running),
    submitted: Boolean(timer.submitted),
    studyArtifactId: Number.isFinite(Number(timer.studyArtifactId)) ? Number(timer.studyArtifactId) : null,
    updatedAt: timer.updatedAt || null,
  };
}

function buildArtifactLookup(studyArtifacts = []) {
  const sorted = studyArtifacts
    .map((entry) => (typeof entry.get === 'function' ? entry.get({ plain: true }) : entry))
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  const list = sorted.map((artifact) => ({
    id: String(artifact.id),
    studyArtifactId: String(artifact.id),
    artifactId: artifact.artifactId ? String(artifact.artifactId) : null,
    label: artifact.label || artifact.artifact?.name || `Artifact ${artifact.id}`,
    artifactName: artifact.artifact?.name || null,
    orderIndex: artifact.orderIndex || 0,
  }));

  const lookup = new Map(list.map((entry) => [Number(entry.id), entry]));
  return { list, lookup };
}

function normalizeCriteria(criteria) {
  if (!criteria) return [];
  const list = Array.isArray(criteria) ? criteria : [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const label = item.label || item.name || item.title;
      const weight = Number(item.weight);
      if (!label || Number.isNaN(weight)) return null;
      return { label, weight };
    })
    .filter(Boolean);
}

function mapArtifactAssessments(assessments = []) {
  if (!Array.isArray(assessments)) {
    return [];
  }
  return assessments.map((entry) => {
    const plain = typeof entry.get === 'function' ? entry.get({ plain: true }) : entry;
    return {
      id: String(plain.id),
      status: plain.status,
      payload: normalizeJson(plain.payload),
      createdAt: plain.createdAt ? new Date(plain.createdAt).toISOString() : null,
      updatedAt: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
    };
  });
}

function formatParticipantDetail(row, artifactLookup, defaultMode) {
  const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
  const checkpoint = normalizeJson(plain.lastCheckpoint);
  const profile = checkpoint || {};
  const timerSnapshot = normalizeTimerSnapshot(checkpoint?.timer);
  const timeOnTaskSeconds =
    timerSnapshot && Number.isFinite(timerSnapshot.elapsedMs)
      ? Math.round(timerSnapshot.elapsedMs / 1000)
      : null;
  const completedAt =
    plain.completedAt && !Number.isNaN(new Date(plain.completedAt).getTime())
      ? new Date(plain.completedAt).toISOString()
      : null;
  const submittedArtifacts = Array.isArray(plain.artifactAssessments)
    ? plain.artifactAssessments.filter((assessment) => assessment.status === 'submitted')
    : [];

  const latestSubmissionAt = submittedArtifacts.reduce((latest, assessment) => {
    const timestamp = assessment.updatedAt || assessment.createdAt;
    if (!timestamp) {
      return latest;
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return latest;
    }
    const iso = date.toISOString();
    return !latest || iso > latest ? iso : latest;
  }, null);

  const normalizedCompletedAt = completedAt || latestSubmissionAt;
  const baseProgress = Number(plain.progressPercent || 0) || 0;
  const normalizedStatus =
    plain.participationStatus === 'completed' || normalizedCompletedAt
      ? 'completed'
      : plain.participationStatus;
  const normalizedProgress = normalizedStatus === 'completed' ? Math.max(baseProgress, 100) : baseProgress;

  return {
    id: String(plain.id),
    participantId: String(plain.participantId),
    userId: String(plain.participantId),
    name: plain.participant?.name || `Participant ${plain.participantId}`,
    email: plain.participant?.email || null,
    persona: profile.persona || 'Participant',
    region: profile.region || 'Unknown',
    participationStatus: normalizedStatus,
    progressPercent: normalizedProgress,
    completedAt: normalizedCompletedAt,
    competency: summarizeCompetencyProgress(plain.sourceAssignment),
    artifactProgress: summarizeArtifactProgress(plain.artifactAssessments || []),
    artifactAssessments: mapArtifactAssessments(plain.artifactAssessments),
    nextAssignment: buildNextAssignmentPayload(plain, artifactLookup, defaultMode),
    lastUpdatedAt: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
    timeOnTaskSeconds,
    timerSubmitted: Boolean(timerSnapshot?.submitted),
  };
}

function summarizeCompetencyProgress(assignment) {
  if (!assignment) {
    return {
      status: 'not_assigned',
      statusLabel: 'Not assigned',
      completionPercent: 0,
      decision: 'undecided',
    };
  }

  const statusMap = {
    pending: { label: 'Pending start', percent: 10 },
    in_progress: { label: 'In progress', percent: 40 },
    submitted: { label: 'Awaiting review', percent: 80 },
    reviewed: { label: assignment.decision === 'approved' ? 'Approved' : 'Reviewed', percent: 100 },
  };

  const view = typeof assignment.get === 'function' ? assignment.get({ plain: true }) : assignment;
  const statusEntry = statusMap[view.status] || { label: view.status, percent: 0 };

  return {
    assignmentId: view.id,
    status: view.status,
    statusLabel: statusEntry.label,
    completionPercent: statusEntry.percent,
    decision: view.decision,
    score: view.score,
    submittedAt: view.submittedAt,
    reviewedAt: view.reviewedAt,
  };
}

function summarizeArtifactProgress(assessments = []) {
  const template = {};
  ARTIFACT_MODE_OPTIONS.forEach((mode) => {
    template[mode.value] = { completed: 0, lastSubmittedAt: null };
  });

  let submittedTotal = 0;

  assessments.forEach((record) => {
    const plain = typeof record.get === 'function' ? record.get({ plain: true }) : record;
    if (plain.status !== 'submitted') {
      return;
    }
    const modeKey = resolveModeKey(plain);
    if (!modeKey || !template[modeKey]) {
      return;
    }
    submittedTotal += 1;
    template[modeKey].completed += 1;
    const timestamp = plain.createdAt || plain.updatedAt;
    if (timestamp) {
      const isoValue = new Date(timestamp).toISOString();
      if (!template[modeKey].lastSubmittedAt || isoValue > template[modeKey].lastSubmittedAt) {
        template[modeKey].lastSubmittedAt = isoValue;
      }
    }
  });

  return { modes: template, totals: { submitted: submittedTotal } };
}

function resolveModeKey(assessment) {
  if (!assessment) {
    return null;
  }
  const type = assessment.assessmentType;
  const payload =
    assessment.payload && typeof assessment.payload === 'string'
      ? normalizeJson(assessment.payload)
      : assessment.payload || {};
  if (type === 'bug_stage') {
    return 'stage1';
  }
  if (type === 'solid') {
    return 'solid';
  }
  if (type === 'clone') {
    return 'clone';
  }
  if (type === 'snapshot') {
    return 'snapshot';
  }
  if (type === 'custom') {
    return 'custom';
  }
  return null;
}

function buildNextAssignmentPayload(participant, artifactLookup, defaultMode) {
  const artifactId = participant.nextStudyArtifactId ? Number(participant.nextStudyArtifactId) : null;
  const artifact = artifactId ? artifactLookup.get(artifactId) : null;
  const resolvedMode = participant.nextArtifactMode || defaultMode || null;
  const modeMeta = ARTIFACT_MODE_OPTIONS.find((entry) => entry.value === resolvedMode);

  return {
    mode: resolvedMode,
    modeLabel: modeMeta?.label || null,
    studyArtifactId: artifact ? artifact.id : participant.nextStudyArtifactId ? String(participant.nextStudyArtifactId) : null,
    artifactLabel: artifact?.label || null,
    updatedAt: participant.updatedAt ? new Date(participant.updatedAt).toISOString() : null,
  };
}

function buildResearcherNotifications(enrollments = [], competencyAssignments = [], studySubmissions = []) {
  const dedup = new Map();

  const toIso = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  enrollments.forEach((entry) => {
    const plain = typeof entry.get === 'function' ? entry.get({ plain: true }) : entry;
    const study = plain.study || {};
    const participant = plain.participant || {};
    const participantId = participant.id || plain.participantId || null;
    const participantName = participant.name || (participantId ? `Participant ${participantId}` : 'Participant');
    const studyId = study.id ? String(study.id) : null;
    const studyTitle = study.title || 'Study';

    if (plain.participationStatus === 'completed') {
      const occurredAt = toIso(plain.completedAt) || toIso(plain.updatedAt) || toIso(new Date());
      const id = `study-${studyId || 'unknown'}-participant-${participantId || 'unknown'}-study-completed`;
      dedup.set(id, {
        id,
        type: 'study_complete',
        message: `${participantName} completed the study "${studyTitle}".`,
        studyId,
        participantId: participantId ? String(participantId) : null,
        participantName,
        studyTitle,
        occurredAt,
      });
    }

    const assignment = plain.sourceAssignment;
    const assignmentStatus = assignment && typeof assignment.status === 'string'
      ? assignment.status.toLowerCase()
      : null;
    if (assignment && (assignmentStatus === 'submitted' || assignmentStatus === 'reviewed')) {
      const occurredAt =
        toIso(assignment.reviewedAt) || toIso(assignment.submittedAt) || toIso(plain.updatedAt) || toIso(new Date());
      const id = `study-${studyId || 'unknown'}-participant-${participantId || 'unknown'}-competency-${assignmentStatus}`;
      dedup.set(id, {
        id,
        type: 'competency_complete',
        message: `${participantName} submitted the competency for "${studyTitle}".`,
        studyId,
        participantId: participantId ? String(participantId) : null,
        participantName,
        studyTitle,
        assignmentId: assignment.id ? String(assignment.id) : null,
        occurredAt,
      });
    }
  });

  competencyAssignments.forEach((assignmentInstance) => {
    const assignment = typeof assignmentInstance.get === 'function' ? assignmentInstance.get({ plain: true }) : assignmentInstance;
    const participant = assignment.participant || {};
    const assessment = assignment.assessment || {};
    const participantId = participant.id || assignment.participantId || null;
    const participantName = participant.name || (participantId ? `Participant ${participantId}` : 'Participant');
    const status = typeof assignment.status === 'string' ? assignment.status.toLowerCase() : '';
    if (status !== 'submitted' && status !== 'reviewed') {
      return;
    }
    const occurredAt =
      toIso(assignment.reviewedAt) ||
      toIso(assignment.submittedAt) ||
      toIso(assignment.updatedAt) ||
      toIso(new Date());

    const id = `competency-${assignment.id}-${status}`;
    if (!dedup.has(id)) {
      dedup.set(id, {
        id,
        type: 'competency_complete',
        message: `${participantName} submitted the competency "${assessment.title || 'Assessment'}".`,
        studyId: null,
        participantId: participantId ? String(participantId) : null,
        participantName,
        studyTitle: assessment.title || 'Competency',
        assignmentId: assignment.id ? String(assignment.id) : null,
        occurredAt,
      });
    }
  });

  studySubmissions.forEach((submissionInstance) => {
    const submission =
      typeof submissionInstance.get === 'function' ? submissionInstance.get({ plain: true }) : submissionInstance;
    const study = submission.study || {};
    const participant =
      submission.studyParticipant?.participant || submission.studyParticipant || submission.evaluator || {};
    const participantId =
      participant.id || submission.studyParticipant?.participantId || submission.evaluatorUserId || null;
    const participantName =
      participant.name || (participantId ? `Participant ${participantId}` : 'Participant');
    const studyId = study.id ? String(study.id) : null;
    const studyTitle = study.title || 'Study';
    const artifactLabel =
      submission.studyArtifact?.label || (submission.studyArtifactId ? `Artifact ${submission.studyArtifactId}` : null);
    const occurredAt = toIso(submission.updatedAt) || toIso(submission.createdAt) || toIso(new Date());
    const id = `study-submission-${submission.id}`;

    if (!dedup.has(id)) {
      dedup.set(id, {
        id,
        type: 'study_submission',
        message: `${participantName} submitted their study work${artifactLabel ? ` for "${artifactLabel}"` : ''} in "${studyTitle}".`,
        studyId,
        participantId: participantId ? String(participantId) : null,
        participantName,
        studyTitle,
        evaluationId: submission.sourceEvaluationId ? String(submission.sourceEvaluationId) : null,
        artifactAssessmentId: submission.id ? String(submission.id) : null,
        occurredAt,
      });
    }
  });

  return Array.from(dedup.values()).sort((a, b) => {
    const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
    const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
    return bTime - aTime;
  });
}

async function loadStudyCard(studyId) {
  const study = await Study.findByPk(studyId, {
    include: [
      { model: User, as: 'researcher', attributes: ['id', 'name', 'email'] },
      {
        model: StudyParticipant,
        as: 'participants',
        include: [{ model: User, as: 'participant', attributes: ['id', 'name'] }],
      },
      {
        model: StudyArtifact,
        as: 'studyArtifacts',
        include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name'] }],
      },
    ],
  });

  if (!study) {
    return null;
  }

  const qualityMap = await loadStudyQualitySignals([study.id]);
  return formatStudyCard(study, qualityMap);
}

async function logStudyAction(action, user, study, details = {}, transaction = null) {
  try {
    await ActionLog.create(
      {
        userId: user?.id || null,
        studyId: study?.id || null,
        action,
        details: {
          studyTitle: study?.title || null,
          status: study?.status || null,
          ...details,
        },
      },
      { transaction },
    );
  } catch (error) {
    console.error('Action log write failed', error);
  }
}

function canManageStudy(user, study) {
  if (!user) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  if (user.role === 'researcher' && Number(user.id) === Number(study.researcherId)) {
    return true;
  }
  return false;
}

module.exports = router;
