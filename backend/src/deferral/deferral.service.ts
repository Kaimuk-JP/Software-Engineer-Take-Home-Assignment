import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { Clock } from '../common/clock';
import { Equipment } from '../equipment/equipment.entity';
import { AppUser } from '../users/app-user.entity';
import {
  ApproverRole,
  evaluateDeferral,
  whyCannotDecide,
  whyNoOneCanDecide,
} from './deferral-policy';
import { DeferralRequest } from './deferral-request.entity';
import { CreateDeferralRequestDto } from './deferral.dto';

export interface PendingRequestView extends DeferralRequest {
  /** ผู้ใช้ปัจจุบันตัดสินคำขอนี้ได้หรือไม่ (ใช้เปิด/ปิดปุ่มบนหน้าจอ) */
  canDecide: boolean;
  cannotDecideReason: string | null;
}

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class DeferralService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {}

  async create(
    actor: AppUser,
    dto: CreateDeferralRequestDto,
  ): Promise<DeferralRequest> {
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        // ล็อกแถวอุปกรณ์ไว้ คำขอของอุปกรณ์เดียวกันที่เข้ามาพร้อมกันจะต้องรอคิว
        const equipment = await this.lockEquipment(manager, dto.equipmentId);

        const pending = await manager.findOneBy(DeferralRequest, {
          equipmentId: equipment.id,
          status: 'PENDING',
        });
        if (pending) {
          throw new ConflictException(
            `อุปกรณ์ ${equipment.tagNo} มีคำขอที่รออนุมัติอยู่แล้ว (คำขอ #${pending.id})`,
          );
        }

        const { cycle, evaluation } = await this.evaluate(
          manager,
          equipment,
          dto.requestedDueDate,
        );
        if (!evaluation.ok) {
          throw new BadRequestException(evaluation.error);
        }

        const noDecider = whyNoOneCanDecide({
          requesterId: actor.id,
          requiredApproverRole: evaluation.requiredApproverRole,
          users: await manager.find(AppUser, {
            select: { id: true, role: true },
          }),
        });
        if (noDecider) {
          const why = joinReasons(evaluation.escalationReasons);
          throw new BadRequestException(
            why ? `${noDecider} (${why})` : noDecider,
          );
        }

        const saved = await manager.save(
          manager.create(DeferralRequest, {
            equipmentId: equipment.id,
            requestedById: actor.id,
            previousDueDate: equipment.nextDueDate,
            cycleOriginalDueDate: cycle.originalDueDate,
            requestedDueDate: dto.requestedDueDate,
            reason: dto.reason,
            requiredApproverRole: evaluation.requiredApproverRole,
            escalationReason: joinReasons(evaluation.escalationReasons),
            status: 'PENDING',
          }),
        );
        return saved.id;
      });
      return this.findOne(id);
    } catch (error) {
      // กันพลาดชั้นสุดท้าย: unique index อนุญาตคำขอ PENDING ได้ 1 รายการต่ออุปกรณ์
      if (isUniqueViolation(error)) {
        throw new ConflictException('อุปกรณ์นี้มีคำขอที่รออนุมัติอยู่แล้ว');
      }
      throw error;
    }
  }

  async listPending(actor: AppUser): Promise<PendingRequestView[]> {
    const requests = await this.dataSource.getRepository(DeferralRequest).find({
      where: { status: 'PENDING' },
      relations: { equipment: true, requestedBy: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return requests.map((r) => {
      const reason = whyCannotDecide({
        actorId: actor.id,
        actorRole: actor.role,
        requesterId: r.requestedById,
        requiredApproverRole: r.requiredApproverRole,
      });
      return { ...r, canDecide: reason === null, cannotDecideReason: reason };
    });
  }

  async approve(
    actor: AppUser,
    requestId: number,
    note?: string,
  ): Promise<DeferralRequest> {
    await this.dataSource.transaction(async (manager) => {
      const { request, equipment } = await this.lockPendingRequest(
        manager,
        requestId,
      );

      if (equipment.nextDueDate !== request.previousDueDate) {
        throw new ConflictException(
          'กำหนดตรวจสอบของอุปกรณ์เปลี่ยนไปหลังยื่นคำขอ กรุณายื่นคำขอใหม่',
        );
      }

      // ตรวจนโยบาย 4.2 ซ้ำตอนอนุมัติ ด้วยข้อมูลล่าสุดที่ล็อกไว้แล้ว
      const { cycle, evaluation } = await this.evaluate(
        manager,
        equipment,
        request.requestedDueDate,
      );
      if (!evaluation.ok) {
        throw new ConflictException(
          `คำขอนี้ไม่ผ่านเงื่อนไขแล้ว: ${evaluation.error} (ให้ปฏิเสธแล้วยื่นใหม่)`,
        );
      }

      this.assertCanDecide(actor, request, evaluation.requiredApproverRole);

      await manager.update(Equipment, equipment.id, {
        nextDueDate: request.requestedDueDate,
        cycleOriginalDueDate: cycle.originalDueDate,
      });
      await manager.update(DeferralRequest, request.id, {
        status: 'APPROVED',
        requiredApproverRole: evaluation.requiredApproverRole,
        escalationReason: joinReasons(evaluation.escalationReasons),
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: note || null,
      });
    });
    return this.findOne(requestId);
  }

  async reject(
    actor: AppUser,
    requestId: number,
    note?: string,
  ): Promise<DeferralRequest> {
    await this.dataSource.transaction(async (manager) => {
      const { request } = await this.lockPendingRequest(manager, requestId);
      this.assertCanDecide(actor, request, request.requiredApproverRole);

      await manager.update(DeferralRequest, request.id, {
        status: 'REJECTED',
        decidedById: actor.id,
        decidedAt: new Date(),
        decisionNote: note || null,
      });
    });
    return this.findOne(requestId);
  }

  private async findOne(id: number): Promise<DeferralRequest> {
    const request = await this.dataSource
      .getRepository(DeferralRequest)
      .findOne({
        where: { id },
        relations: { equipment: true, requestedBy: true, decidedBy: true },
      });
    if (!request) {
      throw new NotFoundException(`ไม่พบคำขอ #${id}`);
    }
    return request;
  }

  private async lockEquipment(
    manager: EntityManager,
    equipmentId: number,
  ): Promise<Equipment> {
    const equipment = await manager.findOne(Equipment, {
      where: { id: equipmentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!equipment) {
      throw new NotFoundException(`ไม่พบอุปกรณ์ id ${equipmentId}`);
    }
    return equipment;
  }

  /**
   * ล็อกอุปกรณ์ก่อนแล้วจึงล็อกคำขอ (ลำดับเดียวกับตอนยื่นคำขอ เพื่อไม่ให้เกิด deadlock)
   * แล้วตรวจว่าคำขอยังรออนุมัติอยู่
   */
  private async lockPendingRequest(manager: EntityManager, requestId: number) {
    const found = await manager.findOne(DeferralRequest, {
      select: { id: true, equipmentId: true },
      where: { id: requestId },
    });
    if (!found) {
      throw new NotFoundException(`ไม่พบคำขอ #${requestId}`);
    }

    const equipment = await this.lockEquipment(manager, found.equipmentId);
    const request = await manager.findOneOrFail(DeferralRequest, {
      where: { id: requestId },
      lock: { mode: 'pessimistic_write' },
    });
    if (request.status !== 'PENDING') {
      throw new ConflictException(
        `คำขอ #${requestId} ถูกตัดสินไปแล้ว (${request.status})`,
      );
    }
    return { request, equipment };
  }

  /** รอบการตรวจสอบปัจจุบัน: กำหนด ณ ต้นรอบ และจำนวนครั้งที่อนุมัติให้เลื่อนไปแล้ว */
  private async currentCycle(manager: EntityManager, equipment: Equipment) {
    const originalDueDate =
      equipment.cycleOriginalDueDate ?? equipment.nextDueDate;
    const approvedCount = await manager.countBy(DeferralRequest, {
      equipmentId: equipment.id,
      status: 'APPROVED',
      cycleOriginalDueDate: originalDueDate,
    });
    return { originalDueDate, approvedCount };
  }

  /**
   * ตรวจนโยบาย 4.2 กับรอบปัจจุบันของอุปกรณ์
   * ใช้ทั้งตอนยื่นและตอนอนุมัติ เพื่อให้ทั้งสองจุดใช้กฎชุดเดียวกัน
   */
  private async evaluate(
    manager: EntityManager,
    equipment: Equipment,
    requestedDueDate: string,
  ) {
    const cycle = await this.currentCycle(manager, equipment);
    const evaluation = evaluateDeferral({
      criticality: equipment.criticality,
      currentDueDate: equipment.nextDueDate,
      cycleOriginalDueDate: cycle.originalDueDate,
      approvedDeferralsInCycle: cycle.approvedCount,
      requestedDueDate,
      today: this.clock.today(),
    });
    return { cycle, evaluation };
  }

  private assertCanDecide(
    actor: AppUser,
    request: DeferralRequest,
    requiredApproverRole: ApproverRole,
  ): void {
    const denied = whyCannotDecide({
      actorId: actor.id,
      actorRole: actor.role,
      requesterId: request.requestedById,
      requiredApproverRole,
    });
    if (denied) {
      throw new ForbiddenException(denied);
    }
  }
}

function joinReasons(reasons: string[]): string | null {
  return reasons.length > 0 ? reasons.join('; ') : null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}
