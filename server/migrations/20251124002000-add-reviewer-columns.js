module.exports = {
  up: async (queryInterface, Sequelize) => {
    const studyComparisons = await queryInterface.describeTable('study_comparisons');
    const evaluations = await queryInterface.describeTable('evaluations');

    if (!studyComparisons.ground_truth) {
      await queryInterface.addColumn('study_comparisons', 'ground_truth', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }

    if (!evaluations.review_status) {
      await queryInterface.addColumn('evaluations', 'review_status', {
        type: Sequelize.ENUM('pending', 'in_review', 'resolved'),
        allowNull: false,
        defaultValue: 'pending',
      });
    }

    if (!evaluations.reviewer_decision) {
      await queryInterface.addColumn('evaluations', 'reviewer_decision', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }

    if (!evaluations.reviewer_notes) {
      await queryInterface.addColumn('evaluations', 'reviewer_notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!evaluations.reviewed_at) {
      await queryInterface.addColumn('evaluations', 'reviewed_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!evaluations.participant_payload) {
      await queryInterface.addColumn('evaluations', 'participant_payload', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }

    if (!evaluations.ground_truth_payload) {
      await queryInterface.addColumn('evaluations', 'ground_truth_payload', {
        type: Sequelize.JSONB,
        allowNull: true,
      });
    }

    if (!evaluations.adjudicated_label) {
      await queryInterface.addColumn('evaluations', 'adjudicated_label', {
        type: Sequelize.STRING(128),
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const studyComparisons = await queryInterface.describeTable('study_comparisons');
    const evaluations = await queryInterface.describeTable('evaluations');

    if (evaluations.adjudicated_label) {
      await queryInterface.removeColumn('evaluations', 'adjudicated_label');
    }
    if (evaluations.ground_truth_payload) {
      await queryInterface.removeColumn('evaluations', 'ground_truth_payload');
    }
    if (evaluations.participant_payload) {
      await queryInterface.removeColumn('evaluations', 'participant_payload');
    }
    if (evaluations.reviewed_at) {
      await queryInterface.removeColumn('evaluations', 'reviewed_at');
    }
    if (evaluations.reviewer_notes) {
      await queryInterface.removeColumn('evaluations', 'reviewer_notes');
    }
    if (evaluations.reviewer_decision) {
      await queryInterface.removeColumn('evaluations', 'reviewer_decision');
    }
    if (evaluations.review_status) {
      await queryInterface.removeColumn('evaluations', 'review_status');
    }
    if (studyComparisons.ground_truth) {
      await queryInterface.removeColumn('study_comparisons', 'ground_truth');
    }

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_evaluations_review_status";');
  },
};
