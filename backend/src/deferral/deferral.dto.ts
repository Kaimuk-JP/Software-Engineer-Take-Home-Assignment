import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDeferralRequestDto {
  @IsInt()
  @Min(1)
  equipmentId: number;

  // Matches บังคับรูปแบบ YYYY-MM-DD ส่วน IsISO8601 strict กันวันที่ไม่มีจริง เช่น 2026-02-30
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'requestedDueDate ต้องเป็นรูปแบบ YYYY-MM-DD',
  })
  @IsISO8601({ strict: true })
  requestedDueDate: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'ต้องระบุเหตุผล' })
  @MaxLength(1000)
  reason: string;
}

export class DecisionDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}
