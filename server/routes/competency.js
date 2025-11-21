const express = require('express');
const router = express.Router();
const { CompetencyAssessment, CompetencyAssignment, User } = require('../models');

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const asNumber = Number(value);
  return Number.isNaN(asNumber) ? null : asNumber;
};

router.post('/assessments', async (req, res) => {
  const transaction = await CompetencyAssessment.sequelize.transaction();
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
    }, { transaction });

    const sanitizedParticipantIds = Array.isArray(invitedParticipants)
      ? invitedParticipants.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];

    if (sanitizedParticipantIds.length) {
      await Promise.all(
        sanitizedParticipantIds.map((participantId) =>
          CompetencyAssignment.create(
            {
              assessmentId: assessment.id,
              participantId,
              researcherId,
              status: status === 'published' ? 'in_progress' : 'pending',
              decision: 'undecided',
            },
            { transaction },
          ),
        ),
      );
    }

    await transaction.commit();

    res.status(201).json(assessment.get({ plain: true }));
  } catch (error) {
    await transaction.rollback();
    console.error('Create competency assessment error', error);
    res.status(500).json({ message: 'Unable to create competency assessment right now.' });
  }
});

router.get('/assignments', async (req, res) => {
  try {
    const { participantId } = req.query;
    if (!participantId) {
      return res.status(400).json({ message: 'participantId is required.' });
    }

    const records = await CompetencyAssignment.findAll({
      where: { participantId },
      include: [
        {
          model: CompetencyAssessment,
          as: 'assessment',
          include: [{ model: User, as: 'researcher', attributes: ['id', 'name', 'email'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const payload = records.map((record) => {
      const plain = record.get({ plain: true });
      const assessment = plain.assessment || {};
      const criteria = assessment.criteria || {};
      const metadata = assessment.metadata || {};
      const instructionList = Array.isArray(metadata.instructions)
        ? metadata.instructions
        : metadata.instructions
          ? [metadata.instructions]
          : [];
      const resources = Array.isArray(metadata.resources) ? metadata.resources : [];
      const researcher = assessment.researcher || {};
      const status = plain.status || 'pending';

      const statusChip =
        status === 'submitted'
          ? 'Submitted'
          : status === 'in_progress'
            ? 'In progress'
            : 'Awaiting submission';

      return {
        id: String(plain.id),
        assessmentId: String(assessment.id),
        title: assessment.title,
        studyTitle: metadata.studyTitle || 'Study invite',
        dueAt: metadata.dueAt || 'Due date TBA',
        reviewer: researcher.name || 'Research team',
        researcherEmail: researcher.email || '',
        totalScore: assessment.totalScore,
        estimatedTime:
          criteria.durationMinutes && Number(criteria.durationMinutes)
            ? `${criteria.durationMinutes} minutes`
            : metadata.estimatedTime || 'Time varies',
        statusLabel: statusChip,
        statusChip,
        notes: metadata.notes || assessment.description || '',
        instructions: instructionList,
        resources,
        assignedAt: plain.createdAt,
        questions: assessment.questions || [],
      };
    });

    return res.json({ assignments: payload });
  } catch (error) {
    console.error('Fetch competency assignments error', error);
    return res.status(500).json({ message: 'Unable to load competency assignments right now.' });
  }
});

router.get('/assignments/submitted', async (req, res) => {
  try {
    const { researcherId } = req.query;
    if (!researcherId) {
      return res.status(400).json({ message: 'researcherId is required.' });
    }

    const records = await CompetencyAssignment.findAll({
      where: { researcherId, status: 'submitted' },
      include: [
        {
          model: CompetencyAssessment,
          as: 'assessment',
        },
        {
          model: User,
          as: 'participant',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['submittedAt', 'DESC']],
    });

    // Filter to ensure only fully submitted evaluations with actual responses are returned
    const fullySubmitted = records.filter((record) => {
      const plain = record.get({ plain: true });
      return plain.responses && Object.keys(plain.responses).length > 0;
    });

    const payload = fullySubmitted.map((record) => {
      const plain = record.get({ plain: true });
      const assessment = plain.assessment || {};
      const participant = plain.participant || {};

      return {
        id: String(plain.id),
        assessmentId: String(assessment.id),
        title: assessment.title,
        participantName: participant.name,
        participantEmail: participant.email,
        status: plain.status,
        decision: plain.decision,
        submittedAt: plain.submittedAt,
        responses: plain.responses,
        questions: assessment.questions || [],
      };
    });

    return res.json({ assignments: payload });
  } catch (error) {
    console.error('Fetch submitted assignments error', error);
    return res.status(500).json({ message: 'Unable to load submitted assignments right now.' });
  }
});

router.get('/assignments/researcher', async (req, res) => {
  try {
    const { researcherId } = req.query;
    if (!researcherId) {
      return res.status(400).json({ message: 'researcherId is required.' });
    }

    const records = await CompetencyAssignment.findAll({
      where: { researcherId },
      include: [
        {
          model: CompetencyAssessment,
          as: 'assessment',
        },
        {
          model: User,
          as: 'participant',
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const payload = records.map((record) => {
      const plain = record.get({ plain: true });
      const assessment = plain.assessment || {};
      const participant = plain.participant || {};

      return {
        id: String(plain.id),
        assessmentId: String(assessment.id),
        title: assessment.title,
        participantName: participant.name,
        participantEmail: participant.email,
        status: plain.status,
        decision: plain.decision,
        submittedAt: plain.submittedAt,
        startedAt: plain.startedAt,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
      };
    });

    return res.json({ assignments: payload });
  } catch (error) {
    console.error('Fetch researcher assignments error', error);
    return res.status(500).json({ message: 'Unable to load researcher assignments right now.' });
  }
});

router.post('/assignments/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const { responses } = req.body;

    const assignment = await CompetencyAssignment.findByPk(id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    if (assignment.status === 'submitted') {
      return res.status(400).json({ message: 'This assessment has already been submitted.' });
    }

    assignment.status = 'submitted';
    assignment.submittedAt = new Date();
    assignment.responses = responses;

    await assignment.save();

    res.status(200).json({ message: 'Assessment submitted successfully.' });
  } catch (error) {
    console.error('Submit competency assessment error', error);
    res.status(500).json({ message: 'Unable to submit competency assessment right now.' });
  }
});

router.patch('/assignments/:id/decision', async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, reviewerNotes = '' } = req.body;

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'decision must be either "approved" or "rejected".' });
    }

    const assignment = await CompetencyAssignment.findByPk(id);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found.' });
    }

    if (assignment.status !== 'submitted' && assignment.status !== 'reviewed') {
      return res
        .status(400)
        .json({ message: 'Only submitted assignments can be reviewed right now.' });
    }

    assignment.decision = decision;
    assignment.reviewerNotes = reviewerNotes;
    assignment.reviewedAt = new Date();
    assignment.status = 'reviewed';

    await assignment.save();

    return res.json({ message: 'Decision recorded successfully.', assignment: assignment.get({ plain: true }) });
  } catch (error) {
    console.error('Record competency decision error', error);
    return res.status(500).json({ message: 'Unable to record decision right now.' });
  }
});

module.exports = router;
