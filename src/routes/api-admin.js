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
  const count = importer.importVehicles(req.file.buffer.toString());
  res.json({ success: true, imported: count });
});

router.post('/import/purchases', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const importer = new CsvImporter();
  const count = importer.importPurchaseHistory(req.file.buffer.toString());
  res.json({ success: true, imported: count });
});

router.post('/import/dealers', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const importer = new CsvImporter();
  const count = importer.importDealers(req.file.buffer.toString());
  res.json({ success: true, imported: count });
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

module.exports = router;
