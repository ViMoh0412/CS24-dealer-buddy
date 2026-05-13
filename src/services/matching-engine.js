const { getDb } = require('../config/database');

class MatchingEngine {
  constructor() {
    this.db = getDb();
    this.weights = {};
    this.loadWeights();
  }

  loadWeights() {
    const rows = this.db.prepare('SELECT key, value FROM matching_config').all();
    for (const row of rows) {
      this.weights[row.key] = row.value;
    }
  }

  w(key) {
    return this.weights[key] ?? 0;
  }

  // =========================================================
  // STEP 1: Build dealer profiles from purchase history
  // =========================================================
  buildDealerProfiles() {
    const dealers = this.db.prepare('SELECT dealer_id FROM dealers').all();
    const upsert = this.db.prepare(`
      INSERT INTO dealer_profiles (dealer_id, top_makes, top_models, body_types,
        price_min, price_max, price_p25, price_p75,
        year_min, year_max, mileage_avg, mileage_max,
        fuel_types, total_purchases, last_purchase, computed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(dealer_id) DO UPDATE SET
        top_makes=excluded.top_makes, top_models=excluded.top_models,
        body_types=excluded.body_types,
        price_min=excluded.price_min, price_max=excluded.price_max,
        price_p25=excluded.price_p25, price_p75=excluded.price_p75,
        year_min=excluded.year_min, year_max=excluded.year_max,
        mileage_avg=excluded.mileage_avg, mileage_max=excluded.mileage_max,
        fuel_types=excluded.fuel_types, total_purchases=excluded.total_purchases,
        last_purchase=excluded.last_purchase, computed_at=datetime('now')
    `);

    const buildProfile = this.db.transaction(() => {
      for (const { dealer_id } of dealers) {
        const purchases = this.db.prepare(
          'SELECT * FROM purchase_history WHERE dealer_id = ? ORDER BY purchased_at DESC'
        ).all(dealer_id);

        if (purchases.length === 0) continue;

        const makeCounts = this._countField(purchases, 'purchased_make');
        const modelCounts = this._countField(purchases, 'purchased_model');
        const typeCounts = this._countField(purchases, 'purchased_body_type');
        const fuelCounts = this._countField(purchases, 'purchased_fuel');

        const prices = purchases.map(p => p.purchase_price).filter(Boolean).sort((a, b) => a - b);
        const years = purchases.map(p => p.purchased_year).filter(Boolean).sort((a, b) => a - b);
        const mileages = purchases.map(p => p.purchased_mileage).filter(Boolean);

        upsert.run(
          dealer_id,
          JSON.stringify(this._topN(makeCounts, 5)),
          JSON.stringify(this._topN(modelCounts, 10)),
          JSON.stringify(this._topN(typeCounts, 5)),
          prices[0] ?? 0,
          prices[prices.length - 1] ?? 0,
          this._percentile(prices, 25),
          this._percentile(prices, 75),
          years[0] ?? 2010,
          years[years.length - 1] ?? 2024,
          mileages.length ? Math.round(mileages.reduce((a, b) => a + b, 0) / mileages.length) : 0,
          mileages.length ? Math.max(...mileages) : 999999,
          JSON.stringify(this._topN(fuelCounts, 4)),
          purchases.length,
          purchases[0]?.purchased_at
        );
      }
    });

    buildProfile();
    return dealers.length;
  }

  // =========================================================
  // STEP 2: Score every active vehicle against every dealer
  // =========================================================
  runMatching(runDate) {
    this.loadWeights();
    const today = runDate || new Date().toISOString().split('T')[0];

    const run = this.db.prepare(`
      INSERT INTO matching_runs (run_date, status, started_at)
      VALUES (?, 'running', datetime('now'))
    `).run(today);
    const runId = run.lastInsertRowid;

    const vehicles = this.db.prepare(
      'SELECT * FROM vehicles WHERE is_active = 1'
    ).all();

    const profiles = this.db.prepare(`
      SELECT dp.*, d.postal_code as dealer_postal_code, d.max_pickup_radius_km
      FROM dealer_profiles dp
      JOIN dealers d ON d.dealer_id = dp.dealer_id
      WHERE d.push_enabled = 1
    `).all();

    const maxPerDealer = this.w('max_per_dealer') || 10;
    const minScore = this.w('min_match_score') || 70;

    const insertMatch = this.db.prepare(`
      INSERT INTO match_results (run_date, dealer_id, vehicle_id, match_score, score_breakdown, match_reasons, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `);

    let totalMatches = 0;

    const matchAll = this.db.transaction(() => {
      for (const profile of profiles) {
        const dealerDeclines = this._getDealerDeclines(profile.dealer_id);
        const dealerSearchProfile = this._getDealerSearchProfile(profile.dealer_id);
        const scoredVehicles = [];

        for (const vehicle of vehicles) {
          const { score, breakdown, reasons } = this._scoreVehicle(
            vehicle, profile, dealerDeclines, dealerSearchProfile
          );
          if (score >= minScore) {
            scoredVehicles.push({ vehicle, score, breakdown, reasons });
          }
        }

        scoredVehicles.sort((a, b) => b.score - a.score);
        const topMatches = scoredVehicles.slice(0, maxPerDealer);

        for (const m of topMatches) {
          insertMatch.run(
            today,
            profile.dealer_id,
            m.vehicle.vehicle_id,
            Math.round(m.score),
            JSON.stringify(m.breakdown),
            JSON.stringify(m.reasons),
          );
          totalMatches++;
        }
      }
    });

    matchAll();

    this.db.prepare(`
      UPDATE matching_runs SET
        vehicles_count = ?,
        dealers_count = ?,
        matches_total = ?,
        status = 'completed',
        completed_at = datetime('now')
      WHERE id = ?
    `).run(vehicles.length, profiles.length, totalMatches, runId);

    return {
      runId,
      runDate: today,
      vehiclesCount: vehicles.length,
      dealersCount: profiles.length,
      matchesTotal: totalMatches,
    };
  }

