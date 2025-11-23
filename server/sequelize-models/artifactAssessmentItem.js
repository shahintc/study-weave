const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const ArtifactAssessmentItem = sequelize.define(
  'ArtifactAssessmentItem',
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
        model: 'artifact_assessments',
        key: 'id',
      },
      field: 'assessment_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    dimension: {
      type: DataTypes.ENUM('bug_stage', 'solid_principle', 'clone_link', 'snapshot_note'),
      allowNull: false,
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    score: {
      type: DataTypes.DECIMAL,
      allowNull: true,
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: 'artifact_assessment_items',
    timestamps: true,
  }
);

module.exports = ArtifactAssessmentItem;
