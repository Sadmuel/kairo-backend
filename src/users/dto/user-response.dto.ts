import { User } from '@prisma/client';

export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: Date | null;
  createdAt: Date;
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
