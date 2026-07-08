const { findBestProductMatchLocal } = require('../productSearch');

const tests = [
    // 1. Exact code with padding
    { name: 'Exact code with padding (03 vs 3)', q: 'extra semi 03 white', size: 'Gallon' },
    
    // 2. Numeric code fluctuation (+/- 1)
    { name: 'Numeric code fluctuation -1 (8800 -> 8801)', q: 'bold 8800 white', size: 'Gallon' },
    { name: 'Numeric code fluctuation +1 (8802 -> 8801)', q: 'bold 8802 white', size: 'Gallon' },

    // 3. Alphanumeric code fluctuation (Levenshtein distance 1)
    { name: 'Alphanumeric fluctuation (T105 -> T106)', q: 'trend T105 sand stone', size: 'Gallon' },

    // 4. Exact brand/color verification in code path
    { name: 'Wrong Brand for Code (budget 8801 white)', q: 'budget 8801 white', size: 'Gallon' }, // 8801 is Bold, should return NOT_IN_DATABASE because brand mismatch
    { name: 'Wrong Color for Code (bold 8801 black)', q: 'bold 8801 black', size: 'Gallon' }, // Bold 8801 is white, should return NOT_IN_DATABASE because color mismatch

    // 5. Fuzzy Match strict brand/color verification
    { name: 'Fuzzy match with correct brand and color', q: 'exclusive distmpr white', size: 'Drum' }, // Exclusive distemper/semi white exists -> match
    { name: 'Fuzzy match with brand not in database for this product', q: 'exclusive weather shield white', size: 'Drum' }, // Exclusive doesn't have weather shield white -> should return NOT_IN_DATABASE, NOT a random brand match.
    
    // 6. Weak matches below raised threshold
    { name: 'Weak/unrelated query', q: 'random product name search', size: 'Gallon' }
];

console.log('🧪 RUNNING PRODUCT SEARCH SYSTEM TESTS...\n');

tests.forEach((t, i) => {
    console.log(`Test ${i + 1}: ${t.name}`);
    console.log(`Query: "${t.q}" | Size: "${t.size}"`);
    const res = findBestProductMatchLocal(t.q, t.size);
    console.log(`Result: ${res}`);
    console.log('--------------------------------------------------\n');
});
