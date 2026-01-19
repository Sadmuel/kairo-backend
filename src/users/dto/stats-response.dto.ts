export class StatsResponseDto {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: Date | null;
  totalCompletedDays: number;
  totalDays: number;
  overallDayCompletionRate: number;
}
