const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const StudyComparison = sequelize.define(
  'StudyComparison',
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
    primaryArtifactId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'study_artifacts',
        key: 'id',
      },
      field: 'primary_artifact_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    secondaryArtifactId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'study_artifacts',
        key: 'id',
      },
      field: 'secondary_artifact_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    criteria: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    groundTruth: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'ground_truth',
    },
  },
  {
    tableName: 'study_comparisons',
    timestamps: true,
  }
);

module.exports = StudyComparison;
