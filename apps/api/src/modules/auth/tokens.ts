import { createHash, randomBytes } from 'node:crypto';

/** Token aleatorio opaco en base64url (refresh tokens y enlaces de restablecimiento). */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 en hexadecimal (64 caracteres). En la BD solo se guarda este hash. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
