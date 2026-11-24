import { pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['TRAVELER', 'DRIVER']);
export const userStatus = pgEnum('user_status', ['ACTIVE', 'DISABLED']);
export const devicePlatform = pgEnum('device_platform', ['ANDROID', 'WEB']);
export const transportType = pgEnum('transport_type', [
  'URBAN',
  'INTERCITY',
  'UNIVERSITY',
  'CORPORATE',
  'RECURRING',
  'CUSTOM',
]);
export const roomStatus = pgEnum('room_status', ['ACTIVE', 'SUSPENDED', 'ARCHIVED']);
export const joinRequestStatus = pgEnum('join_request_status', ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
export const memberStatus = pgEnum('member_status', ['ACTIVE', 'SUSPENDED', 'REMOVED']);
/** OUTBOUND = ida, RETURN = regreso */
export const direction = pgEnum('direction', ['OUTBOUND', 'RETURN']);
export const confirmationStatus = pgEnum('confirmation_status', ['YES', 'NO']);
export const confirmationSource = pgEnum('confirmation_source', ['TRAVELER', 'DRIVER_EXCEPTION']);
export const vehicleStatus = pgEnum('vehicle_status', ['ACTIVE', 'MAINTENANCE', 'INACTIVE']);
export const tripStatus = pgEnum('trip_status', ['PLANNED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const routeKind = pgEnum('route_kind', ['SUGGESTED', 'EDITED', 'FINAL']);
export const optimizer = pgEnum('optimizer', ['GOOGLE_ROUTE_OPTIMIZATION', 'FALLBACK', 'MANUAL']);
export const stopType = pgEnum('stop_type', ['PICKUP', 'DROPOFF', 'WAYPOINT']);
export const attendanceStatus = pgEnum('attendance_status', ['PENDING', 'BOARDED', 'NO_SHOW', 'CANCELLED']);

export type UserRole = (typeof userRole.enumValues)[number];
export type Direction = (typeof direction.enumValues)[number];
