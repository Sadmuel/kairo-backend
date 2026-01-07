import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoveTodoDto {
  @ApiPropertyOptional({
    description:
      'Target day UUID (set to move to day context, omit along with timeBlockId to move to inbox)',
  })
  @IsOptional()
  @IsUUID()
  targetDayId?: string;

  @ApiPropertyOptional({
    description: 'Target time block UUID (set to move to time block context)',
  })
  @IsOptional()
  @IsUUID()
  targetTimeBlockId?: string;
}
