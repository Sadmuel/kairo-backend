import { IsDateString } from 'class-validator';

export class CalendarQueryDto {
  @IsDateString()
  startDate: string; // YYYY-MM-DD

  @IsDateString()
  endDate: string; // YYYY-MM-DD
}
