/**
 * Utilidades compartidas por todas las tablas del esquema.
 */
import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';
import { uuidv7 } from '../../common/uuid';

/** Clave primaria UUID v7 (ordenable por tiempo), generada en el servidor. */
export const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7());

/** Columna timestamptz con precisión de milisegundos. */
export const ts = (name: string) => timestamp(name, { withTimezone: true, precision: 3, mode: 'date' });

export const createdAt = () => ts('created_at').notNull().defaultNow();
export const updatedAt = () =>
  ts('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/**
 * Columna PostGIS geography(Point,4326).
 * La aplicación nunca la escribe directamente: un trigger la mantiene a partir
 * de las columnas lat/lng (ver migración 0001_postgis_extras.sql). Se usa para
 * consultas espaciales e índices GiST.
 */
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(Point,4326)';
  },
});

export const geographyLine = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(LineString,4326)';
  },
});
