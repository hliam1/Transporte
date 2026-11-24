import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, Validate, type ValidatorConstraintInterface, ValidatorConstraint } from 'class-validator';
import { type AuthUser, CurrentUser } from '../../common/auth/decorators';
import { AuthService } from '../auth/auth.service';
import { ChangePasswordDto, PHONE_PATTERN } from '../auth/dto';
import { type UserView, UsersService } from './users.service';

@ValidatorConstraint({ name: 'ianaTimezone' })
class IsIanaTimezone implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    try {
      new Intl.DateTimeFormat('es', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage(): string {
    return 'Zona horaria inválida';
  }
}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ana López' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres' })
  fullName?: string;

  @ApiPropertyOptional({ example: '+504 9999-9999', description: 'Cadena vacía para borrar el teléfono' })
  @IsOptional()
  @Transform(trim)
  @Matches(new RegExp(`(${PHONE_PATTERN.source})|^$`), { message: 'Número de teléfono inválido' })
  phone?: string;

  @ApiPropertyOptional({ example: 'America/Tegucigalpa' })
  @IsOptional()
  @Validate(IsIanaTimezone)
  timezone?: string;
}

@ApiTags('Mi cuenta')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Ver mi perfil' })
  me(@CurrentUser() user: AuthUser): Promise<UserView> {
    return this.users.getView(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Editar mi perfil' })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<UserView> {
    return this.users.updateProfile(user.id, {
      fullName: dto.fullName,
      phone: dto.phone === undefined ? undefined : dto.phone || null,
      timezone: dto.timezone,
    });
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambiar mi contraseña (cierra mis otras sesiones)' })
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.auth.changePassword(user.id, user.sessionFamilyId, dto);
  }
}
