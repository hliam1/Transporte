import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../database/schema';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Marca una ruta como accesible sin sesión. Todo lo demás exige token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe una ruta a ciertos roles, p. ej. @Roles('DRIVER'). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Usuario autenticado que el guard deja en la petición. */
export interface AuthUser {
  id: string;
  role: UserRole;
  /** Familia de sesión (permite revocar tokens de acceso al cerrar sesión). */
  sessionFamilyId: string;
}

/** Inyecta el usuario autenticado: `me(@CurrentUser() user: AuthUser)`. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user as AuthUser;
});
