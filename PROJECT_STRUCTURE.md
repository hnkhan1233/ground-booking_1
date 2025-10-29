# Ground Booking App - Project Structure

## Overview
This is a full-stack ground booking application built with React (frontend) and Node.js/Express (backend). The app allows users to browse sports grounds, make bookings, and admins to manage ground listings.

---

## Frontend Structure (`client/src`)

### Features-Based Architecture
The frontend is organized by feature modules, making it easy to locate and maintain code related to specific functionalities.

```
src/
├── features/
│   ├── grounds/                 # Ground browsing & management
│   │   ├── pages/
│   │   │   ├── GroundDetailPage.jsx    # Ground details & booking interface
│   │   │   ├── AdminPage.jsx           # Admin dashboard for managing grounds
│   │   └── components/
│   │   │   └── OperatingHoursConfigurator.jsx  # Configure opening hours
│   │   └── services/
│   │       ├── groundService.js        # API calls for ground data
│   │       └── adminService.js         # API calls for admin operations
│   │
│   ├── bookings/                # Booking management
│   │   ├── pages/
│   │   │   └── BookingPage.jsx         # User's booking history
│   │   └── services/
│   │       └── bookingService.js       # Booking-related API calls
│   │
│   ├── account/                 # User account management
│   │   └── pages/
│   │       └── AccountPage.jsx         # User profile & account settings
│   │
│   └── auth/                    # (Reserved for future auth features)
│       ├── pages/
│       └── services/
│
├── components/
│   ├── shared/                  # Reusable UI components (future)
│   ├── admin/                   # Admin-specific components
│   ├── auth/                    # Auth-specific components
│   ├── booking/                 # Booking-specific components
│   ├── common/                  # Common components (UI elements)
│   └── profile/                 # Profile-specific components
│
├── contexts/
│   └── AuthContext.jsx          # Global authentication state (Firebase)
│
├── hooks/                       # Custom React hooks (future)
│
├── services/
│   ├── api.js                   # Base API client with Firebase auth
│   └── authService.js           # Authentication service
│
├── utils/
│   ├── currencyHelper.js        # Currency formatting (PKR)
│   ├── dateHelper.js            # Date utilities & timezone handling
│   ├── featureIcons.js          # Feature-to-icon mappings (40+ amenities)
│   └── imageHelper.js           # Image URL resolution & optimization
│
├── constants/
│   └── cities.js                # Pakistan cities list
│
├── layouts/                     # Layout components (future)
├── docs/                        # Documentation files
├── App.jsx                      # Main app component & routing
├── App.css                      # Global & component styles
├── firebase.js                  # Firebase configuration
├── main.jsx                     # App entry point
└── config.js                    # App configuration
```

### Key Features by Module

#### `grounds/`
- **GroundDetailPage**: Shows ground details, photos, features, and booking interface
- **AdminPage**: Complete dashboard for admins to:
  - Add/edit/delete grounds
  - Configure opening hours per day (15m-120m slots)
  - Manage ground features (Surface, Venue Type, Team Format, etc.)
  - Upload cover photos and gallery images
  - View booking statistics
- **OperatingHoursConfigurator**: Reusable component for hour configuration with "Apply to All Days" feature

#### `bookings/`
- **BookingPage**: Shows user's booking history with total spent amount

#### `account/`
- **AccountPage**: Two-tab interface for:
  - Account information (profile, sign in/out)
  - Booking history with detailed stats

---

## Backend Structure (`server`)

### Modular Routes Architecture
Routes are organized by feature/domain for clean separation of concerns.

```
server/
├── index.js                     # Main entry point & server setup
├── db.js                        # Database initialization (SQLite)
├── firebase.js                  # Firebase Admin SDK config
│
├── middleware/
│   └── auth.js                  # Firebase token verification middleware
│
├── routes/
│   ├── index.js                 # Route aggregator
│   ├── auth.js                  # Authentication (sign-in, registration)
│   ├── grounds.js               # Public ground browsing API
│   ├── bookings.js              # Booking creation, cancellation, history
│   ├── profile.js               # User profile operations
│   ├── operating-hours.js       # Operating hours configuration
│   │
│   └── admin/
│       ├── grounds.js           # Admin ground management (CRUD)
│       └── stats.js             # Admin statistics & analytics
│
├── services/
│   └── emailService.js          # Email notifications (booking confirmations)
│
├── config/
│   └── multer.js                # File upload configuration for images
│
├── utils/
│   ├── constants.js             # Sport categories, features, etc.
│   ├── validators.js            # Input validation functions
│   └── imageHelper.js           # Image handling & storage
│
├── middleware/
│   └── auth.js                  # Firebase authentication middleware
│
└── data/
    └── ground-booking.db        # SQLite database
```

