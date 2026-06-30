const { findBestProductMatchLocal, loadProducts } = require('../productSearch.js');

// Load database products
loadProducts();

// Let's test a search query without size first:
console.log('--- TEST 1: extra weather shield magnolia (no size) ---');
const res1 = findBestProductMatchLocal('extra weather shield magnolia');
console.log('Result:', res1);

console.log('\n--- TEST 2: extra weather shield magnolia (size G) ---');
const res2 = findBestProductMatchLocal('extra weather shield magnolia', 'G');
console.log('Result:', res2);

console.log('\n--- TEST 3: extra w/s magnolia (size G) ---');
const res3 = findBestProductMatchLocal('extra w/s magnolia', 'G');
console.log('Result:', res3);
