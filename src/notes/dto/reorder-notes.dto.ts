import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class ReorderNotesDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  orderedIds: string[];
}
