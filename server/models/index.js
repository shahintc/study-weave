const sequelize = require('../sequelize');
const User = require('../sequelize-models/user');
const Artifact = require('../sequelize-models/artifact');
const Tag = require('../sequelize-models/tag'); // Import the Tag model

// Define associations
User.hasMany(Artifact, { foreignKey: 'userId', as: 'artifacts' });
Artifact.belongsTo(User, { foreignKey: 'userId', as: 'uploader' });

// Many-to-many association between Artifact and Tag
Artifact.belongsToMany(Tag, { through: 'ArtifactTag', foreignKey: 'artifactId', as: 'tags' });
Tag.belongsToMany(Artifact, { through: 'ArtifactTag', foreignKey: 'tagId', as: 'artifacts' });


const models = {
  User,
  Artifact,
  Tag, // Add Tag to the exported models
  sequelize,
};

module.exports = models;