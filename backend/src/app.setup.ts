import { INestApplication, ValidationPipe } from '@nestjs/common';

/** ตั้งค่าที่ใช้ร่วมกันระหว่าง main.ts และ integration test */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
