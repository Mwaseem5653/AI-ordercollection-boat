const { findBestProductMatchLocal, bulkVerifyProductsLocal } = require('../productSearch');
const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('products.json', 'utf8'));

const codes = ['9007', '9059', '9072', '9073', '8767', '49', '8775', '336', '3162', 'W331'];

console.log('=== CHECKING CODES IN PRODUCTS.JSON ===');
codes.forEach(c => {
    const matches = raw.filter(p => p.code === c);
    console.log(`\nCode ${c} (${matches.length} matches in DB):`);
    matches.forEach(m => console.log(`   - [${m.brand}] ${m.fullName}`));
});

console.log('\n=== RUNNING BULK VERIFY ===');
const testItems = codes.map(c => ({ nameOrCode: c, requestedSize: 'Gallon' }));
const res = bulkVerifyProductsLocal(testItems);
res.forEach(r => console.log(`${r.original} -> ${r.result}`));
