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
  ReviewerNote,
} = require('../models');

const router = express.Router();

const REVIEW_STATUS_VALUES = new Set(['pending', 'in_review', 'resolved']);
const REVIEW_DECISION_VALUES = new Set(['participant_correct', 'llm_correct', 'inconclusive', 'needs_followup']);

router.get('/adjudications', authMiddleware, async (req, res) => {
  try {
    if (!canReview(req.user)) {
      return res.status(403).json({ message: 'Only reviewers, researchers, and admins can review adjudications.' });
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
      return res.status(403).json({ message: 'Only reviewers, researchers, and admins can record reviewer decisions.' });
    }

    const evaluationId = Number(req.params.id);
    if (Number.isNaN(evaluationId)) {
      return res.status(400).json({ message: 'Invalid evaluation id provided.' });
    }

    const evaluation = await Evaluation.findByPk(evaluationId, {
      include: [{ model: Study, as: 'study', attributes: ['id', 'researcherId', 'title', 'allowReviewers'] }],
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
      reviewerComment,
      reviewerRating,
    } = req.body || {};

    const isReviewerOnly = req.user.role === 'reviewer';
    if (
      isReviewerOnly &&
      (typeof reviewStatus !== 'undefined' ||
        typeof decision !== 'undefined' ||
        typeof adjudicatedLabel !== 'undefined' ||
        typeof participantPayload !== 'undefined' ||
        typeof groundTruthPayload !== 'undefined' ||
        typeof notes !== 'undefined')
    ) {
      return res.status(403).json({ message: 'Reviewers can only leave comments and ratings.' });
    }

    if (!isReviewerOnly && (typeof reviewerComment !== 'undefined' || typeof reviewerRating !== 'undefined')) {
      return res.status(403).json({ message: 'Only reviewers can leave reviewer comments or ratings.' });
    }

    const updates = {};
    let touched = false;

    if (!isReviewerOnly) {
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
    }

    if (isReviewerOnly) {
      if (typeof reviewerComment === 'string') {
        updates.reviewerComment = reviewerComment;
        updates.reviewerId = req.user.id;
        updates.reviewerSubmittedAt = new Date();
        touched = true;
      }

      if (typeof reviewerRating !== 'undefined') {
        if (reviewerRating === null || reviewerRating === '') {
          updates.reviewerRating = null;
          touched = true;
        } else {
          const parsed = Number(reviewerRating);
          if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
            return res.status(400).json({ message: 'reviewerRating must be between 1 and 5.' });
          }
          updates.reviewerRating = parsed;
          updates.reviewerId = req.user.id;
          updates.reviewerSubmittedAt = new Date();
          touched = true;
        }
      }
    }

    if (!touched) {
      return res.status(400).json({ message: 'No updates were provided.' });
    }

    if (!isReviewerOnly) {
      if (updates.reviewStatus === 'resolved' || updates.reviewerDecision) {
        updates.reviewedAt = new Date();
      } else if (updates.reviewStatus && updates.reviewStatus !== 'resolved') {
        updates.reviewedAt = null;
      }
    }

    await evaluation.update(updates);

    const refreshed = await Evaluation.findByPk(evaluationId, { include: buildIncludes() });
    return res.json({ adjudication: formatAdjudication(refreshed) });
  } catch (error) {
    console.error('Reviewer adjudication update error', error);
    return res.status(500).json({ message: 'Unable to update adjudication right now.' });
  }
});

router.post('/adjudications/:id/notes', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'reviewer') {
      return res.status(403).json({ message: 'Only reviewers can post notes.' });
    }

    const evaluationId = Number(req.params.id);
    if (Number.isNaN(evaluationId)) {
      return res.status(400).json({ message: 'Invalid evaluation id provided.' });
    }

    const evaluation = await Evaluation.findByPk(evaluationId, {
      include: [{ model: Study, as: 'study', attributes: ['id', 'allowReviewers'] }],
    });
    if (!evaluation) {
      return res.status(404).json({ message: 'Evaluation not found.' });
    }
    if (!evaluation.study?.allowReviewers) {
      return res.status(403).json({ message: 'Reviewer notes are disabled for this study.' });
    }

    const existing = await ReviewerNote.findOne({
      where: { evaluationId, reviewerId: req.user.id },
    });
    if (existing) {
      return res.status(409).json({ message: 'You have already submitted feedback for this evaluation.' });
    }

    const { comment, rating } = req.body || {};
    if (!comment && (rating === undefined || rating === null)) {
      return res.status(400).json({ message: 'Provide a comment or rating.' });
    }
    let normalizedRating = null;
    if (typeof rating !== 'undefined' && rating !== null) {
      const parsed = Number(rating);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
      }
      normalizedRating = parsed;
    }

    const note = await ReviewerNote.create({
      evaluationId,
      reviewerId: req.user.id,
      comment: comment || null,
      rating: normalizedRating,
    });

    const saved = await ReviewerNote.findByPk(note.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }],
    });

    return res.status(201).json({
      note: {
        id: String(saved.id),
        comment: saved.comment,
        rating: saved.rating,
        createdAt: saved.createdAt,
        reviewer: saved.author
          ? { id: String(saved.author.id), name: saved.author.name, email: saved.author.email }
          : null,
      },
    });
  } catch (error) {
    console.error('Reviewer note create error', error);
    return res.status(500).json({ message: 'Unable to save reviewer note right now.' });
  }
});

