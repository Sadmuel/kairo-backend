import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDayDto {
  @ApiProperty({ type: String, format: 'date', description: 'Date in YYYY-MM-DD format' })
  @IsDateString()
  date: string; // YYYY-MM-DD format
}
