import { randomBytes } from 'node:crypto';

/**
 * Genera un UUID versión 7 (RFC 9562): 48 bits de marca de tiempo en
 * milisegundos + 74 bits aleatorios. Al ser ordenable por tiempo, los
 * índices de la base de datos crecen al final en vez de fragmentarse.
 */
export function uuidv7(now: number = Date.now()): string {
  const bytes = randomBytes(16);
  let ts = BigInt(now);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(ts & 0xffn);
    ts >>= 8n;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // versión 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
