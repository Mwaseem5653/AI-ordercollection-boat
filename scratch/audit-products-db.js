const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('products.json', 'utf8'));

// Group products by (brand + code) or baseName
const codeMap = {};
raw.forEach(p => {
    const key = `${(p.brand || '').toUpperCase()}_${(p.code || '').toUpperCase()}_${(p.product || '').toUpperCase()}`;
    if (!codeMap[key]) codeMap[key] = [];
    codeMap[key].push(p);
});

let inconsistentCount = 0;
for (const [key, items] of Object.entries(codeMap)) {
    if (items.length > 1) {
        const colors = new Set(items.map(i => i.color || ''));
        if (colors.size > 1 && colors.has('')) {
            console.log(`⚠️ Inconsistent color in group "${key}":`, items.map(i => `${i.fullName} (color="${i.color}")`));
            inconsistentCount++;
            
            // Auto-fill non-empty color to all items in group
            const validColor = items.find(i => i.color && i.color.trim())?.color || '';
            if (validColor) {
                items.forEach(i => {
                    if (!i.color || !i.color.trim()) {
                        console.log(`   --> Setting color for "${i.fullName}" to "${validColor}"`);
                        i.color = validColor;
                    }
                });
            }
        }
    }
}

if (inconsistentCount > 0) {
    fs.writeFileSync('products.json', JSON.stringify(raw, null, 2), 'utf8');
    console.log(`\nFixed ${inconsistentCount} inconsistent product groups in products.json!`);
} else {
    console.log('\nNo other inconsistent product groups found in products.json.');
}
