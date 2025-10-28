const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { UPLOADS_DIR } = require('../utils/imageHelper');

// Ensure uploads directory exists
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

module.exports = upload;
