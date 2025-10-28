const express = require('express');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { getDb } = require('../../db');
const { validateGroundPayload } = require('../../utils/validators');
const { deleteLocalImage, isLocalImage } = require('../../utils/imageHelper');
const upload = require('../../config/multer');

const router = express.Router();

router.get('/', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const statement = db.prepare(
    `SELECT id, name, city, location, price_per_hour, description, image_url
     FROM grounds
     ORDER BY id DESC`
  );

  const grounds = statement.all();
  res.json(grounds);
});

router.post('/', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const db = getDb();
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

router.put('/:groundId', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const db = getDb();
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

router.delete('/:groundId', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
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
router.post('/:groundId/features', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
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

router.delete('/:groundId/features/:featureId', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
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
router.post('/:groundId/images', authenticate, requireAdmin, upload.single('image'), (req, res) => {
  const db = getDb();
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

router.put('/:groundId/images/reorder', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
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

router.delete('/:groundId/images/:imageId', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
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

module.exports = router;
