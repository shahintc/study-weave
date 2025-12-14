const User = require('../models/User');

const getBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;
  return Boolean(String(value).toLowerCase() === 'true' || Number(value) === 1);
};

async function ensureDefaultAdmin(logger = console) {
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'caspianculturesociety@gmail.com';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'Caspian';
  const name = process.env.DEFAULT_ADMIN_NAME || 'Caspian Admin';

  if (!email || !password) {
    logger.warn('[admin] DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must be set to seed an admin.');
    return;
  }

  try {
    const existing = await User.findByEmail(email);

    if (!existing) {
      await User.create({
        name,
        email,
        password,
        role: 'admin',
        emailVerified: true,
      });
      logger.log(`[admin] Created default admin account for ${email}`);
      return;
    }

    const isAdmin = existing.role === 'admin';
    const isVerified = getBoolean(existing.emailVerified ?? existing.email_verified);
    const passwordMatches = existing.password
      ? await User.comparePassword(password, existing.password)
      : false;

    if (isAdmin && isVerified && passwordMatches) {
      logger.log(`[admin] Default admin ${email} already configured.`);
      return;
    }

    const updates = {
      role: 'admin',
      emailVerified: true,
    };
    if (!passwordMatches) {
      updates.password = password;
    }
    if (!existing.name) {
      updates.name = name;
    }

    await User.update(existing.id, updates);
    logger.log(`[admin] Updated existing account for ${email} with admin privileges.`);
  } catch (error) {
    logger.error('[admin] Failed to ensure default admin account:', error);
  }
}

module.exports = ensureDefaultAdmin;
