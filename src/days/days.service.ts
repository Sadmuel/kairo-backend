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
    // Fetch all completed days for this user, sorted by date descending
    const completedDays = await tx.day.findMany({
      where: { userId, isCompleted: true },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    if (completedDays.length === 0) {
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

    // Calculate current streak (consecutive days ending at most recent completed day)
    // and longest streak (longest consecutive sequence ever)
    const { currentStreak, longestStreak, lastCompletedDate } = this.calculateStreaks(
      completedDays.map((d) => d.date),
    );

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
   * Calculate current streak and longest streak from a list of completed dates.
   * Dates should be sorted in descending order (most recent first).
   */
  private calculateStreaks(dates: Date[]): {
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate: Date;
  } {
    if (dates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null as unknown as Date };
    }

    // Convert dates to UTC day numbers for easy comparison
    const dayNumbers = dates
      .map((d) => Math.floor(d.getTime() / (1000 * 60 * 60 * 24)))
      .sort((a, b) => b - a); // Sort descending (most recent first)

    // Remove duplicates (same day)
    const uniqueDays = [...new Set(dayNumbers)];

    const lastCompletedDate = dates[0];

    // Calculate current streak (consecutive days from the most recent)
    let currentStreak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      if (uniqueDays[i - 1] - uniqueDays[i] === 1) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 1;
    let tempStreak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      if (uniqueDays[i - 1] - uniqueDays[i] === 1) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }

    return { currentStreak, longestStreak, lastCompletedDate };
  }
}
