const { Tag: SequelizeTag } = require('../models');

class Tag {
  /**
   * Lists all available tags.
   * @returns {Promise<Array<Object>>} A promise that resolves to an array of tag objects.
   */
  static async listAll() {
    try {
      const tags = await SequelizeTag.findAll({
        attributes: ['id', 'name', 'createdAt'], // Include relevant attributes
        order: [['name', 'ASC']], // Order tags alphabetically by name
        raw: true, // Return plain data objects
      });
      return tags;
    } catch (error) {
      console.error('Error listing all tags:', error);
      throw error;
    }
  }

  /**
   * Creates a new tag if it doesn't already exist.
   * @param {string} name The name of the tag to create.
   * @returns {Promise<Object>} A promise that resolves to the created or found tag object.
   * @throws {Error} If the tag name is missing or if there's a database error.
   */
  static async create(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('Tag name is required and must be a non-empty string.');
    }

    const trimmedName = name.trim();

    try {
      // findOrCreate is excellent for this as it either finds an existing tag or creates a new one
      const [tag, created] = await SequelizeTag.findOrCreate({
        where: { name: trimmedName },
        defaults: { name: trimmedName },
      });

      // Return a clean object for the API response
      const plainTag = tag.get({ plain: true });
      return {
        id: plainTag.id,
        name: plainTag.name,
        createdAt: plainTag.createdAt,
        isNew: created, // Indicate if the tag was newly created
      };
    } catch (error) {
      console.error(`Error creating tag with name "${trimmedName}":`, error);
      throw error;
    }
  }

  /**
   * Deletes a tag by its ID.
   * Also removes its linkage from any artifacts it's a part of if cascade delete is configured.
   * @param {number} id The ID of the tag to delete.
   * @returns {Promise<boolean>} A promise that resolves to true if the tag was deleted, false otherwise.
   * @throws {Error} If the tag ID is invalid or if there's a database error.
   */
  static async delete(id) {
    if (!id || typeof id !== 'number' || id <= 0) {
      throw new Error('Valid tag ID is required for deletion.');
    }

    try {
      // Sequelize's destroy method returns the number of rows deleted.
      // If associations have onDelete: 'CASCADE', linked records will also be removed.
      const deletedRowCount = await SequelizeTag.destroy({
        where: { id: id }
      });
      return deletedRowCount > 0; // True if one or more rows were deleted, false otherwise
    } catch (error) {
      console.error(`Error deleting tag with ID "${id}":`, error);
      throw error;
    }
  }
}

module.exports = Tag;