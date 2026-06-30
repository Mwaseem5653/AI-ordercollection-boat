const products = require('../products.json');

const MAJOR_GROUPS = new Set([
    'EXTRA','TREND','BOLD','BUDGET','EXCLUSIVE','FLUORESCENT',
    'ALTRA','BONDEX','NIPPON','BERGER','HI','FAME'
]);
const SYNONYMS = { 'EXTA': 'EXTRA', 'XTRA': 'EXTRA', 'LAPY': 'PUTTY', 'LAAPI': 'PUTTY', 'LAPI': 'PUTTY' };
const STOP_WORDS = new Set(['THE','AND','OR','OF','IN','WB','OB','A','AN']);

function tokenize(text) {
    return text.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/)
        .filter(t => t.length >= 1).map(t => SYNONYMS[t] || t).filter(t => !STOP_WORDS.has(t));
}

// ── PROPOSED NEW scoreProduct with group scoring ──
function scoreProductNEW(product, queryTokens) {
    const nameUpper  = (product.baseName   || '').toUpperCase();
    const brandUpper = (product.groupBrand || '').toUpperCase();
    const codeUpper  = (product.code       || '').toUpperCase();
    const groupUpper = (product.group      || '').toUpperCase();  // ← NEW
    const combined   = `${brandUpper} ${nameUpper}`;
    const productNums = (combined.match(/\d+/g) || []).map(Number);

    let score = 0;
    let breakdown = [];

    for (const token of queryTokens) {
        const isPureNum = /^\d+$/.test(token);

        if (isPureNum) {
            if (productNums.includes(Number(token))) { score += 2.0; breakdown.push(`${token}: num +2.0`); }
        } else if (token.length >= 2) {
            if (codeUpper.length > 0) {
                if (codeUpper === token) { score += 5.0; breakdown.push(`${token}: code exact +5.0`); }
                else if (codeUpper.includes(token) || token.includes(codeUpper)) { score += 2.5; breakdown.push(`${token}: code partial +2.5`); }
            }
            if (MAJOR_GROUPS.has(token) && brandUpper.includes(token)) { score += 3.5; breakdown.push(`${token}: brand +3.5`); }
            if (combined.includes(token)) { const pts = token.length >= 5 ? 1.5 : 0.8; score += pts; breakdown.push(`${token}: word +${pts}`); }
        }
    }

    const allMatched = queryTokens.every(t => combined.includes(t) || (/^\d+$/.test(t) && productNums.includes(Number(t))));
    if (allMatched && queryTokens.length >= 2) { score += 1.2; breakdown.push('all-match +1.2'); }

    // ── NEW: Group scoring ──
    const groupTokens = groupUpper.split(/\s+/).filter(t => t.length >= 2);
    const matchedInGroup = queryTokens.filter(t => groupUpper.includes(t)).length;
    if (matchedInGroup > 0 && groupTokens.length > 0) {
        const coverage = matchedInGroup / groupTokens.length;
        const groupBonus = coverage * 2.0;
        score += groupBonus;
        breakdown.push(`group="${product.group}" coverage=${matchedInGroup}/${groupTokens.length}=${coverage.toFixed(2)} +${groupBonus.toFixed(1)}`);
    }

    return { score, breakdown };
}

// ── TEST QUERIES ──
const testQueries = [
    'extra putty',
    'extra exterior putty',
    'extra white putty',
    'exta putty',
    'bold putty',
    'budget putty',
];

for (const query of testQueries) {
    const queryTokens = tokenize(query);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`QUERY: "${query}" → tokens: ${JSON.stringify(queryTokens)}`);
    console.log('='.repeat(70));

    const scored = products
        .map(p => {
            const { score, breakdown } = scoreProductNEW(p, queryTokens);
            return { fullName: p.fullName, group: p.group, groupBrand: p.groupBrand, score, breakdown };
        })
        .filter(x => x.score > 1.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

    scored.forEach((r, i) => {
        const marker = i === 0 ? '👑 WINNER' : `   #${i+1}`;
        console.log(`${marker}: ${r.fullName} | score=${r.score.toFixed(1)} | group="${r.group}"`);
        console.log(`         ${r.breakdown.join(' → ')}`);
    });
}
