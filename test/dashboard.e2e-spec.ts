import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('DashboardController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  const testUser = {
    email: 'dashboardtest@example.com',
    password: 'password123',
    name: 'Dashboard Test User',
  };

  // Helper to get today's date string
  const getTodayString = () => new Date().toISOString().split('T')[0];

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

  describe('GET /dashboard', () => {
    it('should return dashboard with default values for new user', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Check streaks
      expect(response.body).toHaveProperty('streaks');
      expect(response.body.streaks).toMatchObject({
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedDate: null,
        totalCompletedDays: 0,
        totalDays: 0,
        overallDayCompletionRate: 0,
      });

      // Check today stats
      expect(response.body).toHaveProperty('today');
      expect(response.body.today.dayExists).toBe(false);
      expect(response.body.today.completedTodos).toBe(0);
      expect(response.body.today.totalTodos).toBe(0);

      // Check todayDetail is null (no day created)
      expect(response.body.todayDetail).toBeNull();

      // Check upcomingEvents is empty array
      expect(response.body.upcomingEvents).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).get('/dashboard').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should return dashboard with today detail when day exists', async () => {
      const today = getTodayString();

      // Create a day for today
      const dayResponse = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: today });
      const dayId = dayResponse.body.id;

      // Create a time block
      const tbResponse = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Morning Routine',
          startTime: '08:00',
          endTime: '10:00',
          dayId,
        });
      const timeBlockId = tbResponse.body.id;

      // Create a day-level todo
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Day Todo', dayId });

      // Create a time block todo
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'TimeBlock Todo', timeBlockId });

      // Create a note in the time block
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Test note', timeBlockId });

      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Check today stats
      expect(response.body.today.dayExists).toBe(true);
      expect(response.body.today.totalTodos).toBe(2);
      expect(response.body.today.completedTodos).toBe(0);
      expect(response.body.today.totalTimeBlocks).toBe(1);

      // Check todayDetail
      expect(response.body.todayDetail).not.toBeNull();
      expect(response.body.todayDetail.id).toBe(dayId);
      expect(response.body.todayDetail.timeBlocks).toHaveLength(1);
      expect(response.body.todayDetail.timeBlocks[0].name).toBe('Morning Routine');
      expect(response.body.todayDetail.timeBlocks[0].notes).toHaveLength(1);
      expect(response.body.todayDetail.timeBlocks[0].todos).toHaveLength(1);
      expect(response.body.todayDetail.todos).toHaveLength(1);

      // Check streaks
      expect(response.body.streaks.totalDays).toBe(1);
      expect(response.body.streaks.totalCompletedDays).toBe(0);
    });

    it('should calculate completion rates correctly', async () => {
      const today = getTodayString();

      // Create a day for today
      const dayResponse = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: today });
      const dayId = dayResponse.body.id;

      // Create 2 time blocks
      const tb1Response = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Block 1', startTime: '08:00', endTime: '10:00', dayId });

      const tb2Response = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Block 2', startTime: '10:00', endTime: '12:00', dayId });

      // Mark one time block as completed
      await request(app.getHttpServer())
        .patch(`/time-blocks/${tb1Response.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      // Create 4 todos (2 day-level, 2 in time blocks)
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Day Todo 1', dayId });

      const todo2Response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Day Todo 2', dayId });

      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'TB Todo 1', timeBlockId: tb1Response.body.id });

      const todo4Response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'TB Todo 2', timeBlockId: tb2Response.body.id });

      // Mark 2 todos as completed (50%)
      await request(app.getHttpServer())
        .patch(`/todos/${todo2Response.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      await request(app.getHttpServer())
        .patch(`/todos/${todo4Response.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Check completion rates
      expect(response.body.today.totalTimeBlocks).toBe(2);
      expect(response.body.today.completedTimeBlocks).toBe(1);
      expect(response.body.today.timeBlockCompletionRate).toBe(50);

      expect(response.body.today.totalTodos).toBe(4);
      expect(response.body.today.completedTodos).toBe(2);
      expect(response.body.today.todoCompletionRate).toBe(50);
    });

    it('should include upcoming events for the next 7 days', async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Create event for today
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Today Event', date: todayStr });

      // Create event for tomorrow
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Tomorrow Event', date: tomorrowStr });

      // Create event for 5 days from now
      const fiveDays = new Date(today);
      fiveDays.setDate(today.getDate() + 5);
      const fiveDaysStr = fiveDays.toISOString().split('T')[0];
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Five Days Event', date: fiveDaysStr });

      // Create event for 10 days from now (should NOT appear)
      const tenDays = new Date(today);
      tenDays.setDate(today.getDate() + 10);
      const tenDaysStr = tenDays.toISOString().split('T')[0];
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Ten Days Event', date: tenDaysStr });

      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should have 3 upcoming events (within 7 days)
      expect(response.body.upcomingEvents.length).toBe(3);

      const eventTitles = response.body.upcomingEvents.map((e: { title: string }) => e.title);
      expect(eventTitles).toContain('Today Event');
      expect(eventTitles).toContain('Tomorrow Event');
      expect(eventTitles).toContain('Five Days Event');
      expect(eventTitles).not.toContain('Ten Days Event');
    });

    it('should include recurring event occurrences in upcoming events', async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Create a daily recurring event
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Daily Standup',
          date: todayStr,
          isRecurring: true,
          recurrenceType: 'DAILY',
        });

      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should have multiple occurrences of the daily event
      const standupEvents = response.body.upcomingEvents.filter(
        (e: { title: string }) => e.title === 'Daily Standup',
      );
      expect(standupEvents.length).toBeGreaterThan(1);
    });

    it('should reflect streaks correctly when days are completed', async () => {
      const today = new Date();

      // Create days for today and yesterday
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Create yesterday's day
      const yesterdayDay = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: yesterdayStr });

      // Create a time block for yesterday and mark it complete
      const tbYesterday = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Yesterday Block',
          startTime: '09:00',
          endTime: '10:00',
          dayId: yesterdayDay.body.id,
        });

      await request(app.getHttpServer())
        .patch(`/time-blocks/${tbYesterday.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      // Create today's day
      const todayDay = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: todayStr });

      // Create a time block for today and mark it complete
      const tbToday = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Today Block',
          startTime: '09:00',
          endTime: '10:00',
          dayId: todayDay.body.id,
        });

      await request(app.getHttpServer())
        .patch(`/time-blocks/${tbToday.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Check streaks
      expect(response.body.streaks.totalDays).toBe(2);
      expect(response.body.streaks.totalCompletedDays).toBe(2);
      expect(response.body.streaks.overallDayCompletionRate).toBe(100);
      expect(response.body.streaks.currentStreak).toBe(2);
    });

    it('should return correct structure for event properties', async () => {
      const today = getTodayString();

      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Event',
          date: today,
          color: '#FF0000',
          isRecurring: false,
        });

      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.upcomingEvents).toHaveLength(1);
      const event = response.body.upcomingEvents[0];
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('title', 'Test Event');
      expect(event).toHaveProperty('date');
      expect(event).toHaveProperty('color', '#FF0000');
      expect(event).toHaveProperty('isRecurring', false);
      expect(event).toHaveProperty('recurrenceType', 'NONE');
    });
  });
});
