const { findBestProductMatchLocal, bulkVerifyProductsLocal } = require('./productSearch');

const items = [
    { nameOrCode: '9007', requestedSize: 'Gallon' },
    { nameOrCode: '9059', requestedSize: 'Gallon' },
    { nameOrCode: '9072', requestedSize: 'Gallon' },
    { nameOrCode: '9073', requestedSize: 'Gallon' },
    { nameOrCode: '8767', requestedSize: 'Gallon' }
];

console.log('--- BULK VERIFY RESULTS ---');
const results = bulkVerifyProductsLocal(items);
console.log(JSON.stringify(results, null, 2));
