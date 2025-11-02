const { getAuth } = require('../firebase');
const { getDb } = require('../db');

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function isAdminUser(user) {
  if (!user) {
    return false;
  }
  if (user.admin === true || user.role === 'admin') {
    return true;
  }
  const email = normalizeEmail(user.email);
  if (!email) {
    return false;
  }

  // Check environment variables (legacy)
  if (ADMIN_EMAILS.includes(email)) {
    return true;
  }

  // Check database
  try {
    const db = getDb();
    const admin = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(email);
    return admin !== undefined;
  } catch (error) {
    console.error('Error checking admin status from database:', error);
    return false;
  }
}

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication token missing.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    console.error('Firebase auth error:', error.message);
    if (error.message && error.message.includes('Firebase credentials are missing')) {
      return res.status(500).json({ error: 'Authentication is not configured on the server.' });
    }
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin privileges required.' });
  }

  return next();
}

module.exports = {
  authenticate,
  requireAdmin,
  isAdminUser,
};
