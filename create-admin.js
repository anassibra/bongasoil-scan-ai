require('dotenv').config();
const bcrypt = require('bcrypt');
const { Client } = require('pg');

const [,, username, password, fullName] = process.argv;

if (!username || !password || !fullName) {
  console.log('Usage: node create-admin.js <username> <password> "<nom complet>"');
  process.exit(1);
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const hash = await bcrypt.hash(password, 10);
  const res = await client.query(
    `INSERT INTO users (username, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin')
     RETURNING id, username, full_name, role`,
    [username, hash, fullName]
  );
  console.log('✅ Admin créé :', res.rows[0]);
  await client.end();
}

run().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
