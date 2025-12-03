const express = require('express');
const router = express.Router();
const { CompetencyAssessment, CompetencyAssignment, User } = require('../models');
const PDFDocument = require('pdfkit');
const csv = require('fast-csv');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

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

      const isLocked = status === 'submitted' || status === 'reviewed';
      const statusChip =
        isLocked
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
        status,
        isLocked,
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
          attributes: ['id', 'name', 'email', 'created_at'],
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

router.get('/participants/overview', async (req, res) => {
  try {
    const { researcherId } = req.query;
    if (!researcherId) {
      return res.status(400).json({ message: 'researcherId is required.' });
    }

    const assignments = await CompetencyAssignment.findAll({
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
      order: [['updatedAt', 'DESC']],
    });

    const participantsMap = new Map();

    assignments.forEach((record) => {
      const plain = record.get({ plain: true });
      const participant = plain.participant;
      if (!participant) {
        return;
      }

      const assessment = plain.assessment || {};
      const joinedAt = participant.createdAt || participant.created_at || null;
      const current = participantsMap.get(participant.id) || {
        id: participant.id,
        name: participant.name,
        email: participant.email,
        assignments: [],
        hasApproved: false,
        lastActivity: null,
        joinedAt,
      };

      const assignmentSummary = {
        assignmentId: plain.id,
        assessmentId: plain.assessmentId,
        assessmentTitle: assessment.title || 'Assessment',
        status: plain.status,
        decision: plain.decision,
        submittedAt: plain.submittedAt,
        reviewedAt: plain.reviewedAt,
        updatedAt: plain.updatedAt,
        createdAt: plain.createdAt,
      };

      current.assignments.push(assignmentSummary);
      current.hasApproved = current.hasApproved || plain.decision === 'approved';

      const latestTimestamp = plain.updatedAt || plain.createdAt;
      if (!current.lastActivity || new Date(latestTimestamp) > new Date(current.lastActivity)) {
        current.lastActivity = latestTimestamp;
      }

      participantsMap.set(participant.id, current);
    });

    const participants = Array.from(participantsMap.values()).sort((a, b) => {
      const dateA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const dateB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return dateB - dateA;
    });

    return res.json({ participants });
  } catch (error) {
    console.error('Fetch competency participants overview error', error);
    return res.status(500).json({ message: 'Unable to load competency participants right now.' });
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

    if (assignment.status === 'submitted' || assignment.status === 'reviewed') {
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

router.get('/assessments/researcher', async (req, res) => {
  try {
    const { researcherId } = req.query;
    if (!researcherId) {
      return res.status(400).json({ message: 'A researcherId is required.' });
    }

    const assessments = await CompetencyAssessment.findAll({
      where: { researcherId },
      order: [['createdAt', 'DESC']],
    });

    return res.json({ assessments: assessments.map((a) => a.get({ plain: true })) });
  } catch (error) {
    console.error('Fetch researcher competency assessments error', error);
    return res.status(500).json({ message: 'Unable to load competency assessments right now.' });
  }
});

router.get('/assessments/:id/report', async (req, res) => {
  try {
    const assessmentId = Number(req.params.id);
    const { format = 'pdf' } = req.query;

    if (Number.isNaN(assessmentId)) {
      return res.status(400).json({ message: 'Invalid assessment ID provided.' });
    }

    const assessment = await CompetencyAssessment.findByPk(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: 'Competency assessment not found.' });
    }

    const assignments = await CompetencyAssignment.findAll({
      where: {
        assessmentId,
        status: 'reviewed', // Only include reviewed assignments
      },
      order: [['reviewedAt', 'ASC']],
    });

    const totalReviewed = assignments.length;
    const totalApproved = assignments.filter((a) => a.decision === 'approved').length;
    const acceptanceRate = totalReviewed > 0 ? ((totalApproved / totalReviewed) * 100).toFixed(1) : 0;

    const reportData = {
      assessmentTitle: assessment.title,
      passingThreshold: assessment.criteria?.passingThreshold,
      acceptanceRate,
      totalReviewed,
      submissions: assignments.map((a) => ({
        submissionId: String(a.id),
        status: a.decision,
        comments: a.reviewerNotes || 'No comments provided.',
        submittedAt: a.submittedAt,
      })),
    };

    const safeTitle = assessment.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    const filename = `Competency-Report-${safeTitle}-${new Date().toISOString().slice(0, 10)}`;

    if (format.toLowerCase() === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);

      // Use headers: false to allow writing arbitrary rows for metadata and data.
      const csvStream = csv.format({ headers: false });
      csvStream.pipe(res);

      // Write metadata rows
      csvStream.write(['Assessment Title', reportData.assessmentTitle]);
      csvStream.write(['Generated On', new Date().toLocaleDateString()]);
      csvStream.write([
        'Overall Acceptance Rate',
        `${reportData.acceptanceRate}% (${totalApproved}/${totalReviewed} approved)`,
      ]);
      csvStream.write([]); // Blank line

      // Write headers for data
      csvStream.write(['Submission ID', 'Acceptance Status', 'Reviewer Notes', 'Submitted At']);

      // Write submission data
      reportData.submissions.forEach((submission) => {
        csvStream.write([
          submission.submissionId,
          submission.status,
          submission.comments,
          submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : 'N/A',
        ]);
      });

      csvStream.end();
    } else {
      // Default to PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);

      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4',
      });

      doc.pipe(res);

      // --- PDF Styling and Helpers ---
      const colors = {
        primary: '#4F46E5', // A modern indigo/purple
        text: '#1F2937', // Dark gray for text
        muted: '#6B7280', // Lighter gray for secondary info
        border: '#E5E7EB', // Light gray for borders
        headerBg: '#F9FAFB', // Very light gray for table header
      };

      const generateHeader = () => {
        doc
          .fillColor(colors.primary)
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('StudyWeave', { align: 'left' });
        doc
          .fillColor(colors.muted)
          .fontSize(10)
          .font('Helvetica')
          .text(`Report Generated: ${new Date().toLocaleDateString()}`, { align: 'right' });
        doc.moveDown(2);
      };

      const generateTitle = () => {
        doc
          .fillColor(colors.text)
          .fontSize(18)
          .font('Helvetica-Bold')
          .text('Competency Performance Report');
        doc.fontSize(14).font('Helvetica').text(reportData.assessmentTitle);
        doc.moveDown(1);
      };

      const generateSummary = () => {
        doc.fontSize(12).font('Helvetica-Bold').text('Summary');
        doc.strokeColor(colors.border).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);
        doc
          .fontSize(11)
          .font('Helvetica')
          .fillColor(colors.text)
          .text(
            `Overall Acceptance Rate: ${reportData.acceptanceRate}% (${totalApproved} of ${totalReviewed} reviewed submissions)`,
          );
        doc.moveDown(2);
      };

      const generateTable = () => {
        doc.fontSize(12).font('Helvetica-Bold').text('Anonymous Submission Details');
        doc.moveDown(0.5);

        const table = {
          headers: ['Submission ID', 'Status', 'Reviewer Notes', 'Submitted At'],
          rows: reportData.submissions.map((sub) => [
            sub.submissionId,
            sub.status,
            sub.comments,
            sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A',
          ]),
          columnWidths: [80, 80, 220, 120],
          columnAligns: ['left', 'left', 'left', 'right'],
        };

        const tableTop = doc.y;
        const rowHeight = 25;

        // Draw header
        doc.rect(50, tableTop, 500, rowHeight).fill(colors.headerBg);
        doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(10);
        let currentX = 50;
        table.headers.forEach((header, i) => {
          doc.text(header, currentX + 10, tableTop + 8, { width: table.columnWidths[i] - 20 });
          currentX += table.columnWidths[i];
        });

        // Draw rows
        doc.fillColor(colors.text).font('Helvetica').fontSize(9);
        table.rows.forEach((row, i) => {
          const rowY = tableTop + (i + 1) * rowHeight;
          currentX = 50;
          row.forEach((cell, j) => {
            doc.text(cell, currentX + 10, rowY + 8, {
              width: table.columnWidths[j] - 20,
              align: table.columnAligns[j],
            });
            currentX += table.columnWidths[j];
          });
          doc.strokeColor(colors.border).moveTo(50, rowY + rowHeight).lineTo(550, rowY + rowHeight).stroke();
        });
      };

      // --- Build the Document ---
      generateHeader();
      generateTitle();
      generateSummary();
      generateTable();

      doc.end();
    }
  } catch (error) {
    console.error('Generate competency report error', error);
    res.status(500).json({ message: 'Unable to generate competency report right now.' });
  }
});

