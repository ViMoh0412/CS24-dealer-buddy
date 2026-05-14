# Carsale24 Dealer Buddy -- Architecture Document

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Directory Structure](#2-directory-structure)
3. [Database Schema](#3-database-schema)
4. [Matching Engine Pipeline](#4-matching-engine-pipeline)
5. [Authentication](#5-authentication)
6. [PWA Architecture](#6-pwa-architecture)
7. [Deployment](#7-deployment)
8. [API Endpoints](#8-api-endpoints)

---

## 1. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js | Server-side JavaScript |
| Web Framework | Express.js 4.x | HTTP routing, middleware, static file serving |
| Database | SQLite via better-sqlite3 | Synchronous, embedded, single-file database |
| File Parsing | xlsx, csv-parse | Excel and CSV import support |
| Push Notifications | Firebase Admin SDK | Firebase Cloud Messaging (FCM) for push delivery |
| Scheduling | node-cron | Cron-based scheduling for daily matching and push |
| File Uploads | multer | In-memory multipart file upload handling |
| Security | helmet | HTTP security headers |
| Logging | morgan | HTTP request logging |
| Frontend (Admin) | Single-file HTML | Vanilla JavaScript, no build step, CSS-in-HTML |
| Frontend (Dealer) | Single-file HTML PWA | Vanilla JavaScript, service worker, manifest.json |
| Internationalization | Custom i18n module | JSON-based translations (English and German) |

### Key Design Decisions

- **Single-file HTML frontends:** Both the admin dashboard and dealer app are implemented as single HTML files with inline CSS and JavaScript. This eliminates the need for a frontend build pipeline and simplifies deployment.
- **Synchronous SQLite:** better-sqlite3 is used instead of async SQLite bindings. All database operations are synchronous, which simplifies the matching engine logic and eliminates callback complexity. This is appropriate for the expected load (dozens of dealers, not thousands of concurrent users).
- **No ORM:** Raw SQL with prepared statements is used throughout. This provides full control over queries and avoids abstraction overhead.

---

## 2. Directory Structure

```
backend/
  package.json              # Dependencies and scripts
  .env                      # Environment variables (APP_PASSWORD, etc.)
  .gitignore                # Excludes node_modules, .env, *.db
  data/                     # SQLite database file and seed data
  node_modules/             # Dependencies (not committed)
  public/
    admin/
      index.html            # Admin dashboard (single-file SPA)
    app/
      index.html            # Dealer PWA (single-file SPA)
      manifest.json         # PWA manifest
      sw.js                 # Service worker
      icons/
        icon-192.png        # PWA icon (192x192)
        icon-512.png        # PWA icon (512x512)
  src/
    index.js                # Express server, middleware, cron jobs, entry point
    migrate.js              # Database schema creation and default data seeding
    seed.js                 # Sample data seeder for development
    run-matching.js         # CLI script to run matching manually
    config/
      database.js           # SQLite connection management (getDb, closeDb)
    i18n/
      translations.js       # English and German translation strings
    routes/
      api-admin.js          # Admin API routes (/api/admin/*)
      api-dealers.js        # Dealer API routes (/api/dealers/*)
    services/
      matching-engine.js    # 8-dimension scoring engine
      csv-importer.js       # CSV/Excel file parser and database importer
      push-service.js       # Firebase push notification sender
```

---

## 3. Database Schema

The application uses a single SQLite database file. All tables are created by `src/migrate.js` using `CREATE TABLE IF NOT EXISTS`, making the migration idempotent.

### 3.1 Tables Overview

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `dealers` | Master dealer records | Referenced by all dealer-related tables via `dealer_id` |
| `vehicles` | Active vehicle listings | Referenced by `match_results` and `dealer_actions` via `vehicle_id` |
| `purchase_history` | Historical dealer purchases | FK to `dealers.dealer_id` |
| `dealer_profiles` | Computed behavioral profiles | FK to `dealers.dealer_id`, one-to-one |
| `match_results` | Daily matching output | FK to `dealers.dealer_id` and `vehicles.vehicle_id` |
| `dealer_actions` | Dealer feedback (contact/decline) | FK to `dealers.dealer_id` |
| `dealer_search_profiles` | Explicit dealer preferences | FK to `dealers.dealer_id` |
| `matching_config` | Admin-adjustable weights and thresholds | Standalone key-value store |
| `matching_runs` | Audit log of matching executions | Standalone |
| `push_log` | Push notification delivery log | FK to `dealers.dealer_id` |

### 3.2 Table Details

#### dealers

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | Internal row ID |
| dealer_id | TEXT | UNIQUE, NOT NULL | Business identifier (e.g., "D001") |
| company_name | TEXT | NOT NULL | Dealer company name |
| postal_code | TEXT | NOT NULL | Location postal code |
| email | TEXT | | Contact email |
| phone | TEXT | | Contact phone |
| specialization | TEXT | | Vehicle specialty description |
| max_pickup_radius_km | INTEGER | DEFAULT 200 | Maximum travel distance for pickup |
| push_device_token | TEXT | | Firebase Cloud Messaging device token |
| push_enabled | INTEGER | DEFAULT 1 | Whether push notifications are active (0/1) |
| push_time | TEXT | DEFAULT '07:00' | Preferred push notification time |
| max_recommendations_per_day | INTEGER | DEFAULT 10 | Max matches to receive per day |
| preferred_lang | TEXT | DEFAULT 'de' | Language preference (en/de) |
| created_at | TEXT | DEFAULT datetime('now') | Record creation timestamp |
| updated_at | TEXT | DEFAULT datetime('now') | Last update timestamp |

#### vehicles

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | Internal row ID |
| vehicle_id | TEXT | UNIQUE, NOT NULL | Business identifier |
| make | TEXT | NOT NULL | Brand/manufacturer |
| model | TEXT | NOT NULL | Model name |
| body_type | TEXT | NOT NULL | Body type (Kombi, Limousine, SUV, etc.) |
| price | REAL | NOT NULL | Listing price in EUR |
| first_registration | TEXT | | First registration date |
| year | INTEGER | | Model year |
| mileage_km | INTEGER | | Odometer reading in km |
| fuel_type | TEXT | | Fuel type |
| transmission | TEXT | | Transmission type |
| postal_code | TEXT | | Vehicle location postal code |
| condition_notes | TEXT | | Condition notes |
| image_url | TEXT | | URL to vehicle photo |
| hsn_tsn | TEXT | | German HSN/TSN classification code |
| listed_at | TEXT | DEFAULT datetime('now') | When the listing was created |
| is_active | INTEGER | DEFAULT 1 | Active flag (0/1) |
| created_at | TEXT | DEFAULT datetime('now') | Record creation timestamp |

**Indexes:** `idx_vehicles_active` (is_active), `idx_vehicles_make` (make), `idx_vehicles_price` (price)

#### purchase_history

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | Internal row ID |
| transaction_id | TEXT | UNIQUE, NOT NULL | Unique transaction reference |
| dealer_id | TEXT | NOT NULL, FK | Reference to dealers.dealer_id |
| purchased_make | TEXT | NOT NULL | Brand of vehicle purchased |
| purchased_model | TEXT | NOT NULL | Model of vehicle purchased |
| purchased_body_type | TEXT | NOT NULL | Body type of vehicle purchased |
| purchase_price | REAL | NOT NULL | Purchase price in EUR |
| purchased_at | TEXT | NOT NULL | Date of purchase |
| purchased_year | INTEGER | | Year of vehicle |
| purchased_mileage | INTEGER | | Mileage at purchase |
| purchased_fuel | TEXT | | Fuel type |
| created_at | TEXT | DEFAULT datetime('now') | Record creation timestamp |

**Indexes:** `idx_ph_dealer` (dealer_id), `idx_ph_date` (purchased_at)

#### dealer_profiles

Computed table -- rebuilt from `purchase_history` by the matching engine.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| dealer_id | TEXT | UNIQUE, FK to dealers |
| top_makes | TEXT | JSON array of top 5 purchased brands |
| top_models | TEXT | JSON array of top 10 purchased models |
| body_types | TEXT | JSON array of top 5 body types |
| price_min | REAL | Lowest purchase price |
| price_max | REAL | Highest purchase price |
| price_p25 | REAL | 25th percentile price |
| price_p75 | REAL | 75th percentile price |
| year_min | INTEGER | Earliest vehicle year purchased |
| year_max | INTEGER | Latest vehicle year purchased |
| mileage_avg | INTEGER | Average mileage of purchases |
| mileage_max | INTEGER | Maximum mileage purchased |
| fuel_types | TEXT | JSON array of top 4 fuel types |
| total_purchases | INTEGER | Total purchase count |
| last_purchase | TEXT | Date of most recent purchase |
| computed_at | TEXT | When the profile was last rebuilt |

#### match_results

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| run_date | TEXT | Date of the matching run (YYYY-MM-DD) |
| dealer_id | TEXT | FK to dealers |
| vehicle_id | TEXT | FK to vehicles |
| match_score | REAL | Final computed score (0-100) |
| score_breakdown | TEXT | JSON object with per-dimension scores |
| match_reasons | TEXT | JSON array of human-readable reason labels |
| status | TEXT | Workflow status: pending, approved, pushed, skipped |
| created_at | TEXT | Record creation timestamp |

**Indexes:** `idx_mr_run` (run_date), `idx_mr_dealer` (dealer_id), `idx_mr_status` (status)

**Status Lifecycle:** `pending` --> `approved` (by admin or auto) --> `pushed` (after notification sent) or `skipped` (manually removed)

#### dealer_actions

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| dealer_id | TEXT | FK to dealers |
| vehicle_id | TEXT | Vehicle acted upon |
| action_type | TEXT | "contact" or "not_interested" |
| decline_reason | TEXT | Reason for declining (e.g., "price_too_high") |
| external_link | TEXT | URL pasted by dealer during feedback |
| created_at | TEXT | When the action was taken |

**Indexes:** `idx_da_dealer` (dealer_id), `idx_da_type` (action_type)

#### dealer_search_profiles

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| dealer_id | TEXT | FK to dealers |
| wanted_makes | TEXT | JSON array of desired brands |
| wanted_models | TEXT | JSON array of desired models |
| wanted_types | TEXT | JSON array of desired body types |
| wanted_fuels | TEXT | JSON array of desired fuel types |
| price_min | REAL | Minimum budget |
| price_max | REAL | Maximum budget |
| year_min | INTEGER | Minimum acceptable year |
| mileage_max | INTEGER | Maximum acceptable mileage |
| created_at | TEXT | Record creation timestamp |
| updated_at | TEXT | Last update timestamp |

#### matching_config

Key-value store for admin-adjustable parameters.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| key | TEXT | UNIQUE, configuration key name |
| value | REAL | Configuration value |
| description | TEXT | Human-readable description |
| updated_at | TEXT | Last update timestamp |

**Default Entries:**

| Key | Default | Description |
|-----|---------|-------------|
| weight_brand | 25 | Brand match weight (%) |
| weight_model | 15 | Model match weight (%) |
| weight_type | 10 | Vehicle type match weight (%) |
| weight_price | 20 | Price in bandwidth weight (%) |
| weight_year | 10 | Year range weight (%) |
| weight_mileage | 8 | Mileage within limit weight (%) |
| weight_fuel | 5 | Fuel type match weight (%) |
| weight_distance | 7 | Distance/location weight (%) |
| bonus_freshness | 5 | Freshness bonus for newly listed vehicles |
| bonus_recency | 8 | Recency boost for active buyers |
| penalty_declined | 15 | Penalty for previously declined similar vehicles |
| min_match_score | 70 | Minimum score to include in recommendations |
| max_per_dealer | 10 | Maximum vehicles per dealer per day |
| auto_run_time | 6.5 | Auto-run matching time (6.5 = 06:30) |
| auto_push_time | 7 | Auto-push time (7 = 07:00) |
| require_approval | 1 | Require manual approval before push (0/1) |

#### matching_runs

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| run_date | TEXT | Date of the run |
| vehicles_count | INTEGER | Number of active vehicles processed |
| dealers_count | INTEGER | Number of dealers with profiles |
| matches_total | INTEGER | Total matches generated |
| matches_pushed | INTEGER | Total matches pushed |
| status | TEXT | pending, running, completed, failed |
| started_at | TEXT | When the run started |
| completed_at | TEXT | When the run finished |
| created_at | TEXT | Record creation timestamp |

#### push_log

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| dealer_id | TEXT | FK to dealers |
| match_ids | TEXT | JSON array of match_result IDs included |
| payload | TEXT | JSON push notification payload sent |
| status | TEXT | queued, sent, failed, no_token, opened |
| sent_at | TEXT | When the push was sent |
| opened_at | TEXT | When the dealer opened the notification |
| created_at | TEXT | Record creation timestamp |

---

## 4. Matching Engine Pipeline

The matching engine (`src/services/matching-engine.js`) executes in two phases:

### 4.1 Phase 1: Build Dealer Profiles

```
purchase_history --> aggregate per dealer --> dealer_profiles (upsert)
```

For each dealer in the `dealers` table:

1. Fetch all rows from `purchase_history` for that dealer
2. Count frequencies of each make, model, body type, and fuel type
3. Extract the top N items from each category (top 5 makes, top 10 models, etc.)
4. Compute price statistics: min, max, 25th percentile, 75th percentile
5. Compute year range: min, max
6. Compute mileage statistics: average, max
7. Record total purchase count and most recent purchase date
8. Upsert into `dealer_profiles` (INSERT ... ON CONFLICT DO UPDATE)

This runs inside a single SQLite transaction for atomicity.

### 4.2 Phase 2: Score and Match

```
vehicles (active) x dealer_profiles (push_enabled) --> score matrix --> filter --> top N --> match_results
```

1. Create a `matching_runs` record with status "running"
2. Load all active vehicles (`is_active = 1`)
3. Load all dealer profiles joined with dealer data (only where `push_enabled = 1`)
4. Load configurable weights from `matching_config`
5. For each dealer profile:
   a. Load the dealer's recent declines (last 30 days) from `dealer_actions`
   b. Load the dealer's latest search profile from `dealer_search_profiles`
   c. For each active vehicle, compute the 8-dimension score plus bonuses/penalties
   d. Filter out matches below `min_match_score`
   e. Sort by score descending
   f. Take the top `max_per_dealer` matches
   g. Insert into `match_results` with status "pending"
6. Update the `matching_runs` record with final counts and status "completed"

The entire scoring and insertion runs inside a single SQLite transaction.

### 4.3 Score Computation Flow

```
For each (vehicle, dealer) pair:
  1. Brand score      (0-100) x weight_brand / 100
  2. Model score      (0-100) x weight_model / 100
  3. Body type score  (0-100) x weight_type / 100
  4. Price score      (0-100) x weight_price / 100
  5. Year score       (0-100) x weight_year / 100
  6. Mileage score    (0-100) x weight_mileage / 100
  7. Fuel score       (0-100) x weight_fuel / 100
  8. Distance score   (0-100) x weight_distance / 100
  = Weighted sum
  + bonus_freshness   (if listed < 48h ago)
  + bonus_recency     (if dealer bought in last 30 days)
  - penalty_declined  (if dealer declined same make+model in last 30 days)
  + explicit_boost    (up to +10, from search profile matches)
  = Final score (clamped 0-100)
```

### 4.4 Post-Matching Workflow

```
match_results (pending)
  --> Admin approves --> (approved)
  --> Push service sends notification --> (pushed)
  --> Dealer acts --> dealer_actions (contact / not_interested)
  --> Feedback feeds next day's matching
```

---

## 5. Authentication

### 5.1 Current Implementation

The application uses HTTP Basic Authentication with a shared password.

- The password is set via the `APP_PASSWORD` environment variable
- If `APP_PASSWORD` is empty or unset, authentication is disabled (all routes are open)
- The Basic Auth middleware checks only the password field; the username is ignored
- Protected paths: `/admin/*` and `/app/*` (static file serving)
- API routes (`/api/*`) are currently unprotected (no auth middleware applied)

```
Client Request
  --> Authorization: Basic base64(username:password)
  --> Server extracts password from header
  --> Compares against APP_PASSWORD
  --> 200 OK or 401 Unauthorized
```

### 5.2 PWA Asset Exceptions

Certain PWA assets are served without authentication so that the browser/OS can access them before the user logs in:

- `/app/manifest.json` -- Required by the browser to display install prompts
- `/app/sw.js` -- Service worker must be accessible for registration
- `/app/icons/*` -- App icons for home screen and splash screen

### 5.3 Planned: Per-Dealer Authentication

A future release will add individual dealer credentials:

- Each dealer will have a `dealer_id` + `password` combination
- The dealer app will present a login screen
- API routes will require a dealer-specific auth token
- Admin routes will retain the shared password or move to role-based access

---

## 6. PWA Architecture

### 6.1 Manifest (`public/app/manifest.json`)

| Property | Value |
|----------|-------|
| name | Dealer Buddy -- carsale24 |
| short_name | Dealer Buddy |
| start_url | /app/ |
| scope | /app/ |
| display | standalone |
| orientation | portrait |
| theme_color | #077DB7 |
| background_color | #f5f7fa |
| categories | business, automotive |
| icons | 192x192, 512x512 (PNG, any + maskable) |

### 6.2 Service Worker (`public/app/sw.js`)

The service worker implements a **stale-while-revalidate with network-first for API** caching strategy.

**Install Phase:**
Precaches the app shell:
- `/app/`
- `/app/index.html`
- `/app/manifest.json`
- `/app/icons/icon-192.png`
- `/app/icons/icon-512.png`

After precaching, calls `self.skipWaiting()` to activate immediately.

**Activate Phase:**
Deletes any old cache versions (caches with names other than the current `dealer-buddy-v1`), then calls `self.clients.claim()` to take control of all open pages.

**Fetch Strategy:**

For API requests (`/api/*`):
- **Network-first:** Attempt to fetch from network
- On success: cache the response, return it to the client
- On failure: fall back to the cached response (offline support)

For all other requests (HTML, CSS, images):
- **Cache-first with background revalidate:** Check cache first
- If cached: return cached version, simultaneously fetch fresh copy and update cache
- If not cached: fetch from network, cache it, return to client
- If both fail: return undefined (browser shows offline page)

### 6.3 Registration

The service worker is registered in `public/app/index.html` on page load:

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' });
}
```

The scope is restricted to `/app/` to avoid interfering with the admin dashboard.

---

## 7. Deployment

### 7.1 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_PASSWORD` | Recommended | Shared password for Basic Auth (empty = no auth) |
| `PORT` | No | HTTP port (default: 3001) |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Path to Firebase service account JSON (for push) |

### 7.2 Railway Deployment

The application is designed for one-click deployment on Railway:

1. Railway detects `package.json` and runs `npm install`
2. The `postinstall` script runs automatically:
   ```
   node src/migrate.js && node src/seed.js && node src/run-matching.js --approve
   ```
   This creates the database schema, seeds sample data, and runs an initial matching pass.
3. Railway starts the app with `npm start` (which runs `node src/index.js`)
4. Set `APP_PASSWORD` in Railway's environment variables

### 7.3 NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `node src/index.js` | Start the production server |
| `dev` | `nodemon src/index.js` | Start with auto-reload for development |
| `migrate` | `node src/migrate.js` | Run database migrations |
| `seed` | `node src/seed.js` | Seed sample data |
| `match:run` | `node src/run-matching.js` | Run matching engine from CLI |
| `postinstall` | migrate + seed + match:run --approve | Auto-setup after `npm install` |

### 7.4 Database Location

The SQLite database is stored in `data/dealer-buddy.db` (or as configured in `src/config/database.js`). The `data/` directory must be writable. On Railway, this persists across deploys if a volume is attached.

---

## 8. API Endpoints

### 8.1 Admin Routes (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats: active vehicles, dealers, contact rate, push count, latest run, dealer engagement |
| POST | `/api/admin/import/vehicles` | Upload vehicle listings CSV/Excel file |
| POST | `/api/admin/import/purchases` | Upload purchase history CSV/Excel file |
| POST | `/api/admin/import/dealers` | Upload dealer master data CSV/Excel file |
| POST | `/api/admin/import/sales-performance` | Upload sales performance data + auto-rebuild profiles |
| GET | `/api/admin/sales-performance/summary` | Summary stats: total transactions, dealers, date range, top makes, monthly volume, dealer breakdown |
| GET | `/api/admin/matching/config` | Get all matching configuration key-value pairs |
| PUT | `/api/admin/matching/config` | Update matching weights. Body: `{ weights: { key: value, ... } }` |
| POST | `/api/admin/matching/build-profiles` | Rebuild all dealer profiles from purchase history |
| POST | `/api/admin/matching/run` | Run the matching engine. Optional body: `{ date: "YYYY-MM-DD" }` |
| GET | `/api/admin/runs` | List the last 30 matching runs |
| GET | `/api/admin/runs/:date/results` | Get matching results grouped by dealer for a specific date |
| GET | `/api/admin/runs/:date/dealer/:dealerId` | Get individual vehicle matches for a specific dealer and date |
| POST | `/api/admin/runs/:date/approve` | Approve matches. Body: `{}` (all), `{ dealer_id }` (one dealer), or `{ match_ids: [...] }` (specific matches) |
| POST | `/api/admin/runs/:date/skip` | Skip matches. Body: `{ dealer_id }` or `{ match_ids: [...] }` |
| POST | `/api/admin/runs/:date/remove-match` | Remove a single match. Body: `{ match_id }` |
| POST | `/api/admin/push/send` | Send push notifications for approved matches. Optional body: `{ date }` |
| GET | `/api/admin/push/log` | Get the last 100 push notification log entries |
| GET | `/api/admin/intelligence/decline-reasons` | Aggregated decline reasons from the last 30 days |
| GET | `/api/admin/intelligence/external-links` | External links pasted by dealers during feedback (last 50) |
| GET | `/api/admin/intelligence/search-profiles` | All dealer search profiles |
| GET | `/api/admin/vehicles` | Paginated list of active vehicles. Query params: `page`, `limit` |
| POST | `/api/admin/vehicles/deactivate-old` | Deactivate vehicles listed more than 30 days ago |

### 8.2 Dealer Routes (`/api/dealers`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dealers` | List all dealers with profiles, contact counts, and decline counts |
| GET | `/api/dealers/:id` | Single dealer detail with profile, search profile, and recent actions |
| GET | `/api/dealers/:id/matches` | Today's approved/pushed matches for a dealer. Query params: `lang`, `date` |
| POST | `/api/dealers/:id/action` | Record a dealer action. Body: `{ vehicle_id, action_type, decline_reason?, external_link? }` |
| POST | `/api/dealers/:id/search-profile` | Save dealer search preferences. Body: `{ wanted_makes, wanted_models, wanted_types, wanted_fuels, price_min, price_max, year_min, mileage_max }` |
| GET | `/api/dealers/:id/profile` | Dealer profile for app display. Query param: `lang` |

### 8.3 General Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check: status, version, vehicle count, dealer count |
| GET | `/api/i18n/:lang` | Get translation strings for a language (en or de) |

### 8.4 Static Routes

| Path | Auth | Description |
|------|------|-------------|
| `/admin/*` | Yes (Basic Auth) | Admin dashboard SPA |
| `/app/manifest.json` | No | PWA manifest (must be accessible pre-login) |
| `/app/sw.js` | No | Service worker (must be accessible pre-login) |
| `/app/icons/*` | No | PWA icons (must be accessible pre-login) |
| `/app/*` | Yes (Basic Auth) | Dealer PWA |
