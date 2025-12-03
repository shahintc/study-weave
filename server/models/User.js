const bcrypt = require('bcrypt');
const SequelizeUser = require('../sequelize-models/user');

class User {
  static async create(userData) {
    const { name, email, password, role, roleId, ...rest } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await SequelizeUser.create({
      name,
      email,
      password: hashedPassword,
      role,
      roleId,
      ...rest,
    });
    const plain = user.get({ plain: true });
    return {
      id: plain.id,
      name: plain.name,
      email: plain.email,
      role: plain.role,
      roleId: plain.roleId,
      emailVerified: plain.emailVerified,
      created_at: plain.created_at,
    };
  }

  static async findByEmail(email) {
    const user = await SequelizeUser.findOne({ where: { email }, raw: true });
    return user || null;
  }

  static async findById(id) {
    const user = await SequelizeUser.findByPk(id, {
      attributes: ['id', 'name', 'email', 'role', 'roleId', 'created_at', 'emailVerified'],
      raw: true,
    });
    return user || null;
  }

  static async update(id, updates) {
    const {
      name,
      email,
      password,
      role,
      roleId,
      emailVerified,
      verificationCode,
      verificationExpires,
      resetCode,
      resetExpires,
    } = updates;
    const user = await SequelizeUser.findByPk(id);
    if (!user) return null;
    if (typeof name !== 'undefined') user.name = name;
    if (typeof email !== 'undefined') user.email = email;
    if (typeof role !== 'undefined') user.role = role;
    if (typeof roleId !== 'undefined') user.roleId = roleId;
    if (typeof emailVerified !== 'undefined') user.emailVerified = emailVerified;
    if (typeof verificationCode !== 'undefined') user.verificationCode = verificationCode;
    if (typeof verificationExpires !== 'undefined') user.verificationExpires = verificationExpires;
    if (typeof resetCode !== 'undefined') user.resetCode = resetCode;
    if (typeof resetExpires !== 'undefined') user.resetExpires = resetExpires;
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
      emailVerified: plain.emailVerified,
    };
  }

  static async delete(id) {
    const count = await SequelizeUser.destroy({ where: { id } });
    return count ? { id } : null;
  }

  static async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = User;
