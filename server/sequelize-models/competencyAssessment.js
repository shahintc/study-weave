const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const CompetencyAssessment = sequelize.define(
  'CompetencyAssessment',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    criteria: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    questions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    totalScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'total_score',
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'archived'),
      defaultValue: 'draft',
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: 'competency_assessments',
    timestamps: true,
  }
);

module.exports = CompetencyAssessment;
