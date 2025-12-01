const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const ActionLog = sequelize.define(
  'ActionLog',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      field: 'user_id',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    studyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'studies',
        key: 'id',
      },
      field: 'study_id',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    action: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: 'action_logs',
    timestamps: true,
  }
);

module.exports = ActionLog;
