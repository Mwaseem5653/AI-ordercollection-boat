const { findBestProductMatchLocal } = require('../productSearch');
const fs = require('fs');
const path = require('path');
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../products.json'), 'utf8'));

// Find products with code T106
const t106Products = products.filter(p => p.code === 'T106');
console.log('T106 products in JSON file:');
console.log(JSON.stringify(t106Products, null, 2));
