const { findBestProductMatchLocal, loadProducts } = require('../productSearch');

loadProducts();

const tests = [
    { query: "bold rop 2 gallon", size: "Gallon", expected: "BOLD R.O.P 7704-G" },
    { query: "bold rop", size: "Gallon", expected: "BOLD R.O.P 7704-G" },
    { query: "bold rop", size: "Quarter", expected: "BOLD R.O.P 7704-Q" },
    { query: "bold rop", size: "Drum", expected: "BOLD R.O.P 7704-D" },
    { query: "exclusive flat putty 2 gln", size: "Gallon", expected: "EXCLUSIVE FLAT PUTTY EX201-G" },
    { query: "budget sa04 water primer 1 drum", size: "Drum", expected: "BUDGET SA04 WATER BASE PRIMER-D" }
];

let passed = 0;
tests.forEach((t, i) => {
    const res = findBestProductMatchLocal(t.query, t.size);
    const ok = res.includes(t.expected);
    if (ok) {
        console.log(`✅ Test ${i+1} PASSED: "${t.query}" (${t.size}) -> ${res}`);
        passed++;
    } else {
        console.log(`❌ Test ${i+1} FAILED: "${t.query}" (${t.size}) -> Expected: ${t.expected}, Got: ${res}`);
    }
});

console.log(`\nResults: ${passed}/${tests.length} tests passed.`);
