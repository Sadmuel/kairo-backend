import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateUserDto } from 'src/users/dto';
import { parseDate } from 'src/days/pipes';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    try {
      return await this.prisma.user.create({
        data: {
          email: createUserDto.email.toLowerCase().trim(),
          passwordHash,
          name: createUserDto.name.trim(),
        },
      });
    } catch (error) {
      // Handle unique constraint violation (P2002)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async getStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [totalDays, completedDays] = await Promise.all([
      this.prisma.day.count({ where: { userId } }),
      this.prisma.day.count({ where: { userId, isCompleted: true } }),
    ]);

    return {
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      lastCompletedDate: user.lastCompletedDate,
      totalCompletedDays: completedDays,
      totalDays,
      overallDayCompletionRate: totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0,
    };
  }

  async getDayStats(userId: string, dateString: string) {
    const date = parseDate(dateString);

    const day = await this.prisma.day.findUnique({
      where: { userId_date: { userId, date } },
      include: {
        timeBlocks: true,
      },
    });

    if (!day) {
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

    const todos = await this.prisma.todo.findMany({
      where: {
        userId,
        OR: [{ dayId: day.id }, { timeBlock: { dayId: day.id } }],
      },
    });

    const completedTodos = todos.filter((t) => t.isCompleted).length;
    const completedTimeBlocks = day.timeBlocks.filter((tb) => tb.isCompleted).length;

    return {
      date: dateString,
      dayExists: true,
      isCompleted: day.isCompleted,
      completedTodos,
      totalTodos: todos.length,
      todoCompletionRate: todos.length > 0 ? Math.round((completedTodos / todos.length) * 100) : 0,
      completedTimeBlocks,
      totalTimeBlocks: day.timeBlocks.length,
      timeBlockCompletionRate:
        day.timeBlocks.length > 0
          ? Math.round((completedTimeBlocks / day.timeBlocks.length) * 100)
          : 0,
    };
  }

  async getWeekStats(userId: string, dateString: string) {
    const date = parseDate(dateString);

    // Calculate ISO week bounds (Monday-Sunday)
    const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const weekStart = new Date(date);
    weekStart.setUTCDate(date.getUTCDate() + diffToMonday);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);

    // Fetch all days in the week
    const days = await this.prisma.day.findMany({
      where: {
        userId,
        date: { gte: weekStart, lte: weekEnd },
      },
      include: {
        timeBlocks: true,
      },
    });

    // Fetch all todos for these days
    const dayIds = days.map((d) => d.id);
    const todos =
      dayIds.length > 0
        ? await this.prisma.todo.findMany({
            where: {
              userId,
              OR: [{ dayId: { in: dayIds } }, { timeBlock: { dayId: { in: dayIds } } }],
            },
          })
        : [];

    // Calculate aggregates
    const completedDays = days.filter((d) => d.isCompleted).length;
    const completedTodos = todos.filter((t) => t.isCompleted).length;
    const allTimeBlocks = days.flatMap((d) => d.timeBlocks);
    const completedTimeBlocks = allTimeBlocks.filter((tb) => tb.isCompleted).length;

    // Generate daily stats for each day of the week using already-fetched data
    // Create a map of days by date string for O(1) lookup
    const daysByDate = new Map(
      days.map((d) => [d.date.toISOString().split('T')[0], d]),
    );

    const dailyStats = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setUTCDate(weekStart.getUTCDate() + i);
      const dayDateStr = dayDate.toISOString().split('T')[0];

      const day = daysByDate.get(dayDateStr);
      if (!day) {
        dailyStats.push({
          date: dayDateStr,
          dayExists: false,
          isCompleted: false,
          completedTodos: 0,
          totalTodos: 0,
          todoCompletionRate: 0,
          completedTimeBlocks: 0,
          totalTimeBlocks: 0,
          timeBlockCompletionRate: 0,
        });
        continue;
      }

      // Filter todos for this specific day
      const dayTodos = todos.filter(
        (t) =>
          t.dayId === day.id ||
          day.timeBlocks.some((tb) => tb.id === t.timeBlockId),
      );
      const dayCompletedTodos = dayTodos.filter((t) => t.isCompleted).length;
      const dayCompletedTimeBlocks = day.timeBlocks.filter(
        (tb) => tb.isCompleted,
      ).length;

      dailyStats.push({
        date: dayDateStr,
        dayExists: true,
        isCompleted: day.isCompleted,
        completedTodos: dayCompletedTodos,
        totalTodos: dayTodos.length,
        todoCompletionRate:
          dayTodos.length > 0
            ? Math.round((dayCompletedTodos / dayTodos.length) * 100)
            : 0,
        completedTimeBlocks: dayCompletedTimeBlocks,
        totalTimeBlocks: day.timeBlocks.length,
        timeBlockCompletionRate:
          day.timeBlocks.length > 0
            ? Math.round((dayCompletedTimeBlocks / day.timeBlocks.length) * 100)
            : 0,
      });
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    return {
      weekStart: formatDate(weekStart),
      weekEnd: formatDate(weekEnd),
      completedDays,
      totalDays: days.length,
      completedTodos,
      totalTodos: todos.length,
      todoCompletionRate: todos.length > 0 ? Math.round((completedTodos / todos.length) * 100) : 0,
      completedTimeBlocks,
      totalTimeBlocks: allTimeBlocks.length,
      timeBlockCompletionRate:
        allTimeBlocks.length > 0
          ? Math.round((completedTimeBlocks / allTimeBlocks.length) * 100)
          : 0,
      dailyStats,
    };
  }
}
