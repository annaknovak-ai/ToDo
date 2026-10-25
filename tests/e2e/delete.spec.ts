import { expect, test, type Page } from '@playwright/test';
import type pg from 'pg';
import { createDevPool } from '../helpers/devDb.js';

const NO_SELECTION = 'בחר משימה מהרשימה כדי לצפות בפרטיה';
const DELETE_FAILED = 'המחיקה נכשלה. נסה שוב.';
const QUESTION = 'האם אתה בטוח שברצונך למחוק את המשימה הזו?';

let db: pg.Pool;

test.beforeAll(() => {
  db = createDevPool();
});

test.afterAll(async () => {
  await db?.end();
});

// Adds a task at the end of the Dev list and returns its id. The run's data is restored afterwards (ADR-11).
async function addTask(title: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.tasks (title, position)
     select $1, coalesce(max(position) + 1, 0) from public.tasks
     returning id`,
    [title],
  );
  return rows[0].id;
}

async function exists(id: string) {
  const { rowCount } = await db.query('select 1 from public.tasks where id = $1', [id]);
  return rowCount === 1;
}

const row = (page: Page, title: string) => page.getByTestId('task-row').filter({ hasText: title });
const details = (page: Page) => page.getByTestId('details-panel');

async function openConfirm(page: Page, title: string) {
  await row(page, title).getByRole('button').click();
  await details(page).getByRole('button', { name: 'מחק משימה' }).click();
  const dialog = page.getByRole('dialog', { name: 'מחיקת משימה' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(QUESTION)).toBeVisible();
  return dialog;
}

test('cancel, Esc and the overlay keep the task', async ({ page }) => {
  const title = `E2E לא למחוק ${Date.now()}`;
  const id = await addTask(title);
  await page.goto('/');

  let dialog = await openConfirm(page, title);
  await dialog.getByRole('button', { name: 'ביטול' }).click();
  await expect(dialog).toBeHidden();

  dialog = await openConfirm(page, title);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  dialog = await openConfirm(page, title);
  // A click on the dark overlay, outside the window.
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();

  await expect(row(page, title)).toHaveCount(1);
  await expect(details(page).getByLabel('כותרת')).toHaveValue(title);
  expect(await exists(id)).toBe(true);
});

test('confirm deletes the task, resets the details area, and it stays gone after a refresh', async ({ page }) => {
  const stamp = Date.now();
  const title = `E2E למחיקה ${stamp}`;
  const id = await addTask(title);
  const after = await addTask(`E2E אחרי ${stamp}`);
  await page.goto('/');

  const dialog = await openConfirm(page, title);
  await dialog.getByRole('button', { name: 'אישור' }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, title)).toHaveCount(0);
  await expect(details(page).getByText(NO_SELECTION)).toBeVisible();
  expect(await exists(id)).toBe(false);

  // Positions stay contiguous after the delete.
  const { rows } = await db.query<{ position: number }>('select position from public.tasks order by position');
  expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => i));
  expect(await exists(after)).toBe(true);

  await page.reload();
  await expect(page.getByTestId('task-row').first()).toBeVisible();
  await expect(row(page, title)).toHaveCount(0);
});

test('a failed delete keeps the task in the list and shows the message; a retry succeeds', async ({ page }) => {
  const title = `E2E כישלון מחיקה ${Date.now()}`;
  const id = await addTask(title);
  let failed = false;
  await page.route('**/api/tasks/*', async (route) => {
    if (route.request().method() === 'DELETE' && !failed) {
      failed = true;
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL_ERROR","message":"x"}}' });
    } else {
      await route.fallback();
    }
  });
  await page.goto('/');

  const dialog = await openConfirm(page, title);
  await dialog.getByRole('button', { name: 'אישור' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(DELETE_FAILED);
  await expect(row(page, title)).toHaveCount(1);
  expect(await exists(id)).toBe(true);

  await dialog.getByRole('button', { name: 'אישור' }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, title)).toHaveCount(0);
  expect(await exists(id)).toBe(false);
});

test.describe('delete on the real API', () => {
  test.skip(({ isMobile }) => isMobile, 'API check runs once');

  test('a second delete of the same task returns 404', async ({ request }) => {
    const id = await addTask(`E2E מחיקה כפולה ${Date.now()}`);
    expect((await request.delete(`/api/tasks/${id}`)).status()).toBe(204);
    const again = await request.delete(`/api/tasks/${id}`);
    expect(again.status()).toBe(404);
    expect((await again.json()).error.code).toBe('TASK_NOT_FOUND');
  });
});
