import { IsUUID, IsBoolean, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DuplicateTimeBlockDto {
  @ApiProperty({ description: 'Target day UUID to duplicate the time block to' })
  @IsUUID()
  targetDayId: string;

  @ApiPropertyOptional({
    description: 'Include notes in the duplicate (default: true)',
  })
  @IsOptional()
  @IsBoolean()
  includeNotes?: boolean;

  @ApiPropertyOptional({
    description: 'Include todos in the duplicate (default: false)',
  })
  @IsOptional()
  @IsBoolean()
  includeTodos?: boolean;

  @ApiPropertyOptional({
    description: 'Override start time for the duplicate (HH:mm format)',
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Override end time for the duplicate (HH:mm format)',
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;
}
