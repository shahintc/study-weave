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
          { key: 'reviewer', name: 'Reviewer', description: 'Reviews participant work', createdAt: now, updatedAt: now },
        ],
        { transaction: t }
      );

      const [[researcherRole]] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE key = 'researcher' LIMIT 1`,
        { transaction: t }
      );
      const [[reviewerRole]] = await queryInterface.sequelize.query(
        `SELECT id FROM roles WHERE key = 'reviewer' LIMIT 1`,
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
          { name: 'Riley Reviewer', email: 'reviewer@example.com', password: pw, role: 'reviewer', role_id: reviewerRole.id, created_at: now },
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
        const status = 'submitted';
        const decision = 'approved';
        assignmentRows.push({
          assessment_id: assessment.id,
          participant_id: p.id,
          researcher_id: researcher.id,
          status,
          decision,
          responses: JSON.stringify({ q1: 'demo', q2: 4 }),
          score: 70 + i * 5,
          started_at: now,
          submitted_at: now,
          reviewed_at: now,
          reviewer_notes: 'Approved for study',
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
            allow_reviewers: true,
            metadata: JSON.stringify({
              phase: 1,
              participantTarget: 10,
              nextMilestone: 'Synthesis workshop • Mar 14',
              health: 'on-track',
              progressDelta: 12,
              statusLabel: 'In field',
            }),
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
            ground_truth: JSON.stringify({
              expectedWinner: 'primary',
              rationale: 'LLM judged Artifact A clearer and more complete.',
              confidence: 0.82,
            }),
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
      const approvedAssignments = assignments; // all 5 approved above
      const participantProfiles = [
        { persona: 'Senior Engineer', region: 'North America' },
        { persona: 'Data Scientist', region: 'EMEA' },
        { persona: 'UX Researcher', region: 'APAC' },
      ];
      const progressByIndex = [100, 80, 60, 40, 20];
      const statusByIndex = (idx) => (idx === 0 || idx === 3 ? 'completed' : 'in_progress');
      const studyParticipants = approvedAssignments.map((a, idx) => {
        const profile = participantProfiles[idx] || { persona: 'Participant', region: 'Unknown' };
        return {
          study_id: study.id,
          participant_id: a.participant_id,
          competency_assignment_id: a.id,
          invitation_status: 'accepted',
          participation_status: statusByIndex(idx),
          progress_percent: progressByIndex[idx] ?? 40,
          started_at: now,
          completed_at: statusByIndex(idx) === 'completed' ? now : null,
          last_checkpoint: JSON.stringify({ step: idx === 0 ? 2 : 1, persona: profile.persona, region: profile.region }),
          createdAt: now,
          updatedAt: now,
        };
      });
      await queryInterface.bulkInsert('study_participants', studyParticipants, { transaction: t });

      const [studyParticipantRows] = await queryInterface.sequelize.query(
        `SELECT * FROM study_participants WHERE study_id = ${study.id} ORDER BY id ASC`,
        { transaction: t }
      );

      // 8) Evaluations for all participants (submitted with ratings)
      const baseRatings = [5, 4, 3, 5, 4];
      const evals = studyParticipantRows.slice(0, 5).map((row, idx) => ({
        study_id: study.id,
        comparison_id: comparison.id,
        participant_id: row.participant_id,
        study_participant_id: row.id,
        status: 'submitted',
        preference: idx % 2 === 0 ? 'primary' : 'secondary',
        annotations: JSON.stringify([]),
        highlights: JSON.stringify([]),
        notes: idx % 2 === 0 ? 'Prefers primary for clarity' : 'Secondary feels more accurate',
        rating: baseRatings[idx] ?? 4,
        metrics: JSON.stringify({ timeSeconds: 60 + idx * 15 }),
        summary: 'Seeded evaluation',
        participant_payload: JSON.stringify({
          label: idx % 2 === 0 ? 'clarity' : 'accuracy',
          explanation: idx % 2 === 0 ? 'Artifact A reads better' : 'Artifact B is more precise',
        }),
        ground_truth_payload: JSON.stringify({
          label: 'primary',
          explanation: 'LLM baseline prefers Artifact A for clarity',
        }),
        submitted_at: new Date(now.getTime() - idx * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      }));
      await queryInterface.bulkInsert('evaluations', evals, { transaction: t });

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
