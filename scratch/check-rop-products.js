const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('products.json', 'utf8'));

const ropItems = raw.filter(p => {
    const fn = p.fullName.toUpperCase();
    return fn.includes('ROP') || fn.includes('R.O.P') || (fn.includes('RED') && fn.includes('OXIDE') && fn.includes('PRIMER'));
});

console.log('--- ALL ROP / R.O.P / RED OXIDE PRIMER ITEMS ---');
ropItems.forEach(p => console.log(`${p.fullName} | brand=${p.brand} | product=${p.product} | code=${p.code} | size=${p.size}`));
