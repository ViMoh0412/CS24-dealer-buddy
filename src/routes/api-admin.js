const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDb } = require('../config/database');
const MatchingEngine = require('../services/matching-engine');
const PushService = require('../services/push-service');
const CsvImporter = require('../services/csv-importer');

const upload = multer({ storage: multer.memoryStorage() });

// =============================================
// DASHBOARD
// =============================================
router.get('/dashboard', (req, res) => {
  const db = getDb();

  const stats = {
    activeVehicles: db.prepare('SELECT COUNT(*) as cnt FROM vehicles WHERE is_active = 1').get().cnt,
    activeDealers: db.prepare('SELECT COUNT(*) as cnt FROM dealers WHERE push_enabled = 1').get().cnt,
    todayPushes: db.prepare(`
      SELECT COUNT(*) as cnt FROM push_log WHERE DATE(sent_at) = DATE('now')
    `).get().cnt,
  };

  const totalContacts = db.prepare(`
    SELECT COUNT(*) as cnt FROM dealer_actions WHERE action_type = 'contact'
    AND created_at > datetime('now', '-7 days')
  `).get().cnt;
  const totalPushed = db.prepare(`
    SELECT COUNT(*) as cnt FROM match_results
    WHERE status = 'pushed' AND run_date > date('now', '-7 days')
  `).get().cnt;
  stats.contactRate = totalPushed > 0 ? Math.round((totalContacts / totalPushed) * 100) : 0;

  const latestRun = db.prepare(
    'SELECT * FROM matching_runs ORDER BY created_at DESC LIMIT 1'
  ).get();

  const dealerEngagement = db.prepare(`
    SELECT
      d.dealer_id,
      d.company_name,
      (SELECT COUNT(*) FROM match_results mr WHERE mr.dealer_id = d.dealer_id
        AND mr.status = 'pushed' AND mr.run_date > date('now', '-1 day')) as pushed,
      (SELECT COUNT(*) FROM push_log pl WHERE pl.dealer_id = d.dealer_id
        AND pl.status IN ('sent','opened') AND DATE(pl.sent_at) > date('now', '-1 day')) as opened,
      (SELECT COUNT(*) FROM dealer_actions da WHERE da.dealer_id = d.dealer_id
        AND da.action_type = 'contact' AND da.created_at > datetime('now', '-1 day')) as contacted,
      (SELECT COUNT(*) FROM dealer_actions da WHERE da.dealer_id = d.dealer_id
        AND da.action_type = 'not_interested' AND da.created_at > datetime('now', '-1 day')) as declined
    FROM dealers d
    WHERE d.push_enabled = 1
    ORDER BY contacted DESC
    LIMIT 20
  `).all();

  res.json({ stats, latestRun, dealerEngagement });
});

// =============================================
// DATA IMPORT
// =============================================
router.post('/import/vehicles', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const importer = new CsvImporter();
  const result = importer.importVehicles(req.file.buffer, req.file.originalname);
  res.json({ success: true, ...result });
});

router.post('/import/purchases', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const importer = new CsvImporter();
  const result = importer.importPurchaseHistory(req.file.buffer, req.file.originalname);
  res.json({ success: true, ...result });
});

router.post('/import/dealers', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const importer = new CsvImporter();
  const result = importer.importDealers(req.file.buffer, req.file.originalname);
  res.json({ success: true, ...result });
});

router.post('/import/sales-performance', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const importer = new CsvImporter();
    const result = importer.importSalesPerformance(req.file.buffer, req.file.originalname);

    const engine = new MatchingEngine();
    const profileCount = engine.buildDealerProfiles();

    res.json({
      success: true,
      imported: result.imported,
      duplicates: result.duplicates,
      skipped: result.skipped,
      totalRows: result.totalRows,
      dealersAffected: result.dealerIds.length,
      profilesRebuilt: profileCount,
      errors: result.errors,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/sales-performance/summary', (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as cnt FROM purchase_history').get().cnt;
  const dealers = db.prepare('SELECT COUNT(DISTINCT dealer_id) as cnt FROM purchase_history').get().cnt;
  const dateRange = db.prepare('SELECT MIN(purchased_at) as earliest, MAX(purchased_at) as latest FROM purchase_history').get();
  const topMakes = db.prepare(`
    SELECT purchased_make, COUNT(*) as cnt FROM purchase_history
    GROUP BY purchased_make ORDER BY cnt DESC LIMIT 10
  `).all();
  const monthlyVolume = db.prepare(`
    SELECT strftime('%Y-%m', purchased_at) as month, COUNT(*) as cnt,
      ROUND(AVG(purchase_price)) as avg_price
    FROM purchase_history
    GROUP BY month ORDER BY month DESC LIMIT 24
  `).all();
  const dealerBreakdown = db.prepare(`
    SELECT ph.dealer_id, d.company_name, COUNT(*) as purchases,
      ROUND(AVG(ph.purchase_price)) as avg_price,
      MIN(ph.purchased_at) as first_purchase, MAX(ph.purchased_at) as last_purchase
    FROM purchase_history ph
    JOIN dealers d ON d.dealer_id = ph.dealer_id
    GROUP BY ph.dealer_id ORDER BY purchases DESC
  `).all();
  res.json({ total, dealers, dateRange, topMakes, monthlyVolume, dealerBreakdown });
});

