const { findBestProductMatchLocal } = require('../productSearch.js');

const codes = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

console.log('====== SINGLE DIGIT CODES SEARCH TEST ======\n');
codes.forEach(code => {
  console.log(`--- CODE ${code} ---`);
  console.log(`Search: "${code}"`);
  console.log(`Result: ${findBestProductMatchLocal(code, '')}`);
  
  console.log(`Search: "EXTRA SEMI ${code}"`);
  console.log(`Result: ${findBestProductMatchLocal(`EXTRA SEMI ${code}`, '')}`);
  console.log('');
});
