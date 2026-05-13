const { getDb } = require('../config/database');
const { t } = require('../i18n/translations');

class PushService {
  constructor() {
    this.db = getDb();
    // In production, initialize Firebase Admin SDK here:
    // const admin = require('firebase-admin');
    // admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    // this.messaging = admin.messaging();
    this.messaging = null;
  }

  async sendDailyPushes(runDate) {
    const today = runDate || new Date().toISOString().split('T')[0];

    const dealerMatches = this.db.prepare(`
      SELECT
        mr.dealer_id,
        d.company_name,
        d.push_device_token,
        d.preferred_lang,
        COUNT(*) as match_count,
        MAX(mr.match_score) as top_score,
        GROUP_CONCAT(mr.id) as match_ids
      FROM match_results mr
      JOIN dealers d ON d.dealer_id = mr.dealer_id
      WHERE mr.run_date = ? AND mr.status = 'approved' AND d.push_enabled = 1
      GROUP BY mr.dealer_id
    `).all(today);

    const results = [];

    for (const dm of dealerMatches) {
      const topMatch = this.db.prepare(`
        SELECT mr.*, v.make, v.model, v.price
        FROM match_results mr
        JOIN vehicles v ON v.vehicle_id = mr.vehicle_id
        WHERE mr.run_date = ? AND mr.dealer_id = ?
        ORDER BY mr.match_score DESC LIMIT 1
      `).get(today, dm.dealer_id);

      const lang = dm.preferred_lang || 'de';
      const title = t(lang, 'push.title', { count: dm.match_count });
      const body = t(lang, 'push.body', {
        topMatch: `${topMatch.make} ${topMatch.model}`,
        price: topMatch.price?.toLocaleString('de-DE'),
        pct: Math.round(topMatch.match_score),
        remaining: dm.match_count - 1,
      });

      const payload = {
        notification: { title, body },
        data: {
          type: 'daily_matches',
          run_date: today,
          dealer_id: dm.dealer_id,
          match_count: String(dm.match_count),
        },
      };

      const logEntry = this.db.prepare(`
        INSERT INTO push_log (dealer_id, match_ids, payload, status, sent_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(
        dm.dealer_id,
        dm.match_ids,
        JSON.stringify(payload),
        dm.push_device_token ? 'sent' : 'no_token'
      );

      if (this.messaging && dm.push_device_token) {
        try {
          await this.messaging.send({
            token: dm.push_device_token,
            ...payload,
          });
        } catch (err) {
          this.db.prepare('UPDATE push_log SET status = ? WHERE id = ?')
            .run('failed', logEntry.lastInsertRowid);
        }
      }

      this.db.prepare(`
        UPDATE match_results SET status = 'pushed'
        WHERE run_date = ? AND dealer_id = ? AND status = 'approved'
      `).run(today, dm.dealer_id);

      results.push({
        dealerId: dm.dealer_id,
        companyName: dm.company_name,
        matchCount: dm.match_count,
        topScore: dm.top_score,
        hasToken: !!dm.push_device_token,
        pushTitle: title,
      });
    }

    return results;
  }
}

module.exports = PushService;
