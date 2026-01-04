import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('DaysController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;

  const testUser = {
    email: 'daytest@example.com',
    password: 'password123',
    name: 'Day Test User',
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
    userId = loginResponse.body.user.id;
  });

  afterAll(async () => {
    await prisma.note.deleteMany();
    await prisma.timeBlock.deleteMany();
    await prisma.day.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /days', () => {
    it('should create a new day', async () => {
      const response = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.isCompleted).toBe(false);
      expect(response.body.userId).toBe(userId);
    });

    it('should return 409 when day already exists for date', async () => {
      await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' })
        .expect(409);
    });

    it('should return 400 for invalid date format', async () => {
      await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: 'invalid-date' })
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).post('/days').send({ date: '2024-01-15' }).expect(401);
    });
  });

  describe('GET /days', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' });
      await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-16' });
      await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-20' });
    });

    it('should return days in date range', async () => {
      const response = await request(app.getHttpServer())
        .get('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-01-15', endDate: '2024-01-17' })
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should return empty array when no days in range', async () => {
      const response = await request(app.getHttpServer())
        .get('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-02-01', endDate: '2024-02-28' })
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('should return 400 when missing date range parameters', async () => {
      await request(app.getHttpServer())
        .get('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should include time blocks in response', async () => {
      const dayResponse = await request(app.getHttpServer())
        .get('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-01-15', endDate: '2024-01-15' });

      const dayId = dayResponse.body[0].id;

      await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Morning',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        });

      const response = await request(app.getHttpServer())
        .get('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ startDate: '2024-01-15', endDate: '2024-01-15' })
        .expect(200);

      expect(response.body[0].timeBlocks).toHaveLength(1);
    });
  });

  describe('GET /days/:id', () => {
    let dayId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' });
      dayId = response.body.id;
    });

    it('should return single day with time blocks', async () => {
      const response = await request(app.getHttpServer())
        .get(`/days/${dayId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(dayId);
      expect(response.body).toHaveProperty('timeBlocks');
    });

    it('should return 404 for non-existent day', async () => {
      await request(app.getHttpServer())
        .get('/days/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/days/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /days/date/:date', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' });
    });

    it('should return day by date', async () => {
      const response = await request(app.getHttpServer())
        .get('/days/date/2024-01-15')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
    });

    it('should return null when no day exists for date', async () => {
      const response = await request(app.getHttpServer())
        .get('/days/date/2024-02-01')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // When no day exists, the controller returns null which becomes empty response
      expect(response.body).not.toHaveProperty('id');
    });
  });

  describe('PATCH /days/:id', () => {
    let dayId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' });
      dayId = response.body.id;
    });

    it('should update day isCompleted status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/days/${dayId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true })
        .expect(200);

      expect(response.body.isCompleted).toBe(true);
    });

    it('should return 404 for non-existent day', async () => {
      await request(app.getHttpServer())
        .patch('/days/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true })
        .expect(404);
    });
  });

  describe('DELETE /days/:id', () => {
    let dayId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' });
      dayId = response.body.id;
    });

    it('should delete day', async () => {
      await request(app.getHttpServer())
        .delete(`/days/${dayId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/days/${dayId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should cascade delete time blocks and notes', async () => {
      const timeBlockResponse = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Morning',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        });

      const timeBlockId = timeBlockResponse.body.id;

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Test note',
          timeBlockId,
        });

      await request(app.getHttpServer())
        .delete(`/days/${dayId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent day', async () => {
      await request(app.getHttpServer())
        .delete('/days/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('Authorization', () => {
    it("should not allow accessing another user's day", async () => {
      // Create a day
      const dayResponse = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-15' });
      const dayId = dayResponse.body.id;

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
      const anotherToken = loginResponse.body.accessToken;

      // Try to access first user's day
      await request(app.getHttpServer())
        .get(`/days/${dayId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(404);
    });
  });
});