router.delete('/adjudications/:id/notes/:noteId', authMiddleware, async (req, res) => {
  try {
    const evaluationId = Number(req.params.id);
    const noteId = Number(req.params.noteId);
    if (Number.isNaN(evaluationId) || Number.isNaN(noteId)) {
      return res.status(400).json({ message: 'Invalid evaluation or note id provided.' });
    }

    const note = await ReviewerNote.findByPk(noteId, {
      include: [
        { model: Evaluation, as: 'evaluation', include: [{ model: Study, as: 'study', attributes: ['id', 'researcherId'] }] },
      ],
    });

    if (!note || note.evaluationId !== evaluationId) {
      return res.status(404).json({ message: 'Reviewer note not found.' });
    }

    const studyOwnerId = note.evaluation?.study?.researcherId;
    const isOwnerReviewer = req.user.role === 'reviewer' && Number(note.reviewerId) === Number(req.user.id);
    const isStudyResearcher = req.user.role === 'researcher' && Number(studyOwnerId) === Number(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isOwnerReviewer && !isStudyResearcher && !isAdmin) {
      return res.status(403).json({ message: 'You are not allowed to delete this reviewer note.' });
    }

    await note.destroy();
    return res.status(204).send();
  } catch (error) {
    console.error('Reviewer note delete error', error);
    return res.status(500).json({ message: 'Unable to delete reviewer note right now.' });
  }
});

function buildIncludes() {
  return [
    { model: Study, as: 'study', attributes: ['id', 'title', 'researcherId', 'allowReviewers'] },
    {
      model: StudyParticipant,
      as: 'studyParticipant',
      include: [{ model: User, as: 'participant', attributes: ['id', 'name', 'email'] }],
    },
    { model: User, as: 'participantEvaluator', attributes: ['id', 'name', 'email'] },
    { model: User, as: 'reviewer', attributes: ['id', 'name', 'email'] },
    {
      model: ReviewerNote,
      as: 'reviewerNotesList',
      include: [{ model: User, as: 'author', attributes: ['id', 'name', 'email'] }],
    },
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
  return Boolean(user && (user.role === 'researcher' || user.role === 'admin' || user.role === 'reviewer'));
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
  if (user.role === 'researcher') {
    return Number(user.id) === Number(study.researcherId);
  }
  // reviewer role
  return Boolean(study.allowReviewers);
}

function formatAdjudication(evaluationInstance) {
  const evaluation = evaluationInstance.get({ plain: true });
  const comparisonMeta = formatComparison(evaluation.comparison);
  const studyMeta = evaluation.study ? formatStudy(evaluation.study) : null;
  const participant = formatParticipant(evaluation, { isBlinded: Boolean(studyMeta?.isBlinded) });
  const isBlinded = Boolean(studyMeta?.isBlinded);

  return {
    id: String(evaluation.id),
    study: evaluation.study
      ? {
          id: String(evaluation.study.id),
          title: evaluation.study.title,
          allowReviewers: Boolean(evaluation.study.allowReviewers),
          researcherId: evaluation.study.researcherId ? String(evaluation.study.researcherId) : null,
        }
      : null,
    participant,
    status: evaluation.status,
    review: {
      status: evaluation.reviewStatus,
      decision: evaluation.reviewerDecision,
      notes: evaluation.reviewerNotes,
      adjudicatedLabel: evaluation.adjudicatedLabel,
      reviewedAt: evaluation.reviewedAt,
      comment: evaluation.reviewerComment,
      rating: evaluation.reviewerRating,
      reviewer:
        evaluation.reviewer ||
        (evaluation.reviewerId
          ? { id: String(evaluation.reviewerId), name: null, email: null }
          : null),
      reviewerSubmittedAt: evaluation.reviewerSubmittedAt,
      comments: Array.isArray(evaluation.reviewerNotesList)
        ? evaluation.reviewerNotesList.map((note) => ({
            id: String(note.id),
            comment: note.comment,
            rating: note.rating,
            createdAt: note.createdAt,
            reviewer: note.author
              ? {
                  id: String(note.author.id),
                  name: note.author.name,
                  email: note.author.email,
                }
              : null,
          }))
        : [],
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
