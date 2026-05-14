require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const cron = require('node-cron');

const { migrate } = require('./migrate');
const { getDb } = require('./config/database');
const MatchingEngine = require('./services/matching-engine');
const PushService = require('./services/push-service');

const dealerRoutes = require('./routes/api-dealers');
const adminRoutes = require('./routes/api-admin');
const { t } = require('./i18n/translations');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('short'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic auth for protected routes
const APP_PASSWORD = process.env.APP_PASSWORD || '';
function basicAuth(req, res, next) {
  if (!APP_PASSWORD) return next();
  const auth = req.headers.authorization;
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme === 'Basic') {
      const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
      if (pass === APP_PASSWORD) return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="CS24 Dealer Buddy"');
  res.status(401).send('Authentication required');
}

// Serve admin UI (password protected)
app.use('/admin', basicAuth, express.static(path.join(__dirname, '../public/admin')));

// Serve PWA assets without auth (browser needs these before login)
app.use('/app/manifest.json', express.static(path.join(__dirname, '../public/app/manifest.json')));
app.use('/app/sw.js', express.static(path.join(__dirname, '../public/app/sw.js')));
app.use('/app/icons', express.static(path.join(__dirname, '../public/app/icons')));

// Serve dealer app (password protected)
app.use('/app', basicAuth, express.static(path.join(__dirname, '../public/app')));

// API routes
app.use('/api/dealers', dealerRoutes);
app.use('/api/admin', adminRoutes);

// i18n endpoint for app
app.get('/api/i18n/:lang', (req, res) => {
  const { translations } = require('./i18n/translations');
  const lang = req.params.lang === 'de' ? 'de' : 'en';
  res.json(translations[lang]);
});

// Health check
app.get('/api/health', (req, res) => {
  const db = getDb();
  const vehicleCount = db.prepare('SELECT COUNT(*) as cnt FROM vehicles WHERE is_active = 1').get().cnt;
  const dealerCount = db.prepare('SELECT COUNT(*) as cnt FROM dealers').get().cnt;
  res.json({
    status: 'ok',
    app: 'Carsell 24 Dealer Buddy',
    version: '1.0.0',
    vehicles: vehicleCount,
    dealers: dealerCount,
    timestamp: new Date().toISOString(),
  });
});

// =============================================
// CRON: Daily matching run at 06:30
// =============================================
cron.schedule('30 6 * * *', () => {
  console.log('[CRON] Starting daily matching run...');
  try {
    const engine = new MatchingEngine();
    engine.buildDealerProfiles();
    const result = engine.runMatching();
    console.log(`[CRON] Matching complete: ${result.matchesTotal} matches for ${result.dealersCount} dealers`);

    // Auto-approve if manual approval is disabled
    const db = getDb();
    const requireApproval = db.prepare("SELECT value FROM matching_config WHERE key = 'require_approval'").get();
    if (!requireApproval || requireApproval.value === 0) {
      db.prepare(`
        UPDATE match_results SET status = 'approved'
        WHERE run_date = ? AND status = 'pending'
      `).run(result.runDate);
      console.log('[CRON] Auto-approved all matches (manual approval disabled)');
    }
  } catch (err) {
    console.error('[CRON] Matching failed:', err.message);
  }
});

// =============================================
// CRON: Push notifications at 07:00
// =============================================
cron.schedule('0 7 * * *', async () => {
  console.log('[CRON] Sending daily push notifications...');
  try {
    const pushService = new PushService();
    const results = await pushService.sendDailyPushes();
    console.log(`[CRON] Pushed to ${results.length} dealers`);
  } catch (err) {
    console.error('[CRON] Push failed:', err.message);
  }
});

// Initialize database and start
migrate();

app.listen(PORT, () => {
  console.log(`\n  Carsell 24 Dealer Buddy — Backend`);
  console.log(`  API:   http://localhost:${PORT}/api/health`);
  console.log(`  Admin: http://localhost:${PORT}/admin`);
  console.log(`  Cron:  06:30 matching | 07:00 push\n`);
});
