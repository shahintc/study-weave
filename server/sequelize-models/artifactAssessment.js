const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const ArtifactAssessment = sequelize.define(
  'ArtifactAssessment',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    studyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'studies',
        key: 'id',
      },
      field: 'study_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    studyArtifactId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'study_artifacts',
        key: 'id',
      },
      field: 'study_artifact_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    studyParticipantId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'study_participants',
        key: 'id',
      },
      field: 'study_participant_id',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    evaluatorUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      field: 'evaluator_user_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    sourceEvaluationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'evaluations',
        key: 'id',
      },
      field: 'source_evaluation_id',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    assessmentType: {
      type: DataTypes.ENUM('bug_stage', 'solid', 'clone', 'snapshot', 'custom'),
      allowNull: false,
      field: 'assessment_type',
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'archived'),
      allowNull: false,
      defaultValue: 'submitted',
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    snapshotArtifactId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'artifacts',
        key: 'id',
      },
      field: 'snapshot_artifact_id',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
  },
  {
    tableName: 'artifact_assessments',
    timestamps: true,
    indexes: [
      {
        name: 'artifact_assessments_type_idx',
        fields: ['assessment_type'],
      },
      {
        name: 'artifact_assessments_study_idx',
        fields: ['study_id', 'study_artifact_id'],
      },
    ],
  }
);

module.exports = ArtifactAssessment;
