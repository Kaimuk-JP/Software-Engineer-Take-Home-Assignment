import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AppUser } from '../users/app-user.entity';

export type RequestWithUser = Request & { currentUser?: AppUser };

@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const raw = request.header('x-user-id');
    const id = Number(raw);

    if (!raw || !Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException('ต้องระบุ header X-User-Id');
    }

    const user = await this.users.findOneBy({ id });
    if (!user) {
      throw new UnauthorizedException(`ไม่พบผู้ใช้ id ${id}`);
    }

    request.currentUser = user;
    return true;
  }
}
