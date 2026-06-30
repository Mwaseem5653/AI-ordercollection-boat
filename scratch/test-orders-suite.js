const { findBestProductMatchLocal, loadProducts } = require('../productSearch.js');

// Load database products
loadProducts();

const TEST_CASES = [
    // 1. BRAND + CODE PATH TESTS
    {
        name: "Brand & Code - Extra DA45 (Gallon)",
        query: "Extra DA45",
        size: "G",
        wantNoToken: false,
        expected: "MATCH: EXTRA EXTERIOR PUTTY DA45-G | Unit: Gln"
    },
    {
        name: "Brand & Code - Altra DD41 (Drum)",
        query: "Altra DD41",
        size: "D",
        wantNoToken: false,
        expected: "MATCH: ALTRA FRESH COAT EML DD41 WHITE-D | Unit: Drm"
    },
    {
        name: "Brand & Code - Hi DD41 (Drum)",
        query: "Hi DD41",
        size: "D",
        wantNoToken: false,
        expected: "MATCH: HI LOOK WALLEX EML DD41 WHITE-D | Unit: Drm"
    },
    {
        name: "Brand & Code - DD41 Ambiguity Check",
        query: "DD41",
        size: "D",
        wantNoToken: false,
        expected: "AMBIGUOUS: \"DD41\" kai brands mein hai — konsa chahiye? Altra, Hi"
    },
    {
        name: "Brand & Code - Numerical fallback when brand specified: Altra 41",
        query: "Altra 41",
        size: "D",
        wantNoToken: false,
        expected: "MATCH: ALTRA FRESH COAT EML DD41 WHITE-D | Unit: Drm"
    },

    // 2. BRAND + PRODUCT + COLOR PATH TESTS
    {
        name: "Brand + Product + Color (Collapsed Exact Match) - extra weather shield magnolia (Gallon)",
        query: "extra weather shield magnolia",
        size: "G",
        wantNoToken: false,
        expected: "MATCH: EXTRA W/S 1947 MAGNOLIA-G | Unit: Gln"
    },
    {
        name: "Brand + Product + Color (Collapsed Exact Match with W/S) - extra w/s magnolia (Gallon)",
        query: "extra w/s magnolia",
        size: "G",
        wantNoToken: false,
        expected: "MATCH: EXTRA W/S 1947 MAGNOLIA-G | Unit: Gln"
    },
    {
        name: "Brand + Product + Color (Fuzzy Fallback with Typos) - extra weather sheild mangolia (Gallon)",
        query: "extra weather sheild mangolia",
        size: "G",
        wantNoToken: false,
        expected: "MATCH: EXTRA W/S 1947 MAGNOLIA-G | Unit: Gln"
    },
    {
        name: "Brand + Product + Color (Fuzzy Fallback with product name typo) - altra fresh cote white (Drum)",
        query: "altra fresh cote white",
        size: "D",
        wantNoToken: false,
        expected: "MULTIPLE_MATCHES"
    },
    {
        name: "Brand + Product + Color - exclusive emulsion off white (Gallon) Ambiguity Check",
        query: "exclusive emulsion off white",
        size: "G",
        wantNoToken: false,
        expected: "MULTIPLE_MATCHES"
    },

    // 3. SINGLE DIGIT CODE + COLOR PATH TESTS
    {
        name: "Single-Digit Code & Color - 2 ash,white (Gallon)",
        query: "2 ash,white",
        size: "G",
        wantNoToken: false,
        expected: "MATCH: EXTRA SEMI 02 ASH WHITE-G | Unit: Gln"
    },
    {
        name: "Single-Digit Code & Color - exclusive emulsion 2 off white (Gallon)",
        query: "exclusive emulsion 2 off white",
        size: "G",
        wantNoToken: false,
        expected: "MATCH: EXCLUSIVE EMULSION-EX002 OFF WHITE-G | Unit: Gln"
    },

    // 4. SIZE VALIDATION TESTS
    {
        name: "Size Validation - Extra DA45 (Requested size Qtr)",
        query: "Extra DA45",
        size: "Q",
        wantNoToken: false,
        expected: "MATCH: EXTRA EXTERIOR PUTTY DA45-Q | Unit: Qtr"
    },
    {
        name: "Size Validation - Non-existent size fallback for DA45",
        query: "Extra DA45",
        size: "xyz",
        wantNoToken: false,
        expected: "MATCH: EXTRA EXTERIOR PUTTY DA45-D | Unit: Drm"
    },

    // 5. WANT NO TOKEN (TX) TESTS
    {
        name: "Want No Token (TX) - Extra DA45 TX (Gallon)",
        query: "Extra DA45 TX",
        size: "G",
        wantNoToken: false,
        expected: "MATCH: EXTRA EXTERIOR PUTTY DA45-GX | Unit: Gln"
    },
    {
        name: "Want No Token (TX) - Altra DD41 with wantNoToken=true (Drum)",
        query: "Altra DD41",
        size: "D",
        wantNoToken: true,
        expected: "MATCH: ALTRA FRESH COAT EML DD41 WHITE-DX | Unit: Drm"
    },

    // 6. SYNONYMS & URDU FILLERS TESTS
    {
        name: "Urdu Size Synonym - Balti instead of Gallon: Hi DD41 (Balti)",
        query: "Hi DD41",
        size: "balti",
        wantNoToken: false,
        expected: "MATCH: HI LOOK WALLEX EML DD41 WHITE-G | Unit: Gln"
    },
    {
        name: "Product Synonym - Lapi instead of Putty: Budget SA01 lapi (Drum)",
        query: "Budget SA01 lapi",
        size: "D",
        wantNoToken: false,
        expected: "MATCH: BUDGET SA01 FILLING PUTTY-D | Unit: Drm"
    },
    {
        name: "Urdu Fillers Removal - mujhe altra dd41 drum chahiye (Drum)",
        query: "mujhe altra dd41 drum chahiye",
        size: "D",
        wantNoToken: false,
        expected: "MATCH: ALTRA FRESH COAT EML DD41 WHITE-D | Unit: Drm"
    },
    {
        name: "Urdu Fillers - hi dd41 ki balti (Gln)",
        query: "hi dd41 ki balti",
        size: "Gln",
        wantNoToken: false,
        expected: "MATCH: HI LOOK WALLEX EML DD41 WHITE-G | Unit: Gln"
    }
];

