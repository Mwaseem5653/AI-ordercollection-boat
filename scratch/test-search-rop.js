const { findBestProductMatchLocal, loadProducts } = require('../productSearch');
const fs = require('fs');

// Fix products.json in memory or file
const raw = JSON.parse(fs.readFileSync('products.json', 'utf8'));
let fixed = false;
raw.forEach(p => {
    if (p.fullName === 'BOLD R.O.P 7704-Q' && p.color === '') {
        p.color = 'Red Oxide';
        fixed = true;
    }
});

if (fixed) {
    fs.writeFileSync('products.json', JSON.stringify(raw, null, 2), 'utf8');
    loadProducts();
    console.log('Fixed BOLD R.O.P 7704-Q color in products.json!');
}

console.log('\n--- TEST 1: ("bold rop", "Gallon") ---');
console.log(findBestProductMatchLocal('bold rop', 'Gallon'));

console.log('\n--- TEST 2: ("bold rop", "Quarter") ---');
console.log(findBestProductMatchLocal('bold rop', 'Quarter'));

console.log('\n--- TEST 3: ("bold rop 2 gallon", "Gallon") ---');
console.log(findBestProductMatchLocal('bold rop', 'Gallon'));
