const { closeDb } = require('./config/database');
const MatchingEngine = require('./services/matching-engine');
const PushService = require('./services/push-service');

async function run() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const date = args[0] || new Date().toISOString().split('T')[0];
  console.log(`\n  Running matching for ${date}...\n`);

  const engine = new MatchingEngine();

  console.log('  Step 1: Building dealer profiles from purchase history...');
  const profileCount = engine.buildDealerProfiles();
  console.log(`  → ${profileCount} dealer profiles built\n`);

  console.log('  Step 2: Scoring vehicles against dealer profiles...');
  const result = engine.runMatching(date);
  console.log(`  → ${result.vehiclesCount} vehicles × ${result.dealersCount} dealers`);
  console.log(`  → ${result.matchesTotal} matches above threshold\n`);

  const autoApprove = process.argv.includes('--approve');
  if (autoApprove) {
    const { getDb } = require('./config/database');
    const db = getDb();
    db.prepare(`
      UPDATE match_results SET status = 'approved'
      WHERE run_date = ? AND status = 'pending'
    `).run(date);
    console.log('  Step 3: Auto-approved all matches');

    console.log('  Step 4: Sending push notifications...');
    const pushService = new PushService();
    const pushResults = await pushService.sendDailyPushes(date);
    console.log(`  → Pushed to ${pushResults.length} dealers\n`);

    for (const r of pushResults) {
      console.log(`    ${r.companyName}: ${r.matchCount} vehicles (top score: ${r.topScore}%)`);
    }
  } else {
    console.log('  Matches are pending approval. Use --approve to auto-approve and push.\n');
  }

  closeDb();
}

run().catch(err => {
  console.error('Matching run failed:', err);
  process.exit(1);
});
