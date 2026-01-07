import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('NotesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let timeBlockId: string;

  const testUser = {
    email: 'notetest@example.com',
    password: 'password123',
    name: 'Note Test User',
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

    // Create a day
    const dayResponse = await request(app.getHttpServer())
      .post('/days')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ date: '2024-01-15' });

    // Create a time block
    const timeBlockResponse = await request(app.getHttpServer())
      .post('/time-blocks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Morning Routine',
        startTime: '06:00',
        endTime: '08:00',
        dayId: dayResponse.body.id,
      });
    timeBlockId = timeBlockResponse.body.id;
  });

  afterAll(async () => {
    await prisma.note.deleteMany();
    await prisma.timeBlock.deleteMany();
    await prisma.day.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /notes', () => {
    it('should create a new note', async () => {
      const response = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Wake up and stretch',
          timeBlockId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe('Wake up and stretch');
      expect(response.body.order).toBe(0);
      expect(response.body.timeBlockId).toBe(timeBlockId);
    });

    it('should auto-assign order for subsequent notes', async () => {
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'First note',
          timeBlockId,
        });

      const response = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Second note',
          timeBlockId,
        })
        .expect(201);

      expect(response.body.order).toBe(1);
    });

    it('should use provided order when specified', async () => {
      const response = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Specific order',
          timeBlockId,
          order: 5,
        })
        .expect(201);

      expect(response.body.order).toBe(5);
    });

    it('should return 400 for missing content', async () => {
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          timeBlockId,
        })
        .expect(400);
    });

    it('should return 404 for non-existent time block', async () => {
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Test',
          timeBlockId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/notes')
        .send({
          content: 'Test',
          timeBlockId,
        })
        .expect(401);
    });
  });

  describe('GET /notes', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'First note',
          timeBlockId,
        });
      await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Second note',
          timeBlockId,
        });
    });

    it('should return all notes for a time block', async () => {
      const response = await request(app.getHttpServer())
        .get('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeBlockId })
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].order).toBe(0);
      expect(response.body[1].order).toBe(1);
    });

    it('should return empty array when no notes exist', async () => {
      // Create another time block without notes
      const dayResponse = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ date: '2024-01-16' });

      const anotherTbResponse = await request(app.getHttpServer())
        .post('/time-blocks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Empty Block',
          startTime: '10:00',
          endTime: '12:00',
          dayId: dayResponse.body.id,
        });

      const response = await request(app.getHttpServer())
        .get('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeBlockId: anotherTbResponse.body.id })
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('should return 400 when timeBlockId is missing', async () => {
      await request(app.getHttpServer())
        .get('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /notes/:id', () => {
    let noteId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Test note',
          timeBlockId,
        });
      noteId = response.body.id;
    });

    it('should return single note with time block info', async () => {
      const response = await request(app.getHttpServer())
        .get(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(noteId);
      expect(response.body.content).toBe('Test note');
      expect(response.body).toHaveProperty('timeBlock');
    });

    it('should return 404 for non-existent note', async () => {
      await request(app.getHttpServer())
        .get('/notes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/notes/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('PATCH /notes/:id', () => {
    let noteId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Original content',
          timeBlockId,
        });
      noteId = response.body.id;
    });

    it('should update note content', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Updated content' })
        .expect(200);

      expect(response.body.content).toBe('Updated content');
    });

    it('should return 404 for non-existent note', async () => {
      await request(app.getHttpServer())
        .patch('/notes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Updated' })
        .expect(404);
    });
  });

  describe('PATCH /notes/reorder', () => {
    let note1Id: string;
    let note2Id: string;
    let note3Id: string;

    beforeEach(async () => {
      const note1 = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'First',
          timeBlockId,
        });
      note1Id = note1.body.id;

      const note2 = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Second',
          timeBlockId,
        });
      note2Id = note2.body.id;

      const note3 = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Third',
          timeBlockId,
        });
      note3Id = note3.body.id;
    });

    it('should reorder notes', async () => {
      const response = await request(app.getHttpServer())
        .patch('/notes/reorder')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeBlockId })
        .send({ orderedIds: [note3Id, note1Id, note2Id] })
        .expect(200);

      expect(response.body[0].id).toBe(note3Id);
      expect(response.body[0].order).toBe(0);
      expect(response.body[1].id).toBe(note1Id);
      expect(response.body[1].order).toBe(1);
      expect(response.body[2].id).toBe(note2Id);
      expect(response.body[2].order).toBe(2);
    });

    it('should return 400 when timeBlockId is missing', async () => {
      await request(app.getHttpServer())
        .patch('/notes/reorder')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ orderedIds: [note3Id, note1Id, note2Id] })
        .expect(400);
    });

    it('should return 400 for empty orderedIds array', async () => {
      await request(app.getHttpServer())
        .patch('/notes/reorder')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeBlockId })
        .send({ orderedIds: [] })
        .expect(400);
    });
  });

  describe('DELETE /notes/:id', () => {
    let noteId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Test note',
          timeBlockId,
        });
      noteId = response.body.id;
    });

    it('should delete note', async () => {
      await request(app.getHttpServer())
        .delete(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reorder remaining notes after deletion', async () => {
      const note2 = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Second note',
          timeBlockId,
        });

      await request(app.getHttpServer())
        .delete(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get(`/notes/${note2.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.order).toBe(0);
    });

    it('should return 404 for non-existent note', async () => {
      await request(app.getHttpServer())
        .delete('/notes/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('Authorization', () => {
    let noteId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Test note',
          timeBlockId,
        });
      noteId = response.body.id;
    });

    it("should not allow accessing another user's note", async () => {
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

      // Try to access first user's note
      await request(app.getHttpServer())
        .get(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(404);
    });

    it("should not allow updating another user's note", async () => {
      const anotherUser = {
        email: 'another2@example.com',
        password: 'password123',
        name: 'Another User 2',
      };
      await request(app.getHttpServer()).post('/auth/register').send(anotherUser);
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: anotherUser.email, password: anotherUser.password });
      const anotherToken = loginResponse.body.accessToken;

      await request(app.getHttpServer())
        .patch(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({ content: 'Hacked!' })
        .expect(404);
    });

    it("should not allow deleting another user's note", async () => {
      const anotherUser = {
        email: 'another3@example.com',
        password: 'password123',
        name: 'Another User 3',
      };
      await request(app.getHttpServer()).post('/auth/register').send(anotherUser);
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: anotherUser.email, password: anotherUser.password });
      const anotherToken = loginResponse.body.accessToken;

      await request(app.getHttpServer())
        .delete(`/notes/${noteId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(404);
    });
  });
});
