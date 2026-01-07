import { IsString, IsUUID, IsOptional, IsInt, Min, Matches, IsNotEmpty } from 'class-validator';

export class CreateTimeBlockDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color (e.g., #A5D8FF)',
  })
  color?: string;

  @IsUUID()
  dayId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
