import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DaysService } from 'src/days/days.service';
import { TimeBlocksService } from 'src/time-blocks/time-blocks.service';
import {
  CreateTodoDto,
  UpdateTodoDto,
  ReorderTodosDto,
  MoveTodoDto,
  TodoFilterQueryDto,
} from './dto';
import { Prisma } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

type TodoContext =
  | { type: 'inbox' }
  | { type: 'day'; dayId: string }
  | { type: 'timeBlock'; timeBlockId: string };

@Injectable()
export class TodosService {
  constructor(
    private prisma: PrismaService,
    private daysService: DaysService,
    private timeBlocksService: TimeBlocksService,
  ) {}

  async findAll(userId: string, filters: TodoFilterQueryDto) {
    const where: {
      userId: string;
      dayId?: string | null;
      timeBlockId?: string | null;
      isCompleted?: boolean;
    } = { userId };

    if (filters.dayId) {
      await this.daysService.findOne(filters.dayId, userId);
      where.dayId = filters.dayId;
      where.timeBlockId = null;
    } else if (filters.timeBlockId) {
      await this.timeBlocksService.findOne(filters.timeBlockId, userId);
      where.timeBlockId = filters.timeBlockId;
    } else if (filters.inbox) {
      where.dayId = null;
      where.timeBlockId = null;
    }

    if (filters.isCompleted !== undefined) {
      where.isCompleted = filters.isCompleted;
    }

    return this.prisma.todo.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        day: true,
        timeBlock: true,
      },
    });
  }

  async findOne(id: string, userId: string) {
    const todo = await this.prisma.todo.findFirst({
      where: { id, userId },
      include: {
        day: true,
        timeBlock: true,
      },
    });

    if (!todo) {
      throw new NotFoundException('Todo not found');
    }

    return todo;
  }

  async create(userId: string, dto: CreateTodoDto) {
    if (dto.dayId && dto.timeBlockId) {
      throw new BadRequestException('Todo cannot have both dayId and timeBlockId');
    }

    if (dto.dayId) {
      await this.daysService.findOne(dto.dayId, userId);
    }
    if (dto.timeBlockId) {
      await this.timeBlocksService.findOne(dto.timeBlockId, userId);
    }

    let order = dto.order;
    if (order === undefined) {
      order = await this.getNextOrder(
        userId,
        this.getContext(dto.dayId ?? null, dto.timeBlockId ?? null),
      );
    }

    return this.prisma.todo.create({
      data: {
        title: dto.title,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        order,
        userId,
        dayId: dto.dayId ?? null,
        timeBlockId: dto.timeBlockId ?? null,
      },
      include: {
        day: true,
        timeBlock: true,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateTodoDto) {
    await this.findOne(id, userId);

    return this.prisma.todo.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.isCompleted !== undefined && { isCompleted: dto.isCompleted }),
        ...(dto.deadline !== undefined && {
          deadline: dto.deadline ? new Date(dto.deadline) : null,
        }),
      },
      include: {
        day: true,
        timeBlock: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    const todo = await this.findOne(id, userId);
    const context = this.getContext(todo.dayId, todo.timeBlockId);

    await this.prisma.$transaction(async (tx) => {
      await tx.todo.delete({
        where: { id },
      });

      await this.reorderAfterDelete(userId, context, todo.order, tx);
    });
  }

  async reorder(
    userId: string,
    context: { dayId?: string; timeBlockId?: string; inbox?: boolean },
    dto: ReorderTodosDto,
  ) {
    if (context.dayId && context.timeBlockId) {
      throw new BadRequestException('Cannot specify both dayId and timeBlockId');
    }

    if (context.dayId) {
      await this.daysService.findOne(context.dayId, userId);
    }
    if (context.timeBlockId) {
      await this.timeBlocksService.findOne(context.timeBlockId, userId);
    }

    // Build where clause for context validation
    const contextWhere: Prisma.TodoWhereInput = { userId };
    if (context.inbox) {
      contextWhere.dayId = null;
      contextWhere.timeBlockId = null;
    } else if (context.dayId) {
      contextWhere.dayId = context.dayId;
      contextWhere.timeBlockId = null;
    } else if (context.timeBlockId) {
      contextWhere.timeBlockId = context.timeBlockId;
    }

    // Validate ownership and context for all todos
    const existingTodos = await this.prisma.todo.findMany({
      where: {
        id: { in: dto.orderedIds },
        ...contextWhere,
      },
      select: { id: true },
    });

    const existingIds = new Set(existingTodos.map((t) => t.id));

    // Check count matches
    if (existingTodos.length !== dto.orderedIds.length) {
      throw new ForbiddenException(
        'One or more todos do not exist, do not belong to you, or are not in the specified context',
      );
    }

    // Verify all requested IDs were found
    for (const id of dto.orderedIds) {
      if (!existingIds.has(id)) {
        throw new ForbiddenException(
          'One or more todos do not exist, do not belong to you, or are not in the specified context',
        );
      }
    }

    const updates = dto.orderedIds.map((id, index) =>
      this.prisma.todo.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findAll(userId, {
      dayId: context.dayId,
      timeBlockId: context.timeBlockId,
      inbox: context.inbox,
    });
  }

  async move(id: string, userId: string, dto: MoveTodoDto) {
    if (dto.targetDayId && dto.targetTimeBlockId) {
      throw new BadRequestException('Cannot specify both targetDayId and targetTimeBlockId');
    }

    // Validate targets exist before starting transaction
    if (dto.targetDayId) {
      await this.daysService.findOne(dto.targetDayId, userId);
    }
    if (dto.targetTimeBlockId) {
      await this.timeBlocksService.findOne(dto.targetTimeBlockId, userId);
    }

    const todo = await this.findOne(id, userId);

    const sourceContext = this.getContext(todo.dayId, todo.timeBlockId);
    const targetContext = this.getContext(dto.targetDayId ?? null, dto.targetTimeBlockId ?? null);

    const isSameContext = this.isSameContext(sourceContext, targetContext);

    if (isSameContext) {
      return todo;
    }

    // Execute move atomically
    return this.prisma.$transaction(async (tx) => {
      const newOrder = await this.getNextOrder(userId, targetContext, tx);

      const updated = await tx.todo.update({
        where: { id },
        data: {
          dayId: dto.targetDayId ?? null,
          timeBlockId: dto.targetTimeBlockId ?? null,
          order: newOrder,
        },
        include: {
          day: true,
          timeBlock: true,
        },
      });

      await this.reorderAfterDelete(userId, sourceContext, todo.order, tx);

      return updated;
    });
  }

  private getContext(dayId: string | null, timeBlockId: string | null): TodoContext {
    if (timeBlockId) {
      return { type: 'timeBlock', timeBlockId };
    }
    if (dayId) {
      return { type: 'day', dayId };
    }
    return { type: 'inbox' };
  }

  private isSameContext(a: TodoContext, b: TodoContext): boolean {
    if (a.type !== b.type) return false;
    if (a.type === 'inbox') return true;
    if (a.type === 'day' && b.type === 'day') return a.dayId === b.dayId;
    if (a.type === 'timeBlock' && b.type === 'timeBlock') return a.timeBlockId === b.timeBlockId;
    return false;
  }

  private async getNextOrder(
    userId: string,
    context: TodoContext,
    tx?: TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    const where: {
      userId: string;
      dayId?: string | null;
      timeBlockId?: string | null;
    } = { userId };

    switch (context.type) {
      case 'inbox':
        where.dayId = null;
        where.timeBlockId = null;
        break;
      case 'day':
        where.dayId = context.dayId;
        where.timeBlockId = null;
        break;
      case 'timeBlock':
        where.timeBlockId = context.timeBlockId;
        break;
    }

    const lastTodo = await client.todo.findFirst({
      where,
      orderBy: { order: 'desc' },
    });

    return lastTodo ? lastTodo.order + 1 : 0;
  }

  private async reorderAfterDelete(
    userId: string,
    context: TodoContext,
    deletedOrder: number,
    tx?: TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const where: {
      userId: string;
      order: { gt: number };
      dayId?: string | null;
      timeBlockId?: string | null;
    } = {
      userId,
      order: { gt: deletedOrder },
    };

    switch (context.type) {
      case 'inbox':
        where.dayId = null;
        where.timeBlockId = null;
        break;
      case 'day':
        where.dayId = context.dayId;
        where.timeBlockId = null;
        break;
      case 'timeBlock':
        where.timeBlockId = context.timeBlockId;
        break;
    }

    await client.todo.updateMany({
      where,
      data: {
        order: { decrement: 1 },
      },
    });
  }
}
