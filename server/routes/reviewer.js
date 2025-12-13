const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  Evaluation,
  Study,
  StudyParticipant,
  StudyComparison,
  StudyArtifact,
  Artifact,
  User,
} = require('../models');

const router = express.Router();

const REVIEW_STATUS_VALUES = new Set(['pending', 'in_review', 'resolved']);
const REVIEW_DECISION_VALUES = new Set(['participant_correct', 'llm_correct', 'inconclusive', 'needs_followup']);

router.get('/adjudications', authMiddleware, async (req, res) => {
  try {
    if (!canReview(req.user)) {
      return res.status(403).json({ message: 'Only researchers and admins can review adjudications.' });
    }

    const { studyId, status = 'pending', limit = 200 } = req.query;
    const where = {};
    if (studyId) {
      where.studyId = Number(studyId);
    }
    if (status && status !== 'all' && REVIEW_STATUS_VALUES.has(status)) {
      where.reviewStatus = status;
    }

    const rows = await Evaluation.findAll({
      where,
      include: buildIncludes(),
      order: [['createdAt', 'DESC']],
      limit: Number(limit) || 200,
    });

    const adjudications = rows
      .filter((row) => canReviewStudy(req.user, row.study))
      .map((row) => formatAdjudication(row));

    return res.json({ adjudications });
  } catch (error) {
    console.error('Reviewer adjudications fetch error', error);
    return res.status(500).json({ message: 'Unable to load adjudications right now.' });
  }
});

router.patch('/adjudications/:id', authMiddleware, async (req, res) => {
  try {
    if (!canReview(req.user)) {
      return res.status(403).json({ message: 'Only researchers and admins can record reviewer decisions.' });
    }

    const evaluationId = Number(req.params.id);
    if (Number.isNaN(evaluationId)) {
      return res.status(400).json({ message: 'Invalid evaluation id provided.' });
    }

    const evaluation = await Evaluation.findByPk(evaluationId, {
      include: [{ model: Study, as: 'study', attributes: ['id', 'researcherId', 'title'] }],
    });

    if (!evaluation) {
      return res.status(404).json({ message: 'Evaluation not found.' });
    }

    if (!canReviewStudy(req.user, evaluation.study)) {
      return res.status(403).json({ message: 'You are not allowed to adjudicate this evaluation.' });
    }

    const {
      reviewStatus,
      decision,
      notes,
      adjudicatedLabel,
      participantPayload,
      groundTruthPayload,
    } = req.body || {};

    const updates = {};
    let touched = false;

    if (reviewStatus) {
      if (!REVIEW_STATUS_VALUES.has(reviewStatus)) {
        return res.status(400).json({ message: 'Invalid reviewStatus provided.' });
      }
      updates.reviewStatus = reviewStatus;
      touched = true;
    }

    if (decision) {
      if (!REVIEW_DECISION_VALUES.has(decision)) {
        return res.status(400).json({ message: 'Invalid reviewer decision provided.' });
      }
      updates.reviewerDecision = decision;
      touched = true;
    }

    if (typeof notes === 'string') {
      updates.reviewerNotes = notes;
      touched = true;
    }

    if (typeof adjudicatedLabel === 'string' || adjudicatedLabel === null) {
      updates.adjudicatedLabel = adjudicatedLabel;
      touched = true;
    }

    if (typeof participantPayload !== 'undefined') {
      updates.participantPayload = sanitizeJsonInput(participantPayload);
      touched = true;
    }

    if (typeof groundTruthPayload !== 'undefined') {
      updates.groundTruthPayload = sanitizeJsonInput(groundTruthPayload);
      touched = true;
    }

    if (!touched) {
      return res.status(400).json({ message: 'No updates were provided.' });
    }

    if (updates.reviewStatus === 'resolved' || updates.reviewerDecision) {
      updates.reviewedAt = new Date();
    } else if (updates.reviewStatus && updates.reviewStatus !== 'resolved') {
      updates.reviewedAt = null;
    }

    await evaluation.update(updates);

    const refreshed = await Evaluation.findByPk(evaluationId, { include: buildIncludes() });
    return res.json({ adjudication: formatAdjudication(refreshed) });
  } catch (error) {
    console.error('Reviewer adjudication update error', error);
    return res.status(500).json({ message: 'Unable to update adjudication right now.' });
  }
});

function buildIncludes() {
  return [
    { model: Study, as: 'study', attributes: ['id', 'title', 'researcherId', 'metadata'] },
    {
      model: StudyParticipant,
      as: 'studyParticipant',
      include: [{ model: User, as: 'participant', attributes: ['id', 'name', 'email'] }],
    },
    { model: User, as: 'participantEvaluator', attributes: ['id', 'name', 'email'] },
    {
      model: StudyComparison,
      as: 'comparison',
      include: [
        {
          model: StudyArtifact,
          as: 'primaryArtifact',
          include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name', 'type'] }],
        },
        {
          model: StudyArtifact,
          as: 'secondaryArtifact',
          include: [{ model: Artifact, as: 'artifact', attributes: ['id', 'name', 'type'] }],
        },
      ],
    },
  ];
}

