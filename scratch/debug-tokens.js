const { findBestProductMatchLocal } = require('../productSearch');
const fs = require('fs');
const path = require('path');
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../products.json'), 'utf8'));

// Let's print out what tokenize("trend T105 sand stone") returns
const ps = require('../productSearch');
console.log('Tokenized:', ps.findBestProductMatchLocal('trend T105 sand stone', 'Gallon'));
