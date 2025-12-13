const express = require('express');
const fs = require('fs/promises');
const { Op } = require('sequelize');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  StudyParticipant,
  Study,
  StudyArtifact,
  Artifact,
  CompetencyAssignment,
  CompetencyAssessment,
  ArtifactAssessment,
  User,
  StudyComparison,
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
const TEXT_MIME_PATTERN = /^(text\/.+|application\/(json|xml|javascript))/i;
const TEXT_FILE_EXTENSIONS = [
  '.txt',
  '.patch',
  '.diff',
  '.md',
  '.json',
  '.csv',
  '.java',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.py',
  '.c',
  '.cpp',
  '.cs',
  '.go',
  '.rs',
  '.kt',
  '.php',
  '.rb',
  '.html',
  '.css',
];
const FALLBACK_MIME = 'application/octet-stream';

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

const isTextLike = (mime, fileName = '') => {
  if (mime && TEXT_MIME_PATTERN.test(mime)) {
    return true;
  }
  const lower = fileName ? fileName.toLowerCase() : '';
  return TEXT_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

async function buildPanePayload(studyArtifactEntry, role = 'primary') {
  if (!studyArtifactEntry) {
    return null;
  }
  const entry =
    typeof studyArtifactEntry.get === 'function'
      ? studyArtifactEntry.get({ plain: true })
      : studyArtifactEntry;

  if (!entry || !entry.artifact) {
    return null;
  }

  const artifact = entry.artifact;
  let encoding = null;
  let content = null;

  if (artifact.filePath) {
    try {
      const buffer = await fs.readFile(artifact.filePath);
      if (isTextLike(artifact.fileMimeType, artifact.fileOriginalName)) {
        encoding = 'text';
        content = buffer.toString('utf8');
      } else {
        encoding = 'data_url';
        const mime = artifact.fileMimeType || FALLBACK_MIME;
        content = `data:${mime};base64,${buffer.toString('base64')}`;
      }
    } catch (error) {
      console.error(`Failed to read artifact file at ${artifact.filePath}`, error);
    }
  }

  return {
    role,
    studyArtifactId: entry.id,
    artifactId: artifact.id,
    artifactName: artifact.name,
    artifactType: artifact.type,
    label: entry.label,
    instructions: entry.instructions,
    mimeType: artifact.fileMimeType,
    fileOriginalName: artifact.fileOriginalName,
    encoding,
    content,
};
}

router.post('/join-public', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'guest') {
      return res.status(403).json({ message: 'Only guest users can join public studies.' });
    }
    const studyId = Number(req.body.studyId);
    if (!Number.isFinite(studyId)) {
      return res.status(400).json({ message: 'A valid studyId is required.' });
    }

    const study = await Study.findByPk(studyId, {
      include: [
        {
          model: StudyArtifact,
          as: 'studyArtifacts',
          attributes: ['id', 'orderIndex'],
        },
      ],
    });
    const metadata = normalizeJson(study?.metadata);
    const isPublic = study?.isPublic || Boolean(metadata.isPublic);
    if (!study || !isPublic) {
      return res.status(404).json({ message: 'Public study not found.' });
    }
    if (study.status === 'archived') {
      return res.status(400).json({ message: 'This study is archived.' });
    }
    if (computeDeadlinePassed(study.timelineEnd)) {
      return res.status(403).json({ message: 'This study has already ended.' });
    }

    const existing = await StudyParticipant.findOne({
      where: { studyId, participantId: req.user.id },
    });
    if (existing) {
      return res.json({ participant: existing.get ? existing.get({ plain: true }) : existing });
    }

    const artifacts = Array.isArray(study.studyArtifacts) ? [...study.studyArtifacts] : [];
    artifacts.sort((a, b) => {
      const aIndex = typeof a.orderIndex === 'number' ? a.orderIndex : Number(a.orderIndex) || 0;
      const bIndex = typeof b.orderIndex === 'number' ? b.orderIndex : Number(b.orderIndex) || 0;
      return aIndex - bIndex;
    });
    const nextArtifact = artifacts.length ? artifacts[0] : null;
    if (!nextArtifact) {
      return res.status(400).json({ message: 'This study does not have any artifacts yet.' });
    }

    const defaultMode = resolveArtifactMode(metadata.defaultArtifactMode);

    const participant = await StudyParticipant.create({
      studyId,
      participantId: req.user.id,
      competencyAssignmentId: null,
      invitationStatus: 'accepted',
      participationStatus: 'in_progress',
      progressPercent: 0,
      startedAt: new Date(),
      completedAt: null,
      lastCheckpoint: null,
      nextArtifactMode: defaultMode,
      nextStudyArtifactId: nextArtifact.id,
      source: 'public_guest',
      guestSessionId: req.user.guestSessionId || null,
      expiresAt: req.user.guestExpiresAt ? new Date(req.user.guestExpiresAt) : null,
    });

    return res.status(201).json({
      participant: participant.get ? participant.get({ plain: true }) : participant,
    });
  } catch (error) {
    console.error('Join public study error', error);
    return res.status(500).json({ message: 'Unable to join this study right now.' });
  }
});

