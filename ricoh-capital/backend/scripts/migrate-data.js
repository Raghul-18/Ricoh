/*
  One-time migration scaffold:
  1) Export legacy tables to JSON/CSV.
  2) Transform IDs/date formats for Oracle RAW(16)/TIMESTAMP.
  3) Insert in FK order.
*/

import fs from 'node:fs/promises';

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: node scripts/migrate-data.js <legacy-export.json>');
  }
  const raw = await fs.readFile(inputPath, 'utf8');
  const payload = JSON.parse(raw);

  // TODO: map payload tables and batch insert into Oracle through backend API/SQL.
  console.log('Loaded export tables:', Object.keys(payload));
  console.log('Implement table-by-table transform and load before production cutover.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
