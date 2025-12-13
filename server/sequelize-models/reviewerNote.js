const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const ReviewerNote = sequelize.define(
  'ReviewerNote',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    evaluationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'evaluations',
        key: 'id',
      },
      field: 'evaluation_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    reviewerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      field: 'reviewer_id',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'reviewer_notes',
    timestamps: true,
  },
);

module.exports = ReviewerNote;
