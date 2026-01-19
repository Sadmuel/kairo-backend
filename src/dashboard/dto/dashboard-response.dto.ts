import { RecurrenceType } from '@prisma/client';

export class StreaksDto {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: Date | null;
  totalCompletedDays: number;
  totalDays: number;
  overallDayCompletionRate: number;
}

export class TodayStatsDto {
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

export class NoteDto {
  id: string;
  content: string;
  order: number;
}

export class TodoDto {
  id: string;
  title: string;
  isCompleted: boolean;
  deadline: Date | null;
  order: number;
}

export class TimeBlockDto {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isCompleted: boolean;
  order: number;
  color: string | null;
  notes: NoteDto[];
  todos: TodoDto[];
}

export class TodayDetailDto {
  id: string;
  date: Date;
  isCompleted: boolean;
  timeBlocks: TimeBlockDto[];
  todos: TodoDto[];
}

export class UpcomingEventDto {
  id: string;
  title: string;
  date: Date;
  color: string | null;
  isRecurring: boolean;
  recurrenceType: RecurrenceType;
  isOccurrence: boolean;
  occurrenceDate: Date;
}

export class DashboardResponseDto {
  streaks: StreaksDto;
  today: TodayStatsDto;
  todayDetail: TodayDetailDto | null;
  upcomingEvents: UpcomingEventDto[];
}
