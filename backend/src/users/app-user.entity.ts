import { Column, Entity, PrimaryColumn } from 'typeorm';

export type UserRole = 'requester' | 'supervisor' | 'department_manager';

/** ตารางนี้สร้างโดย seed.sql (มีอยู่แล้วในระบบ) */
@Entity('app_user')
export class AppUser {
  @PrimaryColumn()
  id: number;

  @Column()
  username: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar' })
  role: UserRole;
}
