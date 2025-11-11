const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Study = sequelize.define(
  'Study',
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
    timelineStart: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'timeline_start',
    },
    timelineEnd: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'timeline_end',
    },
    status: {
      type: DataTypes.ENUM('draft', 'active', 'completed', 'archived'),
      allowNull: false,
      defaultValue: 'draft',
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_archived',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: 'studies',
    timestamps: true,
  }
);

module.exports = Study;
