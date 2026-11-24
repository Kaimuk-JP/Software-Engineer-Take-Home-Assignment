import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Equipment } from '../equipment/equipment.entity';
import { AppUser } from '../users/app-user.entity';
import type { ApproverRole } from './deferral-policy';

export type DeferralStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

@Entity('deferral_request')
export class DeferralRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'equipment_id' })
  equipmentId: number;

  @ManyToOne(() => Equipment)
  @JoinColumn({ name: 'equipment_id' })
  equipment?: Equipment;

  @Column({ name: 'requested_by' })
  requestedById: number;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'requested_by' })
  requestedBy?: AppUser;

  /** กำหนดตรวจสอบของอุปกรณ์ ณ ตอนยื่นคำขอ */
  @Column({ name: 'previous_due_date', type: 'date' })
  previousDueDate: string;

  /** กำหนดตรวจสอบ ณ ต้นรอบ ใช้นับเพดาน 30 วันและจำนวนครั้งที่เลื่อนในรอบ */
  @Column({ name: 'cycle_original_due_date', type: 'date' })
  cycleOriginalDueDate: string;

  @Column({ name: 'requested_due_date', type: 'date' })
  requestedDueDate: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'required_approver_role', type: 'varchar' })
  requiredApproverRole: ApproverRole;

  /** เหตุผลที่ต้องให้ผู้จัดการฝ่ายอนุมัติ (NULL ถ้าหัวหน้างานอนุมัติได้) */
  @Column({ name: 'escalation_reason', type: 'text', nullable: true })
  escalationReason: string | null;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: DeferralStatus;

  @Column({ name: 'decided_by', type: 'integer', nullable: true })
  decidedById: number | null;

  @ManyToOne(() => AppUser)
  @JoinColumn({ name: 'decided_by' })
  decidedBy?: AppUser | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  decisionNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
