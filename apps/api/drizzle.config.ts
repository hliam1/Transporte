import { defineConfig } from 'drizzle-kit';

/**
 * Configuración de drizzle-kit.
 *  - Generar una migración tras cambiar el esquema:  pnpm db:generate
 *  - Aplicar migraciones:                           pnpm db:migrate
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://transporte:transporte@localhost:5432/transporte',
  },
  strict: true,
});
