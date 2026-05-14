# Carsale24 Dealer Buddy -- User Manual

## Table of Contents

1. [Overview](#1-overview)
2. [Getting Started](#2-getting-started)
3. [Admin Dashboard](#3-admin-dashboard)
4. [Dealer App (PWA)](#4-dealer-app-pwa)
5. [Data Import Formats](#5-data-import-formats)
6. [Matching Engine](#6-matching-engine)
7. [Daily Workflow](#7-daily-workflow)
8. [PWA Installation](#8-pwa-installation)
9. [Dealer Management](#9-dealer-management)

---

## 1. Overview

Carsale24 Dealer Buddy is an intelligent vehicle-matching platform that connects active vehicle listings with the dealers most likely to buy them. The system analyzes each dealer's historical purchasing behavior -- preferred brands, price ranges, body types, mileage tolerance, fuel preferences, and geographic proximity -- to generate personalized daily recommendations.

### Who Is It For?

| Role | What They Do |
|------|-------------|
| **Admin (Back Office)** | Imports vehicle and sales data, configures matching weights, reviews and approves daily match results, monitors dealer engagement |
| **Dealer** | Receives daily vehicle recommendations via push notification, reviews matches, contacts sellers for vehicles of interest, provides feedback on irrelevant matches |

### How It Works

1. Vehicle inventory is imported from CSV/Excel files.
2. Dealer purchase history is imported and analyzed to build behavioral profiles.
3. Every morning at 06:30, the matching engine scores every active vehicle against every dealer profile across 8 dimensions.
4. An admin reviews and approves the matches (or auto-approval is enabled).
5. At 07:00, push notifications are sent to dealers with their personalized recommendations.
6. Dealers open the app, review matches, contact sellers, or decline with feedback.
7. Feedback loops back into the engine to improve future matches.

---

## 2. Getting Started

### URLs

| Page | URL | Auth |
|------|-----|------|
| Admin Dashboard | `https://<your-domain>/admin` | Admin password (Basic Auth) |
| Dealer App | `https://<your-domain>/app` | Dealer ID + dealer password (Basic Auth) |
| Health Check | `https://<your-domain>/api/health` | None |

### Logging In

Both interfaces use HTTP Basic Authentication. Your browser will display a login prompt when you first navigate to either URL.

**Admin Dashboard:**
- **Username:** Any value (the system only checks the password)
- **Password:** The shared admin password set via the `APP_PASSWORD` environment variable

**Dealer App:**
- **Username:** The dealer's ID (e.g., `D001`)
- **Password:** The dealer's individual password (auto-generated during onboarding)

Dealer credentials can be exported as an Excel file from the Dealer Management screen. The admin password also works as a fallback for the dealer app (useful for testing).

> **Tip:** If a dealer forgets their password, an admin can reset it from the Dealer Management screen using the "Reset Pwd" button.

### Language Support

Both the admin dashboard and the dealer app support English and German. Use the language toggle (EN / DE) in the top-right corner of either interface to switch languages. The dealer app defaults to German (de).

---

## 3. Admin Dashboard

The admin dashboard is a single-page application with seven screens accessible from the left sidebar navigation.

### 3.1 Dashboard (Overview)

The main landing page provides an at-a-glance summary of the platform's current state.

**Key Metrics (top row):**

| Metric | Description |
|--------|-------------|
| Active Vehicles | Total number of currently active vehicle listings |
| Active Dealers | Number of dealers with push notifications enabled |
| Contact Rate | Percentage of pushed matches that led to dealer contact requests (last 7 days) |
| Pushes Sent Today | Number of push notifications sent today |

**Today's Matching Run:**
A pipeline visualization showing the flow from Vehicles to Dealers to Matches to Pushed. Displays the run date and status (completed, running, failed).

**Dealer Engagement (Last 24h):**
A table listing up to 20 dealers with columns for:
- Pushed: number of matches pushed to the dealer
- Contacted: number of contact actions taken
- Declined: number of "not interested" actions
- Response: engagement rate as a percentage bar

**Available Actions:**
- **Refresh** -- Reloads dashboard data
- **Run Daily Match** -- Manually triggers the matching engine (same as the daily cron job)

### 3.2 Sales Performance

This screen is for uploading and reviewing dealer purchase history data, which is the foundation of the matching engine's behavioral profiles.

**Upload Area:**
- Accepts Excel (.xlsx, .xls) or CSV files
- Drag-and-drop or click-to-browse
- After upload, dealer profiles are automatically rebuilt
- Displays import results: rows imported, duplicates skipped, errors encountered

**Data Summary (right panel):**
- Total transactions in the database
- Number of dealers covered
- Months of history available
- Earliest record date

**How It Feeds the Engine:**
A visual guide showing which purchase history fields map to which scoring dimensions (Brand, Model, Type, Price, Year, Mileage, Fuel, Recency).

**Analytics (shown when data exists):**
- Top Makes Purchased: horizontal bar chart of the most frequently purchased brands
- Monthly Volume: table showing transaction count and average price per month
- Dealer Breakdown: table showing per-dealer purchase counts, average prices, date ranges, and data coverage duration

### 3.3 Data Import

A general-purpose import screen for three data types. All upload zones accept Excel (.xlsx, .xls) or CSV files.

**Vehicle Listings:**
Upload files containing active vehicle inventory. Each row represents one vehicle. Duplicates (by `vehicle_id`) are automatically skipped.

**Purchase History:**
Upload files with historical dealer transactions. Duplicates are detected by `transaction_id` or by the combination of dealer_id + make + model + price + date.

**Dealer Master Data:**
Upload files to add new dealers. Only needed once per dealer, or when onboarding new dealers. Duplicates (by `dealer_id`) are skipped.

After each upload, a toast notification confirms the number of records imported and duplicates skipped.

### 3.4 Matching Logic

This screen allows fine-tuning of the matching engine's scoring algorithm.

**Scoring Weights:**
Eight sliders controlling the relative importance of each matching dimension. The weights should sum to 100%.

| Dimension | Default Weight | Description |
|-----------|---------------|-------------|
| Brand / Make Match | 25% | How well the vehicle's brand matches the dealer's purchase history |
| Model Match | 15% | Specific model preference alignment |
| Vehicle Type Match | 10% | Body type preference (Kombi, Limousine, SUV, etc.) |
| Price in Bandwidth | 20% | Whether the price falls within the dealer's typical buying range |
| Year / Registration | 10% | Whether the vehicle age fits the dealer's preference |
| Mileage within Limit | 8% | Whether mileage is within the dealer's tolerance |
| Fuel Type Match | 5% | Fuel preference alignment (Diesel, Benzin, Elektro, Hybrid) |
| Distance / Location | 7% | Geographic proximity based on postal code |

The total percentage is displayed at the bottom and turns green when it equals 100% or red otherwise.

**Bonus and Penalty:**
| Setting | Default | Description |
|---------|---------|-------------|
| Freshness Bonus | +5% | Extra points for vehicles listed in the last 48 hours |
| Recency Boost | +8% | Extra points when the dealer has purchased in the last 30 days |
| Declined Penalty | -15% | Score reduction when the dealer previously declined a similar vehicle (same make + model) |

**Thresholds:**
| Setting | Default | Description |
|---------|---------|-------------|
| Min Match Score | 70% | Only matches at or above this score are included in recommendations |
| Max per Dealer/Day | 10 | Maximum number of vehicles recommended to a single dealer per day |

Click **Save Weights** to persist changes. Changes take effect on the next matching run.

### 3.5 Daily Run

This screen shows the results of the current day's matching run and provides tools for review and approval.

**When no run exists:** An alert prompts you to click "Run Daily Match."

**When results exist:**
- Summary showing total dealers and total matches
- **Approve All** button to approve every pending match at once

**Per-Dealer View:**
Each dealer row shows:
- Company name and specialization
- Location (postal code)
- Number of matched vehicles
- Average match score
- **Review** button to drill into individual matches
- **Approve** button to approve that dealer's matches

**Review Detail (per dealer):**
A table of matched vehicles with columns:
- Vehicle (make + model)
- Type (body type)
- Price
- Year
- KM (mileage)
- Match score (with color-coded bar)
- Why (match reasons: Brand, Model, Price, etc.)
- **Remove** button to skip individual matches

### 3.6 Dealer Management

The full dealer lifecycle management screen. See [Section 9](#9-dealer-management) for complete documentation of all features including add/edit, bulk onboard, deactivate/reactivate, password reset, and credential export.

### 3.7 Intelligence

The Intelligence screen provides feedback analytics to help the admin understand dealer behavior and improve matching quality.

**Top Decline Reasons (last 30 days):**
A bar chart showing why dealers decline matches. Common reasons include:
- Price too high
- Wrong type
- Too high mileage
- Wrong brand/model
- Too far away

Each reason shows a percentage of total declines.

**External Links Pasted:**
A table of URLs that dealers have shared during the feedback process. This reveals which external listing platforms dealers are sourcing vehicles from.

**Dealer Search Profiles:**
A table of explicit preferences submitted by dealers through the app. Shows:
- Wanted makes, types
- Budget range (price min/max)
- Minimum year
- Maximum mileage
- Last updated date

These explicit preferences feed back into the matching engine as a scoring boost.

---

## 4. Dealer App (PWA)

The dealer app is a mobile-first Progressive Web App designed for daily use by vehicle dealers.

### 4.1 Home Tab

The primary screen showing today's personalized vehicle recommendations.

**Greeting Section:**
- Time-based greeting (Good Morning / Good Afternoon / Good Evening)
- Dealer company name
- Count of new matches

**Stats Row:**
Three cards showing:
- New Matches: today's recommendation count
- Contacted: vehicles contacted this month
- Open: matches not yet acted upon

**Vehicle Cards:**
Each recommended vehicle is displayed as a card with:
- Vehicle image (or placeholder)
- Match badge (e.g., "92% Match")
- Price badge
- Vehicle title (Make + Model)
- Specifications: year, mileage (km), location
- Tags: body type, fuel type, "In Your Price Range" indicator
- **Get in Touch** button: registers a contact action
- **Not Interested** button: opens the feedback screen

### 4.2 Vehicles Tab

A compact list view of all today's recommendations. Each item shows:
- Thumbnail image
- Vehicle title
- Key specs (year, mileage, location)
- Price
- Match percentage badge
- Quick action buttons (contact / decline)

### 4.3 Activity Tab (Notifications)

Currently shares the same view as the Vehicles tab. Shows the daily recommendations list with the current date displayed in a blue header banner.

### 4.4 Profile Tab

Displays the dealer's profile and settings.

**Profile Card:**
- Dealer initials avatar
- Company name
- Specialization and location

**Stats:**
- Total Purchased: lifetime purchase count from history
- This Month: contact actions in the current month
- Match Rate: overall matching accuracy

**Buying Profile:**
Computed from purchase history. Shows:
- Top Brands
- Vehicle Type preferences
- Price Range
- Year Range
- Max Mileage
- Fuel Type preferences

**Notification Settings:**
- Daily Recommendations toggle (on/off)
- Push Time (default: 07:00)
- Max per Day (default: 10)

**Dealer Switcher (demo mode):**
A dropdown to switch between dealer accounts for testing purposes.

### 4.5 Feedback Screen (Not Interested)

When a dealer taps "Not Interested" on a vehicle, the feedback screen opens.

**Decline Reasons (select one):**
- Price too high
- Wrong type
- Too high mileage
- Wrong brand/model
- Too far away

**External Link:**
An optional text field where the dealer can paste a URL to a competing listing they found elsewhere.

**Search Preferences:**
Optional filters the dealer can set to refine future recommendations:
- Make (brand)
- Model
- Type (Kombi, Limousine, SUV, Cabrio, Kleinwagen)
- Fuel (Diesel, Benzin, Elektro, Hybrid)
- Price range (min/max)
- Year from
- Mileage to

All feedback is saved and feeds back into the matching engine for future runs.

---

## 5. Data Import Formats

The system accepts CSV (`.csv`) and Excel (`.xlsx`, `.xls`) files. Column headers must match the expected names exactly.

### 5.1 Vehicle Listings

| Column | Required | Type | Description | Example |
|--------|----------|------|-------------|---------|
| `vehicle_id` | Yes | Text | Unique vehicle identifier | `V-2025-00123` |
| `make` | Yes | Text | Vehicle brand/manufacturer | `BMW` |
| `model` | Yes | Text | Model name | `320d Touring` |
| `body_type` | Yes | Text | Body type category | `Kombi` |
| `price` | Yes | Number | Listing price in EUR | `18500` |
| `first_registration` | No | Text | First registration date | `2019-06` |
| `year` | No | Integer | Model year (auto-derived from first_registration if blank) | `2019` |
| `mileage_km` | No | Integer | Odometer reading in kilometers | `85000` |
| `fuel_type` | No | Text | Fuel type | `Diesel` |
| `transmission` | No | Text | Transmission type | `Automatik` |
| `postal_code` | No | Text | Vehicle location postal code | `80331` |
| `condition_notes` | No | Text | Notes about vehicle condition | `Unfallfahrzeug` |
| `image_url` | No | Text | URL to vehicle photo | `https://...` |
| `hsn_tsn` | No | Text | German HSN/TSN code | `0005/BGN` |
| `listed_at` | No | DateTime | When the listing was created (defaults to now) | `2025-05-10T08:00:00Z` |

**Deduplication:** Vehicles with a `vehicle_id` already in the database are skipped.

### 5.2 Dealer Master Data

| Column | Required | Type | Description | Example |
|--------|----------|------|-------------|---------|
| `dealer_id` | Yes | Text | Unique dealer identifier | `D001` |
| `company_name` | Yes | Text | Dealer company name | `Autohaus Muller` |
| `postal_code` | Yes | Text | Dealer location postal code | `80331` |
| `email` | No | Text | Contact email | `info@mueller.de` |
| `phone` | No | Text | Contact phone number | `+49 89 123456` |
| `specialization` | No | Text | Vehicle specialty | `SUV & Kombi` |
| `max_pickup_radius_km` | No | Integer | Maximum pickup distance in km (default: 200) | `150` |

**Deduplication:** Dealers with a `dealer_id` already in the database are skipped.

### 5.3 Sales Performance / Purchase History

This is the most important import -- it teaches the matching engine each dealer's buying behavior.

| Column | Required | Type | Description | Example |
|--------|----------|------|-------------|---------|
| `dealer_id` | Yes | Text | Dealer identifier (must exist in dealers table) | `D001` |
| `purchased_make` | Yes | Text | Brand of vehicle purchased | `BMW` |
| `purchased_model` | Recommended | Text | Model name | `320d Touring` |
| `purchased_body_type` | Recommended | Text | Body type (defaults to "Limousine" if blank) | `Kombi` |
| `purchase_price` | Yes | Number | Purchase price in EUR | `18500` |
| `purchased_at` | Yes | Date | Date of purchase (YYYY-MM-DD) | `2025-03-15` |
| `purchased_year` | Optional | Integer | Year of vehicle purchased | `2019` |
| `purchased_mileage` | Optional | Integer | Odometer reading at purchase (km) | `85000` |
| `purchased_fuel` | Optional | Text | Fuel type | `Diesel` |
| `transaction_id` | Optional | Text | Internal reference (auto-generated if blank) | `INV-2025-001234` |

**Deduplication:** Checked by `transaction_id` first, then by the combination of dealer_id + make + model + price + date.

**Recommendation:** Upload at least 18 months of purchase history for each dealer to build accurate behavioral profiles.

---

## 6. Matching Engine

The matching engine is the core intelligence of Dealer Buddy. It scores every active vehicle against every dealer using 8 dimensions plus bonuses and penalties.

### 6.1 Pipeline Overview

1. **Build Dealer Profiles** -- Analyzes purchase history per dealer to extract: top makes, top models, preferred body types, price range (min/max/P25/P75), year range, mileage average and max, fuel preferences, and recency.
2. **Score Vehicles** -- Every active vehicle is scored against every dealer profile with push enabled.
3. **Filter and Rank** -- Only matches above the minimum score threshold are kept. The top N matches per dealer (configurable) are selected.
4. **Store Results** -- Match results are saved with status "pending" awaiting approval.

### 6.2 The 8 Scoring Dimensions

Each dimension produces a score from 0 to 100, which is then multiplied by its configured weight.

**Brand Score:**
- 100 if the vehicle's make is the dealer's #1 purchased brand
- 80 if it is in the top 3
- 50 if it appears anywhere in the top 5
- 0 if the brand has never been purchased

**Model Score:**
- 100 if the vehicle's model matches any of the dealer's top 10 models
- 30 if the brand matched (top 5) but the specific model did not
- 0 if neither brand nor model matched

**Body Type Score:**
- 100 if the vehicle's body type matches the dealer's preferences
- 50 if the dealer has no body type history (neutral)
- 0 if the type does not match

**Price Score:**
- 100 if the price falls within the dealer's P25-P75 range (interquartile)
- 30-99 if the price is within the dealer's overall min-max range (graduated by distance from center)
- 0 if outside the dealer's historical price range entirely

**Year Score:**
- 100 if the vehicle year is within the dealer's historical min-max range
- 50 if within 2 years of the range boundaries
- 0 if outside the extended range

**Mileage Score:**
- 100 if the mileage is at or below the dealer's average mileage
- 20-99 (graduated) if between the average and maximum historical mileage
- 50 if the vehicle has no mileage data
- 0 if above the dealer's maximum historical mileage

**Fuel Score:**
- 100 if the fuel type matches the dealer's preferences
- 50 if the dealer has no fuel type history
- 10 if the fuel type does not match

**Distance Score (Postal Code Proximity):**
- 100 if the first 3 digits of the postal code match (nearby)
- 70 if the first 2 digits match (same region)
- 40 if the first digit matches (same area)
- 10 if no postal code digits match

### 6.3 Bonuses and Penalties

Applied after the weighted sum of the 8 dimensions:

| Modifier | Default Value | Condition |
|----------|--------------|-----------|
| Freshness Bonus | +5 points | Vehicle was listed in the last 48 hours |
| Recency Boost | +8 points | Dealer made a purchase within the last 30 days |
| Declined Penalty | -15 points | Dealer previously declined a vehicle with the same make and model (within 30 days) |
| Explicit Search Boost | Up to +10 points | Vehicle matches the dealer's explicitly stated search preferences (up to +5 for make, +3 for type, +4 for price range) |

### 6.4 Final Score

The final score is clamped between 0 and 100. Only matches meeting or exceeding the minimum threshold (default: 70) are included. Each dealer receives at most the configured maximum recommendations per day (default: 10), selected by highest score.

---

## 7. Daily Workflow

The system follows a daily automated cycle:

### 7.1 Schedule

| Time | Event | Description |
|------|-------|-------------|
| 06:30 | Matching Run | Cron job triggers the matching engine. Builds/refreshes dealer profiles, scores all active vehicles against all dealers, stores results as "pending." |
| 06:30+ | Auto-Approve (if enabled) | If `require_approval` is set to 0, all matches are auto-approved immediately. |
| Morning | Admin Review (if enabled) | If `require_approval` is 1, the admin opens the Daily Run screen, reviews matches per dealer, optionally removes individual matches, then approves. |
| 07:00 | Push Notifications | Cron job sends push notifications to all dealers with approved matches. Match status changes from "approved" to "pushed." |
| Daytime | Dealer Interaction | Dealers open the app, review their recommendations, and either contact the seller or provide feedback (not interested). |

### 7.2 Manual Overrides

Admins can manually:
- **Run a match** at any time using the "Run Daily Match" button
- **Send pushes** at any time via the push API
- **Approve or skip** individual matches, individual dealers, or all at once
- **Remove** specific vehicle matches from a dealer's recommendations
- **Deactivate old vehicles** (listings older than 30 days)

### 7.3 Feedback Loop

Dealer actions feed back into the system:
- **Contact** actions are tracked and visible in the dashboard and intelligence screens
- **Decline reasons** are aggregated and shown in the Intelligence screen
- **External links** pasted during feedback reveal competing platforms
- **Search profiles** set by dealers provide an explicit scoring boost in future matches
- **Declined vehicles** (same make + model) receive a penalty in future matching

---

## 8. PWA Installation

Dealer Buddy is a Progressive Web App (PWA) that can be installed on any smartphone for a native app-like experience.

### 8.1 iPhone (iOS Safari)

1. Open Safari and navigate to `https://<your-domain>/app`
2. Log in with the shared password when prompted
3. Tap the **Share** button (square with upward arrow) at the bottom of the screen
4. Scroll down and tap **"Add to Home Screen"**
5. Optionally rename the app (default: "Dealer Buddy")
6. Tap **Add**

The app icon will appear on the home screen. When opened, it runs in standalone mode (no Safari toolbar) with the carsale24 blue theme color.

### 8.2 Android (Chrome)

1. Open Chrome and navigate to `https://<your-domain>/app`
2. Log in with the shared password when prompted
3. Chrome may show a banner at the bottom: **"Add Dealer Buddy to Home screen"** -- tap it
4. If no banner appears, tap the three-dot menu in the top-right corner
5. Tap **"Add to Home screen"** or **"Install app"**
6. Confirm by tapping **Add** or **Install**

The app will appear in your app drawer and home screen with full standalone behavior.

### 8.3 PWA Features

- **Offline support:** The service worker caches the app shell and recent API responses. If the network is unavailable, the last cached data is shown.
- **Push notifications:** When configured with Firebase Cloud Messaging tokens, dealers receive daily push notifications with their match count and top match details.
- **Portrait orientation:** The app is locked to portrait mode for optimal mobile viewing.

---

## 9. Dealer Management

The Dealer Management screen provides full dealer lifecycle management from the admin dashboard.

### 9.1 Dealer List

The main view displays all active dealers in a searchable table with columns:

| Column | Description |
|--------|-------------|
| ID | Business dealer identifier (e.g., D001) |
| Dealer | Company name |
| Location | Postal code |
| Email | Contact email address |
| Specialization | Vehicle specialty (e.g., BMW, Mercedes) |
| Purchases | Total historical purchase count |
| Status | Active (green) or Inactive (red) |
| Actions | Edit, Deactivate/Reactivate, Reset Pwd buttons |

**Search:** Type in the search bar to filter by name, dealer ID, email, or postal code. Click **Search** or press Enter.

**Show Inactive:** Check this box to include deactivated dealers in the list.

### 9.2 Add Dealer

Click **+ Add Dealer** to reveal the inline form.

| Field | Required | Description |
|-------|----------|-------------|
| Dealer ID | Yes | Unique business identifier (e.g., D013) |
| Company Name | Yes | Dealer company name |
| Postal Code | Yes | Location postal code |
| Email | No | Contact email |
| Phone | No | Contact phone |
| Specialization | No | Vehicle specialty description |
| Max Pickup Radius (km) | No | Default: 200 km |

A password is automatically generated on creation. The password is shown once in a success message -- note it down or use Export Credentials to retrieve it later.

### 9.3 Edit Dealer

Click **Edit** on any dealer row to open the inline edit form pre-populated with current values. Editable fields include all add fields plus push settings (enabled, time, max recommendations per day).

### 9.4 Deactivate / Reactivate

- **Deactivate:** Soft-deletes the dealer. Sets `is_active = 0` and `push_enabled = 0`. The dealer can no longer log into the app or receive matches. Historical data is preserved.
- **Reactivate:** Restores the dealer to active status and re-enables push notifications.

### 9.5 Reset Password

Click **Reset Pwd** to generate a new random password for a dealer. The new password is displayed in a success message. Use Export Credentials to get an updated list.

### 9.6 Bulk Onboard

Click **Bulk Onboard** to upload an Excel or CSV file of new dealers. The file format matches the Dealer Master Data import (dealer_id, company_name, postal_code, email, phone, specialization). Passwords are auto-generated for each new dealer. After upload, a table shows all newly onboarded dealers with their credentials.

Duplicates (by dealer_id) are automatically skipped.

### 9.7 Export Credentials

Click **Export Credentials** to download an Excel file (`CS24_Dealer_Credentials.xlsx`) containing all active dealers with:

- Dealer ID, Company Name, Email, Phone, Postal Code, Specialization
- Generated Password
- App URL (for the dealer to access the PWA)
- Created date

This file is intended for external mailing to dealers with their login credentials.
