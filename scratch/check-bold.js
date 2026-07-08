const fs = require('fs');
const path = require('path');
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../products.json'), 'utf8'));

const boldWhite = products.filter(p => p.brand.toUpperCase() === 'BOLD' && p.color.toUpperCase().includes('WHITE'));
console.log(JSON.stringify(boldWhite.slice(0, 10), null, 2));
