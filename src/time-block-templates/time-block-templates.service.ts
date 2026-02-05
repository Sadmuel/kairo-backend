import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, TransactionClient } from 'src/prisma/prisma.service';
import {
  CreateTimeBlockTemplateDto,
  UpdateTimeBlockTemplateDto,
  DeactivateTemplateDto,
} from './dto';

@Injectable()
export class TimeBlockTemplatesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.timeBlockTemplate.findMany({
      where: { userId },
      include: {
        notes: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const template = await this.prisma.timeBlockTemplate.findFirst({
      where: { id, userId },
      include: {
        notes: { orderBy: { order: 'asc' } },
      },
    });

    if (!template) {
      throw new NotFoundException('Time block template not found');
    }

    return template;
  }

  async create(userId: string, dto: CreateTimeBlockTemplateDto) {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('End time must be after start time');
    }

    // Ensure daysOfWeek has unique values
    const uniqueDays = [...new Set(dto.daysOfWeek)];
    if (uniqueDays.length !== dto.daysOfWeek.length) {
      throw new BadRequestException('daysOfWeek must contain unique values');
    }

    return this.prisma.timeBlockTemplate.create({
      data: {
        name: dto.name,
        startTime: dto.startTime,
        endTime: dto.endTime,
        color: dto.color,
        daysOfWeek: dto.daysOfWeek,
        userId,
        notes: dto.notes?.length
          ? {
              create: dto.notes.map((note) => ({
                content: note.content,
                order: note.order,
              })),
            }
          : undefined,
      },
      include: {
        notes: { orderBy: { order: 'asc' } },
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateTimeBlockTemplateDto) {
    const template = await this.findOne(id, userId);

    const startTime = dto.startTime ?? template.startTime;
    const endTime = dto.endTime ?? template.endTime;
    if (startTime >= endTime) {
      throw new BadRequestException('End time must be after start time');
    }

    if (dto.daysOfWeek) {
      const uniqueDays = [...new Set(dto.daysOfWeek)];
      if (uniqueDays.length !== dto.daysOfWeek.length) {
        throw new BadRequestException('daysOfWeek must contain unique values');
      }
    }

    return this.prisma.timeBlockTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        startTime: dto.startTime,
        endTime: dto.endTime,
        color: dto.color,
        daysOfWeek: dto.daysOfWeek,
      },
      include: {
        notes: { orderBy: { order: 'asc' } },
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    await this.prisma.timeBlockTemplate.delete({
      where: { id },
    });
  }

  async deactivate(id: string, userId: string, dto: DeactivateTemplateDto) {
    await this.findOne(id, userId);

    const activeUntil = dto.activeUntil
      ? new Date(dto.activeUntil)
      : new Date();

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      await tx.timeBlockTemplate.update({
        where: { id },
        data: { isActive: false, activeUntil },
      });

      if (dto.deleteFutureOccurrences) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        // Delete future uncompleted materialized blocks
        await tx.timeBlock.deleteMany({
          where: {
            templateId: id,
            isCompleted: false,
            day: { date: { gte: today } },
          },
        });
      }

      return tx.timeBlockTemplate.findUnique({
        where: { id },
        include: { notes: { orderBy: { order: 'asc' } } },
      });
    });
  }

  // ─── Materialization Engine ──────────────────────────────────────────

  async materializeForDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    // 1. Fetch active templates for this user
    const templates = await this.prisma.timeBlockTemplate.findMany({
      where: {
        userId,
        isActive: true,
        OR: [{ activeUntil: null }, { activeUntil: { gte: startDate } }],
      },
      include: {
        notes: { orderBy: { order: 'asc' } },
      },
    });

    if (templates.length === 0) return;

    const templateIds = templates.map((t) => t.id);

    // 2. Fetch existing materialized blocks in range
    const existingBlocks = await this.prisma.timeBlock.findMany({
      where: {
        templateId: { in: templateIds },
        day: {
          userId,
          date: { gte: startDate, lte: endDate },
        },
      },
      select: { templateId: true, day: { select: { date: true } } },
    });

    // 3. Fetch exclusions in range
    const exclusions = await this.prisma.materializationExclusion.findMany({
      where: {
        templateId: { in: templateIds },
        date: { gte: startDate, lte: endDate },
      },
    });

    // 4. Build lookup sets
    const existingSet = new Set(
      existingBlocks.map(
        (b) =>
          `${b.templateId}:${b.day.date.toISOString().split('T')[0]}`,
      ),
    );
    const exclusionSet = new Set(
      exclusions.map(
        (e) =>
          `${e.templateId}:${e.date.toISOString().split('T')[0]}`,
      ),
    );

    // 5. Collect all materializations needed
    const toMaterialize: {
      template: (typeof templates)[0];
      date: Date;
    }[] = [];

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const jsDay = currentDate.getUTCDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;
      const dateStr = currentDate.toISOString().split('T')[0];

      for (const template of templates) {
        if (!template.daysOfWeek.includes(isoDay)) continue;

        // Skip if activeUntil is before this date
        if (template.activeUntil && template.activeUntil < currentDate) continue;

        const key = `${template.id}:${dateStr}`;
        if (existingSet.has(key) || exclusionSet.has(key)) continue;

        toMaterialize.push({
          template,
          date: new Date(currentDate),
        });
      }

      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    if (toMaterialize.length === 0) return;

    // 6. Materialize in a single transaction
    try {
      await this.prisma.$transaction(async (tx: TransactionClient) => {
        for (const { template, date } of toMaterialize) {
          // Upsert day
          const day = await tx.day.upsert({
            where: { userId_date: { userId, date } },
            create: { date, userId },
            update: {},
          });

          // Atomically get next order
          const updatedDay = await tx.day.update({
            where: { id: day.id },
            data: { nextTimeBlockOrder: { increment: 1 } },
            select: { nextTimeBlockOrder: true },
          });
          const order = updatedDay.nextTimeBlockOrder - 1;

          // Create time block
          const newBlock = await tx.timeBlock.create({
            data: {
              name: template.name,
              startTime: template.startTime,
              endTime: template.endTime,
              color: template.color,
              isCompleted: false,
              order,
              dayId: day.id,
              templateId: template.id,
            },
          });

          // Copy template notes
          if (template.notes.length > 0) {
            await tx.note.createMany({
              data: template.notes.map((note, index) => ({
                content: note.content,
                order: index,
                timeBlockId: newBlock.id,
              })),
            });
          }
        }
      });
    } catch (error) {
      // Handle unique constraint violations gracefully (concurrent requests)
      if (error?.code === 'P2002') return;
      throw error;
    }
  }

  async materializeForDate(userId: string, date: Date): Promise<void> {
    return this.materializeForDateRange(userId, date, date);
  }
}
