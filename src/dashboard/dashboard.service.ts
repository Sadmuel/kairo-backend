import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsService } from 'src/events/events.service';
import { parseDate } from 'src/days/pipes';
import { DashboardResponseDto } from './dto';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  async getDashboard(userId: string, clientDate?: string): Promise<DashboardResponseDto> {
    // Use client-provided date if valid, otherwise fall back to server date
    let todayStr: string;
    if (clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
      todayStr = clientDate;
    } else {
      const today = new Date();
      todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }

    // Calculate 7 days from today for upcoming events
    const todayDate = new Date(todayStr + 'T00:00:00');
    const nextWeek = new Date(todayDate);
    nextWeek.setDate(todayDate.getDate() + 7);
    const nextWeekStr = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`;

    // Execute all queries in parallel for performance
    const [user, todayDay, upcomingEvents, totalDays, completedDays] = await Promise.all([
      // Get user with streak data
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          currentStreak: true,
          longestStreak: true,
          lastCompletedDate: true,
        },
      }),

      // Get today's full day with time blocks, notes, todos
      this.prisma.day.findUnique({
        where: { userId_date: { userId, date: parseDate(todayStr) } },
        include: {
          timeBlocks: {
            orderBy: { order: 'asc' },
            include: {
              notes: { orderBy: { order: 'asc' } },
              todos: { orderBy: { order: 'asc' } },
            },
          },
          todos: {
            where: { timeBlockId: null },
            orderBy: { order: 'asc' },
          },
        },
      }),

      // Get upcoming events (next 7 days) using EventsService
      this.eventsService.findByDateRange(userId, todayStr, nextWeekStr),

      // Count total days for overall stats
      this.prisma.day.count({ where: { userId } }),

      // Count completed days
      this.prisma.day.count({ where: { userId, isCompleted: true } }),
    ]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate today's stats
    const todayStats = await this.calculateTodayStats(userId, todayStr, todayDay);

    // Build streaks response
    const streaks = {
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      lastCompletedDate: user.lastCompletedDate,
      totalCompletedDays: completedDays,
      totalDays,
      overallDayCompletionRate: totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0,
    };

    // Build today detail response (null if no day exists)
    const todayDetail = todayDay
      ? {
          id: todayDay.id,
          date: todayDay.date,
          isCompleted: todayDay.isCompleted,
          timeBlocks: todayDay.timeBlocks.map((tb) => ({
            id: tb.id,
            name: tb.name,
            startTime: tb.startTime,
            endTime: tb.endTime,
            isCompleted: tb.isCompleted,
            order: tb.order,
            color: tb.color,
            notes: tb.notes.map((n) => ({
              id: n.id,
              content: n.content,
              order: n.order,
            })),
            todos: tb.todos.map((t) => ({
              id: t.id,
              title: t.title,
              isCompleted: t.isCompleted,
              deadline: t.deadline,
              order: t.order,
            })),
          })),
          todos: todayDay.todos.map((t) => ({
            id: t.id,
            title: t.title,
            isCompleted: t.isCompleted,
            deadline: t.deadline,
            order: t.order,
          })),
        }
      : null;

    // Map upcoming events to DTO format
    const upcomingEventsDto = upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      color: e.color,
      isRecurring: e.isRecurring,
      recurrenceType: e.recurrenceType,
      isOccurrence: e.isOccurrence,
      occurrenceDate: e.occurrenceDate,
    }));

    return {
      streaks,
      today: todayStats,
      todayDetail,
      upcomingEvents: upcomingEventsDto,
    };
  }

  private async calculateTodayStats(
    userId: string,
    dateString: string,
    todayDay:
      | (Awaited<ReturnType<typeof this.prisma.day.findUnique>> & {
          timeBlocks: Array<{
            id: string;
            isCompleted: boolean;
            todos: Array<{ isCompleted: boolean }>;
          }>;
          todos: Array<{ isCompleted: boolean }>;
        })
      | null,
  ) {
    if (!todayDay) {
      return {
        date: dateString,
        dayExists: false,
        isCompleted: false,
        completedTodos: 0,
        totalTodos: 0,
        todoCompletionRate: 0,
        completedTimeBlocks: 0,
        totalTimeBlocks: 0,
        timeBlockCompletionRate: 0,
      };
    }

    // Count todos from both day-level and time-block level
    const dayLevelTodos = todayDay.todos;
    const timeBlockTodos = todayDay.timeBlocks.flatMap((tb) => tb.todos);
    const allTodos = [...dayLevelTodos, ...timeBlockTodos];

    const completedTodos = allTodos.filter((t) => t.isCompleted).length;
    const completedTimeBlocks = todayDay.timeBlocks.filter((tb) => tb.isCompleted).length;

    return {
      date: dateString,
      dayExists: true,
      isCompleted: todayDay.isCompleted,
      completedTodos,
      totalTodos: allTodos.length,
      todoCompletionRate:
        allTodos.length > 0 ? Math.round((completedTodos / allTodos.length) * 100) : 0,
      completedTimeBlocks,
      totalTimeBlocks: todayDay.timeBlocks.length,
      timeBlockCompletionRate:
        todayDay.timeBlocks.length > 0
          ? Math.round((completedTimeBlocks / todayDay.timeBlocks.length) * 100)
          : 0,
    };
  }
}
