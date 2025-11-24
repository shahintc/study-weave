const {
  ArtifactAssessment,
  CompetencyAssignment,
  CompetencyAssessment,
  StudyParticipant,
  StudyArtifact,
  Study,
  Artifact,
  User,
} = require('../models');
const emailService = require('./emailService');

const DEFAULT_MIN_PROGRESS = 40;

async function handleCompetencySubmission({ assignmentId, transaction }) {
  if (!assignmentId) {
    return null;
  }

  const assignment = await CompetencyAssignment.findByPk(assignmentId, {
    include: [
      { model: User, as: 'participant', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'assignmentResearcher', attributes: ['id', 'name', 'email'] },
      { model: CompetencyAssessment, as: 'assessment', attributes: ['id', 'title'] },
      {
        model: StudyParticipant,
        as: 'studyEnrollment',
        include: [
          {
            model: Study,
            as: 'study',
            include: [{ model: User, as: 'researcher', attributes: ['id', 'name', 'email'] }],
          },
        ],
      },
    ],
    transaction,
  });

  if (!assignment || assignment.status !== 'submitted') {
    return null;
  }

  if (assignment.studyEnrollment) {
    await updateParticipantRecord(assignment.studyEnrollment, 'competency_submitted', transaction);
  }

  return {
    type: 'competency',
    researcherName:
      assignment.assignmentResearcher?.name || assignment.studyEnrollment?.study?.researcher?.name || 'Researcher',
    researcherEmail:
      assignment.assignmentResearcher?.email || assignment.studyEnrollment?.study?.researcher?.email || null,
    participantName: assignment.participant?.name || `Participant ${assignment.participantId}`,
    participantEmail: assignment.participant?.email || null,
    studyTitle: assignment.studyEnrollment?.study?.title || assignment.assessment?.title || 'Study',
    assignmentTitle: assignment.assessment?.title || 'Competency assessment',
    submittedAt: assignment.submittedAt || new Date(),
  };
}

async function handleArtifactSubmission({ assessmentId, transaction }) {
  if (!assessmentId) {
    return null;
  }

  const assessment = await ArtifactAssessment.findByPk(assessmentId, {
    include: [
      {
        model: StudyParticipant,
        as: 'studyParticipant',
        include: [
          { model: User, as: 'participant', attributes: ['id', 'name', 'email'] },
          {
            model: Study,
            as: 'study',
            include: [{ model: User, as: 'researcher', attributes: ['id', 'name', 'email'] }],
          },
        ],
      },
      {
        model: StudyArtifact,
        as: 'studyArtifact',
        include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name'] }],
      },
      {
        model: Study,
        as: 'study',
        include: [{ model: User, as: 'researcher', attributes: ['id', 'name', 'email'] }],
      },
      { model: User, as: 'evaluator', attributes: ['id', 'name', 'email'] },
    ],
    transaction,
  });

  if (!assessment || assessment.status !== 'submitted') {
    return null;
  }

  if (assessment.studyParticipant) {
    await updateParticipantRecord(assessment.studyParticipant, 'artifact_submitted', transaction);
  }

  const participant = assessment.studyParticipant?.participant;
  const researcher = assessment.studyParticipant?.study?.researcher || assessment.study?.researcher;
  const artifactLabel =
    assessment.studyArtifact?.label ||
    assessment.studyArtifact?.artifact?.name ||
    `Artifact ${assessment.studyArtifactId}`;

  return {
    type: 'artifact',
    researcherName: researcher?.name || 'Researcher',
    researcherEmail: researcher?.email || null,
    participantName:
      participant?.name || assessment.evaluator?.name || `Participant ${assessment.studyParticipant?.participantId || ''}`,
    participantEmail: participant?.email || assessment.evaluator?.email || null,
    studyTitle: assessment.study?.title || assessment.studyParticipant?.study?.title || 'Study',
    artifactLabel,
    assessmentType: assessment.assessmentType,
    submittedAt: assessment.createdAt || new Date(),
  };
}

async function updateParticipantRecord(participantInstance, stage, transaction) {
  const now = new Date();
  const currentProgress = Number(participantInstance.progressPercent) || 0;
  const updates = {};

  if (stage === 'competency_submitted') {
    if (!participantInstance.startedAt) {
      updates.startedAt = now;
    }
    if (participantInstance.participationStatus === 'not_started') {
      updates.participationStatus = 'in_progress';
    }
    if (currentProgress < DEFAULT_MIN_PROGRESS) {
      updates.progressPercent = DEFAULT_MIN_PROGRESS;
    }
  } else if (stage === 'artifact_submitted') {
    if (!participantInstance.startedAt) {
      updates.startedAt = now;
    }
    updates.participationStatus = 'completed';
    updates.completedAt = now;
    if (currentProgress < 100) {
      updates.progressPercent = 100;
    }
    updates.nextArtifactMode = null;
    updates.nextStudyArtifactId = null;
  }

  if (Object.keys(updates).length) {
    await participantInstance.update(updates, { transaction });
  }
}

async function sendResearcherNotification(context) {
  if (!context) {
    return null;
  }

  if (!context.researcherEmail) {
    console.log('[SubmissionNotification] Missing researcher email; skipping send.', {
      type: context.type,
      studyTitle: context.studyTitle,
    });
    return { skipped: true };
  }

  const participantName = context.participantName || 'A participant';
  const submissionLabel =
    context.type === 'artifact'
      ? `${context.artifactLabel || 'an artifact task'}`
      : `${context.assignmentTitle || 'the competency assessment'}`;
  const subject =
    context.type === 'artifact'
      ? `[StudyWeave] ${participantName} submitted ${submissionLabel}`
      : `[StudyWeave] ${participantName} submitted a competency assessment`;

  const details = [
    `Study: ${context.studyTitle || 'Study'}`,
    `Participant email: ${context.participantEmail || 'Not provided'}`,
    `Submitted at: ${new Date(context.submittedAt).toLocaleString('en-US')}`,
  ];

  const greeting = `Hi ${context.researcherName || 'there'},`;
  const summary = `${participantName} just submitted ${submissionLabel}.`;
  const closing = 'You can review the submission in StudyWeave.';

  const text = [greeting, '', summary, '', ...details, '', closing].join('\n');
  const html = `
    <p>${greeting}</p>
    <p>${summary}</p>
    <ul>
      ${details.map((line) => `<li>${line}</li>`).join('')}
    </ul>
    <p>${closing}</p>
  `;

  console.log('[SubmissionNotification] Sending', subject, '->', context.researcherEmail);
  return emailService.sendMail({ to: context.researcherEmail, subject, text, html });
}

module.exports = {
  handleCompetencySubmission,
  handleArtifactSubmission,
  sendResearcherNotification,
};
