const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const {
  sequelize,
  Study,
  CompetencyAssignment,
  StudyArtifact,
  StudyParticipant,
  User,
} = require('../models');
const { sendEmail, isEmailConfigured } = require('../services/emailService');
const authMiddleware = require('../middleware/auth');

const ARTIFACT_MODE_OPTIONS = [
  { value: 'stage1', label: 'Bug labeling – Stage 1' },
  { value: 'solid', label: 'SOLID review' },
  { value: 'clone', label: 'Patch clone check' },
  { value: 'snapshot', label: 'Snapshot intent' },
  { value: 'custom', label: 'Custom stage' },
];

const ARTIFACT_MODE_SET = new Set(ARTIFACT_MODE_OPTIONS.map((mode) => mode.value));
const DEFAULT_ARTIFACT_MODE = 'stage1';
const CUSTOM_STAGE_MAX_ARTIFACTS = 5;

const resolveDefaultArtifactMode = (value) => {
  if (value && ARTIFACT_MODE_SET.has(value)) {
    return value;
  }
  return DEFAULT_ARTIFACT_MODE;
};

const normalizeCustomQuestions = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      const type = typeof item?.type === 'string' ? item.type.toLowerCase() : '';
      if (!['mcq', 'dropdown', 'answer'].includes(type)) {
        return null;
      }
      const id = item?.id || `custom-q-${idx + 1}`;
      const prompt = typeof item?.prompt === 'string' ? item.prompt.trim() : '';
      if (!prompt) return null;
      let options = [];
      if (type === 'mcq' || type === 'dropdown') {
        options = Array.isArray(item?.options)
          ? item.options
              .map((opt) => (typeof opt === 'string' ? opt.trim() : ''))
              .filter((opt) => opt)
          : [];
        if (options.length < 2) return null;
      }
      return { id, type, prompt, options };
    })
    .filter(Boolean);
};

