const { findBestProductMatchLocal } = require('../productSearch');
const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('products.json', 'utf8'));

// Find all products matching BOLD RED OXIDE or ROP or Primer
const boldRop = raw.filter(p => {
    const fn = p.fullName.toUpperCase();
    return fn.includes('BOLD') && (fn.includes('RED') || fn.includes('OXIDE') || fn.includes('PRIMER') || fn.includes('ROP'));
});

console.log('--- ALL BOLD RED OXIDE/PRIMER ITEMS IN DB ---');
boldRop.forEach(p => console.log(`${p.fullName} | size: ${p.size}`));

console.log('\n--- SEARCH RESULT FOR ("bold rop", "Gallon") ---');
console.log(findBestProductMatchLocal('bold rop', 'Gallon'));

console.log('\n--- SEARCH RESULT FOR ("bold rop 2 gallon", "Gallon") ---');
console.log(findBestProductMatchLocal('bold rop 2 gallon', 'Gallon'));
