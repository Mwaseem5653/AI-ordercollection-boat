const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function run() {
    const EXCEL_FILE = path.join(__dirname, '..', 'profile updated for AI order application.xlsx');
    const JSON_OUTPUT_FILE = path.join(__dirname, '..', 'products.json');

    console.log(`📖 Loading Excel file: ${EXCEL_FILE}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE);
    const sheet = workbook.getWorksheet(1);

    console.log(`📊 Processing ${sheet.rowCount} rows...`);
    const products = [];

    // Row 1 is usually header, so we start from Row 2
    for (let i = 2; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        const name = row.getCell(1).text.trim();
        const group = row.getCell(2).text.trim();
        const unit = row.getCell(3).text.trim();

        // Skip rows that are empty or are headers
        if (!name || name.toLowerCase() === 'product full name' || name === '') {
            continue;
        }

        products.push({
            id: `row_${i}`,
            fullName: name,
            group: group || "N/A",
            unit: unit || "N/A"
        });
    }

    console.log(`✅ Extracted ${products.length} products.`);
    
    // Write JSON file
    fs.writeFileSync(JSON_OUTPUT_FILE, JSON.stringify(products, null, 2), 'utf8');
    console.log(`💾 Saved ${products.length} products to JSON at: ${JSON_OUTPUT_FILE}`);
}

run().catch(console.error);
