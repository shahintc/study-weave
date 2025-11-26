const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  StudyParticipant,
  Study,
  StudyArtifact,
  Artifact,
  CompetencyAssignment,
  ArtifactAssessment,
  User,
} = require('../models');

const ARTIFACT_MODE_OPTIONS = [
  { value: 'stage1', label: 'Bug labeling – Stage 1' },
  { value: 'stage2', label: 'Bug adjudication – Stage 2' },
  { value: 'solid', label: 'SOLID review' },
  { value: 'clone', label: 'Patch clone check' },
  { value: 'snapshot', label: 'Snapshot intent' },
];

const ARTIFACT_MODE_SET = new Set(ARTIFACT_MODE_OPTIONS.map((mode) => mode.value));
const DEFAULT_ARTIFACT_MODE = 'stage1';

const resolveArtifactMode = (value) => (value && ARTIFACT_MODE_SET.has(value) ? value : DEFAULT_ARTIFACT_MODE);

const normalizeJson = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

router.get('/assignments', authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    if (req.user.role !== 'participant') {
      return res.status(403).json({ message: 'Only participants can view these assignments.' });
    }

    const enrollments = await StudyParticipant.findAll({
      where: { participantId: req.user.id },
      include: [
        {
          model: Study,
          as: 'study',
          include: [
            { model: User, as: 'researcher', attributes: ['id', 'name', 'email'] },
            {
              model: StudyArtifact,
              as: 'studyArtifacts',
              include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name'] }],
            },
          ],
        },
        {
          model: CompetencyAssignment,
          as: 'sourceAssignment',
          attributes: ['id', 'status', 'decision', 'score', 'submittedAt', 'reviewedAt'],
        },
        {
          model: ArtifactAssessment,
          as: 'artifactAssessments',
          attributes: ['id', 'assessmentType', 'status', 'payload', 'createdAt', 'updatedAt'],
        },
      ],
      order: [['updatedAt', 'DESC']],
    });

    const studies = enrollments.map((row) => formatEnrollment(row));
    const notifications = buildNotifications(studies);

    return res.json({ studies, notifications });
  } catch (error) {
    console.error('Participant assignments error', error);
    return res.status(500).json({ message: 'Unable to load assignments right now.' });
  }
});

function formatEnrollment(entry) {
  const plain = typeof entry.get === 'function' ? entry.get({ plain: true }) : entry;
  const study = plain.study || {};
  const lookup = buildArtifactLookup(study.studyArtifacts || []);
  const metadata = normalizeJson(study.metadata);
  const defaultMode = resolveArtifactMode(metadata.defaultArtifactMode);
  const competency = summarizeCompetencyProgress(plain.sourceAssignment);
  const artifactProgress = summarizeArtifactProgress(plain.artifactAssessments || []);
  const nextAssignment = buildNextAssignmentPayload(plain, lookup.map, defaultMode);
  const cta = buildCallToAction({
    participationStatus: plain.participationStatus,
    competency,
    nextAssignment,
    studyParticipantId: plain.id,
    studyId: study.id,
  });

  return {
    studyParticipantId: String(plain.id),
    studyId: study.id ? String(study.id) : null,
    title: study.title || 'Study',
    description: study.description || '',
    researcher: study.researcher ? { id: String(study.researcher.id), name: study.researcher.name } : null,
    participationStatus: plain.participationStatus,
    progressPercent: plain.progressPercent || 0,
    competency,
    artifactProgress,
    nextAssignment,
    cta,
    lastUpdatedAt: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
    studyWindow: buildStudyWindow(study.timelineStart, study.timelineEnd),
    defaultArtifactMode: defaultMode,
  };
}

function summarizeCompetencyProgress(assignment) {
  if (!assignment) {
    return {
      assignmentId: null,
      status: 'not_assigned',
      statusLabel: 'Not assigned',
      completionPercent: 0,
      decision: 'undecided',
      requiresAction: false,
    };
  }

  const view = typeof assignment.get === 'function' ? assignment.get({ plain: true }) : assignment;
  const statusMap = {
    pending: { label: 'Pending start', percent: 10, requiresAction: true },
    in_progress: { label: 'In progress', percent: 40, requiresAction: true },
    submitted: { label: 'Submitted – awaiting review', percent: 80, requiresAction: false },
    reviewed: {
      label: view.decision === 'approved' ? 'Approved' : 'Reviewed',
      percent: 100,
      requiresAction: false,
    },
  };

  const statusEntry = statusMap[view.status] || { label: view.status, percent: 0, requiresAction: false };

  return {
    assignmentId: view.id ? String(view.id) : null,
    status: view.status,
    decision: view.decision,
    statusLabel: statusEntry.label,
    completionPercent: statusEntry.percent,
    requiresAction: statusEntry.requiresAction,
  };
}

