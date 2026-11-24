import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ต้องรันหลัง seed.sql เพราะอ้างอิงตาราง app_user และ equipment ที่ seed สร้างไว้
 */
export class CreateDeferralRequest1764000000000 implements MigrationInterface {
  name = 'CreateDeferralRequest1764000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE equipment
        ADD COLUMN IF NOT EXISTS cycle_original_due_date date NULL
    `);

    await queryRunner.query(`
      CREATE TABLE deferral_request (
        id                      serial       PRIMARY KEY,
        equipment_id            integer      NOT NULL REFERENCES equipment (id),
        requested_by            integer      NOT NULL REFERENCES app_user (id),
        previous_due_date       date         NOT NULL,
        cycle_original_due_date date         NOT NULL,
        requested_due_date      date         NOT NULL,
        reason                  text         NOT NULL,
        required_approver_role  varchar(30)  NOT NULL,
        escalation_reason       text         NULL,
        status                  varchar(20)  NOT NULL DEFAULT 'PENDING',
        decided_by              integer      NULL REFERENCES app_user (id),
        decided_at              timestamptz  NULL,
        decision_note           text         NULL,
        created_at              timestamptz  NOT NULL DEFAULT now(),

        CONSTRAINT chk_deferral_moves_later
          CHECK (requested_due_date > previous_due_date),
        CONSTRAINT chk_cycle_not_after_previous
          CHECK (cycle_original_due_date <= previous_due_date),
        CONSTRAINT chk_reason_not_blank
          CHECK (length(btrim(reason)) > 0),
        CONSTRAINT chk_status
          CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        CONSTRAINT chk_required_approver_role
          CHECK (required_approver_role IN ('supervisor', 'department_manager')),
        CONSTRAINT chk_decision_fields
          CHECK (
            (status = 'PENDING'  AND decided_by IS NULL     AND decided_at IS NULL) OR
            (status <> 'PENDING' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
          ),
        CONSTRAINT chk_no_self_decision
          CHECK (decided_by IS NULL OR decided_by <> requested_by)
      )
    `);

    // อุปกรณ์หนึ่งตัวมีคำขอที่รออนุมัติได้ครั้งละ 1 รายการ (กันคำขอซ้อนแม้ยิงพร้อมกัน)
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_deferral_one_pending_per_equipment
        ON deferral_request (equipment_id)
        WHERE status = 'PENDING'
    `);

    // ใช้นับจำนวนครั้งที่เลื่อนแล้วในรอบปัจจุบันของอุปกรณ์
    await queryRunner.query(`
      CREATE INDEX ix_deferral_approved_by_cycle
        ON deferral_request (equipment_id, cycle_original_due_date)
        WHERE status = 'APPROVED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS deferral_request`);
    await queryRunner.query(
      `ALTER TABLE equipment DROP COLUMN IF EXISTS cycle_original_due_date`,
    );
  }
}
