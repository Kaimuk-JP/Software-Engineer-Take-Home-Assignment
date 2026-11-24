import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './database/data-source';
import { DeferralModule } from './deferral/deferral.module';
import { EquipmentModule } from './equipment/equipment.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // ใช้ factory เพื่อให้อ่าน env ตอนสร้าง module (test ตั้ง DB_SCHEMA ไว้ก่อน)
    TypeOrmModule.forRootAsync({ useFactory: buildDataSourceOptions }),
    UsersModule,
    EquipmentModule,
    DeferralModule,
  ],
})
export class AppModule {}
