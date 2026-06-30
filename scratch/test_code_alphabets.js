const { findBestProductMatchLocal } = require('../productSearch.js');

console.log('--- Testing Query "Altra 41" (should match ALTRA FRESH COAT EML DD41 WHITE-D) ---');
const res1 = findBestProductMatchLocal('Altra 41', 'D');
console.log(res1);

console.log('\n--- Testing Query "Altra DD41" (should match ALTRA FRESH COAT EML DD41 WHITE-D) ---');
const res2 = findBestProductMatchLocal('Altra DD41', 'D');
console.log(res2);

console.log('\n--- Testing Query "Altra dd41" (should match ALTRA FRESH COAT EML DD41 WHITE-D) ---');
const res3 = findBestProductMatchLocal('Altra dd41', 'D');
console.log(res3);
