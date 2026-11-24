import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUserGuard } from '../auth/current-user.guard';
import { Clock } from '../common/clock';
import { daysBetween } from '../common/date-only';
import { DeferralRequest } from '../deferral/deferral-request.entity';
import { Equipment } from './equipment.entity';

export interface EquipmentListItem extends Equipment {
  /** id ของคำขอที่รออนุมัติอยู่ (ถ้ามี) เพื่อให้หน้าจอบอกได้ก่อนยื่นซ้ำ */
  pendingRequestId: number | null;
  /**
   * จำนวนวันจากวันนี้ถึงกำหนดตรวจสอบ (ติดลบ = เลยกำหนด)
   * คำนวณที่ backend ด้วย Clock ตัวเดียวกับที่ใช้ตรวจนโยบาย
   * หน้าจอจึงไม่ต้องพึ่งนาฬิกาของเครื่องผู้ใช้
   */
  daysUntilDue: number;
}

@Controller('equipment')
@UseGuards(CurrentUserGuard)
export class EquipmentController {
  constructor(
    @InjectRepository(Equipment)
    private readonly equipment: Repository<Equipment>,
    @InjectRepository(DeferralRequest)
    private readonly requests: Repository<DeferralRequest>,
    private readonly clock: Clock,
  ) {}

  @Get()
  async list(): Promise<EquipmentListItem[]> {
    const [items, pending] = await Promise.all([
      this.equipment.find({ order: { nextDueDate: 'ASC', id: 'ASC' } }),
      this.requests.find({
        select: { id: true, equipmentId: true },
        where: { status: 'PENDING' },
      }),
    ]);
    const pendingByEquipment = new Map(
      pending.map((r) => [r.equipmentId, r.id]),
    );
    const today = this.clock.today();
    return items.map((e) => ({
      ...e,
      pendingRequestId: pendingByEquipment.get(e.id) ?? null,
      daysUntilDue: daysBetween(today, e.nextDueDate),
    }));
  }
}
