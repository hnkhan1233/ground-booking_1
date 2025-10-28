const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getDb } = require('../db');
const { isValidDate } = require('../utils/validators');
const { SLOT_TIMES } = require('../utils/constants');
const { sendBookingNotificationEmail, sendCancellationNotificationEmail } = require('../services/emailService');

const router = express.Router();

router.post('/', authenticate, (req, res) => {
  const db = getDb();
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
    .prepare('SELECT id, name, location, city, price_per_hour FROM grounds WHERE id = ?')
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

  // Send email notification to admins
  sendBookingNotificationEmail({
    bookingId: info.lastInsertRowid,
    groundId,
    groundName: ground.name,
    location: ground.location,
    city: ground.city,
    date,
    slot,
    customerName: profile.name,
    customerPhone: profile.phone,
    priceAtBooking: ground.price_per_hour,
  }).catch((err) => {
    // Log error but don't fail the booking
    console.error('Failed to send booking notification email:', err);
  });

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

router.delete('/:bookingId', authenticate, (req, res) => {
  const db = getDb();
  const { bookingId } = req.params;

  const booking = db
    .prepare(
      `SELECT b.id, b.status, b.ground_id, b.date, b.slot, b.customer_name, b.customer_phone,
              g.name, g.city, g.location
       FROM bookings b
       JOIN grounds g ON g.id = b.ground_id
       WHERE b.id = ?`
    )
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  if (booking.status === 'CANCELLED') {
    return res.status(409).json({ error: 'Booking is already cancelled.' });
  }

  db.prepare(`UPDATE bookings SET status = 'CANCELLED' WHERE id = ?`).run(bookingId);

  // Send cancellation email notification to admins
  sendCancellationNotificationEmail({
    bookingId: booking.id,
    groundName: booking.name,
    location: booking.location,
    city: booking.city,
    date: booking.date,
    slot: booking.slot,
    customerName: booking.customer_name,
    customerPhone: booking.customer_phone,
  }).catch((err) => {
    // Log error but don't fail the cancellation
    console.error('Failed to send cancellation notification email:', err);
  });

  res.json({ success: true });
});

// Get user's personal booking history
router.get('/user/history', authenticate, (req, res) => {
  const db = getDb();
  const statement = db.prepare(
    `SELECT b.id, b.date, b.slot, b.status,
            b.price_at_booking AS priceAtBooking,
            g.id AS groundId,
            g.name AS groundName,
            g.city,
            g.location
     FROM bookings b
     JOIN grounds g ON g.id = b.ground_id
     WHERE b.user_uid = ?
     ORDER BY b.date DESC, b.slot ASC`
  );

  const bookings = statement.all(req.user.uid);
  res.json(bookings);
});

// Get all bookings (admin only)
router.get('/', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
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

module.exports = router;
