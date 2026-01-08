import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';

describe('TodosController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let dayId: string;
  let timeBlockId: string;

  const testUser = {
    email: 'todotest@example.com',
    password: 'password123',
    name: 'Todo Test User',
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

    // Create a day
    const dayResponse = await request(app.getHttpServer())
      .post('/days')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ date: '2024-01-15' });

    dayId = dayResponse.body.id;

    // Create a time block
    const timeBlockResponse = await request(app.getHttpServer())
      .post('/time-blocks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Morning Routine',
        startTime: '06:00',
        endTime: '08:00',
        dayId,
      });
    timeBlockId = timeBlockResponse.body.id;
  });

  afterAll(async () => {
    await prisma.todo.deleteMany();
    await prisma.note.deleteMany();
    await prisma.timeBlock.deleteMany();
    await prisma.day.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /todos', () => {
    it('should create an inbox todo', async () => {
      const response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Buy groceries',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Buy groceries');
      expect(response.body.order).toBe(0);
      expect(response.body.dayId).toBeNull();
      expect(response.body.timeBlockId).toBeNull();
      expect(response.body.isCompleted).toBe(false);
    });

    it('should create a day todo', async () => {
      const response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Daily task',
          dayId,
        })
        .expect(201);

      expect(response.body.dayId).toBe(dayId);
      expect(response.body.timeBlockId).toBeNull();
      expect(response.body).toHaveProperty('day');
    });

    it('should create a time block todo', async () => {
      const response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Block specific task',
          timeBlockId,
        })
        .expect(201);

      expect(response.body.timeBlockId).toBe(timeBlockId);
      expect(response.body.dayId).toBeNull();
      expect(response.body).toHaveProperty('timeBlock');
    });

    it('should create todo with deadline', async () => {
      const response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Task with deadline',
          deadline: '2024-12-31T23:59:59.000Z',
        })
        .expect(201);

      expect(response.body.deadline).toBe('2024-12-31T23:59:59.000Z');
    });

    it('should auto-assign order for subsequent todos', async () => {
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'First' });

      const response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Second' })
        .expect(201);

      expect(response.body.order).toBe(1);
    });

    it('should use provided order when specified', async () => {
      const response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Specific order',
          order: 5,
        })
        .expect(201);

      expect(response.body.order).toBe(5);
    });

    it('should return 400 when both dayId and timeBlockId provided', async () => {
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Invalid',
          dayId,
          timeBlockId,
        })
        .expect(400);
    });

    it('should return 400 for missing title', async () => {
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });

    it('should return 404 for non-existent day', async () => {
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test',
          dayId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404);
    });

    it('should return 404 for non-existent time block', async () => {
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test',
          timeBlockId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer()).post('/todos').send({ title: 'Test' }).expect(401);
    });
  });

  describe('GET /todos', () => {
    beforeEach(async () => {
      // Create inbox todo
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Inbox todo' });

      // Create day todo
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Day todo', dayId });

      // Create time block todo
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Block todo', timeBlockId });
    });

    it('should return all user todos without filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
    });

    it('should filter inbox todos', async () => {
      const response = await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ inbox: 'true' })
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Inbox todo');
      expect(response.body[0].dayId).toBeNull();
      expect(response.body[0].timeBlockId).toBeNull();
    });

    it('should filter by dayId', async () => {
      const response = await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ dayId })
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Day todo');
      expect(response.body[0].dayId).toBe(dayId);
    });

    it('should filter by timeBlockId', async () => {
      const response = await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeBlockId })
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Block todo');
      expect(response.body[0].timeBlockId).toBe(timeBlockId);
    });

    it('should filter by completion status', async () => {
      // Mark one todo as completed
      const todos = await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${accessToken}`);

      await request(app.getHttpServer())
        .patch(`/todos/${todos.body[0].id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true });

      const response = await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ isCompleted: 'true' })
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].isCompleted).toBe(true);
    });

    it('should return todos in order', async () => {
      const response = await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ inbox: 'true' })
        .expect(200);

      for (let i = 0; i < response.body.length - 1; i++) {
        expect(response.body[i].order).toBeLessThanOrEqual(response.body[i + 1].order);
      }
    });
  });

  describe('GET /todos/:id', () => {
    let todoId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Test todo' });
      todoId = response.body.id;
    });

    it('should return single todo', async () => {
      const response = await request(app.getHttpServer())
        .get(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(todoId);
      expect(response.body.title).toBe('Test todo');
    });

    it('should return 404 for non-existent todo', async () => {
      await request(app.getHttpServer())
        .get('/todos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/todos/invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('PATCH /todos/:id', () => {
    let todoId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Original title' });
      todoId = response.body.id;
    });

    it('should update todo title', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated title' })
        .expect(200);

      expect(response.body.title).toBe('Updated title');
    });

    it('should update todo completion status', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isCompleted: true })
        .expect(200);

      expect(response.body.isCompleted).toBe(true);
    });

    it('should update todo deadline', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deadline: '2024-12-31T23:59:59.000Z' })
        .expect(200);

      expect(response.body.deadline).toBe('2024-12-31T23:59:59.000Z');
    });

    it('should remove deadline when set to null', async () => {
      // First set a deadline
      await request(app.getHttpServer())
        .patch(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deadline: '2024-12-31T23:59:59.000Z' });

      // Then remove it
      const response = await request(app.getHttpServer())
        .patch(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deadline: null })
        .expect(200);

      expect(response.body.deadline).toBeNull();
    });

    it('should return 404 for non-existent todo', async () => {
      await request(app.getHttpServer())
        .patch('/todos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('PATCH /todos/:id/move', () => {
    let inboxTodoId: string;
    let dayTodoId: string;

    beforeEach(async () => {
      const inboxTodo = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Inbox todo' });
      inboxTodoId = inboxTodo.body.id;

      const dayTodo = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Day todo', dayId });
      dayTodoId = dayTodo.body.id;
    });

    it('should move todo from inbox to day', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/todos/${inboxTodoId}/move`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetDayId: dayId })
        .expect(200);

      expect(response.body.dayId).toBe(dayId);
      expect(response.body.timeBlockId).toBeNull();
    });

    it('should move todo from inbox to time block', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/todos/${inboxTodoId}/move`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetTimeBlockId: timeBlockId })
        .expect(200);

      expect(response.body.timeBlockId).toBe(timeBlockId);
      expect(response.body.dayId).toBeNull();
    });

    it('should move todo from day to inbox', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/todos/${dayTodoId}/move`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(200);

      expect(response.body.dayId).toBeNull();
      expect(response.body.timeBlockId).toBeNull();
    });

    it('should assign correct order when moving to new context', async () => {
      // There's already one inbox todo from beforeEach (order 0)
      // Create another inbox todo (order 1)
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Another inbox todo' });

      // Move day todo to inbox
      const response = await request(app.getHttpServer())
        .patch(`/todos/${dayTodoId}/move`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(200);

      // Should get order after existing inbox todos (0, 1 exist, so new order is 2)
      expect(response.body.order).toBe(2);
    });

    it('should return 400 when both targets provided', async () => {
      await request(app.getHttpServer())
        .patch(`/todos/${inboxTodoId}/move`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetDayId: dayId, targetTimeBlockId: timeBlockId })
        .expect(400);
    });

    it('should return 404 for non-existent target day', async () => {
      await request(app.getHttpServer())
        .patch(`/todos/${inboxTodoId}/move`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetDayId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('should return 404 for non-existent todo', async () => {
      await request(app.getHttpServer())
        .patch('/todos/00000000-0000-0000-0000-000000000000/move')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetDayId: dayId })
        .expect(404);
    });
  });

  describe('PATCH /todos/reorder', () => {
    let todo1Id: string;
    let todo2Id: string;
    let todo3Id: string;

    beforeEach(async () => {
      const todo1 = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'First' });
      todo1Id = todo1.body.id;

      const todo2 = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Second' });
      todo2Id = todo2.body.id;

      const todo3 = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Third' });
      todo3Id = todo3.body.id;
    });

    it('should reorder inbox todos', async () => {
      const response = await request(app.getHttpServer())
        .patch('/todos/reorder')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ inbox: 'true' })
        .send({ orderedIds: [todo3Id, todo1Id, todo2Id] })
        .expect(200);

      expect(response.body[0].id).toBe(todo3Id);
      expect(response.body[0].order).toBe(0);
      expect(response.body[1].id).toBe(todo1Id);
      expect(response.body[1].order).toBe(1);
      expect(response.body[2].id).toBe(todo2Id);
      expect(response.body[2].order).toBe(2);
    });

    it('should reorder day todos', async () => {
      // Create day todos
      const dayTodo1 = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Day 1', dayId });

      const dayTodo2 = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Day 2', dayId });

      const response = await request(app.getHttpServer())
        .patch('/todos/reorder')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ dayId })
        .send({ orderedIds: [dayTodo2.body.id, dayTodo1.body.id] })
        .expect(200);

      expect(response.body[0].id).toBe(dayTodo2.body.id);
      expect(response.body[0].order).toBe(0);
    });

    it('should reorder time block todos', async () => {
      // Create time block todos
      const blockTodo1 = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Block 1', timeBlockId });

      const blockTodo2 = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Block 2', timeBlockId });

      const response = await request(app.getHttpServer())
        .patch('/todos/reorder')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeBlockId })
        .send({ orderedIds: [blockTodo2.body.id, blockTodo1.body.id] })
        .expect(200);

      expect(response.body[0].id).toBe(blockTodo2.body.id);
    });

    it('should return 400 for empty orderedIds array', async () => {
      await request(app.getHttpServer())
        .patch('/todos/reorder')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ inbox: 'true' })
        .send({ orderedIds: [] })
        .expect(400);
    });
  });

  describe('DELETE /todos/:id', () => {
    let todoId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Test todo' });
      todoId = response.body.id;
    });

    it('should delete todo', async () => {
      await request(app.getHttpServer())
        .delete(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should reorder remaining todos after deletion', async () => {
      const todo2 = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Second todo' });

      await request(app.getHttpServer())
        .delete(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const response = await request(app.getHttpServer())
        .get(`/todos/${todo2.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.order).toBe(0);
    });

    it('should return 404 for non-existent todo', async () => {
      await request(app.getHttpServer())
        .delete('/todos/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('Authorization', () => {
    let todoId: string;
    let anotherToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Test todo' });
      todoId = response.body.id;

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

    it("should not allow accessing another user's todo", async () => {
      await request(app.getHttpServer())
        .get(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(404);
    });

    it("should not allow updating another user's todo", async () => {
      await request(app.getHttpServer())
        .patch(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({ title: 'Hacked!' })
        .expect(404);
    });

    it("should not allow deleting another user's todo", async () => {
      await request(app.getHttpServer())
        .delete(`/todos/${todoId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(404);
    });

    it("should not allow moving another user's todo", async () => {
      // Create a day for the other user
      const otherDayResponse = await request(app.getHttpServer())
        .post('/days')
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({ date: '2024-01-16' });

      await request(app.getHttpServer())
        .patch(`/todos/${todoId}/move`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({ targetDayId: otherDayResponse.body.id })
        .expect(404);
    });

    it("should not allow listing todos from another user's day", async () => {
      // Create a todo for the main user with dayId
      await request(app.getHttpServer())
        .post('/todos')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Day todo', dayId });

      // Try to access with another user
      await request(app.getHttpServer())
        .get('/todos')
        .set('Authorization', `Bearer ${anotherToken}`)
        .query({ dayId })
        .expect(404);
    });
  });
});
