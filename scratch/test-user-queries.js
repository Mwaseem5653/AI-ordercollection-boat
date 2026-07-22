const { findBestProductMatchLocal, loadProducts } = require('../productSearch.js');

// Load products database first
loadProducts();

const queries = [
  { nameOrCode: '2', requestedSize: 'Gallon' },
  { nameOrCode: '2 num', requestedSize: 'Gallon' },
  { nameOrCode: 'extra semi ashwite', requestedSize: '' },
  { nameOrCode: 'extra semi ashwite', requestedSize: 'Gallon' },
  { nameOrCode: 'extra semi ashwite', requestedSize: 'Quarter' },
];

console.log('====== RUNNING PRODUCT SEARCH FOR USER QUERIES ======\n');

queries.forEach(({ nameOrCode, requestedSize }) => {
  console.log(`Query: "${nameOrCode}" | Size: "${requestedSize}"`);
  const result = findBestProductMatchLocal(nameOrCode, requestedSize);
  console.log(`Result:\n${result}\n-----------------------------------------------\n`);
});
