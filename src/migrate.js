const { getDb, closeDb } = require('./config/database');

function migrate() {
  const db = getDb();

  db.exec(`
    -- =============================================
    -- DEALERS
    -- =============================================
    CREATE TABLE IF NOT EXISTS dealers (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      dealer_id        TEXT UNIQUE NOT NULL,
      company_name     TEXT NOT NULL,
      postal_code      TEXT NOT NULL,
      email            TEXT,
      phone            TEXT,
      specialization   TEXT,
      max_pickup_radius_km INTEGER DEFAULT 200,
      push_device_token TEXT,
      push_enabled     INTEGER DEFAULT 1,
      push_time        TEXT DEFAULT '07:00',
      max_recommendations_per_day INTEGER DEFAULT 10,
      preferred_lang   TEXT DEFAULT 'de',
      dealer_password  TEXT,
      is_active        INTEGER DEFAULT 1,
      created_at       TEXT DEFAULT (datetime('now')),
      updated_at       TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- VEHICLES (current active listings)
    -- =============================================
    CREATE TABLE IF NOT EXISTS vehicles (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id         TEXT UNIQUE NOT NULL,
      make               TEXT NOT NULL,
      model              TEXT NOT NULL,
      body_type          TEXT NOT NULL,
      price              REAL NOT NULL,
      first_registration TEXT,
      year               INTEGER,
      mileage_km         INTEGER,
      fuel_type          TEXT,
      transmission       TEXT,
      postal_code        TEXT,
      condition_notes    TEXT,
      image_url          TEXT,
      hsn_tsn            TEXT,
      listed_at          TEXT DEFAULT (datetime('now')),
      is_active          INTEGER DEFAULT 1,
      created_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(is_active);
    CREATE INDEX IF NOT EXISTS idx_vehicles_make ON vehicles(make);
    CREATE INDEX IF NOT EXISTS idx_vehicles_price ON vehicles(price);

    -- =============================================
    -- PURCHASE HISTORY (dealer past buying data)
    -- =============================================
    CREATE TABLE IF NOT EXISTS purchase_history (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id      TEXT UNIQUE NOT NULL,
      dealer_id           TEXT NOT NULL REFERENCES dealers(dealer_id),
      purchased_make      TEXT NOT NULL,
      purchased_model     TEXT NOT NULL,
      purchased_body_type TEXT NOT NULL,
      purchase_price      REAL NOT NULL,
      purchased_at        TEXT NOT NULL,
      purchased_year      INTEGER,
      purchased_mileage   INTEGER,
      purchased_fuel      TEXT,
      created_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ph_dealer ON purchase_history(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_ph_date ON purchase_history(purchased_at);

    -- =============================================
    -- DEALER PROFILES (auto-computed from history)
    -- =============================================
    CREATE TABLE IF NOT EXISTS dealer_profiles (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      dealer_id       TEXT UNIQUE NOT NULL REFERENCES dealers(dealer_id),
      top_makes       TEXT,       -- JSON array: ["BMW","Mercedes-Benz","Audi"]
      top_models      TEXT,       -- JSON array: ["320d","C 200"]
      body_types      TEXT,       -- JSON array: ["Kombi","Limousine"]
      price_min       REAL,
      price_max       REAL,
      price_p25       REAL,
      price_p75       REAL,
      year_min        INTEGER,
      year_max        INTEGER,
      mileage_avg     INTEGER,
      mileage_max     INTEGER,
      fuel_types      TEXT,       -- JSON array: ["Diesel","Benzin"]
      total_purchases INTEGER DEFAULT 0,
      last_purchase   TEXT,
      computed_at     TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- MATCH RESULTS (daily matching output)
    -- =============================================
    CREATE TABLE IF NOT EXISTS match_results (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date      TEXT NOT NULL,
      dealer_id     TEXT NOT NULL REFERENCES dealers(dealer_id),
      vehicle_id    TEXT NOT NULL REFERENCES vehicles(vehicle_id),
      match_score   REAL NOT NULL,
      score_breakdown TEXT,      -- JSON: {"brand":25,"model":15,...}
      match_reasons TEXT,        -- JSON array: ["Brand+Model","Price"]
      status        TEXT DEFAULT 'pending',  -- pending, approved, pushed, skipped
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_mr_run ON match_results(run_date);
    CREATE INDEX IF NOT EXISTS idx_mr_dealer ON match_results(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_mr_status ON match_results(status);

    -- =============================================
    -- DEALER ACTIONS (contact / not-interested)
    -- =============================================
    CREATE TABLE IF NOT EXISTS dealer_actions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      dealer_id     TEXT NOT NULL REFERENCES dealers(dealer_id),
      vehicle_id    TEXT NOT NULL,
      action_type   TEXT NOT NULL,   -- 'contact' or 'not_interested'
      decline_reason TEXT,            -- e.g. 'price_too_high'
      external_link  TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_da_dealer ON dealer_actions(dealer_id);
    CREATE INDEX IF NOT EXISTS idx_da_type ON dealer_actions(action_type);

    -- =============================================
    -- DEALER SEARCH PROFILES (explicit preferences)
    -- =============================================
    CREATE TABLE IF NOT EXISTS dealer_search_profiles (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      dealer_id     TEXT NOT NULL REFERENCES dealers(dealer_id),
      wanted_makes  TEXT,       -- JSON array
      wanted_models TEXT,       -- JSON array
      wanted_types  TEXT,       -- JSON array
      wanted_fuels  TEXT,       -- JSON array
      price_min     REAL,
      price_max     REAL,
      year_min      INTEGER,
      mileage_max   INTEGER,
      created_at    TEXT DEFAULT (datetime('now')),
      updated_at    TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- MATCHING CONFIG (admin-adjustable weights)
    -- =============================================
    CREATE TABLE IF NOT EXISTS matching_config (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT UNIQUE NOT NULL,
      value       REAL NOT NULL,
      description TEXT,
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    -- Insert default weights if they don't exist
    INSERT OR IGNORE INTO matching_config (key, value, description) VALUES
      ('weight_brand',     25, 'Brand / Make match weight (%)'),
      ('weight_model',     15, 'Model match weight (%)'),
      ('weight_type',      10, 'Vehicle type match weight (%)'),
      ('weight_price',     20, 'Price in bandwidth weight (%)'),
      ('weight_year',      10, 'Year / registration range weight (%)'),
      ('weight_mileage',    8, 'Mileage within limit weight (%)'),
      ('weight_fuel',       5, 'Fuel type match weight (%)'),
      ('weight_distance',   7, 'Distance / location weight (%)'),
      ('bonus_freshness',   5, 'Freshness bonus for newly listed vehicles (%)'),
      ('bonus_recency',     8, 'Recency boost for recent purchase patterns (%)'),
      ('penalty_declined', 15, 'Penalty for previously declined similar vehicles (%)'),
      ('min_match_score',  70, 'Minimum match score to include in recommendations'),
      ('max_per_dealer',   10, 'Maximum vehicles per dealer per day'),
      ('auto_run_time',  6.5, 'Auto-run matching time (24h decimal, 6.5 = 06:30)'),
      ('auto_push_time',   7, 'Auto-push time (24h decimal, 7 = 07:00)'),
      ('require_approval',  1, 'Require manual approval before push (0/1)');

    -- =============================================
    -- MATCHING RUNS (audit log)
    -- =============================================
    CREATE TABLE IF NOT EXISTS matching_runs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date       TEXT NOT NULL,
      vehicles_count INTEGER,
      dealers_count  INTEGER,
      matches_total  INTEGER,
      matches_pushed INTEGER,
      status         TEXT DEFAULT 'pending', -- pending, running, completed, failed
      started_at     TEXT,
      completed_at   TEXT,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    -- =============================================
    -- PUSH LOG
    -- =============================================
    CREATE TABLE IF NOT EXISTS push_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      dealer_id   TEXT NOT NULL,
      match_ids   TEXT,          -- JSON array of match_result ids
      payload     TEXT,          -- JSON push payload sent
      status      TEXT DEFAULT 'queued', -- queued, sent, failed, opened
      sent_at     TEXT,
      opened_at   TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add new columns to existing databases
  const cols = db.prepare("PRAGMA table_info(dealers)").all().map(c => c.name);
  if (!cols.includes('dealer_password')) {
    db.exec("ALTER TABLE dealers ADD COLUMN dealer_password TEXT");
  }
  if (!cols.includes('is_active')) {
    db.exec("ALTER TABLE dealers ADD COLUMN is_active INTEGER DEFAULT 1");
  }

  console.log('Database migrated successfully.');
}

if (require.main === module) {
  migrate();
  closeDb();
}

module.exports = { migrate };
