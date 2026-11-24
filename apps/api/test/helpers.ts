import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Roles } from '../src/common/auth/decorators';
import { configureApp } from '../src/app.setup';
import { type MailMessage, MailService } from '../src/modules/mail/mail.service';

/** Rutas solo para pruebas: verifican que @Roles() funcione de punta a punta. */
@Controller('probe')
export class RoleProbeController {
  @Roles('DRIVER')
  @Get('driver-only')
  driverOnly() {
    return { ok: true };
  }

  @Roles('TRAVELER')
  @Get('traveler-only')
  travelerOnly() {
    return { ok: true };
  }
}

/** Servicio de correo falso: guarda los correos para inspeccionarlos. */
export class FakeMailService extends MailService {
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
  lastTo(email: string): MailMessage | undefined {
    return [...this.sent].reverse().find((m) => m.to === email);
  }
}

export async function createTestApp(): Promise<{ app: INestApplication; mail: FakeMailService }> {
  const mail = new FakeMailService();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers: [RoleProbeController] })
    .overrideProvider(MailService)
    .useValue(mail)
    .compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();
  return { app, mail };
}

let counter = 0;
/** Correo único por prueba para que no choquen entre sí. */
export function uniqueEmail(prefix = 'usuario'): string {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}@prueba.hn`;
}

export async function registerUser(
  app: INestApplication,
  overrides: Partial<{ email: string; password: string; fullName: string; role: 'TRAVELER' | 'DRIVER' }> = {},
) {
  const body = {
    email: overrides.email ?? uniqueEmail(),
    password: overrides.password ?? 'Segura2026',
    fullName: overrides.fullName ?? 'Persona de Prueba',
    role: overrides.role ?? 'TRAVELER',
  };
  const res = await request(app.getHttpServer()).post('/v1/auth/register').send(body).expect(201);
  return { ...body, ...res.body } as typeof body & {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; role: string };
  };
}
