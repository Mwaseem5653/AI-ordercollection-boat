const { findBestProductMatchLocal } = require('../productSearch.js');

const tests = [
  // Bug 1: Bold dist - should BRAND_MISMATCH not match FAME DISTEMPER
  { q: 'Bold dist',            size: 'gallon', label: 'Bug1: Bold dist → must NOT match FAME' },
  // Bug 2: Partial code collision - 500 must NOT match code 50
  { q: '500',                  size: '',       label: 'Bug2: 500 → must NOT match EXTRA 50' },
  { q: '50',                   size: '',       label: 'Bug2: 50 → should match EXTRA ENAMEL 50' },
  // Fix 4: Interior vs Exterior distinction
  { q: 'Extra interior putty', size: 'gallon', label: 'Fix4: interior putty' },
  { q: 'Extra exterior putty', size: 'gallon', label: 'Fix4: exterior putty' },
  // Fix 5: WHI71 alphanumeric split
  { q: 'WHI71',                size: '',       label: 'Fix5: WHI71 → EXTRA MATT 71 WHITE' },
  { q: 'Whi 71',               size: '',       label: 'Fix5: Whi 71 → same' },
  // Fix 6: Matt without brand → AMBIGUOUS
  { q: 'Matt',                 size: 'gallon', label: 'Fix6: Matt gallon → AMBIGUOUS' },
  // Brand mismatch guard
  { q: 'Bold enamel white',    size: 'gallon', label: 'Bold enamel → Bold product' },
  { q: 'Extra enamel white',   size: 'gallon', label: 'Extra enamel white → Extra product' },
  // Code edge cases
  { q: '5000',                 size: '',       label: 'Code 5000 → NOT_IN_DATABASE' },
  { q: '340',                  size: '',       label: 'Code 340 → EXTRA ENAMEL 340' },
  // Water Matt drum extra
  { q: 'Water Matt drum extra',size: '',       label: 'Water Matt extra → EXTRA WATER MATT' },
  // Semi plastic
  { q: 'Extra semi',           size: 'gallon', label: 'Extra semi gallon' },
  { q: 'Bold semi',            size: 'gallon', label: 'Bold semi gallon' },
];

console.log('\n====== EDGE CASE TESTS (v3) ======\n');
let pass = 0, fail = 0;
tests.forEach(({ q, size, label }) => {
  const result = findBestProductMatchLocal(q, size);
  const icon = result.startsWith('MATCH')         ? '✅ MATCH      '
             : result.startsWith('AMBIGUOUS')      ? '⚠️  AMBIGUOUS  '
             : result.startsWith('BRAND_MISMATCH') ? '🔴 BRAND_MISS '
             : result.startsWith('LOW_CONFIDENCE') ? '🟡 LOW_CONF   '
             : result.startsWith('SIZE_NOT')        ? '📏 SIZE_ERR   '
             : '❌ NOT_FOUND  ';

  console.log(`${icon} | ${label}`);
  console.log(`             └─ ${result}`);
  console.log('');
});
