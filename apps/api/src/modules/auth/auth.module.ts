import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { MeController } from '../users/me.controller';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: env.JWT_ACCESS_TTL_SECONDS, algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [AuthService, PasswordService, UsersService],
  exports: [AuthService, UsersService],
})
export class AuthModule {}
