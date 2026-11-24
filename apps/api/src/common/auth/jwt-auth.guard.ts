import { type CanActivate, type ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { DB, type Database } from '../../database/database.module';
import { authSessions, users } from '../../database/schema';
import { type AuthUser, IS_PUBLIC_KEY } from './decorators';

export interface AccessTokenPayload {
  sub: string;
  role: AuthUser['role'];
  sid: string;
}

/**
 * Guard global. Exige un token de acceso válido salvo en rutas @Public().
 *
 * Además de verificar la firma, comprueba en la base de datos que la sesión
 * siga activa y que el usuario no esté deshabilitado. Así, cerrar sesión o
 * detectar un token robado invalida los tokens de acceso al instante, sin
 * esperar a que expiren.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request.headers?.authorization);
    if (!token) throw new UnauthorizedException('Debes iniciar sesión');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Sesión expirada o inválida');
    }

    const [active] = await this.db
      .select({ one: sql<number>`1` })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(
        and(
          eq(authSessions.familyId, payload.sid),
          eq(authSessions.userId, payload.sub),
          isNull(authSessions.revokedAt),
          isNull(authSessions.rotatedAt),
          gt(authSessions.expiresAt, new Date()),
          eq(users.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!active) throw new UnauthorizedException('Sesión expirada o inválida');

    const user: AuthUser = { id: payload.sub, role: payload.role, sessionFamilyId: payload.sid };
    request.user = user;
    return true;
  }

  private extractToken(header?: string): string | null {
    if (!header) return null;
    const [type, value] = header.split(' ');
    return type === 'Bearer' && value ? value : null;
  }
}
