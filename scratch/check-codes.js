const fs = require('fs');
const path = require('path');
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../products.json'), 'utf8'));

const codes = [...new Set(products.map(p => p.code).filter(Boolean))];
console.log('Total unique codes:', codes.length);
console.log('Sample codes:', codes.slice(0, 50));

// Let's see if codes are mostly numeric or alphanumeric
const numericCodes = codes.filter(c => /^\d+$/.test(c));
const alphaNumericCodes = codes.filter(c => /[A-Z]/i.test(c) && /\d/.test(c));
const otherCodes = codes.filter(c => !/^\d+$/.test(c) && !(/[A-Z]/i.test(c) && /\d/.test(c)));

console.log('Numeric codes:', numericCodes.length, 'Sample:', numericCodes.slice(0, 10));
console.log('Alphanumeric codes:', alphaNumericCodes.length, 'Sample:', alphaNumericCodes.slice(0, 10));
console.log('Other codes:', otherCodes.length, 'Sample:', otherCodes.slice(0, 10));
