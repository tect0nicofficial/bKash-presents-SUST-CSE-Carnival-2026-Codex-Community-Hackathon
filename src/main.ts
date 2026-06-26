import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { globalValidationPipe } from './common/pipes/global-validation.pipe';
import helmet from 'helmet';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  }));

  const config = new DocumentBuilder()
    .setTitle('QueueStorm Investigator')
    .setDescription('Customer complaint investigation API for bKash presents SUST CSE Carnival 2026 — Codex Community Hackathon')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TimeoutInterceptor());
  app.useGlobalPipes(globalValidationPipe);

  app.enableCors();

  const port = process.env.PORT ?? 8000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application running on port ${port}`);
  logger.log(`Swagger docs at http://0.0.0.0:${port}/api`);
}
bootstrap().catch((err) => {
  logger.error('Failed to start application:', err);
  process.exit(1);
});
