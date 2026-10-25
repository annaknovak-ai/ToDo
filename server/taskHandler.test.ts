// @vitest-environment node
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Task } from '../shared/types.js';
import { createTaskHandler } from './taskHandler.js';
import { TaskNotFoundError, TaskValidationError, type TasksRepository, type ValidateUpdate } from './tasksRepository.js';

type FakeResponse = VercelResponse & { statusCode: number; body: unknown; ended: boolean; headers: Record<string, string> };

function fakeResponse(): FakeResponse {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    ended: false,
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
      res.ended = true;
      return res;
    },
    end() {
      res.ended = true;
      return res;
    },
  };
  return res as unknown as FakeResponse;
}

const ID = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';

function request(
  method: string,
  body?: unknown,
  { id = ID, headers = { 'content-type': 'application/json' } }: { id?: unknown; headers?: Record<string, string> } = {},
): VercelRequest {
  return { method, headers, body, query: { id } } as unknown as VercelRequest;
}

const saved: Task = { id: ID, title: 'ישן', description: null, dueDate: '2026-01-01', completed: true, position: 4 };

// Behaves like the real repository: validates against the stored due date, then "updates".
function fakeUpdate(savedDueDate: string | null = saved.dueDate) {
  return vi.fn(async (_id: string, validate: ValidateUpdate) => {
    const validation = validate(savedDueDate);
    if (!validation.ok) throw new TaskValidationError(validation.errors);
    return { ...saved, ...validation.value };
  });
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
    ...overrides,
  });
}

// 2026-10-25 22:30 UTC is already 2026-10-26 in Jerusalem (UTC+2).
const now = () => new Date('2026-10-25T22:30:00Z');

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PATCH /api/tasks/:id handler', () => {
  async function patch(body: unknown, updateTaskDetails = fakeUpdate(), options?: Parameters<typeof request>[2]) {
    const res = fakeResponse();
    await createTaskHandler(repo({ updateTaskDetails }), now)(request('PATCH', body, options), res);
    return { res, updateTaskDetails };
  }

  it('saves normalized details and returns 200 with the task', async () => {
    const { res, updateTaskDetails } = await patch({ title: '  חדש ', description: '  ', dueDate: '2026-11-01' });
    expect(res.statusCode).toBe(200);
    expect(updateTaskDetails).toHaveBeenCalledWith(ID, expect.any(Function));
    expect(res.body).toEqual({ ...saved, title: 'חדש', description: null, dueDate: '2026-11-01' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('ignores completed, position and unknown fields', async () => {
    const { res } = await patch({ title: 'x', description: null, dueDate: null, completed: false, position: 0, id: 'y' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ completed: true, position: 4 });
  });

  it('keeps a saved due date that is already in the past', async () => {
    const { res } = await patch({ title: 'x', description: null, dueDate: '2026-01-01' });
    expect(res.statusCode).toBe(200);
  });

  it.each([
    [{ title: ' ', description: '\n', dueDate: null }, 'content', 'יש להזין כותרת או תיאור למשימה'],
    [{ title: 'א'.repeat(101), description: null, dueDate: null }, 'title', 'הכותרת יכולה להכיל עד 100 תווים.'],
    [{ title: null, description: 'א'.repeat(2001), dueDate: null }, 'description', 'התיאור יכול להכיל עד 2,000 תווים.'],
    // Changed to another past date (Jerusalem "today" is 2026-10-26).
    [{ title: 'x', description: null, dueDate: '2026-10-25' }, 'dueDate', 'תאריך היעד לא יכול להיות בעבר.'],
    [{ title: 'x', description: null, dueDate: '2026-02-30' }, 'dueDate', 'תאריך היעד אינו תקין.'],
  ])('rejects invalid input %# with 422', async (body, field, message) => {
    const { res } = await patch(body);
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message, field } });
  });

  it.each([
    [{ title: 'x', description: null }],
    [{ title: 'x', dueDate: null }],
    [{ description: 'x', dueDate: null }],
    [{ title: 5, description: null, dueDate: null }],
    [null],
    [[]],
  ])('rejects a partial or malformed body %j with 400', async (body) => {
    const { res, updateTaskDetails } = await patch(body);
    expect(res.statusCode).toBe(400);
    expect(updateTaskDetails).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON content type with 400 and a body over 16KB with 413', async () => {
    const form = await patch('title=x', undefined, { headers: { 'content-type': 'text/plain' } });
    expect(form.res.statusCode).toBe(400);
    const big = await patch({ title: 'x', description: 'א'.repeat(9000), dueDate: null });
    expect(big.res.statusCode).toBe(413);
    expect(big.updateTaskDetails).not.toHaveBeenCalled();
  });

  it('returns 404 when the task no longer exists', async () => {
    const { res } = await patch(
      { title: 'x', description: null, dueDate: null },
      vi.fn(async () => {
        throw new TaskNotFoundError();
      }),
    );
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'TASK_NOT_FOUND', message: 'המשימה כבר לא קיימת, ייתכן שנמחקה. רענן את הרשימה.' },
    });
  });

  it('returns 500 without leaking the database error', async () => {
    const { res } = await patch(
      { title: 'x', description: null, dueDate: null },
      vi.fn(async () => {
        throw new Error('update secret_table failed');
      }),
    );
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret_table');
  });
});

describe('DELETE /api/tasks/:id handler', () => {
  async function del(deleteTask: TasksRepository['deleteTask'] = vi.fn(async () => {}), id: unknown = ID) {
    const res = fakeResponse();
    await createTaskHandler(repo({ deleteTask }))(request('DELETE', undefined, { id }), res);
    return { res, deleteTask };
  }

  it('deletes the task and returns 204 without a body', async () => {
    const { res, deleteTask } = await del();
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.body).toBeUndefined();
    expect(deleteTask).toHaveBeenCalledWith(ID);
  });

  it('returns 404 when the task does not exist', async () => {
    const { res } = await del(async () => {
      throw new TaskNotFoundError();
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 500 without leaking the database error', async () => {
    const { res } = await del(async () => {
      throw new Error('delete secret_table failed');
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret_table');
  });
});

describe('/api/tasks/:id routing rules', () => {
  it.each([['not-a-uuid'], [''], [['a', 'b']], [undefined]])('rejects the id %j with 400', async (id) => {
    const deleteTask = vi.fn(async () => {});
    const res = fakeResponse();
    const req = { method: 'DELETE', headers: {}, query: { id } } as unknown as VercelRequest;
    await createTaskHandler(repo({ deleteTask }))(req, res);
    expect(res.statusCode).toBe(400);
    expect(deleteTask).not.toHaveBeenCalled();
  });

  it.each([['GET'], ['POST'], ['PUT']])('rejects %s with 405', async (method) => {
    const res = fakeResponse();
    await createTaskHandler(repo({}))(request(method), res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('PATCH, DELETE');
  });
});
