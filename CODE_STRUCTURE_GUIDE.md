# Code Structure Guide - Ground Booking App

## Quick Navigation

### Finding Components by Feature

**Grounds/Venues Feature:**
- Pages: `client/src/features/grounds/pages/`
  - `GroundDetailPage.jsx` - Single ground details & booking UI
  - `AdminPage.jsx` - Admin dashboard for ground management
- Components: `client/src/features/grounds/components/`
  - `OperatingHoursConfigurator.jsx` - Configure opening hours
- Services: `client/src/features/grounds/services/`
  - `groundService.js` - API calls for ground data
  - `adminService.js` - Admin operations

**Bookings Feature:**
- Pages: `client/src/features/bookings/pages/`
  - `BookingPage.jsx` - User's booking history & current bookings
- Services: `client/src/features/bookings/services/`
  - `bookingService.js` - Booking API calls

**Account Feature:**
- Pages: `client/src/features/account/pages/`
  - `AccountPage.jsx` - User profile & settings (two-tab interface)

**Global Resources:**
- Shared UI Components: `client/src/components/shared/` (for future use)
- Utilities: `client/src/utils/`
  - `currencyHelper.js` - PKR formatting
  - `dateHelper.js` - Date & timezone utilities
  - `featureIcons.js` - 40+ amenity icon mappings
  - `imageHelper.js` - Image URL handling
- Constants: `client/src/constants/cities.js` - Pakistan cities
- Contexts: `client/src/contexts/AuthContext.jsx` - Global auth state

---

## Backend API Structure

### Route Organization

**Authentication & User Routes:**
```
server/routes/
├── auth.js          # Sign-in, signup
├── profile.js       # User profile CRUD
```

**Public Routes:**
```
├── grounds.js       # Browse grounds with filters
└── operating-hours.js  # Get available booking slots
```

**Booking Management:**
```
└── bookings.js      # Create, cancel, view history
```

**Admin Routes:**
```
└── admin/
    ├── grounds.js   # Ground CRUD operations
    └── stats.js     # Booking statistics
```

### Key API Endpoints

```
Public:
  GET  /api/grounds              - List all grounds
  GET  /api/grounds/:id          - Get ground details
  GET  /api/operating-hours/ground/:groundId/available-slots

Auth:
  POST /api/auth/signin          - Sign in
  POST /api/auth/signup          - Register

User (requires auth):
  GET  /api/profile              - Get user profile
  PUT  /api/profile              - Update profile
  POST /api/bookings             - Create booking
  GET  /api/bookings/user/history - User's bookings
  DELETE /api/bookings/:id       - Cancel booking

Admin (requires auth + admin role):
  POST   /api/admin/grounds      - Create ground
  PUT    /api/admin/grounds/:id  - Update ground
  DELETE /api/admin/grounds/:id  - Delete ground
  PUT    /api/operating-hours/ground/:id/batch  - Batch update hours
  GET    /api/admin/stats        - Statistics
```

---

## Adding New Features

### Step 1: Create Feature Folder
```bash
mkdir -p client/src/features/featureName/{pages,components,services}
```

### Step 2: Create Feature Files
```bash
# Create page component
touch client/src/features/featureName/pages/FeaturePage.jsx

# Create service (if needed)
touch client/src/features/featureName/services/featureService.js
```

### Step 3: Update Imports in App.jsx
```javascript
import FeaturePage from './features/featureName/pages/FeaturePage.jsx';

// Add route
<Route path="/feature" element={<FeaturePage />} />
```

### Step 4: Add Backend Route (if needed)
```bash
# Create new route file
touch server/routes/feature.js

# Add to server/routes/index.js
const featureRouter = require('./feature');
app.use('/api/feature', featureRouter);
```

### Step 5: Create Feature Service
```bash
touch client/src/features/featureName/services/featureService.js
```

---

## Import Path Examples

### Correct Imports by Location

**From GroundDetailPage (3 levels deep):**
```javascript
import { API_BASE_URL } from '../../../config.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { getFeatureIcon } from '../../../utils/featureIcons.js';
import '../../../App.css';
```

**From BookingPage (3 levels deep):**
```javascript
import { API_BASE_URL } from '../../../config.js';
import { useAuth } from '../../../contexts/AuthContext.jsx';
```

**From AdminPage (3 levels deep):**
```javascript
import { useAuth } from '../../../contexts/AuthContext.jsx';
import OperatingHoursConfigurator from '../components/OperatingHoursConfigurator.jsx';
```

**From App.jsx (root level):**
```javascript
import BookingPage from './features/bookings/pages/BookingPage.jsx';
import GroundDetailPage from './features/grounds/pages/GroundDetailPage.jsx';
```

---

## File Organization Principles

### 1. **One Feature Per Folder**
Each feature is self-contained with its own pages, components, and services.

### 2. **Shared Resources at Root**
Global utilities, constants, and contexts live in root `src/` folders.

### 3. **Services Handle All API Calls**
Components don't call APIs directly. They import and use service functions.

### 4. **Clear Import Paths**
Use relative paths within features (`../components/`), use full paths for global resources (`../../../config.js`).

### 5. **Self-Contained Features**
Each feature can theoretically be extracted into its own package without breaking other features.

---

## Common Tasks

### Add a New Admin Function
1. Create route in `server/routes/admin/feature.js`
2. Create service in `server/services/featureService.js`
3. Add route to `server/routes/index.js`
4. Create API service in `client/src/features/featureName/services/`
5. Create component in admin page or feature folder
6. Add route to `App.jsx` if needed

### Add a New Data Table
1. Design schema in `server/db.js`
2. Create routes for CRUD in appropriate route file
3. Create API service on frontend
4. Create pages/components to display data
5. Update types/documentation if using TypeScript

### Refactor Existing Component
1. Locate component in feature folder
2. Update imports to reflect feature-based paths
3. Export related styles from `App.css`
4. Test all imports across the app
5. Commit refactoring changes

---

## Testing the Structure

### Verify All Imports Work
```bash
cd client && npm run dev
# Check for import errors in console
```

### Verify Backend Routes
```bash
cd server && npm start
# Test endpoints with Postman or curl
```

### Verify Feature Isolation
- A feature should only import from global resources or other features
- Services should be the only API-calling components
- Components should be organized by their feature

---

## Maintenance Tips

- **Keep features independent** - Avoid importing between features except through services
- **Update docs when adding features** - Keep this guide current
- **Group related utilities** - Don't scatter small functions across the codebase
- **Use feature folders even for small features** - Consistency matters
- **Extract to services** - Complex logic should be in services, not components

---

Generated: October 29, 2025
Last Updated: October 29, 2025
