import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { type AuthUser, CurrentUser, Public } from '../../common/auth/decorators';
import { type AuthResult, AuthService, type ClientInfo } from './auth.service';
import { ForgotPasswordDto, LoginDto, RefreshDto, RegisterDto, ResetPasswordDto } from './dto';

/** Límite estricto para rutas sensibles a fuerza bruta: 10 intentos por minuto por IP. */
const STRICT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(STRICT)
  @Post('register')
  @ApiOperation({ summary: 'Crear cuenta (viajero o conductor)' })
  register(@Body() dto: RegisterDto, @Req() req: Request): Promise<AuthResult> {
    return this.auth.register(dto, clientInfo(req));
  }

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResult> {
    return this.auth.login(dto, clientInfo(req));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar la sesión (cada refresh token sirve una sola vez)' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<AuthResult> {
    return this.auth.refresh(dto.refreshToken, clientInfo(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar la sesión actual' })
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.logout(user.sessionFamilyId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión en todos los dispositivos' })
  async logoutAll(@CurrentUser() user: AuthUser): Promise<void> {
    await this.auth.logoutAll(user.id);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enviar enlace para restablecer la contraseña' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.auth.forgotPassword(dto.email);
    return { message: 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.' };
  }

  @Public()
  @Throttle(STRICT)
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restablecer la contraseña con el enlace recibido' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto);
  }
}

function clientInfo(req: Request): ClientInfo {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
