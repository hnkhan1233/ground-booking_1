const express = require('express');
const { authenticate, requireAdmin } = require('../../middleware/auth');
const { getDb } = require('../../db');

const router = express.Router();

router.get('/', authenticate, requireAdmin, (req, res) => {
  const db = getDb();

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

module.exports = router;
