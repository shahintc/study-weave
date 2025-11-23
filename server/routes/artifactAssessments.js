const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  createArtifactAssessment,
  getArtifactAssessments,
  getArtifactAssessmentById,
} = require('../controllers/artifactAssessmentsController');

router.post('/', authMiddleware, createArtifactAssessment);
router.get('/', authMiddleware, getArtifactAssessments);
router.get('/:id', authMiddleware, getArtifactAssessmentById);

module.exports = router;
