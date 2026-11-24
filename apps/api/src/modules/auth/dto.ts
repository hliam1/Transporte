import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from './password.service';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Teléfono flexible: dígitos, espacios, guiones, paréntesis y + inicial. */
export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

export class RegisterDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  @MaxLength(254, { message: 'El correo es demasiado largo' })
  email: string;

  @ApiProperty({ example: 'MiClave2026', minLength: PASSWORD_MIN_LENGTH })
  @IsString({ message: PASSWORD_RULE_MESSAGE })
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, { message: PASSWORD_RULE_MESSAGE })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password: string;

  @ApiProperty({ example: 'Ana López' })
  @Transform(trim)
  @IsString({ message: 'El nombre es obligatorio' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres' })
  fullName: string;

  @ApiProperty({ enum: ['TRAVELER', 'DRIVER'], description: 'TRAVELER = Soy viajero, DRIVER = Soy conductor' })
  @IsIn(['TRAVELER', 'DRIVER'], { message: 'Elige si eres viajero o conductor' })
  role: 'TRAVELER' | 'DRIVER';

  @ApiPropertyOptional({ example: '+504 9999-9999' })
  @IsOptional()
  @Transform(trim)
  @Matches(PHONE_PATTERN, { message: 'Número de teléfono inválido' })
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  email: string;

  @ApiProperty()
  @IsString({ message: 'La contraseña es obligatoria' })
  @Length(1, PASSWORD_MAX_LENGTH, { message: 'La contraseña es obligatoria' })
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString({ message: 'Falta el token de sesión' })
  @Length(20, 200, { message: 'Token de sesión inválido' })
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recibido por correo' })
  @IsString({ message: 'Enlace inválido' })
  @Length(20, 200, { message: 'Enlace inválido' })
  token: string;

  @ApiProperty()
  @IsString({ message: PASSWORD_RULE_MESSAGE })
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, { message: PASSWORD_RULE_MESSAGE })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString({ message: 'Escribe tu contraseña actual' })
  @Length(1, PASSWORD_MAX_LENGTH, { message: 'Escribe tu contraseña actual' })
  currentPassword: string;

  @ApiProperty()
  @IsString({ message: PASSWORD_RULE_MESSAGE })
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, { message: PASSWORD_RULE_MESSAGE })
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword: string;
}
