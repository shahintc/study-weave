const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'roles',
        key: 'id',
      },
      field: 'role_id',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'participant',
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'email_verified',
    },
    verificationCode: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'verification_code',
    },
    verificationExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verification_expires',
    },
    resetCode: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'reset_code',
    },
    resetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reset_expires',
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'users',
    timestamps: false,
  }
);

module.exports = User;
