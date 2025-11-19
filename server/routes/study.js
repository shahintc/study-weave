const express = require('express');
const router = express.Router();
const { sequelize, Study, CompetencyAssignment, StudyArtifact } = require('../models');

// const authMiddleware = require('../middleware/auth'); // We will add security to this later

// ---
// CREATE A NEW STUDY (POST /)
// This will be the endpoint for your "Next" button
// ---

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

// We will add 'authMiddleware' here later to protect it
router.post('/', async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      title,
      description,
      criteria,
      researcherId,
      isBlinded = false,
      timelineStart,
      timelineEnd,
      metadata = {},
      selectedParticipants = [],
      autoInvite = false,
    } = req.body;

    if (!researcherId) {
      await transaction.rollback();
      return res.status(400).json({ message: 'A researcherId is required to create a study.' });
    }

    if (!title || !description) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const preparedMetadata = {
      ...metadata,
    };

    if (typeof preparedMetadata.isBlinded === 'undefined') {
      preparedMetadata.isBlinded = Boolean(isBlinded);
    }

    const newStudy = await Study.create({
      title,
      description,
      criteria: Array.isArray(criteria) ? criteria : [],
      status: 'draft',
      researcherId,
      timelineStart: normalizeDate(timelineStart),
      timelineEnd: normalizeDate(timelineEnd),
      metadata: preparedMetadata,
    }, { transaction });

    const participantSelection = Array.isArray(selectedParticipants) && selectedParticipants.length
      ? selectedParticipants
      : Array.isArray(preparedMetadata.selectedParticipants)
        ? preparedMetadata.selectedParticipants
        : [];

    const artifactSelection = Array.isArray(req.body.selectedArtifacts) && req.body.selectedArtifacts.length
      ? req.body.selectedArtifacts
      : Array.isArray(preparedMetadata.selectedArtifacts)
        ? preparedMetadata.selectedArtifacts
        : [];

    const autoInviteFlag = typeof autoInvite === 'boolean'
      ? autoInvite
      : Boolean(preparedMetadata.autoInvite);

    const shouldCreateAssignments = Boolean(
      preparedMetadata.requireAssessment && preparedMetadata.selectedAssessment,
    );

    const sanitizedParticipants = participantSelection
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const sanitizedArtifacts = artifactSelection
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    let assignments = [];
    if (shouldCreateAssignments) {
      const assessmentId = Number(preparedMetadata.selectedAssessment);
      if (!Number.isNaN(assessmentId)) {
        assignments = await Promise.all(
          sanitizedParticipants.map((participantId) =>
            CompetencyAssignment.create(
              {
                assessmentId,
                participantId,
                researcherId,
                status: autoInviteFlag ? 'in_progress' : 'pending',
                decision: 'undecided',
                startedAt: null,
                submittedAt: null,
                reviewedAt: null,
                reviewerNotes: null,
              },
              { transaction },
            ),
          ),
        );
      }
    }

    let studyArtifacts = [];
    if (sanitizedArtifacts.length) {
      studyArtifacts = await Promise.all(
        sanitizedArtifacts.map((artifactId, idx) =>
          StudyArtifact.create(
            {
              studyId: newStudy.id,
              artifactId,
              orderIndex: idx,
            },
            { transaction },
          ),
        ),
      );
    }

    await transaction.commit();

    res.status(201).json({
      study: newStudy.get({ plain: true }),
      competencyAssignments: assignments.map((entry) => entry.get({ plain: true })),
      studyArtifacts: studyArtifacts.map((entry) => entry.get({ plain: true })),
    });
  } catch (error) {
    console.error('Error creating study:', error);
    await transaction.rollback();
    res.status(500).json({ message: 'Server error while creating study' });
  }
});

// We must export the router, just like in your other files
module.exports = router;
