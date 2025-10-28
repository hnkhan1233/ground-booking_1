require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { initDb, getDb } = require('./db');
const { getAuth } = require('./firebase');

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const SLOT_TIMES = [
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
  '23:00',
];

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const baseName = path.basename(file.originalname || 'upload', ext).replace(/\s+/g, '-');
    const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, '') || 'ground';
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, or AVIF images are allowed.'));
    }
  },
});

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const parsed = new Date(date);
  return !Number.isNaN(parsed.getTime());
}

function isLocalImage(imageUrl) {
  return Boolean(imageUrl && imageUrl.startsWith('/uploads/'));
}

function deleteLocalImage(imageUrl) {
  if (!isLocalImage(imageUrl)) {
    return;
  }

  const fileName = path.basename(imageUrl);
  const filePath = path.join(UPLOADS_DIR, fileName);

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`Failed to delete image ${filePath}: ${error.message}`);
  }
}

function validateGroundPayload(payload) {
  const errors = [];
  if (!payload.name || !payload.name.trim()) {
    errors.push('Ground name is required.');
  }
  if (!payload.city || !payload.city.trim()) {
    errors.push('City is required.');
  }
  if (!payload.location || !payload.location.trim()) {
    errors.push('Location is required.');
  }
  if (payload.pricePerHour === undefined || payload.pricePerHour === null || payload.pricePerHour === '') {
    errors.push('Price per hour is required.');
  }

  const rawPrice = String(payload.pricePerHour ?? '');
  const cleanedPrice = rawPrice.replace(/[^0-9.]/g, '');
  const numericPrice = cleanedPrice ? Number(cleanedPrice) : Number.NaN;

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    errors.push('Price per hour must be a number greater than 0.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    numericPrice,
  };
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

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
  return email ? ADMIN_EMAILS.includes(email) : false;
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

initDb();
const db = getDb();

app.get('/api/grounds', (req, res) => {
  const { category } = req.query;

  let query = `SELECT id, name, city, location, price_per_hour, description, image_url, surface_type, capacity, dimensions, category
     FROM grounds`;

  const params = [];
  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }

  query += ' ORDER BY city, name';

  const statement = db.prepare(query);
  const grounds = statement.all(...params);
  res.json(grounds);
});

