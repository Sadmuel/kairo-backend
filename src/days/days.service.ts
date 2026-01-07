import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDayDto, UpdateDayDto } from './dto';
import { parseDate } from './pipes';

// Type for Prisma transaction client
type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class DaysService {
  constructor(private prisma: PrismaService) {}

  async findByDateRange(userId: string, startDate: string, endDate: string) {
    return this.prisma.day.findMany({
      where: {
        userId,
        date: {
          gte: parseDate(startDate),
          lte: parseDate(endDate),
        },
      },
      include: {
        timeBlocks: {
          orderBy: { order: 'asc' },
          include: {
            notes: { orderBy: { order: 'asc' } },
          },
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
          },
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
          },
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

        if (allCompleted) {
          await this.updateUserStreak(client, day.userId, day.date);
        }
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

  private async updateUserStreak(
    tx: TransactionClient,
    userId: string,
    date: Date,
  ) {
    const user = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const isConsecutive =
      user.lastCompletedDate && this.isConsecutiveDay(user.lastCompletedDate, date);

    const newStreak = isConsecutive ? user.currentStreak + 1 : 1;
    const newLongest = Math.max(newStreak, user.longestStreak);

    await tx.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastCompletedDate: date,
      },
    });
  }

  /**
   * Checks if lastCompleted is exactly one UTC day before current.
   */
  private isConsecutiveDay(lastCompleted: Date, current: Date): boolean {
    // Calculate the difference in UTC days
    const lastUtcDays = Math.floor(lastCompleted.getTime() / (1000 * 60 * 60 * 24));
    const currentUtcDays = Math.floor(current.getTime() / (1000 * 60 * 60 * 24));
    return currentUtcDays - lastUtcDays === 1;
  }
}
