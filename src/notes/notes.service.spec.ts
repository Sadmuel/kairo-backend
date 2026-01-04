import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimeBlocksService } from '../time-blocks/time-blocks.service';

describe('NotesService', () => {
  let service: NotesService;
  let prisma: jest.Mocked<PrismaService>;
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

  const mockNote = {
    id: 'note-123',
    content: 'Wake up and stretch',
    order: 0,
    timeBlockId: 'tb-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    timeBlock: mockTimeBlock,
  };

  const mockPrismaService = {
    note: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockTimeBlocksService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TimeBlocksService,
          useValue: mockTimeBlocksService,
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
    prisma = module.get(PrismaService);
    timeBlocksService = module.get(TimeBlocksService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByTimeBlock', () => {
    it('should return notes for a time block in order', async () => {
      const notes = [mockNote, { ...mockNote, id: 'note-456', order: 1 }];
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);
      mockPrismaService.note.findMany.mockResolvedValue(notes);

      const result = await service.findByTimeBlock('tb-123', 'user-123');

      expect(result).toEqual(notes);
      expect(timeBlocksService.findOne).toHaveBeenCalledWith('tb-123', 'user-123');
      expect(prisma.note.findMany).toHaveBeenCalledWith({
        where: { timeBlockId: 'tb-123' },
        orderBy: { order: 'asc' },
      });
    });

    it('should return empty array when no notes exist', async () => {
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);
      mockPrismaService.note.findMany.mockResolvedValue([]);

      const result = await service.findByTimeBlock('tb-123', 'user-123');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when time block not found', async () => {
      mockTimeBlocksService.findOne.mockRejectedValue(
        new NotFoundException('Time block not found'),
      );

      await expect(service.findByTimeBlock('nonexistent', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should return note when found', async () => {
      mockPrismaService.note.findFirst.mockResolvedValue(mockNote);

      const result = await service.findOne('note-123', 'user-123');

      expect(result).toEqual(mockNote);
      expect(prisma.note.findFirst).toHaveBeenCalledWith({
        where: { id: 'note-123' },
        include: {
          timeBlock: {
            include: { day: true },
          },
        },
      });
    });

    it('should throw NotFoundException when note not found', async () => {
      mockPrismaService.note.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('nonexistent', 'user-123')).rejects.toThrow('Note not found');
    });

    it('should throw NotFoundException when note belongs to different user', async () => {
      const noteWithDifferentUser = {
        ...mockNote,
        timeBlock: {
          ...mockTimeBlock,
          day: { ...mockDay, userId: 'different-user' },
        },
      };
      mockPrismaService.note.findFirst.mockResolvedValue(noteWithDifferentUser);

      await expect(service.findOne('note-123', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = {
      content: 'Wake up and stretch',
      timeBlockId: 'tb-123',
    };

    it('should create a note with auto-assigned order', async () => {
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);
      mockPrismaService.note.findFirst.mockResolvedValue({ order: 2 });
      mockPrismaService.note.create.mockResolvedValue(mockNote);

      const result = await service.create('user-123', createDto);

      expect(result).toEqual(mockNote);
      expect(prisma.note.create).toHaveBeenCalledWith({
        data: {
          content: 'Wake up and stretch',
          order: 3,
          timeBlockId: 'tb-123',
        },
      });
    });

    it('should create first note with order 0', async () => {
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);
      mockPrismaService.note.findFirst.mockResolvedValue(null);
      mockPrismaService.note.create.mockResolvedValue(mockNote);

      await service.create('user-123', createDto);

      expect(prisma.note.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 0 }),
        }),
      );
    });

    it('should use provided order when specified', async () => {
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);
      mockPrismaService.note.create.mockResolvedValue(mockNote);

      await service.create('user-123', { ...createDto, order: 5 });

      expect(prisma.note.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 5 }),
        }),
      );
    });

    it('should throw NotFoundException when time block not found', async () => {
      mockTimeBlocksService.findOne.mockRejectedValue(
        new NotFoundException('Time block not found'),
      );

      await expect(service.create('user-123', createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update note content', async () => {
      mockPrismaService.note.findFirst.mockResolvedValue(mockNote);
      mockPrismaService.note.update.mockResolvedValue({
        ...mockNote,
        content: 'Updated content',
      });

      const result = await service.update('note-123', 'user-123', { content: 'Updated content' });

      expect(result.content).toBe('Updated content');
      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: 'note-123' },
        data: { content: 'Updated content' },
      });
    });

    it('should throw NotFoundException when note not found', async () => {
      mockPrismaService.note.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'user-123', { content: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete note and reorder remaining', async () => {
      mockPrismaService.note.findFirst.mockResolvedValue(mockNote);
      mockPrismaService.note.delete.mockResolvedValue(mockNote);
      mockPrismaService.note.updateMany.mockResolvedValue({ count: 2 });

      await service.remove('note-123', 'user-123');

      expect(prisma.note.delete).toHaveBeenCalledWith({
        where: { id: 'note-123' },
      });
      expect(prisma.note.updateMany).toHaveBeenCalledWith({
        where: {
          timeBlockId: 'tb-123',
          order: { gt: 0 },
        },
        data: {
          order: { decrement: 1 },
        },
      });
    });

    it('should throw NotFoundException when note not found', async () => {
      mockPrismaService.note.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('should reorder notes', async () => {
      mockTimeBlocksService.findOne.mockResolvedValue(mockTimeBlock);
      mockPrismaService.$transaction.mockResolvedValue([]);
      mockPrismaService.note.findMany.mockResolvedValue([
        { ...mockNote, order: 0 },
        { ...mockNote, id: 'note-456', order: 1 },
      ]);

      const result = await service.reorder('user-123', 'tb-123', {
        orderedIds: ['note-456', 'note-123'],
      });

      expect(timeBlocksService.findOne).toHaveBeenCalledWith('tb-123', 'user-123');
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when time block not found', async () => {
      mockTimeBlocksService.findOne.mockRejectedValue(
        new NotFoundException('Time block not found'),
      );

      await expect(
        service.reorder('user-123', 'nonexistent', { orderedIds: ['note-123'] }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
