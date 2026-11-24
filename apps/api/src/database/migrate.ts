/**
 * Aplica las migraciones pendientes de ./drizzle.
 * Uso: DATABASE_URL=... pnpm db:migrate
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { Pool } from 'pg';

export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta la variable DATABASE_URL');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('Migraciones aplicadas'))
    .catch((err) => {
      console.error('Error aplicando migraciones:', err);
      process.exit(1);
    });
}
