# Transporte

Plataforma híbrida de transporte privado en buses:

- **PWA para viajeros** (Next.js + TypeScript) — *pendiente*
- **App Android para conductores** — *pendiente*
- **Backend central** (`apps/api`): NestJS + PostgreSQL/PostGIS + Drizzle ORM

Documentación: [arquitectura](docs/arquitectura.md) · [estado y avance](docs/estado.md) · [costos de Google Maps](docs/costos-google-maps.md)

## Requisitos

- Node.js 22 y pnpm 10 (`corepack enable`)
- Docker (para PostgreSQL + PostGIS y Redis locales)

## Arrancar el backend en tu computadora

```bash
pnpm install
pnpm db:up                                   # PostgreSQL + PostGIS y Redis en Docker
cp apps/api/.env.example apps/api/.env       # y cambia JWT_ACCESS_SECRET
cd apps/api
set -a && source .env && set +a
pnpm db:migrate                              # crea las tablas
pnpm start:dev                               # API en http://localhost:3000/v1
```

Documentación interactiva de la API: <http://localhost:3000/docs>

## Pruebas

```bash
cd apps/api
pnpm test        # unitarias
pnpm test:e2e    # integración contra la base transporte_test (se recrea sola)
```

## Cambiar la base de datos

1. Edita `apps/api/src/database/schema/tables.ts`.
2. `pnpm db:generate` crea la migración en `apps/api/drizzle/`.
3. Revisa el SQL generado. Drizzle escribe los tipos PostGIS entre comillas
   (`"geography(Point,4326)"`): quítalas antes de aplicarla.
4. `pnpm db:migrate`.
