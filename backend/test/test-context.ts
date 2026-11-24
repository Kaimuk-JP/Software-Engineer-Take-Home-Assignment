import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { Clock } from '../src/common/clock';
import { DEFAULT_DATABASE_URL } from '../src/database/data-source';

const SEED_SQL = readFileSync(join(__dirname, '..', '..', 'seed.sql'), 'utf8');

/**
 * ตั้งแอปจริงกับ PostgreSQL จริง (อ่านจาก DATABASE_URL)
 *
 * แต่ละรอบ test สร้าง schema ชั่วคราวของตัวเอง แล้วรัน seed.sql และ migration ในนั้น
 * ลำดับเหมือนตอนรันจริง (docker รัน seed ก่อน แอปรัน migration ตอนเริ่ม)
 * จบแล้วลบ schema ทิ้ง จึงไม่ยุ่งกับข้อมูล dev ใน schema public
 */
export class TestContext {
  private constructor(
    readonly app: INestApplication<App>,
    readonly db: Client,
    private readonly schema: string,
    /** วันนี้ตามฐานข้อมูล seed.sql ผูกวันครบกำหนดกับ CURRENT_DATE ของฐานข้อมูล */
    readonly today: string,
  ) {}

  static async start(): Promise<TestContext> {
    const schema = `test_${process.pid}_${Date.now()}`;
    const db = new Client({
      connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    });
    await db.connect();
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`SET search_path TO ${schema}`);
    await db.query(SEED_SQL);
    const { rows } = await db.query<{ today: string }>(
      'SELECT CURRENT_DATE::text AS today',
    );
    const today = rows[0].today;

    process.env.DB_SCHEMA = schema;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Clock)
      .useValue({ today: () => today })
      .compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app);
    await app.init(); // TypeORM รัน migration ตรงนี้

    return new TestContext(app, db, schema, today);
  }

  /** คืนข้อมูลให้เหมือนหลังรัน seed ใหม่ ใช้ก่อนแต่ละ test */
  async reset(): Promise<void> {
    await this.db.query('DELETE FROM deferral_request');
    await this.db.query('DELETE FROM equipment');
    await this.db.query(SEED_SQL);
  }

  async stop(): Promise<void> {
    await this.app.close();
    await this.db.query(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`);
    await this.db.end();
    delete process.env.DB_SCHEMA;
  }

  http() {
    return request(this.app.getHttpServer());
  }
}
