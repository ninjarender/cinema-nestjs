import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsPositive,
  ValidateNested,
} from 'class-validator';

export class SeatDto {
  @ApiProperty({ example: 1, description: 'Номер ряду, ціле додатне' })
  @IsInt()
  @IsPositive()
  row: number;

  @ApiProperty({ example: 4, description: 'Номер місця в ряду, ціле додатне' })
  @IsInt()
  @IsPositive()
  seat: number;
}

export class CreateBookingDto {
  @ApiProperty({
    type: [SeatDto],
    example: [
      { row: 1, seat: 4 },
      { row: 1, seat: 5 },
    ],
    description: 'Непорожній масив місць без повторів',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique((seat: SeatDto) => `${seat?.row}:${seat?.seat}`, {
    message: 'seats must not contain the same seat twice',
  })
  @ValidateNested({ each: true })
  @Type(() => SeatDto)
  seats: SeatDto[];
}
