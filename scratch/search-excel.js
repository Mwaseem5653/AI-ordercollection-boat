const ExcelJS = require('exceljs');
const path = require('path');

async function run() {
    const EXCEL_FILE = path.join(__dirname, '..', 'profile updated for AI order application.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE);
    const sheet = workbook.getWorksheet(1);

    console.log(`Total rows: ${sheet.rowCount}`);
    const matches = [];

    const searchTerms = ['exterior', 'putty', 'white', 'indo', 'da45', '315', 'regular'];

    for (let i = 1; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        const name = row.getCell(1).text.trim();
        const group = row.getCell(2).text.trim();
        const unit = row.getCell(3).text.trim();

        if (!name) continue;

        const nameLower = name.toLowerCase();
        const groupLower = group.toLowerCase();
        const combined = `${groupLower} ${nameLower}`;

        if (searchTerms.some(term => combined.includes(term))) {
            matches.push({ row: i, name, group, unit });
        }
    }

    console.log(`Found ${matches.length} matches:`);
    matches.forEach(m => {
        console.log(`Row ${m.row} | Group: ${m.group} | Name: ${m.name} | Unit: ${m.unit}`);
    });
}

run().catch(console.error);
