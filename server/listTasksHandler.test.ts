// @vitest-environment node
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Task } from '../shared/types.js';
import { stripSslMode } from './db.js';
import { createListTasksHandler } from './listTasksHandler.js';
import { toTask, type TasksRepository } from './tasksRepository.js';

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
  return { method } as VercelRequest;
}

function repo(listTasks: () => Promise<Task[]>): () => TasksRepository {
  return () => ({ listTasks });
}

const task: Task = { id: 'x', title: 'א', description: null, dueDate: '2026-12-01', completed: false, position: 0 };

describe('GET /api/tasks handler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns the tasks with no-store caching', async () => {
    const res = fakeResponse();
    await createListTasksHandler(repo(async () => [task]))(request('GET'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([task]);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns an empty array for an empty list', async () => {
    const res = fakeResponse();
    await createListTasksHandler(repo(async () => []))(request('GET'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('rejects other methods with 405', async () => {
    const res = fakeResponse();
    const listTasks = vi.fn(async () => []);
    await createListTasksHandler(repo(listTasks))(request('POST'), res);
    expect(res.statusCode).toBe(405);
    expect(res.headers['allow']).toBe('GET');
    expect(listTasks).not.toHaveBeenCalled();
  });

  it('returns 500 without leaking the database error', async () => {
    const res = fakeResponse();
    await createListTasksHandler(
      repo(async () => {
        throw new Error('relation "secret_table" does not exist');
      }),
    )(request('GET'), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('secret_table');
  });

  it('returns 503 when the database is unreachable', async () => {
    const res = fakeResponse();
    await createListTasksHandler(
      repo(async () => {
        throw Object.assign(new Error('connect failed'), { code: 'ECONNREFUSED' });
      }),
    )(request('GET'), res);
    expect(res.statusCode).toBe(503);
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
