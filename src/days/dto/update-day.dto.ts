import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDayDto {
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
