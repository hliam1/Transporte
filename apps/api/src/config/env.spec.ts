import { loadEnv } from './env';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
};

describe('loadEnv', () => {
  it('aplica valores por defecto', () => {
    const env = loadEnv(base);
    expect(env).toMatchObject({
      PORT: 3000,
      JWT_ACCESS_TTL_SECONDS: 900,
      REFRESH_TTL_DAYS: 30,
      MAIL_PROVIDER: 'console',
      THROTTLE_ENABLED: true,
    });
  });

  it('no arranca con un secreto JWT corto', () => {
    expect(() => loadEnv({ ...base, JWT_ACCESS_SECRET: 'corto' })).toThrow(/al menos 32 caracteres/);
  });

  it('no arranca sin DATABASE_URL', () => {
    expect(() => loadEnv({ JWT_ACCESS_SECRET: base.JWT_ACCESS_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('exige la clave de Resend si se elige ese proveedor', () => {
    expect(() => loadEnv({ ...base, MAIL_PROVIDER: 'resend' })).toThrow(/RESEND_API_KEY/);
  });

  it('interpreta THROTTLE_ENABLED=false', () => {
    expect(loadEnv({ ...base, THROTTLE_ENABLED: 'false' }).THROTTLE_ENABLED).toBe(false);
  });
});
