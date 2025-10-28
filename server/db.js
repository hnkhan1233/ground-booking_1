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

  seedGrounds(dbInstance);

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
    },
  ];

  const insert = db.prepare(
    `INSERT INTO grounds (id, name, city, location, price_per_hour, description, image_url)
     VALUES (@id, @name, @city, @location, @price_per_hour, @description, @image_url)`
  );

  const insertMany = db.transaction((groundsList) => {
    for (const ground of groundsList) {
      insert.run(ground);
    }
  });

  insertMany(grounds);
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
