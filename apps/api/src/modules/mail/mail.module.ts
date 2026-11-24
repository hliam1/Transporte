import { Global, Module } from '@nestjs/common';
import { ENV } from '../../config/config.module';
import type { Env } from '../../config/env';
import { ConsoleMailService, MailService, ResendMailService } from './mail.service';

@Global()
@Module({
  providers: [
    {
      provide: MailService,
      inject: [ENV],
      useFactory: (env: Env): MailService =>
        env.MAIL_PROVIDER === 'resend'
          ? new ResendMailService(env.RESEND_API_KEY as string, env.MAIL_FROM)
          : new ConsoleMailService(),
    },
  ],
  exports: [MailService],
})
export class MailModule {}
