import type pg from 'pg';
import { createTasksRepository } from '../../server/tasksRepository.js';
import { createDevPool, insertTask, restoreSnapshot, takeSnapshot, type TasksSnapshot } from '../helpers/devDb.js';

// Runs against the Dev Supabase project as app_backend; the original rows are restored afterwards.
let db: pg.Pool;
let snapshot: TasksSnapshot;

beforeAll(async () => {
  db = createDevPool();
  snapshot = await takeSnapshot(db);
});

afterAll(async () => {
  if (snapshot) await restoreSnapshot(db, snapshot);
  await db?.end();
});

beforeEach(async () => {
  await db.query('delete from public.tasks');
});

describe('tasks repository against Dev', () => {
  it('returns [] for an empty table', async () => {
    expect(await createTasksRepository(db).listTasks()).toEqual([]);
  });

  it('orders by position, then id', async () => {
    const third = await insertTask(db, { title: 'שלישית', position: 2 });
    const first = await insertTask(db, { title: 'ראשונה', position: 0 });
    const tieA = await insertTask(db, { title: 'שנייה א', position: 1 });
    const tieB = await insertTask(db, { title: 'שנייה ב', position: 1 });
    const [lowTie, highTie] = [tieA, tieB].sort();

    const ids = (await createTasksRepository(db).listTasks()).map((t) => t.id);
    expect(ids).toEqual([first, lowTie, highTie, third]);
  });

  it('returns dueDate as a plain date string and maps all fields', async () => {
    const id = await insertTask(db, { title: null, description: 'תיאור', dueDate: '2026-12-31', completed: true, position: 0 });
    expect(await createTasksRepository(db).listTasks()).toEqual([
      { id, title: null, description: 'תיאור', dueDate: '2026-12-31', completed: true, position: 0 },
    ]);
  });

  it('rejects a task whose title and description are only whitespace', async () => {
    await expect(insertTask(db, { title: '   ', description: '\n\t', position: 0 })).rejects.toThrow(/tasks_title_or_description/);
    await expect(insertTask(db, { position: 0 })).rejects.toThrow(/tasks_title_or_description/);
  });

  it('rejects a negative position', async () => {
    await expect(insertTask(db, { title: 'x', position: -1 })).rejects.toThrow(/tasks_position_non_negative/);
  });

  it('rejects titles and descriptions over the length limits', async () => {
    await expect(insertTask(db, { title: 'א'.repeat(101), position: 0 })).rejects.toThrow();
    await expect(insertTask(db, { description: 'א'.repeat(2001), position: 0 })).rejects.toThrow();
    await expect(insertTask(db, { title: 'א'.repeat(100), description: 'ב'.repeat(2000), position: 0 })).resolves.toBeTruthy();
  });
});
