import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

interface TimeBlockSeed {
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  isCompleted: boolean;
  todos: { title: string; isCompleted: boolean }[];
  notes: string[];
}

@Injectable()
export class DemoSeedService {
  constructor(private prisma: PrismaService) {}

  async seedDemoData(userId: string): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await this.prisma.$transaction(async (tx) => {
      // 1. Create past 6 days (all completed)
      for (let offset = -6; offset <= -1; offset++) {
        const date = this.offsetDate(today, offset);
        const blocks = this.getPastDayBlocks(offset);
        const day = await tx.day.create({
          data: {
            date,
            isCompleted: true,
            nextTimeBlockOrder: blocks.length,
            userId,
          },
        });
        await this.seedTimeBlocks(tx, day.id, userId, blocks);
      }

      // 2. Create today (not completed, active for user to interact with)
      const todayBlocks = this.getTodayBlocks();
      const todayDay = await tx.day.create({
        data: {
          date: today,
          isCompleted: false,
          nextTimeBlockOrder: todayBlocks.length,
          userId,
        },
      });
      await this.seedTimeBlocks(tx, todayDay.id, userId, todayBlocks);

      // 3. Create events
      await this.seedEvents(tx, userId, today);

      // 4. Create inbox todos (not assigned to any day or time block)
      await this.seedInboxTodos(tx, userId);

      // 5. Update user streak data
      await tx.user.update({
        where: { id: userId },
        data: {
          currentStreak: 6,
          longestStreak: 6,
          lastCompletedDate: this.offsetDate(today, -1),
        },
      });
    });
  }

  private async seedTimeBlocks(
    tx: TransactionClient,
    dayId: string,
    userId: string,
    blocks: TimeBlockSeed[],
  ): Promise<void> {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const timeBlock = await tx.timeBlock.create({
        data: {
          name: block.name,
          startTime: block.startTime,
          endTime: block.endTime,
          color: block.color,
          isCompleted: block.isCompleted,
          order: i,
          nextNoteOrder: block.notes.length,
          dayId,
        },
      });

      // Create todos for this time block
      if (block.todos.length > 0) {
        await tx.todo.createMany({
          data: block.todos.map((todo, order) => ({
            title: todo.title,
            isCompleted: todo.isCompleted,
            order,
            userId,
            dayId,
            timeBlockId: timeBlock.id,
          })),
        });
      }

      // Create notes for this time block
      if (block.notes.length > 0) {
        await tx.note.createMany({
          data: block.notes.map((content, order) => ({
            content,
            order,
            timeBlockId: timeBlock.id,
          })),
        });
      }
    }
  }

  private async seedEvents(
    tx: TransactionClient,
    userId: string,
    today: Date,
  ): Promise<void> {
    const events: Prisma.EventCreateManyInput[] = [
      {
        title: 'Team Standup',
        date: this.offsetDate(today, -3),
        color: '#A5D8FF',
        isRecurring: true,
        recurrenceType: 'WEEKDAYS',
        userId,
      },
      {
        title: 'Project Review',
        date: today,
        color: '#B2F2BB',
        isRecurring: false,
        recurrenceType: 'NONE',
        userId,
      },
      {
        title: 'Dentist Appointment',
        date: this.offsetDate(today, 2),
        color: '#FCC2D7',
        isRecurring: false,
        recurrenceType: 'NONE',
        userId,
      },
      {
        title: 'Weekend Hiking',
        date: this.getNextSaturday(today),
        color: '#B2F2BB',
        isRecurring: false,
        recurrenceType: 'NONE',
        userId,
      },
      {
        title: 'Weekly Planning',
        date: today,
        color: '#D0BFFF',
        isRecurring: true,
        recurrenceType: 'WEEKLY',
        userId,
      },
    ];

    await tx.event.createMany({ data: events });
  }

  private async seedInboxTodos(
    tx: TransactionClient,
    userId: string,
  ): Promise<void> {
    await tx.todo.createMany({
      data: [
        {
          title: 'Research new productivity frameworks',
          isCompleted: false,
          order: 0,
          userId,
        },
        {
          title: 'Schedule annual health checkup',
          isCompleted: false,
          order: 1,
          userId,
        },
        {
          title: 'Order new standing desk mat',
          isCompleted: false,
          order: 2,
          userId,
        },
      ],
    });
  }

  private getTodayBlocks(): TimeBlockSeed[] {
    return [
      {
        name: 'Morning Routine',
        startTime: '06:00',
        endTime: '07:00',
        color: '#B2F2BB',
        isCompleted: false,
        todos: [
          { title: 'Review daily goals', isCompleted: true },
          { title: 'Check calendar', isCompleted: false },
        ],
        notes: ['Remember to stretch before sitting down'],
      },
      {
        name: 'Deep Work Session',
        startTime: '09:00',
        endTime: '12:00',
        color: '#A5D8FF',
        isCompleted: false,
        todos: [
          { title: 'Complete API integration', isCompleted: false },
          { title: 'Write unit tests', isCompleted: false },
          { title: 'Update documentation', isCompleted: false },
        ],
        notes: [
          'Focus on the authentication module first',
          'Check PR feedback from yesterday',
        ],
      },
      {
        name: 'Lunch & Recharge',
        startTime: '12:00',
        endTime: '13:00',
        color: '#FFEC99',
        isCompleted: false,
        todos: [],
        notes: ['Try the new place on 5th street'],
      },
      {
        name: 'Exercise',
        startTime: '17:00',
        endTime: '18:00',
        color: '#FCC2D7',
        isCompleted: false,
        todos: [
          { title: '30 min cardio', isCompleted: false },
          { title: '20 min strength training', isCompleted: false },
        ],
        notes: [],
      },
    ];
  }

  private getPastDayBlocks(offset: number): TimeBlockSeed[] {
    // Vary the blocks across past days for realism
    const variations: Record<number, TimeBlockSeed[]> = {
      [-6]: [
        {
          name: 'Morning Routine',
          startTime: '06:00',
          endTime: '07:00',
          color: '#B2F2BB',
          isCompleted: true,
          todos: [
            { title: 'Review daily goals', isCompleted: true },
            { title: 'Meditate for 10 minutes', isCompleted: true },
          ],
          notes: ['Great start to the week'],
        },
        {
          name: 'Deep Work',
          startTime: '09:00',
          endTime: '12:00',
          color: '#A5D8FF',
          isCompleted: true,
          todos: [
            { title: 'Set up project scaffolding', isCompleted: true },
            { title: 'Design database schema', isCompleted: true },
          ],
          notes: ['Used Prisma for the ORM'],
        },
        {
          name: 'Exercise',
          startTime: '17:00',
          endTime: '18:00',
          color: '#FCC2D7',
          isCompleted: true,
          todos: [
            { title: '5km run', isCompleted: true },
          ],
          notes: [],
        },
      ],
      [-5]: [
        {
          name: 'Morning Routine',
          startTime: '06:00',
          endTime: '07:00',
          color: '#B2F2BB',
          isCompleted: true,
          todos: [
            { title: 'Review daily goals', isCompleted: true },
          ],
          notes: [],
        },
        {
          name: 'Study Session',
          startTime: '10:00',
          endTime: '12:00',
          color: '#D0BFFF',
          isCompleted: true,
          todos: [
            { title: 'Read NestJS documentation', isCompleted: true },
            { title: 'Practice TypeScript patterns', isCompleted: true },
          ],
          notes: ['Learned about guards and interceptors'],
        },
        {
          name: 'Side Project',
          startTime: '14:00',
          endTime: '16:00',
          color: '#FCC2D7',
          isCompleted: true,
          todos: [
            { title: 'Build login page', isCompleted: true },
            { title: 'Add form validation', isCompleted: true },
          ],
          notes: ['Using React Hook Form'],
        },
      ],
      [-4]: [
        {
          name: 'Deep Work',
          startTime: '09:00',
          endTime: '12:00',
          color: '#A5D8FF',
          isCompleted: true,
          todos: [
            { title: 'Implement JWT authentication', isCompleted: true },
            { title: 'Add refresh token rotation', isCompleted: true },
          ],
          notes: ['Security first approach'],
        },
        {
          name: 'Reading',
          startTime: '19:00',
          endTime: '20:00',
          color: '#FFEC99',
          isCompleted: true,
          todos: [
            { title: 'Read 30 pages', isCompleted: true },
          ],
          notes: ['Clean Code by Robert C. Martin'],
        },
      ],
      [-3]: [
        {
          name: 'Morning Routine',
          startTime: '06:00',
          endTime: '07:00',
          color: '#B2F2BB',
          isCompleted: true,
          todos: [
            { title: 'Review daily goals', isCompleted: true },
          ],
          notes: [],
        },
        {
          name: 'Team Meeting',
          startTime: '10:00',
          endTime: '11:00',
          color: '#FFEC99',
          isCompleted: true,
          todos: [
            { title: 'Prepare sprint review slides', isCompleted: true },
            { title: 'Demo new features', isCompleted: true },
          ],
          notes: ['Got positive feedback on the dashboard'],
        },
        {
          name: 'Code Review',
          startTime: '14:00',
          endTime: '16:00',
          color: '#A5D8FF',
          isCompleted: true,
          todos: [
            { title: 'Review PR #15', isCompleted: true },
            { title: 'Review PR #16', isCompleted: true },
          ],
          notes: ['Left detailed comments on error handling'],
        },
      ],
      [-2]: [
        {
          name: 'Deep Work',
          startTime: '09:00',
          endTime: '12:00',
          color: '#A5D8FF',
          isCompleted: true,
          todos: [
            { title: 'Build time block CRUD', isCompleted: true },
            { title: 'Add reorder functionality', isCompleted: true },
            { title: 'Write integration tests', isCompleted: true },
          ],
          notes: ['Drag and drop reorder working smoothly'],
        },
        {
          name: 'Exercise',
          startTime: '17:00',
          endTime: '18:00',
          color: '#FCC2D7',
          isCompleted: true,
          todos: [
            { title: 'Gym workout', isCompleted: true },
          ],
          notes: [],
        },
      ],
      [-1]: [
        {
          name: 'Morning Routine',
          startTime: '06:00',
          endTime: '07:00',
          color: '#B2F2BB',
          isCompleted: true,
          todos: [
            { title: 'Review daily goals', isCompleted: true },
            { title: 'Plan the day', isCompleted: true },
          ],
          notes: [],
        },
        {
          name: 'Deep Work',
          startTime: '09:00',
          endTime: '12:00',
          color: '#A5D8FF',
          isCompleted: true,
          todos: [
            { title: 'Implement dashboard endpoint', isCompleted: true },
            { title: 'Add streak calculation', isCompleted: true },
          ],
          notes: ['Dashboard aggregates all key data in one call'],
        },
        {
          name: 'Learning',
          startTime: '15:00',
          endTime: '16:30',
          color: '#D0BFFF',
          isCompleted: true,
          todos: [
            { title: 'Watch system design lecture', isCompleted: true },
          ],
          notes: ['Covered caching strategies'],
        },
      ],
    };

    return variations[offset] || [];
  }

  private offsetDate(base: Date, days: number): Date {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private getNextSaturday(from: Date): Date {
    const d = new Date(from);
    const dayOfWeek = d.getUTCDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    d.setUTCDate(d.getUTCDate() + daysUntilSaturday);
    return d;
  }
}
