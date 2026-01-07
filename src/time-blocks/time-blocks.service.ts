import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('End time must be after start time');
    }

    // If order is explicitly provided, check for conflicts first
    if (dto.order !== undefined) {
      const existing = await this.prisma.timeBlock.findFirst({
        where: { dayId: dto.dayId, order: dto.order },
      });
      if (existing) {
        throw new BadRequestException(
          `A time block with order ${dto.order} already exists for this day`,
        );
      }
      return this.prisma.timeBlock.create({
        data: {
          name: dto.name,
          startTime: dto.startTime,
          endTime: dto.endTime,
          color: dto.color,
          order: dto.order,
          dayId: dto.dayId,
        },
        include: {
          notes: true,
        },
      });
    }

    // Atomically get and increment the order counter
    const day = await this.prisma.day.update({
      where: { id: dto.dayId },
      data: { nextTimeBlockOrder: { increment: 1 } },
      select: { nextTimeBlockOrder: true },
    });
    const order = day.nextTimeBlockOrder - 1;

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
    // Verify ownership first (outside transaction for better error messages)
    const timeBlock = await this.findOne(id, userId);
    const { dayId } = timeBlock;

    await this.prisma.$transaction(async (tx) => {
      // Re-fetch within transaction for consistency
      const block = await tx.timeBlock.findUnique({
        where: { id },
      });

      if (!block) {
        throw new NotFoundException('Time block not found');
      }

      await tx.timeBlock.delete({
        where: { id },
      });

      // Reorder remaining time blocks within the same transaction
      await tx.timeBlock.updateMany({
        where: {
          dayId: block.dayId,
          order: { gt: block.order },
        },
        data: {
          order: { decrement: 1 },
        },
      });

      // Update completion status within the same transaction for atomicity
      await this.daysService.updateCompletionStatus(dayId, tx);
    });
  }

  async reorder(userId: string, dayId: string, dto: ReorderTimeBlocksDto) {
    await this.daysService.findOne(dayId, userId);

    // Verify all time block IDs belong to the specified day
    const timeBlocks = await this.prisma.timeBlock.findMany({
      where: { dayId },
      select: { id: true },
    });
    const validIds = new Set(timeBlocks.map((tb) => tb.id));

    for (const id of dto.orderedIds) {
      if (!validIds.has(id)) {
        throw new BadRequestException(`Time block ${id} does not belong to this day`);
      }
    }

    // Two-phase update to avoid unique constraint conflicts:
    // Phase 1: Set all orders to negative temporary values
    const tempUpdates = dto.orderedIds.map((id, index) =>
      this.prisma.timeBlock.update({
        where: { id },
        data: { order: -(index + 1) },
      }),
    );

    // Phase 2: Set all orders to their final positive values
    const finalUpdates = dto.orderedIds.map((id, index) =>
      this.prisma.timeBlock.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction([...tempUpdates, ...finalUpdates]);

    return this.findByDay(dayId, userId);
  }
}
