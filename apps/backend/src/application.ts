import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/environment.js';
import { BadRequestException, ValidationPipe, type ValidationError } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { SessionResources } from './modules/auth/session.resources.js';
import { HttpExceptionFilter } from './common/http-exception.filter.js';

export async function createApplication(config: AppConfig): Promise<NestExpressApplication> {
  // Keep errors/warnings (500 causes, mail delivery failures); skip Nest's startup/route noise.
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), { logger: ['error', 'warn'] });
  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const id = randomUUID(); res.locals['requestId'] = id;
    res.setHeader('X-Request-ID', id); res.setHeader('Cache-Control', 'no-store');
    // Never log the query (email links use fragment), body, cookie or sensitive headers.
    next();
  });
  app.useBodyParser('json', { limit: '100kb' });
  app.use(session({
    name: config.nodeEnv === 'production' ? '__Host-shop.sid' : 'shop.sid',
    secret: config.sessionSecret, resave: false, saveUninitialized: false, rolling: true,
    store: app.get(SessionResources).store,
    cookie: { httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'lax', path: '/', maxAge: 86400000 },
  }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors: ValidationError[]) => new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Thông tin chưa hợp lệ.',
      fieldErrors: errors.flatMap((error) => Object.values(error.constraints ?? {}).map((message) => ({ field: error.property, message }))) }),
  }));
  if (config.swaggerEnabled && config.nodeEnv !== 'production') {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Clothing Shop API').setVersion('1').addCookieAuth('shop.sid').build());
    SwaggerModule.setup('api/docs', app, document);
  }
  app.enableShutdownHooks();
  return app;
}