function canReview(user) {
  return Boolean(user && (user.role === 'researcher' || user.role === 'admin'));
}

function canReviewStudy(user, study) {
  if (!canReview(user)) {
    return false;
  }
  if (!study) {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  return Number(user.id) === Number(study.researcherId);
}

function formatAdjudication(evaluationInstance) {
  const evaluation = evaluationInstance.get({ plain: true });
  const comparisonMeta = formatComparison(evaluation.comparison);
  const studyMeta = evaluation.study ? formatStudy(evaluation.study) : null;
  const participant = formatParticipant(evaluation, { isBlinded: Boolean(studyMeta?.isBlinded) });
  const isBlinded = Boolean(studyMeta?.isBlinded);

  return {
    id: String(evaluation.id),
    study: studyMeta,
    participant,
    status: evaluation.status,
    review: {
      status: evaluation.reviewStatus,
      decision: evaluation.reviewerDecision,
      notes: evaluation.reviewerNotes,
      adjudicatedLabel: evaluation.adjudicatedLabel,
      reviewedAt: evaluation.reviewedAt,
    },
    participantAnswer: {
      preference: evaluation.preference,
      rating: evaluation.rating,
      summary: evaluation.summary,
      notes: evaluation.notes,
      metrics: normalizeJson(evaluation.metrics),
      payload: normalizeJson(evaluation.participantPayload),
    },
    groundTruth: resolveGroundTruth(evaluation, comparisonMeta),
    comparison: comparisonMeta,
    submittedAt: evaluation.submittedAt,
    updatedAt: evaluation.updatedAt,
  };
}

function formatStudy(study) {
  const metadata = normalizeJson(study.metadata) || {};
  return {
    id: String(study.id),
    title: study.title,
    isBlinded: Boolean(metadata.isBlinded),
  };
}

function formatParticipant(evaluation, { isBlinded = false } = {}) {
  const studyParticipant = evaluation.studyParticipant || {};
  const participantUser = studyParticipant.participant || evaluation.participantEvaluator;
  if (isBlinded) {
    return {
      id: null,
      name: buildBlindedParticipantLabel(evaluation, studyParticipant),
      email: null,
      studyParticipantId: studyParticipant.id ? String(studyParticipant.id) : null,
      blinded: true,
    };
  }

  if (!participantUser) {
    return null;
  }
  return {
    id: String(participantUser.id),
    name: participantUser.name,
    email: participantUser.email,
    studyParticipantId: studyParticipant.id ? String(studyParticipant.id) : null,
    blinded: false,
  };
}

function buildBlindedParticipantLabel(evaluation, studyParticipant) {
  const seeds = [];
  if (studyParticipant?.id) {
    seeds.push(String(studyParticipant.id));
  }
  if (evaluation?.id) {
    seeds.push(String(evaluation.id));
  }
  if (evaluation?.participantEvaluator?.id) {
    seeds.push(String(evaluation.participantEvaluator.id));
  }
  if (!seeds.length) {
    return 'Blinded participant';
  }
  const raw = seeds.join('-');
  let hash = 7;
  for (let idx = 0; idx < raw.length; idx += 1) {
    hash = (hash * 31 + raw.charCodeAt(idx)) % 10000;
  }
  const code = String(Math.abs(hash)).padStart(4, '0');
  return `Participant ${code}`;
}

function formatComparison(comparison) {
  if (!comparison) {
    return null;
  }
  const primary = formatStudyArtifact(comparison.primaryArtifact);
  const secondary = formatStudyArtifact(comparison.secondaryArtifact);
  return {
    id: String(comparison.id),
    prompt: comparison.prompt,
    primary,
    secondary,
    groundTruth: normalizeJson(comparison.groundTruth),
  };
}

function formatStudyArtifact(entry) {
  if (!entry) {
    return null;
  }
  const artifact = entry.artifact || {};
  return {
    id: String(entry.id),
    label: entry.label,
    artifactId: artifact.id ? String(artifact.id) : null,
    artifactName: artifact.name,
    artifactType: artifact.type,
  };
}

function resolveGroundTruth(evaluation, comparisonMeta) {
  const payload = normalizeJson(evaluation.groundTruthPayload);
  const fallback = comparisonMeta?.groundTruth || null;
  if (payload && fallback) {
    return { ...fallback, ...payload };
  }
  return payload || fallback || null;
}

function sanitizeJsonInput(value) {
  if (value === null) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return { raw: value };
    }
  }
  return null;
}

function normalizeJson(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

module.exports = router;
