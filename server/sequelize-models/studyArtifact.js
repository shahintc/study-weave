const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const StudyArtifact = sequelize.define(
  'StudyArtifact',
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
    artifactId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'artifacts',
        key: 'id',
      },
      field: 'artifact_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    label: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'order_index',
    },
  },
  {
    tableName: 'study_artifacts',
    timestamps: true,
  }
);

module.exports = StudyArtifact;