router.get('/public', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !['guest', 'participant', 'researcher', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Unauthorized to view public studies.' });
    }

    const studies = await Study.findAll({
      where: {
        status: { [Op.ne]: 'archived' },
        [Op.or]: [
          { isPublic: true },
          sequelize.where(sequelize.literal("(metadata->>'isPublic')::boolean"), true),
        ],
      },
      attributes: [
        'id',
        'title',
        'description',
        'timelineStart',
        'timelineEnd',
        'status',
        'isPublic',
        'metadata',
      ],
      include: [
        { model: User, as: 'researcher', attributes: ['id', 'name'] },
        {
          model: StudyArtifact,
          as: 'studyArtifacts',
          attributes: ['id', 'label', 'orderIndex'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const payload = studies.map((study) => {
      const plain = study.get({ plain: true });
      const artifacts = Array.isArray(plain.studyArtifacts) ? [...plain.studyArtifacts] : [];
      artifacts.sort((a, b) => {
        const aIndex = typeof a.orderIndex === 'number' ? a.orderIndex : Number(a.orderIndex) || 0;
        const bIndex = typeof b.orderIndex === 'number' ? b.orderIndex : Number(b.orderIndex) || 0;
        return aIndex - bIndex;
      });
      const safeMetadata = {};
      const metadata = plain.metadata && typeof plain.metadata === 'object' ? plain.metadata : {};
      if (typeof metadata.defaultArtifactMode !== 'undefined') {
        safeMetadata.defaultArtifactMode = metadata.defaultArtifactMode;
      }
      if (typeof metadata.isBlinded !== 'undefined') {
        safeMetadata.isBlinded = metadata.isBlinded;
      }
      return {
        id: plain.id,
        title: plain.title,
        description: plain.description,
        timelineStart: plain.timelineStart,
        timelineEnd: plain.timelineEnd,
        status: plain.status,
        isPublic: Boolean(plain.isPublic),
        researcher: plain.researcher ? { id: plain.researcher.id, name: plain.researcher.name } : null,
        artifactCount: artifacts.length,
        firstStudyArtifactId: artifacts.length ? artifacts[0].id : null,
        metadata: safeMetadata,
      };
    });

    return res.json({ studies: payload });
  } catch (error) {
    console.error('Public studies fetch error', error);
    return res.status(500).json({ message: 'Unable to load public studies right now.' });
  }
});

// ---
// CREATE A NEW STUDY (POST /)
// This will be the endpoint for your "Next" button
// ---

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

// We will add 'authMiddleware' here later to protect it
router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      title,
      description,
      criteria,
      researcherId,
      isPublic = false,
      isBlinded = false,
      timelineStart,
      timelineEnd,
      metadata = {},
      selectedParticipants = [],
      autoInvite = false,
      allowReviewers = false,
    } = req.body;

    if (!researcherId) {
      await transaction.rollback();
      return res.status(400).json({ message: 'A researcherId is required to create a study.' });
    }

    if (!title || !description) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const preparedMetadata = {
      ...metadata,
    };

    if (typeof preparedMetadata.isPublic === 'undefined') {
      preparedMetadata.isPublic = Boolean(isPublic);
    }

    if (typeof preparedMetadata.isBlinded === 'undefined') {
      preparedMetadata.isBlinded = Boolean(isBlinded);
    }

    const requestedDefaultMode = typeof req.body.defaultArtifactMode === 'string'
      ? req.body.defaultArtifactMode
      : preparedMetadata.defaultArtifactMode;
    const defaultArtifactMode = resolveDefaultArtifactMode(requestedDefaultMode);
    preparedMetadata.defaultArtifactMode = defaultArtifactMode;

    const participantSelection = Array.isArray(selectedParticipants) && selectedParticipants.length
      ? selectedParticipants
      : Array.isArray(preparedMetadata.selectedParticipants)
        ? preparedMetadata.selectedParticipants
        : [];

    const artifactSelection = Array.isArray(req.body.selectedArtifacts) && req.body.selectedArtifacts.length
      ? req.body.selectedArtifacts
      : Array.isArray(preparedMetadata.selectedArtifacts)
        ? preparedMetadata.selectedArtifacts
        : [];

    const autoInviteFlag = typeof autoInvite === 'boolean'
      ? autoInvite
      : Boolean(preparedMetadata.autoInvite);

    const shouldCreateAssignments = Boolean(
      preparedMetadata.requireAssessment && preparedMetadata.selectedAssessment,
    );

    const sanitizedParticipants = participantSelection
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const sanitizedArtifacts = artifactSelection
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (defaultArtifactMode === 'custom') {
      const customQuestions = normalizeCustomQuestions(
        Array.isArray(metadata.customQuestions) ? metadata.customQuestions : req.body.customQuestions,
      );
      if (!customQuestions.length) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Custom stage requires at least one valid question.' });
      }
      if (sanitizedArtifacts.length === 0) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Custom stage requires at least one artifact.' });
      }
      if (sanitizedArtifacts.length > CUSTOM_STAGE_MAX_ARTIFACTS) {
        await transaction.rollback();
        return res.status(400).json({ message: `Custom stage supports up to ${CUSTOM_STAGE_MAX_ARTIFACTS} artifacts.` });
      }
      preparedMetadata.customQuestions = customQuestions;
      preparedMetadata.customArtifactIds = sanitizedArtifacts;
    }

    const newStudy = await Study.create({
      title,
      description,
      criteria: Array.isArray(criteria) ? criteria : [],
      status: 'draft',
      isPublic: Boolean(isPublic),
      researcherId,
      timelineStart: normalizeDate(timelineStart),
      timelineEnd: normalizeDate(timelineEnd),
      metadata: preparedMetadata,
      allowReviewers: Boolean(allowReviewers),
    }, { transaction });

    let assignments = [];
    if (shouldCreateAssignments) {
      const assessmentId = Number(preparedMetadata.selectedAssessment);
      if (!Number.isNaN(assessmentId)) {
        assignments = await Promise.all(
          sanitizedParticipants.map((participantId) =>
            CompetencyAssignment.create(
              {
                assessmentId,
                participantId,
                researcherId,
                status: autoInviteFlag ? 'in_progress' : 'pending',
                decision: 'undecided',
                startedAt: null,
                submittedAt: null,
                reviewedAt: null,
                reviewerNotes: null,
              },
              { transaction },
            ),
          ),
        );
      }
    }

    let studyArtifacts = [];
    if (sanitizedArtifacts.length) {
      studyArtifacts = await Promise.all(
        sanitizedArtifacts.map((artifactId, idx) =>
          StudyArtifact.create(
            {
              studyId: newStudy.id,
              artifactId,
              orderIndex: idx,
            },
            { transaction },
          ),
        ),
      );
    }

    const assignmentByParticipant = new Map();
    assignments.forEach((assignment) => {
      const plain = assignment.get({ plain: true });
      assignmentByParticipant.set(plain.participantId, plain);
    });

    const defaultStudyArtifactId = studyArtifacts.length ? studyArtifacts[0].id : null;
    let studyParticipants = [];
    if (sanitizedParticipants.length) {
      studyParticipants = await Promise.all(
        sanitizedParticipants.map((participantId) =>
          StudyParticipant.create(
            {
              studyId: newStudy.id,
              participantId,
              competencyAssignmentId: assignmentByParticipant.get(participantId)?.id || null,
              invitationStatus: autoInviteFlag ? 'accepted' : 'pending',
              participationStatus: 'not_started',
              progressPercent: 0,
              startedAt: null,
              completedAt: null,
              lastCheckpoint: null,
              nextArtifactMode: defaultArtifactMode,
              nextStudyArtifactId: defaultStudyArtifactId,
            },
            { transaction },
          ),
        ),
      );
    }

    await transaction.commit();

    try {
      await sendStudyAssignmentInvitations({
        participantIds: sanitizedParticipants,
        researcherId,
        studyTitle: newStudy.title,
      });
    } catch (notificationError) {
      console.error('Failed to send study assignment notifications:', notificationError);
    }

    res.status(201).json({
      study: newStudy.get({ plain: true }),
      competencyAssignments: assignments.map((entry) => entry.get({ plain: true })),
      studyArtifacts: studyArtifacts.map((entry) => entry.get({ plain: true })),
      studyParticipants: studyParticipants.map((entry) => entry.get({ plain: true })),
    });
  } catch (error) {
    console.error('Error creating study:', error);
    await transaction.rollback();
    res.status(500).json({ message: 'Server error while creating study' });
  }
});

