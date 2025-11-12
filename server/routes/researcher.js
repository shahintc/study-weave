const express = require('express');
const { Op } = require('sequelize');
const {
  Study,
  User,
  StudyParticipant,
  StudyArtifact,
  Artifact,
  Evaluation,
} = require('../models');

const router = express.Router();

router.get('/studies', async (req, res) => {
  try {
    const { researcherId } = req.query;
    const where = {};
    if (researcherId) {
      where.researcherId = researcherId;
    }

    const studies = await Study.findAll({
      where,
      include: [
        { model: User, as: 'researcher', attributes: ['id', 'name', 'email'] },
        {
          model: StudyParticipant,
          as: 'participants',
          include: [{ model: User, as: 'participant', attributes: ['id', 'name'] }],
        },
        {
          model: StudyArtifact,
          as: 'studyArtifacts',
          include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const studyIds = studies.map((study) => study.id);
    const ratingMap = await loadStudyRatings(studyIds);

    const payload = studies.map((study) => formatStudyCard(study, ratingMap));
    res.json({ studies: payload });
  } catch (error) {
    console.error('Researcher studies error', error);
    res.status(500).json({ message: 'Unable to load studies right now' });
  }
});

async function loadStudyRatings(studyIds = []) {
  const ratingMap = new Map();
  if (!studyIds.length) {
    return ratingMap;
  }

  const rows = await Evaluation.findAll({
    attributes: ['studyId', 'rating'],
    where: {
      studyId: { [Op.in]: studyIds },
      rating: { [Op.not]: null },
    },
  });

  rows.forEach((row) => {
    const info = ratingMap.get(row.studyId) || { total: 0, count: 0 };
    info.total += Number(row.rating);
    info.count += 1;
    ratingMap.set(row.studyId, info);
  });

  return ratingMap;
}

function formatStudyCard(studyInstance, ratingMap) {
  const study = studyInstance.get({ plain: true });
  const metadata = normalizeJson(study.metadata);
  const participantCount = study.participants?.length || 0;
  const avgProgress = participantCount
    ? Math.round(
        study.participants.reduce((sum, entry) => sum + (entry.progressPercent || 0), 0) / participantCount,
      )
    : 0;

  const ratingInfo = ratingMap.get(study.id);
  const avgRating = ratingInfo ? Number((ratingInfo.total / ratingInfo.count).toFixed(1)) : 0;

  const participantTarget = metadata.participantTarget || participantCount || 0;
  const participantsList = (study.participants || []).map((participant) => ({
    id: String(participant.participantId),
    name: participant.participant?.name || `Participant ${participant.participantId}`,
  }));

  return {
    id: String(study.id),
    title: study.title,
    description: study.description,
    status: metadata.statusLabel || mapStatusToLabel(study.status),
    health: metadata.health || inferHealth(study.status),
    progress: avgProgress,
    progressDelta: metadata.progressDelta ?? 0,
    participants: participantCount,
    participantTarget,
    avgRating,
    window: formatWindow(study.timelineStart, study.timelineEnd),
    nextMilestone: metadata.nextMilestone || 'Next milestone TBA',
    participantsList,
  };
}

function mapStatusToLabel(status) {
  switch (status) {
    case 'draft':
      return 'Planning';
    case 'active':
      return 'In field';
    case 'completed':
      return 'Completed';
    case 'archived':
      return 'Archived';
    default:
      return 'In progress';
  }
}

function inferHealth(status) {
  if (status === 'active' || status === 'completed') {
    return 'on-track';
  }
  if (status === 'draft') {
    return 'planning';
  }
  return 'attention';
}

function formatWindow(start, end) {
  if (!start && !end) {
    return 'Timeline TBA';
  }
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  if (start && end) {
    return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
  }
  if (start) {
    return `Starts ${fmt.format(new Date(start))}`;
  }
  return `Ends ${fmt.format(new Date(end))}`;
}

function normalizeJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

module.exports = router;
