const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const CompetencyAssignment = sequelize.define(
  'CompetencyAssignment',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    assessmentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'competency_assessments',
        key: 'id',
      },
      field: 'assessment_id',
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
    researcherId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      field: 'researcher_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'submitted', 'reviewed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    decision: {
      type: DataTypes.ENUM('undecided', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'undecided',
    },
    responses: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    score: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at',
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
    reviewerNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'reviewer_notes',
    },
    timeTakenSeconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'time_taken_seconds',
    },
  },
  {
    tableName: 'competency_assignments',
    timestamps: true,
  }
);

module.exports = CompetencyAssignment;
