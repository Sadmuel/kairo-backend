import { Injectable, NotFoundException } from '@nestjs/common';
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

    let order = dto.order;
    if (order === undefined) {
      const lastNote = await this.prisma.note.findFirst({
        where: { timeBlockId: dto.timeBlockId },
        orderBy: { order: 'desc' },
      });
      order = lastNote ? lastNote.order + 1 : 0;
    }

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
    const note = await this.findOne(id, userId);

    await this.prisma.note.delete({
      where: { id },
    });

    await this.reorderAfterDelete(note.timeBlockId, note.order);
  }

  async reorder(userId: string, timeBlockId: string, dto: ReorderNotesDto) {
    await this.timeBlocksService.findOne(timeBlockId, userId);

    const updates = dto.orderedIds.map((id, index) =>
      this.prisma.note.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findByTimeBlock(timeBlockId, userId);
  }

  private async reorderAfterDelete(timeBlockId: string, deletedOrder: number) {
    await this.prisma.note.updateMany({
      where: {
        timeBlockId,
        order: { gt: deletedOrder },
      },
      data: {
        order: { decrement: 1 },
      },
    });
  }
}
