const { Artifact: SequelizeArtifact, Tag } = require('../models'); // Import Sequelize models
const path = require('path');
const fs = require('fs/promises'); // For file system operations

class Artifact {
  static async create(artifactData, file) {
    const { name, type, userId, tagNames = [] } = artifactData;

    if (!file) {
      throw new Error('File is required for artifact creation.');
    }
    if (!name || !type || !userId) {
      // Clean up the uploaded file if validation fails
      await fs.unlink(file.path).catch(err => console.error(`Error deleting temp file: ${err.message}`));
      throw new Error('Name, type, and userId are required.');
    }

    try {
      // 1. Create the Artifact entry in the database
      const newArtifact = await SequelizeArtifact.create({
        name,
        type,
        userId,
        filePath: file.path, // Multer stores the path
        fileMimeType: file.mimetype,
        fileOriginalName: file.originalname,
      });

      // 2. Handle Tags (find existing or create new ones)
      const artifactTags = [];
      if (tagNames && tagNames.length > 0) {
        for (const tagName of tagNames) {
          const [tag, created] = await Tag.findOrCreate({
            where: { name: tagName.trim() },
            defaults: { name: tagName.trim() },
          });
          artifactTags.push(tag);
        }
        // 3. Associate tags with the new artifact
        await newArtifact.addTags(artifactTags);
      }

      // Return a clean object for the API response
      const plainArtifact = newArtifact.get({ plain: true });
      return {
        id: plainArtifact.id,
        name: plainArtifact.name,
        type: plainArtifact.type,
        userId: plainArtifact.userId,
        filePath: plainArtifact.filePath,
        fileMimeType: plainArtifact.fileMimeType,
        fileOriginalName: plainArtifact.fileOriginalName,
        tags: artifactTags.map(tag => ({ id: tag.id, name: tag.name })), // Include associated tags
        createdAt: plainArtifact.createdAt,
      };

    } catch (error) {
      // If any database operation fails, clean up the uploaded file
      await fs.unlink(file.path).catch(err => console.error(`Error deleting failed upload file: ${err.message}`));
      throw error; // Re-throw the error for upstream handling
    }
  }

  static async findArtifactsByUserId(userId) {
    try {
      const artifacts = await SequelizeArtifact.findAll({
        where: { userId },
        attributes: { exclude: ['filePath'] }, // Exclude the filePath from the result
        include: [{
          model: Tag,
          as: 'tags',
          attributes: ['id', 'name'], // Only include id and name for tags
          through: { attributes: [] } // Exclude join table attributes
        }],
        order: [['createdAt', 'DESC']], // Order by creation date, newest first
      });

      return artifacts.map(artifact => {
        const plainArtifact = artifact.get({ plain: true });
        return {
          ...plainArtifact,
          tags: plainArtifact.tags.map(tag => ({ id: tag.id, name: tag.name }))
        };
      });
    } catch (error) {
      console.error(`Error fetching artifacts for user ${userId}:`, error);
      throw error;
    }
  }
  static async update(id, artifactData, file) {
    const { name, type, userId, tagNames } = artifactData;

    try {
      const artifact = await SequelizeArtifact.findByPk(id);
      if (!artifact) {
        // Clean up the newly uploaded file if the artifact is not found
        if (file) {
          await fs.unlink(file.path).catch(err => console.error(`Error deleting temp file for non-existent artifact: ${err.message}`));
        }
        return null; // Artifact not found
      }

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (type !== undefined) updates.type = type;
      if (userId !== undefined) updates.userId = userId;

      // Handle file update
      if (file) {
        // Delete the old file from the file system
        if (artifact.filePath) {
          await fs.unlink(artifact.filePath).catch(err => console.error(`Error deleting old artifact file ${artifact.filePath}: ${err.message}`));
        }
        updates.filePath = file.path;
        updates.fileMimeType = file.mimetype;
        updates.fileOriginalName = file.originalname;
      }

      // Apply metadata updates
      await artifact.update(updates);

      // Handle tag updates if tagNames are provided
      if (tagNames !== undefined) {
        const currentTags = await artifact.getTags();
        await artifact.removeTags(currentTags); // Remove all current associations

        const newTags = [];
        if (tagNames && tagNames.length > 0) {
          for (const tagName of tagNames) {
            const [tag] = await Tag.findOrCreate({
              where: { name: tagName.trim() },
              defaults: { name: tagName.trim() },
            });
            newTags.push(tag);
          }
        }
        await artifact.addTags(newTags); // Add new associations
      }

      // Re-fetch the artifact with updated tags for the response
      const updatedArtifact = await SequelizeArtifact.findByPk(id, {
        attributes: { exclude: ['filePath'] },
        include: [{
          model: Tag,
          as: 'tags',
          attributes: ['id', 'name'],
          through: { attributes: [] }
        }]
      });

      const plainArtifact = updatedArtifact.get({ plain: true });
      return {
        ...plainArtifact,
        tags: plainArtifact.tags.map(tag => ({ id: tag.id, name: tag.name })),
      };

    } catch (error) {
      // If any database operation fails after a new file was uploaded, clean it up
      if (file) {
        await fs.unlink(file.path).catch(err => console.error(`Error deleting failed update file: ${err.message}`));
      }
      console.error(`Error updating artifact ${id}:`, error);
      throw error;
    }
  }
}

module.exports = Artifact;