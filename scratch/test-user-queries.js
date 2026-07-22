const { findBestProductMatchLocal, loadProducts } = require('../productSearch.js');

// Load products database first
loadProducts();

const queries = [
  { nameOrCode: 'trend t105', requestedSize: 'Gallon' },
  { nameOrCode: 'extra enamel 303', requestedSize: 'Quarter' },
  { nameOrCode: '2 num', requestedSize: 'Gallon' },
  { nameOrCode: 'extra semi ashwite', requestedSize: 'Gallon' },
];

console.log('====== RUNNING PRODUCT SEARCH WITH CODE PRIORITY ======\n');

queries.forEach(({ nameOrCode, requestedSize }) => {
  console.log(`Query: "${nameOrCode}" | Size: "${requestedSize}"`);
  const result = findBestProductMatchLocal(nameOrCode, requestedSize);
  console.log(`Result:\n${result}\n-----------------------------------------------\n`);
});
