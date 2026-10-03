import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Showing } from '../../showings/entities/showing.entity.js';

@Entity('films')
export class Film {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Тіні забутих предків' })
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @ApiProperty({ example: 97, description: 'Тривалість у хвилинах' })
  @Column({ name: 'duration_minutes', type: 'integer' })
  durationMinutes: number;

  @ApiProperty({ example: 1965 })
  @Column({ name: 'release_year', type: 'integer' })
  releaseYear: number;

  @OneToMany(() => Showing, (showing) => showing.film) // зворотний бік, БЕЗ @Column
  showings?: Showing[];
}
