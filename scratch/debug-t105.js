const fs = require('fs');
const path = require('path');

// We need to load productSearch and mock/inspect tokenization
const ps = require('../productSearch');

const query = "trend T105 sand stone";
console.log('PRODUCTS in DB:', ps.findBestProductMatchLocal(query, 'Gallon'));
