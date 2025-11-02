#!/usr/bin/env node

/**
 * One-time migration script to populate ground images, features, and categories
 * Run this once to update the production database with ground data
 *
 * Usage:
 * node scripts/migrate-ground-data.js
 */

require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '../data');
const dbPath = path.join(dataDir, 'ground-booking.db');

console.log('Connecting to database at:', dbPath);
const db = new Database(dbPath);

try {
  console.log('Starting migration...\n');

  // Update ground categories
  console.log('1. Updating ground categories...');
  const updateCategories = db.prepare('UPDATE grounds SET category = ? WHERE id = ?');

  updateCategories.run('Football', 1);
  updateCategories.run('Cricket', 2);
  updateCategories.run('Football', 3);
  updateCategories.run('Futsal', 4);
  // Ground 5 might already have Cricket

  console.log('   ✓ Categories updated\n');

  // Add images
  console.log('2. Adding ground images...');

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
    console.log('   ✓ ' + groundImages.length + ' images added\n');
  } else {
    console.log('   ✓ Images already exist, skipping\n');
  }

  // Add features
  console.log('3. Adding ground features...');

  const features = db.prepare('SELECT COUNT(*) as count FROM ground_features').get();

  if (features.count === 0) {
    const insertFeature = db.prepare(
      'INSERT INTO ground_features (ground_id, feature_name, feature_value, category) VALUES (?, ?, ?, ?)'
    );

    const groundFeatures = [
      // Ground 1: Karachi United Stadium - Football
      { ground_id: 1, feature_name: 'Flood Lights', category: 'Amenities' },
      { ground_id: 1, feature_name: 'Parking', category: 'Amenities' },
      { ground_id: 1, feature_name: 'Changing Rooms', category: 'Amenities' },
      { ground_id: 1, feature_name: 'Washrooms', category: 'Amenities' },
      { ground_id: 1, feature_name: 'Drinking Water', category: 'Amenities' },
      { ground_id: 1, feature_name: 'Artificial Turf', category: 'Surface' },
      { ground_id: 1, feature_name: 'Open', category: 'Venue Type' },

      // Ground 2: Dreamworld Cricket Arena - Cricket
      { ground_id: 2, feature_name: 'Flood Lights', category: 'Amenities' },
      { ground_id: 2, feature_name: 'Parking', category: 'Amenities' },
      { ground_id: 2, feature_name: 'Cafeteria', category: 'Amenities' },
      { ground_id: 2, feature_name: 'Seating Area', category: 'Amenities' },
      { ground_id: 2, feature_name: 'Drinking Water', category: 'Amenities' },
      { ground_id: 2, feature_name: 'Natural Grass', category: 'Surface' },
      { ground_id: 2, feature_name: 'Covered', category: 'Venue Type' },

      // Ground 3: Lahore Sports Complex - Football/Cricket
      { ground_id: 3, feature_name: 'Flood Lights', category: 'Amenities' },
      { ground_id: 3, feature_name: 'Parking', category: 'Amenities' },
      { ground_id: 3, feature_name: 'Changing Rooms', category: 'Amenities' },
      { ground_id: 3, feature_name: 'Washrooms', category: 'Amenities' },
      { ground_id: 3, feature_name: 'Seating Area', category: 'Amenities' },
      { ground_id: 3, feature_name: 'Artificial Turf', category: 'Surface' },
      { ground_id: 3, feature_name: 'Open', category: 'Venue Type' },

      // Ground 4: Islamabad F6 Community Ground - Futsal
      { ground_id: 4, feature_name: 'Flood Lights', category: 'Amenities' },
      { ground_id: 4, feature_name: 'Parking', category: 'Amenities' },
      { ground_id: 4, feature_name: 'Drinking Water', category: 'Amenities' },
      { ground_id: 4, feature_name: 'Natural Grass', category: 'Surface' },
      { ground_id: 4, feature_name: 'Open', category: 'Venue Type' },

      // Ground 5: Rawalpindi Cricket Club - Cricket
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
    console.log('   ✓ ' + groundFeatures.length + ' features added\n');
  } else {
    console.log('   ✓ Features already exist, skipping\n');
  }

  console.log('✅ Migration completed successfully!\n');
  console.log('Your grounds now have:');
  console.log('  • Categories (Football, Cricket, Futsal)');
  console.log('  • Gallery images (2 per ground)');
  console.log('  • Features & amenities (5-7 per ground)\n');

  db.close();
  process.exit(0);

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  db.close();
  process.exit(1);
}
