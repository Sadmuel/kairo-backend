import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class UpdateTimeBlockDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color',
  })
  color?: string;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
