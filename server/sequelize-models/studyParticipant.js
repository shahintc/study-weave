const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const StudyParticipant = sequelize.define(
  'StudyParticipant',
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
    competencyAssignmentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'competency_assignments',
        key: 'id',
      },
      field: 'competency_assignment_id',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    invitationStatus: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'invitation_status',
    },
    participationStatus: {
      type: DataTypes.ENUM('not_started', 'in_progress', 'completed'),
      allowNull: false,
      defaultValue: 'not_started',
      field: 'participation_status',
    },
    progressPercent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'progress_percent',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
    lastCheckpoint: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'last_checkpoint',
    },
    nextArtifactMode: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'next_artifact_mode',
    },
    nextStudyArtifactId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'study_artifacts',
        key: 'id',
      },
      field: 'next_study_artifact_id',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    source: {
      type: DataTypes.ENUM('invited', 'public_guest'),
      allowNull: false,
      defaultValue: 'invited',
    },
    guestSessionId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'guest_session_id',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
    },
  },
  {
    tableName: 'study_participants',
    timestamps: true,
  }
);

module.exports = StudyParticipant;
