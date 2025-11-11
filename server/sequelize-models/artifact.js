const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');

const Artifact = sequelize.define(
  'Artifact',
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
    type: {
      type: DataTypes.ENUM('AI', 'human'),
      allowNull: false,
    },
    filePath: { // To store the path to the file managed by Multer
      type: DataTypes.STRING,
      allowNull: false,
    },
    fileMimeType: { // To store the MIME type of the file
      type: DataTypes.STRING,
      allowNull: false,
    },
    fileOriginalName: { // To store the original name of the file
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users', // This is the table name of the User model
        key: 'id',
      },
    },
  },
  {
    tableName: 'artifacts',
    timestamps: true, // Let Sequelize manage createdAt and updatedAt
  }
);




module.exports = Artifact;
