import type pg from 'pg';
import type { Task, TaskInput } from '../shared/types.js';
import { MAX_TASKS } from '../shared/validation.js';

export type TaskRow = {
  id: string;
  title: string | null;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  position: number;
};

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    completed: row.completed,
    position: row.position,
  };
}

// Transaction-level advisory lock shared by every change to the list structure
// (create now; delete and reorder later), ARCHITECTURE 2.6.
export const TASKS_LIST_LOCK_KEY = 7_340_001;

export class TaskLimitError extends Error {
  constructor() {
    super('Task limit reached');
    this.name = 'TaskLimitError';
  }
}

export type TasksRepository = {
  listTasks(): Promise<Task[]>;
  createTask(input: TaskInput): Promise<Task>;
};

const TASK_COLUMNS = 'id, title, description, due_date, completed, position';

export function createTasksRepository(db: Pick<pg.Pool, 'query' | 'connect'>): TasksRepository {
  return {
    async listTasks() {
      const result = await db.query<TaskRow>(
        `select ${TASK_COLUMNS}
           from public.tasks
          order by position asc, id asc`,
      );
      return result.rows.map(toTask);
    },

    // Appends a task at the end of the list. Expects input already validated and normalized.
    // The count check and the insert run under the shared lock, so concurrent creates cannot exceed MAX_TASKS.
    async createTask(input) {
      // A transaction must stay on one client from begin to commit behind the pooler.
      const client = await db.connect();
      try {
        await client.query('begin');
        await client.query('select pg_advisory_xact_lock($1)', [TASKS_LIST_LOCK_KEY]);
        const stats = await client.query<{ count: number; next: number }>(
          'select count(*)::int as count, coalesce(max(position) + 1, 0)::int as next from public.tasks',
        );
        const { count, next } = stats.rows[0];
        if (count >= MAX_TASKS) throw new TaskLimitError();
        const result = await client.query<TaskRow>(
          `insert into public.tasks (title, description, due_date, position)
           values ($1, $2, $3, $4)
           returning ${TASK_COLUMNS}`,
          [input.title, input.description, input.dueDate, next],
        );
        await client.query('commit');
        return toTask(result.rows[0]);
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
