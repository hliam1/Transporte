/**
 * Antes de las pruebas e2e: borra y recrea el esquema de la base de pruebas
 * y aplica todas las migraciones, para empezar siempre desde cero.
 */
import { Client } from 'pg';
import { runMigrations } from '../src/database/migrate';

export default async function globalSetup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://transporte:transporte@localhost:5432/transporte_test';
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
  await client.end();
  await runMigrations(url);
}
