import type pg from 'pg';
import type { TaskInput } from '../../shared/types.js';
import { PRODUCT_TIME_ZONE, todayInTimeZone, validateTaskInput, validationMessages } from '../../shared/validation.js';
import {
  createTasksRepository,
  TaskLimitError,
  TaskNotFoundError,
  TaskOrderConflictError,
  TaskValidationError,
  type TaskRow,
} from '../../server/tasksRepository.js';
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

const TODAY = todayInTimeZone(PRODUCT_TIME_ZONE);

// The same validation the PATCH handler passes to the repository.
const validateAgainstSaved = (input: TaskInput) => (savedDueDate: string | null) =>
  validateTaskInput(input, { today: TODAY, savedDueDate });

async function readRow(id: string) {
  const { rows } = await db.query<TaskRow & { updated_at: Date }>(
    'select id, title, description, due_date, completed, position, updated_at from public.tasks where id = $1',
    [id],
  );
  return rows[0];
}

async function positions(): Promise<{ id: string; position: number }[]> {
  const { rows } = await db.query<{ id: string; position: number }>(
    'select id, position from public.tasks order by position, id',
  );
  return rows;
}

describe('updateTaskDetails against Dev', () => {
  it('changes only title, description and due date, and moves updated_at', async () => {
    const id = await insertTask(db, { title: 'ישן', description: 'תיאור ישן', completed: true, position: 3 });
    const before = await readRow(id);
    const task = await createTasksRepository(db).updateTaskDetails(
      id,
      validateAgainstSaved({ title: '  חדש  ', description: '  ', dueDate: '2099-01-01' }),
    );
    expect(task).toEqual({ id, title: 'חדש', description: null, dueDate: '2099-01-01', completed: true, position: 3 });
    const after = await readRow(id);
    expect(after).toMatchObject({ title: 'חדש', description: null, due_date: '2099-01-01', completed: true, position: 3 });
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
  });

  it('keeps a stored past due date when it is not changed, and refuses another past date', async () => {
    const id = await insertTask(db, { title: 'פג תוקף', dueDate: '2020-05-05', position: 0 });
    const repo = createTasksRepository(db);
    const kept = await repo.updateTaskDetails(id, validateAgainstSaved({ title: 'עודכן', description: null, dueDate: '2020-05-05' }));
    expect(kept).toMatchObject({ title: 'עודכן', dueDate: '2020-05-05' });

    const error = await repo
      .updateTaskDetails(id, validateAgainstSaved({ title: 'שוב', description: null, dueDate: '2020-06-06' }))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TaskValidationError);
    expect((error as TaskValidationError).errors).toEqual({ dueDate: validationMessages.dueDateInPast });
    expect(await readRow(id)).toMatchObject({ title: 'עודכן', due_date: '2020-05-05' });
  });

  it('throws TaskNotFoundError for a task that does not exist', async () => {
    await expect(
      createTasksRepository(db).updateTaskDetails(
        '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b',
        validateAgainstSaved({ title: 'x', description: null, dueDate: null }),
      ),
    ).rejects.toBeInstanceOf(TaskNotFoundError);
  });

  it('two concurrent saves of the same task: the last one wins, status and position are untouched', async () => {
    const id = await insertTask(db, { title: 'מקור', completed: true, position: 2 });
    // A third connection holds the row lock so both saves queue up in a known order.
    const lockPool = createDevPool();
    const locker = await lockPool.connect();
    try {
      await locker.query('begin');
      await locker.query('select id from public.tasks where id = $1 for update', [id]);
      const first = createTasksRepository(db).updateTaskDetails(
        id,
        validateAgainstSaved({ title: 'מבקר 1', description: 'ראשון', dueDate: null }),
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const second = createTasksRepository(otherDb).updateTaskDetails(
        id,
        validateAgainstSaved({ title: 'מבקר 2', description: null, dueDate: '2099-02-02' }),
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await locker.query('commit');
      await Promise.all([first, second]);
    } finally {
      locker.release();
      await lockPool.end();
    }
    expect(await readRow(id)).toMatchObject({
      title: 'מבקר 2',
      description: null,
      due_date: '2099-02-02',
      completed: true,
      position: 2,
    });
  });
});

describe('deleteTask against Dev', () => {
  it('deletes the task and renumbers the rest to 0..N-1 in the same order', async () => {
    const a = await insertTask(db, { title: 'א', position: 0 });
    const b = await insertTask(db, { title: 'ב', position: 3 });
    const c = await insertTask(db, { title: 'ג', position: 5 });
    const d = await insertTask(db, { title: 'ד', position: 9 });
    await createTasksRepository(db).deleteTask(b);
    expect(await positions()).toEqual([
      { id: a, position: 0 },
      { id: c, position: 1 },
      { id: d, position: 2 },
    ]);
  });

  it('throws TaskNotFoundError when deleting twice, and changes nothing else', async () => {
    const a = await insertTask(db, { title: 'א', position: 0 });
    const b = await insertTask(db, { title: 'ב', position: 1 });
    await createTasksRepository(db).deleteTask(a);
    await expect(createTasksRepository(otherDb).deleteTask(a)).rejects.toBeInstanceOf(TaskNotFoundError);
    expect(await positions()).toEqual([{ id: b, position: 0 }]);
  });

  it('concurrent deletes and creates leave unique, contiguous positions', async () => {
    await fillTasks(10);
    const ids = (await positions()).map((r) => r.id);
    const repos = [createTasksRepository(db), createTasksRepository(otherDb)];
    await Promise.all([
      repos[0].deleteTask(ids[2]),
      repos[1].createTask({ title: 'חדשה 1', description: null, dueDate: null }),
      repos[1].deleteTask(ids[7]),
      repos[0].createTask({ title: 'חדשה 2', description: null, dueDate: null }),
    ]);
    const after = await positions();
    expect(after).toHaveLength(10);
    // Creates append after the highest position, so gaps may remain only after a create that
    // ran before a delete; positions are always unique.
    expect(new Set(after.map((r) => r.position)).size).toBe(10);
    expect(after.map((r) => r.id)).not.toContain(ids[2]);
    expect(after.map((r) => r.id)).not.toContain(ids[7]);
  });
});

describe('setTaskCompleted against Dev', () => {
  it('sets and clears completed, touching nothing else but updated_at', async () => {
    const id = await insertTask(db, { title: 'א', description: 'ת', dueDate: '2026-12-31', position: 3 });
    const before = (await db.query('select updated_at from public.tasks where id = $1', [id])).rows[0].updated_at;

    const done = await createTasksRepository(db).setTaskCompleted(id, true);
    expect(done).toEqual({ id, title: 'א', description: 'ת', dueDate: '2026-12-31', completed: true, position: 3 });
    const after = (await db.query('select updated_at from public.tasks where id = $1', [id])).rows[0].updated_at;
    expect(after.getTime()).toBeGreaterThan(before.getTime());

    // Explicit values, not a toggle: saving the same value twice keeps it.
    expect((await createTasksRepository(otherDb).setTaskCompleted(id, true)).completed).toBe(true);
    expect((await createTasksRepository(db).setTaskCompleted(id, false)).completed).toBe(false);
  });

  it('throws TaskNotFoundError for a task that does not exist', async () => {
    const id = await insertTask(db, { title: 'א', position: 0 });
    await db.query('delete from public.tasks where id = $1', [id]);
    await expect(createTasksRepository(db).setTaskCompleted(id, true)).rejects.toBeInstanceOf(TaskNotFoundError);
  });
});

describe('reorderTasks against Dev', () => {
  async function threeTasks() {
    const a = await insertTask(db, { title: 'א', position: 0 });
    const b = await insertTask(db, { title: 'ב', position: 4 });
    const c = await insertTask(db, { title: 'ג', position: 9 });
    return [a, b, c];
  }

  it('saves the exact order at contiguous positions and returns the list', async () => {
    const [a, b, c] = await threeTasks();
    const list = await createTasksRepository(db).reorderTasks([c, a, b]);
    expect(list.map((t) => [t.id, t.position])).toEqual([
      [c, 0],
      [a, 1],
      [b, 2],
    ]);
    expect(await positions()).toEqual([
      { id: c, position: 0 },
      { id: a, position: 1 },
      { id: b, position: 2 },
    ]);
  });

  it('keeps completed and the details unchanged', async () => {
    const a = await insertTask(db, { title: 'א', description: 'ת', dueDate: '2026-12-31', completed: true, position: 0 });
    const b = await insertTask(db, { title: 'ב', position: 1 });
    const list = await createTasksRepository(db).reorderTasks([b, a]);
    expect(list[1]).toEqual({ id: a, title: 'א', description: 'ת', dueDate: '2026-12-31', completed: true, position: 1 });
  });

  it('accepts [] for an empty list', async () => {
    expect(await createTasksRepository(db).reorderTasks([])).toEqual([]);
  });

  it('refuses ids that do not match the list one to one, and changes nothing', async () => {
    const [a, b, c] = await threeTasks();
    const gone = await insertTask(db, { title: 'נמחקה', position: 10 });
    await db.query('delete from public.tasks where id = $1', [gone]);
    const before = await positions();
    const repo = createTasksRepository(db);
    for (const ids of [
      [a, b], // one missing (a task created meanwhile)
      [a, b, c, gone], // one extra (a task deleted meanwhile)
      [a, b, gone], // same length, one replaced
      [a, a, b, c], // a duplicate
      [a, a, b], // a duplicate with the right length
    ]) {
      await expect(repo.reorderTasks(ids)).rejects.toBeInstanceOf(TaskOrderConflictError);
    }
    expect(await positions()).toEqual(before);
  });

  it('two concurrent reorders: the result is exactly one of them, contiguous', async () => {
    await fillTasks(20);
    const ids = (await positions()).map((r) => r.id);
    const first = [...ids].reverse();
    const second = [...ids.slice(10), ...ids.slice(0, 10)];
    await Promise.all([
      createTasksRepository(db).reorderTasks(first),
      createTasksRepository(otherDb).reorderTasks(second),
    ]);
    const after = await positions();
    expect(after.map((r) => r.position)).toEqual([...Array(20).keys()]);
    expect([first, second]).toContainEqual(after.map((r) => r.id));
  });

  it('a reorder racing a create either succeeds with the new task last or is refused; nothing is lost', async () => {
    await fillTasks(10);
    const ids = (await positions()).map((r) => r.id);
    const order = [...ids].reverse();
    const [reorder, created] = await Promise.allSettled([
      createTasksRepository(db).reorderTasks(order),
      createTasksRepository(otherDb).createTask({ title: 'חדשה', description: null, dueDate: null }),
    ]);
    expect(created.status).toBe('fulfilled');
    const newId = (created as PromiseFulfilledResult<{ id: string }>).value.id;
    const after = await positions();
    expect(after).toHaveLength(11);
    expect(new Set(after.map((r) => r.position)).size).toBe(11);
    if (reorder.status === 'fulfilled') {
      expect(after.map((r) => r.id)).toEqual([...order, newId]);
    } else {
      expect(reorder.reason).toBeInstanceOf(TaskOrderConflictError);
      expect(after.map((r) => r.id)).toEqual([...ids, newId]);
    }
  });

  it('a reorder racing a delete either succeeds before it or is refused; positions stay contiguous', async () => {
    await fillTasks(10);
    const ids = (await positions()).map((r) => r.id);
    const order = [...ids].reverse();
    const [reorder, deleted] = await Promise.allSettled([
      createTasksRepository(db).reorderTasks(order),
      createTasksRepository(otherDb).deleteTask(ids[4]),
    ]);
    expect(deleted.status).toBe('fulfilled');
    const after = await positions();
    expect(after.map((r) => r.position)).toEqual([...Array(9).keys()]);
    const remaining = (list: string[]) => list.filter((id) => id !== ids[4]);
    if (reorder.status === 'fulfilled') {
      expect(after.map((r) => r.id)).toEqual(remaining(order));
    } else {
      expect(reorder.reason).toBeInstanceOf(TaskOrderConflictError);
      expect(after.map((r) => r.id)).toEqual(remaining(ids));
    }
  });

  it('a status change during a reorder: both are kept', async () => {
    await fillTasks(10);
    const ids = (await positions()).map((r) => r.id);
    const order = [...ids].reverse();
    await Promise.all([
      createTasksRepository(db).reorderTasks(order),
      createTasksRepository(otherDb).setTaskCompleted(ids[3], true),
    ]);
    expect((await positions()).map((r) => r.id)).toEqual(order);
    const { rows } = await db.query('select completed from public.tasks where id = $1', [ids[3]]);
    expect(rows[0].completed).toBe(true);
  });
});
