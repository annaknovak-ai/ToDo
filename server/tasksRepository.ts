import type pg from 'pg';
import type { Task, TaskInput } from '../shared/types.js';
import { MAX_TASKS, type ValidationErrors, type ValidationResult } from '../shared/validation.js';

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
// (create and delete now; reorder later), ARCHITECTURE 2.6.
export const TASKS_LIST_LOCK_KEY = 7_340_001;

export class TaskLimitError extends Error {
  constructor() {
    super('Task limit reached');
    this.name = 'TaskLimitError';
  }
}

export class TaskNotFoundError extends Error {
  constructor() {
    super('Task not found');
    this.name = 'TaskNotFoundError';
  }
}

export class TaskValidationError extends Error {
  readonly errors: ValidationErrors;

  constructor(errors: ValidationErrors) {
    super('Task input is invalid');
    this.name = 'TaskValidationError';
    this.errors = errors;
  }
}

// Validates an update against the due date currently stored for the task.
export type ValidateUpdate = (savedDueDate: string | null) => ValidationResult;

export type TasksRepository = {
  listTasks(): Promise<Task[]>;
  createTask(input: TaskInput): Promise<Task>;
  updateTaskDetails(id: string, validate: ValidateUpdate): Promise<Task>;
  deleteTask(id: string): Promise<void>;
};

// Runs fn inside a transaction on a single client, as required behind the pooler.
async function inTransaction<T>(db: Pick<pg.Pool, 'connect'>, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

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
      return inTransaction(db, async (client) => {
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
        return toTask(result.rows[0]);
      });
    },

    // Updates title, description and due date only; never completed or position (ADR-8).
    // The row lock makes the saved-date comparison and the update atomic; concurrent saves
    // are serialized by it and the last one wins.
    async updateTaskDetails(id, validate) {
      return inTransaction(db, async (client) => {
        const saved = await client.query<{ due_date: string | null }>(
          'select due_date from public.tasks where id = $1 for update',
          [id],
        );
        if (saved.rowCount === 0) throw new TaskNotFoundError();
        const validation = validate(saved.rows[0].due_date);
        if (!validation.ok) throw new TaskValidationError(validation.errors);
        const { title, description, dueDate } = validation.value;
        const result = await client.query<TaskRow>(
          `update public.tasks
              set title = $2, description = $3, due_date = $4, updated_at = now()
            where id = $1
            returning ${TASK_COLUMNS}`,
          [id, title, description, dueDate],
        );
        return toTask(result.rows[0]);
      });
    },

    // Deletes a task and renumbers the remaining positions to 0..N-1, under the shared list lock.
    async deleteTask(id) {
      await inTransaction(db, async (client) => {
        await client.query('select pg_advisory_xact_lock($1)', [TASKS_LIST_LOCK_KEY]);
        const deleted = await client.query('delete from public.tasks where id = $1', [id]);
        if (deleted.rowCount === 0) throw new TaskNotFoundError();
        await client.query(
          `update public.tasks t
              set position = r.new_position
             from (select id, (row_number() over (order by position, id) - 1)::int as new_position
                     from public.tasks) r
            where t.id = r.id and t.position <> r.new_position`,
        );
      });
    },
  };
}
