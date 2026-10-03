import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Showing } from '../../showings/entities/showing.entity.js';

@Entity('halls')
export class Hall {
  @ApiProperty({ example: '9c1b6e2a-5f3d-4a71-9b6c-2d84f0a1c7e5' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Зал 1', description: 'Унікальна серед усіх залів' })
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @ApiProperty({ example: 3 })
  @Column({ type: 'integer' })
  rows: number;

  @ApiProperty({ example: 5 })
  @Column({ name: 'seats_per_row', type: 'integer' })
  seatsPerRow: number;

  @OneToMany(() => Showing, (showing) => showing.hall)
  showings?: Showing[];
}
