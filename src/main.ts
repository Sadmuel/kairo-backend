import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from 'src/app.module';

function getCorsOrigin(): string | string[] {
  const frontendUrl = process.env.FRONTEND_URL;

  if (frontendUrl) {
    return frontendUrl;
  }

  // In development, allow common localhost ports if FRONTEND_URL is not set
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:5173', 'http://localhost:3000'];
  }

  // In production, FRONTEND_URL must be configured
  throw new Error(
    'FRONTEND_URL environment variable is required in production',
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: getCorsOrigin(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
