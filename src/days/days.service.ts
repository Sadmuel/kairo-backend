import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, TransactionClient } from 'src/prisma/prisma.service';
import { CreateDayDto, UpdateDayDto } from './dto';
import { parseDate } from './pipes';

@Injectable()
export class DaysService {
  constructor(private prisma: PrismaService) {}

  async findByDateRange(userId: string, startDate: string, endDate: string) {
    const start = parseDate(startDate);
    const end = parseDate(endDate);

    if (start > end) {
      throw new BadRequestException('startDate must be less than or equal to endDate');
    }

    return this.prisma.day.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
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
      orderBy: { date: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const day = await this.prisma.day.findFirst({
      where: { id, userId },
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
    });

    if (!day) {
      throw new NotFoundException('Day not found');
    }

    return day;
  }

  async findByDate(userId: string, date: string) {
    const day = await this.prisma.day.findUnique({
      where: {
        userId_date: { userId, date: parseDate(date) },
      },
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
    });

    return day;
  }

  async create(userId: string, dto: CreateDayDto) {
    const existing = await this.prisma.day.findUnique({
      where: {
        userId_date: { userId, date: parseDate(dto.date) },
      },
    });

    if (existing) {
      throw new ConflictException('Day already exists for this date');
    }

    return this.prisma.day.create({
      data: {
        date: parseDate(dto.date),
        userId,
      },
      include: {
        timeBlocks: true,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateDayDto) {
    await this.findOne(id, userId);

    return this.prisma.day.update({
      where: { id },
      data: dto,
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
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    return this.prisma.day.delete({
      where: { id },
    });
  }

  async updateCompletionStatus(dayId: string, tx?: TransactionClient) {
    const executeUpdate = async (client: TransactionClient) => {
      const day = await client.day.findUnique({
        where: { id: dayId },
        include: { timeBlocks: true },
      });

      if (!day || day.timeBlocks.length === 0) return;

      const allCompleted = day.timeBlocks.every((tb) => tb.isCompleted);

      if (day.isCompleted !== allCompleted) {
        await client.day.update({
          where: { id: dayId },
          data: { isCompleted: allCompleted },
        });

        // Recalculate streak whenever day completion status changes
        await this.updateUserStreak(client, day.userId);
      }
    };

    // If a transaction client is provided, use it directly
    // Otherwise, create a new transaction
    if (tx) {
      await executeUpdate(tx);
    } else {
      await this.prisma.$transaction(executeUpdate);
    }
  }

  private async updateUserStreak(tx: TransactionClient, userId: string) {
    // Fetch active days (with time blocks) for this user, sorted by date descending.
    // Days without time blocks are skipped — they never break a streak.
    // Limited to the last 365 days — longestStreak is preserved via Math.max with the stored value.
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);

    const activeDays = await tx.day.findMany({
      where: { userId, timeBlocks: { some: {} }, date: { gte: cutoffDate } },
      orderBy: { date: 'desc' },
      select: { date: true, isCompleted: true },
    });

    if (activeDays.length === 0) {
      // Only reset current state fields; preserve longestStreak as historical data
      await tx.user.update({
        where: { id: userId },
        data: {
          currentStreak: 0,
          lastCompletedDate: null,
        },
      });
      return;
    }

    // Calculate current streak (consecutive completed active days ending at most recent)
    // and longest streak (longest consecutive completed sequence ever)
    const { currentStreak, longestStreak, lastCompletedDate } =
      this.calculateStreaks(activeDays);

    // Get current longest from user to preserve it if it was higher
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { longestStreak: true },
    });

    const finalLongestStreak = Math.max(longestStreak, user?.longestStreak ?? 0);

    await tx.user.update({
      where: { id: userId },
      data: {
        currentStreak,
        longestStreak: finalLongestStreak,
        lastCompletedDate,
      },
    });
  }

  /**
   * Calculate current streak and longest streak from a list of active days.
   * Active days are days that have at least one time block.
   * Days without time blocks are invisible and never break a streak.
   */
  private calculateStreaks(
    activeDays: { date: Date; isCompleted: boolean }[],
  ): {
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate: Date | null;
  } {
    if (activeDays.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };
    }

    // Deduplicate by UTC day number (activeDays already sorted desc by query)
    const dayMap = new Map<number, boolean>();
    for (const day of activeDays) {
      const dayNum = Math.floor(day.date.getTime() / (1000 * 60 * 60 * 24));
      if (!dayMap.has(dayNum)) {
        dayMap.set(dayNum, day.isCompleted);
      }
    }

    // Sorted descending by day number: [dayNum, isCompleted]
    const uniqueDays = Array.from(dayMap.entries()).sort(
      (a, b) => b[0] - a[0],
    );

    // Find last completed date
    const lastCompletedEntry = activeDays.find((d) => d.isCompleted);
    const lastCompletedDate = lastCompletedEntry?.date ?? null;

    // Current streak: if the most recent active day is today and not yet
    // completed, skip it (grace period — the user hasn't finished yet).
    // Past uncompleted days always break the streak.
    const todayDayNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    let startIndex = 0;
    if (!uniqueDays[0][1] && uniqueDays[0][0] === todayDayNum) {
      startIndex = 1;
    }

    let currentStreak = 0;
    if (startIndex < uniqueDays.length && uniqueDays[startIndex][1]) {
      currentStreak = 1;
      for (let i = startIndex + 1; i < uniqueDays.length; i++) {
        if (uniqueDays[i][1]) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Longest streak: iterate chronologically (reverse of descending uniqueDays)
    let longestStreak = 0;
    let tempStreak = 0;
    for (let i = uniqueDays.length - 1; i >= 0; i--) {
      if (uniqueDays[i][1]) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    return { currentStreak, longestStreak, lastCompletedDate };
  }
}
