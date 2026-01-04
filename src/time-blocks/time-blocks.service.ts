import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DaysService } from 'src/days/days.service';
import { CreateTimeBlockDto, UpdateTimeBlockDto, ReorderTimeBlocksDto } from './dto';

@Injectable()
export class TimeBlocksService {
  constructor(
    private prisma: PrismaService,
    private daysService: DaysService,
  ) {}

  async findByDay(dayId: string, userId: string) {
    await this.daysService.findOne(dayId, userId);

    return this.prisma.timeBlock.findMany({
      where: { dayId },
      include: {
        notes: { orderBy: { order: 'asc' } },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const timeBlock = await this.prisma.timeBlock.findFirst({
      where: { id },
      include: {
        day: true,
        notes: { orderBy: { order: 'asc' } },
      },
    });

    if (!timeBlock || timeBlock.day.userId !== userId) {
      throw new NotFoundException('Time block not found');
    }

    return timeBlock;
  }

  async create(userId: string, dto: CreateTimeBlockDto) {
    await this.daysService.findOne(dto.dayId, userId);

    let order = dto.order;
    if (order === undefined) {
      const lastBlock = await this.prisma.timeBlock.findFirst({
        where: { dayId: dto.dayId },
        orderBy: { order: 'desc' },
      });
      order = lastBlock ? lastBlock.order + 1 : 0;
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('End time must be after start time');
    }

    return this.prisma.timeBlock.create({
      data: {
        name: dto.name,
        startTime: dto.startTime,
        endTime: dto.endTime,
        color: dto.color,
        order,
        dayId: dto.dayId,
      },
      include: {
        notes: true,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateTimeBlockDto) {
    const timeBlock = await this.findOne(id, userId);

    const startTime = dto.startTime ?? timeBlock.startTime;
    const endTime = dto.endTime ?? timeBlock.endTime;
    if (startTime >= endTime) {
      throw new BadRequestException('End time must be after start time');
    }

    const updated = await this.prisma.timeBlock.update({
      where: { id },
      data: dto,
      include: {
        notes: { orderBy: { order: 'asc' } },
      },
    });

    if (dto.isCompleted !== undefined) {
      await this.daysService.updateCompletionStatus(timeBlock.dayId);
    }

    return updated;
  }

  async remove(id: string, userId: string) {
    const timeBlock = await this.findOne(id, userId);

    await this.prisma.timeBlock.delete({
      where: { id },
    });

    await this.reorderAfterDelete(timeBlock.dayId, timeBlock.order);
    await this.daysService.updateCompletionStatus(timeBlock.dayId);
  }

  async reorder(userId: string, dayId: string, dto: ReorderTimeBlocksDto) {
    await this.daysService.findOne(dayId, userId);

    const updates = dto.orderedIds.map((id, index) =>
      this.prisma.timeBlock.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findByDay(dayId, userId);
  }

  private async reorderAfterDelete(dayId: string, deletedOrder: number) {
    await this.prisma.timeBlock.updateMany({
      where: {
        dayId,
        order: { gt: deletedOrder },
      },
      data: {
        order: { decrement: 1 },
      },
    });
  }
}
