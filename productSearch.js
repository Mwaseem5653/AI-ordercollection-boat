/**
 * LOCAL PRODUCT SEARCH v4.0 — Clean, No SubBrand
 * ─────────────────────────────────────────────────
 * Changes from v3.2:
 *  - subBrand completely removed (field was empty in DB)
 *  - rawSubBrand ReferenceError bug fixed
 *  - MAJOR_GROUPS updated with missing brands
 *  - 'Exclsive' typo added to SYNONYMS
 *  - Hi / Hi look brand split handled
 *  - Color scoring used for final ranking (already working)
 */

const fs   = require('fs');
const path = require('path');

// ── CONSTANTS ────────────────────────────────────────────────────────
const MAJOR_GROUPS = new Set([
    'EXTRA','TREND','BOLD','BUDGET','EXCLUSIVE','FLUORESCENT',
    'ALTRA','BONDEX','NIPPON','BERGER','HI','FAME',
    'KLICK','SATIN','HEAT','TIMBER','WOOD','WOODCOAT','TURPENTINE'
]);

const STOP_WORDS = new Set([
    'THE','AND','OR','OF','IN','OB','A','AN',
    'BAGHER','BINA','WITHOUT','TOKEN','TOKN','TX',
    'GALLON','DRUM','QUARTER','GLN','DRM','QTR',
    'BALTI','PCS','PIECE','KG',
    // Urdu filler words
    'KI','KA','KE','KO','SE','WALI','WALA','WALE','ME','MEIN',
    'HAI','HAIN','DEIN','DO','BHEJO','LAO','LAGA','CHAHIYE',
    'HO','AUR','YA','BHI','NAHI','NAHN','NA','JI','G'
]);

const SYNONYMS = {
    'EXTA':       'EXTRA',
    'w':             'White',
    'XTRA':       'EXTRA',
    'FLORESCENT': 'FLUORESCENT',
    'FLURO':      'FLUORESCENT',
    'LAPY':       'PUTTY',
    'LAAPI':      'PUTTY',
    'LAPI':       'PUTTY',
    'DIST':       'SEMI',
    'DSIT':       'SEMI',
    'DISTEMPR':   'SEMI',
    'DISTEMPER':  'SEMI',
    'PRIMR':      'PRIMER',
    'THINER':     'THINNER',
    'THINR':      'THINNER',
    'MAT':        'MATT',
    'ENAML':      'ENAMEL',
    'ENAM':       'ENAMEL',
    'BASE':       'PRIMER',
    'PLASTIC':    'SEMI',
    'EXCLSIVE':   'EXCLUSIVE',   // DB typo fix
    'EXCL':       'EXCLUSIVE',
    // Water typos
    'WHATER':     'WATER',
    'WTER':       'WATER',
    'WATR':       'WATER',
    'WATAR':      'WATER',
    'WOTER':      'WATER',
    'WATTER':     'WATER',
    'WATERR':     'WATER',
    // Colour aliases
    'WHI':        'WHITE',
    'WH':         'WHITE',
    'BLK':        'BLACK',
    'GRY':        'GREY',
    'EMULSION':   'SEMI',
    'W':          'WHITE',
    'SHEATH':     'SHIELD',
    'SHEET':      'SHIELD',
    'SHEILD':     'SHIELD',
    // EML / ENL → SEMI for product matching
    'EML':        'SEMI',
    'ENL':        'SEMI',
    
};

// Products jinmein sirf generic type diya ho (brand missing) — AMBIGUOUS
const AMBIGUOUS_TYPES = {
    'PUTTY':     ['Bold', 'Budget', 'Exclusive', 'Trend', 'Altra', 'Hi Look', 'Regular'],
    'PRIMER':    ['Bold', 'Budget', 'Exclusive', 'Trend', 'Hi Look', 'Regular'],
    'ENAMEL':    ['Bold', 'Exclusive', 'Extra', 'Regular'],
    'SEMI':      ['Bold', 'Extra', 'Altra', 'Regular'],
    'DISTEMPER': ['Budget', 'Fame'],
    'THINNER':   ['Bold', 'Budget', 'Regular'],
    'MATT':      ['Bold', 'Extra', 'Trend', 'Budget'],
    'EMULSION':  ['Bold', 'Extra', 'Trend', 'Budget'],
};

// ── STATE ─────────────────────────────────────────────────────────────
let PRODUCTS          = [];
let CODE_SET          = new Set();
let BRAND_SET         = new Set();
let PRODUCT_TYPE_KEYWORDS = new Set();
let COLOR_SET         = new Set();
let TEXT_KEYWORDS_SET = new Set();

