import { Injectable } from '@nestjs/common';
import { todayIn } from './date-only';

/** แยกการอ่าน "วันนี้" ออกมาเป็น provider เพื่อให้ test แทนค่าได้ */
@Injectable()
export class Clock {
  private readonly timeZone = process.env.APP_TIMEZONE ?? 'Asia/Bangkok';

  today(): string {
    return todayIn(this.timeZone);
  }
}
