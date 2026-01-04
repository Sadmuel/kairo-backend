import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDayDto, UpdateDayDto } from './dto';

@Injectable()
export class DaysService {
  constructor(private prisma: PrismaService) {}

  async findByDateRange(userId: string, startDate: string, endDate: string) {
    return this.prisma.day.findMany({
      where: {
        userId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
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
        userId_date: { userId, date: new Date(date) },
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
        userId_date: { userId, date: new Date(dto.date) },
      },
    });

    if (existing) {
      throw new ConflictException('Day already exists for this date');
    }

    return this.prisma.day.create({
      data: {
        date: new Date(dto.date),
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

  async updateCompletionStatus(dayId: string) {
    const day = await this.prisma.day.findUnique({
      where: { id: dayId },
      include: { timeBlocks: true },
    });

    if (!day || day.timeBlocks.length === 0) return;

    const allCompleted = day.timeBlocks.every((tb) => tb.isCompleted);

    if (day.isCompleted !== allCompleted) {
      await this.prisma.day.update({
        where: { id: dayId },
        data: { isCompleted: allCompleted },
      });

      if (allCompleted) {
        await this.updateUserStreak(day.userId, day.date);
      }
    }
  }

  private async updateUserStreak(userId: string, date: Date) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);

    const isConsecutive =
      user.lastCompletedDate && user.lastCompletedDate.toDateString() === yesterday.toDateString();

    const newStreak = isConsecutive ? user.currentStreak + 1 : 1;
    const newLongest = Math.max(newStreak, user.longestStreak);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastCompletedDate: date,
      },
    });
  }
}
