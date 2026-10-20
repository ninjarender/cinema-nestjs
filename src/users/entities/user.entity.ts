import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../user-role.enum.js';

@Entity('users')
// varchar за умовою ДЗ; CHECK, щоб база сама відкидала чужу роль (як PG enum у конспекті)
@Check('CHK_users_role', `"role" IN ('user', 'admin')`)
export class User {
  @ApiProperty({ example: 'f2b1c9e4-3a7d-4e8b-9c1f-5d6a7b8c9d0e' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'olena@example.com' })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Exclude() // не потрапить у відповідь: працює через ClassSerializerInterceptor
  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string;

  @ApiProperty({ enum: UserRole, example: UserRole.User })
  @Column({ type: 'varchar', length: 16, default: UserRole.User })
  role: UserRole;

  @ApiProperty({ example: '2026-11-20T12:00:00.000Z' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
