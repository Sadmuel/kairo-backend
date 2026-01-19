import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token obtained from login or previous refresh' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
