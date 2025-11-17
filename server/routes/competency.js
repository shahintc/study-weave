const express = require('express');
const router = express.Router();
const { CompetencyAssessment } = require('../models');

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const asNumber = Number(value);
  return Number.isNaN(asNumber) ? null : asNumber;
};

router.post('/assessments', async (req, res) => {
  try {
    const {
      title,
      description,
      researcherId,
      status = 'draft',
      instructions = '',
      durationMinutes,
      passingThreshold,
      questions = [],
      invitedParticipants = [],
    } = req.body;

    if (!researcherId) {
      return res.status(400).json({ message: 'researcherId is required.' });
    }
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }
    if (!Array.isArray(questions) || !questions.length) {
      return res.status(400).json({ message: 'At least one question is required.' });
    }

    const sanitizedQuestions = questions.map((question, index) => ({
      id: question.id || `question-${index + 1}`,
      title: question.title,
      type: question.type,
      options: question.type === 'multiple_choice' ? question.options || [] : [],
    }));

    const metadata = {
      instructions,
      invitedParticipants: Array.isArray(invitedParticipants) ? invitedParticipants : [],
    };

    const assessment = await CompetencyAssessment.create({
      researcherId,
      title,
      description,
      criteria: {
        durationMinutes: normalizeNumber(durationMinutes),
        passingThreshold: normalizeNumber(passingThreshold),
      },
      questions: sanitizedQuestions,
      totalScore: 100,
      status,
      metadata,
    });

    res.status(201).json(assessment.get({ plain: true }));
  } catch (error) {
    console.error('Create competency assessment error', error);
    res.status(500).json({ message: 'Unable to create competency assessment right now.' });
  }
});

module.exports = router;