// =============================================
// MATCHING ENGINE
// =============================================
router.get('/matching/config', (req, res) => {
  const db = getDb();
  const config = db.prepare('SELECT * FROM matching_config ORDER BY id').all();
  res.json({ config });
});

router.put('/matching/config', (req, res) => {
  const db = getDb();
  const { weights } = req.body;
  if (!weights || typeof weights !== 'object') {
    return res.status(400).json({ error: 'weights object required' });
  }

  const stmt = db.prepare(
    "UPDATE matching_config SET value = ?, updated_at = datetime('now') WHERE key = ?"
  );
  const updateAll = db.transaction(() => {
    for (const [key, value] of Object.entries(weights)) {
      stmt.run(value, key);
    }
  });
  updateAll();
  res.json({ success: true });
});

router.post('/matching/build-profiles', (req, res) => {
  const engine = new MatchingEngine();
  const count = engine.buildDealerProfiles();
  res.json({ success: true, profilesBuilt: count });
});

router.post('/matching/run', (req, res) => {
  const engine = new MatchingEngine();
  engine.buildDealerProfiles();
  const result = engine.runMatching(req.body.date);
  res.json({ success: true, ...result });
});

// =============================================
// DAILY RUN REVIEW & APPROVAL
// =============================================
router.get('/runs', (req, res) => {
  const db = getDb();
  const runs = db.prepare('SELECT * FROM matching_runs ORDER BY created_at DESC LIMIT 30').all();
  res.json({ runs });
});

router.get('/runs/:date/results', (req, res) => {
  const db = getDb();
  const results = db.prepare(`
    SELECT
      mr.dealer_id,
      d.company_name,
      d.specialization,
      d.postal_code as dealer_location,
      COUNT(*) as match_count,
      ROUND(AVG(mr.match_score), 1) as avg_score,
      MAX(mr.match_score) as top_score,
      MIN(mr.status) as status
    FROM match_results mr
    JOIN dealers d ON d.dealer_id = mr.dealer_id
    WHERE mr.run_date = ?
    GROUP BY mr.dealer_id
    ORDER BY avg_score DESC
  `).all(req.params.date);

  res.json({ runDate: req.params.date, results });
});

router.get('/runs/:date/dealer/:dealerId', (req, res) => {
  const db = getDb();
  const matches = db.prepare(`
    SELECT mr.*, v.make, v.model, v.body_type, v.price, v.year,
      v.mileage_km, v.fuel_type, v.postal_code as vehicle_location
    FROM match_results mr
    JOIN vehicles v ON v.vehicle_id = mr.vehicle_id
    WHERE mr.run_date = ? AND mr.dealer_id = ?
    ORDER BY mr.match_score DESC
  `).all(req.params.date, req.params.dealerId);

  res.json({ matches });
});

router.post('/runs/:date/approve', (req, res) => {
  const db = getDb();
  const { dealer_id, match_ids } = req.body;

  if (match_ids && Array.isArray(match_ids)) {
    const stmt = db.prepare("UPDATE match_results SET status = 'approved' WHERE id = ?");
    for (const id of match_ids) stmt.run(id);
  } else if (dealer_id) {
    db.prepare(`
      UPDATE match_results SET status = 'approved'
      WHERE run_date = ? AND dealer_id = ? AND status = 'pending'
    `).run(req.params.date, dealer_id);
  } else {
    db.prepare(`
      UPDATE match_results SET status = 'approved'
      WHERE run_date = ? AND status = 'pending'
    `).run(req.params.date);
  }

  res.json({ success: true });
});

