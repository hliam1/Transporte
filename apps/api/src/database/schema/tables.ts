/**
 * Esquema de base de datos — Plataforma de transporte.
 * PostgreSQL 16 + PostGIS. Tablas y columnas en snake_case.
 *
 * Lo que Drizzle no expresa (triggers de PostGIS, particionado de
 * live_locations, CHECKs adicionales) está en drizzle/0001_postgis_extras.sql.
 */
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  char,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createdAt, geographyLine, geographyPoint, id, ts, updatedAt } from './common';
import {
  attendanceStatus,
  confirmationSource,
  confirmationStatus,
  devicePlatform,
  direction,
  joinRequestStatus,
  memberStatus,
  optimizer,
  roomStatus,
  routeKind,
  stopType,
  transportType,
  tripStatus,
  userRole,
  userStatus,
  vehicleStatus,
} from './enums';

// ---------------------------------------------------------------------------
// Identidad y perfiles
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: id(),
    /** Siempre en minúsculas; se normaliza en el servidor. */
    email: varchar('email', { length: 254 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull(),
    status: userStatus('status').notNull().default('ACTIVE'),
    emailVerifiedAt: ts('email_verified_at'),
    lastLoginAt: ts('last_login_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('users_email_lowercase', sql`${t.email} = lower(${t.email})`)],
);

export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 120 }).notNull(),
  phone: varchar('phone', { length: 30 }),
  photoUrl: text('photo_url'),
  /** Zona horaria IANA, p. ej. America/Tegucigalpa */
  timezone: varchar('timezone', { length: 64 }).notNull().default('America/Tegucigalpa'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const drivers = pgTable('drivers', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  licenseNumber: varchar('license_number', { length: 40 }),
  defaultVehicleId: uuid('default_vehicle_id').references((): AnyPgColumn => vehicles.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const travelers = pgTable('travelers', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  emergencyContact: varchar('emergency_contact', { length: 120 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Sesión = un refresh token. Solo se guarda su hash SHA-256.
 * `familyId` agrupa las rotaciones de un mismo inicio de sesión: si alguien
 * reutiliza un token ya rotado, se revoca toda la familia (posible robo).
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    refreshTokenHash: char('refresh_token_hash', { length: 64 }).notNull().unique(),
    deviceInfo: varchar('device_info', { length: 200 }),
    ip: varchar('ip', { length: 64 }),
    expiresAt: ts('expires_at').notNull(),
    rotatedAt: ts('rotated_at'),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [index('auth_sessions_user_idx').on(t.userId), index('auth_sessions_family_idx').on(t.familyId)],
);

export const passwordResets = pgTable(
  'password_resets',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: createdAt(),
  },
  (t) => [index('password_resets_user_idx').on(t.userId)],
);

/** Destinos push: token FCM (Android) o suscripción Web Push (PWA). */
export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: devicePlatform('platform').notNull(),
    /** Token FCM o `endpoint` de la suscripción Web Push. */
    endpoint: text('endpoint').notNull(),
    /** Claves p256dh/auth de Web Push (null en Android). */
    subscription: jsonb('subscription'),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [unique('device_tokens_user_endpoint_uq').on(t.userId, t.endpoint)],
);

// ---------------------------------------------------------------------------
// Vehículos
// ---------------------------------------------------------------------------

export const vehicles = pgTable(
  'vehicles',
  {
    id: id(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.userId, { onDelete: 'cascade' }),
    identifier: varchar('identifier', { length: 40 }).notNull(),
    brand: varchar('brand', { length: 60 }).notNull(),
    model: varchar('model', { length: 60 }).notNull(),
    plate: varchar('plate', { length: 20 }).notNull(),
    capacity: integer('capacity').notNull(),
    photoUrl: text('photo_url'),
    status: vehicleStatus('status').notNull().default('ACTIVE'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('vehicles_driver_plate_uq').on(t.driverId, t.plate),
    check('vehicles_capacity_positive', sql`${t.capacity} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Salas y membresía
// ---------------------------------------------------------------------------

export const rooms = pgTable(
  'rooms',
  {
    id: id(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.userId, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    description: varchar('description', { length: 500 }),
    transportType: transportType('transport_type').notNull(),
    zone: varchar('zone', { length: 120 }).notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull().default('America/Tegucigalpa'),
    capacity: integer('capacity').notNull(),
    defaultVehicleId: uuid('default_vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
    /** Hora local límite para confirmar, "HH:mm". */
    confirmationDeadline: varchar('confirmation_deadline', { length: 5 }).notNull().default('20:00'),
    /** Días antes del viaje en que aplica la hora límite (1 = el día anterior). */
    deadlineOffsetDays: integer('deadline_offset_days').notNull().default(1),
    status: roomStatus('status').notNull().default('ACTIVE'),
    originLabel: varchar('origin_label', { length: 200 }),
    originLat: doublePrecision('origin_lat'),
    originLng: doublePrecision('origin_lng'),
    originLocation: geographyPoint('origin_location'),
    destinationLabel: varchar('destination_label', { length: 200 }),
    destinationLat: doublePrecision('destination_lat'),
    destinationLng: doublePrecision('destination_lng'),
    destinationLocation: geographyPoint('destination_location'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('rooms_driver_idx').on(t.driverId),
    check('rooms_capacity_positive', sql`${t.capacity} > 0`),
    check('rooms_deadline_format', sql`${t.confirmationDeadline} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
    check('rooms_deadline_offset', sql`${t.deadlineOffsetDays} BETWEEN 0 AND 7`),
  ],
);

/** Código de invitación BUS-XXXXXX. Solo uno activo por sala. */
export const roomInvitations = pgTable(
  'room_invitations',
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 12 }).notNull().unique(),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [
    index('room_invitations_room_idx').on(t.roomId),
    uniqueIndex('room_invitations_one_active_uq').on(t.roomId).where(sql`${t.active}`),
  ],
);

export const joinRequests = pgTable(
  'join_requests',
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    travelerId: uuid('traveler_id')
      .notNull()
      .references(() => travelers.userId, { onDelete: 'cascade' }),
    status: joinRequestStatus('status').notNull().default('PENDING'),
    message: varchar('message', { length: 300 }),
    decidedBy: uuid('decided_by'),
    decidedAt: ts('decided_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('join_requests_room_status_idx').on(t.roomId, t.status),
    index('join_requests_traveler_idx').on(t.travelerId),
    uniqueIndex('join_requests_one_pending_uq')
      .on(t.roomId, t.travelerId)
      .where(sql`${t.status} = 'PENDING'`),
  ],
);

export const roomMembers = pgTable(
  'room_members',
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    travelerId: uuid('traveler_id')
      .notNull()
      .references(() => travelers.userId, { onDelete: 'cascade' }),
    status: memberStatus('status').notNull().default('ACTIVE'),
    joinedAt: ts('joined_at').notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('room_members_room_traveler_uq').on(t.roomId, t.travelerId),
    index('room_members_traveler_idx').on(t.travelerId),
  ],
);

export const schedules = pgTable(
  'schedules',
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    /** 0 = domingo … 6 = sábado */
    weekday: smallint('weekday').notNull(),
    direction: direction('direction').notNull(),
    /** Hora local de salida, "HH:mm". */
    departureTime: varchar('departure_time', { length: 5 }).notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('schedules_room_day_dir_uq').on(t.roomId, t.weekday, t.direction),
    check('schedules_weekday_range', sql`${t.weekday} BETWEEN 0 AND 6`),
    check('schedules_time_format', sql`${t.departureTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  ],
);

// ---------------------------------------------------------------------------
// Direcciones y confirmaciones
// ---------------------------------------------------------------------------

export const addresses = pgTable(
  'addresses',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: varchar('label', { length: 60 }).notNull(),
    formattedAddress: varchar('formatted_address', { length: 300 }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    location: geographyPoint('location'),
    placeId: varchar('place_id', { length: 300 }),
    referenceNotes: varchar('reference_notes', { length: 300 }),
    isFrequent: boolean('is_frequent').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('addresses_user_idx').on(t.userId),
    index('addresses_location_gix').using('gist', t.location),
    check('addresses_lat_range', sql`${t.lat} BETWEEN -90 AND 90`),
    check('addresses_lng_range', sql`${t.lng} BETWEEN -180 AND 180`),
  ],
);

/** Direcciones de recogida/destino que el viajero usa en una sala concreta. */
export const roomMemberAddresses = pgTable('room_member_addresses', {
  roomMemberId: uuid('room_member_id')
    .primaryKey()
    .references(() => roomMembers.id, { onDelete: 'cascade' }),
  pickupAddressId: uuid('pickup_address_id').references(() => addresses.id, { onDelete: 'set null' }),
  dropoffAddressId: uuid('dropoff_address_id').references(() => addresses.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});

/** Una confirmación por viajero, sala, fecha y sentido: imposible duplicar. */
export const travelConfirmations = pgTable(
  'travel_confirmations',
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    travelerId: uuid('traveler_id')
      .notNull()
      .references(() => travelers.userId, { onDelete: 'cascade' }),
    serviceDate: date('service_date', { mode: 'string' }).notNull(),
    direction: direction('direction').notNull(),
    status: confirmationStatus('status').notNull(),
    source: confirmationSource('source').notNull().default('TRAVELER'),
    updatedBy: uuid('updated_by').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('travel_confirmations_uq').on(t.roomId, t.travelerId, t.serviceDate, t.direction),
    index('travel_confirmations_count_idx').on(t.roomId, t.serviceDate, t.direction, t.status),
    index('travel_confirmations_traveler_idx').on(t.travelerId, t.serviceDate),
  ],
);

/** Auditoría inmutable de cambios en confirmaciones. */
export const confirmationChanges = pgTable(
  'confirmation_changes',
  {
    id: id(),
    confirmationId: uuid('confirmation_id')
      .notNull()
      .references(() => travelConfirmations.id, { onDelete: 'cascade' }),
    oldStatus: confirmationStatus('old_status'),
    newStatus: confirmationStatus('new_status').notNull(),
    changedBy: uuid('changed_by').notNull(),
    afterDeadline: boolean('after_deadline').notNull().default(false),
    reason: varchar('reason', { length: 300 }),
    createdAt: createdAt(),
  },
  (t) => [index('confirmation_changes_conf_idx').on(t.confirmationId)],
);

/** Permiso del conductor para cambiar una confirmación después de la hora límite. */
export const deadlineExceptions = pgTable(
  'deadline_exceptions',
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    travelerId: uuid('traveler_id')
      .notNull()
      .references(() => travelers.userId, { onDelete: 'cascade' }),
    serviceDate: date('service_date', { mode: 'string' }).notNull(),
    direction: direction('direction').notNull(),
    grantedBy: uuid('granted_by').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: createdAt(),
  },
  (t) => [index('deadline_exceptions_lookup_idx').on(t.roomId, t.travelerId, t.serviceDate, t.direction)],
);

// ---------------------------------------------------------------------------
// Recorridos, rutas y asistencia
// ---------------------------------------------------------------------------

export const trips = pgTable(
  'trips',
  {
    id: id(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'restrict' }),
    serviceDate: date('service_date', { mode: 'string' }).notNull(),
    direction: direction('direction').notNull(),
    status: tripStatus('status').notNull().default('PLANNED'),
    startedAt: ts('started_at'),
    endedAt: ts('ended_at'),
    finalRouteId: uuid('final_route_id')
      .unique()
      .references((): AnyPgColumn => routes.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Permite varios vehículos para el mismo servicio (sala + fecha + sentido).
    unique('trips_room_vehicle_date_dir_uq').on(t.roomId, t.vehicleId, t.serviceDate, t.direction),
    index('trips_room_date_idx').on(t.roomId, t.serviceDate),
    index('trips_status_idx').on(t.status),
  ],
);

export const tripPassengers = pgTable(
  'trip_passengers',
  {
    id: id(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    travelerId: uuid('traveler_id')
      .notNull()
      .references(() => travelers.userId, { onDelete: 'cascade' }),
    confirmationId: uuid('confirmation_id').references(() => travelConfirmations.id, { onDelete: 'set null' }),
    pickupLat: doublePrecision('pickup_lat').notNull(),
    pickupLng: doublePrecision('pickup_lng').notNull(),
    pickupLocation: geographyPoint('pickup_location'),
    dropoffLat: doublePrecision('dropoff_lat').notNull(),
    dropoffLng: doublePrecision('dropoff_lng').notNull(),
    dropoffLocation: geographyPoint('dropoff_location'),
    createdAt: createdAt(),
  },
  (t) => [unique('trip_passengers_trip_traveler_uq').on(t.tripId, t.travelerId)],
);

/** Cada versión de la ruta de un recorrido (sugerida, editada, final). */
export const routes = pgTable(
  'routes',
  {
    id: id(),
    tripId: uuid('trip_id')
      .notNull()
      .references((): AnyPgColumn => trips.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    kind: routeKind('kind').notNull(),
    optimizer: optimizer('optimizer').notNull(),
    /** Polilínea codificada (formato de Google). */
    encodedPolyline: text('encoded_polyline'),
    distanceMeters: integer('distance_meters'),
    durationSeconds: integer('duration_seconds'),
    createdBy: uuid('created_by').notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('routes_trip_version_uq').on(t.tripId, t.version)],
);

export const routeStops = pgTable(
  'route_stops',
  {
    id: id(),
    routeId: uuid('route_id')
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull(),
    type: stopType('type').notNull(),
    label: varchar('label', { length: 200 }),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    location: geographyPoint('location'),
    plannedEta: ts('planned_eta'),
    actualArrival: ts('actual_arrival'),
  },
  (t) => [unique('route_stops_route_seq_uq').on(t.routeId, t.sequence)],
);

/** Pasajeros que suben o bajan en cada parada (una parada puede agrupar varios). */
export const routeStopPassengers = pgTable(
  'route_stop_passengers',
  {
    routeStopId: uuid('route_stop_id')
      .notNull()
      .references(() => routeStops.id, { onDelete: 'cascade' }),
    tripPassengerId: uuid('trip_passenger_id')
      .notNull()
      .references(() => tripPassengers.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.routeStopId, t.tripPassengerId] })],
);

export const attendance = pgTable('attendance', {
  id: id(),
  tripPassengerId: uuid('trip_passenger_id')
    .notNull()
    .unique()
    .references(() => tripPassengers.id, { onDelete: 'cascade' }),
  status: attendanceStatus('status').notNull().default('PENDING'),
  markedAt: ts('marked_at'),
  markedBy: uuid('marked_by'),
  updatedAt: updatedAt(),
});

export const attendanceChanges = pgTable(
  'attendance_changes',
  {
    id: id(),
    attendanceId: uuid('attendance_id')
      .notNull()
      .references(() => attendance.id, { onDelete: 'cascade' }),
    oldStatus: attendanceStatus('old_status').notNull(),
    newStatus: attendanceStatus('new_status').notNull(),
    changedBy: uuid('changed_by').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('attendance_changes_att_idx').on(t.attendanceId)],
);

// ---------------------------------------------------------------------------
// Ubicación en vivo, notificaciones e historial
// ---------------------------------------------------------------------------

/**
 * Puntos GPS crudos de recorridos activos. En la migración se convierte en
 * tabla particionada por día; las particiones de más de 30 días se eliminan.
 * La clave (trip_id, recorded_at) evita duplicados al reenviar la cola offline.
 */
export const liveLocations = pgTable(
  'live_locations',
  {
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    recordedAt: ts('recorded_at').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    location: geographyPoint('location'),
    speed: doublePrecision('speed'),
    heading: doublePrecision('heading'),
    accuracy: doublePrecision('accuracy'),
    battery: smallint('battery'),
  },
  (t) => [primaryKey({ columns: [t.tripId, t.recordedAt] })],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 60 }).notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    body: varchar('body', { length: 500 }).notNull(),
    data: jsonb('data'),
    /** Clave de deduplicación: el mismo aviso nunca se envía dos veces. */
    dedupKey: varchar('dedup_key', { length: 200 }).unique(),
    readAt: ts('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_created_idx').on(t.userId, t.createdAt.desc())],
);

/** Resumen permanente de cada recorrido finalizado. */
export const tripHistory = pgTable(
  'trip_history',
  {
    tripId: uuid('trip_id')
      .primaryKey()
      .references(() => trips.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.userId, { onDelete: 'cascade' }),
    serviceDate: date('service_date', { mode: 'string' }).notNull(),
    direction: direction('direction').notNull(),
    confirmedCount: integer('confirmed_count').notNull(),
    boardedCount: integer('boarded_count').notNull(),
    noShowCount: integer('no_show_count').notNull(),
    cancelledCount: integer('cancelled_count').notNull(),
    distanceMeters: integer('distance_meters'),
    durationSeconds: integer('duration_seconds'),
    startedAt: ts('started_at'),
    endedAt: ts('ended_at'),
    /** Trayectoria simplificada que se conserva tras borrar los puntos crudos. */
    pathSimplified: geographyLine('path_simplified'),
    createdAt: createdAt(),
  },
  (t) => [
    index('trip_history_driver_date_idx').on(t.driverId, t.serviceDate),
    index('trip_history_room_date_idx').on(t.roomId, t.serviceDate),
  ],
);
