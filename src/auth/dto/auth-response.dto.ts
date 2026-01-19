import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from 'src/users/dto';

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token for API authentication' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token for obtaining new access tokens' })
  refreshToken: string;

  @ApiProperty({ description: 'User information', type: UserResponseDto })
  user: UserResponseDto;
}
