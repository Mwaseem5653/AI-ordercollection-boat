const fs = require('fs');

const sampleErrorOutput = `tool_code
print(default_api.submitOrder(tradingName='Color Junction', items=[default_api.SubmitorderItems(product='EXTRA SEMI 03 WHITE-G', size='Gallon', quantity=26.0), default_api.SubmitorderItems(product='EXTRA SEMI 03 WHITE-Q', size='Quarter', quantity=8.0), default_api.SubmitorderItems(product='EXTRA SEMI 03 WHITE-D', size='Drum', quantity=8.0), default_api.SubmitorderItems(product='EXTRA SEMI 05 LAVENDER WHITE-Q', size='Quarter', quantity=2.0), default_api.SubmitorderItems(product='EXTRA SEMI 8747 CASHEW NUT-G', size='Gallon', quantity=2.0), default_api.SubmitorderItems(product='EXTRA SEMI 8747 CASHEW NUT-Q', size='Quarter', quantity=2.0), default_api.SubmitorderItems(product='EXTRA SEMI 8770 PASTEL PINK-Q', size='Quarter', quantity=2.0)]))`;

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

const parsed = parsePythonSubmitOrder(sampleErrorOutput);
console.log('Parsed result:');
console.log(JSON.stringify(parsed, null, 2));

if (parsed && parsed.items.length === 7 && parsed.tradingName === 'Color Junction') {
    console.log('\n✅ TEST PASSED: Successfully extracted order details from raw tool_code!');
} else {
    console.log('\n❌ TEST FAILED');
}
