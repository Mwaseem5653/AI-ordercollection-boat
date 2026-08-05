const { findBestProductMatchLocal } = require('../productSearch.js');

const testQueries = [
  { q: 'extra 1', size: 'gallon' },
  { q: 'extra semi 1', size: 'gallon' },
  { q: 'extra semi 8', size: '3 gallon' },
  { q: 'bold weather safe 1918', size: 'gallon' },
  { q: 'exclusive emulsion 2 off white', size: 'gallon' },
  { q: 'extra rop', size: '2 balti' },
  { q: 'extra putty', size: 'drum' },
  { q: 'extra semi white', size: 'gallon' },
  { q: 'extra semi lavender white', size: 'drum' }
];

console.log('====== BULK USER QUERIES MATCH TEST ======\n');
testQueries.forEach(({ q, size }, idx) => {
  console.log(`[Query #${idx + 1}] Search: "${q}" | Size: "${size}"`);
  const result = findBestProductMatchLocal(q, size);
  console.log(`Result:    ${result}`);
  console.log('--------------------------------------------------');
});
