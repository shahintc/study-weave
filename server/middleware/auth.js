const jwt = require('jsonwebtoken');

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

module.exports = (req, res, next) => {
  try {
    const rawHeader = req.headers.authorization || req.headers.Authorization;
    const token = getTokenFromHeader(rawHeader);

    if (!token) {
      return res.status(401).json({ message: 'Authorization token missing.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      roleId: decoded.roleId,
    };

    return next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired authorization token.' });
  }
};
