/**
 * นโยบายหมวด 4.2 การเลื่อนกำหนดตรวจสอบ
 *
 *   อุปกรณ์ Criticality A เลื่อนได้ไม่เกิน 30 วันนับจากกำหนดเดิม
 *   และเลื่อนซ้ำได้ไม่เกิน 1 ครั้งต่อรอบการตรวจสอบ
 *   กรณีเกินเงื่อนไขต้องผ่านการอนุมัติจากผู้จัดการฝ่ายแทนหัวหน้างาน
 *
 * ไฟล์นี้เป็น pure function ทั้งหมด ไม่แตะฐานข้อมูล เพื่อให้ test ครอบคลุมได้ง่าย
 * การตีความที่เลือกใช้ ดู DECISIONS.docx หัวข้อ 1
 */

import type { Criticality } from '../equipment/equipment.entity';
import type { UserRole } from '../users/app-user.entity';
import { daysBetween } from '../common/date-only';

export type ApproverRole = 'supervisor' | 'department_manager';

export const CRITICALITY_A_MAX_DEFERRAL_DAYS = 30;

export const CRITICALITY_A_MAX_DEFERRALS_PER_CYCLE = 2;

export interface DeferralInput {
  criticality: Criticality;
  currentDueDate: string;
  cycleOriginalDueDate: string;
  approvedDeferralsInCycle: number;
  requestedDueDate: string;
  today: string;
}

export type DeferralEvaluation =
  | { ok: false; error: string }
  | {
      ok: true;
      requiredApproverRole: ApproverRole;
      escalationReasons: string[];
    };

export function evaluateDeferral(input: DeferralInput): DeferralEvaluation {
  if (daysBetween(input.currentDueDate, input.requestedDueDate) <= 0) {
    return {
      ok: false,
      error: `วันที่ใหม่ต้องอยู่หลังกำหนดตรวจสอบปัจจุบัน (${input.currentDueDate})`,
    };
  }
  if (daysBetween(input.today, input.requestedDueDate) <= 0) {
    return { ok: false, error: 'วันที่ใหม่ต้องอยู่หลังวันนี้' };
  }

  const escalationReasons: string[] = [];

  if (input.criticality === 'A') {
    const totalDays = daysBetween(
      input.cycleOriginalDueDate,
      input.requestedDueDate,
    );
    if (totalDays > CRITICALITY_A_MAX_DEFERRAL_DAYS) {
      escalationReasons.push(
        `เลื่อนรวม ${totalDays} วันจากกำหนดเดิม ${input.cycleOriginalDueDate} ` +
          `(เกิน ${CRITICALITY_A_MAX_DEFERRAL_DAYS} วัน)`,
      );
    }

    const deferralNumber = input.approvedDeferralsInCycle + 1;
    if (deferralNumber > CRITICALITY_A_MAX_DEFERRALS_PER_CYCLE) {
      escalationReasons.push(
        `เป็นการเลื่อนครั้งที่ ${deferralNumber} ในรอบนี้ ` +
          `(เลื่อนซ้ำได้ไม่เกิน ${CRITICALITY_A_MAX_DEFERRALS_PER_CYCLE - 1} ครั้ง)`,
      );
    }
  }

  return {
    ok: true,
    requiredApproverRole:
      escalationReasons.length > 0 ? 'department_manager' : 'supervisor',
    escalationReasons,
  };
}

export interface DecisionPermissionInput {
  actorId: number;
  actorRole: UserRole;
  requesterId: number;
  requiredApproverRole: ApproverRole;
}

/**
 * ตรวจว่าผู้ใช้ตัดสิน (อนุมัติหรือปฏิเสธ) คำขอนี้ได้หรือไม่
 * คืนค่า null ถ้าได้ หรือข้อความเหตุผลถ้าไม่ได้
 */
export function whyCannotDecide(input: DecisionPermissionInput): string | null {
  if (input.actorId === input.requesterId) {
    return 'ไม่สามารถตัดสินคำขอของตัวเองได้';
  }
  if (input.actorRole === 'department_manager') {
    return null;
  }
  if (input.actorRole === 'supervisor') {
    return input.requiredApproverRole === 'supervisor'
      ? null
      : 'คำขอนี้เกินเงื่อนไขหมวด 4.2 ต้องให้ผู้จัดการฝ่ายเป็นผู้ตัดสิน';
  }
  return 'เฉพาะหัวหน้างานหรือผู้จัดการฝ่ายเท่านั้นที่ตัดสินคำขอได้';
}

export interface DeciderCheckInput {
  requesterId: number;
  requiredApproverRole: ApproverRole;
  users: { id: number; role: UserRole }[];
}

/**
 * ตรวจตอนยื่นว่ามีผู้ใช้คนอื่นที่ตัดสินคำขอนี้ได้หรือไม่
 * เช่น ผู้จัดการฝ่ายยื่นคำขอที่เกินเงื่อนไข แต่ไม่มีผู้จัดการฝ่ายคนอื่น
 * ถ้ารับไว้ คำขอจะค้างเป็น PENDING ตลอดไปและอุปกรณ์ยื่นคำขอใหม่ไม่ได้
 * คืนค่า null ถ้ามีผู้ตัดสินได้ หรือข้อความเหตุผลถ้าไม่มี
 */
export function whyNoOneCanDecide(input: DeciderCheckInput): string | null {
  const someoneCanDecide = input.users.some(
    (user) =>
      whyCannotDecide({
        actorId: user.id,
        actorRole: user.role,
        requesterId: input.requesterId,
        requiredApproverRole: input.requiredApproverRole,
      }) === null,
  );
  if (someoneCanDecide) {
    return null;
  }
  return input.requiredApproverRole === 'department_manager'
    ? 'คำขอนี้ต้องให้ผู้จัดการฝ่ายอนุมัติ แต่ไม่มีผู้จัดการฝ่ายคนอื่นนอกจากผู้ยื่นคำขอ'
    : 'ไม่มีหัวหน้างานหรือผู้จัดการฝ่ายคนอื่นนอกจากผู้ยื่นคำขอ';
}
