import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clock } from '../common/clock';
import { DeferralRequest } from '../deferral/deferral-request.entity';
import { UsersModule } from '../users/users.module';
import { EquipmentController } from './equipment.controller';
import { Equipment } from './equipment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Equipment, DeferralRequest]),
    UsersModule,
  ],
  controllers: [EquipmentController],
  providers: [Clock],
})
export class EquipmentModule {}
