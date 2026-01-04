import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('TimeBlocksController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let dayId: string;

  const testUser = {
    email: 'tbtest@example.com',
    password: 'password123',
    name: 'TimeBlock Test User',
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

    // Create a day for time blocks
    const dayResponse = await request(app.getHttpServer())
      .post('/days')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ date: '2024-01-15' });
    dayId = dayResponse.body.id;
  });

  afterAll(async () => {
    await prisma.note.deleteMany();
    await prisma.timeBlock.deleteMany();
    await prisma.day.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /time-blocks', () => {
    it('should create a new time block', async () => {
      const response = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Morning Routine',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
          color: '#A5D8FF',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Morning Routine');
      expect(response.body.startTime).toBe('06:00');
      expect(response.body.endTime).toBe('08:00');
      expect(response.body.order).toBe(0);
      expect(response.body.isCompleted).toBe(false);
      expect(response.body.color).toBe('#A5D8FF');
    });

    it('should auto-assign order for subsequent time blocks', async () => {
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
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Afternoon',
          startTime: '12:00',
          endTime: '14:00',
          dayId,
        })
        .expect(201);

      expect(response.body.order).toBe(1);
    });

    it('should return 400 for invalid time format', async () => {
      await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Invalid',
          startTime: '6:00',
          endTime: '8:00',
          dayId,
        })
        .expect(400);
    });

    it('should return 400 when end time is before start time', async () => {
      await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Invalid',
          startTime: '10:00',
          endTime: '08:00',
          dayId,
        })
        .expect(400);
    });

    it('should return 400 for invalid hex color', async () => {
      await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Invalid Color',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
          color: 'red',
        })
        .expect(400);
    });

    it('should return 404 for non-existent day', async () => {
      await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test',
          startTime: '06:00',
          endTime: '08:00',
          dayId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/time-blocks')
        .send({
          name: 'Test',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        })
        .expect(401);
    });
  });

  describe('GET /time-blocks', () => {
    beforeEach(async () => {
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
    });

    it('should return all time blocks for a day', async () => {
      const response = await request(app.getHttpServer())
        .get('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ dayId })
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].order).toBe(0);
      expect(response.body[1].order).toBe(1);
    });

    it('should return 400 when dayId is missing', async () => {
      await request(app.getHttpServer())
        .get('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should include notes in response', async () => {
      const tbResponse = await request(app.getHttpServer())
        .get('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ dayId });

      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Test note',
          timeBlockId: tbResponse.body[0].id,
        });

      const response = await request(app.getHttpServer())
        .get('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ dayId })
        .expect(200);

      expect(response.body[0].notes).toHaveLength(1);
    });
  });

  describe('GET /time-blocks/:id', () => {
    let timeBlockId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Morning',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        });
      timeBlockId = response.body.id;
    });

    it('should return single time block with notes', async () => {
      const response = await request(app.getHttpServer())
        .get(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(timeBlockId);
      expect(response.body).toHaveProperty('notes');
      expect(response.body).toHaveProperty('day');
    });

    it('should return 404 for non-existent time block', async () => {
      await request(app.getHttpServer())
        .get('/time-blocks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /time-blocks/:id', () => {
    let timeBlockId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Morning',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        });
      timeBlockId = response.body.id;
    });

    it('should update time block name', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
    });

    it('should update time block times', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ startTime: '07:00', endTime: '09:00' })
        .expect(200);

      expect(response.body.startTime).toBe('07:00');
      expect(response.body.endTime).toBe('09:00');
    });

    it('should mark time block as completed', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true })
        .expect(200);

      expect(response.body.isCompleted).toBe(true);
    });

    it('should return 400 when end time becomes before start time', async () => {
      await request(app.getHttpServer())
        .patch(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ endTime: '05:00' })
        .expect(400);
    });

    it('should return 404 for non-existent time block', async () => {
      await request(app.getHttpServer())
        .patch('/time-blocks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('PATCH /time-blocks/reorder', () => {
    let tb1Id: string;
    let tb2Id: string;
    let tb3Id: string;

    beforeEach(async () => {
      const tb1 = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'First',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        });
      tb1Id = tb1.body.id;

      const tb2 = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Second',
          startTime: '09:00',
          endTime: '11:00',
          dayId,
        });
      tb2Id = tb2.body.id;

      const tb3 = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Third',
          startTime: '12:00',
          endTime: '14:00',
          dayId,
        });
      tb3Id = tb3.body.id;
    });

    it('should reorder time blocks', async () => {
      const response = await request(app.getHttpServer())
        .patch('/time-blocks/reorder')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ dayId })
        .send({ orderedIds: [tb3Id, tb1Id, tb2Id] })
        .expect(200);

      expect(response.body[0].id).toBe(tb3Id);
      expect(response.body[0].order).toBe(0);
      expect(response.body[1].id).toBe(tb1Id);
      expect(response.body[1].order).toBe(1);
      expect(response.body[2].id).toBe(tb2Id);
      expect(response.body[2].order).toBe(2);
    });

    it('should return 400 when dayId is missing', async () => {
      await request(app.getHttpServer())
        .patch('/time-blocks/reorder')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ orderedIds: [tb3Id, tb1Id, tb2Id] })
        .expect(400);
    });
  });

  describe('DELETE /time-blocks/:id', () => {
    let timeBlockId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Morning',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        });
      timeBlockId = response.body.id;
    });

    it('should delete time block', async () => {
      await request(app.getHttpServer())
        .delete(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reorder remaining time blocks after deletion', async () => {
      const tb2 = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Second',
          startTime: '09:00',
          endTime: '11:00',
          dayId,
        });

      await request(app.getHttpServer())
        .delete(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get(`/time-blocks/${tb2.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.order).toBe(0);
    });

    it('should cascade delete notes', async () => {
      const noteResponse = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Test note',
          timeBlockId,
        });

      await request(app.getHttpServer())
        .delete(`/time-blocks/${timeBlockId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/notes/${noteResponse.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('Day completion auto-update', () => {
    it('should mark day as completed when all time blocks are completed', async () => {
      const tb1 = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'First',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        });

      const tb2 = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Second',
          startTime: '09:00',
          endTime: '11:00',
          dayId,
        });

      await request(app.getHttpServer())
        .patch(`/time-blocks/${tb1.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      await request(app.getHttpServer())
        .patch(`/time-blocks/${tb2.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      const dayResponse = await request(app.getHttpServer())
        .get(`/days/${dayId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(dayResponse.body.isCompleted).toBe(true);
    });

    it('should mark day as incomplete when a time block becomes incomplete', async () => {
      const tb = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'First',
          startTime: '06:00',
          endTime: '08:00',
          dayId,
        });

      await request(app.getHttpServer())
        .patch(`/time-blocks/${tb.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      await request(app.getHttpServer())
        .patch(`/time-blocks/${tb.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: false });

      const dayResponse = await request(app.getHttpServer())
        .get(`/days/${dayId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(dayResponse.body.isCompleted).toBe(false);
    });
  });
});
