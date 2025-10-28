const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

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

module.exports = {
  isLocalImage,
  deleteLocalImage,
  UPLOADS_DIR,
};
