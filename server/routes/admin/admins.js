const express = require('express');
const { getDb } = require('../../db');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

// Get all admin users
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const admins = db
      .prepare('SELECT id, email, name, created_at, created_by FROM admin_users ORDER BY created_at DESC')
      .all();

    res.json({ admins });
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

// Create new admin user
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { email, name } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const db = getDb();

    // Check if admin already exists
    const existing = db
      .prepare('SELECT id FROM admin_users WHERE email = ?')
      .get(normalizedEmail);

    if (existing) {
      return res.status(400).json({ error: 'This email is already an admin' });
    }

    // Insert new admin
    const result = db
      .prepare('INSERT INTO admin_users (email, name, created_by) VALUES (?, ?, ?)')
      .run(normalizedEmail, name || null, req.user.email);

    const newAdmin = db
      .prepare('SELECT id, email, name, created_at, created_by FROM admin_users WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(newAdmin);
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// Delete admin user
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const db = getDb();

    // Get admin details before deleting
    const admin = db
      .prepare('SELECT email FROM admin_users WHERE id = ?')
      .get(id);

    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // Prevent deleting yourself
    if (admin.email === req.user.email) {
      return res.status(400).json({ error: 'You cannot remove your own admin access' });
    }

    // Check if this is the last admin
    const adminCount = db
      .prepare('SELECT COUNT(*) as count FROM admin_users')
      .get();

    if (adminCount.count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin user' });
    }

    // Delete the admin
    db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);

    res.json({ message: 'Admin user removed successfully' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ error: 'Failed to delete admin user' });
  }
});

module.exports = router;
