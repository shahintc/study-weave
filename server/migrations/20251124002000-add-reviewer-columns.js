module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('study_comparisons', 'ground_truth', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.addColumn('evaluations', 'review_status', {
      type: Sequelize.ENUM('pending', 'in_review', 'resolved'),
      allowNull: false,
      defaultValue: 'pending',
    });

    await queryInterface.addColumn('evaluations', 'reviewer_decision', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });

    await queryInterface.addColumn('evaluations', 'reviewer_notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('evaluations', 'reviewed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('evaluations', 'participant_payload', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.addColumn('evaluations', 'ground_truth_payload', {
      type: Sequelize.JSONB,
      allowNull: true,
    });

    await queryInterface.addColumn('evaluations', 'adjudicated_label', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('evaluations', 'adjudicated_label');
    await queryInterface.removeColumn('evaluations', 'ground_truth_payload');
    await queryInterface.removeColumn('evaluations', 'participant_payload');
    await queryInterface.removeColumn('evaluations', 'reviewed_at');
    await queryInterface.removeColumn('evaluations', 'reviewer_notes');
    await queryInterface.removeColumn('evaluations', 'reviewer_decision');
    await queryInterface.removeColumn('evaluations', 'review_status');
    await queryInterface.removeColumn('study_comparisons', 'ground_truth');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_evaluations_review_status";');
  },
};
