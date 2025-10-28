const express = require('express');
const { authenticate } = require('../middleware/auth');
const { isAdminUser } = require('../middleware/auth');

const router = express.Router();

router.get('/me', authenticate, (req, res) => {
  res.json({
    uid: req.user.uid,
    email: req.user.email ?? null,
    name: req.user.name ?? req.user.displayName ?? null,
    phoneNumber: req.user.phone_number ?? req.user.phoneNumber ?? null,
    isAdmin: isAdminUser(req.user),
  });
});

module.exports = router;
