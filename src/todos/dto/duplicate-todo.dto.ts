import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DuplicateTodoDto {
  @ApiPropertyOptional({
    description:
      'Target day UUID (mutually exclusive with targetTimeBlockId, omit both to duplicate in same context)',
  })
  @IsOptional()
  @IsUUID()
  targetDayId?: string;

  @ApiPropertyOptional({
    description:
      'Target time block UUID (mutually exclusive with targetDayId, omit both to duplicate in same context)',
  })
  @IsOptional()
  @IsUUID()
  targetTimeBlockId?: string;
}
