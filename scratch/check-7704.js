const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('products.json', 'utf8'));

const rop7704 = raw.filter(p => p.code === '7704' || p.fullName.includes('7704'));
console.log('--- ALL 7704 ITEMS IN PRODUCTS.JSON ---');
rop7704.forEach(p => console.log(JSON.stringify(p, null, 2)));
