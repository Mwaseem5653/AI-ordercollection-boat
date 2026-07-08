const fs = require('fs');
const path = require('path');
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../products.json'), 'utf8'));

const code1066 = products.filter(p => (p.code || '').includes('106'));
console.log('Products with code matching "106":');
console.log(JSON.stringify(code1066.slice(0, 10), null, 2));
