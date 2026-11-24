import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentUserGuard } from '../auth/current-user.guard';
import { AppUser } from './app-user.entity';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser])],
  controllers: [UsersController],
  providers: [CurrentUserGuard],
  // export repository ของ AppUser ให้ module อื่นใช้ CurrentUserGuard ได้
  exports: [TypeOrmModule, CurrentUserGuard],
})
export class UsersModule {}