router.get('/assignments', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !['participant', 'guest'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only participants can view these assignments.' });
    }

    const [enrollments, competencyAssignments] = await Promise.all([
      StudyParticipant.findAll({
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
      }),
      CompetencyAssignment.findAll({
        where: { participantId: req.user.id },
        include: [
          {
            model: StudyParticipant,
            as: 'studyEnrollment',
            attributes: ['id', 'studyId'],
          },
          {
            model: CompetencyAssessment,
            as: 'assessment',
            attributes: ['id', 'title', 'metadata'],
          },
        ],
        order: [['createdAt', 'DESC']],
      }),
    ]);

    const studies = enrollments.map((row) => formatEnrollment(row));
    const notifications = [
      ...buildNotifications(studies),
      ...buildCompetencyNotifications(competencyAssignments),
    ].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return res.json({ studies, notifications });
  } catch (error) {
    console.error('Participant assignments error', error);
    return res.status(500).json({ message: 'Unable to load assignments right now.' });
  }
});

router.get('/artifact-task', authMiddleware, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    if (
      req.user.role !== 'participant' &&
      req.user.role !== 'researcher' &&
      req.user.role !== 'admin' &&
      req.user.role !== 'guest'
    ) {
      return res.status(403).json({ message: 'Only participants can open assigned artifacts.' });
    }

    const studyId = Number(req.query.studyId);
    const studyArtifactId = Number(req.query.studyArtifactId);
    const requestedParticipantId = req.query.studyParticipantId ? Number(req.query.studyParticipantId) : null;

    if (!Number.isFinite(studyId) || !Number.isFinite(studyArtifactId)) {
      return res.status(400).json({ message: 'studyId and studyArtifactId are required.' });
    }
    if (req.query.studyParticipantId && !Number.isFinite(requestedParticipantId)) {
      return res.status(400).json({ message: 'studyParticipantId must be numeric when provided.' });
    }

    const study = await Study.findByPk(studyId);
    if (!study) {
      return res.status(404).json({ message: 'Study not found.' });
    }

    const studyMetadata = normalizeJson(study.metadata);
    const isPublicStudy = study.isPublic || Boolean(studyMetadata.isPublic);

    if (req.user.role === 'guest' && !isPublicStudy) {
      return res.status(403).json({ message: 'This study is not available for guests.' });
    }

    if (computeDeadlinePassed(study.timelineEnd)) {
      return res.status(403).json({ message: 'Study deadline has passed. You cannot start this task.' });
    }

    const participantWhere = { studyId };
    if (req.user.role === 'guest') {
      participantWhere.participantId = req.user.id;
      participantWhere.guestSessionId = req.user.guestSessionId || null;
    } else if (requestedParticipantId) {
      participantWhere.id = requestedParticipantId;
    } else if (req.user.role === 'participant') {
      participantWhere.participantId = req.user.id;
    }

    const participant = await StudyParticipant.findOne({ where: participantWhere });
    if (!participant) {
      return res.status(404).json({ message: 'No matching study assignment found for this participant.' });
    }
    if (req.user.role === 'guest') {
      if (participant.participantId !== req.user.id) {
        return res.status(403).json({ message: 'You cannot open another participant assignment.' });
      }
      const enrollmentExpiresAt = participant.expiresAt || req.user.guestExpiresAt;
      if (enrollmentExpiresAt && new Date(enrollmentExpiresAt).getTime() < Date.now()) {
        return res.status(403).json({ message: 'Your guest enrollment has expired.' });
      }
      if (participant.source && participant.source !== 'public_guest') {
        return res.status(403).json({ message: 'Guest access is limited to public studies.' });
      }
    }

    const studyArtifact = await StudyArtifact.findOne({
      where: { id: studyArtifactId, studyId },
      include: [
        {
          model: Artifact,
          as: 'artifact',
          attributes: [
            'id',
            'name',
            'type',
            'filePath',
            'fileMimeType',
            'fileOriginalName',
          ],
        },
      ],
    });

    if (!studyArtifact || !studyArtifact.artifact) {
      return res.status(404).json({ message: 'Study artifact not found for this study.' });
    }

    const snapshotConfig = normalizeSnapshotArtifactsConfig(studyMetadata.snapshotArtifacts);

    const modeCandidates = [
      req.query.mode,
      participant.nextArtifactMode,
      participant.lastCheckpoint?.mode,
    ];
    let resolvedMode = DEFAULT_ARTIFACT_MODE;
    for (const candidate of modeCandidates) {
      if (candidate) {
        resolvedMode = resolveArtifactMode(String(candidate));
        break;
      }
    }

    const comparison = await StudyComparison.findOne({
      where: {
        studyId,
        [Op.or]: [
          { primaryArtifactId: studyArtifactId },
          { secondaryArtifactId: studyArtifactId },
        ],
      },
      include: [
        {
          model: StudyArtifact,
          as: 'primaryArtifact',
          include: [
            {
              model: Artifact,
              as: 'artifact',
              attributes: [
                'id',
                'name',
                'type',
                'filePath',
                'fileMimeType',
                'fileOriginalName',
              ],
            },
          ],
        },
        {
          model: StudyArtifact,
          as: 'secondaryArtifact',
          include: [
            {
              model: Artifact,
              as: 'artifact',
              attributes: [
                'id',
                'name',
                'type',
                'filePath',
                'fileMimeType',
                'fileOriginalName',
              ],
            },
          ],
        },
      ],
    });

    let leftPane = await buildPanePayload(studyArtifact, 'primary');
    let rightPane = null;
    let diffPane = null;
    if (comparison) {
      const isPrimary = Number(comparison.primaryArtifactId) === Number(studyArtifactId);
      const pairedArtifact = isPrimary ? comparison.secondaryArtifact : comparison.primaryArtifact;
      rightPane = await buildPanePayload(
        pairedArtifact,
        isPrimary ? 'secondary' : 'primary',
      );
    } else if (resolvedMode === 'clone' || resolvedMode === 'snapshot') {
      // Fallback: if the researcher didn't create a StudyComparison pairing,
      // try to find another artifact in this study so both panes are populated.
      const fallbackPair = await StudyArtifact.findOne({
        where: {
          studyId,
          id: { [Op.ne]: studyArtifactId },
        },
        include: [
          {
            model: Artifact,
            as: 'artifact',
            attributes: ['id', 'name', 'type', 'filePath', 'fileMimeType', 'fileOriginalName'],
          },
        ],
        order: [['orderIndex', 'ASC'], ['id', 'ASC']],
      });
      if (fallbackPair && fallbackPair.artifact) {
        rightPane = await buildPanePayload(fallbackPair, 'secondary');
      }
      if (!rightPane) {
        return res.status(400).json({
          message: 'This patch/snapshot task needs a paired study artifact. Please ask the researcher to link two artifacts for this stage.',
        });
      }
    }

    if (resolvedMode === 'snapshot' && snapshotConfig) {
      const snapshotPanes = await buildSnapshotPanePayloads({
        studyId,
        snapshotConfig,
      });
      if (snapshotPanes.reference) {
        leftPane = snapshotPanes.reference;
      }
      if (snapshotPanes.failure) {
        rightPane = snapshotPanes.failure;
      }
      if (snapshotPanes.diff) {
        diffPane = snapshotPanes.diff;
      }
    }

    const comparisonMeta = comparison
      ? {
          id: String(comparison.id),
          prompt: comparison.prompt,
          criteria: normalizeJson(comparison.criteria),
          groundTruth: normalizeJson(comparison.groundTruth),
        }
      : null;

    return res.json({
      assignment: {
        studyId,
        studyArtifactId,
        studyParticipantId: participant.id,
        mode: resolvedMode,
        participantStatus: participant.participationStatus,
        label: studyArtifact.label,
        instructions: studyArtifact.instructions,
        evaluationCriteria: normalizeCriteria(study.criteria),
        panes: {
          left: leftPane,
          right: rightPane,
          diff: diffPane,
        },
        comparison: comparisonMeta,
      },
    });
  } catch (error) {
    console.error('Participant artifact-task fetch error', error);
    return res.status(500).json({ message: 'Unable to load the assigned artifact right now.' });
  }
});

