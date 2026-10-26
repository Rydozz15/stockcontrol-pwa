/**
 * Common test helper and assertion utilities for StockControl E2E suite
 */

const assert = require('assert');

/**
 * Runs test cases directly if the file is executed standalone.
 * @param {string} suiteName
 * @param {Array<{ name: string; fn: Function }>} tests
 */
async function runDirectly(suiteName, tests) {
  console.log(`\n--- Running Suite: ${suiteName} ---`);
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${t.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`Result: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

module.exports = {
  assert,
  runDirectly
};
