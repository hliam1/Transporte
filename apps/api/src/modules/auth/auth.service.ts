import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import { uuidv7 } from '../../common/uuid';
import type { AccessTokenPayload } from '../../common/auth/jwt-auth.guard';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { DB, type Database, isUniqueViolation } from '../../database/database.module';
import { authSessions, drivers, passwordResets, travelers, userProfiles, users } from '../../database/schema';
import { MailService } from '../mail/mail.service';
import { type UserView, UsersService } from '../users/users.service';
import type { ChangePasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './dto';
import { PasswordService } from './password.service';
import { generateOpaqueToken, sha256 } from './tokens';

/** Duración del enlace para restablecer contraseña. */
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: UserView;
  accessToken: string;
  /** Segundos hasta que expira el token de acceso. */
  accessTokenExpiresIn: number;
  refreshToken: string;
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly usersService: UsersService,
    private readonly mail: MailService,
  ) {}

  // -------------------------------------------------------------------------
  // Registro e inicio de sesión
  // -------------------------------------------------------------------------

  async register(dto: RegisterDto, client: ClientInfo): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      const userId = await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ email: dto.email, passwordHash, role: dto.role })
          .returning({ id: users.id });
        await tx.insert(userProfiles).values({ userId: user.id, fullName: dto.fullName, phone: dto.phone ?? null });
        if (dto.role === 'DRIVER') {
          await tx.insert(drivers).values({ userId: user.id });
        } else {
          await tx.insert(travelers).values({ userId: user.id });
        }
        return user.id;
      });
      return this.startSession(userId, dto.role, client);
    } catch (err) {
      if (isUniqueViolation(err, 'users_email_unique')) {
        throw new ConflictException('Ya existe una cuenta con ese correo');
      }
      throw err;
    }
  }

  async login(dto: LoginDto, client: ClientInfo): Promise<AuthResult> {
    const [user] = await this.db
      .select({ id: users.id, role: users.role, status: users.status, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user) {
      await this.passwords.verifyDummy(dto.password);
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    const ok = await this.passwords.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Correo o contraseña incorrectos');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Esta cuenta está deshabilitada');

    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    return this.startSession(user.id, user.role, client);
  }

  // -------------------------------------------------------------------------
  // Sesiones (refresh tokens rotativos con detección de reutilización)
  // -------------------------------------------------------------------------

  /**
   * Cambia un refresh token por uno nuevo. Cada token sirve una sola vez.
   * Si alguien presenta un token que ya fue usado, se asume que fue robado y
   * se cierra toda la sesión (familia) para el dueño y para el atacante.
   */
  async refresh(refreshToken: string, client: ClientInfo): Promise<AuthResult> {
    const hash = sha256(refreshToken);

    const outcome = await this.db.transaction(async (tx) => {
      const [session] = await tx
        .select({
          id: authSessions.id,
          userId: authSessions.userId,
          familyId: authSessions.familyId,
          expiresAt: authSessions.expiresAt,
          rotatedAt: authSessions.rotatedAt,
          revokedAt: authSessions.revokedAt,
          role: users.role,
          status: users.status,
        })
        .from(authSessions)
        .innerJoin(users, eq(users.id, authSessions.userId))
        .where(eq(authSessions.refreshTokenHash, hash))
        .for('update', { of: authSessions })
        .limit(1);

      if (!session || session.revokedAt) return { kind: 'invalid' as const };
      if (session.rotatedAt) {
        await this.revokeFamily(tx, session.familyId);
        return { kind: 'reused' as const, userId: session.userId };
      }
      if (session.expiresAt <= new Date() || session.status !== 'ACTIVE') return { kind: 'invalid' as const };

      await tx.update(authSessions).set({ rotatedAt: new Date() }).where(eq(authSessions.id, session.id));
      const next = await this.insertSession(tx, session.userId, session.familyId, client);
      return { kind: 'ok' as const, userId: session.userId, role: session.role, familyId: session.familyId, ...next };
    });

    if (outcome.kind === 'reused') {
      this.logger.warn(`Reutilización de refresh token detectada; sesión revocada (usuario ${outcome.userId})`);
    }
    if (outcome.kind !== 'ok') throw new UnauthorizedException('Sesión expirada o inválida');

    return this.buildResult(outcome.userId, outcome.role, outcome.familyId, outcome.refreshToken);
  }

  /** Cierra la sesión actual (todas las rotaciones de ese inicio de sesión). */
  async logout(familyId: string): Promise<void> {
    await this.revokeFamily(this.db, familyId);
  }

  /** Cierra todas las sesiones del usuario en todos sus dispositivos. */
  async logoutAll(userId: string): Promise<void> {
    await this.db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  }

  // -------------------------------------------------------------------------
  // Contraseñas
  // -------------------------------------------------------------------------

  /**
   * Envía un enlace para restablecer la contraseña. Responde igual exista o
   * no el correo, para no revelar qué correos están registrados.
   */
  async forgotPassword(email: string): Promise<void> {
    const [user] = await this.db
      .select({ id: users.id, status: users.status, fullName: userProfiles.fullName })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);
    if (!user || user.status !== 'ACTIVE') return;

    const token = generateOpaqueToken(32);
    await this.db.transaction(async (tx) => {
      // Invalida enlaces anteriores sin usar: solo vale el más reciente.
      await tx
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
      await tx.insert(passwordResets).values({
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      });
    });

    const link = `${this.env.WEB_APP_URL}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
    try {
      await this.mail.send({
        to: email,
        subject: 'Restablece tu contraseña',
        text:
          `Hola ${user.fullName}:\n\nRecibimos una solicitud para restablecer tu contraseña. ` +
          `Abre este enlace (vence en 30 minutos):\n\n${link}\n\n` +
          'Si no fuiste tú, ignora este correo; tu contraseña no cambiará.',
        html:
          `<p>Hola ${escapeHtml(user.fullName)}:</p>` +
          '<p>Recibimos una solicitud para restablecer tu contraseña. El enlace vence en 30 minutos.</p>' +
          `<p><a href="${link}">Restablecer contraseña</a></p>` +
          '<p>Si no fuiste tú, ignora este correo; tu contraseña no cambiará.</p>',
      });
    } catch (err) {
      this.logger.error(`No se pudo enviar el correo de restablecimiento: ${(err as Error).message}`);
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const hash = sha256(dto.token);
    const newHash = await this.passwords.hash(dto.newPassword);

    const ok = await this.db.transaction(async (tx) => {
      const [reset] = await tx
        .select({ id: passwordResets.id, userId: passwordResets.userId })
        .from(passwordResets)
        .where(
          and(
            eq(passwordResets.tokenHash, hash),
            isNull(passwordResets.usedAt),
            gt(passwordResets.expiresAt, new Date()),
          ),
        )
        .for('update')
        .limit(1);
      if (!reset) return false;

      await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, reset.id));
      await tx.update(users).set({ passwordHash: newHash }).where(eq(users.id, reset.userId));
      // Por seguridad, se cierran todas las sesiones abiertas.
      await tx
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessions.userId, reset.userId), isNull(authSessions.revokedAt)));
      return true;
    });

    if (!ok) throw new BadRequestException('El enlace no es válido o ya venció. Solicita uno nuevo.');
  }

  /** Cambia la contraseña y cierra las demás sesiones (mantiene la actual). */
  async changePassword(userId: string, currentFamilyId: string, dto: ChangePasswordDto): Promise<void> {
    const [user] = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || !(await this.passwords.verify(user.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }
    const newHash = await this.passwords.hash(dto.newPassword);
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
      await tx
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(authSessions.userId, userId),
            ne(authSessions.familyId, currentFamilyId),
            isNull(authSessions.revokedAt),
          ),
        );
    });
  }

  // -------------------------------------------------------------------------
  // Internos
  // -------------------------------------------------------------------------

  private async startSession(userId: string, role: AuthResult['user']['role'], client: ClientInfo) {
    const familyId = uuidv7();
    const { refreshToken } = await this.insertSession(this.db, userId, familyId, client);
    return this.buildResult(userId, role, familyId, refreshToken);
  }

  private async insertSession(db: Database | Tx, userId: string, familyId: string, client: ClientInfo) {
    const refreshToken = generateOpaqueToken();
    await db.insert(authSessions).values({
      userId,
      familyId,
      refreshTokenHash: sha256(refreshToken),
      deviceInfo: client.userAgent?.slice(0, 200) ?? null,
      ip: client.ip?.slice(0, 64) ?? null,
      expiresAt: new Date(Date.now() + this.env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    });
    return { refreshToken };
  }

  private async buildResult(
    userId: string,
    role: AuthResult['user']['role'],
    familyId: string,
    refreshToken: string,
  ): Promise<AuthResult> {
    const payload: AccessTokenPayload = { sub: userId, role, sid: familyId };
    const accessToken = await this.jwt.signAsync(payload);
    const user = await this.usersService.getView(userId);
    return { user, accessToken, accessTokenExpiresIn: this.env.JWT_ACCESS_TTL_SECONDS, refreshToken };
  }

  private async revokeFamily(db: Database | Tx, familyId: string): Promise<void> {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.familyId, familyId), isNull(authSessions.revokedAt)));
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
