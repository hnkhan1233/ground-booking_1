// Import icons from react-icons
import {
  MdLightbulb,
  MdLocalParking,
  MdShower,
  MdSpa,
  MdLock,
  MdWaterDrop,
  MdSportsSoccer,
  MdSportsBaseball,
  MdSportsBasketball,
  MdSportsTennis,
  MdGrass,
  MdLocationCity,
  MdOutlineBalance,
  MdPerson,
  MdRestaurant,
  MdLocalCafe,
  MdLocalDrink,
  MdAccessible,
  MdNightlife,
  MdTimer,
  MdSecurity,
  MdVideocam,
  MdShield,
  MdNature,
  MdHome,
  MdApartment,
  MdEventSeat,
  MdAcUnit,
  MdOpacity,
  MdShowChart,
  MdSpeaker,
  MdSportsFootball,
  MdCheckCircle,
} from 'react-icons/md';

// Feature-to-icon mapping for ground features
export const featureIcons = {
  // Lighting features
  'floodlights': MdLightbulb,
  'flood lights': MdLightbulb,
  'lights': MdLightbulb,
  'lighting': MdLightbulb,
  'night lights': MdNightlife,
  'stadium lights': MdLightbulb,

  // Parking
  'parking': MdLocalParking,
  'parking available': MdLocalParking,
  'free parking': MdLocalParking,
  'covered parking': MdLocalParking,

  // Amenities
  'washrooms': MdShower,
  'restroom': MdShower,
  'shower': MdShower,
  'changing room': MdSpa,
  'locker': MdLock,
  'water': MdWaterDrop,
  'drinking water': MdWaterDrop,

  // Sports equipment
  'equipment': MdSportsSoccer,
  'ball': MdSportsSoccer,
  'balls provided': MdSportsSoccer,
  'cricket equipment': MdSportsBaseball,
  'football': MdSportsFootball,
  'badminton': MdSportsTennis,
  'tennis': MdSportsTennis,

  // Surface type
  'grass': MdGrass,
  'artificial grass': MdGrass,
  'turf': MdGrass,
  'concrete': MdLocationCity,
  'asphalt': MdLocationCity,
  'clay': MdOutlineBalance,
  'wooden': MdOutlineBalance,

  // Services
  'coaching': MdPerson,
  'coach available': MdPerson,
  'trainer': MdPerson,
  'food': MdRestaurant,
  'cafe': MdLocalCafe,
  'canteen': MdRestaurant,
  'beverages': MdLocalDrink,
  'drinks': MdLocalDrink,

  // Access
  'wheelchair accessible': MdAccessible,
  'accessible': MdAccessible,
  'disabled access': MdAccessible,
  'night access': MdNightlife,
  '24/7': MdTimer,
  'open 24 hours': MdTimer,

  // Security
  'security': MdSecurity,
  'cctv': MdVideocam,
  'camera': MdVideocam,
  'surveillance': MdVideocam,
  'guards': MdShield,
  'safe': MdLock,

  // Venue type
  'open': MdNature,
  'outdoor': MdNature,
  'uncovered': MdNature,
  'indoor': MdHome,
  'covered': MdApartment,
  'enclosed': MdApartment,

  // Other
  'spectator seating': MdEventSeat,
  'seating': MdEventSeat,
  'air conditioned': MdAcUnit,
  'ac': MdAcUnit,
  'ventilation': MdOpacity,
  'scoreboard': MdShowChart,
  'sound system': MdSpeaker,
  'net': MdSportsSoccer,
  'goals': MdSportsSoccer,
};

// Get icon component for a feature
export function getFeatureIcon(featureName) {
  if (!featureName) return MdCheckCircle;

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
  return MdCheckCircle;
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
