const fs = require('fs');
const path = require('path');
const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../products.json'), 'utf8'));

// Let's run a test mock of findBestProductMatchLocalCore for T105
const queryCode = "T105";
const queryCodeNum = "105";
const queryBrandForCode = "TREND";

let codeMatches = products.filter(p => (p.code || '').toUpperCase() === queryCode);
console.log('Exact matches:', codeMatches.length);

if (codeMatches.length === 0 && queryCodeNum) {
    const queryCodeVal = parseInt(queryCodeNum, 10);
    codeMatches = products.filter(p => {
        const pCodeNum = p.code ? p.code.replace(/\D/g, '') : '';
        return pCodeNum && parseInt(pCodeNum, 10) === queryCodeVal;
    });
}
console.log('Integer matches:', codeMatches.length);

if (codeMatches.length === 0) {
    console.log('Trying fluctuations...');
    if (queryCodeNum) {
        const queryCodeVal = parseInt(queryCodeNum, 10);
        codeMatches = products.filter(p => {
            const pCodeNum = p.code ? p.code.replace(/\D/g, '') : '';
            if (!pCodeNum) return false;
            const pCodeVal = parseInt(pCodeNum, 10);
            return Math.abs(pCodeVal - queryCodeVal) <= 1;
        });
    }
}
console.log('After fluctuation matches:', codeMatches.length);
codeMatches.forEach(p => console.log(p.fullName, 'brand:', p.brand, 'code:', p.code));
