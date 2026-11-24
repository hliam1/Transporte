import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Envío de correos transaccionales. La implementación concreta se elige con
 * MAIL_PROVIDER (ver mail.module.ts).
 */
export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}

/** Desarrollo: imprime el correo en la consola en vez de enviarlo. */
@Injectable()
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger('Correo');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`Para: ${message.to} | Asunto: ${message.subject}\n${message.text}`);
  }
}

/** Producción: envía con la API HTTP de Resend (https://resend.com). */
@Injectable()
export class ResendMailService extends MailService {
  private readonly logger = new Logger('Correo');

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {
    super();
  }

  async send(message: MailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, ...message }),
    });
    if (!res.ok) {
      // No se expone el error al usuario (evita revelar si el correo existe);
      // queda registrado para revisión.
      this.logger.error(`Resend respondió ${res.status}: ${await res.text()}`);
      throw new Error('No se pudo enviar el correo');
    }
  }
}
