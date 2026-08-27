const { findBestProductMatchLocal, bulkVerifyProductsLocal, loadProducts } = require('../productSearch');
const fs = require('fs');

loadProducts();

console.log('====================================================');
console.log('🧪 RUNNING COMPREHENSIVE DIFFERENT TEST SCENARIOS');
console.log('====================================================\n');

const testScenarios = [
    {
        name: "Scenario 1: Mixed Shorthands & Raw Codes",
        items: [
            { nameOrCode: '9007-G', requestedSize: 'Gallon' },
            { nameOrCode: '49-G', requestedSize: 'Gallon' },
            { nameOrCode: 'ext 66 black', requestedSize: 'Gallon' },
            { nameOrCode: 'lapy extra', requestedSize: 'Gallon' }
        ]
    },
    {
        name: "Scenario 2: Typos Auto-Correction ('ext', 'eml', 'lapy', 'exclucv')",
        items: [
            { nameOrCode: 'ext eml 336', requestedSize: 'Gallon' },
            { nameOrCode: 'exclucv lapy', requestedSize: 'Gallon' },
            { nameOrCode: 'trend w/s 3162', requestedSize: 'Gallon' }
        ]
    },
    {
        name: "Scenario 3: No-Token (TX / Bagher Token) Enforcement",
        items: [
            { nameOrCode: 'extra 66 black tx', requestedSize: 'Gallon' }, // should get -GX
            { nameOrCode: 'extra 66 black bagher token', requestedSize: 'Quarter' } // should return NO_TOKEN_NOT_AVAILABLE
        ]
    },
    {
        name: "Scenario 4: Ambiguous Code & Size Not Available",
        items: [
            { nameOrCode: '336', requestedSize: 'Gallon' }, // Ambiguous brand
            { nameOrCode: 'W331 CLEAR VARNISH', requestedSize: 'Gallon' } // Size not available
        ]
    }
];

testScenarios.forEach(sc => {
    console.log(`\n🔹 --- ${sc.name} ---`);
    const results = bulkVerifyProductsLocal(sc.items);
    results.forEach(r => {
        console.log(`   Input: "${r.original}" (${sc.items.find(i=>i.nameOrCode===r.original).requestedSize})`);
        console.log(`   Output: ${r.result}`);
    });
});

// Test submitOrder tool auto-resolution simulation
console.log('\n🔹 --- Scenario 5: submitOrder Auto-Resolution Simulation ---');
const rawItemsForSubmit = [
    { product: '9007-G', size: 'Gallon', quantity: 10 },
    { product: '49-G', size: 'Gallon', quantity: 1 },
    { product: 'ext 66 black', size: 'Gallon', quantity: 2 }
];

const mockSessionCache = {};
const processed = rawItemsForSubmit.map(item => {
    let productName = item.product;
    const cleanProd = productName.replace(/-[DGQ]$/i, '').trim();
    if (!productName.includes(' ') || productName.match(/^\d+-[DGQ]$/i) || /^\d+$/.test(cleanProd) || !productName.includes('-')) {
        const verified = findBestProductMatchLocal(cleanProd, item.size, false, mockSessionCache);
        if (verified && verified.startsWith('MATCH:')) {
            const nameMatch = verified.match(/MATCH:\s*([^\|]+)/);
            if (nameMatch) productName = nameMatch[1].trim();
        }
    }
    return { ...item, resolvedProduct: productName };
});

console.log('Submitting raw items:');
processed.forEach(i => console.log(`   Raw: "${i.product}" -> Excel Resolved Name: "${i.resolvedProduct}"`));

console.log('\n====================================================');
console.log('✅ ALL TEST SCENARIOS EXECUTED SUCCESSFULLY');
console.log('====================================================');
