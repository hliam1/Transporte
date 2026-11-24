/**
 * Reglas que garantiza la propia base de datos (no dependen del código):
 * sin duplicados, PostGIS sincronizado, particiones y retención de GPS.
 */
import { Pool } from 'pg';
import { uuidv7 } from '../src/common/uuid';

describe('Esquema de base de datos (e2e)', () => {
  let pool: Pool;
  const q = (text: string, params: unknown[] = []) => pool.query(text, params);

  let travelerId: string;
  let driverId: string;
  let roomId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    travelerId = uuidv7();
    driverId = uuidv7();
    roomId = uuidv7();
    await q(`INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, 'x', 'TRAVELER'), ($3, $4, 'x', 'DRIVER')`, [
      travelerId,
      `v.${travelerId}@prueba.hn`,
      driverId,
      `c.${driverId}@prueba.hn`,
    ]);
    await q('INSERT INTO travelers (user_id) VALUES ($1)', [travelerId]);
    await q('INSERT INTO drivers (user_id) VALUES ($1)', [driverId]);
    await q(
      `INSERT INTO rooms (id, driver_id, name, transport_type, zone, capacity) VALUES ($1, $2, 'UNAH', 'UNIVERSITY', 'Tegucigalpa', 30)`,
      [roomId, driverId],
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('PostGIS: la columna geography se llena y se actualiza sola desde lat/lng', async () => {
    const id = uuidv7();
    await q(
      `INSERT INTO addresses (id, user_id, label, formatted_address, lat, lng) VALUES ($1, $2, 'Casa', 'Col. Palmira', 14.0943, -87.1897)`,
      [id, travelerId],
    );
    let r = await q('SELECT ST_AsText(location) AS wkt FROM addresses WHERE id = $1', [id]);
    expect(r.rows[0].wkt).toBe('POINT(-87.1897 14.0943)');

    await q('UPDATE addresses SET lat = 14.1, lng = -87.2 WHERE id = $1', [id]);
    r = await q('SELECT ST_AsText(location) AS wkt FROM addresses WHERE id = $1', [id]);
    expect(r.rows[0].wkt).toBe('POINT(-87.2 14.1)');

    // Distancia real en metros entre dos puntos de Tegucigalpa.
    r = await q(
      `SELECT ST_Distance(location, ST_SetSRID(ST_MakePoint(-87.2, 14.11), 4326)::geography) AS m FROM addresses WHERE id = $1`,
      [id],
    );
    expect(Number(r.rows[0].m)).toBeGreaterThan(1000);
    expect(Number(r.rows[0].m)).toBeLessThan(1200);
  });

  it('rechaza coordenadas fuera de rango', async () => {
    await expect(
      q(`INSERT INTO addresses (id, user_id, label, formatted_address, lat, lng) VALUES ($1, $2, 'X', 'X', 95, 0)`, [
        uuidv7(),
        travelerId,
      ]),
    ).rejects.toThrow(/addresses_lat_range/);
  });

  it('no permite confirmaciones duplicadas (mismo viajero, sala, fecha y sentido)', async () => {
    const insert = (status: string, dir = 'OUTBOUND') =>
      q(
        `INSERT INTO travel_confirmations (id, room_id, traveler_id, service_date, direction, status, updated_by)
         VALUES ($1, $2, $3, '2026-12-01', $4, $5, $3)`,
        [uuidv7(), roomId, travelerId, dir, status],
      );
    await insert('YES');
    await expect(insert('NO')).rejects.toThrow(/travel_confirmations_uq/);
    // Ida y regreso son independientes.
    await expect(insert('YES', 'RETURN')).resolves.toBeDefined();
  });

  it('solo un código de invitación activo por sala, y los códigos no se repiten', async () => {
    const code = `BUS-${uuidv7().slice(-6).toUpperCase()}`;
    await q(`INSERT INTO room_invitations (id, room_id, code) VALUES ($1, $2, $3)`, [uuidv7(), roomId, code]);
    await expect(
      q(`INSERT INTO room_invitations (id, room_id, code) VALUES ($1, $2, 'BUS-ZZZZZZ')`, [uuidv7(), roomId]),
    ).rejects.toThrow(/room_invitations_one_active_uq/);
    // Un código revocado puede convivir con el activo.
    await q(`INSERT INTO room_invitations (id, room_id, code, active) VALUES ($1, $2, 'BUS-OLD001', false)`, [
      uuidv7(),
      roomId,
    ]);
  });

  it('solo una solicitud pendiente por viajero y sala', async () => {
    const insert = () =>
      q(`INSERT INTO join_requests (id, room_id, traveler_id) VALUES ($1, $2, $3)`, [uuidv7(), roomId, travelerId]);
    await insert();
    await expect(insert()).rejects.toThrow(/join_requests_one_pending_uq/);
  });

  it('valida el formato de la hora límite y de los horarios', async () => {
    await expect(q(`UPDATE rooms SET confirmation_deadline = '24:00' WHERE id = $1`, [roomId])).rejects.toThrow(
      /rooms_deadline_format/,
    );
    await expect(
      q(`INSERT INTO schedules (id, room_id, weekday, direction, departure_time) VALUES ($1, $2, 7, 'OUTBOUND', '06:30')`, [
        uuidv7(),
        roomId,
      ]),
    ).rejects.toThrow(/schedules_weekday_range/);
  });

  describe('GPS en vivo', () => {
    let tripId: string;

    beforeAll(async () => {
      const vehicleId = uuidv7();
      tripId = uuidv7();
      await q(
        `INSERT INTO vehicles (id, driver_id, identifier, brand, model, plate, capacity) VALUES ($1, $2, 'Bus 1', 'Toyota', 'Coaster', 'HAA-1234', 30)`,
        [vehicleId, driverId],
      );
      await q(
        `INSERT INTO trips (id, room_id, vehicle_id, service_date, direction) VALUES ($1, $2, $3, CURRENT_DATE, 'OUTBOUND')`,
        [tripId, roomId, vehicleId],
      );
    });

    it('guarda puntos en la partición del día, llena la geografía e ignora reenvíos duplicados', async () => {
      const at = new Date();
      const insert = () =>
        q(
          `INSERT INTO live_locations (trip_id, recorded_at, lat, lng, speed) VALUES ($1, $2, 14.08, -87.2, 30)
           ON CONFLICT (trip_id, recorded_at) DO NOTHING`,
          [tripId, at],
        );
      await insert();
      await insert(); // la app reenvía su cola offline
      const r = await q(
        `SELECT tableoid::regclass::text AS part, ST_AsText(location) AS wkt FROM live_locations WHERE trip_id = $1`,
        [tripId],
      );
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0].part).toMatch(/^live_locations_\d{8}$/);
      expect(r.rows[0].wkt).toBe('POINT(-87.2 14.08)');
    });

    it('retención: elimina particiones de más de 30 días y conserva las recientes', async () => {
      await q(`CREATE TABLE live_locations_20200101 PARTITION OF live_locations
               FOR VALUES FROM ('2020-01-01 00:00+00') TO ('2020-01-02 00:00+00')`);
      await q(`INSERT INTO live_locations (trip_id, recorded_at, lat, lng) VALUES ($1, '2020-01-01 12:00+00', 14, -87)`, [
        tripId,
      ]);
      const r = await q('SELECT drop_old_live_location_partitions(30) AS dropped');
      expect(r.rows[0].dropped).toBe(1);
      const exists = await q(`SELECT to_regclass('live_locations_20200101') AS t`);
      expect(exists.rows[0].t).toBeNull();
      const recent = await q('SELECT count(*)::int AS n FROM live_locations WHERE trip_id = $1', [tripId]);
      expect(recent.rows[0].n).toBe(1);
    });
  });
});
