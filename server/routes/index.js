const express = require('express');
const authRoutes = require('./auth');
const profileRoutes = require('./profile');
const groundsRoutes = require('./grounds');
const bookingsRoutes = require('./bookings');
const adminGroundsRoutes = require('./admin/grounds');
const adminStatsRoutes = require('./admin/stats');

const router = express.Router();

// Public routes
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/grounds', groundsRoutes);
router.use('/bookings', bookingsRoutes);

// Admin routes
router.use('/admin/grounds', adminGroundsRoutes);
router.use('/admin/stats', adminStatsRoutes);

module.exports = router;
