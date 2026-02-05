import { Test, TestingModule } from '@nestjs/testing';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';

describe('TodosController', () => {
  let controller: TodosController;
  let service: jest.Mocked<TodosService>;

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

  const mockTodosService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
    move: jest.fn(),
    duplicate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodosController],
      providers: [
        {
          provide: TodosService,
          useValue: mockTodosService,
        },
      ],
    }).compile();

    controller = module.get<TodosController>(TodosController);
    service = module.get(TodosService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all todos without filters', async () => {
      const todos = [mockTodo];
      mockTodosService.findAll.mockResolvedValue(todos);

      const result = await controller.findAll('user-123', {});

      expect(result).toEqual(todos);
      expect(service.findAll).toHaveBeenCalledWith('user-123', {});
    });

    it('should return todos filtered by dayId', async () => {
      mockTodosService.findAll.mockResolvedValue([]);

      await controller.findAll('user-123', { dayId: 'day-123' });

      expect(service.findAll).toHaveBeenCalledWith('user-123', {
        dayId: 'day-123',
      });
    });

    it('should return inbox todos', async () => {
      mockTodosService.findAll.mockResolvedValue([mockTodo]);

      await controller.findAll('user-123', { inbox: true });

      expect(service.findAll).toHaveBeenCalledWith('user-123', { inbox: true });
    });
  });

  describe('findOne', () => {
    it('should return a single todo', async () => {
      mockTodosService.findOne.mockResolvedValue(mockTodo);

      const result = await controller.findOne('todo-123', 'user-123');

      expect(result).toEqual(mockTodo);
      expect(service.findOne).toHaveBeenCalledWith('todo-123', 'user-123');
    });
  });

  describe('create', () => {
    it('should create a new inbox todo', async () => {
      mockTodosService.create.mockResolvedValue(mockTodo);
      const dto = { title: 'Complete task' };

      const result = await controller.create('user-123', dto);

      expect(result).toEqual(mockTodo);
      expect(service.create).toHaveBeenCalledWith('user-123', dto);
    });

    it('should create a day todo', async () => {
      const dayTodo = { ...mockTodo, dayId: 'day-123' };
      mockTodosService.create.mockResolvedValue(dayTodo);
      const dto = { title: 'Day task', dayId: 'day-123' };

      const result = await controller.create('user-123', dto);

      expect(result).toEqual(dayTodo);
      expect(service.create).toHaveBeenCalledWith('user-123', dto);
    });

    it('should create a time block todo', async () => {
      const blockTodo = { ...mockTodo, timeBlockId: 'tb-123' };
      mockTodosService.create.mockResolvedValue(blockTodo);
      const dto = { title: 'Block task', timeBlockId: 'tb-123' };

      const result = await controller.create('user-123', dto);

      expect(result).toEqual(blockTodo);
      expect(service.create).toHaveBeenCalledWith('user-123', dto);
    });
  });

  describe('update', () => {
    it('should update a todo', async () => {
      const updatedTodo = { ...mockTodo, isCompleted: true };
      mockTodosService.update.mockResolvedValue(updatedTodo);

      const result = await controller.update('todo-123', 'user-123', {
        isCompleted: true,
      });

      expect(result).toEqual(updatedTodo);
      expect(service.update).toHaveBeenCalledWith('todo-123', 'user-123', {
        isCompleted: true,
      });
    });

    it('should update todo title', async () => {
      const updatedTodo = { ...mockTodo, title: 'Updated title' };
      mockTodosService.update.mockResolvedValue(updatedTodo);

      const result = await controller.update('todo-123', 'user-123', {
        title: 'Updated title',
      });

      expect(result.title).toBe('Updated title');
    });
  });

  describe('remove', () => {
    it('should delete a todo', async () => {
      mockTodosService.remove.mockResolvedValue(undefined);

      await controller.remove('todo-123', 'user-123');

      expect(service.remove).toHaveBeenCalledWith('todo-123', 'user-123');
    });
  });

  describe('move', () => {
    it('should move a todo to day context', async () => {
      const movedTodo = { ...mockTodo, dayId: 'day-123' };
      mockTodosService.move.mockResolvedValue(movedTodo);

      const result = await controller.move('todo-123', 'user-123', {
        targetDayId: 'day-123',
      });

      expect(result).toEqual(movedTodo);
      expect(service.move).toHaveBeenCalledWith('todo-123', 'user-123', {
        targetDayId: 'day-123',
      });
    });

    it('should move a todo to time block context', async () => {
      const movedTodo = { ...mockTodo, timeBlockId: 'tb-123' };
      mockTodosService.move.mockResolvedValue(movedTodo);

      const result = await controller.move('todo-123', 'user-123', {
        targetTimeBlockId: 'tb-123',
      });

      expect(result).toEqual(movedTodo);
      expect(service.move).toHaveBeenCalledWith('todo-123', 'user-123', {
        targetTimeBlockId: 'tb-123',
      });
    });

    it('should move a todo to inbox', async () => {
      mockTodosService.move.mockResolvedValue(mockTodo);

      const result = await controller.move('todo-123', 'user-123', {});

      expect(result).toEqual(mockTodo);
      expect(service.move).toHaveBeenCalledWith('todo-123', 'user-123', {});
    });
  });

  describe('reorder', () => {
    it('should reorder inbox todos', async () => {
      const reorderedTodos = [mockTodo];
      mockTodosService.reorder.mockResolvedValue(reorderedTodos);

      const result = await controller.reorder(
        'user-123',
        undefined as unknown as string,
        undefined as unknown as string,
        'true',
        { orderedIds: ['todo-123'] },
      );

      expect(result).toEqual(reorderedTodos);
      expect(service.reorder).toHaveBeenCalledWith(
        'user-123',
        { dayId: undefined, timeBlockId: undefined, inbox: true },
        { orderedIds: ['todo-123'] },
      );
    });

    it('should reorder day todos', async () => {
      mockTodosService.reorder.mockResolvedValue([]);

      await controller.reorder(
        'user-123',
        'day-123',
        undefined as unknown as string,
        undefined as unknown as string,
        { orderedIds: ['todo-123', 'todo-456'] },
      );

      expect(service.reorder).toHaveBeenCalledWith(
        'user-123',
        { dayId: 'day-123', timeBlockId: undefined, inbox: false },
        { orderedIds: ['todo-123', 'todo-456'] },
      );
    });

    it('should reorder time block todos', async () => {
      mockTodosService.reorder.mockResolvedValue([]);

      await controller.reorder(
        'user-123',
        undefined as unknown as string,
        'tb-123',
        undefined as unknown as string,
        { orderedIds: ['todo-123'] },
      );

      expect(service.reorder).toHaveBeenCalledWith(
        'user-123',
        { dayId: undefined, timeBlockId: 'tb-123', inbox: false },
        { orderedIds: ['todo-123'] },
      );
    });
  });

  describe('duplicate', () => {
    it('should duplicate a todo in same context', async () => {
      const duplicatedTodo = { ...mockTodo, id: 'todo-new', order: 1 };
      mockTodosService.duplicate.mockResolvedValue(duplicatedTodo);

      const result = await controller.duplicate('todo-123', 'user-123', {});

      expect(result).toEqual(duplicatedTodo);
      expect(service.duplicate).toHaveBeenCalledWith('todo-123', 'user-123', {});
    });

    it('should duplicate a todo to a target day', async () => {
      const duplicatedTodo = { ...mockTodo, id: 'todo-new', dayId: 'day-456' };
      mockTodosService.duplicate.mockResolvedValue(duplicatedTodo);
      const dto = { targetDayId: 'day-456' };

      const result = await controller.duplicate('todo-123', 'user-123', dto);

      expect(result).toEqual(duplicatedTodo);
      expect(service.duplicate).toHaveBeenCalledWith('todo-123', 'user-123', dto);
    });

    it('should duplicate a todo to a target time block', async () => {
      const duplicatedTodo = { ...mockTodo, id: 'todo-new', timeBlockId: 'tb-456' };
      mockTodosService.duplicate.mockResolvedValue(duplicatedTodo);
      const dto = { targetTimeBlockId: 'tb-456' };

      const result = await controller.duplicate('todo-123', 'user-123', dto);

      expect(result).toEqual(duplicatedTodo);
      expect(service.duplicate).toHaveBeenCalledWith('todo-123', 'user-123', dto);
    });
  });
});
