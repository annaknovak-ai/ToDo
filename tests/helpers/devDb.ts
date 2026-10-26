import 'dotenv/config';
import type pg from 'pg';
import { createPool } from '../../server/db.js';
import type { TaskRow } from '../../server/tasksRepository.js';

// Test helpers for the Dev database only (ADR-7). DATABASE_URL comes from the local .env,
// which holds Dev credentials only.
export function createDevPool(): pg.Pool {
  if (process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to touch the database from a deployed environment');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set in .env');
  return createPool(url);
}

type FullTaskRow = TaskRow & { created_at: Date; updated_at: Date };

export type TasksSnapshot = FullTaskRow[];

export async function takeSnapshot(db: pg.Pool): Promise<TasksSnapshot> {
  const result = await db.query<FullTaskRow>(
    'select id, title, description, due_date, completed, position, created_at, updated_at from public.tasks',
  );
  return result.rows;
}

// Restores the table to exactly the snapshot contents.
export async function restoreSnapshot(db: pg.Pool, rows: TasksSnapshot): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('delete from public.tasks');
    if (rows.length > 0) {
      await client.query(
        `insert into public.tasks (id, title, description, due_date, completed, position, created_at, updated_at)
         select * from jsonb_to_recordset($1::jsonb) as t(
           id uuid, title varchar, description varchar, due_date date, completed boolean,
           position integer, created_at timestamptz, updated_at timestamptz)`,
        [JSON.stringify(rows)],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function insertTask(
  db: pg.Pool,
  task: { title?: string | null; description?: string | null; dueDate?: string | null; completed?: boolean; position: number },
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.tasks (title, description, due_date, completed, position)
     values ($1, $2, $3, $4, $5) returning id`,
    [task.title ?? null, task.description ?? null, task.dueDate ?? null, task.completed ?? false, task.position],
  );
  return result.rows[0].id;
}

// Replaces the whole Dev list with the given tasks, in order (the run's data is restored afterwards).
export async function replaceTasks(db: pg.Pool, tasks: { title: string; completed?: boolean }[]): Promise<void> {
  await db.query('delete from public.tasks');
  for (const [position, task] of tasks.entries()) {
    await insertTask(db, { title: task.title, completed: task.completed, position });
  }
}