router.post('/runs/:date/skip', (req, res) => {
  const db = getDb();
  const { dealer_id, match_ids } = req.body;

  if (match_ids && Array.isArray(match_ids)) {
    const stmt = db.prepare("UPDATE match_results SET status = 'skipped' WHERE id = ?");
    for (const id of match_ids) stmt.run(id);
  } else if (dealer_id) {
    db.prepare(`
      UPDATE match_results SET status = 'skipped'
      WHERE run_date = ? AND dealer_id = ? AND status = 'pending'
    `).run(req.params.date, dealer_id);
  }

  res.json({ success: true });
});

router.post('/runs/:date/remove-match', (req, res) => {
  const db = getDb();
  const { match_id } = req.body;
  db.prepare("UPDATE match_results SET status = 'skipped' WHERE id = ?").run(match_id);
  res.json({ success: true });
});

// =============================================
// PUSH
// =============================================
router.post('/push/send', async (req, res) => {
  const pushService = new PushService();
  const date = req.body.date || new Date().toISOString().split('T')[0];
  const results = await pushService.sendDailyPushes(date);
  res.json({ success: true, pushed: results.length, results });
});

router.get('/push/log', (req, res) => {
  const db = getDb();
  const log = db.prepare(`
    SELECT pl.*, d.company_name
    FROM push_log pl
    JOIN dealers d ON d.dealer_id = pl.dealer_id
    ORDER BY pl.created_at DESC LIMIT 100
  `).all();
  res.json({ log });
});

// =============================================
// DEALER INTELLIGENCE / FEEDBACK
// =============================================
router.get('/intelligence/decline-reasons', (req, res) => {
  const db = getDb();
  const reasons = db.prepare(`
    SELECT decline_reason, COUNT(*) as count
    FROM dealer_actions
    WHERE action_type = 'not_interested' AND decline_reason IS NOT NULL
    AND created_at > datetime('now', '-30 days')
    GROUP BY decline_reason
    ORDER BY count DESC
  `).all();

  const total = reasons.reduce((s, r) => s + r.count, 0);
  res.json({
    reasons: reasons.map(r => ({
      reason: r.decline_reason,
      count: r.count,
      percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
    })),
  });
});

router.get('/intelligence/external-links', (req, res) => {
  const db = getDb();
  const links = db.prepare(`
    SELECT da.dealer_id, d.company_name, da.external_link, da.created_at
    FROM dealer_actions da
    JOIN dealers d ON d.dealer_id = da.dealer_id
    WHERE da.external_link IS NOT NULL AND da.external_link != ''
    ORDER BY da.created_at DESC LIMIT 50
  `).all();
  res.json({ links });
});

router.get('/intelligence/search-profiles', (req, res) => {
  const db = getDb();
  const profiles = db.prepare(`
    SELECT dsp.*, d.company_name
    FROM dealer_search_profiles dsp
    JOIN dealers d ON d.dealer_id = dsp.dealer_id
    ORDER BY dsp.updated_at DESC
  `).all();
  res.json({ profiles });
});

