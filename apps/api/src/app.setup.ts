import { BadRequestException, type INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { ValidationError } from 'class-validator';
import helmet from 'helmet';
import { ENV } from './config/config.module';
import type { Env } from './config/env';

/**
 * Configuración común de la app (la usan main.ts y las pruebas e2e, para que
 * las pruebas ejerciten exactamente lo mismo que producción).
 */
export function configureApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);

  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: false,
  });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos no declarados en el DTO
      forbidNonWhitelisted: true, // y rechaza la petición si los trae
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          statusCode: 400,
          error: 'Datos inválidos',
          message: [...new Set(flattenErrors(errors))],
        }),
    }),
  );
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Transporte — API')
    .setDescription('API central de la plataforma de transporte privado (PWA viajeros y app de conductores).')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

function flattenErrors(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((e) => {
    const path = parent ? `${parent}.${e.property}` : e.property;
    if (e.constraints) {
      if (e.constraints.whitelistValidation) return [`Campo no permitido: ${path}`];
      return Object.values(e.constraints);
    }
    return flattenErrors(e.children ?? [], path);
  });
}
