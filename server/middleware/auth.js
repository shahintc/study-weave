const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getTokenFromHeader = (headerValue) => {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }
  const [scheme, token] = headerValue.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
};

module.exports = async (req, res, next) => {
  try {
    const rawHeader = req.headers.authorization || req.headers.Authorization;
    const token = getTokenFromHeader(rawHeader);

    if (!token) {
      return res.status(401).json({ message: 'Authorization token missing.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') || {};
    const role = typeof decoded.role === 'string' ? decoded.role : null;

    let userPayload = {
      id: decoded.userId,
      email: decoded.email,
      role,
      roleId: decoded.roleId,
      guestSessionId: decoded.guestSessionId,
    };

    if (role === 'guest') {
      const user = await User.findById(decoded.userId);
      if (
        !user ||
        !user.isGuest ||
        !user.guestSessionId ||
        user.guestSessionId !== decoded.guestSessionId
      ) {
        return res.status(401).json({ message: 'Guest session is invalid. Please log in again.' });
      }
      const expiresAt = user.guestExpiresAt || user.guest_expires_at;
      if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
        return res.status(401).json({ message: 'Guest session expired. Please log in again.' });
      }
      userPayload = {
        ...userPayload,
        email: user.email,
        roleId: user.roleId,
        guestExpiresAt: expiresAt,
      };
    }

    req.user = userPayload;

    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: 'Invalid or expired authorization token.' });
  }
};
