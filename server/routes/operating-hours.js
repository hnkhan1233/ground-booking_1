const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getDb } = require('../db');

const router = express.Router();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Get operating hours for a specific ground
router.get('/ground/:groundId', authenticate, (req, res) => {
  const db = getDb();
  const { groundId } = req.params;

  const hours = db
    .prepare(
      `SELECT id, ground_id, day_of_week, start_time, end_time, slot_duration_minutes, is_closed
       FROM ground_operating_hours
       WHERE ground_id = ?
       ORDER BY day_of_week ASC`
    )
    .all(groundId);

  // Format response with day names
  const formattedHours = hours.map((hour) => ({
    ...hour,
    dayName: DAYS[hour.day_of_week],
  }));

  res.json(formattedHours);
});

// Update operating hours for a ground and specific day
router.put('/ground/:groundId/day/:dayOfWeek', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { groundId, dayOfWeek } = req.params;
  const { startTime, endTime, slotDurationMinutes, isClosed } = req.body;

  // Validate day_of_week
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    return res.status(400).json({ error: 'Invalid day of week. Must be 0-6.' });
  }

  // Validate times if not closed
  if (!isClosed) {
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Start time and end time are required when ground is open.' });
    }
    if (slotDurationMinutes < 15 || slotDurationMinutes > 480) {
      return res.status(400).json({ error: 'Slot duration must be between 15 and 480 minutes.' });
    }
  }

  db.prepare(
    `INSERT INTO ground_operating_hours
    (ground_id, day_of_week, start_time, end_time, slot_duration_minutes, is_closed)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(ground_id, day_of_week) DO UPDATE SET
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    slot_duration_minutes = excluded.slot_duration_minutes,
    is_closed = excluded.is_closed,
    updated_at = CURRENT_TIMESTAMP`
  ).run(groundId, dayOfWeek, startTime || null, endTime || null, slotDurationMinutes || 60, isClosed ? 1 : 0);

  res.json({ success: true, message: `Operating hours updated for ${DAYS[dayOfWeek]}` });
});

// Batch update operating hours for a ground (all days at once)
router.put('/ground/:groundId/batch', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { groundId } = req.params;
  const { hours } = req.body;

  if (!Array.isArray(hours) || hours.length === 0) {
    return res.status(400).json({ error: 'Hours array is required and must not be empty.' });
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO ground_operating_hours
      (ground_id, day_of_week, start_time, end_time, slot_duration_minutes, is_closed)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(ground_id, day_of_week) DO UPDATE SET
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      slot_duration_minutes = excluded.slot_duration_minutes,
      is_closed = excluded.is_closed,
      updated_at = CURRENT_TIMESTAMP`
    );

    for (const hour of hours) {
      const { day_of_week, start_time, end_time, slot_duration_minutes, is_closed } = hour;

      // Validate day_of_week
      if (day_of_week < 0 || day_of_week > 6) {
        return res.status(400).json({ error: `Invalid day of week: ${day_of_week}. Must be 0-6.` });
      }

      // Validate times if not closed
      if (!is_closed) {
        if (!start_time || !end_time) {
          return res.status(400).json({ error: `Start and end times required for ${DAYS[day_of_week]}.` });
        }
        if (slot_duration_minutes < 15 || slot_duration_minutes > 480) {
          return res.status(400).json({ error: `Slot duration for ${DAYS[day_of_week]} must be 15-480 minutes.` });
        }
      }

      stmt.run(
        groundId,
        day_of_week,
        start_time || null,
        end_time || null,
        slot_duration_minutes || 60,
        is_closed ? 1 : 0
      );
    }

    res.json({ success: true, message: 'Operating hours updated for all days.' });
  } catch (error) {
    console.error('Batch operating hours update error:', error);
    res.status(500).json({ error: 'Failed to update operating hours.' });
  }
});

// Get available time slots for a ground on a specific date
router.get('/ground/:groundId/available-slots', authenticate, (req, res) => {
  const db = getDb();
  const { groundId, date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date is required.' });
  }

  // Get day of week for the date (0 = Monday, 6 = Sunday)
  const dateObj = new Date(date);
  const dayOfWeek = (dateObj.getDay() + 6) % 7; // Convert JS day (0=Sunday) to our format (0=Monday)

  // Get operating hours for this ground and day
  const operatingHour = db
    .prepare(
      `SELECT start_time, end_time, slot_duration_minutes, is_closed
       FROM ground_operating_hours
       WHERE ground_id = ? AND day_of_week = ?`
    )
    .get(groundId, dayOfWeek);

  if (!operatingHour) {
    return res.status(404).json({ error: 'Operating hours not found for this ground and day.' });
  }

  if (operatingHour.is_closed) {
    return res.json({ slots: [], isClosed: true });
  }

  // Generate time slots
  const slots = generateTimeSlots(
    operatingHour.start_time,
    operatingHour.end_time,
    operatingHour.slot_duration_minutes
  );

  // Get booked slots for this date
  const bookedSlots = db
    .prepare(
      `SELECT slot FROM bookings
       WHERE ground_id = ? AND date = ? AND status = 'CONFIRMED'`
    )
    .all(groundId, date)
    .map((b) => b.slot);

  // Filter out booked slots
  const availableSlots = slots.filter((slot) => !bookedSlots.includes(slot));

  res.json({ slots: availableSlots, allSlots: slots, isClosed: false });
});

function generateTimeSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  while (currentMinutes + durationMinutes <= endMinutes) {
    const hour = Math.floor(currentMinutes / 60);
    const minute = currentMinutes % 60;
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    currentMinutes += durationMinutes;
  }

  return slots;
}

module.exports = router;
