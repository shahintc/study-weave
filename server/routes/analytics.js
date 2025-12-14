const express = require('express');
const {
  Study,
  StudyParticipant,
  Evaluation,
  StudyComparison,
  StudyArtifact,
  Artifact,
  User,
} = require('../models');

const router = express.Router();

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;
const REFRESH_SECONDS = 30;

router.get('/study/:studyId', async (req, res) => {
  try {
    const { studyId } = req.params;
    const { from, to, participantId } = req.query;

    const study = await buildStudySnapshot(studyId);
    if (!study) {
      return res.status(404).json({ message: `Study ${studyId} was not found` });
    }

    const toRaw = parseDateOrDefault(to, new Date());
    const fromRaw = parseDateOrDefault(from, new Date(toRaw.getTime() - DEFAULT_WINDOW_DAYS * DAY_IN_MS));
    // Normalize range to whole days so events on the "to" day are included
    const fromDate = startOfDay(fromRaw);
    const toDate = endOfDay(toRaw);

    if (!toDate || !fromDate) {
      return res.status(400).json({ message: 'Invalid date filter provided' });
    }

    if (fromDate > toDate) {
      return res.status(400).json({ message: 'The start date must be before the end date' });
    }

    const normalizedParticipantId = participantId && participantId !== 'all' ? String(participantId) : null;

    const filteredParticipants = study.participants.filter((participant) => {
      if (normalizedParticipantId && participant.id !== normalizedParticipantId) {
        return false;
      }
      const joinedAt = new Date(participant.joinedAt);
      return joinedAt <= toDate;
    });

    const totalParticipants = filteredParticipants.length;

    if (!totalParticipants) {
      return res.json({
        study: extractMetadata(study),
        filters: serializeFilters(fromDate, toDate, normalizedParticipantId),
        summary: buildEmptySummary(),
        charts: buildEmptyCharts(),
        participants: [],
        participantFilters: study.participants.map(formatParticipantFilter),
        exportable: true,
      });
    }

    const ratingEvents = collectRatingEvents(filteredParticipants, fromDate, toDate);
    const completionEvents = collectCompletionEvents(filteredParticipants, fromDate, toDate);

    const submissionsCount = ratingEvents.length;
    const averageRating = calculateAverage(ratingEvents.map((event) => event.rating), { allowNull: false });
    const completedParticipants = filteredParticipants.filter((participant) => Boolean(participant.completedAt)).length;
    const completionPercentage = totalParticipants ? Math.round((completedParticipants / totalParticipants) * 100) : 0;

    const artifactAverages = calculateArtifactAverages(ratingEvents, study.artifacts);
    const timeline = buildTimeline(ratingEvents, completionEvents, fromDate, toDate, totalParticipants);

    const responsePayload = {
      study: extractMetadata(study),
      filters: serializeFilters(fromDate, toDate, normalizedParticipantId || 'all'),
      summary: {
        averageRating,
        completionPercentage,
        submissionsCount,
        activeParticipants: totalParticipants,
        completedParticipants,
        refreshIntervalSeconds: REFRESH_SECONDS,
        lastUpdated: new Date().toISOString(),
      },
      charts: {
        ratingsTrend: timeline.map((point) => ({ date: point.date, value: point.averageRating })),
        completionTrend: timeline.map((point) => ({ date: point.date, value: point.completionPercent })),
        artifactAverages,
      },
      participants: buildParticipantSummaries(filteredParticipants, ratingEvents),
      participantFilters: study.participants.map(formatParticipantFilter),
      exportable: true,
    };

    return res.json(responsePayload);
  } catch (error) {
    console.error('Study analytics error', error);
    return res.status(500).json({ message: 'Unable to build study analytics right now' });
  }
});

function parseDateOrDefault(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function serializeFilters(fromDate, toDate, participantId) {
  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    participantId: participantId || 'all',
  };
}

function formatParticipantFilter(participant) {
  return {
    id: participant.id,
    name: participant.name,
    region: participant.region,
  };
}

function buildEmptySummary() {
  return {
    averageRating: 0,
    completionPercentage: 0,
    submissionsCount: 0,
    activeParticipants: 0,
    completedParticipants: 0,
    refreshIntervalSeconds: REFRESH_SECONDS,
    lastUpdated: new Date().toISOString(),
  };
}

function buildEmptyCharts() {
  return {
    ratingsTrend: [],
    completionTrend: [],
    artifactAverages: [],
  };
}

