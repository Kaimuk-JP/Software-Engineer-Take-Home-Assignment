import { types } from 'pg';
import { DataSourceOptions } from 'typeorm';
import { DeferralRequest } from '../deferral/deferral-request.entity';
import { Equipment } from '../equipment/equipment.entity';
import { AppUser } from '../users/app-user.entity';
import { CreateDeferralRequest1764000000000 } from './migrations/1764000000000-CreateDeferralRequest';

// ให้ driver คืนค่าคอลัมน์ date (OID 1082) เป็น string 'YYYY-MM-DD' ตรง ๆ
// ไม่แปลงเป็น JS Date ซึ่งจะทำให้วันที่เลื่อนตาม timezone ของเครื่อง
types.setTypeParser(1082, (value: string) => value);

export const DEFAULT_DATABASE_URL =
  'postgresql://appuser:devpassword@localhost:5432/inspection';

export function buildDataSourceOptions(): DataSourceOptions {
  // DB_SCHEMA ใช้ตอน test เพื่อแยกข้อมูลไว้ใน schema ชั่วคราว ไม่ยุ่งกับข้อมูล dev
  const schema = process.env.DB_SCHEMA;
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    entities: [AppUser, Equipment, DeferralRequest],
    migrations: [CreateDeferralRequest1764000000000],
    migrationsRun: true,
    synchronize: false,
    extra: schema ? { options: `-c search_path=${schema}` } : undefined,
  };
}
