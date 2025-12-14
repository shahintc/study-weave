const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const multer = require('multer');
const pool = require('../config/database');
const User = require('../models/User');
const { sendEmail, isEmailConfigured } = require('../services/emailService');
const auth = require('../middleware/auth');
const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin privileges are required for this action.' });
  }
  return next();
};

const PASSWORD_POLICY = /^(?=.*[A-Z]).{6,}$/;
const CODE_TTL_MINUTES = 15;
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  roleId: user.roleId,
  avatarUrl: user.avatarUrl || null,
  isGuest: Boolean(user.isGuest ?? user.is_guest),
  guestSessionId: user.guestSessionId || user.guest_session_id || null,
  guestExpiresAt: user.guestExpiresAt || user.guest_expires_at || null,
  emailVerified: Boolean(user.emailVerified ?? user.email_verified),
  createdAt: user.created_at || user.createdAt,
});

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));
const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');
const expiresAt = (minutes) => new Date(Date.now() + minutes * 60 * 1000);
const isExpired = (date) => !date || new Date(date).getTime() < Date.now();

const requirePasswordPolicy = (password) => PASSWORD_POLICY.test(password);

const avatarUploadDir = path.join(__dirname, '../uploads/avatars');
const avatarStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(avatarUploadDir, { recursive: true });
      cb(null, avatarUploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.png';
    const safeExt = ext.slice(0, 10).toLowerCase() || '.png';
    const unique = `${req.user?.id || 'avatar'}-${Date.now()}${safeExt}`;
    cb(null, unique);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: AVATAR_MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    cb(new Error('Only image uploads are allowed.'));
  },
});

const handleAvatarUpload = (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (error) => {
    if (error) {
      const status = error.message && error.message.toLowerCase().includes('file too large') ? 413 : 400;
      return res.status(status).json({ message: error.message || 'Failed to upload avatar.' });
    }
    next();
  });
};

// Register (sends verification code)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, roleId } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (!requirePasswordPolicy(password)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters and include one uppercase letter.',
      });
    }

    if (!isEmailConfigured()) {
      return res.status(500).json({
        message: 'Email is not configured on the server. Configure SMTP to enable registration.',
      });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const code = generateCode();
    const user = await User.create({
      name,
      email,
      password,
      role,
      roleId,
      emailVerified: false,
      verificationCode: hashCode(code),
      verificationExpires: expiresAt(CODE_TTL_MINUTES),
    });

    await sendEmail({
      to: email,
      subject: 'Verify your StudyWeave account',
      text: `Your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    });

    res.status(201).json({
      message: 'Verification code sent to your email.',
      requiresVerification: true,
      email: user.email,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Request password reset (code)
router.post('/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }
    if (!isEmailConfigured()) {
      return res.status(500).json({
        message: 'Email is not configured on the server. Configure SMTP to reset passwords.',
      });
    }
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        message: 'We could not find an account with that email address.',
      });
    }

    const code = generateCode();
    await User.update(user.id, {
      resetCode: hashCode(code),
      resetExpires: expiresAt(CODE_TTL_MINUTES),
    });

    await sendEmail({
      to: email,
      subject: 'Reset your StudyWeave password',
      text: `Your password reset code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    });

    res.json({ message: 'If an account exists for this email, a reset code was sent.' });
  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({ message: 'Server error while requesting reset' });
  }
});

// Reset password with code
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, password } = req.body;
    if (!email || !code || !password) {
      return res.status(400).json({ message: 'Email, code, and new password are required.' });
    }
    if (password === code || password === email) {
      return res.status(400).json({ message: 'New password cannot be the same as your current credentials.' });
    }
    if (!requirePasswordPolicy(password)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters and include one uppercase letter.',
      });
    }
    const user = await User.findByEmail(email);
    if (!user || !user.resetCode) {
      return res.status(400).json({ message: 'Invalid reset request.' });
    }
    const sameAsOld = await User.comparePassword(password, user.password);
    if (sameAsOld) {
      return res.status(400).json({ message: 'New password must be different from your current password.' });
    }
    if (isExpired(user.resetExpires)) {
      return res.status(400).json({ message: 'Reset code expired. Request a new one.' });
    }
    const hashed = hashCode(code);
    if (hashed !== user.resetCode) {
      return res.status(400).json({ message: 'Invalid reset code.' });
    }

    await User.update(user.id, {
      password,
      resetCode: null,
      resetExpires: null,
    });

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error while resetting password' });
  }
});

