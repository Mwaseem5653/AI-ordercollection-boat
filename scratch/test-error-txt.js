const fs = require('fs');
const path = require('path');

const errorTxtContent = fs.readFileSync(path.join(__dirname, '../error.txt'), 'utf8');

function parsePythonSubmitOrder(text) {
    if (!text || (!text.includes('default_api.submitOrder') && !text.includes('submitOrder('))) {
        return null;
    }

    try {
        const tradingMatch = text.match(/tradingName=['"]([^'"]+)['"]/);
        const tradingName = tradingMatch ? tradingMatch[1] : 'UNKNOWN';

        const items = [];
        const itemRegex = /(?:default_api\.)?SubmitorderItems\s*\(\s*product=['"]([^'"]+)['"]\s*,\s*size=['"]([^'"]+)['"]\s*,\s*quantity=([\d.]+)\s*\)/g;
        
        let match;
        while ((match = itemRegex.exec(text)) !== null) {
            items.push({
                product: match[1],
                size: match[2],
                quantity: parseFloat(match[3])
            });
        }

        if (items.length > 0) {
            return { tradingName, items };
        }
    } catch (e) {
        console.error('🛑 [PARSE PYTHON SUBMIT ORDER ERROR]:', e.message);
    }

    return null;
}

console.log("=== TESTING FALLBACK PARSER DIRECTLY ON error.txt ===");
const parsed = parsePythonSubmitOrder(errorTxtContent);
console.log(JSON.stringify(parsed, null, 2));

if (parsed && parsed.tradingName === 'Color Junction' && parsed.items.length === 7) {
    console.log("\n✅ VERIFICATION SUCCESSFUL: All 7 items and Trading Name 'Color Junction' parsed perfectly from error.txt!");
} else {
    console.log("\n❌ VERIFICATION FAILED");
}
