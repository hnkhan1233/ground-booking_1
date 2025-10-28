function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }
  const parsed = new Date(date);
  return !Number.isNaN(parsed.getTime());
}

function validateGroundPayload(payload) {
  const errors = [];
  if (!payload.name || !payload.name.trim()) {
    errors.push('Ground name is required.');
  }
  if (!payload.city || !payload.city.trim()) {
    errors.push('City is required.');
  }
  if (!payload.location || !payload.location.trim()) {
    errors.push('Location is required.');
  }
  if (payload.pricePerHour === undefined || payload.pricePerHour === null || payload.pricePerHour === '') {
    errors.push('Price per hour is required.');
  }

  const rawPrice = String(payload.pricePerHour ?? '');
  const cleanedPrice = rawPrice.replace(/[^0-9.]/g, '');
  const numericPrice = cleanedPrice ? Number(cleanedPrice) : Number.NaN;

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    errors.push('Price per hour must be a number greater than 0.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    numericPrice,
  };
}

module.exports = {
  isValidDate,
  validateGroundPayload,
};
