const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../unmatched_orders.json');
if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const beforeCount = data.length;
    const filtered = data.filter(item => item.result === 'NOT_IN_DATABASE');
    fs.writeFileSync(file, JSON.stringify(filtered, null, 2), 'utf8');
    console.log(`Cleaned unmatched_orders.json: Before=${beforeCount}, After=${filtered.length}`);
} else {
    console.log('unmatched_orders.json does not exist.');
}
