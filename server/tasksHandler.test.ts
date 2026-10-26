// @vitest-environment node
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Task, TaskInput } from '../shared/types.js';
import { stripSslMode } from './db.js';
import { createTasksHandler } from './tasksHandler.js';
import { TaskLimitError, toTask, type TasksRepository } from './tasksRepository.js';

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
  };
  return res as unknown as FakeResponse;
}

function request(method: string): VercelRequest {
  return { method, headers: {} } as VercelRequest;
}

function postRequest(body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }): VercelRequest {
  return { method: 'POST', headers, body } as unknown as VercelRequest;
}

function repo(overrides: Partial<TasksRepository>): () => TasksRepository {
  return () => ({
    listTasks: async () => [],
    createTask: async () => {
      throw new Error('not expected');
    },
    updateTaskDetails: async () => {
      throw new Error('not expected');
    },
    deleteTask: async () => {
      throw new Error('not expected');
    },
    setTaskCompleted: async () => {
      throw new Error('not expected');
    },
    reorderTasks: async () => {
      throw new Error('not expected');
    },
    ...overrides,
  });
}

const task: Task = { id: 'x', title: 'א', description: null, dueDate: '2026-12-01', completed: false, position: 0 };

// 2026-10-25 22:30 UTC is already 2026-10-26 in Jerusalem (UTC+2).
const now = () => new Date('2026-10-25T22:30:00Z');

describe('GET /api/tasks handler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns the tasks with no-store caching', async () => {
    const res = fakeResponse();
    await createTasksHandler(repo({ listTasks: async () => [task] }))(request('GET'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([task]);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns an empty array for an empty list', async () => {
    const res = fakeResponse();
    await createTasksHandler(repo({}))(request('GET'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rejects other methods with 405', async () => {
    const res = fakeResponse();
    const listTasks = vi.fn(async () => []);
    await createTasksHandler(repo({ listTasks }))(request('DELETE'), res);
    expect(res.statusCode).toBe(405);
    expect(res.headers['allow']).toBe('GET, POST');
    expect(listTasks).not.toHaveBeenCalled();
  });

  it('returns 500 without leaking the database error', async () => {
    const res = fakeResponse();
    await createTasksHandler(
      repo({
        listTasks: async () => {
          throw new Error('relation "secret_table" does not exist');
        },
      }),
    )(request('GET'), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret_table');
  });

  it('returns 503 when the database is unreachable', async () => {
    const res = fakeResponse();
    await createTasksHandler(
      repo({
        listTasks: async () => {
          throw Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' });
        },
      }),
    )(request('GET'), res);
    expect(res.statusCode).toBe(503);
  });
});

describe('POST /api/tasks handler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  async function post(body: unknown, createTask = vi.fn(async (input: TaskInput) => ({ ...task, ...input })), headers?: Record<string, string>) {
    const res = fakeResponse();
    await createTasksHandler(repo({ createTask }), now)(postRequest(body, headers), res);
    return { res, createTask };
  }

  it('creates a task with normalized values and returns 201', async () => {
    const { res, createTask } = await post({ title: '  לקנות חלב  ', description: '   ', dueDate: '2026-10-26' });
    expect(res.statusCode).toBe(201);
    expect(createTask).toHaveBeenCalledWith({ title: 'לקנות חלב', description: null, dueDate: '2026-10-26' });
    expect(res.body).toMatchObject({ title: 'לקנות חלב', completed: false });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('ignores completed, position and unknown fields, and treats missing fields as null', async () => {
    const { res, createTask } = await post({ description: 'ת', completed: true, position: 5, id: 'y' });
    expect(res.statusCode).toBe(201);
    expect(createTask).toHaveBeenCalledWith({ title: null, description: 'ת', dueDate: null });
  });

  it('rejects a non-JSON content type with 400', async () => {
    const { res, createTask } = await post('title=x', undefined, { 'content-type': 'application/x-www-form-urlencoded' });
    expect(res.statusCode).toBe(400);
    expect(createTask).not.toHaveBeenCalled();
  });

  it('rejects a body over 16KB with 413', async () => {
    const { res, createTask } = await post({ title: 'x', description: 'א'.repeat(9000) });
    expect(res.statusCode).toBe(413);
    expect(createTask).not.toHaveBeenCalled();
  });

  it.each([[null], [[]], ['text'], [{ title: 5 }], [{ dueDate: 20261026 }]])('rejects a malformed body %j with 400', async (body) => {
    const { res, createTask } = await post(body);
    expect(res.statusCode).toBe(400);
    expect(createTask).not.toHaveBeenCalled();
  });

  it.each([
    [{ title: ' ', description: '\n' }, 'content', 'יש להזין כותרת או תיאור למשימה'],
    [{ title: 'א'.repeat(101) }, 'title', 'הכותרת יכולה להכיל עד 100 תווים.'],
    [{ description: 'א'.repeat(2001) }, 'description', 'התיאור יכול להכיל עד 2,000 תווים.'],
    // Jerusalem "today" is 2026-10-26, so the UTC date is already in the past.
    [{ title: 'x', dueDate: '2026-10-25' }, 'dueDate', 'תאריך היעד לא יכול להיות בעבר.'],
    [{ title: 'x', dueDate: '2026-02-30' }, 'dueDate', 'תאריך היעד אינו תקין.'],
  ])('rejects invalid input %# with 422', async (body, field, message) => {
    const { res, createTask } = await post(body);
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message, field } });
    expect(createTask).not.toHaveBeenCalled();
  });

  it('returns 409 TASK_LIMIT_REACHED when the list is full', async () => {
    const { res } = await post(
      { title: 'x' },
      vi.fn(async () => {
        throw new TaskLimitError();
      }),
    );
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'TASK_LIMIT_REACHED', message: 'לא ניתן להוסיף משימה: הרשימה התמלאה. מחק משימה קיימת ונסה שוב.' },
    });
  });

  it('returns 500 without leaking the database error', async () => {
    const { res } = await post(
      { title: 'x' },
      vi.fn(async () => {
        throw new Error('insert into secret_table failed');
      }),
    );
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret_table');
  });
});

describe('toTask', () => {
  it('maps database columns to the API shape', () => {
    expect(
      toTask({ id: 'x', title: null, description: 'ת', due_date: null, completed: true, position: 3 }),
    ).toEqual({ id: 'x', title: null, description: 'ת', dueDate: null, completed: true, position: 3 });
  });
});

describe('stripSslMode', () => {
  it('removes sslmode and keeps everything else', () => {
    const result = stripSslMode('postgresql://u:p@host:6543/postgres?sslmode=require&x=1');
    expect(result).not.toContain('sslmode');
    expect(result).toContain('x=1');
    expect(result).toContain('host:6543');
  });
});