console.log("==================================================");
console.log("     PRODUCT SEARCH COMPREHENSIVE TEST SUITE      ");
console.log("==================================================\n");

let passed = 0;
let failed = 0;

TEST_CASES.forEach((tc, idx) => {
    console.log(`[Test #${idx + 1}] ${tc.name}`);
    console.log(`  Query: "${tc.query}" | Size: "${tc.size}" | wantNoToken: ${tc.wantNoToken}`);
    
    const result = findBestProductMatchLocal(tc.query, tc.size, tc.wantNoToken);
    
    console.log(`  Result: "${result}"`);
    
    let isOk = false;
    if (tc.expected.includes("AMBIGUOUS") && result.includes("AMBIGUOUS")) {
        isOk = true;
    } else if (tc.expected === "SIZE_NOT_AVAILABLE" && result.includes("SIZE_NOT_AVAILABLE")) {
        isOk = true;
    } else if (tc.expected === "MULTIPLE_MATCHES" && result.includes("MULTIPLE_MATCHES")) {
        isOk = true;
    } else if (result === tc.expected) {
        isOk = true;
    }
    
    if (isOk) {
        console.log(`  🟢 PASSED`);
        passed++;
    } else {
        console.log(`  🔴 FAILED (Expected containing or matching: "${tc.expected}")`);
        failed++;
    }
    console.log("--------------------------------------------------");
});

console.log("\n==================================================");
console.log(`TEST SUITE SUMMARY:`);
console.log(`  Total Tests: ${TEST_CASES.length}`);
console.log(`  Passed:      ${passed}`);
console.log(`  Failed:      ${failed}`);
console.log("==================================================");