function normalizeSnapshotArtifactsConfig(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const parse = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };
  const reference = parse(raw.reference);
  const failure = parse(raw.failure);
  const diff = parse(raw.diff);
  if (!reference || !failure || !diff) {
    return null;
  }
  return { reference, failure, diff };
}

async function buildSnapshotPanePayloads({ studyId, snapshotConfig }) {
  const artifactIds = [snapshotConfig.reference, snapshotConfig.failure, snapshotConfig.diff].filter(
    (value) => Number.isFinite(value),
  );
  if (!artifactIds.length) {
    return {};
  }
  const rows = await StudyArtifact.findAll({
    where: {
      studyId,
      artifactId: { [Op.in]: artifactIds },
    },
    include: [
      {
        model: Artifact,
        as: 'artifact',
        attributes: ['id', 'name', 'type', 'filePath', 'fileMimeType', 'fileOriginalName'],
      },
    ],
  });
  const byArtifactId = new Map(rows.map((row) => [Number(row.artifactId), row]));
  const panes = {};
  if (byArtifactId.has(snapshotConfig.reference)) {
    panes.reference = await buildPanePayload(byArtifactId.get(snapshotConfig.reference), 'primary');
  }
  if (byArtifactId.has(snapshotConfig.failure)) {
    panes.failure = await buildPanePayload(byArtifactId.get(snapshotConfig.failure), 'secondary');
  }
  if (byArtifactId.has(snapshotConfig.diff)) {
    panes.diff = await buildPanePayload(byArtifactId.get(snapshotConfig.diff), 'snapshot_diff');
  }
  return panes;
}