// ── LOAD ──────────────────────────────────────────────────────────────
function loadProducts(jsonPath) {
    const filePath = jsonPath || path.join(__dirname, 'products.json');
    try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Build lookup sets
        CODE_SET = new Set(
            raw.map(p => (p.code || '').toUpperCase().trim()).filter(Boolean)
        );
        BRAND_SET = new Set(
            raw.map(p => (p.brand || '').toUpperCase().trim()).filter(Boolean)
        );
        COLOR_SET = new Set(
            raw.map(p => (p.color || '').toUpperCase().trim()).filter(Boolean)
        );

        TEXT_KEYWORDS_SET = new Set();
        raw.forEach(p => {
            const b    = (p.brand   || '').toUpperCase().trim();
            const prod = (p.product || '').toUpperCase().trim();
            [b, prod].forEach(str => {
                if (str) {
                    str.split(/[^A-Z0-9]/i).forEach(token => {
                        const t = token.trim().toUpperCase();
                        if (t.length >= 1) TEXT_KEYWORDS_SET.add(t);
                    });
                }
            });
        });

        // Product type keywords
        raw.forEach(p => {
            const pr = (p.product || '').toUpperCase().trim();
            if (pr) {
                const firstWord = pr.split(/\s+/)[0].replace(/[^A-Z]/g, '');
                if (firstWord && firstWord.length >= 2) PRODUCT_TYPE_KEYWORDS.add(firstWord);
                ['PUTTY','ENAMEL','PRIMER','MATT','SEMI','DISTEMPER','THINNER',
                 'STAINLESS','EMULSION','EML','ENL','OIL','Matt','Exterior'].forEach(kw => {
                    if (pr.includes(kw)) PRODUCT_TYPE_KEYWORDS.add(kw);
                });
            }
        });

        PRODUCTS = raw.map(p => {
            const baseName = p.fullName
                .replace(/-[DGQ](?:X|B)?$/i, '')
                .replace(/-D\.\(CLOSE\)$/i, '')
                .trim();

            // Pre-compute fullName token set for fast scoring
            const fullNameClean = p.fullName
                .toUpperCase()
                .replace(/-[DGQ]X?$/i, '')
                .replace(/[^A-Z0-9\s]/g, ' ');
            const fullNameTokenSet = new Set(
                fullNameClean.split(/\s+/).filter(t => t.length >= 1)
            );

            const brandUpper = (p.brand   || '').toUpperCase().trim();
            const rawProduct = (p.product || '').trim();   // subBrand removed — direct

            // Normalize W/S, WS, W/B, WB in product names
            let normalizedProduct = rawProduct.toUpperCase();
            normalizedProduct = normalizedProduct.replace(/\bW\/S\b|\bWS\b/g, 'WEATHER SHIELD');
            normalizedProduct = normalizedProduct.replace(/\bW\/B\b|\bWB\b/g, 'WATER BASE');

            const productUpper = normalizedProduct.trim();
            const colorUpper   = (p.color || '').toUpperCase().trim();
            const collapsed    = (brandUpper + productUpper + colorUpper).replace(/[^A-Z0-9]/g, '');

            return {
                ...p,
                product:         rawProduct,
                baseName:        p.baseName   || baseName,
                groupBrand:      p.groupBrand || brandUpper,
                group:           p.group      || productUpper,
                fullNameTokenSet,
                brandUpper,
                productUpper,
                colorUpper,
                collapsed
            };
        });

        console.log(`✅ [SEARCH]: Loaded ${PRODUCTS.length} products, ${CODE_SET.size} codes, ${BRAND_SET.size} brands, ${COLOR_SET.size} colors (v4.0).`);
    } catch (e) {
        console.error('🛑 [SEARCH]: Could not load products.json:', e.message);
    }
}
loadProducts();

