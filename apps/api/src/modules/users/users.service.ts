import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../../database/database.module';
import { type UserRole, userProfiles, users } from '../../database/schema';

/** Datos del usuario que la API devuelve. Nunca incluye el hash de la contraseña. */
export interface UserView {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone: string | null;
  photoUrl: string | null;
  timezone: string;
  createdAt: Date;
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string | null;
  timezone?: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async getView(userId: string): Promise<UserView> {
    const [row] = await this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        fullName: userProfiles.fullName,
        phone: userProfiles.phone,
        photoUrl: userProfiles.photoUrl,
        timezone: userProfiles.timezone,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) throw new NotFoundException('Usuario no encontrado');
    return row;
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserView> {
    const changes: Partial<typeof userProfiles.$inferInsert> = {};
    if (input.fullName !== undefined) changes.fullName = input.fullName;
    if (input.phone !== undefined) changes.phone = input.phone;
    if (input.timezone !== undefined) changes.timezone = input.timezone;
    if (Object.keys(changes).length > 0) {
      await this.db.update(userProfiles).set(changes).where(eq(userProfiles.userId, userId));
    }
    return this.getView(userId);
  }
}
