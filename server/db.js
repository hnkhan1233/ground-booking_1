const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let dbInstance;

function initDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.join(__dirname, 'data');
  const dbPath = path.join(dataDir, 'ground-booking.db');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS grounds (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        location TEXT NOT NULL,
        price_per_hour REAL NOT NULL,
        description TEXT,
        image_url TEXT
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ground_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        slot TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        user_uid TEXT,
        status TEXT NOT NULL DEFAULT 'CONFIRMED',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ground_id) REFERENCES grounds(id)
      )`
    )
    .run();

  try {
    dbInstance.prepare('ALTER TABLE bookings ADD COLUMN user_uid TEXT').run();
  } catch (error) {
    if (!/duplicate column/i.test(error.message)) {
      throw error;
    }
  }

  try {
    dbInstance.prepare('ALTER TABLE bookings ADD COLUMN price_at_booking REAL').run();
  } catch (error) {
    if (!/duplicate column/i.test(error.message)) {
      throw error;
    }
  }

  // Add new columns to grounds table for additional features
  try {
    dbInstance.prepare('ALTER TABLE grounds ADD COLUMN surface_type TEXT').run();
  } catch (error) {
    if (!/duplicate column/i.test(error.message)) {
      throw error;
    }
  }

  try {
    dbInstance.prepare('ALTER TABLE grounds ADD COLUMN capacity INTEGER').run();
  } catch (error) {
    if (!/duplicate column/i.test(error.message)) {
      throw error;
    }
  }

  try {
    dbInstance.prepare('ALTER TABLE grounds ADD COLUMN dimensions TEXT').run();
  } catch (error) {
    if (!/duplicate column/i.test(error.message)) {
      throw error;
    }
  }

  try {
    dbInstance.prepare('ALTER TABLE grounds ADD COLUMN category TEXT').run();
  } catch (error) {
    if (!/duplicate column/i.test(error.message)) {
      throw error;
    }
  }

  // Create ground_images table for multiple images
  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS ground_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ground_id INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ground_id) REFERENCES grounds(id) ON DELETE CASCADE
      )`
    )
    .run();

  // Create ground_features table
  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS ground_features (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ground_id INTEGER NOT NULL,
        feature_name TEXT NOT NULL,
        feature_value TEXT,
        category TEXT,
        FOREIGN KEY (ground_id) REFERENCES grounds(id) ON DELETE CASCADE
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_profiles (
        user_uid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();

  // Create ground_operating_hours table for day-wise time slots
  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS ground_operating_hours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ground_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        slot_duration_minutes INTEGER DEFAULT 60,
        is_closed BOOLEAN DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ground_id, day_of_week),
        FOREIGN KEY (ground_id) REFERENCES grounds(id) ON DELETE CASCADE
      )`
    )
    .run();

  seedGrounds(dbInstance);
  seedOperatingHours(dbInstance);
  seedGroundImages(dbInstance);
  seedGroundFeatures(dbInstance);

  return dbInstance;
}

function seedGrounds(db) {
  const existingGrounds = db.prepare('SELECT COUNT(*) AS count FROM grounds').get();

  if (existingGrounds.count > 0) {
    return;
  }

  const grounds = [
    {
      id: 1,
      name: 'Karachi United Stadium',
      city: 'Karachi',
      location: 'Clifton Block 5',
      price_per_hour: 12000,
      description:
        'Full-size floodlit football ground with synthetic turf and excellent changing facilities.',
      image_url:
        'https://images.pexels.com/photos/46798/pexels-photo-46798.jpeg',
      category: 'Football',
    },
    {
      id: 2,
      name: 'Dreamworld Cricket Arena',
      city: 'Karachi',
      location: 'Gadap Town, Super Highway',
      price_per_hour: 18000,
      description:
        'Premium cricket ground ideal for night matches with LED lighting and turf wicket.',
      image_url:
        'https://images.pexels.com/photos/1380613/pexels-photo-1380613.jpeg',
      category: 'Cricket',
    },
    {
      id: 3,
      name: 'Lahore Sports Complex',
      city: 'Lahore',
      location: 'Gaddafi Stadium vicinity',
      price_per_hour: 15000,
      description:
        'Multipurpose ground for football and cricket with dedicated seating and parking.',
      image_url:
        'https://images.pexels.com/photos/3991878/pexels-photo-3991878.jpeg',
      category: 'Football',
    },
    {
      id: 4,
      name: 'Islamabad F6 Community Ground',
      city: 'Islamabad',
      location: 'Sector F-6/2',
      price_per_hour: 9000,
      description:
        'Community-run ground best suited for football and futsal matches, grass surface.',
      image_url:
        'https://images.pexels.com/photos/1345834/pexels-photo-1345834.jpeg',
      category: 'Futsal',
    },
    {
      id: 5,
      name: 'Rawalpindi Cricket Club',
      city: 'Rawalpindi',
      location: 'Peshawar Road',
      price_per_hour: 11000,
      description:
        'Box cricket friendly facility with practice nets and indoor lounge for teams.',
      image_url:
        'https://images.pexels.com/photos/4219/sport-competition-stadium-field.jpg',
      category: 'Cricket',
    },
  ];

  const insert = db.prepare(
    `INSERT INTO grounds (id, name, city, location, price_per_hour, description, image_url, category)
     VALUES (@id, @name, @city, @location, @price_per_hour, @description, @image_url, @category)`
  );

  const insertMany = db.transaction((groundsList) => {
    for (const ground of groundsList) {
      insert.run(ground);
    }
  });

  insertMany(grounds);
}

function seedOperatingHours(db) {
  // Default operating hours for all grounds: 6 AM to 11 PM, 1-hour slots, Open all days
  const existingHours = db.prepare('SELECT COUNT(*) AS count FROM ground_operating_hours').get();

  if (existingHours.count > 0) {
    return;
  }

  const grounds = db.prepare('SELECT id FROM grounds').all();
  const defaultStartTime = '06:00';
  const defaultEndTime = '23:00';
  const defaultSlotDuration = 60;

  // Days: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
  grounds.forEach((ground) => {
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      db.prepare(
        `INSERT INTO ground_operating_hours
        (ground_id, day_of_week, start_time, end_time, slot_duration_minutes, is_closed)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(ground_id, day_of_week) DO UPDATE SET
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        slot_duration_minutes = excluded.slot_duration_minutes,
        is_closed = excluded.is_closed`
      ).run(ground.id, dayOfWeek, defaultStartTime, defaultEndTime, defaultSlotDuration, 0);
    }
  });
}

function seedGroundImages(db) {
  // Check if images already exist
  const existingImages = db.prepare('SELECT COUNT(*) AS count FROM ground_images').get();

  if (existingImages.count > 0) {
    return;
  }

  const groundImages = [
    {
      ground_id: 1,
      image_url: 'https://images.pexels.com/photos/46798/pexels-photo-46798.jpeg',
      display_order: 0,
    },
    {
      ground_id: 1,
      image_url: 'https://images.pexels.com/photos/3945683/pexels-photo-3945683.jpeg',
      display_order: 1,
    },
    {
      ground_id: 2,
      image_url: 'https://images.pexels.com/photos/1380613/pexels-photo-1380613.jpeg',
      display_order: 0,
    },
    {
      ground_id: 2,
      image_url: 'https://images.pexels.com/photos/159937/cricket-field-cricket-sport-sports-159937.jpeg',
      display_order: 1,
    },
    {
      ground_id: 3,
      image_url: 'https://images.pexels.com/photos/3991878/pexels-photo-3991878.jpeg',
      display_order: 0,
    },
    {
      ground_id: 3,
      image_url: 'https://images.pexels.com/photos/209977/football-pitch-football-field-sports-209977.jpeg',
      display_order: 1,
    },
    {
      ground_id: 4,
      image_url: 'https://images.pexels.com/photos/1345834/pexels-photo-1345834.jpeg',
      display_order: 0,
    },
    {
      ground_id: 4,
      image_url: 'https://images.pexels.com/photos/47730/the-ball-sports-football-grass-47730.jpeg',
      display_order: 1,
    },
    {
      ground_id: 5,
      image_url: 'https://images.pexels.com/photos/4219/sport-competition-stadium-field.jpg',
      display_order: 0,
    },
    {
      ground_id: 5,
      image_url: 'https://images.pexels.com/photos/159937/cricket-field-cricket-sport-sports-159937.jpeg',
      display_order: 1,
    },
  ];

  const insert = db.prepare(
    `INSERT INTO ground_images (ground_id, image_url, display_order, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  );

  const insertMany = db.transaction((images) => {
    for (const img of images) {
      insert.run(img.ground_id, img.image_url, img.display_order);
    }
  });

  insertMany(groundImages);
}

function seedGroundFeatures(db) {
  // Check if features already exist
  const existingFeatures = db.prepare('SELECT COUNT(*) AS count FROM ground_features').get();

  if (existingFeatures.count > 0) {
    return;
  }

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

  const insert = db.prepare(
    `INSERT INTO ground_features (ground_id, feature_name, feature_value, category)
     VALUES (?, ?, ?, ?)`
  );

  const insertMany = db.transaction((features) => {
    for (const feature of features) {
      insert.run(feature.ground_id, feature.feature_name, null, feature.category);
    }
  });

  insertMany(groundFeatures);
}

function getDb() {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Call initDb() first.');
  }
  return dbInstance;
}

module.exports = {
  initDb,
  getDb,
};