// Verify email with code
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required.' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid verification request.' });
    }

    if (user.emailVerified) {
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, roleId: user.roleId },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '24h' },
      );
      return res.json({ message: 'Email already verified.', token, user: sanitizeUser(user) });
    }

    if (!user.verificationCode || isExpired(user.verificationExpires)) {
      return res.status(400).json({ message: 'Verification code is expired. Request a new one.' });
    }

    const hashed = hashCode(code);
    if (hashed !== user.verificationCode) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    const updatedUser = await User.update(user.id, {
      emailVerified: true,
      verificationCode: null,
      verificationExpires: null,
    });

    const token = jwt.sign(
      { userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role, roleId: updatedUser.roleId },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' },
    );

    res.json({
      message: 'Email verified successfully.',
      token,
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
});

// Resend verification code
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }
    if (!isEmailConfigured()) {
      return res.status(500).json({
        message: 'Email is not configured on the server. Configure SMTP to resend codes.',
      });
    }
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(200).json({ message: 'If the account exists, a code was sent.' });
    }
    if (user.emailVerified) {
      return res.status(200).json({ message: 'Email is already verified.' });
    }
    const code = generateCode();
    await User.update(user.id, {
      verificationCode: hashCode(code),
      verificationExpires: expiresAt(CODE_TTL_MINUTES),
    });
    await sendEmail({
      to: email,
      subject: 'Your new StudyWeave verification code',
      text: `Your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    });
    res.json({ message: 'Verification code sent.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error while resending code' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // verify password
    const isMatch = await User.comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: 'Email not verified. Please verify your email before logging in.',
        requiresVerification: true,
        email,
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, roleId: user.roleId },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Guest Login
router.post('/guest-login', async (req, res) => {
  try {
    const guestSessionId = crypto.randomBytes(16).toString('hex');
    const guestExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    
    const user = await User.create({
      name: `Guest ${randomSuffix}`,
      role: 'guest',
      isGuest: true,
      guestSessionId,
      guestExpiresAt,
      emailVerified: true, // Guests don't verify email
      email: null,
      password: null,
    });

    const token = jwt.sign(
      { userId: user.id, role: 'guest', guestSessionId },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '4h' }
    );

    res.json({
      message: 'Guest login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Guest login error:', error);
    res.status(500).json({ message: 'Server error during guest login' });
  }
});

// Get current user (requires auth)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error('Get /me error:', error);
    return res.status(500).json({ message: 'Server error while fetching profile' });
  }
});

// Change password (requires auth)
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'New password must be different from the current password.' });
    }
    if (!requirePasswordPolicy(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters and include one uppercase letter.',
      });
    }

    const user = await User.findByIdWithPassword(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await User.comparePassword(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    await User.update(user.id, { password: newPassword });
    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Server error while changing password' });
  }
});

// Upload or replace avatar (requires auth)
router.post('/avatar', auth, handleAvatarUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No avatar file uploaded.' });
    }

    const existing = await User.findById(req.user.id);
    if (!existing) {
      return res.status(404).json({ message: 'User not found' });
    }

    const relativePath = `/uploads/avatars/${req.file.filename}`;

    if (existing.avatarUrl && existing.avatarUrl !== relativePath) {
      const previousPath = path.join(__dirname, '..', existing.avatarUrl.replace(/^\//, ''));
      await fs.unlink(previousPath).catch(() => {});
    }

    const updatedUser = await User.update(existing.id, { avatarUrl: relativePath });
    return res.json({
      message: 'Avatar updated successfully.',
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ message: 'Failed to update avatar.' });
  }
});

// Remove avatar (requires auth)
router.delete('/avatar', auth, async (req, res) => {
  try {
    const existing = await User.findById(req.user.id);
    if (!existing) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (existing.avatarUrl) {
      const previousPath = path.join(__dirname, '..', existing.avatarUrl.replace(/^\//, ''));
      await fs.unlink(previousPath).catch(() => {});
    }

    const updatedUser = await User.update(existing.id, { avatarUrl: null });
    return res.json({
      message: 'Avatar removed successfully.',
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    console.error('Avatar remove error:', error);
    return res.status(500).json({ message: 'Failed to remove avatar.' });
  }
});

// Delete own account (requires auth)
router.delete('/account', auth, async (req, res) => {
  try {
    const existing = await User.findById(req.user.id);
    if (!existing) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (existing.avatarUrl) {
      const previousPath = path.join(__dirname, '..', existing.avatarUrl.replace(/^\//, ''));
      await fs.unlink(previousPath).catch(() => {});
    }

    // Anonymize user instead of hard delete to preserve study/assessment data
    const placeholderEmail = `deleted+${existing.id}@example.com`;
    const randomPassword = crypto.randomBytes(32).toString('hex');

    const updated = await User.update(existing.id, {
      name: 'Deleted User',
      email: placeholderEmail,
      avatarUrl: null,
      password: randomPassword, // hashed inside model
    });

    return res.json({
      message: 'Account deleted successfully. User data retained as anonymized record.',
      user: sanitizeUser(updated),
    });
  } catch (error) {
    console.error('Account delete error:', error);
    return res.status(500).json({ message: 'Failed to delete account.' });
  }
});

// Update User
router.put('/update', async (req, res) => {
  try {
    const { id, name, email, password, role, roleId } = req.body;

    if (password && !requirePasswordPolicy(password)) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters and include one uppercase letter.',
      });
    }

    const updatedUser = await User.update(id, { name, email, password, role, roleId });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Server error during update' });
  }
});

// Delete User
router.delete('/delete', async (req, res) => {
  try {
    const { id } = req.body;

    const deletedUser = await User.delete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Server error during deletion' });
  }
});

// getting all users 
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const parsedPage = parseInt(req.query.page, 10);
    const parsedPageSize = parseInt(req.query.pageSize, 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const rawPageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 10;
    const pageSize = Math.min(rawPageSize, 50);
    const searchTerm = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const rawRoleFilter = typeof req.query.role === 'string' ? req.query.role.trim() : '';
    const normalizedRole = rawRoleFilter && rawRoleFilter.toLowerCase() !== 'all'
      ? rawRoleFilter.toLowerCase()
      : '';

    const filters = [];
    const params = [];

    if (searchTerm) {
      const idxName = params.push(`%${searchTerm}%`);
      const idxEmail = params.push(`%${searchTerm}%`);
      filters.push(`(name ILIKE $${idxName} OR email ILIKE $${idxEmail})`);
    }

    if (normalizedRole) {
      const idxRole = params.push(normalizedRole);
      filters.push(`LOWER(role) = $${idxRole}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countQuery = `SELECT COUNT(*)::int AS total FROM users ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = Number(countResult.rows?.[0]?.total || 0);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    const offset = Math.max((page - 1) * pageSize, 0);

    const dataParams = [...params];
    const limitIndex = dataParams.push(pageSize);
    const offsetIndex = dataParams.push(offset);
    const dataQuery = `
      SELECT id, name, email, role, role_id AS "roleId", created_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `;
    const result = await pool.query(dataQuery, dataParams);

    const hasRows = result.rows.length > 0;
    const from = hasRows ? offset + 1 : 0;
    const to = hasRows ? offset + result.rows.length : 0;

    res.json({
      message: 'Users fetched successfully',
      users: result.rows,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page * pageSize < total,
        from,
        to,
      },
      filters: {
        search: searchTerm,
        role: normalizedRole || 'all',
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
});

//getting user by id
// router.get('/users/:id', async (req, res) => {
//   try {
//     const userId = req.params.id;        // id is the 1st element so: $1
//     const query = 'SELECT * FROM users WHERE id = $1';      //return only one row where the user is so row[0]
//     const result = await pool.query(query, [userId]); 
    
//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: `User with id=${userId} not found` });
//     }
//     res.json({
//       message: `User with id=${userId} fetched successfully`,
//       user: result.rows[0],
//     });
//   } catch (error) {
//     console.error(`Error fetching user id=${req.params.id}:`, error);
//     res.status(500).json({ message: 'Server error while fetching user' });
//   }
// });


// Add this new code block right before "module.exports = router;"

// GET request to fetch *only* participants
router.get('/participants', async (req, res) => {
  try {
    // This is the SQL query you need
    const query = "SELECT id, name, email, role, created_at FROM users WHERE role = 'participant' ORDER BY created_at DESC";
    
    // We use the 'pool' variable that is already defined at the top of your file
    const result = await pool.query(query); 
    
    // Send the data back as JSON  
    res.json({
      message: 'Participants fetched successfully',
      users: result.rows
    });
    

  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({ message: 'Server error while fetching participants' });
  }
});

router.put('/update-role/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params; // Get the ID from the URL

    // This is the SQL query to *swap* the role
    // It uses a CASE statement to be efficient
    const query = `
      UPDATE users 
      SET role = CASE
        WHEN role = 'participant' THEN 'researcher'
        ELSE 'participant'
      END
      WHERE id = $1
      RETURNING id, name, email, role;
    `;
    
    // We use the 'pool' variable, just like your other routes
    const result = await pool.query(query, [id]); 

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Send the *updated* user back to the frontend
    res.json({
      message: 'User role updated successfully',
      user: result.rows[0] 
    });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Server error while updating role' });
  }
});

module.exports = router;
