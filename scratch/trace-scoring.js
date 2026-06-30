const products = require('../products.json');

const MAJOR_GROUPS = new Set([
    'EXTRA','TREND','BOLD','BUDGET','EXCLUSIVE','FLUORESCENT',
    'ALTRA','BONDEX','NIPPON','BERGER','HI','FAME'
]);

const queryTokens = ['EXTRA', 'PUTTY'];

const puttyProducts = products.filter(p => 
    p.baseName && p.baseName.toUpperCase().includes('PUTTY')
);

console.log('=== SCORING BREAKDOWN for query: "extra putty" → tokens: ["EXTRA", "PUTTY"] ===\n');

const results = [];

puttyProducts.forEach(p => {
    const nameUpper  = (p.baseName   || '').toUpperCase();
    const brandUpper = (p.groupBrand || '').toUpperCase();
    const codeUpper  = (p.code       || '').toUpperCase();
    const combined   = `${brandUpper} ${nameUpper}`;
    const productNums = (combined.match(/\d+/g) || []).map(Number);

    let score = 0;
    let breakdown = [];

    for (const token of queryTokens) {
        const isPureNum = /^\d+$/.test(token);

        if (isPureNum) {
            if (productNums.includes(Number(token))) {
                score += 2.0;
                breakdown.push(`${token}: num match +2.0`);
            }
        } else if (token.length >= 2) {
            // Code matching
            if (codeUpper.length > 0) {
                if (codeUpper === token) {
                    score += 5.0;
                    breakdown.push(`${token}: exact code match +5.0`);
                } else if (codeUpper.includes(token) || token.includes(codeUpper)) {
                    score += 2.5;
                    breakdown.push(`${token}: partial code match +2.5`);
                }
            }

            // Brand/group boost — USES groupBrand FIELD
            if (MAJOR_GROUPS.has(token) && brandUpper.includes(token)) {
                score += 3.5;
                breakdown.push(`${token}: BRAND match (groupBrand="${brandUpper}") +3.5`);
            }

            // Word in combined (groupBrand + baseName)
            if (combined.includes(token)) {
                const pts = token.length >= 5 ? 1.5 : 0.8;
                score += pts;
                breakdown.push(`${token}: word in combined="${combined}" +${pts}`);
            }
        }
    }

    // All tokens matched bonus
    const allMatched = queryTokens.every(t =>
        combined.includes(t) ||
        (/^\d+$/.test(t) && productNums.includes(Number(t)))
    );
    if (allMatched && queryTokens.length >= 2) {
        score += 1.2;
        breakdown.push('all-match bonus +1.2');
    }

    if (score > 0) {
        results.push({ fullName: p.fullName, score, group: p.group, groupBrand: p.groupBrand, breakdown });
    }
});

// Sort by score descending
results.sort((a, b) => b.score - a.score);

results.forEach(r => {
    console.log(`${r.fullName}`);
    console.log(`  Score: ${r.score.toFixed(1)} | group: "${r.group}" | groupBrand: "${r.groupBrand}"`);
    console.log(`  Breakdown: ${r.breakdown.join(' → ')}`);
    console.log('');
});

console.log('=== KEY INSIGHT ===');
console.log('Match hota hai groupBrand se (line 102 in productSearch.js)');
console.log('brandUpper = product.groupBrand.toUpperCase()');
console.log('combined   = groupBrand + " " + baseName');
console.log('group field ka use scoring mein KAHIN NAHI hota!');
