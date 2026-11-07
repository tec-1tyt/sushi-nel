// npm run check:data  checks the JSON files before you upload them.
import { loadFromDisk } from './content.js';

try {
  const c = loadFromDisk();
  console.log(`OK: ${c.dishes.size} dishes in ${c.menu.categories.length} categories, ${c.promos.promotions.filter((p) => p.active).length} active promotions.`);
} catch (err) {
  console.error('Problem in data files:\n', err.issues ? JSON.stringify(err.issues, null, 2) : err.message);
  process.exit(1);
}
