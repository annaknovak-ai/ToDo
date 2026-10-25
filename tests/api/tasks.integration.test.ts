import type pg from 'pg';
import { createTasksRepository, TaskLimitError } from '../../server/tasksRepository.js';
import { createDevPool, insertTask, restoreSnapshot, takeSnapshot, type TasksSnapshot } from '../helpers/devDb.js';

// Runs against the Dev Supabase project as app_backend; the original rows are restored afterwards.
let db: pg.Pool;
let otherDb: pg.Pool; // a second visitor (ADR-7)
let snapshot: TasksSnapshot;

beforeAll(async () => {
  db = createDevPool();
  otherDb = createDevPool();
  snapshot = await takeSnapshot(db);
});

afterAll(async () => {
  if (snapshot) await restoreSnapshot(db, snapshot);
  await db?.end();
  await otherDb?.end();
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

  it('rejects titles and descriptions over the length limits (database)', async () => {
    await expect(insertTask(db, { title: 'א'.repeat(101), position: 0 })).rejects.toThrow();
    await expect(insertTask(db, { description: 'א'.repeat(2001), position: 0 })).rejects.toThrow();
    await expect(insertTask(db, { title: 'א'.repeat(100), description: 'ב'.repeat(2000), position: 0 })).resolves.toBeTruthy();
  });
});

// Fills the table with `count` tasks at positions 0..count-1.
async function fillTasks(count: number) {
  await db.query(
    `insert into public.tasks (title, position)
     select 'משימה ' || n, n - 1 from generate_series(1, $1::int) as n`,
    [count],
  );
}

async function countTasks(): Promise<number> {
  const { rows } = await db.query<{ count: number }>('select count(*)::int as count from public.tasks');
  return rows[0].count;
}

describe('createTask against Dev', () => {
  it('creates one row at position 0 in an empty list, as "to do"', async () => {
    const task = await createTasksRepository(db).createTask({ title: 'ראשונה', description: null, dueDate: '2026-12-31' });
    expect(task).toEqual({
      id: expect.any(String),
      title: 'ראשונה',
      description: null,
      dueDate: '2026-12-31',
      completed: false,
      position: 0,
    });
    expect(await createTasksRepository(db).listTasks()).toEqual([task]);
  });

  it('appends after the highest position', async () => {
    await insertTask(db, { title: 'א', position: 0 });
    await insertTask(db, { title: 'ב', position: 4 });
    const task = await createTasksRepository(db).createTask({ title: null, description: 'תיאור בלבד', dueDate: null });
    expect(task.position).toBe(5);
    const list = await createTasksRepository(db).listTasks();
    expect(list.at(-1)).toEqual(task);
  });

  it('refuses to create the 1,001st task and leaves 1,000 rows', async () => {
    await fillTasks(1000);
    await expect(createTasksRepository(db).createTask({ title: 'עוד אחת', description: null, dueDate: null })).rejects.toBeInstanceOf(
      TaskLimitError,
    );
    expect(await countTasks()).toBe(1000);
  });

  it('lets exactly one of two concurrent creates through at 999 tasks', async () => {
    await fillTasks(999);
    const results = await Promise.allSettled([
      createTasksRepository(db).createTask({ title: 'מבקר 1', description: null, dueDate: null }),
      createTasksRepository(otherDb).createTask({ title: 'מבקר 2', description: null, dueDate: null }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(TaskLimitError);
    expect(await countTasks()).toBe(1000);
  });

  it('gives concurrent creates distinct positions', async () => {
    const repos = [createTasksRepository(db), createTasksRepository(otherDb)];
    const created = await Promise.all(
      Array.from({ length: 6 }, (_, i) => repos[i % 2].createTask({ title: `מקבילה ${i}`, description: null, dueDate: null })),
    );
    const positions = created.map((t) => t.position).sort((a, b) => a - b);
    expect(positions).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
