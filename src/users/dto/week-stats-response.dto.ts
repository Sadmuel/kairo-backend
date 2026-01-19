import { DayStatsResponseDto } from './day-stats-response.dto';

export class WeekStatsResponseDto {
  weekStart: string;
  weekEnd: string;
  completedDays: number;
  totalDays: number;
  completedTodos: number;
  totalTodos: number;
  todoCompletionRate: number;
  completedTimeBlocks: number;
  totalTimeBlocks: number;
  timeBlockCompletionRate: number;
  dailyStats: DayStatsResponseDto[];
}
