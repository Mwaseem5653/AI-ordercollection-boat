const { findBestProductMatchLocal } = require('../productSearch.js');

console.log('Testing "8" as nameOrCode, "" as size:');
console.log(findBestProductMatchLocal('8', ''));

console.log('Testing "8" as nameOrCode, "gallon" as size:');
console.log(findBestProductMatchLocal('8', 'gallon'));

console.log('Testing "8" as nameOrCode, "3 gallon" as size:');
console.log(findBestProductMatchLocal('8', '3 gallon'));

console.log('Testing "08" as nameOrCode, "" as size:');
console.log(findBestProductMatchLocal('08', ''));

console.log('Testing "08" as nameOrCode, "gallon" as size:');
console.log(findBestProductMatchLocal('08', 'gallon'));

console.log('Testing "EXTRA SEMI 08" as nameOrCode, "gallon" as size:');
console.log(findBestProductMatchLocal('EXTRA SEMI 08', 'gallon'));

console.log('Testing "EXTRA SEMI 8" as nameOrCode, "gallon" as size:');
console.log(findBestProductMatchLocal('EXTRA SEMI 8', 'gallon'));
