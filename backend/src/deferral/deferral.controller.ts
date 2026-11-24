import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentUserGuard } from '../auth/current-user.guard';
import { AppUser } from '../users/app-user.entity';
import { CreateDeferralRequestDto, DecisionDto } from './deferral.dto';
import { DeferralService } from './deferral.service';

@Controller('deferral-requests')
@UseGuards(CurrentUserGuard)
export class DeferralController {
  constructor(private readonly service: DeferralService) {}

  @Post()
  create(@CurrentUser() user: AppUser, @Body() dto: CreateDeferralRequestDto) {
    return this.service.create(user, dto);
  }

  @Get('pending')
  listPending(@CurrentUser() user: AppUser) {
    return this.service.listPending(user);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() user: AppUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionDto,
  ) {
    return this.service.approve(user, id, dto.note);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() user: AppUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionDto,
  ) {
    return this.service.reject(user, id, dto.note);
  }
}
