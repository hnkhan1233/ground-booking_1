const express = require('express');
const { getDb } = require('../db');
const { isValidDate } = require('../utils/validators');
const { SLOT_TIMES } = require('../utils/constants');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
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

router.get('/:id', (req, res) => {
  const db = getDb();
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

router.get('/:groundId/availability', (req, res) => {
  const db = getDb();
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

  // Get the day of week for the requested date
  // Convert JavaScript's getDay() (0=Sunday, 6=Saturday) to database format (0=Monday, 6=Sunday)
  const requestedDate = new Date(date + 'T00:00:00');
  const jsDayOfWeek = requestedDate.getDay();
  const dayOfWeek = (jsDayOfWeek + 6) % 7; // Convert: JS Sunday(0) -> DB Monday(0)

  // Check if the ground is closed on this day of the week
  const operatingHours = db
    .prepare(
      `SELECT is_closed, start_time, end_time
       FROM ground_operating_hours
       WHERE ground_id = ? AND day_of_week = ?`
    )
    .get(groundId, dayOfWeek);

  // If the ground is closed on this day, return empty availability
  if (operatingHours && operatingHours.is_closed) {
    return res.json({ groundId: Number(groundId), date, availability: [] });
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

module.exports = router;
