const express = require('express');
const router = express.Router();
const ArtifactCollection = require('../models/ArtifactCollection');

// POST /api/artifact-collections - Create a new artifact collection
router.post('/', async (req, res) => {
  try {
    const { name, description, userId, artifactIds } = req.body;

    if (!name || !userId) {
      return res.status(400).json({ message: 'Collection name and userId are required.' });
    }
    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'Collection name must be a non-empty string.' });
    }
    if (typeof userId !== 'number' || isNaN(userId)) {
      return res.status(400).json({ message: 'A valid userId is required.' });
    }
    if (artifactIds && (!Array.isArray(artifactIds) || !artifactIds.every(id => typeof id === 'number'))) {
      return res.status(400).json({ message: 'artifactIds must be an array of numbers.' });
    }

    const newCollection = await ArtifactCollection.create({ name, description, userId, artifactIds });
    res.status(201).json({ message: 'Artifact collection created successfully', collection: newCollection });
  } catch (error) {
    console.error('Error creating artifact collection:', error);
    if (error.message.includes('Collection with name')) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: error.message || 'Failed to create artifact collection.' });
  }
});

// GET /api/artifact-collections/user/:userId - Get all collections for a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ message: 'A valid userId is required.' });
    }

    const collections = await ArtifactCollection.findByUserId(parseInt(userId));

    if (collections.length === 0) {
      return res.status(404).json({ message: 'No artifact collections found for this user.' });
    }

    res.status(200).json({ collections });
  } catch (error) {
    console.error('Error fetching artifact collections by user ID:', error);
    res.status(500).json({ message: error.message || 'Failed to retrieve artifact collections.' });
  }
});

// GET /api/artifact-collections/:id - Get a specific artifact collection by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query; // Assuming userId might be passed as a query param for authorization

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'A valid collection ID is required.' });
    }
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ message: 'A valid userId is required for authorization.' });
    }

    const collection = await ArtifactCollection.findById(parseInt(id), parseInt(userId));

    if (!collection) {
      return res.status(404).json({ message: 'Artifact collection not found or not owned by user.' });
    }

    res.status(200).json({ collection });
  } catch (error) {
    console.error('Error fetching artifact collection by ID:', error);
    res.status(500).json({ message: error.message || 'Failed to retrieve artifact collection.' });
  }
});

// PUT /api/artifact-collections/:id - Update an artifact collection
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, userId, artifactIds } = req.body; // userId is needed for authorization

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'A valid collection ID is required.' });
    }
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ message: 'A valid userId is required for authorization.' });
    }
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({ message: 'Collection name must be a non-empty string if provided.' });
    }
    if (artifactIds !== undefined && (!Array.isArray(artifactIds) || !artifactIds.every(aid => typeof aid === 'number'))) {
      return res.status(400).json({ message: 'artifactIds must be an array of numbers if provided.' });
    }

    const updateData = { name, description, artifactIds };
    // Filter out undefined values from updateData
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updatedCollection = await ArtifactCollection.update(parseInt(id), parseInt(userId), updateData);

    if (!updatedCollection) {
      return res.status(404).json({ message: 'Artifact collection not found or not owned by user.' });
    }

    res.status(200).json({ message: 'Artifact collection updated successfully', collection: updatedCollection });
  } catch (error) {
    console.error('Error updating artifact collection:', error);
    if (error.message.includes('Collection with name')) {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: error.message || 'Failed to update artifact collection.' });
  }
});

// DELETE /api/artifact-collections/:id - Delete an artifact collection
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body; // Assuming userId is sent in body for authorization

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: 'A valid collection ID is required.' });
    }
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ message: 'A valid userId is required for authorization.' });
    }

    const deletedCollection = await ArtifactCollection.delete(parseInt(id), parseInt(userId));

    if (!deletedCollection) {
      return res.status(404).json({ message: 'Artifact collection not found or not owned by user.' });
    }

    res.status(200).json({ message: 'Artifact collection deleted successfully', id: deletedCollection.id });
  } catch (error) {
    console.error('Error deleting artifact collection:', error);
    res.status(500).json({ message: error.message || 'Failed to delete artifact collection.' });
  }
});

// POST /api/artifact-collections/:collectionId/artifacts - Add multiple artifacts to a collection
router.post('/:collectionId/artifacts', async (req, res) => {
  try {
    const { collectionId } = req.params;
    const { userId, artifactIds } = req.body;

    if (!collectionId || isNaN(parseInt(collectionId))) {
      return res.status(400).json({ message: 'A valid collectionId is required.' });
    }
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ message: 'A valid userId is required for authorization.' });
    }
    if (!artifactIds || !Array.isArray(artifactIds) || artifactIds.length === 0 || !artifactIds.every(id => typeof id === 'number')) {
      return res.status(400).json({ message: 'artifactIds must be a non-empty array of numbers.' });
    }

    const updatedCollection = await ArtifactCollection.addMultipleArtifactsToCollection(
      parseInt(collectionId),
      parseInt(userId),
      artifactIds
    );
    res.status(200).json({ message: 'Artifacts added to collection successfully', collection: updatedCollection });
  } catch (error) {
    console.error('Error adding multiple artifacts to collection:', error);
    res.status(500).json({ message: error.message || 'Failed to add artifacts to collection.' });
  }
});

// POST /api/artifact-collections/:collectionId/artifacts/:artifactId - Add a single artifact to a collection
router.post('/:collectionId/artifacts/:artifactId', async (req, res) => {
  try {
    const { collectionId, artifactId } = req.params;
    const { userId } = req.body; // Assuming userId is sent in body for authorization

    if (!collectionId || isNaN(parseInt(collectionId)) || !artifactId || isNaN(parseInt(artifactId))) {
      return res.status(400).json({ message: 'Valid collectionId and artifactId are required.' });
    }
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ message: 'A valid userId is required for authorization.' });
    }

    const updatedCollection = await ArtifactCollection.addArtifactToCollection(parseInt(collectionId), parseInt(userId), parseInt(artifactId));
    res.status(200).json({ message: 'Artifact added to collection successfully', collection: updatedCollection });
  } catch (error) {
    console.error('Error adding artifact to collection:', error);
    res.status(500).json({ message: error.message || 'Failed to add artifact to collection.' });
  }
});

// DELETE /api/artifact-collections/:collectionId/artifacts/:artifactId - Remove a single artifact from a collection
router.delete('/:collectionId/artifacts/:artifactId', async (req, res) => {
  try {
    const { collectionId, artifactId } = req.params;
    const { userId } = req.body; // Assuming userId is sent in body for authorization

    if (!collectionId || isNaN(parseInt(collectionId)) || !artifactId || isNaN(parseInt(artifactId))) {
      return res.status(400).json({ message: 'Valid collectionId and artifactId are required.' });
    }
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({ message: 'A valid userId is required for authorization.' });
    }

    const updatedCollection = await ArtifactCollection.removeArtifactFromCollection(parseInt(collectionId), parseInt(userId), parseInt(artifactId));
    res.status(200).json({ message: 'Artifact removed from collection successfully', collection: updatedCollection });
  } catch (error) {
    console.error('Error removing artifact from collection:', error);
    res.status(500).json({ message: error.message || 'Failed to remove artifact from collection.' });
  }
});

module.exports = router;