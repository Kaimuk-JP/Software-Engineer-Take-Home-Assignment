import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppUser } from './app-user.entity';

/** ไม่ต้องมี X-User-Id: frontend ใช้ทำ dropdown สลับผู้ใช้ */
@Controller('users')
export class UsersController {
  constructor(
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
  ) {}

  @Get()
  list(): Promise<AppUser[]> {
    return this.users.find({ order: { id: 'ASC' } });
  }
}
