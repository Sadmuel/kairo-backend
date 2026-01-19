import { ApiProperty } from '@nestjs/swagger';
import { User } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ description: 'Unique user identifier (UUID)' })
  id: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  email: string;

  @ApiProperty({ example: 'John Doe', description: 'User display name' })
  name: string;

  @ApiProperty({ example: 5, description: 'Current consecutive days streak' })
  currentStreak: number;

  @ApiProperty({ example: 10, description: 'Longest streak achieved' })
  longestStreak: number;

  @ApiProperty({ example: '2024-01-15', description: 'Date of last completed day', nullable: true })
  lastCompletedDate: Date | null;

  @ApiProperty({ description: 'Account creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  static fromUser(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.name = user.name;
    dto.currentStreak = user.currentStreak;
    dto.longestStreak = user.longestStreak;
    dto.lastCompletedDate = user.lastCompletedDate;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