### Database Schema

**Tables:**
- `grounds` - Ground details (name, location, price, features, images)
- `bookings` - Booking records (ground_id, user_id, date, time, status)
- `ground_operating_hours` - Operating hours per day (6 records per ground)

### API Endpoints

#### Public Routes
- `GET /api/grounds` - List all grounds with filters
- `GET /api/grounds/:id` - Get ground details
- `GET /api/operating-hours/ground/:groundId/available-slots` - Get available booking slots

#### Authentication Routes
- `POST /api/auth/signin` - Sign in with email/password
- `POST /api/auth/signup` - Register new user

#### User Routes (Requires Auth)
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile
- `POST /api/bookings` - Create booking
- `GET /api/bookings/user/history` - Get user's booking history
- `DELETE /api/bookings/:bookingId` - Cancel booking

#### Admin Routes (Requires Admin Role)
- `POST /api/admin/grounds` - Create ground
- `PUT /api/admin/grounds/:groundId` - Update ground
- `DELETE /api/admin/grounds/:groundId` - Delete ground
- `PUT /api/operating-hours/ground/:groundId/batch` - Batch update operating hours
- `GET /api/admin/stats` - Get booking statistics

---

## Key Technologies

### Frontend
- **React 18** - UI library with hooks
- **React Router** - Client-side routing
- **Firebase Auth** - Authentication
- **Vite** - Build tool & dev server
- **CSS3** - Styling with glassmorphism effects

### Backend
- **Node.js + Express** - Server framework
- **SQLite** - Lightweight database
- **Firebase Admin SDK** - Server-side auth
- **Multer** - File upload handling
- **Nodemailer** - Email notifications
- **CORS** - Cross-origin resource sharing

---

## Common Tasks for Future Development

### Adding a New Feature
1. Create feature folder: `src/features/featureName/`
2. Add pages, components, services subfolders
3. Move related components into feature folder
4. Create feature-specific API service
5. Update imports in App.jsx routing

### Adding a New Admin Function
1. Add route in `server/routes/admin/*.js`
2. Create service function in `server/services/`
3. Create corresponding feature page/component
4. Add API call in feature service
5. Add middleware check for admin role

### Adding Database Entities
1. Define table schema in `server/db.js`
2. Create routes for CRUD operations
3. Create corresponding API service on frontend
4. Build UI components using the service

---

## Development Workflow

### Starting Servers
```bash
# Terminal 1 - Backend
cd server && npm start  # Runs on http://localhost:4000

# Terminal 2 - Frontend
cd client && npm run dev  # Runs on http://localhost:5173 (or 5174 if 5173 in use)
```

### File Organization Guidelines
- **One feature per folder** - All related code in one place
- **Services handle API** - Never call APIs directly in components
- **Utils for reusable logic** - Functions used across features
- **Features are self-contained** - Can be extracted into separate packages if needed

---

## Important Notes

- **Dark theme**: Uses radial gradients and glassmorphism effects
- **Pakistan-focused**: Currency in PKR, cities are Pakistani, timezone is UTC+5
- **Email notifications**: Gmail SMTP for booking confirmations
- **Image handling**: Supports cover photos and gallery images per ground
- **Operating hours**: Flexible per-day configuration with custom slot durations

---

## Next Steps for Improvements
- [ ] Add error boundaries for better error handling
- [ ] Create shared UI component library
- [ ] Add unit tests and integration tests
- [ ] Implement caching strategy
- [ ] Add analytics tracking
- [ ] Create admin analytics dashboard improvements
- [ ] Add review/rating system
- [ ] Implement payment integration
