const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const ArtifactCollection = sequelize.define('ArtifactCollection', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'name'],
      name: 'user_collection_name_unique',
    },
  ],
});

module.exports = ArtifactCollection;
