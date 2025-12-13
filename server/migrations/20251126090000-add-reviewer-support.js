module.exports = {
  up: async (queryInterface, Sequelize) => {
    const studies = await queryInterface.describeTable('studies');
    const evaluations = await queryInterface.describeTable('evaluations');

    if (!studies.allow_reviewers) {
      await queryInterface.addColumn('studies', 'allow_reviewers', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!evaluations.reviewer_comment) {
      await queryInterface.addColumn('evaluations', 'reviewer_comment', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (!evaluations.reviewer_rating) {
      await queryInterface.addColumn('evaluations', 'reviewer_rating', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!evaluations.reviewer_id) {
      await queryInterface.addColumn('evaluations', 'reviewer_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!evaluations.reviewer_submitted_at) {
      await queryInterface.addColumn('evaluations', 'reviewer_submitted_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const studies = await queryInterface.describeTable('studies');
    const evaluations = await queryInterface.describeTable('evaluations');

    if (studies.allow_reviewers) {
      await queryInterface.removeColumn('studies', 'allow_reviewers');
    }
    if (evaluations.reviewer_comment) {
      await queryInterface.removeColumn('evaluations', 'reviewer_comment');
    }
    if (evaluations.reviewer_rating) {
      await queryInterface.removeColumn('evaluations', 'reviewer_rating');
    }
    if (evaluations.reviewer_id) {
      await queryInterface.removeColumn('evaluations', 'reviewer_id');
    }
    if (evaluations.reviewer_submitted_at) {
      await queryInterface.removeColumn('evaluations', 'reviewer_submitted_at');
    }
  },
};
