import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TodosService } from './todos.service';
import { PrismaService } from '../prisma/prisma.service';
import { DaysService } from '../days/days.service';
import { TimeBlocksService } from '../time-blocks/time-blocks.service';

describe('TodosService', () => {
  let service: TodosService;
  let prisma: jest.Mocked<PrismaService>;
  let daysService: jest.Mocked<DaysService>;
  let timeBlocksService: jest.Mocked<TimeBlocksService>;

  const mockDay = {
    id: 'day-123',
    date: new Date('2024-01-15'),
    isCompleted: false,
    userId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTimeBlock = {
    id: 'tb-123',
    name: 'Morning Routine',
    startTime: '06:00',
    endTime: '08:00',
    isCompleted: false,
    order: 0,
    color: '#A5D8FF',
    dayId: 'day-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    day: mockDay,
    notes: [],
  };

  const mockTodo = {
    id: 'todo-123',
    title: 'Complete task',
    isCompleted: false,
    deadline: null,
    order: 0,
    userId: 'user-123',
    dayId: null,
    timeBlockId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    day: null,
    timeBlock: null,
  };

  const mockPrismaService = {
    todo: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockDaysService = {
    findOne: jest.fn(),
  };

  const mockTimeBlocksService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: DaysService, useValue: mockDaysService },
        { provide: TimeBlocksService, useValue: mockTimeBlocksService },
      ],
    }).compile();

    service = module.get<TodosService>(TodosService);
    prisma = module.get(PrismaService);
    daysService = module.get(DaysService);
    timeBlocksService = module.get(TimeBlocksService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all user todos without filters', async () => {
      const todos = [mockTodo];
      mockPrismaService.todo.findMany.mockResolvedValue(todos);

      const result = await service.findAll('user-123', {});

      expect(result).toEqual(todos);
      expect(prisma.todo.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { order: 'asc' },
        include: { day: true, timeBlock: true },
      });
    });

    it('should filter by dayId', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.todo.findMany.mockResolvedValue([]);

      await service.findAll('user-123', { dayId: 'day-123' });

      expect(daysService.findOne).toHaveBeenCalledWith('day-123', 'user-123');
      expect(prisma.todo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', dayId: 'day-123', timeBlockId: null },
        }),
      );
    });

    it('should filter by timeBlockId', async () => {
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);
      mockPrismaService.todo.findMany.mockResolvedValue([]);

      await service.findAll('user-123', { timeBlockId: 'tb-123' });

      expect(timeBlocksService.findOne).toHaveBeenCalledWith(
        'tb-123',
        'user-123',
      );
      expect(prisma.todo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', timeBlockId: 'tb-123' },
        }),
      );
    });

    it('should filter inbox todos', async () => {
      mockPrismaService.todo.findMany.mockResolvedValue([]);

      await service.findAll('user-123', { inbox: true });

      expect(prisma.todo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', dayId: null, timeBlockId: null },
        }),
      );
    });

    it('should filter by completion status', async () => {
      mockPrismaService.todo.findMany.mockResolvedValue([]);

      await service.findAll('user-123', { isCompleted: true });

      expect(prisma.todo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', isCompleted: true },
        }),
      );
    });

    it('should throw NotFoundException when day not found', async () => {
      mockDaysService.findOne.mockRejectedValue(
        new NotFoundException('Day not found'),
      );

      await expect(
        service.findAll('user-123', { dayId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return todo when found', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(mockTodo);

      const result = await service.findOne('todo-123', 'user-123');

      expect(result).toEqual(mockTodo);
      expect(prisma.todo.findFirst).toHaveBeenCalledWith({
        where: { id: 'todo-123', userId: 'user-123' },
        include: { day: true, timeBlock: true },
      });
    });

    it('should throw NotFoundException when todo not found', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow(
        'Todo not found',
      );
    });
  });

  describe('create', () => {
    it('should create inbox todo with auto-assigned order', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue({ order: 2 });
      mockPrismaService.todo.create.mockResolvedValue(mockTodo);

      await service.create('user-123', { title: 'New todo' });

      expect(prisma.todo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'New todo',
            order: 3,
            userId: 'user-123',
            dayId: null,
            timeBlockId: null,
          }),
        }),
      );
    });

    it('should create first todo with order 0', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(null);
      mockPrismaService.todo.create.mockResolvedValue(mockTodo);

      await service.create('user-123', { title: 'New todo' });

      expect(prisma.todo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 0 }),
        }),
      );
    });

    it('should use provided order when specified', async () => {
      mockPrismaService.todo.create.mockResolvedValue(mockTodo);

      await service.create('user-123', { title: 'New todo', order: 5 });

      expect(prisma.todo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 5 }),
        }),
      );
    });

    it('should create day todo', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.todo.findFirst.mockResolvedValue(null);
      mockPrismaService.todo.create.mockResolvedValue({
        ...mockTodo,
        dayId: 'day-123',
      });

      await service.create('user-123', {
        title: 'Day todo',
        dayId: 'day-123',
      });

      expect(daysService.findOne).toHaveBeenCalledWith('day-123', 'user-123');
      expect(prisma.todo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ dayId: 'day-123' }),
        }),
      );
    });

    it('should create time block todo', async () => {
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);
      mockPrismaService.todo.findFirst.mockResolvedValue(null);
      mockPrismaService.todo.create.mockResolvedValue({
        ...mockTodo,
        timeBlockId: 'tb-123',
      });

      await service.create('user-123', {
        title: 'Block todo',
        timeBlockId: 'tb-123',
      });

      expect(timeBlocksService.findOne).toHaveBeenCalledWith(
        'tb-123',
        'user-123',
      );
      expect(prisma.todo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ timeBlockId: 'tb-123' }),
        }),
      );
    });

    it('should throw BadRequestException when both dayId and timeBlockId provided', async () => {
      await expect(
        service.create('user-123', {
          title: 'Invalid todo',
          dayId: 'day-123',
          timeBlockId: 'tb-123',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('user-123', {
          title: 'Invalid todo',
          dayId: 'day-123',
          timeBlockId: 'tb-123',
        }),
      ).rejects.toThrow('Todo cannot have both dayId and timeBlockId');
    });

    it('should throw NotFoundException when day not found', async () => {
      mockDaysService.findOne.mockRejectedValue(
        new NotFoundException('Day not found'),
      );

      await expect(
        service.create('user-123', { title: 'Todo', dayId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create todo with deadline', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(null);
      mockPrismaService.todo.create.mockResolvedValue({
        ...mockTodo,
        deadline: new Date('2024-12-31'),
      });

      await service.create('user-123', {
        title: 'Todo with deadline',
        deadline: '2024-12-31T23:59:59.000Z',
      });

      expect(prisma.todo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deadline: new Date('2024-12-31T23:59:59.000Z'),
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update todo title', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(mockTodo);
      mockPrismaService.todo.update.mockResolvedValue({
        ...mockTodo,
        title: 'Updated title',
      });

      const result = await service.update('todo-123', 'user-123', {
        title: 'Updated title',
      });

      expect(result.title).toBe('Updated title');
      expect(prisma.todo.update).toHaveBeenCalledWith({
        where: { id: 'todo-123' },
        data: { title: 'Updated title' },
        include: { day: true, timeBlock: true },
      });
    });

    it('should update todo completion status', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(mockTodo);
      mockPrismaService.todo.update.mockResolvedValue({
        ...mockTodo,
        isCompleted: true,
      });

      const result = await service.update('todo-123', 'user-123', {
        isCompleted: true,
      });

      expect(result.isCompleted).toBe(true);
    });

    it('should update todo deadline', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(mockTodo);
      mockPrismaService.todo.update.mockResolvedValue({
        ...mockTodo,
        deadline: new Date('2024-12-31'),
      });

      await service.update('todo-123', 'user-123', {
        deadline: '2024-12-31T23:59:59.000Z',
      });

      expect(prisma.todo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deadline: new Date('2024-12-31T23:59:59.000Z') },
        }),
      );
    });

    it('should remove deadline when set to null', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue({
        ...mockTodo,
        deadline: new Date(),
      });
      mockPrismaService.todo.update.mockResolvedValue({
        ...mockTodo,
        deadline: null,
      });

      await service.update('todo-123', 'user-123', { deadline: null });

      expect(prisma.todo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deadline: null },
        }),
      );
    });

    it('should throw NotFoundException when todo not found', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'user-123', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    // Helper to create transaction mock for remove
    const setupRemoveTransactionMock = (txMocks: {
      delete?: jest.Mock;
      updateMany?: jest.Mock;
    }) => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          todo: {
            delete: txMocks.delete ?? jest.fn(),
            updateMany: txMocks.updateMany ?? jest.fn(),
          },
        };
        return callback(tx);
      });
    };

    it('should delete todo and reorder remaining atomically', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(mockTodo);

      const txDelete = jest.fn().mockResolvedValue(mockTodo);
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 2 });

      setupRemoveTransactionMock({
        delete: txDelete,
        updateMany: txUpdateMany,
      });

      await service.remove('todo-123', 'user-123');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(txDelete).toHaveBeenCalledWith({
        where: { id: 'todo-123' },
      });
      expect(txUpdateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          order: { gt: 0 },
          dayId: null,
          timeBlockId: null,
        },
        data: { order: { decrement: 1 } },
      });
    });

    it('should reorder remaining day todos', async () => {
      const dayTodo = { ...mockTodo, dayId: 'day-123', order: 1 };
      mockPrismaService.todo.findFirst.mockResolvedValue(dayTodo);

      const txDelete = jest.fn().mockResolvedValue(dayTodo);
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

      setupRemoveTransactionMock({
        delete: txDelete,
        updateMany: txUpdateMany,
      });

      await service.remove('todo-123', 'user-123');

      expect(txUpdateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          order: { gt: 1 },
          dayId: 'day-123',
          timeBlockId: null,
        },
        data: { order: { decrement: 1 } },
      });
    });

    it('should throw NotFoundException when todo not found', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reorder', () => {
    it('should reorder inbox todos', async () => {
      // Mock validation findMany to return todos matching the orderedIds
      mockPrismaService.todo.findMany
        .mockResolvedValueOnce([{ id: 'todo-123' }, { id: 'todo-456' }]) // validation
        .mockResolvedValueOnce([mockTodo]); // final findAll
      mockPrismaService.$transaction.mockResolvedValue([]);

      await service.reorder(
        'user-123',
        { inbox: true },
        { orderedIds: ['todo-123', 'todo-456'] },
      );

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should reorder day todos', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      mockPrismaService.todo.findMany
        .mockResolvedValueOnce([{ id: 'todo-123' }]) // validation
        .mockResolvedValueOnce([]); // final findAll
      mockPrismaService.$transaction.mockResolvedValue([]);

      await service.reorder(
        'user-123',
        { dayId: 'day-123' },
        { orderedIds: ['todo-123'] },
      );

      expect(daysService.findOne).toHaveBeenCalledWith('day-123', 'user-123');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should reorder time block todos', async () => {
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);
      mockPrismaService.todo.findMany
        .mockResolvedValueOnce([{ id: 'todo-123' }]) // validation
        .mockResolvedValueOnce([]); // final findAll
      mockPrismaService.$transaction.mockResolvedValue([]);

      await service.reorder(
        'user-123',
        { timeBlockId: 'tb-123' },
        { orderedIds: ['todo-123'] },
      );

      expect(timeBlocksService.findOne).toHaveBeenCalledWith(
        'tb-123',
        'user-123',
      );
    });

    it('should throw BadRequestException when both context params provided', async () => {
      await expect(
        service.reorder(
          'user-123',
          { dayId: 'day-123', timeBlockId: 'tb-123' },
          { orderedIds: ['todo-123'] },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when day not found', async () => {
      mockDaysService.findOne.mockRejectedValue(
        new NotFoundException('Day not found'),
      );

      await expect(
        service.reorder(
          'user-123',
          { dayId: 'nonexistent' },
          { orderedIds: ['todo-123'] },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when todo count does not match', async () => {
      // Return fewer todos than requested (ownership/context mismatch)
      mockPrismaService.todo.findMany.mockResolvedValueOnce([{ id: 'todo-123' }]);

      await expect(
        service.reorder(
          'user-123',
          { inbox: true },
          { orderedIds: ['todo-123', 'todo-456', 'todo-789'] },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when todo belongs to different user', async () => {
      // Return empty array (no matching todos for user)
      mockPrismaService.todo.findMany.mockResolvedValueOnce([]);

      await expect(
        service.reorder(
          'user-123',
          { inbox: true },
          { orderedIds: ['todo-123'] },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when todo is in different context', async () => {
      mockDaysService.findOne.mockResolvedValue(mockDay);
      // Todo exists but not in the specified day context
      mockPrismaService.todo.findMany.mockResolvedValueOnce([]);

      await expect(
        service.reorder(
          'user-123',
          { dayId: 'day-123' },
          { orderedIds: ['todo-123'] },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('move', () => {
    // Helper to create transaction mock that executes the callback
    const setupTransactionMock = (txMocks: {
      findFirst?: jest.Mock;
      update?: jest.Mock;
      updateMany?: jest.Mock;
    }) => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          todo: {
            findFirst: txMocks.findFirst ?? jest.fn(),
            update: txMocks.update ?? jest.fn(),
            updateMany: txMocks.updateMany ?? jest.fn(),
          },
        };
        return callback(tx);
      });
    };

    it('should move todo from inbox to day context', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(mockTodo);
      mockDaysService.findOne.mockResolvedValue(mockDay);

      const updatedTodo = { ...mockTodo, dayId: 'day-123', order: 2 };
      const txFindFirst = jest.fn().mockResolvedValue({ order: 1 });
      const txUpdate = jest.fn().mockResolvedValue(updatedTodo);
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 0 });

      setupTransactionMock({
        findFirst: txFindFirst,
        update: txUpdate,
        updateMany: txUpdateMany,
      });

      const result = await service.move('todo-123', 'user-123', {
        targetDayId: 'day-123',
      });

      expect(result.dayId).toBe('day-123');
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: 'todo-123' },
        data: { dayId: 'day-123', timeBlockId: null, order: 2 },
        include: { day: true, timeBlock: true },
      });
    });

    it('should move todo to time block context', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(mockTodo);
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);

      const updatedTodo = { ...mockTodo, timeBlockId: 'tb-123', order: 0 };
      const txFindFirst = jest.fn().mockResolvedValue(null);
      const txUpdate = jest.fn().mockResolvedValue(updatedTodo);
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 0 });

      setupTransactionMock({
        findFirst: txFindFirst,
        update: txUpdate,
        updateMany: txUpdateMany,
      });

      const result = await service.move('todo-123', 'user-123', {
        targetTimeBlockId: 'tb-123',
      });

      expect(result.timeBlockId).toBe('tb-123');
    });

    it('should move todo to inbox (unassigned)', async () => {
      const dayTodo = { ...mockTodo, dayId: 'day-123' };
      mockPrismaService.todo.findFirst.mockResolvedValue(dayTodo);

      const updatedTodo = { ...mockTodo, dayId: null, timeBlockId: null, order: 0 };
      const txFindFirst = jest.fn().mockResolvedValue(null);
      const txUpdate = jest.fn().mockResolvedValue(updatedTodo);
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 0 });

      setupTransactionMock({
        findFirst: txFindFirst,
        update: txUpdate,
        updateMany: txUpdateMany,
      });

      const result = await service.move('todo-123', 'user-123', {});

      expect(result.dayId).toBeNull();
      expect(result.timeBlockId).toBeNull();
    });

    it('should return unchanged todo when moving to same context', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(mockTodo);

      const result = await service.move('todo-123', 'user-123', {});

      expect(result).toEqual(mockTodo);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when both targets provided', async () => {
      await expect(
        service.move('todo-123', 'user-123', {
          targetDayId: 'day-123',
          targetTimeBlockId: 'tb-123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when todo not found', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(null);
      mockDaysService.findOne.mockResolvedValue(mockDay);

      await expect(
        service.move('nonexistent', 'user-123', { targetDayId: 'day-123' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when target day not found', async () => {
      mockDaysService.findOne.mockRejectedValue(
        new NotFoundException('Day not found'),
      );

      await expect(
        service.move('todo-123', 'user-123', { targetDayId: 'nonexistent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should execute move atomically within transaction', async () => {
      mockPrismaService.todo.findFirst.mockResolvedValue(mockTodo);
      mockDaysService.findOne.mockResolvedValue(mockDay);

      const txFindFirst = jest.fn().mockResolvedValue({ order: 0 });
      const txUpdate = jest.fn().mockResolvedValue({ ...mockTodo, dayId: 'day-123' });
      const txUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

      setupTransactionMock({
        findFirst: txFindFirst,
        update: txUpdate,
        updateMany: txUpdateMany,
      });

      await service.move('todo-123', 'user-123', { targetDayId: 'day-123' });

      // Verify transaction was used
      expect(prisma.$transaction).toHaveBeenCalled();
      // Verify operations were called within transaction
      expect(txFindFirst).toHaveBeenCalled(); // getNextOrder
      expect(txUpdate).toHaveBeenCalled(); // update todo
      expect(txUpdateMany).toHaveBeenCalled(); // reorderAfterDelete
    });
  });
});
