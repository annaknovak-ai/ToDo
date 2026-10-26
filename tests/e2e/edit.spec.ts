import { expect, test, type Page } from '@playwright/test';
import type pg from 'pg';
import { createDevPool } from '../helpers/devDb.js';

const SAVE_SUCCESS = 'המשימה נשמרה בהצלחה';
const SAVE_FAILED = 'השמירה נכשלה. נסה שוב.';
const DATE_IN_PAST = 'תאריך היעד לא יכול להיות בעבר.';

let db: pg.Pool;

test.beforeAll(() => {
  db = createDevPool();
});

test.afterAll(async () => {
  await db?.end();
});

// Adds a task at the end of the Dev list and returns its id. The run's data is restored afterwards (ADR-11).
async function addTask(task: { title: string; description?: string | null; dueDate?: string | null; completed?: boolean }) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.tasks (title, description, due_date, completed, position)
     select $1, $2, $3, $4, coalesce(max(position) + 1, 0) from public.tasks
     returning id`,
    [task.title, task.description ?? null, task.dueDate ?? null, task.completed ?? false],
  );
  return rows[0].id;
}

async function readTask(id: string) {
  const { rows } = await db.query('select title, description, due_date, completed, position from public.tasks where id = $1', [
    id,
  ]);
  return rows[0];
}

const details = (page: Page) => page.getByTestId('details-panel');

async function select(page: Page, title: string) {
  await page.getByTestId('task-row').filter({ hasText: title }).getByTestId('task-select').click();
  await expect(details(page).getByLabel('כותרת', { exact: true })).toHaveValue(title);
}

const save = (page: Page) => details(page).getByRole('button', { name: 'שמור שינויים' }).click();

test('edit title, description and due date, save, and see it after a refresh', async ({ page }) => {
  const title = `E2E לעריכה ${Date.now()}`;
  const id = await addTask({ title, description: 'תיאור מקורי', completed: true });
  await page.goto('/');
  await select(page, title);

  const newTitle = `${title} עודכן`;
  await details(page).getByLabel('כותרת', { exact: true }).fill(`  ${newTitle}  `);
  await details(page).getByLabel('תיאור', { exact: true }).fill('תיאור חדש\nבשתי שורות');
  await details(page).getByLabel('תאריך יעד', { exact: true }).fill('2099-03-15');
  await save(page);

  await expect(details(page).getByRole('status')).toHaveText(SAVE_SUCCESS);
  await expect(details(page).getByLabel('כותרת', { exact: true })).toHaveValue(newTitle);
  await expect(page.getByTestId('task-row').filter({ hasText: newTitle })).toHaveCount(1);
  expect(await readTask(id)).toMatchObject({
    title: newTitle,
    description: 'תיאור חדש\nבשתי שורות',
    due_date: '2099-03-15',
    completed: true,
  });

  await page.reload();
  await select(page, newTitle);
  await expect(details(page).getByLabel('תיאור', { exact: true })).toHaveValue('תיאור חדש\nבשתי שורות');
  await expect(details(page).getByLabel('תאריך יעד', { exact: true })).toHaveValue('2099-03-15');
});

test('a task whose saved due date has passed saves unchanged, but another past date is blocked', async ({ page }) => {
  const title = `E2E תאריך שעבר ${Date.now()}`;
  const id = await addTask({ title, dueDate: '2024-02-02' });
  await page.goto('/');
  await select(page, title);
  await expect(details(page).getByLabel('תאריך יעד', { exact: true })).toHaveValue('2024-02-02');

  await details(page).getByLabel('תיאור', { exact: true }).fill('הוסף תיאור');
  await save(page);
  await expect(details(page).getByRole('status')).toHaveText(SAVE_SUCCESS);
  expect(await readTask(id)).toMatchObject({ description: 'הוסף תיאור', due_date: '2024-02-02' });

  await details(page).getByLabel('תאריך יעד', { exact: true }).fill('2024-03-03');
  await save(page);
  await expect(details(page).getByText(DATE_IN_PAST)).toBeVisible();
  expect(await readTask(id)).toMatchObject({ due_date: '2024-02-02' });
});

test('empty content and a too long title are blocked inside the form', async ({ page }) => {
  const title = `E2E ולידציה ${Date.now()}`;
  await addTask({ title });
  await page.goto('/');
  await select(page, title);

  await details(page).getByLabel('כותרת', { exact: true }).fill('   ');
  await save(page);
  await expect(details(page).getByRole('alert')).toHaveText('יש להזין כותרת או תיאור למשימה');
  await expect(details(page).getByLabel('כותרת', { exact: true })).toHaveValue('   ');

  await details(page).getByLabel('כותרת', { exact: true }).fill('א'.repeat(101));
  await save(page);
  await expect(details(page).getByText('הכותרת יכולה להכיל עד 100 תווים.')).toBeVisible();
});

test('unsaved changes are discarded by selecting another task, visiting About, or refreshing', async ({ page }) => {
  const stamp = Date.now();
  const first = `E2E טיוטה א ${stamp}`;
  const second = `E2E טיוטה ב ${stamp}`;
  await addTask({ title: first, description: 'מקורי' });
  await addTask({ title: second });
  await page.goto('/');

  await select(page, first);
  await details(page).getByLabel('תיאור', { exact: true }).fill('טיוטה שלא נשמרה');
  await select(page, second);
  await select(page, first);
  await expect(details(page).getByLabel('תיאור', { exact: true })).toHaveValue('מקורי');

  await details(page).getByLabel('תיאור', { exact: true }).fill('טיוטה שלא נשמרה');
  await page.getByRole('link', { name: 'אודות' }).click();
  await page.getByRole('link', { name: 'דף הבית' }).click();
  await select(page, first);
  await expect(details(page).getByLabel('תיאור', { exact: true })).toHaveValue('מקורי');

  await details(page).getByLabel('תיאור', { exact: true }).fill('טיוטה שלא נשמרה');
  await page.reload();
  await select(page, first);
  await expect(details(page).getByLabel('תיאור', { exact: true })).toHaveValue('מקורי');
});

test('a failed save keeps the edited values, and a retry succeeds', async ({ page }) => {
  const title = `E2E כישלון שמירה ${Date.now()}`;
  const id = await addTask({ title });
  let failed = false;
  await page.route('**/api/tasks/*', async (route) => {
    if (route.request().method() === 'PATCH' && !failed) {
      failed = true;
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL_ERROR","message":"x"}}' });
    } else {
      await route.fallback();
    }
  });
  await page.goto('/');
  await select(page, title);
  await details(page).getByLabel('תיאור', { exact: true }).fill('נשמר בניסיון השני');
  await save(page);
  await expect(details(page).getByRole('alert')).toHaveText(SAVE_FAILED);
  await expect(details(page).getByLabel('תיאור', { exact: true })).toHaveValue('נשמר בניסיון השני');

  await save(page);
  await expect(details(page).getByRole('status')).toHaveText(SAVE_SUCCESS);
  expect(await readTask(id)).toMatchObject({ description: 'נשמר בניסיון השני' });
});

test('saving a task deleted meanwhile by another visitor shows the "no longer exists" message', async ({ page }) => {
  const title = `E2E נמחקה בינתיים ${Date.now()}`;
  const id = await addTask({ title });
  await page.goto('/');
  await select(page, title);
  await db.query('delete from public.tasks where id = $1', [id]);
  await details(page).getByLabel('תיאור', { exact: true }).fill('לא יישמר');
  await save(page);
  await expect(details(page).getByRole('alert')).toHaveText('המשימה כבר לא קיימת, ייתכן שנמחקה. רענן את הרשימה.');
  await expect(details(page).getByLabel('תיאור', { exact: true })).toHaveValue('לא יישמר');
});

test.describe('concurrent saves on the real API', () => {
  test.skip(({ isMobile }) => isMobile, 'API check runs once');

  test('the last save wins and status and position are not overwritten', async ({ request }) => {
    const id = await addTask({ title: `E2E מקביל ${Date.now()}`, completed: true });
    const before = await readTask(id);
    const first = await request.patch(`/api/tasks/${id}`, {
      data: { title: 'מבקר 1', description: 'ראשון', dueDate: null, completed: false, position: 0 },
    });
    expect(first.status()).toBe(200);
    // Sent at the same time; whichever the server commits last decides the final value.
    const [a, b] = await Promise.all([
      request.patch(`/api/tasks/${id}`, { data: { title: 'מבקר 2', description: null, dueDate: null } }),
      request.patch(`/api/tasks/${id}`, { data: { title: 'מבקר 3', description: null, dueDate: '2099-01-01' } }),
    ]);
    expect([a.status(), b.status()]).toEqual([200, 200]);
    const after = await readTask(id);
    expect(['מבקר 2', 'מבקר 3']).toContain(after.title);
    // Whole-save semantics: the stored row is exactly one of the two requests, never a mix.
    expect(after.due_date).toBe(after.title === 'מבקר 3' ? '2099-01-01' : null);
    expect(after).toMatchObject({ completed: true, position: before.position });
  });
});

test('on a phone the fields and buttons fit the screen width', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile layout only');
  const title = `E2E מובייל ${Date.now()}`;
  await addTask({ title });
  await page.goto('/');
  await select(page, title);
  const viewport = page.viewportSize()!;
  for (const control of [
    details(page).getByLabel('כותרת', { exact: true }),
    details(page).getByRole('button', { name: 'שמור שינויים' }),
    details(page).getByRole('button', { name: 'מחק משימה' }),
  ]) {
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
  await expect(details(page).getByRole('button', { name: 'מחק משימה' })).toBeInViewport();
});
