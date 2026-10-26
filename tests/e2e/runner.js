#!/usr/bin/env node

/**
 * StockControl PWA - Master Automated E2E Test Runner
 * Authoritative source: TEST_INFRA.md, ORIGINAL_REQUEST.md, PROJECT.md
 */

const fs = require('fs');
const path = require('path');

const TIERS = [
  { id: 'tier1', label: 'Tier 1: Feature Coverage', dir: path.join(__dirname, 'tier1_features') },
  { id: 'tier2', label: 'Tier 2: Boundary & Corner Cases', dir: path.join(__dirname, 'tier2_boundaries') },
  { id: 'tier3', label: 'Tier 3: Cross-Feature Combinations', dir: path.join(__dirname, 'tier3_combinations') },
  { id: 'tier4', label: 'Tier 4: Real-World Kitchen Scenarios', dir: path.join(__dirname, 'tier4_realworld') }
];

// Parse CLI arguments
const args = process.argv.slice(2);
let selectedTier = null;
let filterQuery = null;
let verbose = false;

for (const arg of args) {
  if (arg.startsWith('--tier=')) {
    selectedTier = arg.split('=')[1].toLowerCase();
  } else if (arg.startsWith('--filter=')) {
    filterQuery = arg.split('=')[1].toLowerCase();
  } else if (arg === '-v' || arg === '--verbose') {
    verbose = true;
  }
}

async function run() {
  console.log('\n============================================================');
  console.log('       StockControl PWA - Automated E2E Test Suite          ');
  console.log('   Opaque-Box Verification across Tiers 1-4 (>=300 Tests)   ');
  console.log('============================================================\n');

  const overallStart = Date.now();
  const tierReports = [];
  let grandTotalPassed = 0;
  let grandTotalFailed = 0;
  const failureDetails = [];

  for (const tier of TIERS) {
    if (selectedTier && selectedTier !== 'all' && !tier.id.includes(selectedTier)) {
      continue;
    }

    if (!fs.existsSync(tier.dir)) {
      console.warn(`[WARN] Directory not found: ${tier.dir}`);
      continue;
    }

    const files = fs.readdirSync(tier.dir).filter(f => f.endsWith('.test.js')).sort();
    console.log(`\n▶ Running ${tier.label} (${files.length} test files)`);
    console.log('─'.repeat(60));

    let tierPassed = 0;
    let tierFailed = 0;
    const tierStart = Date.now();

    for (const file of files) {
      const fullPath = path.join(tier.dir, file);
      let suite;
      try {
        suite = require(fullPath);
      } catch (loadErr) {
        console.error(`  ✗ Failed to load suite ${file}: ${loadErr.message}`);
        tierFailed++;
        failureDetails.push({ suite: file, test: 'Suite Import', error: loadErr.message });
        continue;
      }

      const suiteId = suite.id || file.replace('.test.js', '');
      const suiteName = suite.name || file;

      for (const testCase of suite.tests || []) {
        if (filterQuery && !testCase.name.toLowerCase().includes(filterQuery) && !suiteId.toLowerCase().includes(filterQuery)) {
          continue;
        }

        try {
          await testCase.fn();
          tierPassed++;
          if (verbose) {
            console.log(`  ✓ [${suiteId}] ${testCase.name}`);
          }
        } catch (err) {
          tierFailed++;
          console.error(`  ✗ [${suiteId}] ${testCase.name}`);
          console.error(`    Error: ${err.message}`);
          failureDetails.push({ suite: suiteName, test: testCase.name, error: err.message });
        }
      }
    }

    const tierElapsed = Date.now() - tierStart;
    console.log(`  Summary: ${tierPassed} passed, ${tierFailed} failed (${tierElapsed}ms)`);

    tierReports.push({
      tier: tier.label,
      filesCount: files.length,
      passed: tierPassed,
      failed: tierFailed,
      elapsed: tierElapsed
    });

    grandTotalPassed += tierPassed;
    grandTotalFailed += tierFailed;
  }

  const overallElapsed = Date.now() - overallStart;

  // Print Grand Summary Table
  console.log('\n============================================================');
  console.log('                 FINAL TEST EXECUTION SUMMARY               ');
  console.log('============================================================');
  console.log(' Tier Name                              | Passed | Failed | Time   ');
  console.log('----------------------------------------+--------+--------+--------');

  for (const r of tierReports) {
    const tierNamePadded = r.tier.padEnd(38, ' ');
    const passedStr = String(r.passed).padStart(6, ' ');
    const failedStr = String(r.failed).padStart(6, ' ');
    const timeStr = `${r.elapsed}ms`.padStart(6, ' ');
    console.log(` ${tierNamePadded} | ${passedStr} | ${failedStr} | ${timeStr}`);
  }

  console.log('----------------------------------------+--------+--------+--------');
  const totalPassedStr = String(grandTotalPassed).padStart(6, ' ');
  const totalFailedStr = String(grandTotalFailed).padStart(6, ' ');
  const totalTimeStr = `${overallElapsed}ms`.padStart(6, ' ');
  console.log(` ${'TOTAL ALL TIERS'.padEnd(38, ' ')} | ${totalPassedStr} | ${totalFailedStr} | ${totalTimeStr}`);
  console.log('============================================================');

  if (failureDetails.length > 0) {
    console.log('\n[FAILURES REPORT]');
    failureDetails.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.suite}] ${f.test}: ${f.error}`);
    });
    console.log('\n>>> RESULT: FAILED (Exit Code 1)\n');
    process.exit(1);
  } else {
    console.log(`\n>>> RESULT: SUCCESS - All ${grandTotalPassed} tests passed cleanly! (Exit Code 0)\n`);
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal Test Runner Exception:', err);
  process.exit(1);
});
