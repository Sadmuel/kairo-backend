import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TimeBlocksService } from 'src/time-blocks/time-blocks.service';
import { CreateNoteDto, UpdateNoteDto, ReorderNotesDto } from './dto';

@Injectable()
export class NotesService {
  constructor(
    private prisma: PrismaService,
    private timeBlocksService: TimeBlocksService,
  ) {}

  async findByTimeBlock(timeBlockId: string, userId: string) {
    await this.timeBlocksService.findOne(timeBlockId, userId);

    return this.prisma.note.findMany({
      where: { timeBlockId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    const note = await this.prisma.note.findFirst({
      where: { id },
      include: {
        timeBlock: {
          include: { day: true },
        },
      },
    });

    if (!note || note.timeBlock.day.userId !== userId) {
      throw new NotFoundException('Note not found');
    }

    return note;
  }

  async create(userId: string, dto: CreateNoteDto) {
    await this.timeBlocksService.findOne(dto.timeBlockId, userId);

    // If order is explicitly provided, use it directly
    if (dto.order !== undefined) {
      return this.prisma.note.create({
        data: {
          content: dto.content,
          order: dto.order,
          timeBlockId: dto.timeBlockId,
        },
      });
    }

    // Atomically get and increment the order counter
    const timeBlock = await this.prisma.timeBlock.update({
      where: { id: dto.timeBlockId },
      data: { nextNoteOrder: { increment: 1 } },
      select: { nextNoteOrder: true },
    });
    const order = timeBlock.nextNoteOrder - 1;

    return this.prisma.note.create({
      data: {
        content: dto.content,
        order,
        timeBlockId: dto.timeBlockId,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateNoteDto) {
    await this.findOne(id, userId);

    return this.prisma.note.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string) {
    // Verify ownership first (outside transaction for better error messages)
    await this.findOne(id, userId);

    await this.prisma.$transaction(async (tx) => {
      // Re-fetch within transaction for consistency
      const note = await tx.note.findUnique({
        where: { id },
      });

      if (!note) {
        throw new NotFoundException('Note not found');
      }

      await tx.note.delete({
        where: { id },
      });

      // Reorder remaining notes within the same transaction
      await tx.note.updateMany({
        where: {
          timeBlockId: note.timeBlockId,
          order: { gt: note.order },
        },
        data: {
          order: { decrement: 1 },
        },
      });
    });
  }

  async reorder(userId: string, timeBlockId: string, dto: ReorderNotesDto) {
    await this.timeBlocksService.findOne(timeBlockId, userId);

    // Verify all note IDs belong to the specified timeBlock
    const notes = await this.prisma.note.findMany({
      where: { timeBlockId },
      select: { id: true },
    });
    const validIds = new Set(notes.map((n) => n.id));

    for (const id of dto.orderedIds) {
      if (!validIds.has(id)) {
        throw new BadRequestException(`Note ${id} does not belong to this time block`);
      }
    }

    // Two-phase update to avoid unique constraint conflicts:
    // Phase 1: Set all orders to negative temporary values
    const tempUpdates = dto.orderedIds.map((id, index) =>
      this.prisma.note.update({
        where: { id },
        data: { order: -(index + 1) },
      }),
    );

    // Phase 2: Set all orders to their final positive values
    const finalUpdates = dto.orderedIds.map((id, index) =>
      this.prisma.note.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction([...tempUpdates, ...finalUpdates]);

    return this.findByTimeBlock(timeBlockId, userId);
  }
}
