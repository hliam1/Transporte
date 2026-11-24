import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, type FakeMailService, registerUser, uniqueEmail } from './helpers';

describe('Autenticación y cuenta (e2e)', () => {
  let app: INestApplication;
  let mail: FakeMailService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, mail } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------------------
  describe('Registro', () => {
    it('registra un viajero, normaliza el correo y no devuelve el hash', async () => {
      const email = uniqueEmail('Viajero').toUpperCase();
      const res = await http()
        .post('/v1/auth/register')
        .send({ email, password: 'Segura2026', fullName: '  Ana López ', role: 'TRAVELER', phone: '+504 9999-9999' })
        .expect(201);

      expect(res.body.user).toMatchObject({
        email: email.toLowerCase(),
        role: 'TRAVELER',
        fullName: 'Ana López',
        phone: '+504 9999-9999',
        timezone: 'America/Tegucigalpa',
      });
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
      expect(JSON.stringify(res.body)).not.toContain('argon2');
    });

    it('registra un conductor', async () => {
      const u = await registerUser(app, { role: 'DRIVER' });
      expect(u.user.role).toBe('DRIVER');
    });

    it('rechaza un correo ya registrado (sin importar mayúsculas)', async () => {
      const u = await registerUser(app);
      const res = await http()
        .post('/v1/auth/register')
        .send({ email: u.email.toUpperCase(), password: 'Otra2026x', fullName: 'Otra', role: 'DRIVER' })
        .expect(409);
      expect(res.body.message).toBe('Ya existe una cuenta con ese correo');
    });

    it.each([
      ['corta', 'Ab1'],
      ['sin números', 'SoloLetras'],
      ['sin letras', '12345678'],
    ])('rechaza una contraseña débil (%s)', async (_caso, password) => {
      const res = await http()
        .post('/v1/auth/register')
        .send({ email: uniqueEmail(), password, fullName: 'Ana', role: 'TRAVELER' })
        .expect(400);
      expect(res.body.message).toContain('La contraseña debe tener al menos 8 caracteres, con letras y números');
    });

    it('rechaza un rol inválido y campos extra (no se puede inyectar "role: ADMIN" ni "status")', async () => {
      const res = await http()
        .post('/v1/auth/register')
        .send({ email: uniqueEmail(), password: 'Segura2026', fullName: 'Ana', role: 'ADMIN', status: 'ACTIVE' })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining(['Elige si eres viajero o conductor', 'Campo no permitido: status']),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('Inicio de sesión', () => {
    it('inicia sesión con correo en cualquier capitalización', async () => {
      const u = await registerUser(app);
      const res = await http()
        .post('/v1/auth/login')
        .send({ email: `  ${u.email.toUpperCase()} `, password: u.password })
        .expect(200);
      expect(res.body.user.id).toBe(u.user.id);
    });

    it('da el mismo error para contraseña incorrecta y correo inexistente (no revela cuentas)', async () => {
      const u = await registerUser(app);
      const wrongPass = await http().post('/v1/auth/login').send({ email: u.email, password: 'Incorrecta1' }).expect(401);
      const noUser = await http()
        .post('/v1/auth/login')
        .send({ email: uniqueEmail('nadie'), password: 'Incorrecta1' })
        .expect(401);
      expect(wrongPass.body.message).toBe('Correo o contraseña incorrectos');
      expect(noUser.body.message).toBe(wrongPass.body.message);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Rutas protegidas y roles', () => {
    it('exige sesión para /me', async () => {
      await http().get('/v1/me').expect(401);
      await http().get('/v1/me').set('Authorization', 'Bearer token-falso').expect(401);
    });

    it('devuelve el perfil del usuario autenticado', async () => {
      const u = await registerUser(app, { fullName: 'Carlos Mejía' });
      const res = await http().get('/v1/me').set('Authorization', `Bearer ${u.accessToken}`).expect(200);
      expect(res.body).toMatchObject({ id: u.user.id, fullName: 'Carlos Mejía', email: u.email });
    });

    it('un viajero no puede entrar a rutas de conductor y viceversa', async () => {
      const viajero = await registerUser(app, { role: 'TRAVELER' });
      const conductor = await registerUser(app, { role: 'DRIVER' });

      const denied = await http()
        .get('/v1/probe/driver-only')
        .set('Authorization', `Bearer ${viajero.accessToken}`)
        .expect(403);
      expect(denied.body.message).toBe('No tienes permiso para realizar esta acción');
      await http().get('/v1/probe/driver-only').set('Authorization', `Bearer ${conductor.accessToken}`).expect(200);
      await http().get('/v1/probe/traveler-only').set('Authorization', `Bearer ${conductor.accessToken}`).expect(403);
      await http().get('/v1/probe/traveler-only').set('Authorization', `Bearer ${viajero.accessToken}`).expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Perfil', () => {
    it('edita nombre, teléfono y zona horaria', async () => {
      const u = await registerUser(app);
      const res = await http()
        .patch('/v1/me')
        .set('Authorization', `Bearer ${u.accessToken}`)
        .send({ fullName: 'Nombre Nuevo', phone: '9999-0000', timezone: 'America/Guatemala' })
        .expect(200);
      expect(res.body).toMatchObject({ fullName: 'Nombre Nuevo', phone: '9999-0000', timezone: 'America/Guatemala' });

      const cleared = await http()
        .patch('/v1/me')
        .set('Authorization', `Bearer ${u.accessToken}`)
        .send({ phone: '' })
        .expect(200);
      expect(cleared.body.phone).toBeNull();
    });

    it('rechaza zona horaria inválida y no permite cambiar el rol ni el correo', async () => {
      const u = await registerUser(app);
      const res = await http()
        .patch('/v1/me')
        .set('Authorization', `Bearer ${u.accessToken}`)
        .send({ timezone: 'Marte/Base', role: 'DRIVER', email: 'otro@x.com' })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining(['Zona horaria inválida', 'Campo no permitido: role', 'Campo no permitido: email']),
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe('Sesiones (refresh rotativo)', () => {
    it('rota el refresh token: el nuevo funciona y el viejo ya no', async () => {
      const u = await registerUser(app);
      const r1 = await http().post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);
      expect(r1.body.refreshToken).not.toBe(u.refreshToken);
      await http().get('/v1/me').set('Authorization', `Bearer ${r1.body.accessToken}`).expect(200);

      const r2 = await http().post('/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(200);
      expect(r2.body.user.id).toBe(u.user.id);
    });

    it('si se reutiliza un token viejo (posible robo), cierra toda la sesión', async () => {
      const u = await registerUser(app);
      const r1 = await http().post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(200);

      // Alguien usa el token original otra vez.
      await http().post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);

      // El token legítimo más reciente y su token de acceso también quedan revocados.
      await http().post('/v1/auth/refresh').send({ refreshToken: r1.body.refreshToken }).expect(401);
      await http().get('/v1/me').set('Authorization', `Bearer ${r1.body.accessToken}`).expect(401);
    });

    it('rechaza tokens inventados', async () => {
      await http().post('/v1/auth/refresh').send({ refreshToken: 'x'.repeat(64) }).expect(401);
    });

    it('cerrar sesión invalida al instante el token de acceso y el refresh', async () => {
      const u = await registerUser(app);
      await http().post('/v1/auth/logout').set('Authorization', `Bearer ${u.accessToken}`).expect(204);
      await http().get('/v1/me').set('Authorization', `Bearer ${u.accessToken}`).expect(401);
      await http().post('/v1/auth/refresh').send({ refreshToken: u.refreshToken }).expect(401);
    });

    it('cerrar sesión en una app no cierra la sesión en otro dispositivo', async () => {
      const u = await registerUser(app);
      const otro = await http().post('/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);
      await http().post('/v1/auth/logout').set('Authorization', `Bearer ${u.accessToken}`).expect(204);
      await http().get('/v1/me').set('Authorization', `Bearer ${otro.body.accessToken}`).expect(200);
    });

    it('cerrar sesión en todos los dispositivos', async () => {
      const u = await registerUser(app);
      const otro = await http().post('/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);
      await http().post('/v1/auth/logout-all').set('Authorization', `Bearer ${u.accessToken}`).expect(204);
      await http().get('/v1/me').set('Authorization', `Bearer ${otro.body.accessToken}`).expect(401);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Cambio de contraseña', () => {
    it('exige la contraseña actual', async () => {
      const u = await registerUser(app);
      const res = await http()
        .post('/v1/me/password')
        .set('Authorization', `Bearer ${u.accessToken}`)
        .send({ currentPassword: 'Incorrecta9', newPassword: 'NuevaClave2027' })
        .expect(400);
      expect(res.body.message).toBe('La contraseña actual no es correcta');
    });

    it('cambia la contraseña, mantiene esta sesión y cierra las demás', async () => {
      const u = await registerUser(app);
      const otro = await http().post('/v1/auth/login').send({ email: u.email, password: u.password }).expect(200);

      await http()
        .post('/v1/me/password')
        .set('Authorization', `Bearer ${u.accessToken}`)
        .send({ currentPassword: u.password, newPassword: 'NuevaClave2027' })
        .expect(204);

      await http().get('/v1/me').set('Authorization', `Bearer ${u.accessToken}`).expect(200);
      await http().get('/v1/me').set('Authorization', `Bearer ${otro.body.accessToken}`).expect(401);
      await http().post('/v1/auth/login').send({ email: u.email, password: u.password }).expect(401);
      await http().post('/v1/auth/login').send({ email: u.email, password: 'NuevaClave2027' }).expect(200);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Recuperación de contraseña', () => {
    const tokenFrom = (text: string) => decodeURIComponent(/token=([^\s&]+)/.exec(text)![1]);

    it('responde igual exista o no el correo', async () => {
      const u = await registerUser(app);
      const a = await http().post('/v1/auth/forgot-password').send({ email: u.email }).expect(202);
      const b = await http().post('/v1/auth/forgot-password').send({ email: uniqueEmail('nadie') }).expect(202);
      expect(a.body).toEqual(b.body);
    });

    it('restablece con el enlace, cierra las sesiones y el enlace no se puede reutilizar', async () => {
      const u = await registerUser(app);
      await http().post('/v1/auth/forgot-password').send({ email: u.email }).expect(202);
      const correo = mail.lastTo(u.email);
      expect(correo?.subject).toBe('Restablece tu contraseña');
      expect(correo?.text).toContain('http://localhost:3001/restablecer-contrasena?token=');
      const token = tokenFrom(correo!.text);

      await http().post('/v1/auth/reset-password').send({ token, newPassword: 'Recuperada2026' }).expect(204);

      await http().get('/v1/me').set('Authorization', `Bearer ${u.accessToken}`).expect(401);
      await http().post('/v1/auth/login').send({ email: u.email, password: 'Recuperada2026' }).expect(200);

      const again = await http().post('/v1/auth/reset-password').send({ token, newPassword: 'OtraVez2026' }).expect(400);
      expect(again.body.message).toBe('El enlace no es válido o ya venció. Solicita uno nuevo.');
    });

    it('solo vale el enlace más reciente', async () => {
      const u = await registerUser(app);
      await http().post('/v1/auth/forgot-password').send({ email: u.email }).expect(202);
      const primero = tokenFrom(mail.lastTo(u.email)!.text);
      await http().post('/v1/auth/forgot-password').send({ email: u.email }).expect(202);
      const segundo = tokenFrom(mail.lastTo(u.email)!.text);

      await http().post('/v1/auth/reset-password').send({ token: primero, newPassword: 'Nueva2026a' }).expect(400);
      await http().post('/v1/auth/reset-password').send({ token: segundo, newPassword: 'Nueva2026a' }).expect(204);
    });
  });

  // ---------------------------------------------------------------------------
  it('health responde sin sesión', async () => {
    await http().get('/v1/health').expect(200, { status: 'ok', database: 'ok' });
  });
});
