const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync('products.json', 'utf8'));

const ropItems = raw.filter(p => p.fullName.toUpperCase().includes('BOLD R.O.P'));

console.log('--- RAW BOLD R.O.P ITEMS IN PRODUCTS.JSON ---');
ropItems.forEach(p => {
    console.log(JSON.stringify(p, null, 2));
});
