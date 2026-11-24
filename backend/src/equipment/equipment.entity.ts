import { Column, Entity, PrimaryColumn } from 'typeorm';

export type Criticality = 'A' | 'B' | 'C';

/** ตารางนี้สร้างโดย seed.sql ส่วนคอลัมน์ cycle_original_due_date เพิ่มโดย migration */
@Entity('equipment')
export class Equipment {
  @PrimaryColumn()
  id: number;

  @Column({ name: 'tag_no' })
  tagNo: string;

  @Column()
  name: string;

  @Column()
  location: string;

  @Column({ type: 'char', length: 1 })
  criticality: Criticality;

  @Column({ name: 'next_due_date', type: 'date' })
  nextDueDate: string;

  /**
   * กำหนดตรวจสอบ ณ ต้นรอบการตรวจสอบปัจจุบัน
   * NULL = รอบนี้ยังไม่เคยถูกเลื่อน (กำหนดเดิมคือ next_due_date)
   */
  @Column({ name: 'cycle_original_due_date', type: 'date', nullable: true })
  cycleOriginalDueDate: string | null;
}
