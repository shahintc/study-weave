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

const DEFAULT_MIN_PROGRESS = 40;
const EMAIL_NOTIFICATIONS_ENABLED = false;

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

  const context = {
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

  return EMAIL_NOTIFICATIONS_ENABLED ? context : null;
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

  const context = {
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

  return EMAIL_NOTIFICATIONS_ENABLED ? context : null;
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
  if (!context || !EMAIL_NOTIFICATIONS_ENABLED) {
    return Promise.resolve({ skipped: true, reason: 'Email notifications disabled' });
  }

  return Promise.resolve({ skipped: true, reason: 'Email notifications disabled' });
}

module.exports = {
  handleCompetencySubmission,
  handleArtifactSubmission,
  sendResearcherNotification,
};
