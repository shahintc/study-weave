/* eslint-disable no-console */
'use strict';

const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      const now = new Date();

      // 1) Roles
      await queryInterface.bulkInsert(
        'roles',
        [
          { key: 'admin', name: 'Admin', description: 'Administrator', createdAt: now, updatedAt: now },
          { key: 'researcher', name: 'Researcher', description: 'Creates studies', createdAt: now, updatedAt: now },
          { key: 'participant', name: 'Participant', description: 'Participates in studies', createdAt: now, updatedAt: now },
        ],
        { transaction: t }
      );

      const [[researcherRole]] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE key = 'researcher' LIMIT 1`,
        { transaction: t }
      );
      const [[participantRole]] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE key = 'participant' LIMIT 1`,
        { transaction: t }
      );

      // 2) Users: 1 researcher + 5 participants
      const pw = await bcrypt.hash('password123', 10);
      await queryInterface.bulkInsert(
        'users',
        [
          { name: 'Dr. Ada Researcher', email: 'researcher@example.com', password: pw, role: 'researcher', role_id: researcherRole.id, created_at: now },
          { name: 'Pat One', email: 'p1@example.com', password: pw, role: 'participant', role_id: participantRole.id, created_at: now },
          { name: 'Pat Two', email: 'p2@example.com', password: pw, role: 'participant', role_id: participantRole.id, created_at: now },
          { name: 'Pat Three', email: 'p3@example.com', password: pw, role: 'participant', role_id: participantRole.id, created_at: now },
          { name: 'Pat Four', email: 'p4@example.com', password: pw, role: 'participant', role_id: participantRole.id, created_at: now },
          { name: 'Pat Five', email: 'p5@example.com', password: pw, role: 'participant', role_id: participantRole.id, created_at: now },
        ],
        { transaction: t }
      );

      const [[researcher]] = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email = 'researcher@example.com'`,
        { transaction: t }
      );
      const [participants] = await queryInterface.sequelize.query(
        `SELECT id, email FROM users WHERE role = 'participant' ORDER BY id ASC LIMIT 5`,
        { transaction: t }
      );

      // 3) Artifacts (uploaded by researcher)
      await queryInterface.bulkInsert(
        'artifacts',
        [
          {
            name: 'Artifact A',
            type: 'human',
            filePath: '/uploads/artifact-a.txt',
            fileMimeType: 'text/plain',
            fileOriginalName: 'artifact-a.txt',
            description: 'Human-written artifact A',
            metadata: JSON.stringify({ source: 'demo' }),
            createdAt: now,
            updatedAt: now,
            userId: researcher.id,
          },
          {
            name: 'Artifact B',
            type: 'AI',
            filePath: '/uploads/artifact-b.txt',
            fileMimeType: 'text/plain',
            fileOriginalName: 'artifact-b.txt',
            description: 'AI-generated artifact B',
            metadata: JSON.stringify({ source: 'demo' }),
            createdAt: now,
            updatedAt: now,
            userId: researcher.id,
          },
        ],
        { transaction: t }
      );

      const [artifactRows] = await queryInterface.sequelize.query(
        `SELECT id, name FROM artifacts ORDER BY id ASC`,
        { transaction: t }
      );

      // 4) Competency Assessment + Assignments
      const questions = [
        { id: 1, text: 'Explain X briefly', type: 'text' },
        { id: 2, text: 'Rate your comfort with Y', type: 'scale', min: 1, max: 5 },
      ];
      await queryInterface.bulkInsert(
        'competency_assessments',
        [
          {
            researcher_id: researcher.id,
            title: 'Baseline Competency Check',
            description: 'Quick check before participating in the study',
            criteria: JSON.stringify({ minScore: 50 }),
            questions: JSON.stringify(questions),
            total_score: 100,
            status: 'published',
            metadata: JSON.stringify({ version: 1 }),
            createdAt: now,
            updatedAt: now,
          },
        ],
        { transaction: t }
      );

      const [[assessment]] = await queryInterface.sequelize.query(
        `SELECT id FROM competency_assessments WHERE title = 'Baseline Competency Check' LIMIT 1`,
        { transaction: t }
      );

      const assignmentRows = [];
      for (let i = 0; i < participants.length; i++) {
        const p = participants[i];
        const status = i < 3 ? 'submitted' : i === 3 ? 'in_progress' : 'pending';
        const decision = i < 2 ? 'approved' : i === 2 ? 'rejected' : 'undecided';
        assignmentRows.push({
          assessment_id: assessment.id,
          participant_id: p.id,
          researcher_id: researcher.id,
          status,
          decision,
          responses: JSON.stringify({ q1: 'demo', q2: 4 }),
          score: i < 2 ? 80 + i * 5 : 40,
          started_at: now,
          submitted_at: status === 'submitted' ? now : null,
          reviewed_at: decision !== 'undecided' ? now : null,
          reviewer_notes: decision === 'approved' ? 'Looks good' : decision === 'rejected' ? 'Needs work' : null,
          createdAt: now,
          updatedAt: now,
        });
      }
      await queryInterface.bulkInsert('competency_assignments', assignmentRows, { transaction: t });

      const [assignments] = await queryInterface.sequelize.query(
        `SELECT * FROM competency_assignments ORDER BY id ASC`,
        { transaction: t }
      );

      // 5) Study and study artifacts
      await queryInterface.bulkInsert(
        'studies',
        [
          {
            researcher_id: researcher.id,
            title: 'Comparison Study 1',
            description: 'Participants compare two artifacts and annotate',
            criteria: JSON.stringify({ goals: ['quality', 'coherence'] }),
            timeline_start: now,
            timeline_end: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
            status: 'active',
            is_archived: false,
            metadata: JSON.stringify({ phase: 1 }),
            createdAt: now,
            updatedAt: now,
          },
        ],
        { transaction: t }
      );

      const [[study]] = await queryInterface.sequelize.query(
        `SELECT id FROM studies WHERE title = 'Comparison Study 1' LIMIT 1`,
        { transaction: t }
      );

      await queryInterface.bulkInsert(
        'study_artifacts',
        [
          {
            study_id: study.id,
            artifact_id: artifactRows[0].id,
            label: 'A',
            instructions: 'Read carefully',
            order_index: 1,
            createdAt: now,
            updatedAt: now,
          },
          {
            study_id: study.id,
            artifact_id: artifactRows[1].id,
            label: 'B',
            instructions: 'Read carefully',
            order_index: 2,
            createdAt: now,
            updatedAt: now,
          },
        ],
        { transaction: t }
      );

      const [studyArtifactRows] = await queryInterface.sequelize.query(
        `SELECT id, label FROM study_artifacts WHERE study_id = ${study.id} ORDER BY order_index ASC`,
        { transaction: t }
      );

      // 6) Comparison (pair A vs B)
      await queryInterface.bulkInsert(
        'study_comparisons',
        [
          {
            study_id: study.id,
            primary_artifact_id: studyArtifactRows[0].id,
            secondary_artifact_id: studyArtifactRows[1].id,
            prompt: 'Which artifact better explains the concept and why?',
            criteria: JSON.stringify({ rubric: ['clarity', 'accuracy'] }),
            createdAt: now,
            updatedAt: now,
          },
        ],
        { transaction: t }
      );

      const [[comparison]] = await queryInterface.sequelize.query(
        `SELECT id FROM study_comparisons WHERE study_id = ${study.id} LIMIT 1`,
        { transaction: t }
      );

      // 7) Study participants (use approved ones)
      const approvedAssignments = assignments.filter((a) => a.decision === 'approved');
      const studyParticipants = approvedAssignments.map((a, idx) => ({
        study_id: study.id,
        participant_id: a.participant_id,
        competency_assignment_id: a.id,
        invitation_status: 'accepted',
        participation_status: idx === 0 ? 'completed' : 'in_progress',
        progress_percent: idx === 0 ? 100 : 40,
        started_at: now,
        completed_at: idx === 0 ? now : null,
        last_checkpoint: JSON.stringify({ step: idx === 0 ? 2 : 1 }),
        createdAt: now,
        updatedAt: now,
      }));
      await queryInterface.bulkInsert('study_participants', studyParticipants, { transaction: t });

      const [studyParticipantRows] = await queryInterface.sequelize.query(
        `SELECT * FROM study_participants WHERE study_id = ${study.id} ORDER BY id ASC`,
        { transaction: t }
      );

      // 8) Evaluations for two participants
      const evals = [];
      if (studyParticipantRows.length > 0) {
        evals.push({
          study_id: study.id,
          comparison_id: comparison.id,
          participant_id: studyParticipantRows[0].participant_id,
          study_participant_id: studyParticipantRows[0].id,
          status: 'submitted',
          preference: 'primary',
          annotations: JSON.stringify([{ artifact: 'A', range: [0, 12], note: 'Good intro' }]),
          highlights: JSON.stringify([{ artifact: 'B', range: [10, 30] }]),
          notes: 'Prefers A for clarity',
          rating: 5,
          metrics: JSON.stringify({ timeSeconds: 120 }),
          summary: 'A explains better',
          submitted_at: now,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (studyParticipantRows.length > 1) {
        evals.push({
          study_id: study.id,
          comparison_id: comparison.id,
          participant_id: studyParticipantRows[1].participant_id,
          study_participant_id: studyParticipantRows[1].id,
          status: 'draft',
          preference: null,
          annotations: JSON.stringify([]),
          highlights: JSON.stringify([]),
          notes: 'Will complete later',
          rating: null,
          metrics: JSON.stringify({ timeSeconds: 35 }),
          summary: null,
          submitted_at: null,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (evals.length) {
        await queryInterface.bulkInsert('evaluations', evals, { transaction: t });
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  down: async (queryInterface) => {
    const t = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.bulkDelete('evaluations', null, { transaction: t });
      await queryInterface.bulkDelete('study_participants', null, { transaction: t });
      await queryInterface.bulkDelete('study_comparisons', null, { transaction: t });
      await queryInterface.bulkDelete('study_artifacts', null, { transaction: t });
      await queryInterface.bulkDelete('studies', null, { transaction: t });
      await queryInterface.bulkDelete('competency_assignments', null, { transaction: t });
      await queryInterface.bulkDelete('competency_assessments', null, { transaction: t });
      await queryInterface.bulkDelete('artifacts', null, { transaction: t });
      await queryInterface.bulkDelete('users', null, { transaction: t });
      await queryInterface.bulkDelete('roles', null, { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};

