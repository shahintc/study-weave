const { ArtifactCollection: SequelizeArtifactCollection, Artifact, User, Tag } = require('../models');

class ArtifactCollection {
  static async create(collectionData) {
    const { name, description, userId, artifactIds = [] } = collectionData;

    if (!name || !userId) {
      throw new Error('Collection name and userId are required.');
    }

    try {
      const newCollection = await SequelizeArtifactCollection.create({
        name,
        description,
        userId,
      });

      if (artifactIds && artifactIds.length > 0) {
        const artifacts = await Artifact.findAll({
          where: {
            id: artifactIds,
            userId: userId, // Ensure artifacts belong to the same user
          },
        });
        if (artifacts.length !== artifactIds.length) {
          // Some artifact IDs were not found or did not belong to the user
          await newCollection.destroy(); // Rollback collection creation
          throw new Error('One or more artifacts not found or do not belong to the user.');
        }
        await newCollection.addArtifacts(artifacts);
      }

      const plainCollection = newCollection.get({ plain: true });
      return {
        id: plainCollection.id,
        name: plainCollection.name,
        description: plainCollection.description,
        userId: plainCollection.userId,
        artifacts: artifactIds, // For initial creation, just return the IDs passed
        createdAt: plainCollection.createdAt,
      };

    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error(`Collection with name '${name}' already exists for this user.`);
      }
      console.error('Error creating artifact collection:', error);
      throw error;
    }
  }

  static async findById(id, userId) {
    try {
      const collection = await SequelizeArtifactCollection.findOne({
        where: { id, userId },
        include: [{
          model: Artifact,
          as: 'artifacts',
          attributes: ['id', 'name', 'type', 'fileMimeType', 'fileOriginalName', 'createdAt'],
          through: { attributes: [] },
          include: [{
            model: Tag,
            as: 'tags',
            attributes: ['id', 'name'],
            through: { attributes: [] }
          }]
        }, {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email'],
        }],
      });

      if (!collection) {
        return null;
      }

      const plainCollection = collection.get({ plain: true });
      return {
        ...plainCollection,
        artifacts: plainCollection.artifacts ? plainCollection.artifacts.map(art => ({
          id: art.id,
          name: art.name,
          type: art.type,
          fileMimeType: art.fileMimeType,
          fileOriginalName: art.fileOriginalName,
          createdAt: art.createdAt,
          tags: art.tags ? art.tags.map(tag => ({ id: tag.id, name: tag.name })) : [],
        })) : [],
      };
    } catch (error) {
      console.error(`Error fetching artifact collection by ID ${id}:`, error);
      throw error;
    }
  }

  static async findByUserId(userId) {
    try {
      const collections = await SequelizeArtifactCollection.findAll({
        where: { userId },
        include: [{
          model: Artifact,
          as: 'artifacts',
          attributes: ['id', 'name', 'type', 'fileMimeType', 'fileOriginalName', 'createdAt'],
          through: { attributes: [] },
          include: [{
            model: Tag,
            as: 'tags',
            attributes: ['id', 'name'],
            through: { attributes: [] }
          }]
        }],
        order: [['createdAt', 'DESC']],
      });

      return collections.map(collection => {
        const plainCollection = collection.get({ plain: true });
        return {
          ...plainCollection,
          artifacts: plainCollection.artifacts ? plainCollection.artifacts.map(art => ({
            id: art.id,
            name: art.name,
            type: art.type,
            fileMimeType: art.fileMimeType,
            fileOriginalName: art.fileOriginalName,
            createdAt: art.createdAt,
            tags: art.tags ? art.tags.map(tag => ({ id: tag.id, name: tag.name })) : [],
          })) : [],
        };
      });
    } catch (error) {
      console.error(`Error fetching artifact collections for user ${userId}:`, error);
      throw error;
    }
  }

  static async update(id, userId, updateData) {
    const { name, description, artifactIds } = updateData;

    try {
      const collection = await SequelizeArtifactCollection.findOne({
        where: { id, userId },
      });

      if (!collection) {
        return null; // Collection not found or not owned by user
      }

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;

      await collection.update(updates);

      // Handle artifact associations update
      if (artifactIds !== undefined) {
        const artifacts = await Artifact.findAll({
          where: {
            id: artifactIds,
            userId: userId, // Ensure artifacts belong to the same user
          },
        });

        // Check if all requested artifact IDs were found and belong to the user
        if (artifacts.length !== artifactIds.length) {
          throw new Error('One or more artifacts to associate not found or do not belong to the user.');
        }

        await collection.setArtifacts(artifacts); // Replaces all current associations
      }

      // Re-fetch the collection with updated artifacts for the response
      const updatedCollection = await SequelizeArtifactCollection.findOne({
        where: { id },
        include: [{
          model: Artifact,
          as: 'artifacts',
          attributes: ['id', 'name', 'type', 'fileMimeType', 'fileOriginalName', 'createdAt'],
          through: { attributes: [] },
          include: [{
            model: Tag,
            as: 'tags',
            attributes: ['id', 'name'],
            through: { attributes: [] }
          }]
        }],
      });

      const plainCollection = updatedCollection.get({ plain: true });
      return {
        ...plainCollection,
        artifacts: plainCollection.artifacts ? plainCollection.artifacts.map(art => ({
          id: art.id,
          name: art.name,
          type: art.type,
          fileMimeType: art.fileMimeType,
          fileOriginalName: art.fileOriginalName,
          createdAt: art.createdAt,
          tags: art.tags ? art.tags.map(tag => ({ id: tag.id, name: tag.name })) : [],
        })) : [],
      };

    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error(`Collection with name '${name}' already exists for this user.`);
      }
      console.error(`Error updating artifact collection ${id}:`, error);
      throw error;
    }
  }

  static async delete(id, userId) {
    try {
      const collection = await SequelizeArtifactCollection.findOne({
        where: { id, userId },
      });

      if (!collection) {
        return null; // Collection not found or not owned by user
      }

      await collection.destroy();
      return { id };
    } catch (error) {
      console.error(`Error deleting artifact collection ${id}:`, error);
      throw error;
    }
  }

  // Method to add a single artifact to a collection
  static async addArtifactToCollection(collectionId, userId, artifactId) {
    try {
      const collection = await SequelizeArtifactCollection.findOne({
        where: { id: collectionId, userId },
      });

      if (!collection) {
        throw new Error('Collection not found or not owned by user.');
      }

      const artifact = await Artifact.findOne({
        where: { id: artifactId, userId },
      });

      if (!artifact) {
        throw new Error('Artifact not found or not owned by user.');
      }

      await collection.addArtifact(artifact);

      // Re-fetch the collection with updated artifacts for the response
      const updatedCollection = await SequelizeArtifactCollection.findOne({
        where: { id: collectionId },
        include: [{
          model: Artifact,
          as: 'artifacts',
          attributes: ['id', 'name', 'type', 'fileMimeType', 'fileOriginalName', 'createdAt'],
          through: { attributes: [] },
          include: [{
            model: Tag,
            as: 'tags',
            attributes: ['id', 'name'],
            through: { attributes: [] }
          }]
        }],
      });

      const plainCollection = updatedCollection.get({ plain: true });
      return {
        ...plainCollection,
        artifacts: plainCollection.artifacts ? plainCollection.artifacts.map(art => ({
          id: art.id,
          name: art.name,
          type: art.type,
          fileMimeType: art.fileMimeType,
          fileOriginalName: art.fileOriginalName,
          createdAt: art.createdAt,
          tags: art.tags ? art.tags.map(tag => ({ id: tag.id, name: tag.name })) : [],
        })) : [],
      };
    } catch (error) {
      console.error(`Error adding artifact ${artifactId} to collection ${collectionId}:`, error);
      throw error;
    }
  }

  // Method to remove a single artifact from a collection
  static async removeArtifactFromCollection(collectionId, userId, artifactId) {
    try {
      const collection = await SequelizeArtifactCollection.findOne({
        where: { id: collectionId, userId },
      });

      if (!collection) {
        throw new Error('Collection not found or not owned by user.');
      }

      const artifact = await Artifact.findOne({
        where: { id: artifactId, userId },
      });

      if (!artifact) {
        throw new Error('Artifact not found or not owned by user.');
      }

      await collection.removeArtifact(artifact);

      // Re-fetch the collection with updated artifacts for the response
      const updatedCollection = await SequelizeArtifactCollection.findOne({
        where: { id: collectionId },
        include: [{
          model: Artifact,
          as: 'artifacts',
          attributes: ['id', 'name', 'type', 'fileMimeType', 'fileOriginalName', 'createdAt'],
          through: { attributes: [] },
          include: [{
            model: Tag,
            as: 'tags',
            attributes: ['id', 'name'],
            through: { attributes: [] }
          }]
        }],
      });

      const plainCollection = updatedCollection.get({ plain: true });
      return {
        ...plainCollection,
        artifacts: plainCollection.artifacts ? plainCollection.artifacts.map(art => ({
          id: art.id,
          name: art.name,
          type: art.type,
          fileMimeType: art.fileMimeType,
          fileOriginalName: art.fileOriginalName,
          createdAt: art.createdAt,
          tags: art.tags ? art.tags.map(tag => ({ id: tag.id, name: tag.name })) : [],
        })) : [],
      };
    } catch (error) {
      console.error(`Error removing artifact ${artifactId} from collection ${collectionId}:`, error);
      throw error;
    }
  }

  // Method to add multiple artifacts to a collection
  static async addMultipleArtifactsToCollection(collectionId, userId, artifactIds) {
    if (!Array.isArray(artifactIds) || artifactIds.length === 0) {
      throw new Error('An array of artifactIds is required.');
    }

    try {
      const collection = await SequelizeArtifactCollection.findOne({
        where: { id: collectionId, userId },
      });

      if (!collection) {
        throw new Error('Collection not found or not owned by user.');
      }

      // Find artifacts, ensuring they belong to the same user and are not already in the collection
      const existingArtifactAssociations = await collection.getArtifacts({
        where: { id: artifactIds },
        attributes: ['id']
      });
      const existingArtifactIdSet = new Set(existingArtifactAssociations.map(art => art.id));

      const newArtifactsToAdd = await Artifact.findAll({
        where: {
          id: artifactIds.filter(id => !existingArtifactIdSet.has(id)), // Filter out already associated artifacts
          userId: userId, // Ensure artifacts belong to the same user
        },
      });

      if (newArtifactsToAdd.length === 0 && artifactIds.length > 0) {
        // If no new artifacts were found but IDs were provided, it means all were already associated
        // Or provided IDs did not belong to the user
        const requestedArtifactsNotFoundOrNotOwned = artifactIds.filter(id =>
          !existingArtifactIdSet.has(id) && !newArtifactsToAdd.some(art => art.id === id)
        );
        if (requestedArtifactsNotFoundOrNotOwned.length > 0) {
            throw new Error('One or more artifacts not found or do not belong to the user.');
        }
      }

      if (newArtifactsToAdd.length > 0) {
        await collection.addArtifacts(newArtifactsToAdd);
      }
      
      // Re-fetch the collection with updated artifacts for the response
      const updatedCollection = await SequelizeArtifactCollection.findOne({
        where: { id: collectionId },
        include: [{
          model: Artifact,
          as: 'artifacts',
          attributes: ['id', 'name', 'type', 'fileMimeType', 'fileOriginalName', 'createdAt'],
          through: { attributes: [] },
          include: [{
            model: Tag,
            as: 'tags',
            attributes: ['id', 'name'],
            through: { attributes: [] }
          }]
        }],
      });

      const plainCollection = updatedCollection.get({ plain: true });
      return {
        ...plainCollection,
        artifacts: plainCollection.artifacts ? plainCollection.artifacts.map(art => ({
          id: art.id,
          name: art.name,
          type: art.type,
          fileMimeType: art.fileMimeType,
          fileOriginalName: art.fileOriginalName,
          createdAt: art.createdAt,
          tags: art.tags ? art.tags.map(tag => ({ id: tag.id, name: tag.name })) : [],
        })) : [],
      };
    } catch (error) {
      console.error(`Error adding multiple artifacts to collection ${collectionId}:`, error);
      throw error;
    }
  }
}

module.exports = ArtifactCollection;