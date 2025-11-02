const express = require('express');
const authRoutes = require('./auth');
const profileRoutes = require('./profile');
const groundsRoutes = require('./grounds');
const bookingsRoutes = require('./bookings');
const operatingHoursRoutes = require('./operating-hours');
const adminGroundsRoutes = require('./admin/grounds');
const adminStatsRoutes = require('./admin/stats');
const adminUsersRoutes = require('./admin/admins');

const router = express.Router();

// Public routes
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/grounds', groundsRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/operating-hours', operatingHoursRoutes);

// Admin routes
router.use('/admin/grounds', adminGroundsRoutes);
router.use('/admin/stats', adminStatsRoutes);
router.use('/admin/admins', adminUsersRoutes);

module.exports = router;
