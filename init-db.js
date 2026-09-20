require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  const sql = fs.readFileSync('schema.sql', 'utf8');
  await client.query(sql);
  console.log('✅ Schema appliqué avec succès.');
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log('Tables créées :', res.rows.map(r => r.table_name).join(', '));
  await client.end();
}

run().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
