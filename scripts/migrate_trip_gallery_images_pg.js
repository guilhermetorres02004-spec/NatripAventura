require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const connectionString = (process.env.DATABASE_URL || '').trim().replace(/^['\"]|['\"]$/g, '');

  if (!connectionString) {
    throw new Error('DATABASE_URL nao encontrado. Defina a variavel antes de executar a migracao.');
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const existsResult = await pool.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'trips' AND column_name = 'galleryimages'
      `
    );

    if (existsResult.rowCount > 0) {
      console.log('Coluna galleryImages ja existe em trips.');
    } else {
      await pool.query('ALTER TABLE trips ADD COLUMN galleryImages TEXT');
      console.log('Coluna galleryImages adicionada com sucesso na tabela trips.');
    }

    await pool.query('ALTER TABLE trips ALTER COLUMN coverImage TYPE TEXT');
    console.log('Coluna coverImage ajustada para TEXT na tabela trips.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Falha ao aplicar migracao PostgreSQL:', error.message);
  process.exitCode = 1;
});