const { findBestProductMatchLocal } = require('../productSearch.js');

const testCases = [
  { q: 'extra 1', size: '2 gallon' },
  { q: 'extra semi white', size: '2 gallon' },
  { q: 'extra putty', size: '2 drum' },
  { q: 'extra rop', size: '2 gallon' }
];

console.log('====== TESTING SPECIFIC USER QUERIES ======\n');
testCases.forEach(({ q, size }) => {
  console.log(`Query: "${q}" | Size: "${size}"`);
  console.log(`Result: ${findBestProductMatchLocal(q, size)}`);
  console.log('--------------------------------------------');
});
