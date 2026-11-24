import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueEmail } from './helpers';

describe('Límite de intentos (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.THROTTLE_ENABLED = 'true';
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    process.env.THROTTLE_ENABLED = 'false';
    await app.close();
  });

  it('bloquea el inicio de sesión tras 10 intentos por minuto desde la misma IP', async () => {
    const email = uniqueEmail('fuerza-bruta');
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password: `Intento${i}` }).expect(401);
    }
    await request(app.getHttpServer()).post('/v1/auth/login').send({ email, password: 'Intento11' }).expect(429);
  });
});
