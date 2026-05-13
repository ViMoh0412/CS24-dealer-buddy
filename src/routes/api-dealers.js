const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { t, getGreeting } = require('../i18n/translations');

// GET /api/dealers — list all dealers
router.get('/', (req, res) => {
  const db = getDb();
  const dealers = db.prepare(`
    SELECT d.*, dp.top_makes, dp.top_models, dp.body_types,
      dp.price_min, dp.price_max, dp.total_purchases,
      (SELECT COUNT(*) FROM dealer_actions WHERE dealer_id = d.dealer_id AND action_type = 'contact') as contacts,
      (SELECT COUNT(*) FROM dealer_actions WHERE dealer_id = d.dealer_id AND action_type = 'not_interested') as declines
    FROM dealers d
    LEFT JOIN dealer_profiles dp ON dp.dealer_id = d.dealer_id
    ORDER BY d.company_name
  `).all();
  res.json({ dealers });
});

// GET /api/dealers/:id — single dealer detail
router.get('/:id', (req, res) => {
  const db = getDb();
  const dealer = db.prepare('SELECT * FROM dealers WHERE dealer_id = ?').get(req.params.id);
  if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

  const profile = db.prepare('SELECT * FROM dealer_profiles WHERE dealer_id = ?').get(req.params.id);
  const searchProfile = db.prepare(
    'SELECT * FROM dealer_search_profiles WHERE dealer_id = ? ORDER BY updated_at DESC LIMIT 1'
  ).get(req.params.id);

  const recentActions = db.prepare(
    'SELECT * FROM dealer_actions WHERE dealer_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(req.params.id);

  res.json({ dealer, profile, searchProfile, recentActions });
});

// GET /api/dealers/:id/matches — today's matches for a dealer (app endpoint)
router.get('/:id/matches', (req, res) => {
  const db = getDb();
  const lang = req.query.lang || 'en';
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const dealer = db.prepare('SELECT * FROM dealers WHERE dealer_id = ?').get(req.params.id);
  if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

  const matches = db.prepare(`
    SELECT mr.*, v.make, v.model, v.body_type, v.price, v.year, v.mileage_km,
      v.fuel_type, v.postal_code as vehicle_location, v.image_url, v.first_registration
    FROM match_results mr
    JOIN vehicles v ON v.vehicle_id = mr.vehicle_id
    WHERE mr.dealer_id = ? AND mr.run_date = ? AND mr.status IN ('approved', 'pushed')
    ORDER BY mr.match_score DESC
  `).all(req.params.id, date);

  const profile = db.prepare('SELECT * FROM dealer_profiles WHERE dealer_id = ?').get(req.params.id);

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM match_results WHERE dealer_id = ? AND run_date = ?) as new_matches,
      (SELECT COUNT(*) FROM dealer_actions WHERE dealer_id = ? AND action_type = 'contact'
        AND created_at > datetime('now', '-30 days')) as contacted,
      (SELECT COUNT(*) FROM match_results WHERE dealer_id = ? AND run_date = ?
        AND status = 'pushed'
        AND vehicle_id NOT IN (SELECT vehicle_id FROM dealer_actions WHERE dealer_id = ?)) as open_count
  `).get(req.params.id, date, req.params.id, req.params.id, date, req.params.id);

  res.json({
    greeting: getGreeting(lang),
    companyName: dealer.company_name,
    matchesLabel: t(lang, 'greeting.newMatches', { count: matches.length }),
    stats: {
      newMatches: { value: stats?.new_matches || 0, label: t(lang, 'stats.newMatches') },
      contacted: { value: stats?.contacted || 0, label: t(lang, 'stats.contacted') },
      open: { value: stats?.open_count || 0, label: t(lang, 'stats.open') },
    },
    sectionTitle: t(lang, 'sections.todayRecommendations'),
    matches: matches.map(m => ({
      id: m.id,
      vehicleId: m.vehicle_id,
      make: m.make,
      model: m.model,
      title: `${m.make} ${m.model}`,
      bodyType: m.body_type,
      price: m.price,
      year: m.year || parseInt(m.first_registration),
      mileageKm: m.mileage_km,
      fuelType: m.fuel_type,
      location: m.vehicle_location,
      imageUrl: m.image_url,
      matchScore: Math.round(m.match_score),
      matchBadge: t(lang, 'vehicle.matchBadge', { pct: Math.round(m.match_score) }),
      scoreBreakdown: JSON.parse(m.score_breakdown || '{}'),
      matchReasons: JSON.parse(m.match_reasons || '[]'),
      inPriceRange: (m.price >= (profile?.price_p25 || 0) && m.price <= (profile?.price_p75 || 999999)),
    })),
    actions: {
      getInTouch: t(lang, 'actions.getInTouch'),
      notInterested: t(lang, 'actions.notInterested'),
    },
    labels: {
      priceRange: t(lang, 'vehicle.yourPriceRange'),
    },
  });
});

// POST /api/dealers/:id/action — dealer taps contact / not interested
router.post('/:id/action', (req, res) => {
  const db = getDb();
  const { vehicle_id, action_type, decline_reason, external_link } = req.body;

  if (!vehicle_id || !action_type) {
    return res.status(400).json({ error: 'vehicle_id and action_type required' });
  }

  db.prepare(`
    INSERT INTO dealer_actions (dealer_id, vehicle_id, action_type, decline_reason, external_link)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, vehicle_id, action_type, decline_reason || null, external_link || null);

  res.json({ success: true });
});

