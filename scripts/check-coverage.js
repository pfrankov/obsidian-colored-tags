#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-final.json');

if (!fs.existsSync(coverageFile)) {
  console.error('Coverage JSON not found, run tests with --coverage first');
  process.exit(1);
}

const raw = fs.readFileSync(coverageFile, 'utf8');
const data = JSON.parse(raw);

let totals = { statements: { total: 0, covered: 0 }, functions: { total: 0, covered: 0 }, branches: { total: 0, covered: 0 }, lines: { total: 0, covered: 0 } };

for (const filePath of Object.keys(data)) {
  const file = data[filePath];
  // statements
  if (file.s) {
    const keys = Object.keys(file.s);
    totals.statements.total += keys.length;
    totals.statements.covered += keys.filter((k) => file.s[k] > 0).length;
  }
  // functions
  if (file.f) {
    const keys = Object.keys(file.f);
    totals.functions.total += keys.length;
    totals.functions.covered += keys.filter((k) => file.f[k] > 0).length;
  }
  // branches: each branch entry contains an array with counts for each branch target
  if (file.b) {
    const keys = Object.keys(file.b);
    for (const k of keys) {
      totals.branches.total += file.b[k].length;
      totals.branches.covered += file.b[k].filter((c) => c > 0).length;
    }
  }
  // lines
  if (file.l) {
    const keys = Object.keys(file.l);
    totals.lines.total += keys.length;
    totals.lines.covered += keys.filter((k) => file.l[k] > 0).length;
  }
}

const pct = (covered, total) => (total === 0 ? 100 : (covered / total) * 100);

const coverage = {
  statements: pct(totals.statements.covered, totals.statements.total),
  functions: pct(totals.functions.covered, totals.functions.total),
  branches: pct(totals.branches.covered, totals.branches.total),
  lines: pct(totals.lines.covered, totals.lines.total),
};

const threshold = 100;
let failed = false;
for (const key of Object.keys(coverage)) {
  const value = coverage[key];
  console.log(`${key.padStart(10)}: ${value.toFixed(2)}%`);
  if (value < threshold) {
    console.error(`Coverage for ${key} (${value.toFixed(2)}%) does not meet threshold (${threshold}%)`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('All coverage thresholds met');
