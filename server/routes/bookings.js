const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getDb } = require('../db');
const { isValidDate } = require('../utils/validators');
const { SLOT_TIMES } = require('../utils/constants');
const { sendBookingNotificationEmail, sendCancellationNotificationEmail } = require('../services/emailService');

const router = express.Router();

// Get user's personal booking history (must be before /:bookingId routes)
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

router.post('/', authenticate, (req, res) => {
  const db = getDb();
  const { groundId, date, slots } = req.body;

  if (!groundId || !date || !slots) {
    return res.status(400).json({
      error: 'groundId, date, and slots are required.',
    });
  }

  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({
      error: 'slots must be a non-empty array.',
    });
  }

  if (!isValidDate(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  // Validate all slots
  for (const slot of slots) {
    if (!SLOT_TIMES.includes(slot)) {
      return res.status(400).json({ error: `Invalid slot selected: ${slot}` });
    }
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

  // For today, check if any slot time has passed
  if (date === todayPKT) {
    for (const slot of slots) {
      const [slotHour, slotMinute] = slot.split(':').map(Number);

      if (slotHour < pktHours || (slotHour === pktHours && slotMinute <= pktMinutes)) {
        return res.status(400).json({ error: `Cannot book time slot ${slot} that has already passed.` });
      }
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

  // Check operating hours for this ground on the booking date
  const dateObj = new Date(date);
  const dayOfWeek = (dateObj.getDay() + 6) % 7; // Convert JS day (0=Sunday) to our format (0=Monday)

  const operatingHours = db
    .prepare(
      `SELECT start_time, end_time, is_closed
       FROM ground_operating_hours
       WHERE ground_id = ? AND day_of_week = ?`
    )
    .get(groundId, dayOfWeek);

  if (!operatingHours) {
    return res.status(400).json({ error: 'Operating hours not configured for this ground.' });
  }

  if (operatingHours.is_closed) {
    return res.status(400).json({ error: 'Ground is closed on this day.' });
  }

  // Check if all requested slots are within operating hours and not already booked
  const [startHour, startMinute] = operatingHours.start_time.split(':').map(Number);
  const [endHour, endMinute] = operatingHours.end_time.split(':').map(Number);
  const startTimeInMinutes = startHour * 60 + startMinute;
  const endTimeInMinutes = endHour * 60 + endMinute;

  for (const slot of slots) {
    const [slotHour, slotMinute] = slot.split(':').map(Number);
    const slotTimeInMinutes = slotHour * 60 + slotMinute;

    if (slotTimeInMinutes < startTimeInMinutes || slotTimeInMinutes >= endTimeInMinutes) {
      return res.status(400).json({
        error: `Slot ${slot} is outside operating hours (${operatingHours.start_time} - ${operatingHours.end_time}).`,
      });
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
        error: `Slot ${slot} is already booked for the selected date.`,
      });
    }
  }

  const statement = db.prepare(
    `INSERT INTO bookings (ground_id, date, slot, customer_name, customer_phone, user_uid, price_at_booking)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const createdBookings = [];

  // Create a booking for each slot
  for (const slot of slots) {
    const info = statement.run(
      groundId,
      date,
      slot,
      profile.name,
      profile.phone,
      req.user?.uid || null,
      ground.price_per_hour
    );

    createdBookings.push({
      id: info.lastInsertRowid,
      groundId,
      date,
      slot,
      customerName: profile.name,
      customerPhone: profile.phone,
      status: 'CONFIRMED',
      userUid: req.user?.uid || null,
    });

    // Send email notification to admins for each slot
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
  }

  res.status(201).json(createdBookings);
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