  // =========================================================
  // CORE: Score a single vehicle against a single dealer
  // =========================================================
  _scoreVehicle(vehicle, profile, declines, searchProfile) {
    const breakdown = {};
    const reasons = [];

    const topMakes = this._parseJson(profile.top_makes);
    const topModels = this._parseJson(profile.top_models);
    const bodyTypes = this._parseJson(profile.body_types);
    const fuelTypes = this._parseJson(profile.fuel_types);

    // --- Brand Score ---
    const makeCount = topMakes.filter(m => m.toLowerCase() === vehicle.make?.toLowerCase()).length;
    if (topMakes.length > 0 && makeCount > 0) {
      const makeIdx = topMakes.findIndex(m => m.toLowerCase() === vehicle.make?.toLowerCase());
      breakdown.brand = makeIdx === 0 ? 100 : makeIdx <= 2 ? 80 : 50;
      if (breakdown.brand >= 80) reasons.push('Brand');
    } else {
      breakdown.brand = 0;
    }

    // --- Model Score ---
    const modelMatch = topModels.some(m => vehicle.model?.toLowerCase().includes(m.toLowerCase()));
    if (modelMatch) {
      breakdown.model = 100;
      reasons.push('Model');
    } else if (breakdown.brand >= 50) {
      breakdown.model = 30;
    } else {
      breakdown.model = 0;
    }

    // --- Body Type Score ---
    if (bodyTypes.length === 0) {
      breakdown.type = 50;
    } else {
      const typeMatch = bodyTypes.some(t =>
        t.toLowerCase() === vehicle.body_type?.toLowerCase()
      );
      breakdown.type = typeMatch ? 100 : 0;
      if (typeMatch) reasons.push('Type');
    }

    // --- Price Score ---
    const vPrice = vehicle.price;
    if (vPrice >= profile.price_p25 && vPrice <= profile.price_p75) {
      breakdown.price = 100;
      reasons.push('Price');
    } else if (vPrice >= profile.price_min && vPrice <= profile.price_max) {
      const range = profile.price_max - profile.price_min;
      if (range > 0) {
        const distFromCenter = Math.abs(vPrice - (profile.price_p25 + profile.price_p75) / 2);
        breakdown.price = Math.max(30, 100 - (distFromCenter / range) * 100);
      } else {
        breakdown.price = 50;
      }
    } else {
      breakdown.price = 0;
    }

    // --- Year Score ---
    const vYear = vehicle.year || parseInt(vehicle.first_registration);
    if (vYear >= profile.year_min && vYear <= profile.year_max) {
      breakdown.year = 100;
      reasons.push('Year');
    } else if (vYear >= profile.year_min - 2 && vYear <= profile.year_max + 2) {
      breakdown.year = 50;
    } else {
      breakdown.year = 0;
    }

    // --- Mileage Score ---
    const vMileage = vehicle.mileage_km;
    if (vMileage == null) {
      breakdown.mileage = 50;
    } else if (vMileage <= (profile.mileage_avg || 100000)) {
      breakdown.mileage = 100;
    } else if (vMileage <= (profile.mileage_max || 200000)) {
      const ratio = vMileage / (profile.mileage_max || 200000);
      breakdown.mileage = Math.max(20, Math.round((1 - ratio) * 100 + 50));
    } else {
      breakdown.mileage = 0;
    }

    // --- Fuel Score ---
    if (fuelTypes.length === 0) {
      breakdown.fuel = 50;
    } else {
      const fuelMatch = fuelTypes.some(f =>
        f.toLowerCase() === vehicle.fuel_type?.toLowerCase()
      );
      breakdown.fuel = fuelMatch ? 100 : 10;
      if (fuelMatch) reasons.push('Fuel');
    }

    // --- Distance Score (simplified: postal code prefix matching) ---
    breakdown.distance = this._scoreDistance(
      vehicle.postal_code, profile.dealer_postal_code, profile.max_pickup_radius_km
    );
    if (breakdown.distance >= 80) reasons.push('Location');

    // --- Weighted total ---
    let score =
      (breakdown.brand * this.w('weight_brand') / 100) +
      (breakdown.model * this.w('weight_model') / 100) +
      (breakdown.type * this.w('weight_type') / 100) +
      (breakdown.price * this.w('weight_price') / 100) +
      (breakdown.year * this.w('weight_year') / 100) +
      (breakdown.mileage * this.w('weight_mileage') / 100) +
      (breakdown.fuel * this.w('weight_fuel') / 100) +
      (breakdown.distance * this.w('weight_distance') / 100);

    // --- Freshness Bonus (listed in last 48h) ---
    if (vehicle.listed_at) {
      const hoursAgo = (Date.now() - new Date(vehicle.listed_at).getTime()) / 3600000;
      if (hoursAgo < 48) {
        score += this.w('bonus_freshness');
        breakdown.freshness = this.w('bonus_freshness');
      }
    }

    // --- Recency Boost (dealer bought something in last 30 days) ---
    if (profile.last_purchase) {
      const daysSince = (Date.now() - new Date(profile.last_purchase).getTime()) / 86400000;
      if (daysSince < 30) {
        score += this.w('bonus_recency');
        breakdown.recency = this.w('bonus_recency');
      }
    }

    // --- Declined Penalty ---
    const declinedSimilar = declines.some(d =>
      d.make === vehicle.make && d.model === vehicle.model
    );
    if (declinedSimilar) {
      score -= this.w('penalty_declined');
      breakdown.declined_penalty = -this.w('penalty_declined');
    }

    // --- Explicit Search Profile Boost ---
    if (searchProfile) {
      let explicitBoost = 0;
      const wantedMakes = this._parseJson(searchProfile.wanted_makes);
      const wantedTypes = this._parseJson(searchProfile.wanted_types);

      if (wantedMakes.some(m => m.toLowerCase() === vehicle.make?.toLowerCase())) {
        explicitBoost += 5;
      }
      if (wantedTypes.some(t => t.toLowerCase() === vehicle.body_type?.toLowerCase())) {
        explicitBoost += 3;
      }
      if (searchProfile.price_min && searchProfile.price_max) {
        if (vehicle.price >= searchProfile.price_min && vehicle.price <= searchProfile.price_max) {
          explicitBoost += 4;
        }
      }
      if (explicitBoost > 0) {
        score += Math.min(explicitBoost, 10);
        breakdown.explicit_boost = Math.min(explicitBoost, 10);
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    return { score, breakdown, reasons };
  }

  // =========================================================
  // Helper: Distance scoring via postal code prefix
  // =========================================================
  _scoreDistance(vehiclePLZ, dealerPLZ, maxRadius) {
    if (!vehiclePLZ || !dealerPLZ) return 50;
    const v = vehiclePLZ.toString().padStart(5, '0');
    const d = dealerPLZ.toString().padStart(5, '0');

    if (v.substring(0, 3) === d.substring(0, 3)) return 100;
    if (v.substring(0, 2) === d.substring(0, 2)) return 70;
    if (v.substring(0, 1) === d.substring(0, 1)) return 40;
    return 10;
  }

  // =========================================================
  // Helpers
  // =========================================================
  _getDealerDeclines(dealerId) {
    return this.db.prepare(`
      SELECT v.make, v.model FROM dealer_actions da
      JOIN vehicles v ON v.vehicle_id = da.vehicle_id
      WHERE da.dealer_id = ? AND da.action_type = 'not_interested'
      AND da.created_at > datetime('now', '-30 days')
    `).all(dealerId);
  }

  _getDealerSearchProfile(dealerId) {
    return this.db.prepare(
      'SELECT * FROM dealer_search_profiles WHERE dealer_id = ? ORDER BY updated_at DESC LIMIT 1'
    ).get(dealerId);
  }

  _countField(rows, field) {
    const counts = {};
    for (const row of rows) {
      const val = row[field];
      if (val) counts[val] = (counts[val] || 0) + 1;
    }
    return counts;
  }

  _topN(counts, n) {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k);
  }

  _percentile(sortedArr, pct) {
    if (sortedArr.length === 0) return 0;
    const idx = Math.floor((pct / 100) * sortedArr.length);
    return sortedArr[Math.min(idx, sortedArr.length - 1)];
  }

  _parseJson(str) {
    if (!str) return [];
    try { return JSON.parse(str); } catch { return []; }
  }
}

module.exports = MatchingEngine;
