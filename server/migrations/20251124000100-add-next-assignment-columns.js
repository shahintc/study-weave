module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('study_participants');

    if (!table.next_artifact_mode) {
      await queryInterface.addColumn('study_participants', 'next_artifact_mode', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
    }

    if (!table.next_study_artifact_id) {
      await queryInterface.addColumn('study_participants', 'next_study_artifact_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'study_artifacts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('study_participants');
    if (table.next_study_artifact_id) {
      await queryInterface.removeColumn('study_participants', 'next_study_artifact_id');
    }
    if (table.next_artifact_mode) {
      await queryInterface.removeColumn('study_participants', 'next_artifact_mode');
    }
  },
};
