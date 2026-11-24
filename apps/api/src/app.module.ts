import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { ConfigModule, ENV } from './config/config.module';
import type { Env } from './config/env';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    MailModule,
    // Límite general: 120 peticiones por minuto por IP. Las rutas de
    // autenticación tienen límites más estrictos (ver AuthController).
    // TODO(Fase 7): usar almacenamiento en Redis al tener varias instancias.
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        throttlers: [{ name: 'default', limit: 120, ttl: 60_000 }],
        skipIf: () => !env.THROTTLE_ENABLED,
      }),
    }),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    // Orden: límite de peticiones → autenticación → roles.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
