import type pg from 'pg';
import type { Task } from '../shared/types.js';

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

export type TasksRepository = {
  listTasks(): Promise<Task[]>;
};

export function createTasksRepository(db: Pick<pg.Pool, 'query'>): TasksRepository {
  return {
    async listTasks() {
      const result = await db.query<TaskRow>(
        `select id, title, description, due_date, completed, position
           from public.tasks
          order by position asc, id asc`,
      );
      return result.rows.map(toTask);
    },
  };
}
