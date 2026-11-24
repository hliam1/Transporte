CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('PENDING', 'BOARDED', 'NO_SHOW', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."confirmation_source" AS ENUM('TRAVELER', 'DRIVER_EXCEPTION');--> statement-breakpoint
CREATE TYPE "public"."confirmation_status" AS ENUM('YES', 'NO');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ANDROID', 'WEB');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('OUTBOUND', 'RETURN');--> statement-breakpoint
CREATE TYPE "public"."join_request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('ACTIVE', 'SUSPENDED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."optimizer" AS ENUM('GOOGLE_ROUTE_OPTIMIZATION', 'FALLBACK', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('ACTIVE', 'SUSPENDED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."route_kind" AS ENUM('SUGGESTED', 'EDITED', 'FINAL');--> statement-breakpoint
CREATE TYPE "public"."stop_type" AS ENUM('PICKUP', 'DROPOFF', 'WAYPOINT');--> statement-breakpoint
CREATE TYPE "public"."transport_type" AS ENUM('URBAN', 'INTERCITY', 'UNIVERSITY', 'CORPORATE', 'RECURRING', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('PLANNED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('TRAVELER', 'DRIVER');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'DISABLED');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('ACTIVE', 'MAINTENANCE', 'INACTIVE');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" varchar(60) NOT NULL,
	"formatted_address" varchar(300) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"location" geography(Point,4326),
	"place_id" varchar(300),
	"reference_notes" varchar(300),
	"is_frequent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "addresses_lat_range" CHECK ("addresses"."lat" BETWEEN -90 AND 90),
	CONSTRAINT "addresses_lng_range" CHECK ("addresses"."lng" BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_passenger_id" uuid NOT NULL,
	"status" "attendance_status" DEFAULT 'PENDING' NOT NULL,
	"marked_at" timestamp (3) with time zone,
	"marked_by" uuid,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_trip_passenger_id_unique" UNIQUE("trip_passenger_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attendance_id" uuid NOT NULL,
	"old_status" "attendance_status" NOT NULL,
	"new_status" "attendance_status" NOT NULL,
	"changed_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"refresh_token_hash" char(64) NOT NULL,
	"device_info" varchar(200),
	"ip" varchar(64),
	"expires_at" timestamp (3) with time zone NOT NULL,
	"rotated_at" timestamp (3) with time zone,
	"revoked_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_refresh_token_hash_unique" UNIQUE("refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "confirmation_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"confirmation_id" uuid NOT NULL,
	"old_status" "confirmation_status",
	"new_status" "confirmation_status" NOT NULL,
	"changed_by" uuid NOT NULL,
	"after_deadline" boolean DEFAULT false NOT NULL,
	"reason" varchar(300),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadline_exceptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"traveler_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"direction" "direction" NOT NULL,
	"granted_by" uuid NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"used_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "device_platform" NOT NULL,
	"endpoint" text NOT NULL,
	"subscription" jsonb,
	"last_seen_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_tokens_user_endpoint_uq" UNIQUE("user_id","endpoint")
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"license_number" varchar(40),
	"default_vehicle_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "join_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"traveler_id" uuid NOT NULL,
	"status" "join_request_status" DEFAULT 'PENDING' NOT NULL,
	"message" varchar(300),
	"decided_by" uuid,
	"decided_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_locations" (
	"trip_id" uuid NOT NULL,
	"recorded_at" timestamp (3) with time zone NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"location" geography(Point,4326),
	"speed" double precision,
	"heading" double precision,
	"accuracy" double precision,
	"battery" smallint,
	CONSTRAINT "live_locations_trip_id_recorded_at_pk" PRIMARY KEY("trip_id","recorded_at")
) PARTITION BY RANGE ("recorded_at");
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(60) NOT NULL,
	"title" varchar(120) NOT NULL,
	"body" varchar(500) NOT NULL,
	"data" jsonb,
	"dedup_key" varchar(200),
	"read_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedup_key_unique" UNIQUE("dedup_key")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" char(64) NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"used_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_resets_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "room_invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"code" varchar(12) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp (3) with time zone,
	CONSTRAINT "room_invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "room_member_addresses" (
	"room_member_id" uuid PRIMARY KEY NOT NULL,
	"pickup_address_id" uuid,
	"dropoff_address_id" uuid,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"traveler_id" uuid NOT NULL,
	"status" "member_status" DEFAULT 'ACTIVE' NOT NULL,
	"joined_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_members_room_traveler_uq" UNIQUE("room_id","traveler_id")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"driver_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(500),
	"transport_type" "transport_type" NOT NULL,
	"zone" varchar(120) NOT NULL,
	"timezone" varchar(64) DEFAULT 'America/Tegucigalpa' NOT NULL,
	"capacity" integer NOT NULL,
	"default_vehicle_id" uuid,
	"confirmation_deadline" varchar(5) DEFAULT '20:00' NOT NULL,
	"deadline_offset_days" integer DEFAULT 1 NOT NULL,
	"status" "room_status" DEFAULT 'ACTIVE' NOT NULL,
	"origin_label" varchar(200),
	"origin_lat" double precision,
	"origin_lng" double precision,
	"origin_location" geography(Point,4326),
	"destination_label" varchar(200),
	"destination_lat" double precision,
	"destination_lng" double precision,
	"destination_location" geography(Point,4326),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_capacity_positive" CHECK ("rooms"."capacity" > 0),
	CONSTRAINT "rooms_deadline_format" CHECK ("rooms"."confirmation_deadline" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "rooms_deadline_offset" CHECK ("rooms"."deadline_offset_days" BETWEEN 0 AND 7)
);
--> statement-breakpoint
CREATE TABLE "route_stop_passengers" (
	"route_stop_id" uuid NOT NULL,
	"trip_passenger_id" uuid NOT NULL,
	CONSTRAINT "route_stop_passengers_route_stop_id_trip_passenger_id_pk" PRIMARY KEY("route_stop_id","trip_passenger_id")
);
--> statement-breakpoint
CREATE TABLE "route_stops" (
	"id" uuid PRIMARY KEY NOT NULL,
	"route_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" "stop_type" NOT NULL,
	"label" varchar(200),
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"location" geography(Point,4326),
	"planned_eta" timestamp (3) with time zone,
	"actual_arrival" timestamp (3) with time zone,
	CONSTRAINT "route_stops_route_seq_uq" UNIQUE("route_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"kind" "route_kind" NOT NULL,
	"optimizer" "optimizer" NOT NULL,
	"encoded_polyline" text,
	"distance_meters" integer,
	"duration_seconds" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routes_trip_version_uq" UNIQUE("trip_id","version")
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"direction" "direction" NOT NULL,
	"departure_time" varchar(5) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_room_day_dir_uq" UNIQUE("room_id","weekday","direction"),
	CONSTRAINT "schedules_weekday_range" CHECK ("schedules"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "schedules_time_format" CHECK ("schedules"."departure_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "travel_confirmations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"traveler_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"direction" "direction" NOT NULL,
	"status" "confirmation_status" NOT NULL,
	"source" "confirmation_source" DEFAULT 'TRAVELER' NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "travel_confirmations_uq" UNIQUE("room_id","traveler_id","service_date","direction")
);
--> statement-breakpoint
CREATE TABLE "travelers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"emergency_contact" varchar(120),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_history" (
	"trip_id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"direction" "direction" NOT NULL,
	"confirmed_count" integer NOT NULL,
	"boarded_count" integer NOT NULL,
	"no_show_count" integer NOT NULL,
	"cancelled_count" integer NOT NULL,
	"distance_meters" integer,
	"duration_seconds" integer,
	"started_at" timestamp (3) with time zone,
	"ended_at" timestamp (3) with time zone,
	"path_simplified" geography(LineString,4326),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_passengers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trip_id" uuid NOT NULL,
	"traveler_id" uuid NOT NULL,
	"confirmation_id" uuid,
	"pickup_lat" double precision NOT NULL,
	"pickup_lng" double precision NOT NULL,
	"pickup_location" geography(Point,4326),
	"dropoff_lat" double precision NOT NULL,
	"dropoff_lng" double precision NOT NULL,
	"dropoff_location" geography(Point,4326),
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trip_passengers_trip_traveler_uq" UNIQUE("trip_id","traveler_id")
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"direction" "direction" NOT NULL,
	"status" "trip_status" DEFAULT 'PLANNED' NOT NULL,
	"started_at" timestamp (3) with time zone,
	"ended_at" timestamp (3) with time zone,
	"final_route_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_final_route_id_unique" UNIQUE("final_route_id"),
	CONSTRAINT "trips_room_vehicle_date_dir_uq" UNIQUE("room_id","vehicle_id","service_date","direction")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"phone" varchar(30),
	"photo_url" text,
	"timezone" varchar(64) DEFAULT 'America/Tegucigalpa' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"email_verified_at" timestamp (3) with time zone,
	"last_login_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email"))
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"driver_id" uuid NOT NULL,
	"identifier" varchar(40) NOT NULL,
	"brand" varchar(60) NOT NULL,
	"model" varchar(60) NOT NULL,
	"plate" varchar(20) NOT NULL,
	"capacity" integer NOT NULL,
	"photo_url" text,
	"status" "vehicle_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_driver_plate_uq" UNIQUE("driver_id","plate"),
	CONSTRAINT "vehicles_capacity_positive" CHECK ("vehicles"."capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_trip_passenger_id_trip_passengers_id_fk" FOREIGN KEY ("trip_passenger_id") REFERENCES "public"."trip_passengers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_changes" ADD CONSTRAINT "attendance_changes_attendance_id_attendance_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirmation_changes" ADD CONSTRAINT "confirmation_changes_confirmation_id_travel_confirmations_id_fk" FOREIGN KEY ("confirmation_id") REFERENCES "public"."travel_confirmations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_exceptions" ADD CONSTRAINT "deadline_exceptions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadline_exceptions" ADD CONSTRAINT "deadline_exceptions_traveler_id_travelers_user_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_default_vehicle_id_vehicles_id_fk" FOREIGN KEY ("default_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_traveler_id_travelers_user_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_locations" ADD CONSTRAINT "live_locations_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_invitations" ADD CONSTRAINT "room_invitations_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_member_addresses" ADD CONSTRAINT "room_member_addresses_room_member_id_room_members_id_fk" FOREIGN KEY ("room_member_id") REFERENCES "public"."room_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_member_addresses" ADD CONSTRAINT "room_member_addresses_pickup_address_id_addresses_id_fk" FOREIGN KEY ("pickup_address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_member_addresses" ADD CONSTRAINT "room_member_addresses_dropoff_address_id_addresses_id_fk" FOREIGN KEY ("dropoff_address_id") REFERENCES "public"."addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_traveler_id_travelers_user_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_driver_id_drivers_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_default_vehicle_id_vehicles_id_fk" FOREIGN KEY ("default_vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stop_passengers" ADD CONSTRAINT "route_stop_passengers_route_stop_id_route_stops_id_fk" FOREIGN KEY ("route_stop_id") REFERENCES "public"."route_stops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stop_passengers" ADD CONSTRAINT "route_stop_passengers_trip_passenger_id_trip_passengers_id_fk" FOREIGN KEY ("trip_passenger_id") REFERENCES "public"."trip_passengers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_confirmations" ADD CONSTRAINT "travel_confirmations_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_confirmations" ADD CONSTRAINT "travel_confirmations_traveler_id_travelers_user_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travelers" ADD CONSTRAINT "travelers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_history" ADD CONSTRAINT "trip_history_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_history" ADD CONSTRAINT "trip_history_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_history" ADD CONSTRAINT "trip_history_driver_id_drivers_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_passengers" ADD CONSTRAINT "trip_passengers_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_passengers" ADD CONSTRAINT "trip_passengers_traveler_id_travelers_user_id_fk" FOREIGN KEY ("traveler_id") REFERENCES "public"."travelers"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_passengers" ADD CONSTRAINT "trip_passengers_confirmation_id_travel_confirmations_id_fk" FOREIGN KEY ("confirmation_id") REFERENCES "public"."travel_confirmations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_final_route_id_routes_id_fk" FOREIGN KEY ("final_route_id") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_drivers_user_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "addresses_location_gix" ON "addresses" USING gist ("location");--> statement-breakpoint
CREATE INDEX "attendance_changes_att_idx" ON "attendance_changes" USING btree ("attendance_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_family_idx" ON "auth_sessions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "confirmation_changes_conf_idx" ON "confirmation_changes" USING btree ("confirmation_id");--> statement-breakpoint
CREATE INDEX "deadline_exceptions_lookup_idx" ON "deadline_exceptions" USING btree ("room_id","traveler_id","service_date","direction");--> statement-breakpoint
CREATE INDEX "join_requests_room_status_idx" ON "join_requests" USING btree ("room_id","status");--> statement-breakpoint
CREATE INDEX "join_requests_traveler_idx" ON "join_requests" USING btree ("traveler_id");--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_one_pending_uq" ON "join_requests" USING btree ("room_id","traveler_id") WHERE "join_requests"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "password_resets_user_idx" ON "password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "room_invitations_room_idx" ON "room_invitations" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_invitations_one_active_uq" ON "room_invitations" USING btree ("room_id") WHERE "room_invitations"."active";--> statement-breakpoint
CREATE INDEX "room_members_traveler_idx" ON "room_members" USING btree ("traveler_id");--> statement-breakpoint
CREATE INDEX "rooms_driver_idx" ON "rooms" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "travel_confirmations_count_idx" ON "travel_confirmations" USING btree ("room_id","service_date","direction","status");--> statement-breakpoint
CREATE INDEX "travel_confirmations_traveler_idx" ON "travel_confirmations" USING btree ("traveler_id","service_date");--> statement-breakpoint
CREATE INDEX "trip_history_driver_date_idx" ON "trip_history" USING btree ("driver_id","service_date");--> statement-breakpoint
CREATE INDEX "trip_history_room_date_idx" ON "trip_history" USING btree ("room_id","service_date");--> statement-breakpoint
CREATE INDEX "trips_room_date_idx" ON "trips" USING btree ("room_id","service_date");--> statement-breakpoint
CREATE INDEX "trips_status_idx" ON "trips" USING btree ("status");