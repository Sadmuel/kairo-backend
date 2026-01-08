import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('EventsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  const testUser = {
    email: 'eventtest@example.com',
    password: 'password123',
    name: 'Event Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Clean up database before each test
    await prisma.event.deleteMany();
    await prisma.todo.deleteMany();
    await prisma.note.deleteMany();
    await prisma.timeBlock.deleteMany();
    await prisma.day.deleteMany();
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
    await prisma.event.deleteMany();
    await prisma.todo.deleteMany();
    await prisma.note.deleteMany();
    await prisma.timeBlock.deleteMany();
    await prisma.day.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /events', () => {
    it('should create a non-recurring event', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Team Meeting',
          date: '2024-01-15',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Team Meeting');
      expect(response.body.isRecurring).toBe(false);
      expect(response.body.recurrenceType).toBe('NONE');
    });

    it('should create a recurring daily event', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Daily Standup',
          date: '2024-01-01',
          isRecurring: true,
          recurrenceType: 'DAILY',
        })
        .expect(201);

      expect(response.body.isRecurring).toBe(true);
      expect(response.body.recurrenceType).toBe('DAILY');
    });

    it('should create a recurring weekly event', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Weekly Review',
          date: '2024-01-01',
          isRecurring: true,
          recurrenceType: 'WEEKLY',
        })
        .expect(201);

      expect(response.body.isRecurring).toBe(true);
      expect(response.body.recurrenceType).toBe('WEEKLY');
    });

    it('should create a recurring monthly event', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Monthly Report',
          date: '2024-01-15',
          isRecurring: true,
          recurrenceType: 'MONTHLY',
        })
        .expect(201);

      expect(response.body.isRecurring).toBe(true);
      expect(response.body.recurrenceType).toBe('MONTHLY');
    });

    it('should create a recurring yearly event (birthday)', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: "Mom's Birthday",
          date: '2024-03-15',
          isRecurring: true,
          recurrenceType: 'YEARLY',
          color: '#FCC2D7',
        })
        .expect(201);

      expect(response.body.isRecurring).toBe(true);
      expect(response.body.recurrenceType).toBe('YEARLY');
      expect(response.body.color).toBe('#FCC2D7');
    });

    it('should create event with color', async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Important Event',
          date: '2024-01-15',
          color: '#A5D8FF',
        })
        .expect(201);

      expect(response.body.color).toBe('#A5D8FF');
    });

    it('should return 400 when isRecurring=true and recurrenceType=NONE', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Invalid Event',
          date: '2024-01-15',
          isRecurring: true,
          recurrenceType: 'NONE',
        })
        .expect(400);
    });

    it('should return 400 when isRecurring=false and recurrenceType!=NONE', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Invalid Event',
          date: '2024-01-15',
          isRecurring: false,
          recurrenceType: 'WEEKLY',
        })
        .expect(400);
    });

    it('should return 400 for missing title', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          date: '2024-01-15',
        })
        .expect(400);
    });

    it('should return 400 for missing date', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'No Date Event',
        })
        .expect(400);
    });

    it('should return 400 for invalid date format', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Invalid Date',
          date: '01-15-2024', // Wrong format
        })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .send({
          title: 'Test Event',
          date: '2024-01-15',
        })
        .expect(401);
    });
  });

  describe('GET /events', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Event 1', date: '2024-01-15' });

      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Event 2', date: '2024-01-20' });
    });

    it('should return all user events', async () => {
      const response = await request(app.getHttpServer())
        .get('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should return empty array when no events', async () => {
      await prisma.event.deleteMany();

      const response = await request(app.getHttpServer())
        .get('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return events sorted by date', async () => {
      const response = await request(app.getHttpServer())
        .get('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body[0].title).toBe('Event 1');
      expect(response.body[1].title).toBe('Event 2');
    });
  });

  describe('GET /events/calendar', () => {
    beforeEach(async () => {
      // Non-recurring event
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Single Event', date: '2024-01-15' });

      // Weekly recurring event
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Weekly Meeting',
          date: '2024-01-01',
          isRecurring: true,
          recurrenceType: 'WEEKLY',
        });
    });

    it('should return non-recurring events in range', async () => {
      const response = await request(app.getHttpServer())
        .get('/events/calendar')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-01-15', endDate: '2024-01-15' })
        .expect(200);

      // Jan 15 includes: Single Event + Weekly Meeting occurrence (Jan 1, 8, 15...)
      expect(response.body).toHaveLength(2);
      const singleEvent = response.body.find((e: any) => e.title === 'Single Event');
      expect(singleEvent).toBeDefined();
      expect(singleEvent.isOccurrence).toBe(false);
    });

    it('should return recurring event occurrences in range', async () => {
      const response = await request(app.getHttpServer())
        .get('/events/calendar')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-01-31' })
        .expect(200);

      // Single event + 5 weekly occurrences (Jan 1, 8, 15, 22, 29)
      expect(response.body.length).toBeGreaterThanOrEqual(5);

      const weeklyOccurrences = response.body.filter((e: any) => e.title === 'Weekly Meeting');
      expect(weeklyOccurrences).toHaveLength(5);
    });

    it('should include isOccurrence flag', async () => {
      const response = await request(app.getHttpServer())
        .get('/events/calendar')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-01-14' })
        .expect(200);

      const weeklyEvents = response.body.filter((e: any) => e.title === 'Weekly Meeting');

      // First occurrence (Jan 1) should have isOccurrence = false
      expect(weeklyEvents[0].isOccurrence).toBe(false);
      // Second occurrence (Jan 8) should have isOccurrence = true
      expect(weeklyEvents[1].isOccurrence).toBe(true);
    });

    it('should not return events outside range', async () => {
      const response = await request(app.getHttpServer())
        .get('/events/calendar')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-02-01', endDate: '2024-02-28' })
        .expect(200);

      // Only weekly occurrences should be present, not the single event
      const singleEvent = response.body.find((e: any) => e.title === 'Single Event');
      expect(singleEvent).toBeUndefined();
    });

    it('should return 400 for missing date params', async () => {
      await request(app.getHttpServer())
        .get('/events/calendar')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 400 when startDate > endDate', async () => {
      await request(app.getHttpServer())
        .get('/events/calendar')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-01-31', endDate: '2024-01-01' })
        .expect(400);
    });

    it('should handle monthly event on 31st in short months', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'End of Month Report',
          date: '2024-01-31',
          isRecurring: true,
          recurrenceType: 'MONTHLY',
        });

      const response = await request(app.getHttpServer())
        .get('/events/calendar')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-03-31' })
        .expect(200);

      const monthlyEvents = response.body.filter((e: any) => e.title === 'End of Month Report');

      // Should have occurrences for Jan 31, Feb 29, Mar 31
      expect(monthlyEvents).toHaveLength(3);

      // Check February occurrence is Feb 29 (2024 is leap year)
      const febOccurrence = monthlyEvents.find((e: any) => {
        const date = new Date(e.occurrenceDate);
        return date.getUTCMonth() === 1; // February
      });
      expect(new Date(febOccurrence.occurrenceDate).getUTCDate()).toBe(29);
    });

    it('should support yearly events (birthdays)', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: "John's Birthday",
          date: '2024-06-15',
          isRecurring: true,
          recurrenceType: 'YEARLY',
        });

      const response = await request(app.getHttpServer())
        .get('/events/calendar')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-01-01', endDate: '2026-12-31' })
        .expect(200);

      const birthdayEvents = response.body.filter((e: any) => e.title === "John's Birthday");

      // Should have occurrences for 2024, 2025, 2026
      expect(birthdayEvents).toHaveLength(3);
    });
  });

  describe('GET /events/:id', () => {
    let eventId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Test Event', date: '2024-01-15' });
      eventId = response.body.id;
    });

    it('should return single event', async () => {
      const response = await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(eventId);
      expect(response.body.title).toBe('Test Event');
    });

    it('should return 404 for non-existent event', async () => {
      await request(app.getHttpServer())
        .get('/events/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/events/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('PATCH /events/:id', () => {
    let eventId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Original Title', date: '2024-01-15' });
      eventId = response.body.id;
    });

    it('should update event title', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(response.body.title).toBe('Updated Title');
    });

    it('should update event date', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-02-20' })
        .expect(200);

      expect(response.body.date).toContain('2024-02-20');
    });

    it('should update event color', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ color: '#B2F2BB' })
        .expect(200);

      expect(response.body.color).toBe('#B2F2BB');
    });

    it('should remove color when set to null', async () => {
      // First add a color
      await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ color: '#A5D8FF' });

      // Then remove it
      const response = await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ color: null })
        .expect(200);

      expect(response.body.color).toBeNull();
    });

    it('should update recurrence settings', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isRecurring: true, recurrenceType: 'MONTHLY' })
        .expect(200);

      expect(response.body.isRecurring).toBe(true);
      expect(response.body.recurrenceType).toBe('MONTHLY');
    });

    it('should return 400 for invalid recurrence combination', async () => {
      await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ recurrenceType: 'WEEKLY' }) // isRecurring is still false
        .expect(400);
    });

    it('should return 404 for non-existent event', async () => {
      await request(app.getHttpServer())
        .patch('/events/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /events/:id', () => {
    let eventId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Event to Delete', date: '2024-01-15' });
      eventId = response.body.id;
    });

    it('should delete event', async () => {
      await request(app.getHttpServer())
        .delete(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent event', async () => {
      await request(app.getHttpServer())
        .delete('/events/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('Authorization', () => {
    let eventId: string;
    let anotherToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Test Event', date: '2024-01-15' });
      eventId = response.body.id;

      // Register another user
      const anotherUser = {
        email: 'another@example.com',
        password: 'password123',
        name: 'Another User',
      };
      await request(app.getHttpServer()).post('/auth/register').send(anotherUser);
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: anotherUser.email, password: anotherUser.password });
      anotherToken = loginResponse.body.accessToken;
    });

    it("should not allow accessing another user's event", async () => {
      await request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(404);
    });

    it("should not allow updating another user's event", async () => {
      await request(app.getHttpServer())
        .patch(`/events/${eventId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({ title: 'Hacked!' })
        .expect(404);
    });

    it("should not allow deleting another user's event", async () => {
      await request(app.getHttpServer())
        .delete(`/events/${eventId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(404);
    });

    it('should not return other user events in findAll', async () => {
      const response = await request(app.getHttpServer())
        .get('/events')
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('should not return other user events in calendar query', async () => {
      const response = await request(app.getHttpServer())
        .get('/events/calendar')
        .set('Authorization', `Bearer ${anotherToken}`)
        .query({ startDate: '2024-01-01', endDate: '2024-12-31' })
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });
});