function formatEnrollment(entry) {
  const plain = typeof entry.get === 'function' ? entry.get({ plain: true }) : entry;
  const study = plain.study || {};
  const lookup = buildArtifactLookup(study.studyArtifacts || []);
  const metadata = normalizeJson(study.metadata);
  const isPublic = Boolean(study.isPublic || metadata.isPublic);
  const defaultMode = resolveArtifactMode(metadata.defaultArtifactMode);
  const competency = summarizeCompetencyProgress(plain.sourceAssignment);
  const artifactProgress = summarizeArtifactProgress(plain.artifactAssessments || []);
  const nextAssignment = buildNextAssignmentPayload(plain, lookup.map, defaultMode);
  const isPastDeadline = computeDeadlinePassed(study.timelineEnd);
  const hasStartedFlag = hasStarted(study.timelineStart);
  const cta = buildCallToAction({
    participationStatus: plain.participationStatus,
    competency,
    nextAssignment,
    studyParticipantId: plain.id,
    studyId: study.id,
    isPastDeadline,
    hasStarted: hasStartedFlag,
    timelineStart: study.timelineStart,
  });

  return {
    studyParticipantId: String(plain.id),
    studyId: study.id ? String(study.id) : null,
    title: study.title || 'Study',
    description: study.description || '',
    researcher: study.researcher ? { id: String(study.researcher.id), name: study.researcher.name } : null,
    isPublic,
    participationStatus: plain.participationStatus,
    progressPercent: plain.progressPercent || 0,
    competency,
    artifactProgress,
    nextAssignment,
    cta,
    isPastDeadline,
    hasStarted: hasStartedFlag,
    timelineStart: study.timelineStart ? new Date(study.timelineStart).toISOString() : null,
    timelineEnd: study.timelineEnd ? new Date(study.timelineEnd).toISOString() : null,
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
    timeTakenSeconds: view.timeTakenSeconds, // Add this line
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

function buildCallToAction({
  participationStatus,
  competency,
  nextAssignment,
  studyParticipantId,
  studyId,
  isPastDeadline,
  hasStarted = true,
  timelineStart = null,
}) {
  if (isPastDeadline) {
    return {
      type: 'artifact',
      buttonLabel: 'Deadline passed',
      disabled: true,
      reason: 'The study deadline has passed. You can no longer start this task.',
      studyParticipantId: studyParticipantId ? String(studyParticipantId) : null,
      studyId: studyId ? String(studyId) : null,
    };
  }

  if (!hasStarted) {
    const waitDays = daysUntil(timelineStart);
    return {
      type: 'artifact',
      buttonLabel: 'Starts soon',
      disabled: true,
      reason: `Starts on ${formatDateShort(timelineStart)}. Please wait ${waitDays} day(s).`,
      studyParticipantId: studyParticipantId ? String(studyParticipantId) : null,
      studyId: studyId ? String(studyId) : null,
    };
  }

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
    const startReached = hasStarted(study.timelineStart);
    const updatedStamp = normalizeTimestamp(
      study.lastUpdatedAt || study.timelineStart || new Date().toISOString(),
    );
    const sanitizedCta = sanitizeNotificationCta(study.cta);
    items.push({
      id: `${study.studyParticipantId}-assigned`,
      type: 'assignment',
      message: `You were assigned to ${study.title}.`,
      studyId: study.studyId,
      studyParticipantId: study.studyParticipantId ? String(study.studyParticipantId) : null,
      cta: sanitizedCta,
      createdAt: updatedStamp,
    });

    if (isToday(study.timelineStart)) {
      items.push({
        id: `${study.studyParticipantId}-start`,
        type: 'info',
        message: `${study.title} starts today. You can begin your tasks.`,
        studyId: study.studyId,
        studyParticipantId: study.studyParticipantId ? String(study.studyParticipantId) : null,
        cta: sanitizedCta,
        createdAt: normalizeTimestamp(study.timelineStart),
      });
    }

    if (isToday(study.timelineEnd)) {
      items.push({
        id: `${study.studyParticipantId}-end`,
        type: 'warning',
        message: `${study.title} ends today. Last chance to submit your work.`,
        studyId: study.studyId,
        studyParticipantId: study.studyParticipantId ? String(study.studyParticipantId) : null,
        cta: sanitizedCta,
        createdAt: normalizeTimestamp(study.timelineEnd),
      });
    }

    // Suppress other notification types; only keep assignment/start/end per request.
  });
  return items;
}

