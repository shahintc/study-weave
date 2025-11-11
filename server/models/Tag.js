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
}

module.exports = Tag;