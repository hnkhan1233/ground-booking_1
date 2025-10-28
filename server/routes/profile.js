const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const db = getDb();
  const profile = db
    .prepare('SELECT name, phone, updated_at FROM user_profiles WHERE user_uid = ?')
    .get(req.user.uid);

  if (!profile) {
    return res.status(404).json({ error: 'Profile not found.' });
  }

  res.json({
    name: profile.name,
    phone: profile.phone,
    updatedAt: profile.updated_at,
    email: req.user.email ?? null,
  });
});

router.put('/', authenticate, (req, res) => {
  const db = getDb();
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';

  if (!name || !phone) {
    return res.status(400).json({ error: 'Name and phone are required.' });
  }

  db.prepare(
    `INSERT INTO user_profiles (user_uid, name, phone, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_uid) DO UPDATE SET
       name = excluded.name,
       phone = excluded.phone,
       updated_at = CURRENT_TIMESTAMP`
  ).run(req.user.uid, name, phone);

  const saved = db
    .prepare('SELECT name, phone, updated_at FROM user_profiles WHERE user_uid = ?')
    .get(req.user.uid);

  res.json({
    name: saved.name,
    phone: saved.phone,
    updatedAt: saved.updated_at,
  });
});

module.exports = router;
