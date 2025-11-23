module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('study_participants', 'next_artifact_mode', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

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
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('study_participants', 'next_study_artifact_id');
    await queryInterface.removeColumn('study_participants', 'next_artifact_mode');
  },
};
