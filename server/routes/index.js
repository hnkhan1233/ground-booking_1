const express = require('express');
const authRoutes = require('./auth');
const profileRoutes = require('./profile');
const groundsRoutes = require('./grounds');
const bookingsRoutes = require('./bookings');
const operatingHoursRoutes = require('./operating-hours');
const adminGroundsRoutes = require('./admin/grounds');
const adminStatsRoutes = require('./admin/stats');
const adminUsersRoutes = require('./admin/admins');
const { getDb } = require('../db');

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

// One-time migration endpoint
router.post('/migrate-ground-data', (req, res) => {
  // Verify secret header to prevent unauthorized access
  const secret = req.headers['x-migrate-secret'];
  if (secret !== process.env.MIGRATE_SECRET || !process.env.MIGRATE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = getDb();

    // Update ground categories
    const updateCategories = db.prepare('UPDATE grounds SET category = ? WHERE id = ?');
    updateCategories.run('Football', 1);
    updateCategories.run('Cricket', 2);
    updateCategories.run('Football', 3);
    updateCategories.run('Futsal', 4);

    // Add images if they don't exist
    const images = db.prepare('SELECT COUNT(*) as count FROM ground_images').get();

    if (images.count === 0) {
      const insertImage = db.prepare(
        'INSERT INTO ground_images (ground_id, image_url, display_order, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
      );

      const groundImages = [
        { ground_id: 1, image_url: 'https://images.pexels.com/photos/46798/pexels-photo-46798.jpeg', display_order: 0 },
        { ground_id: 1, image_url: 'https://images.pexels.com/photos/3945683/pexels-photo-3945683.jpeg', display_order: 1 },
        { ground_id: 2, image_url: 'https://images.pexels.com/photos/1380613/pexels-photo-1380613.jpeg', display_order: 0 },
        { ground_id: 2, image_url: 'https://images.pexels.com/photos/159937/cricket-field-cricket-sport-sports-159937.jpeg', display_order: 1 },
        { ground_id: 3, image_url: 'https://images.pexels.com/photos/3991878/pexels-photo-3991878.jpeg', display_order: 0 },
        { ground_id: 3, image_url: 'https://images.pexels.com/photos/209977/football-pitch-football-field-sports-209977.jpeg', display_order: 1 },
        { ground_id: 4, image_url: 'https://images.pexels.com/photos/1345834/pexels-photo-1345834.jpeg', display_order: 0 },
        { ground_id: 4, image_url: 'https://images.pexels.com/photos/47730/the-ball-sports-football-grass-47730.jpeg', display_order: 1 },
        { ground_id: 5, image_url: 'https://images.pexels.com/photos/4219/sport-competition-stadium-field.jpg', display_order: 0 },
        { ground_id: 5, image_url: 'https://images.pexels.com/photos/159937/cricket-field-cricket-sport-sports-159937.jpeg', display_order: 1 },
      ];

      const transaction = db.transaction((imgs) => {
        for (const img of imgs) {
          insertImage.run(img.ground_id, img.image_url, img.display_order);
        }
      });

      transaction(groundImages);
    }

    // Add features if they don't exist
    const features = db.prepare('SELECT COUNT(*) as count FROM ground_features').get();

    if (features.count === 0) {
      const insertFeature = db.prepare(
        'INSERT INTO ground_features (ground_id, feature_name, feature_value, category) VALUES (?, ?, ?, ?)'
      );

      const groundFeatures = [
        { ground_id: 1, feature_name: 'Flood Lights', category: 'Amenities' },
        { ground_id: 1, feature_name: 'Parking', category: 'Amenities' },
        { ground_id: 1, feature_name: 'Changing Rooms', category: 'Amenities' },
        { ground_id: 1, feature_name: 'Washrooms', category: 'Amenities' },
        { ground_id: 1, feature_name: 'Drinking Water', category: 'Amenities' },
        { ground_id: 1, feature_name: 'Artificial Turf', category: 'Surface' },
        { ground_id: 1, feature_name: 'Open', category: 'Venue Type' },
        { ground_id: 2, feature_name: 'Flood Lights', category: 'Amenities' },
        { ground_id: 2, feature_name: 'Parking', category: 'Amenities' },
        { ground_id: 2, feature_name: 'Cafeteria', category: 'Amenities' },
        { ground_id: 2, feature_name: 'Seating Area', category: 'Amenities' },
        { ground_id: 2, feature_name: 'Drinking Water', category: 'Amenities' },
        { ground_id: 2, feature_name: 'Natural Grass', category: 'Surface' },
        { ground_id: 2, feature_name: 'Covered', category: 'Venue Type' },
        { ground_id: 3, feature_name: 'Flood Lights', category: 'Amenities' },
        { ground_id: 3, feature_name: 'Parking', category: 'Amenities' },
        { ground_id: 3, feature_name: 'Changing Rooms', category: 'Amenities' },
        { ground_id: 3, feature_name: 'Washrooms', category: 'Amenities' },
        { ground_id: 3, feature_name: 'Seating Area', category: 'Amenities' },
        { ground_id: 3, feature_name: 'Artificial Turf', category: 'Surface' },
        { ground_id: 3, feature_name: 'Open', category: 'Venue Type' },
        { ground_id: 4, feature_name: 'Flood Lights', category: 'Amenities' },
        { ground_id: 4, feature_name: 'Parking', category: 'Amenities' },
        { ground_id: 4, feature_name: 'Drinking Water', category: 'Amenities' },
        { ground_id: 4, feature_name: 'Natural Grass', category: 'Surface' },
        { ground_id: 4, feature_name: 'Open', category: 'Venue Type' },
        { ground_id: 5, feature_name: 'Flood Lights', category: 'Amenities' },
        { ground_id: 5, feature_name: 'Parking', category: 'Amenities' },
        { ground_id: 5, feature_name: 'Cafeteria', category: 'Amenities' },
        { ground_id: 5, feature_name: 'Drinking Water', category: 'Amenities' },
        { ground_id: 5, feature_name: 'Concrete', category: 'Surface' },
        { ground_id: 5, feature_name: 'Partially Covered', category: 'Venue Type' },
      ];

      const transaction = db.transaction((feats) => {
        for (const feat of feats) {
          insertFeature.run(feat.ground_id, feat.feature_name, null, feat.category);
        }
      });

      transaction(groundFeatures);
    }

    res.json({
      success: true,
      message: 'Migration completed successfully',
      details: {
        categories: 'Updated for grounds 1-4',
        images: `Added ${images.count === 0 ? 10 : 0} gallery images`,
        features: `Added ${features.count === 0 ? 31 : 0} amenities and features`,
      },
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Migration failed: ' + error.message });
  }
});

module.exports = router;
