require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { initDb } = require('./db');
const { UPLOADS_DIR } = require('./utils/imageHelper');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

// Initialize database
initDb();

// API Routes
app.use('/api', routes);

// Error handling middleware
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

// Start server
app.listen(PORT, () => {
  console.log(`Ground booking API listening on http://localhost:${PORT}`);
});
