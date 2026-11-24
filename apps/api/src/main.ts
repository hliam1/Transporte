import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApi, configureApp } from './app.setup';
import { ENV } from './config/config.module';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<Env>(ENV);

  // Detrás del balanceador de Cloud Run, para que req.ip sea la IP real.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  configureApp(app);

  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, buildOpenApi(app));
  }

  await app.listen(env.PORT);
  Logger.log(`API escuchando en el puerto ${env.PORT} (docs: /docs)`, 'Inicio');
}

void bootstrap();
