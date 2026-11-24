/**
 * Variables de entorno validadas al arrancar. Si falta algo o es inválido,
 * la API no inicia (mejor fallar temprano que en producción).
 */
import { z } from 'zod';

const bool = (def: 'true' | 'false') =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(def)
    .transform((v) => v === 'true' || v === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),

  /** Secreto para firmar los tokens de acceso. Mínimo 32 caracteres. */
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  /** Duración del token de acceso en segundos (15 min por defecto). */
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  /** Duración de la sesión (refresh token) en días. */
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** Orígenes permitidos para CORS, separados por coma. */
  CORS_ORIGINS: z.string().default('http://localhost:3001'),
  /** URL pública de la PWA (para enlaces en correos). */
  WEB_APP_URL: z.string().url().default('http://localhost:3001'),

  MAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  MAIL_FROM: z.string().default('Transporte <no-responder@example.com>'),
  RESEND_API_KEY: z.string().optional(),

  /** Límite de peticiones por IP (se puede desactivar en pruebas). */
  THROTTLE_ENABLED: bool('true'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${issues}`);
  }
  const env = parsed.data;
  if (env.MAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
    throw new Error('Configuración inválida:\n  - RESEND_API_KEY es obligatoria cuando MAIL_PROVIDER=resend');
  }
  return env;
}