app.get('/api/grounds/:id', (req, res) => {
  const groundId = parseInt(req.params.id, 10);

  if (isNaN(groundId)) {
    return res.status(400).json({ error: 'Invalid ground ID.' });
  }

  // Get ground basic info
  const ground = db.prepare(
    `SELECT id, name, city, location, price_per_hour, description, image_url, surface_type, capacity, dimensions, category
     FROM grounds
     WHERE id = ?`
  ).get(groundId);

  if (!ground) {
    return res.status(404).json({ error: 'Ground not found.' });
  }

  // Get all images for this ground
  const images = db.prepare(
    `SELECT id, image_url, display_order
     FROM ground_images
     WHERE ground_id = ?
     ORDER BY display_order, id`
  ).all(groundId);

  // Get all features for this ground
  const features = db.prepare(
    `SELECT id, feature_name, feature_value, category
     FROM ground_features
     WHERE ground_id = ?
     ORDER BY category, feature_name`
  ).all(groundId);

  res.json({
    ...ground,
    images,
    features,
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({
    uid: req.user.uid,
    email: req.user.email ?? null,
    name: req.user.name ?? req.user.displayName ?? null,
    phoneNumber: req.user.phone_number ?? req.user.phoneNumber ?? null,
    isAdmin: isAdminUser(req.user),
  });
});

app.get('/api/profile', authenticate, (req, res) => {
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

app.put('/api/profile', authenticate, (req, res) => {
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

app.get('/api/admin/grounds', authenticate, requireAdmin, (req, res) => {
  const statement = db.prepare(
    `SELECT id, name, city, location, price_per_hour, description, image_url
     FROM grounds
     ORDER BY id DESC`
  );

  const grounds = statement.all();
  res.json(grounds);
});

app.post('/api/admin/grounds', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const payload = {
    name: req.body.name,
    city: req.body.city,
    location: req.body.location,
    pricePerHour: req.body.pricePerHour,
  };
  const validation = validateGroundPayload(payload);
  if (!validation.isValid) {
    if (req.file) {
      deleteLocalImage(`/uploads/${req.file.filename}`);
    }
    return res.status(400).json({ error: validation.errors.join(' ') });
  }

  const description = req.body.description ? req.body.description.trim() : null;
  const imageUrlFromBody = req.body.imageUrl ? req.body.imageUrl.trim() : null;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : imageUrlFromBody;
  const category = req.body.category ? req.body.category.trim() : null;

  if (!imageUrl) {
    if (req.file) {
      deleteLocalImage(`/uploads/${req.file.filename}`);
    }
    return res.status(400).json({ error: 'Ground image is required.' });
  }

  try {
    const statement = db.prepare(
      `INSERT INTO grounds (name, city, location, price_per_hour, description, image_url, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const info = statement.run(
      req.body.name.trim(),
      req.body.city.trim(),
      req.body.location.trim(),
      validation.numericPrice,
      description,
      imageUrl,
      category
    );

    // Handle features if provided
    if (req.body.features) {
      const featuresData = typeof req.body.features === 'string'
        ? JSON.parse(req.body.features)
        : req.body.features;

      const featureStmt = db.prepare(
        `INSERT INTO ground_features (ground_id, feature_name, feature_value, category)
         VALUES (?, ?, ?, ?)`
      );

      for (const feature of featuresData) {
        featureStmt.run(
          info.lastInsertRowid,
          feature.name,
          feature.value || null,
          feature.category || null
        );
      }
    }

    const created = db
      .prepare(
        `SELECT id, name, city, location, price_per_hour, description, image_url, surface_type, capacity, dimensions, category
         FROM grounds WHERE id = ?`
      )
      .get(info.lastInsertRowid);

    const images = db
      .prepare(
        `SELECT id, image_url, display_order
         FROM ground_images
         WHERE ground_id = ?
         ORDER BY display_order, id`
      )
      .all(info.lastInsertRowid);

    res.status(201).json({ ...created, images });
  } catch (error) {
    if (req.file) {
      deleteLocalImage(`/uploads/${req.file.filename}`);
    }
    res.status(500).json({ error: 'Failed to create ground.' });
  }
});

app.put('/api/admin/grounds/:groundId', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const { groundId } = req.params;

  const existingGround = db
    .prepare('SELECT id, image_url FROM grounds WHERE id = ?')
    .get(groundId);

  if (!existingGround) {
    if (req.file) {
      deleteLocalImage(`/uploads/${req.file.filename}`);
    }
    return res.status(404).json({ error: 'Ground not found.' });
  }

  const payload = {
    name: req.body.name,
    city: req.body.city,
    location: req.body.location,
    pricePerHour: req.body.pricePerHour,
  };
  const validation = validateGroundPayload(payload);
  if (!validation.isValid) {
    if (req.file) {
      deleteLocalImage(`/uploads/${req.file.filename}`);
    }
    return res.status(400).json({ error: validation.errors.join(' ') });
  }

  const description = req.body.description ? req.body.description.trim() : null;
  const surfaceType = req.body.surfaceType ? req.body.surfaceType.trim() : null;
  const capacity = req.body.capacity ? parseInt(req.body.capacity, 10) : null;
  const dimensions = req.body.dimensions ? req.body.dimensions.trim() : null;
  const category = req.body.category ? req.body.category.trim() : null;
  const imageUrlFromBody = req.body.imageUrl ? req.body.imageUrl.trim() : null;
  const nextImageUrl = req.file
    ? `/uploads/${req.file.filename}`
    : imageUrlFromBody || existingGround.image_url;

  if (!nextImageUrl) {
    if (req.file) {
      deleteLocalImage(`/uploads/${req.file.filename}`);
    }
    return res.status(400).json({ error: 'Ground image is required.' });
  }

  try {
    db.prepare(
      `UPDATE grounds
       SET name = ?, city = ?, location = ?, price_per_hour = ?, description = ?, image_url = ?, surface_type = ?, capacity = ?, dimensions = ?, category = ?
       WHERE id = ?`
    ).run(
      req.body.name.trim(),
      req.body.city.trim(),
      req.body.location.trim(),
      validation.numericPrice,
      description,
      nextImageUrl,
      surfaceType,
      capacity,
      dimensions,
      category,
      groundId
    );

    // Handle features update if provided
    if (req.body.features) {
      // Delete existing features
      db.prepare('DELETE FROM ground_features WHERE ground_id = ?').run(groundId);

      // Insert new features
      const featuresData = typeof req.body.features === 'string'
        ? JSON.parse(req.body.features)
        : req.body.features;

      const featureStmt = db.prepare(
        `INSERT INTO ground_features (ground_id, feature_name, feature_value, category)
         VALUES (?, ?, ?, ?)`
      );

      for (const feature of featuresData) {
        featureStmt.run(
          groundId,
          feature.name,
          feature.value || null,
          feature.category || null
        );
      }
    }

    if (req.file && isLocalImage(existingGround.image_url)) {
      deleteLocalImage(existingGround.image_url);
    }

    const updated = db
      .prepare(
        `SELECT id, name, city, location, price_per_hour, description, image_url, surface_type, capacity, dimensions, category
         FROM grounds WHERE id = ?`
      )
      .get(groundId);

    const images = db
      .prepare(
        `SELECT id, image_url, display_order
         FROM ground_images
         WHERE ground_id = ?
         ORDER BY display_order, id`
      )
      .all(groundId);

    res.json({ ...updated, images });
  } catch (error) {
    if (req.file) {
      deleteLocalImage(`/uploads/${req.file.filename}`);
    }
    res.status(500).json({ error: 'Failed to update ground.' });
  }
});

app.delete('/api/admin/grounds/:groundId', authenticate, requireAdmin, (req, res) => {
  const { groundId } = req.params;

  const existingGround = db
    .prepare('SELECT id, image_url FROM grounds WHERE id = ?')
    .get(groundId);

  if (!existingGround) {
    return res.status(404).json({ error: 'Ground not found.' });
  }

  const activeBookings = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM bookings
       WHERE ground_id = ? AND status = 'CONFIRMED'`
    )
    .get(groundId);

  if (activeBookings.count > 0) {
    return res
      .status(409)
      .json({ error: 'Cannot delete a ground with active bookings. Cancel them first.' });
  }

  const galleryImages = db
    .prepare('SELECT image_url FROM ground_images WHERE ground_id = ?')
    .all(groundId);

  db.prepare(`DELETE FROM grounds WHERE id = ?`).run(groundId);

  if (isLocalImage(existingGround.image_url)) {
    deleteLocalImage(existingGround.image_url);
  }

  for (const galleryImage of galleryImages) {
    if (isLocalImage(galleryImage.image_url)) {
      deleteLocalImage(galleryImage.image_url);
    }
  }

  res.json({ success: true });
});

// Ground features endpoints
app.post('/api/admin/grounds/:groundId/features', authenticate, requireAdmin, (req, res) => {
  const { groundId } = req.params;
  const { featureName, featureValue, category } = req.body;

  if (!featureName || !featureName.trim()) {
    return res.status(400).json({ error: 'Feature name is required.' });
  }

  const ground = db.prepare('SELECT id FROM grounds WHERE id = ?').get(groundId);
  if (!ground) {
    return res.status(404).json({ error: 'Ground not found.' });
  }

  const result = db.prepare(
    `INSERT INTO ground_features (ground_id, feature_name, feature_value, category)
     VALUES (?, ?, ?, ?)`
  ).run(groundId, featureName.trim(), featureValue || null, category || null);

  const feature = db.prepare(
    'SELECT id, feature_name, feature_value, category FROM ground_features WHERE id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json(feature);
});

app.delete('/api/admin/grounds/:groundId/features/:featureId', authenticate, requireAdmin, (req, res) => {
  const { groundId, featureId } = req.params;

  const feature = db.prepare(
    'SELECT id FROM ground_features WHERE id = ? AND ground_id = ?'
  ).get(featureId, groundId);

  if (!feature) {
    return res.status(404).json({ error: 'Feature not found.' });
  }

  db.prepare('DELETE FROM ground_features WHERE id = ?').run(featureId);
  res.json({ success: true });
});

// Ground images endpoints
app.post('/api/admin/grounds/:groundId/images', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const { groundId } = req.params;

  const ground = db.prepare('SELECT id FROM grounds WHERE id = ?').get(groundId);
  if (!ground) {
    if (req.file) {
      deleteLocalImage(`/uploads/${req.file.filename}`);
    }
    return res.status(404).json({ error: 'Ground not found.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Image file is required.' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  const rawOrder = req.body.displayOrder ? parseInt(req.body.displayOrder, 10) : Number.NaN;
  let displayOrder = Number.isInteger(rawOrder) ? rawOrder : null;

  if (displayOrder === null) {
    const { maxOrder } = db
      .prepare('SELECT COALESCE(MAX(display_order), -1) AS maxOrder FROM ground_images WHERE ground_id = ?')
      .get(groundId);
    displayOrder = maxOrder + 1;
  }

  const result = db.prepare(
    `INSERT INTO ground_images (ground_id, image_url, display_order)
     VALUES (?, ?, ?)`
  ).run(groundId, imageUrl, displayOrder);

  const image = db.prepare(
    'SELECT id, image_url, display_order FROM ground_images WHERE id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json(image);
});

app.put('/api/admin/grounds/:groundId/images/reorder', authenticate, requireAdmin, (req, res) => {
  const { groundId } = req.params;
  const order = Array.isArray(req.body?.order) ? req.body.order : null;

  if (!order || order.length === 0) {
    return res.status(400).json({ error: 'order array is required.' });
  }

  const ground = db.prepare('SELECT id FROM grounds WHERE id = ?').get(groundId);
  if (!ground) {
    return res.status(404).json({ error: 'Ground not found.' });
  }

  const rows = db
    .prepare('SELECT id FROM ground_images WHERE ground_id = ? ORDER BY display_order, id')
    .all(groundId);

  if (rows.length === 0) {
    return res.status(400).json({ error: 'No images to reorder.' });
  }

  const validIds = new Set(rows.map((row) => row.id));
  if (order.length !== rows.length || order.some((id) => !validIds.has(id))) {
    return res.status(400).json({ error: 'order must include every image id once.' });
  }

  const updateStmt = db.prepare('UPDATE ground_images SET display_order = ? WHERE id = ?');
  const transaction = db.transaction((orderedIds) => {
    orderedIds.forEach((imageId, index) => {
      updateStmt.run(index, imageId);
    });
  });

  transaction(order);

  const updatedImages = db
    .prepare(
      `SELECT id, image_url, display_order
       FROM ground_images
       WHERE ground_id = ?
       ORDER BY display_order, id`
    )
    .all(groundId);

  res.json({ success: true, images: updatedImages });
});

app.delete('/api/admin/grounds/:groundId/images/:imageId', authenticate, requireAdmin, (req, res) => {
  const { groundId, imageId } = req.params;

  const image = db.prepare(
    'SELECT id, image_url FROM ground_images WHERE id = ? AND ground_id = ?'
  ).get(imageId, groundId);

  if (!image) {
    return res.status(404).json({ error: 'Image not found.' });
  }

  db.prepare('DELETE FROM ground_images WHERE id = ?').run(imageId);

  if (isLocalImage(image.image_url)) {
    deleteLocalImage(image.image_url);
  }

  const ground = db.prepare('SELECT image_url FROM grounds WHERE id = ?').get(groundId);
  if (ground && ground.image_url === image.image_url) {
    const replacement = db
      .prepare(
        `SELECT image_url
         FROM ground_images
         WHERE ground_id = ?
         ORDER BY display_order, id
         LIMIT 1`
      )
      .get(groundId);

    db.prepare('UPDATE grounds SET image_url = ? WHERE id = ?').run(replacement ? replacement.image_url : null, groundId);
  }

  res.json({ success: true });
});

app.get('/api/grounds/:groundId/availability', (req, res) => {
  const { groundId } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'date query parameter is required (YYYY-MM-DD).' });
  }

  if (!isValidDate(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  // Check if date is in the past (Pakistani timezone - PKT = UTC+5)
  const now = new Date();
  const pktOffset = 5 * 60; // PKT is UTC+5
  const pktTime = new Date(now.getTime() + (pktOffset + now.getTimezoneOffset()) * 60000);
  const pktYear = pktTime.getFullYear();
  const pktMonth = String(pktTime.getMonth() + 1).padStart(2, '0');
  const pktDay = String(pktTime.getDate()).padStart(2, '0');
  const todayPKT = `${pktYear}-${pktMonth}-${pktDay}`;

  if (date < todayPKT) {
    return res.status(400).json({ error: 'Cannot view availability for past dates.' });
  }

  const ground = db
    .prepare('SELECT id FROM grounds WHERE id = ?')
    .get(groundId);

  if (!ground) {
    return res.status(404).json({ error: 'Ground not found.' });
  }

  const bookings = db
    .prepare(
      `SELECT slot
       FROM bookings
       WHERE ground_id = ? AND date = ? AND status = 'CONFIRMED'`
    )
    .all(groundId, date);

  const bookedSlots = new Set(bookings.map((booking) => booking.slot));

  // Get current time in Pakistani timezone (PKT = UTC+5) - reuse variables from above
  const pktHours = pktTime.getHours();
  const pktMinutes = pktTime.getMinutes();

  const isToday = date === todayPKT;

  const availability = SLOT_TIMES.map((slot) => {
    let available = !bookedSlots.has(slot);

    // If it's today, check if the slot time has passed
    if (isToday && available) {
      const [slotHour, slotMinute] = slot.split(':').map(Number);

      // Slot is unavailable if it has already started or passed
      if (slotHour < pktHours || (slotHour === pktHours && slotMinute <= pktMinutes)) {
        available = false;
      }
    }

    return { slot, available };
  });

  res.json({ groundId: Number(groundId), date, availability });
});

app.post('/api/bookings', authenticate, (req, res) => {
  const { groundId, date, slot } = req.body;

  if (!groundId || !date || !slot) {
    return res.status(400).json({
      error: 'groundId, date, and slot are required.',
    });
  }

  if (!isValidDate(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  if (!SLOT_TIMES.includes(slot)) {
    return res.status(400).json({ error: 'Invalid slot selected.' });
  }

  // Check if the booking is for a past time (Pakistani timezone - PKT = UTC+5)
  const now = new Date();
  const pktOffset = 5 * 60; // PKT is UTC+5
  const pktTime = new Date(now.getTime() + (pktOffset + now.getTimezoneOffset()) * 60000);
  const pktHours = pktTime.getHours();
  const pktMinutes = pktTime.getMinutes();

  const pktYear = pktTime.getFullYear();
  const pktMonth = String(pktTime.getMonth() + 1).padStart(2, '0');
  const pktDay = String(pktTime.getDate()).padStart(2, '0');
  const todayPKT = `${pktYear}-${pktMonth}-${pktDay}`;

  // Reject bookings for past dates
  if (date < todayPKT) {
    return res.status(400).json({ error: 'Cannot book dates in the past.' });
  }

  // For today, check if the slot time has passed
  if (date === todayPKT) {
    const [slotHour, slotMinute] = slot.split(':').map(Number);

    if (slotHour < pktHours || (slotHour === pktHours && slotMinute <= pktMinutes)) {
      return res.status(400).json({ error: 'Cannot book a time slot that has already passed.' });
    }
  }

  const profile = db
    .prepare('SELECT name, phone FROM user_profiles WHERE user_uid = ?')
    .get(req.user.uid);

  if (!profile || !profile.name || !profile.phone) {
    return res.status(428).json({
      error: 'Complete your profile before booking.',
      code: 'PROFILE_REQUIRED',
    });
  }

  const ground = db
    .prepare('SELECT id, price_per_hour FROM grounds WHERE id = ?')
    .get(groundId);

  if (!ground) {
    return res.status(404).json({ error: 'Ground not found.' });
  }

  const existingBooking = db
    .prepare(
      `SELECT id
       FROM bookings
       WHERE ground_id = ? AND date = ? AND slot = ? AND status = 'CONFIRMED'`
    )
    .get(groundId, date, slot);

  if (existingBooking) {
    return res.status(409).json({
      error: 'This slot is already booked for the selected date.',
    });
  }

  const statement = db.prepare(
    `INSERT INTO bookings (ground_id, date, slot, customer_name, customer_phone, user_uid, price_at_booking)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const info = statement.run(
    groundId,
    date,
    slot,
    profile.name,
    profile.phone,
    req.user?.uid || null,
    ground.price_per_hour
  );

  res.status(201).json({
    id: info.lastInsertRowid,
    groundId,
    date,
    slot,
    customerName: profile.name,
    customerPhone: profile.phone,
    status: 'CONFIRMED',
    userUid: req.user?.uid || null,
  });
});

app.delete('/api/bookings/:bookingId', authenticate, (req, res) => {
  const { bookingId } = req.params;

  const booking = db
    .prepare('SELECT id, status FROM bookings WHERE id = ?')
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  if (booking.status === 'CANCELLED') {
    return res.status(409).json({ error: 'Booking is already cancelled.' });
  }

  db.prepare(`UPDATE bookings SET status = 'CANCELLED' WHERE id = ?`).run(bookingId);

  res.json({ success: true });
});

app.get('/api/bookings', authenticate, requireAdmin, (req, res) => {
  const statement = db.prepare(
    `SELECT b.id, b.date, b.slot, b.status,
            b.customer_name AS customerName,
            b.customer_phone AS customerPhone,
            g.id AS groundId,
            g.name AS groundName,
            g.city,
            g.location,
            b.user_uid AS userUid
     FROM bookings b
     JOIN grounds g ON g.id = b.ground_id
     ORDER BY b.date DESC, b.slot ASC`
  );

  const bookings = statement.all();
  res.json(bookings);
});

app.get('/api/admin/stats', authenticate, requireAdmin, (req, res) => {
  const totalBookingsRow = db.prepare(
    `SELECT COUNT(*) AS totalBookings
     FROM bookings
     WHERE status = 'CONFIRMED'`
  ).get();

  const totalRevenueRow = db.prepare(
    `SELECT COALESCE(SUM(
       CASE
         WHEN b.price_at_booking IS NOT NULL THEN b.price_at_booking
         ELSE g.price_per_hour
       END
     ), 0) AS totalRevenue
     FROM bookings b
     JOIN grounds g ON g.id = b.ground_id
     WHERE b.status = 'CONFIRMED'`
  ).get();

  const bookingsByGround = db.prepare(
    `SELECT g.id AS groundId,
            g.name AS groundName,
            g.city,
            COUNT(b.id) AS bookingCount,
            SUM(
              CASE
                WHEN b.price_at_booking IS NOT NULL THEN b.price_at_booking
                ELSE g.price_per_hour
              END
            ) AS revenue
     FROM bookings b
     JOIN grounds g ON g.id = b.ground_id
     WHERE b.status = 'CONFIRMED'
     GROUP BY g.id
     ORDER BY bookingCount DESC`
  ).all();

  const bookingsByCity = db.prepare(
    `SELECT g.city,
            COUNT(b.id) AS bookingCount,
            SUM(
              CASE
                WHEN b.price_at_booking IS NOT NULL THEN b.price_at_booking
                ELSE g.price_per_hour
              END
            ) AS revenue
     FROM bookings b
     JOIN grounds g ON g.id = b.ground_id
     WHERE b.status = 'CONFIRMED'
     GROUP BY g.city
     ORDER BY bookingCount DESC`
  ).all();

  const upcomingBookings = db.prepare(
    `SELECT b.id,
            b.date,
            b.slot,
            g.name AS groundName,
            g.city,
            b.customer_name AS customerName,
            b.customer_phone AS customerPhone
     FROM bookings b
     JOIN grounds g ON g.id = b.ground_id
     WHERE b.status = 'CONFIRMED' AND DATE(b.date) >= DATE('now')
     ORDER BY b.date ASC, b.slot ASC
     LIMIT 20`
  ).all();

  res.json({
    totals: {
      bookings: totalBookingsRow.totalBookings,
      revenue: totalRevenueRow.totalRevenue,
    },
    byGround: bookingsByGround,
    byCity: bookingsByCity,
    upcoming: upcomingBookings,
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image is too large. Maximum size is 5 MB.' });
    }
    return res.status(400).json({ error: 'Image upload failed. Please try again.' });
  }

  if (err && err.message === 'Only JPEG, PNG, WebP, or AVIF images are allowed.') {
    return res.status(400).json({ error: err.message });
  }

  if (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }

  next();
});

app.listen(PORT, () => {
  console.log(`Ground booking API listening on http://localhost:${PORT}`);
});
