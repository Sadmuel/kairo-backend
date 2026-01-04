import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class ReorderTimeBlocksDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  orderedIds: string[];
}
