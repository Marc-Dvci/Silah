// The summary on the CI run page: test counts, and coverage of the decision core per module.
// Run after `npm run coverage`: node scripts/ci-summary.mjs >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from 'node:fs';

const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const tests = read('coverage/tests.json');
const coverage = read('coverage/coverage-summary.json');

console.log('## Unit tests, in random order\n');
if (tests) {
  console.log('| Files | Tests | Passed | Failed | Skipped |\n|---|---|---|---|---|');
  console.log(`| ${tests.testResults.length} | ${tests.numTotalTests} | ${tests.numPassedTests} | ${tests.numFailedTests} | ${tests.numPendingTests + (tests.numTodoTests ?? 0)} |`);
} else {
  console.log('The test run wrote no results.');
}

if (coverage) {
  const row = (name, c) => `| ${name} | ${c.lines.pct}% | ${c.branches.pct}% | ${c.functions.pct}% |`;
  console.log('\n## Coverage of the decision core (`src/core`)\n');
  console.log('| Module | Lines | Branches | Functions |\n|---|---|---|---|');
  console.log(row('**All of `src/core`**', coverage.total));
  for (const file of Object.keys(coverage).filter((k) => k !== 'total').sort()) {
    const short = file.replace(/\\/g, '/').replace(/^.*\/src\/core\//, '');
    console.log(row(`\`${short}\``, coverage[file]));
  }
}
