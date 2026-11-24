import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AppUser } from '../users/app-user.entity';
import type { RequestWithUser } from './current-user.guard';

/** ดึง user ที่ CurrentUserGuard โหลดไว้ ใช้คู่กับ @UseGuards(CurrentUserGuard) */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AppUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.currentUser) {
      throw new Error('CurrentUser ใช้ได้เฉพาะ route ที่มี CurrentUserGuard');
    }
    return request.currentUser;
  },
);
