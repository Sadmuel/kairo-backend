import { UserResponseDto } from 'src/users/dto';

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}
