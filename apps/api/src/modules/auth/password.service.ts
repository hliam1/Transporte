import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Reglas de contraseña compartidas por registro, cambio y restablecimiento. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN = /^(?=.*[A-Za-zÁÉÍÓÚÑáéíóúñ])(?=.*\d).+$/;
export const PASSWORD_RULE_MESSAGE = 'La contraseña debe tener al menos 8 caracteres, con letras y números';

/**
 * Hash de contraseñas con Argon2id (recomendación actual de OWASP).
 */
@Injectable()
export class PasswordService {
  /** Hash de una contraseña aleatoria, usado para igualar tiempos cuando el correo no existe. */
  private dummyHash: Promise<string> | null = null;

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  /**
   * Ejecuta una verificación falsa con el mismo costo que una real, para que
   * un atacante no pueda saber por el tiempo de respuesta si un correo existe.
   */
  async verifyDummy(plain: string): Promise<void> {
    this.dummyHash ??= this.hash('contraseña-ficticia-para-igualar-tiempos-1');
    await this.verify(await this.dummyHash, plain);
  }

  static meetsPolicy(plain: string): boolean {
    return (
      plain.length >= PASSWORD_MIN_LENGTH && plain.length <= PASSWORD_MAX_LENGTH && PASSWORD_PATTERN.test(plain)
    );
  }
}
