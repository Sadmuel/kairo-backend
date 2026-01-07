import { IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class TodoFilterQueryDto {
  @ApiPropertyOptional({ description: 'Filter by day UUID' })
  @IsOptional()
  @IsUUID()
  dayId?: string;

  @ApiPropertyOptional({ description: 'Filter by time block UUID' })
  @IsOptional()
  @IsUUID()
  timeBlockId?: string;

  @ApiPropertyOptional({ description: 'Filter by completion status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isCompleted?: boolean;

  @ApiPropertyOptional({
    description: 'Filter inbox (unassigned) todos only',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  inbox?: boolean;
}
