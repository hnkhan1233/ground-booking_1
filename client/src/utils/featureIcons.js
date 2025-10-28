// Feature-to-icon mapping for ground features
// Using Unicode symbols and professional icons
export const featureIcons = {
  // Lighting features
  'floodlights': '💡',
  'flood lights': '💡',
  'lights': '💡',
  'lighting': '💡',
  'night lights': '🌙',
  'stadium lights': '💡',

  // Parking
  'parking': '🅿️',
  'parking available': '🅿️',
  'free parking': '🅿️',
  'covered parking': '🅿️',

  // Amenities
  'washrooms': '🚿',
  'restroom': '🚿',
  'shower': '🚿',
  'changing room': '👕',
  'locker': '🔒',
  'water': '💧',
  'drinking water': '💧',

  // Sports equipment
  'equipment': '⚽',
  'ball': '⚽',
  'balls provided': '⚽',
  'cricket equipment': '🏏',
  'football': '⚽',
  'badminton': '🏸',
  'tennis': '🎾',

  // Surface type
  'grass': '🌱',
  'artificial grass': '🌱',
  'turf': '🌱',
  'concrete': '⬜',
  'asphalt': '⬜',
  'clay': '🟫',
  'wooden': '🟫',

  // Services
  'coaching': '👨‍🏫',
  'coach available': '👨‍🏫',
  'trainer': '👨‍🏫',
  'food': '🍔',
  'cafe': '☕',
  'canteen': '🍔',
  'beverages': '🥤',
  'drinks': '🥤',

  // Access
  'wheelchair accessible': '♿',
  'accessible': '♿',
  'disabled access': '♿',
  'night access': '🌙',
  '24/7': '⏰',
  'open 24 hours': '⏰',

  // Security
  'security': '🔒',
  'cctv': '📹',
  'camera': '📹',
  'surveillance': '📹',
  'guards': '👮',
  'safe': '🔒',

  // Venue type
  'open': '🌳',
  'outdoor': '🌳',
  'uncovered': '🌳',
  'indoor': '🏠',
  'covered': '🏛️',
  'enclosed': '🏛️',

  // Other
  'spectator seating': '🪑',
  'seating': '🪑',
  'air conditioned': '❄️',
  'ac': '❄️',
  'ventilation': '💨',
  'scoreboard': '📊',
  'sound system': '🔊',
  'net': '🥅',
  'goals': '⚽',
};

// Get icon for a feature
export function getFeatureIcon(featureName) {
  if (!featureName) return '✓';

  const normalized = featureName.toLowerCase().trim();

  // Direct match
  if (featureIcons[normalized]) {
    return featureIcons[normalized];
  }

  // Partial match (check if feature name contains any key)
  for (const [key, icon] of Object.entries(featureIcons)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return icon;
    }
  }

  // Default checkmark
  return '✓';
}

// Get background color for feature category
export function getCategoryColor(category) {
  const colors = {
    'Lighting': 'rgba(251, 191, 36, 0.1)',
    'Amenities': 'rgba(99, 102, 241, 0.1)',
    'Equipment': 'rgba(34, 197, 94, 0.1)',
    'Surface': 'rgba(168, 85, 247, 0.1)',
    'Services': 'rgba(59, 130, 246, 0.1)',
    'Access': 'rgba(236, 72, 153, 0.1)',
    'Security': 'rgba(239, 68, 68, 0.1)',
    'Facilities': 'rgba(14, 165, 233, 0.1)',
  };

  // Try to find matching category (case-insensitive)
  if (category) {
    const normalizedCategory = category.trim();
    if (colors[normalizedCategory]) {
      return colors[normalizedCategory];
    }
  }

  // Default color
  return 'rgba(15, 23, 42, 0.1)';
}