// =============================================
// VEHICLES
// =============================================
router.get('/vehicles', (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as cnt FROM vehicles WHERE is_active = 1').get().cnt;
  const vehicles = db.prepare(
    'SELECT * FROM vehicles WHERE is_active = 1 ORDER BY listed_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  res.json({ vehicles, total, page, limit, pages: Math.ceil(total / limit) });
});

router.post('/vehicles/deactivate-old', (req, res) => {
  const db = getDb();
  const result = db.prepare(`
    UPDATE vehicles SET is_active = 0
    WHERE listed_at < datetime('now', '-30 days') AND is_active = 1
  `).run();
  res.json({ success: true, deactivated: result.changes });
});

// =============================================
// DEALER MANAGEMENT
// =============================================
const crypto = require('crypto');

function generatePassword() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

router.get('/dealer-management/list', (req, res) => {
  const db = getDb();
  const search = req.query.search || '';
  const showInactive = req.query.inactive === '1';

  let query = `
    SELECT d.*, dp.top_makes, dp.total_purchases, dp.last_purchase,
      (SELECT COUNT(*) FROM dealer_actions da WHERE da.dealer_id = d.dealer_id AND da.action_type = 'contact') as contacts,
      (SELECT COUNT(*) FROM dealer_actions da WHERE da.dealer_id = d.dealer_id AND da.action_type = 'not_interested') as declines
    FROM dealers d
    LEFT JOIN dealer_profiles dp ON dp.dealer_id = d.dealer_id
  `;
  const conditions = [];
  const params = [];

  if (!showInactive) {
    conditions.push('(d.is_active = 1 OR d.is_active IS NULL)');
  }
  if (search) {
    conditions.push('(d.company_name LIKE ? OR d.dealer_id LIKE ? OR d.email LIKE ? OR d.postal_code LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY d.company_name';

  const dealers = db.prepare(query).all(...params);
  res.json({ dealers });
});

router.get('/dealer-management/:dealerId', (req, res) => {
  const db = getDb();
  const dealer = db.prepare(`
    SELECT d.*, dp.top_makes, dp.top_models, dp.body_types, dp.fuel_types,
      dp.price_min, dp.price_max, dp.year_min, dp.year_max,
      dp.mileage_avg, dp.total_purchases, dp.last_purchase
    FROM dealers d
    LEFT JOIN dealer_profiles dp ON dp.dealer_id = d.dealer_id
    WHERE d.dealer_id = ?
  `).get(req.params.dealerId);
  if (!dealer) return res.status(404).json({ error: 'Dealer not found' });
  res.json({ dealer });
});

router.post('/dealer-management/add', (req, res) => {
  const db = getDb();
  const { dealer_id, company_name, postal_code, email, phone, specialization, max_pickup_radius_km } = req.body;
  if (!dealer_id || !company_name || !postal_code) {
    return res.status(400).json({ error: 'dealer_id, company_name, and postal_code are required' });
  }
  const existing = db.prepare('SELECT 1 FROM dealers WHERE dealer_id = ?').get(dealer_id);
  if (existing) return res.status(409).json({ error: 'Dealer ID already exists' });

  const password = generatePassword();
  db.prepare(`
    INSERT INTO dealers (dealer_id, company_name, postal_code, email, phone, specialization, max_pickup_radius_km, dealer_password, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(dealer_id, company_name, postal_code, email || null, phone || null, specialization || null, parseInt(max_pickup_radius_km) || 200, password);

  res.json({ success: true, dealer_id, password });
});

router.put('/dealer-management/:dealerId', (req, res) => {
  const db = getDb();
  const { company_name, postal_code, email, phone, specialization, max_pickup_radius_km, push_enabled, push_time, max_recommendations_per_day } = req.body;
  const dealer = db.prepare('SELECT 1 FROM dealers WHERE dealer_id = ?').get(req.params.dealerId);
  if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

  db.prepare(`
    UPDATE dealers SET
      company_name = COALESCE(?, company_name),
      postal_code = COALESCE(?, postal_code),
      email = ?, phone = ?, specialization = ?,
      max_pickup_radius_km = COALESCE(?, max_pickup_radius_km),
      push_enabled = COALESCE(?, push_enabled),
      push_time = COALESCE(?, push_time),
      max_recommendations_per_day = COALESCE(?, max_recommendations_per_day),
      updated_at = datetime('now')
    WHERE dealer_id = ?
  `).run(company_name, postal_code, email ?? null, phone ?? null, specialization ?? null,
    max_pickup_radius_km ? parseInt(max_pickup_radius_km) : null,
    push_enabled != null ? (push_enabled ? 1 : 0) : null,
    push_time, max_recommendations_per_day ? parseInt(max_recommendations_per_day) : null,
    req.params.dealerId);

  res.json({ success: true });
});

router.delete('/dealer-management/:dealerId', (req, res) => {
  const db = getDb();
  const dealer = db.prepare('SELECT company_name FROM dealers WHERE dealer_id = ?').get(req.params.dealerId);
  if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

  db.prepare("UPDATE dealers SET is_active = 0, push_enabled = 0, updated_at = datetime('now') WHERE dealer_id = ?").run(req.params.dealerId);
  res.json({ success: true, message: `${dealer.company_name} deactivated` });
});

router.post('/dealer-management/:dealerId/reactivate', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE dealers SET is_active = 1, push_enabled = 1, updated_at = datetime('now') WHERE dealer_id = ?").run(req.params.dealerId);
  res.json({ success: true });
});

router.post('/dealer-management/:dealerId/reset-password', (req, res) => {
  const db = getDb();
  const password = generatePassword();
  db.prepare("UPDATE dealers SET dealer_password = ?, updated_at = datetime('now') WHERE dealer_id = ?").run(password, req.params.dealerId);
  res.json({ success: true, password });
});

router.post('/dealer-management/onboard', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const importer = new CsvImporter();
    const result = importer.importDealers(req.file.buffer, req.file.originalname);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/dealer-management/export/credentials', (req, res) => {
  const db = getDb();
  const dealers = db.prepare(`
    SELECT dealer_id, company_name, email, phone, dealer_password, is_active, created_at
    FROM dealers WHERE is_active = 1 OR is_active IS NULL
    ORDER BY company_name
  `).all();
  res.json({ dealers });
});

module.exports = router;
