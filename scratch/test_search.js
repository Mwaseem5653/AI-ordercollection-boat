const { findBestProductMatchLocal } = require('../productSearch.js');

const queries = [
  { q: '340',                      size: '',        qty: 6  },
  { q: '59',                       size: '',        qty: 2  },
  { q: 'Semi plastic',             size: 'gallon',  qty: 1  },
  { q: '8775',                     size: '',        qty: 5  },
  { q: '5',                        size: '',        qty: 4  },
  { q: 'Semi plastic',             size: 'drum',    qty: 1  },
  { q: '20',                       size: '',        qty: 2  },
  { q: 'Matt',                     size: 'gallon',  qty: 1  },
  { q: '236',                      size: '',        qty: 4  },
  { q: '88',                       size: '',        qty: 6  },
  { q: 'Enamel',                   size: 'quarter', qty: 1  },
  { q: '61',                       size: '',        qty: 5  },
  { q: 'Weather sheath',           size: 'gallon',  qty: 1  },
  { q: '6172',                     size: '',        qty: 4  },
  { q: 'Water Matt drum extra',    size: '',        qty: 1  },
  { q: 'Whi71',                    size: '',        qty: 3  },
  { q: 'Extra oil wall primer',    size: 'gallon',  qty: 5  },
  { q: 'Extra laapi',              size: 'gallon',  qty: 20 },
  { q: 'Bold dist',                size: 'gallon',  qty: 1  },
  { q: '9962',                     size: '',        qty: 4  },
  { q: 'Bold water Matt',          size: 'gallon',  qty: 1  },
];

console.log('\n====== PRODUCT SEARCH BULK TEST ======\n');
queries.forEach(({ q, size, qty }) => {
  const result = findBestProductMatchLocal(q, size);
  const status = result.startsWith('MATCH')          ? '✅ MATCH'
               : result.startsWith('AMBIGUOUS')      ? '⚠️  AMBIGUOUS'
               : result.startsWith('LOW_CONFIDENCE') ? '🟡 LOW_CONF'
               : result.startsWith('SIZE_NOT')        ? '📏 SIZE_ERR'
               : result.startsWith('NO_TOKEN')        ? '🚫 NO_TOKEN'
               : '❌ NOT_FOUND';

  console.log(`${status} | Qty:${qty} | Query: "${q}"${size ? ' [' + size + ']' : ''}`);
  console.log(`         └─ ${result}`);
  console.log('');
});