// POST /api/dealers/:id/search-profile — save dealer search preferences
router.post('/:id/search-profile', (req, res) => {
  const db = getDb();
  const { wanted_makes, wanted_models, wanted_types, wanted_fuels,
    price_min, price_max, year_min, mileage_max } = req.body;

  db.prepare(`
    INSERT INTO dealer_search_profiles
      (dealer_id, wanted_makes, wanted_models, wanted_types, wanted_fuels,
       price_min, price_max, year_min, mileage_max, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    req.params.id,
    JSON.stringify(wanted_makes || []),
    JSON.stringify(wanted_models || []),
    JSON.stringify(wanted_types || []),
    JSON.stringify(wanted_fuels || []),
    price_min || null,
    price_max || null,
    year_min || null,
    mileage_max || null,
  );

  res.json({ success: true });
});

// GET /api/dealers/:id/profile — dealer profile for app display
router.get('/:id/profile', (req, res) => {
  const db = getDb();
  const lang = req.query.lang || 'en';
  const dealer = db.prepare('SELECT * FROM dealers WHERE dealer_id = ?').get(req.params.id);
  if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

  const profile = db.prepare('SELECT * FROM dealer_profiles WHERE dealer_id = ?').get(req.params.id);

  const thisMonth = db.prepare(`
    SELECT COUNT(*) as cnt FROM dealer_actions
    WHERE dealer_id = ? AND action_type = 'contact'
    AND created_at > datetime('now', 'start of month')
  `).get(req.params.id);

  res.json({
    dealer: {
      name: dealer.company_name,
      initials: dealer.company_name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(),
      specialization: dealer.specialization,
      location: dealer.postal_code,
    },
    stats: {
      purchased: { value: profile?.total_purchases || 0, label: t(lang, 'profile.purchased') },
      thisMonth: { value: thisMonth?.cnt || 0, label: t(lang, 'profile.thisMonth') },
      matchRate: { value: '94%', label: t(lang, 'profile.matchRate') },
    },
    buyingProfile: {
      title: t(lang, 'profile.buyingProfile'),
      items: [
        { label: t(lang, 'profile.topBrands'), value: (JSON.parse(profile?.top_makes || '[]')).join(', ') },
        { label: t(lang, 'profile.vehicleType'), value: (JSON.parse(profile?.body_types || '[]')).join(', ') },
        { label: t(lang, 'profile.priceRange'), value: `€ ${(profile?.price_min||0).toLocaleString('de-DE')} – € ${(profile?.price_max||0).toLocaleString('de-DE')}` },
        { label: t(lang, 'profile.yearRange'), value: `${profile?.year_min || '—'} – ${profile?.year_max || '—'}` },
        { label: t(lang, 'profile.maxMileage'), value: `${(profile?.mileage_max||0).toLocaleString('de-DE')} km` },
        { label: t(lang, 'profile.fuelType'), value: (JSON.parse(profile?.fuel_types || '[]')).join(', ') },
      ],
    },
    notifications: {
      title: t(lang, 'profile.notifications'),
      dailyEnabled: !!dealer.push_enabled,
      pushTime: dealer.push_time || '07:00',
      maxPerDay: dealer.max_recommendations_per_day || 10,
    },
  });
});

module.exports = router;
