-- =============================================================================
-- Extras que Drizzle no genera: columnas PostGIS sincronizadas por trigger,
-- índices espaciales y particionado diario de live_locations.
-- =============================================================================

-- 1) Función genérica: llena una columna geography a partir de lat/lng.
--    Argumentos del trigger: (columna_lat, columna_lng, columna_geography)
CREATE OR REPLACE FUNCTION set_geography_from_latlng() RETURNS trigger AS $$
DECLARE
  lat double precision;
  lng double precision;
BEGIN
  EXECUTE format('SELECT ($1).%I, ($1).%I', TG_ARGV[0], TG_ARGV[1]) INTO lat, lng USING NEW;
  IF lat IS NULL OR lng IS NULL THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[2], NULL));
  ELSE
    NEW := jsonb_populate_record(
      NEW,
      jsonb_build_object(TG_ARGV[2], ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography::text)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER addresses_geo BEFORE INSERT OR UPDATE OF lat, lng ON addresses
  FOR EACH ROW EXECUTE FUNCTION set_geography_from_latlng('lat', 'lng', 'location');
--> statement-breakpoint
CREATE TRIGGER rooms_origin_geo BEFORE INSERT OR UPDATE OF origin_lat, origin_lng ON rooms
  FOR EACH ROW EXECUTE FUNCTION set_geography_from_latlng('origin_lat', 'origin_lng', 'origin_location');
--> statement-breakpoint
CREATE TRIGGER rooms_destination_geo BEFORE INSERT OR UPDATE OF destination_lat, destination_lng ON rooms
  FOR EACH ROW EXECUTE FUNCTION set_geography_from_latlng('destination_lat', 'destination_lng', 'destination_location');
--> statement-breakpoint
CREATE TRIGGER trip_passengers_pickup_geo BEFORE INSERT OR UPDATE OF pickup_lat, pickup_lng ON trip_passengers
  FOR EACH ROW EXECUTE FUNCTION set_geography_from_latlng('pickup_lat', 'pickup_lng', 'pickup_location');
--> statement-breakpoint
CREATE TRIGGER trip_passengers_dropoff_geo BEFORE INSERT OR UPDATE OF dropoff_lat, dropoff_lng ON trip_passengers
  FOR EACH ROW EXECUTE FUNCTION set_geography_from_latlng('dropoff_lat', 'dropoff_lng', 'dropoff_location');
--> statement-breakpoint
CREATE TRIGGER route_stops_geo BEFORE INSERT OR UPDATE OF lat, lng ON route_stops
  FOR EACH ROW EXECUTE FUNCTION set_geography_from_latlng('lat', 'lng', 'location');
--> statement-breakpoint
CREATE TRIGGER live_locations_geo BEFORE INSERT ON live_locations
  FOR EACH ROW EXECUTE FUNCTION set_geography_from_latlng('lat', 'lng', 'location');
--> statement-breakpoint

-- 2) Índices espaciales adicionales.
CREATE INDEX trip_passengers_pickup_gix ON trip_passengers USING gist (pickup_location);
--> statement-breakpoint
CREATE INDEX route_stops_location_gix ON route_stops USING gist (location);
--> statement-breakpoint

-- 3) Particionado diario de live_locations.
--    Partición por defecto: ningún punto se pierde aunque falte la del día.
CREATE TABLE live_locations_default PARTITION OF live_locations DEFAULT;
--> statement-breakpoint

-- Crea las particiones de hoy y los próximos `days_ahead` días (idempotente).
-- La ejecuta a diario un worker del backend.
CREATE OR REPLACE FUNCTION ensure_live_location_partitions(days_ahead int DEFAULT 2) RETURNS void AS $$
DECLARE
  d date;
  part text;
BEGIN
  FOR i IN 0..days_ahead LOOP
    d := (now() AT TIME ZONE 'UTC')::date + i;
    part := 'live_locations_' || to_char(d, 'YYYYMMDD');
    IF to_regclass(part) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF live_locations FOR VALUES FROM (%L) TO (%L)',
        part, d::timestamptz, (d + 1)::timestamptz
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Política de retención: elimina particiones con más de `keep_days` días.
-- (Antes de borrar, el resumen del recorrido ya quedó en trip_history.)
CREATE OR REPLACE FUNCTION drop_old_live_location_partitions(keep_days int DEFAULT 30) RETURNS int AS $$
DECLARE
  r record;
  dropped int := 0;
  cutoff date := (now() AT TIME ZONE 'UTC')::date - keep_days;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.relname = 'live_locations' AND c.relname ~ '^live_locations_[0-9]{8}$'
  LOOP
    IF to_date(right(r.relname, 8), 'YYYYMMDD') < cutoff THEN
      EXECUTE format('DROP TABLE %I', r.relname);
      dropped := dropped + 1;
    END IF;
  END LOOP;
  DELETE FROM live_locations_default WHERE recorded_at < cutoff::timestamptz;
  RETURN dropped;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

SELECT ensure_live_location_partitions(2);
