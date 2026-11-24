import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clock } from '../common/clock';
import { UsersModule } from '../users/users.module';
import { DeferralRequest } from './deferral-request.entity';
import { DeferralController } from './deferral.controller';
import { DeferralService } from './deferral.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeferralRequest]), UsersModule],
  controllers: [DeferralController],
  providers: [DeferralService, Clock],
})
export class DeferralModule {}
