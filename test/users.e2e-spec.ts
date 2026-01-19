import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('UsersController - Stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  const testUser = {
    email: 'statstest@example.com',
    password: 'password123',
    name: 'Stats Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.todo.deleteMany();
    await prisma.note.deleteMany();
    await prisma.timeBlock.deleteMany();
    await prisma.day.deleteMany();
    await prisma.event.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();

    // Register and login test user
    await request(app.getHttpServer()).post('/auth/register').send(testUser);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: testUser.password });

    accessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await prisma.todo.deleteMany();
    await prisma.note.deleteMany();
    await prisma.timeBlock.deleteMany();
    await prisma.day.deleteMany();
    await prisma.event.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('GET /users/me/stats', () => {
    it('should return user stats with default values', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('currentStreak');
      expect(response.body).toHaveProperty('longestStreak');
      expect(response.body).toHaveProperty('lastCompletedDate');
      expect(response.body).toHaveProperty('totalCompletedDays');
      expect(response.body).toHaveProperty('totalDays');
      expect(response.body).toHaveProperty('overallDayCompletionRate');
      expect(response.body.currentStreak).toBe(0);
      expect(response.body.totalDays).toBe(0);
    });

    it('should return correct stats after creating days', async () => {
      // Create some days
      await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' });

      await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-16' });

      const response = await request(app.getHttpServer())
        .get('/users/me/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.totalDays).toBe(2);
      expect(response.body.totalCompletedDays).toBe(0);
      expect(response.body.overallDayCompletionRate).toBe(0);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/users/me/stats').expect(401);
    });
  });

  describe('GET /users/me/stats/day/:date', () => {
    it('should return empty stats for a date without data', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/me/stats/day/2024-01-15')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.date).toBe('2024-01-15');
      expect(response.body.dayExists).toBe(false);
      expect(response.body.completedTodos).toBe(0);
      expect(response.body.totalTodos).toBe(0);
      expect(response.body.completedTimeBlocks).toBe(0);
      expect(response.body.totalTimeBlocks).toBe(0);
    });

    it('should return stats for a date with data', async () => {
      // Create a day
      const dayResponse = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' });
      const dayId = dayResponse.body.id;

      // Create time blocks
      await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Morning',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        });

      await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Afternoon',
          startTime: '12:00',
          endTime: '14:00',
          dayId,
        });

      const response = await request(app.getHttpServer())
        .get('/users/me/stats/day/2024-01-15')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.date).toBe('2024-01-15');
      expect(response.body.dayExists).toBe(true);
      expect(response.body.totalTimeBlocks).toBe(2);
      expect(response.body.completedTimeBlocks).toBe(0);
      expect(response.body.timeBlockCompletionRate).toBe(0);
    });

    it('should return correct completion rates', async () => {
      // Create a day with time blocks and todos
      const dayResponse = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' });
      const dayId = dayResponse.body.id;

      // Create a time block
      const tbResponse = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Morning',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        });
      const timeBlockId = tbResponse.body.id;

      // Mark time block as completed
      await request(app.getHttpServer())
        .patch(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      // Create todos - one in the day, one in the time block
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Day todo', dayId });

      const todoResponse = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'TimeBlock todo', timeBlockId });
      const todoId = todoResponse.body.id;

      // Mark one todo as completed
      await request(app.getHttpServer())
        .patch(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      const response = await request(app.getHttpServer())
        .get('/users/me/stats/day/2024-01-15')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.totalTimeBlocks).toBe(1);
      expect(response.body.completedTimeBlocks).toBe(1);
      expect(response.body.timeBlockCompletionRate).toBe(100);
      expect(response.body.totalTodos).toBe(2);
      expect(response.body.completedTodos).toBe(1);
      expect(response.body.todoCompletionRate).toBe(50);
    });

    it('should return 400 for invalid date format', async () => {
      await request(app.getHttpServer())
        .get('/users/me/stats/day/invalid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/users/me/stats/day/2024-01-15').expect(401);
    });
  });

  describe('GET /users/me/stats/week/:date', () => {
    it('should return week stats with correct boundaries', async () => {
      // 2024-01-17 is a Wednesday
      const response = await request(app.getHttpServer())
        .get('/users/me/stats/week/2024-01-17')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.weekStart).toBe('2024-01-15'); // Monday
      expect(response.body.weekEnd).toBe('2024-01-21'); // Sunday
      expect(response.body.dailyStats).toHaveLength(7);
    });

    it('should aggregate stats from all days in the week', async () => {
      // Create days in the week
      const day1Response = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' });
      const day1Id = day1Response.body.id;

      const day2Response = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-17' });
      const day2Id = day2Response.body.id;

      // Create time blocks
      await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Block 1', startTime: '09:00', endTime: '10:00', dayId: day1Id });

      await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Block 2', startTime: '09:00', endTime: '10:00', dayId: day2Id });

      const response = await request(app.getHttpServer())
        .get('/users/me/stats/week/2024-01-17')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.totalDays).toBe(2);
      expect(response.body.totalTimeBlocks).toBe(2);
      expect(response.body.completedDays).toBe(0);
    });

    it('should handle Sunday correctly (same week as previous Monday)', async () => {
      // 2024-01-21 is a Sunday
      const response = await request(app.getHttpServer())
        .get('/users/me/stats/week/2024-01-21')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.weekStart).toBe('2024-01-15'); // Previous Monday
      expect(response.body.weekEnd).toBe('2024-01-21'); // Sunday
    });

    it('should handle Monday correctly (start of week)', async () => {
      // 2024-01-15 is a Monday
      const response = await request(app.getHttpServer())
        .get('/users/me/stats/week/2024-01-15')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.weekStart).toBe('2024-01-15'); // Monday
      expect(response.body.weekEnd).toBe('2024-01-21'); // Sunday
    });

    it('should return 400 for invalid date format', async () => {
      await request(app.getHttpServer())
        .get('/users/me/stats/week/invalid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/users/me/stats/week/2024-01-17').expect(401);
    });
  });
});