function collectRatingEvents(participants, fromDate, toDate) {
  return participants.flatMap((participant) =>
    participant.ratings
      .filter((rating) => isWithinRange(rating.submittedAt, fromDate, toDate))
      .map((rating) => ({
        ...rating,
        participantId: participant.id,
        day: rating.submittedAt.slice(0, 10),
      })),
  );
}

function collectCompletionEvents(participants, fromDate, toDate) {
  return participants
    .filter((participant) => participant.completedAt && isWithinRange(participant.completedAt, fromDate, toDate))
    .map((participant) => ({
      participantId: participant.id,
      day: participant.completedAt.slice(0, 10),
    }));
}

function isWithinRange(value, fromDate, toDate) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  return date >= fromDate && date <= toDate;
}

function calculateAverage(values, options = {}) {
  const { allowNull = false } = options;
  if (!values.length) {
    return allowNull ? null : 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function calculateArtifactAverages(events, artifactsMeta = []) {
  const artifactTotals = new Map();

  events.forEach((event) => {
    if (!artifactTotals.has(event.artifactId)) {
      const artifactMeta = artifactsMeta.find((artifact) => artifact.id === event.artifactId);
      artifactTotals.set(event.artifactId, {
        artifactId: event.artifactId,
        name: artifactMeta?.name || event.artifactName || event.artifactId,
        total: 0,
        count: 0,
      });
    }
    const aggregate = artifactTotals.get(event.artifactId);
    aggregate.total += event.rating;
    aggregate.count += 1;
  });

  return Array.from(artifactTotals.values()).map((aggregate) => ({
    artifactId: aggregate.artifactId,
    name: aggregate.name,
    value: Number((aggregate.total / aggregate.count).toFixed(2)),
    submissions: aggregate.count,
  }));
}

function buildTimeline(ratingEvents, completionEvents, fromDate, toDate, totalParticipants) {
  const timeline = [];
  const start = startOfDay(fromDate).getTime();
  const end = startOfDay(toDate).getTime();

  for (let cursor = start; cursor <= end; cursor += DAY_IN_MS) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    const dayRatings = ratingEvents.filter((event) => event.day === day);
    const dayCompletions = completionEvents.filter((event) => event.day === day).length;

    timeline.push({
      date: day,
      ratingTotal: dayRatings.reduce((sum, event) => sum + event.rating, 0),
      ratingCount: dayRatings.length,
      completions: dayCompletions,
    });
  }

  let cumulativeCompletions = 0;
  return timeline.map((point) => {
    cumulativeCompletions += point.completions;
    return {
      date: point.date,
      averageRating: point.ratingCount ? Number((point.ratingTotal / point.ratingCount).toFixed(2)) : 0,
      completionPercent: totalParticipants
        ? Math.min(100, Math.round((cumulativeCompletions / totalParticipants) * 100))
        : 0,
    };
  });
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function buildParticipantSummaries(participants, ratingEvents) {
  return participants
    .map((participant) => {
      const participantRatings = ratingEvents.filter((event) => event.participantId === participant.id);
      const averageRating = calculateAverage(
        participantRatings.map((event) => event.rating),
        { allowNull: true },
      );
      const lastSubmissionAt = participantRatings.reduce((latest, event) => {
        return !latest || event.submittedAt > latest ? event.submittedAt : latest;
      }, participant.joinedAt);

      return {
        id: participant.id,
        name: participant.name,
        region: participant.region,
        persona: participant.persona,
        progress: participant.progress,
        completionStatus: participant.completedAt ? 'completed' : 'in-progress',
        averageRating,
        lastSubmissionAt,
      };
    })
    .sort((left, right) => right.progress - left.progress);
}

function extractMetadata(study) {
  return {
    id: study.id,
    title: study.title,
    studyCode: study.studyCode,
    principalInvestigator: study.principalInvestigator,
    startDate: study.startDate,
    endDate: study.endDate,
  };
}

async function buildStudySnapshot(studyId) {
  const studyInstance = await Study.findByPk(studyId, {
    include: [
      { model: User, as: 'researcher', attributes: ['id', 'name', 'email'] },
      {
        model: StudyArtifact,
        as: 'studyArtifacts',
        include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name'] }],
      },
      {
        model: StudyComparison,
        as: 'comparisons',
        include: [
          {
            model: StudyArtifact,
            as: 'primaryArtifact',
            include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name'] }],
          },
          {
            model: StudyArtifact,
            as: 'secondaryArtifact',
            include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name'] }],
          },
        ],
      },
    ],
  });

  if (!studyInstance) {
    return null;
  }

  const participantRows = await StudyParticipant.findAll({
    where: { studyId: studyInstance.id },
    include: [{ model: User, as: 'participant', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'ASC']],
  });

  const evaluationRows = await Evaluation.findAll({
    where: { studyId: studyInstance.id },
    include: [
      {
        model: StudyComparison,
        as: 'comparison',
        include: [
          {
            model: StudyArtifact,
            as: 'primaryArtifact',
            include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name'] }],
          },
          {
            model: StudyArtifact,
            as: 'secondaryArtifact',
            include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name'] }],
          },
        ],
      },
    ],
    order: [['createdAt', 'ASC']],
  });

  const study = studyInstance.get({ plain: true });
  const metadata = normalizeJson(study.metadata);

  const artifacts = (study.studyArtifacts || []).map((entry) => ({
    id: String(entry.artifact?.id || entry.id),
    name: formatArtifactName(entry),
  }));

  const participants = participantRows.map((row) => {
    const plain = row.get({ plain: true });
    const profile = normalizeJson(plain.lastCheckpoint);
    return {
      id: String(plain.participantId),
      name: plain.participant?.name || `Participant ${plain.participantId}`,
      region: profile.region || 'Unknown',
      persona: profile.persona || 'Participant',
      progress: plain.progressPercent || 0,
      joinedAt: toIsoString(plain.startedAt || plain.createdAt) || new Date().toISOString(),
      completedAt: toIsoString(plain.completedAt),
      ratings: [],
      participationStatus: plain.participationStatus,
    };
  });

  const participantsById = new Map(participants.map((participant) => [Number(participant.id), participant]));

  evaluationRows.forEach((row) => {
    const evaluation = row.get({ plain: true });
    const participant = participantsById.get(evaluation.participantId);
    if (!participant) {
      return;
    }
    const timestamp = resolveEventDate(evaluation);

    if (evaluation.status === 'submitted' && !participant.completedAt && timestamp) {
      participant.completedAt = timestamp.toISOString();
      participant.progress = Math.max(participant.progress || 0, 100);
    }

    if (evaluation.status !== 'submitted' || evaluation.rating === null || !timestamp) {
      return;
    }
    const artifact = pickArtifactFromEvaluation(evaluation);
    participant.ratings.push({
      artifactId: artifact.id,
      artifactName: artifact.name,
      rating: Number(evaluation.rating),
      submittedAt: timestamp.toISOString(),
    });
  });

  return {
    id: String(study.id),
    title: study.title,
    studyCode: metadata.studyCode || `STD-${String(study.id).padStart(3, '0')}`,
    principalInvestigator: study.researcher?.name || 'Researcher',
    startDate: study.timelineStart,
    endDate: study.timelineEnd,
    artifacts,
    participants,
  };
}

function formatArtifactName(studyArtifact) {
  const artifactName = studyArtifact.artifact?.name;
  if (studyArtifact.label && artifactName) {
    return `${studyArtifact.label}: ${artifactName}`;
  }
  return artifactName || studyArtifact.label || `Artifact ${studyArtifact.id}`;
}

function normalizeJson(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function toIsoString(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function resolveEventDate(evaluation) {
  const candidates = [evaluation.submittedAt, evaluation.updatedAt, evaluation.createdAt];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = candidate instanceof Date ? candidate : new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

function pickArtifactFromEvaluation(evaluation) {
  const comparison = evaluation.comparison;
  const fallback = {
    id: `comparison-${evaluation.comparisonId}`,
    name: comparison?.prompt || `Comparison ${evaluation.comparisonId}`,
  };

  if (!comparison) {
    return fallback;
  }

  if (evaluation.preference === 'primary') {
    const artifact = unwrapStudyArtifact(comparison.primaryArtifact);
    if (artifact) {
      return artifact;
    }
  }

  if (evaluation.preference === 'secondary') {
    const artifact = unwrapStudyArtifact(comparison.secondaryArtifact);
    if (artifact) {
      return artifact;
    }
  }

  const primary = unwrapStudyArtifact(comparison.primaryArtifact);
  const secondary = unwrapStudyArtifact(comparison.secondaryArtifact);

  if (primary && secondary) {
    return { id: fallback.id, name: `${primary.name} vs ${secondary.name}` };
  }

  return primary || secondary || fallback;
}

function unwrapStudyArtifact(studyArtifact) {
  if (!studyArtifact) {
    return null;
  }
  return {
    id: String(studyArtifact.artifact?.id || studyArtifact.id),
    name: formatArtifactName(studyArtifact),
  };
}

module.exports = router;
