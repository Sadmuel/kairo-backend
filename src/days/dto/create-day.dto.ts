import { IsDateString } from 'class-validator';

export class CreateDayDto {
  @IsDateString()
  date: string; // YYYY-MM-DD format
}
