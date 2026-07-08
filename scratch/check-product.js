const fs = require('fs');
const path = require('path');
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../products.json'), 'utf8'));

const extraSemi03 = products.filter(p => p.fullName.toUpperCase().includes('EXTRA SEMI 03 WHITE'));
console.log('EXTRA SEMI 03 WHITE products:');
console.log(JSON.stringify(extraSemi03, null, 2));
