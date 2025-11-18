const express = require('express');
const router = express.Router();
const { generateContentRouteHandler } = require('../services/llm/llmService');

// POST request to /api/llm/generate-content
router.post('/generate-content', generateContentRouteHandler);

module.exports = router;