router.get('/assessments/import-template', (req, res) => {
  const template = [
    ['type', 'text', 'is_correct'],
    ['question', 'What is the capital of France?', ''],
    ['option', 'London', 'false'],
    ['option', 'Paris', 'true'],
    ['option', 'Berlin', 'false'],
    ['question', 'Which of these are prime numbers? (Select all that apply)', ''],
    ['option', '4', 'false'],
    ['option', '7', 'true'],
  ].map(row => row.join(',')).join('\n');

  res.header('Content-Type', 'text/csv');
  res.attachment('question_template.csv');
  res.send(template);
});

router.post('/assessments/import', upload.single('questionsFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No questions file was uploaded.' });
  }

  const fileContent = req.file.buffer.toString('utf8');
  const questions = [];
  const errors = [];
  let currentQuestion = null;
  let rowNumber = 1; // Start at 1 for the header row

  const stream = csv.parse({ headers: ['type', 'text', 'is_correct'], renameHeaders: true, trim: true });

  // Wrap the stream processing in a promise to handle it synchronously within the async route
  const parsePromise = new Promise((resolve, reject) => {
    stream
      .on('error', (error) => reject(error))
      .on('data', (row) => {
        rowNumber++; // Increment for each data row
        const type = (row.type || '').toLowerCase().trim();
        const text = (row.text || '').trim();
        const isCorrect = (row.is_correct || '').toLowerCase() === 'true';

        if (!type || !text) {
          errors.push({ row: rowNumber, message: "Row is missing a 'type' or 'text' value." });
          return; // Skip this invalid row
        }

        if (type !== 'question' && type !== 'option') {
          errors.push({ row: rowNumber, message: `Invalid type: '${row.type}'. Must be 'question' or 'option'.` });
          return;
        }

        if (type === 'question') {
          if (currentQuestion) {
            // Final validation for the previous question before adding it
            if (currentQuestion.options.length > 0 && !currentQuestion.options.some(o => o.isCorrect)) {
              errors.push({ row: currentQuestion._sourceRow, message: `Question "${currentQuestion.title.slice(0, 30)}..." has no correct option marked.` });
            }
            questions.push(currentQuestion);
          }
          currentQuestion = {
            title: text,
            type: 'multiple_choice',
            options: [],
            _sourceRow: rowNumber, // For better error reporting
          };
        } else if (type === 'option' && currentQuestion) {
          currentQuestion.options.push({ text, isCorrect });
        } else if (type === 'option' && !currentQuestion) {
          errors.push({ row: rowNumber, message: "Found an 'option' row before a 'question' row." });
        }
      })
      .on('end', (rowCount) => {
        if (currentQuestion) {
          // Final validation for the very last question in the file
          if (currentQuestion.options.length > 0 && !currentQuestion.options.some(o => o.isCorrect)) {
            errors.push({ row: currentQuestion._sourceRow, message: `Question "${currentQuestion.title.slice(0, 30)}..." has no correct option marked.` });
          }
          questions.push(currentQuestion);
        }

        questions.forEach((q) => {
          // A question with no options is a short answer question
          if (q.options.length === 0) {
            q.type = 'short_answer';
          }
          delete q._sourceRow; // Clean up helper property
        });

        console.log(`Parsed ${rowCount} rows. Created ${questions.length} questions with ${errors.length} errors.`);
        resolve({ questions, errors });
      });

    stream.write(fileContent);
    stream.end();
  });

  parsePromise
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((error) => {
      console.error('CSV parsing error:', error);
      res.status(400).json({ message: 'The uploaded CSV file is malformed. Please check its structure.' });
    });
});

module.exports = router;
