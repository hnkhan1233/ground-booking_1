# Ground Booking Platform

Full-stack web app for booking sports grounds across Pakistan. It ships with an Express + SQLite backend and a React (Vite) frontend that highlights real-time slot availability per ground.

## Tech Stack

- Backend: Node.js, Express, better-sqlite3
- Database: SQLite (stored locally under `server/data/ground-booking.db`)
- Frontend: React 19 with Vite 5

## Getting Started

```bash
git clone <repo>  # if needed
cd ground-booking
```

### Backend

```bash
cd server
npm install
npm start
```

The API runs on `http://localhost:4000` and seeds a handful of popular grounds in Karachi, Lahore, Islamabad, and Rawalpindi on first launch. Uploaded images are stored on disk under `server/uploads/` and exposed via `http://localhost:4000/uploads/<filename>`, so make sure the process has write permission to that directory in production.

Configure Firebase + admin access via environment variables (create a `.env` file inside `server/` or export them before `npm start`):

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@example.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nPASTE_KEY_LINES\n-----END PRIVATE KEY-----\n"
ADMIN_EMAILS=owner@example.com,manager@example.com   # comma-separated list of authorised admin emails
PORT=4000                                            # optional override
```

> **Tip:** In the private key value, keep the `\n` escape sequence—`firebase.js` converts it into real newlines at runtime.

### Frontend

```bash
cd client
npm install
npm run dev
```

By default, the UI expects the API at `http://localhost:4000`. To target another host, create a `.env` file in `client/`:

```
VITE_API_URL=https://your-domain.example.com
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
```

Build the production bundle with:

```bash
npm run build
```

> **Node requirement:** Vite 5 requires Node.js ≥ 18.0.0. Upgrade Node.js locally if the dev server refuses to start.

## Admin Dashboard

Browse to `http://localhost:5173/admin` (or the deployed URL with `/admin`) and sign in with Firebase (email/password, Google, or phone number). The backend checks every authenticated user against `ADMIN_EMAILS` (or a custom Firebase claim) before granting access. Once authorised you can:

- Create new grounds with name, pre-loaded Pakistani city options, location, price/hour, description, and a locally uploaded photo (JPEG/PNG/WebP/AVIF up to 5 MB).
- Update existing grounds inline; upload a replacement photo or tweak text, and the public booking page refreshes instantly.
- Delete grounds that have no active bookings (confirmed reservations must be cancelled first).

Bookings now require a signed-in Firebase user as well. Visitors can browse grounds and select slots first; when they confirm, the UI prompts them to sign in or create an account (email/password, Google, or phone) and then posts the booking with their ID token.

Each user maintains a profile (name + phone) stored on the server. If those details are missing, the booking flow opens a quick prompt so the information can be captured before confirming. Users can revisit and update their details anytime on `/account`.

## API Overview

- `GET /api/grounds` – list ground metadata.
- `GET /api/grounds/:id/availability?date=YYYY-MM-DD` – flag each slot as available or booked.
- `POST /api/bookings` – confirm a booking. Requires `{ groundId, date, slot, customerName, customerPhone }` and a Firebase ID token in the `Authorization: Bearer <token>` header.
- `DELETE /api/bookings/:id` – cancel a confirmed booking (slot is released again).
- `GET /api/bookings` – simple feed of all bookings (admin token required).
- `GET /api/admin/grounds` – authenticated ground list for the admin UI.
- `POST /api/admin/grounds` – create a new ground (admin token required).
- `PUT /api/admin/grounds/:id` – update ground attributes.
- `DELETE /api/admin/grounds/:id` – remove a ground if there are no active bookings.
- `GET /api/auth/me` – returns the authenticated user profile plus `isAdmin` flag.
- `GET /api/profile` – fetch the authenticated user’s saved contact details (requires login).
- `PUT /api/profile` – upsert the user’s name and phone number used for bookings.

All bookings default to hourly slots between 06:00 and 23:00 PKT. Slot clashes are prevented at the database layer.

## Next Ideas

- Add SMS confirmations via Twilio after a successful booking.
- Gate cancellation behind a secure admin token or user account.
- Extend slot granularity (e.g., 30-minute windows) with configurable per-ground hours.