// ── TOKENIZE ──────────────────────────────────────────────────────────
function tokenize(text) {
    let cleanText = text.toUpperCase();

    // Normalize W/S, WS, W/B, WB
    cleanText = cleanText.replace(/\bW\/S\b|\bWS\b/g, 'WEATHER SHIELD');
    cleanText = cleanText.replace(/\bW\/B\b|\bWB\b/g, 'WATER BASE');

    // Normalize color typos and synonyms
    cleanText = cleanText.replace(/\bASHWITE\b|\bASHWT\b|\bASHUT\b|\bASHUL\b|\bASHWHITE\b|\bASHWHT\b/g, 'ASH WHITE');
    cleanText = cleanText.replace(/\bOFFWHT\b|\bOFFWITE\b|\bOFFWHITE\b/g, 'OFF WHITE');

    const rawTokens = cleanText
        .replace(/[^A-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 1);

    const expanded = [];
    for (const t of rawTokens) {
        expanded.push(t);
        // Alphanumeric split: "WHI71" → ["WHI71","WHI","71"]
        const m = t.match(/^([A-Z]{2,})(\d{2,})$/);
        if (m) {
            expanded.push(m[1]);
            expanded.push(m[2]);
        }
    }

    return expanded
        .map(t => SYNONYMS[t] || t)
        .filter(t => !STOP_WORDS.has(t) && t.length >= 1);
}

// ── HELPERS ───────────────────────────────────────────────────────────
function getNumericPart(code) {
    if (!code) return '';
    return code.replace(/\D/g, '');
}

function isCodeToken(t) {
    const upper = t.toUpperCase().trim();
    if (CODE_SET.has(upper))          return true;
    if (TEXT_KEYWORDS_SET.has(upper)) return false;
    if (/^\d{2,}$/.test(upper))       return true;
    if (/[A-Z]/.test(upper) && /\d/.test(upper)) return true;
    return false;
}

// ── PRODUCT TYPES ─────────────────────────────────────────────────────
const PRODUCT_TYPES = {
    'RED_OXIDE': {
        keywords: ['RED', 'OXIDE', 'R.OXIDE', 'R/OXIDE', 'ROXIDE'],
        check: (p, combined) => combined.includes('RED OXIDE') || combined.includes('R.OXIDE') || combined.includes('R/OXIDE')
    },
    'PUTTY': {
        keywords: ['PUTTY'],
        check: (p, combined) => combined.includes('PUTTY')
    },
    'PRIMER': {
        keywords: ['PRIMER', 'SEALER'],
        check: (p, combined) => combined.includes('PRIMER') || combined.includes('SEALER')
    },
    'DISTEMPER': {
        keywords: ['DISTEMPER'],
        check: (p, combined) => combined.includes('DISTEMPER')
    },
    'ENAMEL': {
        keywords: ['ENAMEL'],
        check: (p, combined) => combined.includes('ENAMEL')
    },
    'THINNER': {
        keywords: ['THINNER'],
        check: (p, combined) => combined.includes('THINNER')
    },
    'WATER_MATT': {
        keywords: ['WATER'],
        check: (p, combined) => combined.includes('WATER MATT')
    },
    'OIL_MATT': {
        keywords: ['OIL'],
        check: (p, combined) => combined.includes('OIL MATT')
    },
    'EMULSION': {
        keywords: ['EMULSION', 'EML', 'SEMI'],
        check: (p, combined) => combined.includes('EMULSION') || combined.includes('EML') || combined.includes('MATT') || combined.includes('SEMI')
    }
};

// ── SCORE PRODUCT ─────────────────────────────────────────────────────
function scoreProduct(product, queryTokens) {
    const codeUpper    = (product.code    || '').toUpperCase();
    const fullNameUpper = (product.fullName || '').toUpperCase();
    const combinedText = `${product.brandUpper} ${product.productUpper} ${codeUpper} ${product.colorUpper} ${fullNameUpper}`;

    // Product type detection
    let productType = null;
    for (const [type, info] of Object.entries(PRODUCT_TYPES)) {
        if (info.check(product, combinedText)) { productType = type; break; }
    }

    // Query type detection
    const querySpecifiedTypes = [];
    for (const [type, info] of Object.entries(PRODUCT_TYPES)) {
        const hasKeyword = info.keywords.some(k =>
            k.includes(' ') ? queryTokens.join(' ').includes(k) : queryTokens.includes(k)
        );
        if (hasKeyword) querySpecifiedTypes.push(type);
    }

    // Type mismatch filter
    if (querySpecifiedTypes.length > 0 && productType) {
        const isMatch = querySpecifiedTypes.includes(productType);
        if (!isMatch) {
            const emulsionFamily      = ['EMULSION', 'WATER_MATT', 'OIL_MATT'];
            const queryHasSpecificMatt = querySpecifiedTypes.includes('WATER_MATT') || querySpecifiedTypes.includes('OIL_MATT');
            const queryHasGenericEml   = querySpecifiedTypes.includes('EMULSION');
            const productIsEmlFamily   = emulsionFamily.includes(productType);

            if (queryHasSpecificMatt && productIsEmlFamily && !querySpecifiedTypes.includes(productType)) return 0;
            else if (queryHasGenericEml && productIsEmlFamily) { /* allow */ }
            else return 0;
        }
    }

    // Core scoring: fullName token set matching
    const fnTokens = product.fullNameTokenSet;
    let matchedCount = 0;
    for (const token of queryTokens) {
        if (fnTokens.has(token)) matchedCount++;
    }
    if (matchedCount === 0) return 0;

    let score = (matchedCount / queryTokens.length) * 10;

    const codeNum = getNumericPart(codeUpper);
    const queryHasCodeNum = codeNum && queryTokens.some(t => getNumericPart(t) === codeNum);
    if (queryHasCodeNum) score += 15;
    if (matchedCount === queryTokens.length) score += 3;

    return score;
}

// ── AMBIGUITY CHECK ───────────────────────────────────────────────────
function checkAmbiguity(queryTokens) {
    const hasBrand = queryTokens.some(t => MAJOR_GROUPS.has(t) || BRAND_SET.has(t));
    if (hasBrand) return null;
    for (const [type, brands] of Object.entries(AMBIGUOUS_TYPES)) {
        if (queryTokens.includes(type)) return { type, brands };
    }
    return null;
}

// ── COLOR SCORING ─────────────────────────────────────────────────────
function scoreColor(pColor, queryColorTokens) {
    if (queryColorTokens.length === 0) return 0;

    const pColorUpper   = pColor.toUpperCase().trim();
    const queryColorStr = queryColorTokens.join(' ');

    if (pColorUpper === queryColorStr)          return 100;
    if (pColorUpper.includes(queryColorStr))    return 80;

    const pColorTokens = pColorUpper.split(/\s+/).filter(Boolean);
    let matchCount = 0;
    for (const t of queryColorTokens) {
        if (pColorTokens.includes(t)) matchCount++;
    }
    if (matchCount > 0) return 50 + (matchCount / pColorTokens.length) * 20;

    return 0;
}

// ── BRAND MATCH HELPER (handles Hi / Hi look split) ──────────────────
function brandMatches(productBrandUpper, queryBrand) {
    if (!queryBrand) return true;
    if (productBrandUpper === queryBrand) return true;
    // Hi → match both 'HI' and 'HI LOOK'
    if (queryBrand === 'HI' && (productBrandUpper === 'HI' || productBrandUpper === 'HI LOOK')) return true;
    if (queryBrand === 'HI LOOK' && (productBrandUpper === 'HI' || productBrandUpper === 'HI LOOK')) return true;
    // Partial contains (e.g. 'EXCLUSIVE' matches 'EXCLSIVE')
    if (productBrandUpper.includes(queryBrand) || queryBrand.includes(productBrandUpper)) return true;
    return false;
}

// Levenshtein helper for fuzzy matching and code fluctuations
function getLevenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// ── MAIN SEARCH ───────────────────────────────────────────────────────
function findBestProductMatchLocalCore(nameOrCode, requestedSize, wantNoToken = false, sessionCache = null, phoneNumber = null) {
    if (!nameOrCode || nameOrCode.length < 2) return 'NOT_IN_DATABASE';
    if (PRODUCTS.length === 0) return 'NOT_IN_DATABASE';

    const query = nameOrCode.trim();
    const sz    = (requestedSize || '').toLowerCase().trim();

    // Auto-detect no-token keywords
    let wantNoTokenLocal = wantNoToken;
    const queryUpper = query.toUpperCase();
    if (
        queryUpper.includes('BAGHER TOKEN') ||
        queryUpper.includes('BINA TOKEN')   ||
        queryUpper.includes('NO TOKEN')     ||
        queryUpper.includes('WITHOUT TOKEN')||
        queryUpper.includes('WO TOKEN')     ||
        queryUpper.includes('W/O TOKEN')    ||
        /\bTX\b/.test(queryUpper)
    ) {
        wantNoTokenLocal = true;
    }

    const cacheKey = `${query.toLowerCase()}_${sz}_${!!wantNoTokenLocal}`;
    if (sessionCache && sessionCache[cacheKey]) {
        console.log(`🟢 [CACHE HIT]: "${query}"`);
        return sessionCache[cacheKey];
    }

    // ── Size suffix ───────────────────────────────────────────────
    let targetSuffix = '';
    const szLower = sz.toLowerCase();
    if      (szLower.includes('gallon') || szLower.includes('gln') || szLower.includes('balti') || /\bg\b/.test(szLower)) targetSuffix = 'G';
    else if (szLower.includes('drum') || szLower.includes('drm') || /\bd\b/.test(szLower)) targetSuffix = 'D';
    else if (szLower.includes('quarter') || szLower.includes('qtr') || /\bq\b/.test(szLower)) targetSuffix = 'Q';

    if (!targetSuffix) {
        const m = query.toUpperCase().match(/(?:^|\s|-)([DGQ])(X)?$/);
        if (m) { targetSuffix = m[1]; if (m[2]) wantNoTokenLocal = true; }
    }

    if (wantNoTokenLocal && targetSuffix === 'Q') {
        return 'NO_TOKEN_NOT_AVAILABLE: Bagher token sirf Gallon aur Drum mein hota hai, Quarter mein nahi.';
    }

    // ── Tokenize ──────────────────────────────────────────────────
    const queryTokens = tokenize(query).filter(t => t !== targetSuffix);
    if (queryTokens.length === 0) return 'NOT_IN_DATABASE';

    const queryBrand = queryTokens.find(t => BRAND_SET.has(t) || MAJOR_GROUPS.has(t)) || null;

    const PRODUCT_KEYWORDS = new Set([
        'MATT','SEMI','PUTTY','PRIMER','ENAMEL','DISTEMPER','THINNER','GLOSS','GLOSSY',
        'STAINLESS','SHIELD','WEATHER','WATER','OIL','WALLEX'
    ]);

    const queryColorTokens = queryTokens.filter(t =>
        t !== queryBrand &&
        !PRODUCT_KEYWORDS.has(t) &&
        (COLOR_SET.has(t) || [...COLOR_SET].some(c => c.split(/\s+/).includes(t)))
    );

    // ── CODE PATH (FIRST PRIORITY!) ────────────────────────────────
    const detectedCodeTokens = queryTokens.filter(t => isCodeToken(t));

    if (detectedCodeTokens.length > 0) {
        const actualCodeTokens = detectedCodeTokens.filter(t => CODE_SET.has(t));
        const queryCode        = actualCodeTokens.length > 0 ? actualCodeTokens[0] : detectedCodeTokens[0];
        let queryBrandForCode = queryBrand;

        console.log(`🔒 [STRICT CODE]: code="${queryCode}" brand="${queryBrandForCode || 'ANY'}" size="${targetSuffix || 'ANY'}" noToken=${wantNoTokenLocal}`);

        let codeMatches = PRODUCTS.filter(p => (p.code || '').toUpperCase() === queryCode);
        const queryCodeNum = getNumericPart(queryCode);
        
        // Exact integer match (e.g. "03" and "3")
        if (codeMatches.length === 0 && queryCodeNum) {
            const queryCodeVal = parseInt(queryCodeNum, 10);
            codeMatches = PRODUCTS.filter(p => {
                const pCodeNum = getNumericPart(p.code);
                return pCodeNum && parseInt(pCodeNum, 10) === queryCodeVal;
            });
        }

        // Brand filtering if brand is specified in query
        if (queryBrandForCode) {
            const exactBrandMatches = codeMatches.filter(p => brandMatches(p.brandUpper, queryBrandForCode));
            if (exactBrandMatches.length > 0) {
                codeMatches = exactBrandMatches;
            } else {
                codeMatches = []; // If brand mismatch, do not accept wrong brand
            }
        }

        // ── CODE/NUMBER FLUCTUATION PATH ──
        if (codeMatches.length === 0) {
            console.log(`🔍 [CODE NOT FOUND - TRYING FLUCTUATION]: "${queryCode}"`);
            
            // Fluctuation 1: Absolute numeric difference <= 1 (e.g. 1066 vs 1067 / 1065, or 303 vs 302)
            if (queryCodeNum) {
                const queryCodeVal = parseInt(queryCodeNum, 10);
                codeMatches = PRODUCTS.filter(p => {
                    const pCodeNum = getNumericPart(p.code);
                    if (!pCodeNum) return false;
                    const pCodeVal = parseInt(pCodeNum, 10);
                    return Math.abs(pCodeVal - queryCodeVal) <= 1;
                });
            }

            // Fluctuation 2: Character/alphanumeric Levenshtein distance <= 1 (e.g. DD41 vs DD42)
            if (codeMatches.length === 0) {
                codeMatches = PRODUCTS.filter(p => {
                    if (!p.code) return false;
                    return getLevenshtein(p.code.toUpperCase(), queryCode.toUpperCase()) <= 1;
                });
            }

            // Enforce brand matching on the code fluctuation candidates
            if (codeMatches.length > 0 && queryBrandForCode) {
                const brandFiltered = codeMatches.filter(p => brandMatches(p.brandUpper, queryBrandForCode));
                codeMatches = brandFiltered;
            }
        }

        if (codeMatches.length === 0) {
            console.log(`❌ [STRICT CODE]: "${queryCode}" not found`);
            return 'NOT_IN_DATABASE';
        }

        // Color filter in code path to resolve ambiguity and enforce exact matches
        if (queryColorTokens.length > 0) {
            codeMatches.forEach(p => {
                p._colorScore = scoreColor(p.colorUpper, queryColorTokens);
            });
            const colorMatched = codeMatches.filter(p => p._colorScore > 0);
            if (colorMatched.length > 0) {
                const exactColorMatched = colorMatched.filter(p => p._colorScore === 100);
                codeMatches = exactColorMatched.length > 0 ? exactColorMatched : colorMatched;
            } else {
                console.log(`❌ [STRICT CODE]: Color "${queryColorTokens.join(' ')}" does not match code candidates`);
                return 'NOT_IN_DATABASE';
            }
        }

        if (queryBrandForCode) {
            const brandFiltered = codeMatches.filter(p => brandMatches(p.brandUpper, queryBrandForCode));
            if (brandFiltered.length > 0) {
                codeMatches = brandFiltered;
            } else {
                console.log(`❌ [STRICT CODE]: "${queryCode}" not in brand "${queryBrandForCode}"`);
                return 'NOT_IN_DATABASE';
            }
        } else {
            const uniqueBrands = [...new Set(codeMatches.map(p => p.brandUpper).filter(Boolean))];
            if (uniqueBrands.length > 1) {
                const brandList = uniqueBrands.slice(0, 5).map(b => b.charAt(0) + b.slice(1).toLowerCase()).join(', ');
                const suffix    = uniqueBrands.length > 5 ? '... and more' : '';
                const response  = `AMBIGUOUS: "${queryCode}" kai brands mein hai — konsa chahiye? ${brandList}${suffix}`;
                console.log(`⚠️ [STRICT CODE]: ${response}`);
                return response;
            }
        }

        // Size filter
        let result;
        if (targetSuffix) {
            const sizeMatch = codeMatches.find(p => p.size === targetSuffix);
            if (sizeMatch) {
                result = sizeMatch;
            } else {
                const available = [...new Set(codeMatches.map(p => p.size).filter(Boolean))].join(', ');
                return `SIZE_NOT_AVAILABLE: ${codeMatches[0].baseName || codeMatches[0].fullName} | Available sizes: ${available} | Requested: ${targetSuffix}`;
            }
        } else {
            result = codeMatches[0];
        }

        const finalName = wantNoTokenLocal ? `${result.fullName}X` : result.fullName;
        const response  = `MATCH: ${finalName} | Unit: ${result.unit}`;
        if (sessionCache) sessionCache[cacheKey] = response;
        console.log(`✅ [STRICT CODE]: ${response}`);
        return response;
    }

    // ── EXACT COLLAPSED MATCH ─────────────────────────────────────
    const queryCollapsed = queryTokens.join('').replace(/[^A-Z0-9]/g, '');
    const collapsedMatches = PRODUCTS.filter(p => p.collapsed === queryCollapsed);

    if (collapsedMatches.length > 0) {
        console.log(`🎯 [COLLAPSED MATCH]: Found ${collapsedMatches.length} matching candidate(s) for "${queryCollapsed}"`);
        
        // Only direct match if all candidates belong to the same product code family
        const uniqueCodes = [...new Set(collapsedMatches.map(p => p.code).filter(Boolean))];
        
        let matchResult;
        if (uniqueCodes.length <= 1) {
            if (targetSuffix) {
                matchResult = collapsedMatches.find(p => p.size === targetSuffix);
                if (!matchResult) {
                    const available = [...new Set(collapsedMatches.map(p => p.size).filter(Boolean))].join(', ');
                    return `SIZE_NOT_AVAILABLE: ${collapsedMatches[0].baseName || collapsedMatches[0].fullName} | Available sizes: ${available} | Requested: ${targetSuffix}`;
                }
            } else {
                if (collapsedMatches.length === 1) {
                    matchResult = collapsedMatches[0];
                }
            }
        } else {
            console.log(`⚠️ [COLLAPSED MATCH AMBIGUOUS]: Multiple codes found: ${uniqueCodes.join(', ')}. Falling back to strict path.`);
        }

        if (matchResult) {
            const finalName = wantNoTokenLocal ? `${matchResult.fullName}X` : matchResult.fullName;
            const response  = `MATCH: ${finalName} | Unit: ${matchResult.unit}`;
            if (sessionCache) sessionCache[cacheKey] = response;
            console.log(`✅ [COLLAPSED MATCH SUCCESS]: ${response}`);
            return response;
        }
    }

    // ── AMBIGUITY CHECK ───────────────────────────────────────────
    const ambig = checkAmbiguity(queryTokens);
    if (ambig) {
        const top5   = ambig.brands.slice(0, 5);
        const suffix = ambig.brands.length > 5 ? '... and more' : '';
        return `AMBIGUOUS: "${ambig.type}" kai brands mein hai — konsa chahiye? ${top5.join(', ')}${suffix}`;
    }

    // ── STRICT FIELD PATH (no code in query) ─────────────────────
    const queryProductTokens = queryTokens.filter(t => t !== queryBrand && !queryColorTokens.includes(t));

    console.log(`🔒 [STRICT FIELDS]: brand="${queryBrand || 'ANY'}" product="${queryProductTokens.join(',') || 'ANY'}" color="${queryColorTokens.join(',') || 'ANY'}" size="${targetSuffix || 'ANY'}" noToken=${wantNoTokenLocal}`);

    let candidates = PRODUCTS;

    // 1. Brand filter
    if (queryBrand) {
        candidates = candidates.filter(p => brandMatches(p.brandUpper, queryBrand));
        if (candidates.length === 0) {
            return `BRAND_MISMATCH: "${queryBrand}" brand mein koi product nahi mila.`;
        }
    }

    // 2. Product filter
    if (queryProductTokens.length > 0) {
        let matchedCandidates = candidates.filter(p =>
            queryProductTokens.every(t => p.productUpper.includes(t) || p.fullNameTokenSet.has(t))
        );

        // Relaxation: remove WATER if no match
        if (matchedCandidates.length === 0 && queryProductTokens.includes('WATER')) {
            const relaxed = queryProductTokens.filter(t => t !== 'WATER');
            if (relaxed.length > 0) {
                matchedCandidates = candidates.filter(p => relaxed.every(t => p.productUpper.includes(t) || p.fullNameTokenSet.has(t)));
            }
        }

        // Relaxation: remove OIL if no match
        if (matchedCandidates.length === 0 && queryProductTokens.includes('OIL')) {
            const relaxed = queryProductTokens.filter(t => t !== 'OIL');
            if (relaxed.length > 0) {
                matchedCandidates = candidates.filter(p => relaxed.every(t => p.productUpper.includes(t) || p.fullNameTokenSet.has(t)));
            }
        }

        candidates = matchedCandidates;
        if (candidates.length === 0) return 'NOT_IN_DATABASE';
    }

    // 3. Size filter
    // Before filtering by size, keep a reference to pre-size candidates for color fallback
    const preSizeCandidates = candidates;

    if (targetSuffix) {
        candidates = candidates.filter(p => p.size === targetSuffix);
        if (candidates.length === 0) {
            // Check if the color exists in other sizes
            if (queryColorTokens.length > 0) {
                const colorMatchedPreSize = preSizeCandidates.filter(p => scoreColor(p.colorUpper, queryColorTokens) > 0);
                if (colorMatchedPreSize.length > 0) {
                    const availableSizes = [...new Set(colorMatchedPreSize.map(p => p.size).filter(Boolean))].join(', ');
                    const sampleProduct  = colorMatchedPreSize[0];
                    return `SIZE_NOT_AVAILABLE: ${sampleProduct.baseName || sampleProduct.fullName} | Available sizes: ${availableSizes} | Requested: ${targetSuffix}`;
                }
            }
            return 'NOT_IN_DATABASE';
        }
    }

    if (candidates.length === 0) return 'NOT_IN_DATABASE';

    // 4. Color & Product precise scoring
    candidates.forEach(p => {
        p._colorScore = scoreColor(p.colorUpper, queryColorTokens);

        // Product exact-match scoring to prioritize standard "Putty" over "Exterior Putty" when color/brand is generic
        let productScore = 0;
        const pProdTokens = p.productUpper.split(/\s+/).filter(Boolean);
        const isExactProductMatch = pProdTokens.length === queryProductTokens.length && 
            queryProductTokens.every(t => pProdTokens.includes(t));

        if (isExactProductMatch) {
            productScore = 200; // High bonus for exact product name match
        } else {
            let matchCount = 0;
            for (const t of queryProductTokens) {
                if (pProdTokens.includes(t)) matchCount++;
            }
            productScore = pProdTokens.length > 0 ? (matchCount / pProdTokens.length) * 50 : 0;
        }
        p._productScore = productScore;
        p._finalScore = p._colorScore + p._productScore;
    });

    // If there are candidates with exact color match (color score 100), filter out any candidates with less than 100 color score.
    if (queryColorTokens.length > 0) {
        const exactColorMatches = candidates.filter(p => p._colorScore === 100);
        if (exactColorMatches.length > 0) {
            candidates = exactColorMatches;
        }
    }

    // Sort by finalScore descending
    candidates.sort((a, b) => b._finalScore - a._finalScore);

    // Clear winner resolution: if top candidate has score >= 100 and is ahead of runner-up by >= 50 points, finalize it.
    if (candidates.length > 1) {
        const topScore = candidates[0]._finalScore;
        const runnerUpScore = candidates[1]._finalScore;
        if (topScore >= 100 && (topScore - runnerUpScore) >= 50) {
            candidates = [candidates[0]];
        }
    }

    // If user specified a color but no candidate matches it after size filter, return SIZE_NOT_AVAILABLE
    if (queryColorTokens.length > 0 && candidates[0]._colorScore === 0) {
        // The color doesn't exist at all in this brand+product combo
        const colorMatchedPreSize = preSizeCandidates.filter(p => scoreColor(p.colorUpper, queryColorTokens) > 0);
        if (colorMatchedPreSize.length > 0) {
            const availableSizes = [...new Set(colorMatchedPreSize.map(p => p.size).filter(Boolean))].join(', ');
            const sampleProduct  = colorMatchedPreSize[0];
            return `SIZE_NOT_AVAILABLE: ${sampleProduct.baseName || sampleProduct.fullName} | Available sizes: ${availableSizes} | Requested: ${targetSuffix || 'ANY'}`;
        }
        return 'NOT_IN_DATABASE';
    }

    if (candidates.length === 1) {
        const result    = candidates[0];
        const finalName = wantNoTokenLocal ? `${result.fullName}X` : result.fullName;
        const response  = `MATCH: ${finalName} | Unit: ${result.unit}`;

        if (sessionCache) sessionCache[cacheKey] = response;
        console.log(`✅ [STRICT FIELDS]: ${response}`);
        return response;
    } else {
        const topCandidates = candidates.slice(0, 3);
        const matchesList = topCandidates.map((result, idx) => {
            const finalName = wantNoTokenLocal ? `${result.fullName}X` : result.fullName;
            return `${idx + 1}. ${finalName} | Unit: ${result.unit} (Score: ${result._finalScore})`;
        }).join('\n');

        const response = `MULTIPLE_MATCHES:\n${matchesList}`;
        if (sessionCache) sessionCache[cacheKey] = response;
        console.log(`✅ [STRICT FIELDS - MULTIPLE]:\n${response}`);
        return response;
    }
}

// ── BULK VERIFY ───────────────────────────────────────────────────────
function bulkVerifyProductsLocal(items, sessionCache = null, phoneNumber = null) {
    return items.map(item => ({
        original: item.nameOrCode,
        result: findBestProductMatchLocal(
            item.nameOrCode,
            item.requestedSize,
            item.wantNoToken || false,
            sessionCache,
            phoneNumber
        )
    }));
}

function runFuzzyFallback(nameOrCode, requestedSize, wantNoToken, sessionCache) {
    const query = nameOrCode.trim();
    const sz = (requestedSize || '').toLowerCase().trim();

    let wantNoTokenLocal = wantNoToken;
    const queryUpper = query.toUpperCase();
    if (
        queryUpper.includes('BAGHER TOKEN') ||
        queryUpper.includes('BINA TOKEN')   ||
        queryUpper.includes('NO TOKEN')     ||
        queryUpper.includes('WITHOUT TOKEN')||
        queryUpper.includes('WO TOKEN')     ||
        queryUpper.includes('W/O TOKEN')    ||
        /\bTX\b/.test(queryUpper)
    ) {
        wantNoTokenLocal = true;
    }

    let targetSuffix = '';
    const szLower = sz.toLowerCase();
    if      (szLower.includes('gallon') || szLower.includes('gln') || szLower.includes('balti') || /\bg\b/.test(szLower)) targetSuffix = 'G';
    else if (szLower.includes('drum') || szLower.includes('drm') || /\bd\b/.test(szLower)) targetSuffix = 'D';
    else if (szLower.includes('quarter') || szLower.includes('qtr') || /\bq\b/.test(szLower)) targetSuffix = 'Q';

    if (!targetSuffix) {
        const m = query.toUpperCase().match(/(?:^|\s|-)([DGQ])(X)?$/);
        if (m) { targetSuffix = m[1]; if (m[2]) wantNoTokenLocal = true; }
    }

    const queryTokens = tokenize(query).filter(t => t !== targetSuffix);
    if (queryTokens.length === 0) return null;

    let candidates = PRODUCTS;
    if (targetSuffix) {
        candidates = candidates.filter(p => p.size === targetSuffix);
    }

    // Extract query brand and colors to enforce exact matching in fuzzy path
    const queryBrand = queryTokens.find(t => BRAND_SET.has(t) || MAJOR_GROUPS.has(t)) || null;
    const PRODUCT_KEYWORDS = new Set([
        'MATT','SEMI','PUTTY','PRIMER','ENAMEL','DISTEMPER','THINNER','GLOSS','GLOSSY',
        'STAINLESS','SHIELD','WEATHER','WATER','OIL','WALLEX'
    ]);
    const queryColorTokens = queryTokens.filter(t =>
        t !== queryBrand &&
        !PRODUCT_KEYWORDS.has(t) &&
        (COLOR_SET.has(t) || [...COLOR_SET].some(c => c.split(/\s+/).includes(t)))
    );

    // Enforce exact brand match
    if (queryBrand) {
        candidates = candidates.filter(p => brandMatches(p.brandUpper, queryBrand));
    }

    // Enforce exact color match
    if (queryColorTokens.length > 0) {
        candidates = candidates.filter(p => scoreColor(p.colorUpper, queryColorTokens) > 0);
    }

    if (candidates.length === 0) return null;

    const scored = candidates.map(p => {
        let score = 0;
        const pBrandTokens = p.brandUpper.split(/\s+/).filter(Boolean);
        const pProductTokens = p.productUpper.split(/\s+/).filter(Boolean);
        const pColorTokens = p.colorUpper.split(/\s+/).filter(Boolean);
        
        queryTokens.forEach(qToken => {
            if (pBrandTokens.includes(qToken)) score += 15;
            else if (pBrandTokens.some(t => {
                const maxD = Math.max(t.length, qToken.length) >= 6 ? 2 : 1;
                return getLevenshtein(t, qToken) <= maxD;
            })) score += 10;
            
            else if (pProductTokens.includes(qToken)) score += 10;
            else if (pProductTokens.some(t => {
                const maxD = Math.max(t.length, qToken.length) >= 6 ? 2 : 1;
                return getLevenshtein(t, qToken) <= maxD;
            })) score += 8;
            
            else if (pColorTokens.includes(qToken)) {
                if (p.colorUpper === qToken) {
                    score += 15;
                } else {
                    score += 10;
                }
            }
            else if (pColorTokens.some(t => {
                const maxD = Math.max(t.length, qToken.length) >= 6 ? 2 : 1;
                return getLevenshtein(t, qToken) <= maxD;
            })) score += 8;
        });

        return { product: p, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const maxScore = scored[0] ? scored[0].score : 0;
    
    // Strict threshold: raised to queryTokens.length * 10 to require high/maximum scoring
    const threshold = queryTokens.length * 10;

    if (maxScore < threshold) return null;

    const topScored = scored.filter(s => s.score === maxScore);
    const uniqueProducts = [];
    const seenFullNames = new Set();
    for (const item of topScored) {
        if (!seenFullNames.has(item.product.fullName)) {
            seenFullNames.add(item.product.fullName);
            uniqueProducts.push(item.product);
        }
    }

    if (uniqueProducts.length === 1) {
        const result = uniqueProducts[0];
        const finalName = wantNoTokenLocal ? `${result.fullName}X` : result.fullName;
        const response  = `MATCH: ${finalName} | Unit: ${result.unit}`;
        
        const cacheKey = `${query.toLowerCase()}_${sz}_${!!wantNoTokenLocal}`;
        if (sessionCache) sessionCache[cacheKey] = response;
        
        console.log(`💡 [FUZZY FALLBACK SUCCESS]: "${query}" matched to "${finalName}" (Score: ${maxScore})`);
        return response;
    } else if (uniqueProducts.length > 1) {
        const matchesList = uniqueProducts.slice(0, 3).map((result, idx) => {
            const finalName = wantNoTokenLocal ? `${result.fullName}X` : result.fullName;
            return `${idx + 1}. ${finalName} | Unit: ${result.unit}`;
        }).join('\n');

        const response = `MULTIPLE_MATCHES:\n${matchesList}`;
        const cacheKey = `${query.toLowerCase()}_${sz}_${!!wantNoTokenLocal}`;
        if (sessionCache) sessionCache[cacheKey] = response;
        
        console.log(`💡 [FUZZY FALLBACK MULTIPLE]: "${query}" matched multiple (Score: ${maxScore})`);
        return response;
    }

    return null;
}

function findBestProductMatchLocal(nameOrCode, requestedSize, wantNoToken = false, sessionCache = null, phoneNumber = null) {
    const result = findBestProductMatchLocalCore(nameOrCode, requestedSize, wantNoToken, sessionCache, phoneNumber);

    // ── CRITICAL: Skip fuzzy fallback if query contained a code token ──
    // If user gave a code (numeric or alphanumeric) that wasn't found,
    // return NOT_IN_DATABASE immediately — do NOT guess via fuzzy.
    if (result === 'NOT_IN_DATABASE' && nameOrCode && nameOrCode.length >= 3) {
        const queryTokensForCheck = tokenize(nameOrCode.trim());
        const hadCodeToken = queryTokensForCheck.some(t => isCodeToken(t));
        if (hadCodeToken) {
            console.log(`🚫 [FUZZY SKIP]: Code detected in query "${nameOrCode}" — returning NOT_IN_DATABASE directly.`);
            return 'NOT_IN_DATABASE';
        }
        const fuzzy = runFuzzyFallback(nameOrCode, requestedSize, wantNoToken, sessionCache);
        if (fuzzy) return fuzzy;
    }
    return result;
}

module.exports = { 
    findBestProductMatchLocal, 
    bulkVerifyProductsLocal, 
    loadProducts
};
 