const sequelize = require('../sequelize');
const User = require('../sequelize-models/user');
const Artifact = require('../sequelize-models/artifact');
const Tag = require('../sequelize-models/tag');
const Role = require('../sequelize-models/role');
const CompetencyAssessment = require('../sequelize-models/competencyAssessment');
const CompetencyAssignment = require('../sequelize-models/competencyAssignment');
const Study = require('../sequelize-models/study');
const StudyParticipant = require('../sequelize-models/studyParticipant');
const StudyArtifact = require('../sequelize-models/studyArtifact');
const StudyComparison = require('../sequelize-models/studyComparison');
const Evaluation = require('../sequelize-models/evaluation');
const ArtifactAssessment = require('../sequelize-models/artifactAssessment');
const ArtifactAssessmentItem = require('../sequelize-models/artifactAssessmentItem');

// User / Role
Role.hasMany(User, { foreignKey: 'roleId', as: 'users' });
User.belongsTo(Role, { foreignKey: 'roleId', as: 'roleDetails' });

// User / Artifact
User.hasMany(Artifact, { foreignKey: 'userId', as: 'artifacts' });
Artifact.belongsTo(User, { foreignKey: 'userId', as: 'uploader' });

// Many-to-many association between Artifact and Tag
Artifact.belongsToMany(Tag, { through: 'ArtifactTag', foreignKey: 'artifactId', as: 'tags' });
Tag.belongsToMany(Artifact, { through: 'ArtifactTag', foreignKey: 'tagId', as: 'artifacts' });

// Competency assessments
User.hasMany(CompetencyAssessment, { foreignKey: 'researcherId', as: 'authoredAssessments' });
CompetencyAssessment.belongsTo(User, { foreignKey: 'researcherId', as: 'researcher' });

CompetencyAssessment.hasMany(CompetencyAssignment, { foreignKey: 'assessmentId', as: 'assignments' });
CompetencyAssignment.belongsTo(CompetencyAssessment, { foreignKey: 'assessmentId', as: 'assessment' });

User.hasMany(CompetencyAssignment, { foreignKey: 'participantId', as: 'assessmentAssignments' });
CompetencyAssignment.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

User.hasMany(CompetencyAssignment, { foreignKey: 'researcherId', as: 'sentAssessments' });
CompetencyAssignment.belongsTo(User, { foreignKey: 'researcherId', as: 'assignmentResearcher' });

// Studies
User.hasMany(Study, { foreignKey: 'researcherId', as: 'managedStudies' });
Study.belongsTo(User, { foreignKey: 'researcherId', as: 'researcher' });

Study.hasMany(StudyParticipant, { foreignKey: 'studyId', as: 'participants' });
StudyParticipant.belongsTo(Study, { foreignKey: 'studyId', as: 'study' });

User.hasMany(StudyParticipant, { foreignKey: 'participantId', as: 'studyEnrollments' });
StudyParticipant.belongsTo(User, { foreignKey: 'participantId', as: 'participant' });

CompetencyAssignment.hasOne(StudyParticipant, { foreignKey: 'competencyAssignmentId', as: 'studyEnrollment' });
StudyParticipant.belongsTo(CompetencyAssignment, {
  foreignKey: 'competencyAssignmentId',
  as: 'sourceAssignment',
});

// Study artifacts & comparisons
Study.hasMany(StudyArtifact, { foreignKey: 'studyId', as: 'studyArtifacts' });
StudyArtifact.belongsTo(Study, { foreignKey: 'studyId', as: 'study' });

Artifact.hasMany(StudyArtifact, { foreignKey: 'artifactId', as: 'studyUsages' });
StudyArtifact.belongsTo(Artifact, { foreignKey: 'artifactId', as: 'artifact' });

Study.hasMany(StudyComparison, { foreignKey: 'studyId', as: 'comparisons' });
StudyComparison.belongsTo(Study, { foreignKey: 'studyId', as: 'study' });

StudyArtifact.hasMany(StudyComparison, { foreignKey: 'primaryArtifactId', as: 'primaryComparisons' });
StudyArtifact.hasMany(StudyComparison, { foreignKey: 'secondaryArtifactId', as: 'secondaryComparisons' });

StudyComparison.belongsTo(StudyArtifact, { foreignKey: 'primaryArtifactId', as: 'primaryArtifact' });
StudyComparison.belongsTo(StudyArtifact, { foreignKey: 'secondaryArtifactId', as: 'secondaryArtifact' });

// Evaluations
Study.hasMany(Evaluation, { foreignKey: 'studyId', as: 'evaluations' });
Evaluation.belongsTo(Study, { foreignKey: 'studyId', as: 'study' });

StudyComparison.hasMany(Evaluation, { foreignKey: 'comparisonId', as: 'evaluations' });
Evaluation.belongsTo(StudyComparison, { foreignKey: 'comparisonId', as: 'comparison' });

User.hasMany(Evaluation, { foreignKey: 'participantId', as: 'submittedEvaluations' });
Evaluation.belongsTo(User, { foreignKey: 'participantId', as: 'participantEvaluator' });

StudyParticipant.hasMany(Evaluation, { foreignKey: 'studyParticipantId', as: 'evaluations' });
Evaluation.belongsTo(StudyParticipant, { foreignKey: 'studyParticipantId', as: 'studyParticipant' });

// Artifact assessments
Study.hasMany(ArtifactAssessment, { foreignKey: 'studyId', as: 'artifactAssessments' });
ArtifactAssessment.belongsTo(Study, { foreignKey: 'studyId', as: 'study' });

StudyArtifact.hasMany(ArtifactAssessment, { foreignKey: 'studyArtifactId', as: 'artifactAssessments' });
ArtifactAssessment.belongsTo(StudyArtifact, { foreignKey: 'studyArtifactId', as: 'studyArtifact' });

StudyParticipant.hasMany(ArtifactAssessment, { foreignKey: 'studyParticipantId', as: 'artifactAssessments' });
ArtifactAssessment.belongsTo(StudyParticipant, {
  foreignKey: 'studyParticipantId',
  as: 'studyParticipant',
});

User.hasMany(ArtifactAssessment, { foreignKey: 'evaluatorUserId', as: 'artifactAssessmentsAuthored' });
ArtifactAssessment.belongsTo(User, { foreignKey: 'evaluatorUserId', as: 'evaluator' });

Evaluation.hasMany(ArtifactAssessment, { foreignKey: 'sourceEvaluationId', as: 'artifactAssessments' });
ArtifactAssessment.belongsTo(Evaluation, { foreignKey: 'sourceEvaluationId', as: 'sourceEvaluation' });

Artifact.hasMany(ArtifactAssessment, { foreignKey: 'snapshotArtifactId', as: 'snapshotAssessments' });
ArtifactAssessment.belongsTo(Artifact, { foreignKey: 'snapshotArtifactId', as: 'snapshotArtifact' });

ArtifactAssessment.hasMany(ArtifactAssessmentItem, { foreignKey: 'assessmentId', as: 'items' });
ArtifactAssessmentItem.belongsTo(ArtifactAssessment, { foreignKey: 'assessmentId', as: 'assessment' });

const models = {
  sequelize,
  User,
  Artifact,
  Tag,
  Role,
  CompetencyAssessment,
  CompetencyAssignment,
  Study,
  StudyParticipant,
  StudyArtifact,
  StudyComparison,
  Evaluation,
  ArtifactAssessment,
  ArtifactAssessmentItem,
};

module.exports = models;