function sanitizeNotificationCta(cta) {
  if (!cta || typeof cta !== 'object') {
    return null;
  }
  return {
    type: cta.type || null,
    buttonLabel: cta.buttonLabel || null,
    studyId: cta.studyId ? String(cta.studyId) : null,
    studyParticipantId: cta.studyParticipantId ? String(cta.studyParticipantId) : null,
    studyArtifactId: cta.studyArtifactId ? String(cta.studyArtifactId) : null,
    mode: cta.mode || null,
    assignmentId: cta.assignmentId ? String(cta.assignmentId) : null,
  };
}

function buildCompetencyNotifications(assignments = []) {
  const items = [];
  assignments.forEach((record) => {
    const entry = typeof record.get === 'function' ? record.get({ plain: true }) : record;
    if (!entry) {
      return;
    }

    const status = typeof entry.status === 'string' ? entry.status.toLowerCase() : 'pending';
    if (status === 'reviewed') {
      return;
    }

    const assessment = entry.assessment || {};
    const metadata = normalizeJson(assessment.metadata);
    const studyId =
      (entry.studyEnrollment && entry.studyEnrollment.studyId) ||
      metadata.studyId ||
      null;
    const studyLabel = metadata.studyTitle
      ? ` for ${metadata.studyTitle}`
      : studyId
      ? ` for Study #${studyId}`
      : '';
    const assignmentId = entry.id ? String(entry.id) : null;

    items.push({
      id: `competency-${assignmentId || Math.random().toString(36).slice(2)}-${status}`,
      type: 'competency',
      message: `New competency assigned: ${assessment.title || 'Assessment'}${studyLabel}.`,
      assignmentId,
      studyId: studyId ? String(studyId) : null,
      createdAt: normalizeTimestamp(entry.createdAt || entry.updatedAt),
    });
  });
  return items;
}

function normalizeTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function isToday(dateValue) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function hasStarted(dateValue) {
  if (!dateValue) return true;
  const start = new Date(dateValue);
  if (Number.isNaN(start.getTime())) return true;
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return today >= start;
}

function daysUntil(dateValue) {
  if (!dateValue) return 0;
  const start = new Date(dateValue);
  if (Number.isNaN(start.getTime())) return 0;
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = start.getTime() - today.getTime();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
}

function formatDateShort(value) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

function computeDeadlinePassed(timelineEnd) {
  if (!timelineEnd) {
    return false;
  }
  const endDate = new Date(timelineEnd);
  if (Number.isNaN(endDate.getTime())) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return endDate < today;
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

module.exports = router;
