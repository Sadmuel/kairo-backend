export class DayStatsResponseDto {
  date: string;
  dayExists: boolean;
  isCompleted: boolean;
  completedTodos: number;
  totalTodos: number;
  todoCompletionRate: number;
  completedTimeBlocks: number;
  totalTimeBlocks: number;
  timeBlockCompletionRate: number;
}
