const express = require('express');
const router = express.Router();
const { generateContentRouteHandler } = require('../services/llm/llmService');

// POST request to /api/llm/
router.post('/', generateContentRouteHandler);

module.exports = router;
