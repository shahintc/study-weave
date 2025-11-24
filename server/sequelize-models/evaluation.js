const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Evaluation = sequelize.define(
  'Evaluation',
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
    comparisonId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'study_comparisons',
        key: 'id',
      },
      field: 'comparison_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    participantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      field: 'participant_id',
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
    status: {
      type: DataTypes.ENUM('draft', 'submitted'),
      allowNull: false,
      defaultValue: 'draft',
    },
    preference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    annotations: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    highlights: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metrics: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    participantPayload: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'participant_payload',
    },
    groundTruthPayload: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'ground_truth_payload',
    },
    adjudicatedLabel: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'adjudicated_label',
    },
    reviewStatus: {
      type: DataTypes.ENUM('pending', 'in_review', 'resolved'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'review_status',
    },
    reviewerDecision: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'reviewer_decision',
    },
    reviewerNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'reviewer_notes',
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'submitted_at',
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at',
    },
  },
  {
    tableName: 'evaluations',
    timestamps: true,
  }
);

module.exports = Evaluation;
