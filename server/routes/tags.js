const express = require('express');
const router = express.Router();
const Tag = require('../models/Tag'); // Our higher-level Tag model

// GET /api/tags - List all available tags
router.get('/', async (req, res) => {
  try {
    const tags = await Tag.listAll();
    res.status(200).json({ tags });
  } catch (error) {
    console.error('Error listing tags:', error);
    res.status(500).json({ message: error.message || 'Failed to retrieve tags.' });
  }
});

// POST /api/tags - Create a new tag
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ message: 'Tag name is required and must be a non-empty string.' });
    }

    const result = await Tag.create(name); // result includes { id, name, createdAt, isNew }

    if (result.isNew) {
      res.status(201).json({ message: 'Tag created successfully', tag: result });
    } else {
      res.status(200).json({ message: 'Tag already exists', tag: result });
    }
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ message: error.message || 'Failed to create tag.' });
  }
});

module.exports = router;