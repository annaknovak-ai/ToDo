// @vitest-environment node
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Task } from '../shared/types.js';
import { createTaskOrderHandler } from './taskOrderHandler.js';
import { createTaskStatusHandler } from './taskStatusHandler.js';
import { TaskNotFoundError, TaskOrderConflictError, type TasksRepository } from './tasksRepository.js';

type FakeResponse = VercelResponse & { statusCode: number; body: unknown; headers: Record<string, string> };

function fakeResponse(): FakeResponse {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    end() {
      return res;
    },
  };
  return res as unknown as FakeResponse;
}

const ID = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
const OTHER = '9a7b1c2d-3e4f-4a6b-8c1e-5d4a3f2b8c1e';

function request(
  method: string,
  body?: unknown,
  { id = ID, headers = { 'content-type': 'application/json' } }: { id?: unknown; headers?: Record<string, string> } = {},
): VercelRequest {
  return { method, headers, body, query: { id } } as unknown as VercelRequest;
}

function repo(overrides: Partial<TasksRepository>): () => TasksRepository {
  const notExpected = async () => {
    throw new Error('not expected');
  };
  return () => ({
    listTasks: notExpected,
    createTask: notExpected,
    updateTaskDetails: notExpected,
    deleteTask: notExpected,
    setTaskCompleted: notExpected,
    reorderTasks: notExpected,
    ...overrides,
  });
}

const task: Task = { id: ID, title: 'משימה', description: null, dueDate: null, completed: true, position: 3 };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PATCH /api/tasks/:id/status', () => {
  async function patch(body: unknown, overrides: Partial<TasksRepository> = {}, options = {}) {
    const res = fakeResponse();
    await createTaskStatusHandler(repo(overrides))(request('PATCH', body, options), res);
    return res;
  }

  it('saves the explicit value and answers 200 with the task, uncached', async () => {
    const setTaskCompleted = vi.fn(async () => task);
    const res = await patch({ completed: true, position: 0, title: 'x' }, { setTaskCompleted });
    expect(setTaskCompleted).toHaveBeenCalledWith(ID, true);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(task);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('can set a task back to "to do"', async () => {
    const setTaskCompleted = vi.fn(async () => ({ ...task, completed: false }));
    await patch({ completed: false }, { setTaskCompleted });
    expect(setTaskCompleted).toHaveBeenCalledWith(ID, false);
  });

  it.each([[{}], [{ completed: 'true' }], [{ completed: 1 }], [{ completed: null }], [[true]], [null]])(
    'rejects %j with 400',
    async (body) => {
      const res = await patch(body);
      expect(res.statusCode).toBe(400);
    },
  );

  it('rejects an id that is not a UUID with 400', async () => {
    const res = await patch({ completed: true }, {}, { id: 'abc' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a body that is not JSON with 400', async () => {
    const res = await patch({ completed: true }, {}, { headers: { 'content-type': 'text/plain' } });
    expect(res.statusCode).toBe(400);
  });

  it('answers 404 for a task that no longer exists', async () => {
    const res = await patch(
      { completed: true },
      {
        setTaskCompleted: async () => {
          throw new TaskNotFoundError();
        },
      },
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ error: { code: 'TASK_NOT_FOUND' } });
  });

  it('answers 500 on an unexpected error', async () => {
    const res = await patch(
      { completed: true },
      {
        setTaskCompleted: async () => {
          throw new Error('boom');
        },
      },
    );
    expect(res.statusCode).toBe(500);
  });

  it.each(['GET', 'PUT', 'POST', 'DELETE'])('answers 405 to %s', async (method) => {
    const res = fakeResponse();
    await createTaskStatusHandler(repo({}))(request(method, { completed: true }), res);
    expect(res.statusCode).toBe(405);
  });
});

describe('PUT /api/tasks/order', () => {
  async function put(body: unknown, overrides: Partial<TasksRepository> = {}, headers?: Record<string, string>) {
    const res = fakeResponse();
    await createTaskOrderHandler(repo(overrides))(request('PUT', body, headers ? { headers } : {}), res);
    return res;
  }

  it('passes the ids to the repository and answers 200 with the list', async () => {
    const reorderTasks = vi.fn(async () => [task]);
    const res = await put({ orderedIds: [OTHER, ID] }, { reorderTasks });
    expect(reorderTasks).toHaveBeenCalledWith([OTHER, ID]);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([task]);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('accepts an empty list', async () => {
    const reorderTasks = vi.fn(async () => []);
    const res = await put({ orderedIds: [] }, { reorderTasks });
    expect(res.statusCode).toBe(200);
  });

  it('accepts 1,000 ids (within the 64KB limit)', async () => {
    const ids = Array.from({ length: 1000 }, () => crypto.randomUUID());
    const reorderTasks = vi.fn(async () => []);
    const res = await put({ orderedIds: ids }, { reorderTasks });
    expect(res.statusCode).toBe(200);
    expect(reorderTasks).toHaveBeenCalledWith(ids);
  });

  it.each([[{}], [{ orderedIds: ID }], [{ orderedIds: ['abc'] }], [{ orderedIds: [ID, 5] }], [[ID]], [null]])(
    'rejects %j with 400',
    async (body) => {
      const res = await put(body);
      expect(res.statusCode).toBe(400);
    },
  );

  it('rejects more than 1,000 ids with 400', async () => {
    const ids = Array.from({ length: 1001 }, () => ID);
    const res = await put({ orderedIds: ids });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a body over 64KB with 413', async () => {
    const res = await put({ orderedIds: [], padding: 'x'.repeat(65 * 1024) });
    expect(res.statusCode).toBe(413);
  });

  it('rejects a body that is not JSON with 400', async () => {
    const res = await put({ orderedIds: [] }, {}, { 'content-type': 'text/plain' });
    expect(res.statusCode).toBe(400);
  });

  it('answers 409 ORDER_CONFLICT when the ids do not match the list', async () => {
    const res = await put(
      { orderedIds: [ID] },
      {
        reorderTasks: async () => {
          throw new TaskOrderConflictError();
        },
      },
    );
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'ORDER_CONFLICT', message: 'הרשימה השתנתה בינתיים. רענן כדי לראות את הגרסה העדכנית.' },
    });
  });

  it('answers 503 when the database is unreachable', async () => {
    const res = await put(
      { orderedIds: [ID] },
      {
        reorderTasks: async () => {
          throw Object.assign(new Error('connect'), { code: 'ECONNREFUSED' });
        },
      },
    );
    expect(res.statusCode).toBe(503);
  });

  it.each(['GET', 'PATCH', 'POST', 'DELETE'])('answers 405 to %s', async (method) => {
    const res = fakeResponse();
    await createTaskOrderHandler(repo({}))(request(method, { orderedIds: [] }), res);
    expect(res.statusCode).toBe(405);
  });
});
