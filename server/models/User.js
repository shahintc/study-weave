const bcrypt = require('bcrypt');
const SequelizeUser = require('../sequelize-models/user');

class User {
  static async create(userData) {
    const { name, email, password, role, roleId, avatarUrl, ...rest } = userData;
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const user = await SequelizeUser.create({
      name,
      email,
      password: hashedPassword,
      role,
      roleId,
      avatarUrl,
      ...rest,
    });
    const plain = user.get({ plain: true });
    return {
      id: plain.id,
      name: plain.name,
      email: plain.email,
      role: plain.role,
      roleId: plain.roleId,
      avatarUrl: plain.avatarUrl,
      emailVerified: plain.emailVerified,
      isGuest: plain.isGuest,
      guestSessionId: plain.guestSessionId,
      guestExpiresAt: plain.guestExpiresAt,
      created_at: plain.created_at,
    };
  }

  static async findByEmail(email) {
    const user = await SequelizeUser.findOne({ where: { email }, raw: true });
    return user || null;
  }

  static async findById(id) {
    const user = await SequelizeUser.findByPk(id, {
      attributes: [
        'id',
        'name',
        'email',
        'role',
        'roleId',
        'avatarUrl',
        'created_at',
        'emailVerified',
        'isGuest',
        'guestSessionId',
        'guestExpiresAt',
      ],
      raw: true,
    });
    return user || null;
  }

  static async findByIdWithPassword(id) {
    const user = await SequelizeUser.findByPk(id, { raw: true });
    return user || null;
  }

  static async update(id, updates) {
    const {
      name,
      email,
      password,
      role,
      roleId,
      avatarUrl,
      emailVerified,
      verificationCode,
      verificationExpires,
      resetCode,
      resetExpires,
      isGuest,
      guestSessionId,
      guestExpiresAt,
    } = updates;
    const user = await SequelizeUser.findByPk(id);
    if (!user) return null;
    if (typeof name !== 'undefined') user.name = name;
    if (typeof email !== 'undefined') user.email = email;
    if (typeof role !== 'undefined') user.role = role;
    if (typeof roleId !== 'undefined') user.roleId = roleId;
    if (typeof avatarUrl !== 'undefined') user.avatarUrl = avatarUrl;
    if (typeof emailVerified !== 'undefined') user.emailVerified = emailVerified;
    if (typeof verificationCode !== 'undefined') user.verificationCode = verificationCode;
    if (typeof verificationExpires !== 'undefined') user.verificationExpires = verificationExpires;
    if (typeof resetCode !== 'undefined') user.resetCode = resetCode;
    if (typeof resetExpires !== 'undefined') user.resetExpires = resetExpires;
    if (typeof isGuest !== 'undefined') user.isGuest = isGuest;
    if (typeof guestSessionId !== 'undefined') user.guestSessionId = guestSessionId;
    if (typeof guestExpiresAt !== 'undefined') user.guestExpiresAt = guestExpiresAt;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }
    const saved = await user.save();
    const plain = saved.get({ plain: true });
    return {
      id: plain.id,
      name: plain.name,
      email: plain.email,
      role: plain.role,
      roleId: plain.roleId,
      avatarUrl: plain.avatarUrl,
      emailVerified: plain.emailVerified,
      created_at: plain.created_at,
      isGuest: plain.isGuest,
      guestSessionId: plain.guestSessionId,
      guestExpiresAt: plain.guestExpiresAt,
    };
  }

  static async delete(id) {
    const count = await SequelizeUser.destroy({ where: { id } });
    return count ? { id } : null;
  }

  static async comparePassword(plainPassword, hashedPassword) {
    if (!hashedPassword) {
      return false;
    }
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;
