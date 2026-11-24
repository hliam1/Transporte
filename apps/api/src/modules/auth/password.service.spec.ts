import { PasswordService } from './password.service';
import { generateOpaqueToken, sha256 } from './tokens';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('genera hashes Argon2id distintos para la misma contraseña y los verifica', async () => {
    const a = await service.hash('Segura2026');
    const b = await service.hash('Segura2026');
    expect(a).toMatch(/^\$argon2id\$/);
    expect(a).not.toBe(b);
    await expect(service.verify(a, 'Segura2026')).resolves.toBe(true);
    await expect(service.verify(a, 'segura2026')).resolves.toBe(false);
  });

  it('devuelve false (no lanza) con un hash corrupto', async () => {
    await expect(service.verify('no-es-un-hash', 'x')).resolves.toBe(false);
  });

  it.each([
    ['Segura2026', true],
    ['contraseña1', true],
    ['Ab1', false],
    ['SoloLetras', false],
    ['12345678', false],
    ['a1' + 'x'.repeat(127), false],
  ])('política de contraseña: %s → %s', (pwd, expected) => {
    expect(PasswordService.meetsPolicy(pwd)).toBe(expected);
  });
});

describe('tokens', () => {
  it('genera tokens opacos aleatorios en base64url', () => {
    const t = generateOpaqueToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(generateOpaqueToken()).not.toBe(t);
  });

  it('sha256 da 64 caracteres hexadecimales', () => {
    expect(sha256('hola')).toBe('b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79');
  });
});