function summarizeArtifactProgress(assessments = []) {
  const template = {};
  ARTIFACT_MODE_OPTIONS.forEach((mode) => {
    template[mode.value] = { completed: 0, lastSubmittedAt: null };
  });

  let submittedTotal = 0;
  let lastSubmittedAt = null;

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
      const iso = new Date(timestamp).toISOString();
      template[modeKey].lastSubmittedAt = iso;
      if (!lastSubmittedAt || iso > lastSubmittedAt) {
        lastSubmittedAt = iso;
      }
    }
  });

  return { modes: template, totals: { submitted: submittedTotal }, lastSubmittedAt };
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

function buildCallToAction({ participationStatus, competency, nextAssignment, studyParticipantId, studyId }) {
  if (competency.assignmentId && competency.requiresAction) {
    return {
      type: 'competency',
      buttonLabel: competency.status === 'pending' ? 'Start competency' : 'Resume competency',
      assignmentId: competency.assignmentId,
      studyParticipantId: studyParticipantId ? String(studyParticipantId) : null,
      studyId: studyId ? String(studyId) : null,
    };
  }

  if (participationStatus !== 'completed' && nextAssignment.mode && nextAssignment.studyArtifactId) {
    return {
      type: 'artifact',
      buttonLabel: nextAssignment.modeLabel || 'Open artifact task',
      studyArtifactId: nextAssignment.studyArtifactId,
      studyParticipantId: studyParticipantId ? String(studyParticipantId) : null,
      studyId: studyId ? String(studyId) : null,
      mode: nextAssignment.mode,
    };
  }

  return { type: 'none', buttonLabel: 'All caught up' };
}

function buildArtifactLookup(studyArtifacts = []) {
  const list = studyArtifacts
    .map((entry) => (typeof entry.get === 'function' ? entry.get({ plain: true }) : entry))
    .map((artifact) => ({
      id: String(artifact.id),
      label: artifact.label || artifact.artifact?.name || `Artifact ${artifact.id}`,
      artifactName: artifact.artifact?.name || null,
    }));

  const map = new Map(list.map((entry) => [Number(entry.id), entry]));
  return { list, map };
}

function resolveModeKey(assessment) {
  if (!assessment) {
    return null;
  }
  const type = assessment.assessmentType;
  if (type === 'bug_stage') {
    const payload = assessment.payload && typeof assessment.payload === 'string'
      ? safeJsonParse(assessment.payload)
      : assessment.payload || {};
    return payload.mode === 'stage1' ? 'stage1' : 'stage2';
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
  return null;
}

function safeJsonParse(value) {
  if (!value || typeof value !== 'string') {
    return {};
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
}

function buildNotifications(studies = []) {
  const items = [];
  studies.forEach((study) => {
    if (study.cta?.type === 'competency') {
      items.push({
        id: `${study.studyParticipantId}-competency`,
        type: 'competency',
        message: `Complete the competency assessment for ${study.title}.`,
        studyId: study.studyId,
      });
    } else if (study.cta?.type === 'artifact') {
      const label = study.nextAssignment.modeLabel || 'your next artifact task';
      items.push({
        id: `${study.studyParticipantId}-artifact`,
        type: 'artifact',
        message: `Start ${label} for ${study.title}.`,
        studyId: study.studyId,
      });
    } else if (study.participationStatus === 'completed') {
      items.push({
        id: `${study.studyParticipantId}-completed`,
        type: 'info',
        message: `You have completed ${study.title}. Thank you!`,
        studyId: study.studyId,
      });
    }
  });
  return items;
}

function buildStudyWindow(start, end) {
  if (!start && !end) {
    return null;
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

module.exports = router;