async function sendStudyAssignmentInvitations({ participantIds, researcherId, studyTitle }) {
  if (!Array.isArray(participantIds) || !participantIds.length) {
    return;
  }

  if (!isEmailConfigured()) {
    return;
  }

  const uniqueParticipantIds = Array.from(
    new Set(
      participantIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value)),
    ),
  );
  if (!uniqueParticipantIds.length) {
    return;
  }

  const [researcher, participants] = await Promise.all([
    typeof researcherId !== 'undefined'
      ? User.findByPk(researcherId, { attributes: ['id', 'name'], raw: true })
      : null,
    User.findAll({
      where: { id: { [Op.in]: uniqueParticipantIds } },
      attributes: ['id', 'name', 'email'],
      raw: true,
    }),
  ]);

  const researcherName = (researcher && researcher.name) || 'a StudyWeave researcher';
  const validRecipients = participants.filter((participant) => Boolean(participant?.email));
  if (!validRecipients.length) {
    return;
  }

  const subject = `You've been assigned to "${studyTitle}"`;
  await Promise.all(
    validRecipients.map((participant) => {
      const text = buildStudyAssignmentEmailText({
        participantName: participant.name,
        researcherName,
        studyTitle,
      });
      return sendEmail({
        to: participant.email,
        subject,
        text,
      });
    }),
  );
}

function buildStudyAssignmentEmailText({ participantName, researcherName, studyTitle }) {
  const greeting = participantName ? `Hello ${participantName},` : 'Hello,';
  const normalizedResearcher = researcherName || 'a StudyWeave researcher';
  const messageLines = [
    greeting,
    '',
    `Researcher ${normalizedResearcher} assigned you to the study "${studyTitle}".`,
    'Sign in to StudyWeave when you are ready to get started - this is just a reminder, so no direct link is included yet.',
    '',
    'Thanks,',
    'The StudyWeave Team',
  ];
  return messageLines.join('\n');
}

// We must export the router, just like in your other files
module.exports = router;
