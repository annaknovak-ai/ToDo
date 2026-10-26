import { expect, test, type Page } from '@playwright/test';
import type pg from 'pg';
import { createDevPool } from '../helpers/devDb.js';

const STATUS_FAILED = 'לא הצלחנו לעדכן את סטטוס המשימה. נסה שוב.';

let db: pg.Pool;

test.beforeAll(() => {
  db = createDevPool();
});

test.afterAll(async () => {
  await db?.end();
});

// Each test starts from its own known list; the run's data is restored afterwards (ADR-11).
async function resetTasks(titles: { title: string; completed?: boolean }[]) {
  await db.query('delete from public.tasks');
  for (const [position, task] of titles.entries()) {
    await db.query('insert into public.tasks (title, completed, position) values ($1, $2, $3)', [
      task.title,
      task.completed ?? false,
      position,
    ]);
  }
}

async function readTask(title: string) {
  const { rows } = await db.query<{ completed: boolean; position: number }>(
    'select completed, position from public.tasks where title = $1',
    [title],
  );
  return rows[0];
}

const row = (page: Page, title: string) => page.getByTestId('task-row').filter({ hasText: title });
const checkbox = (page: Page, title: string) => row(page, title).getByRole('checkbox');
const titles = (page: Page) => page.getByTestId('task-row').allTextContents();

test.beforeEach(async () => {
  await resetTasks([{ title: 'ראשונה' }, { title: 'שנייה', completed: true }, { title: 'שלישית' }]);
});

test('the checkbox marks and unmarks a task, saves at once, and keeps its place after a refresh', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('task-row')).toHaveCount(3);

  await checkbox(page, 'ראשונה').click();
  await expect(checkbox(page, 'ראשונה')).toBeChecked();
  await expect(row(page, 'ראשונה')).toHaveClass(/is-completed/);
  await expect.poll(async () => (await readTask('ראשונה')).completed).toBe(true);

  await checkbox(page, 'שנייה').click();
  await expect(checkbox(page, 'שנייה')).not.toBeChecked();
  await expect.poll(async () => (await readTask('שנייה')).completed).toBe(false);

  await page.reload();
  await expect(page.getByTestId('task-row')).toHaveCount(3);
  expect(await titles(page)).toEqual(['ראשונה', 'שנייה', 'שלישית']);
  await expect(checkbox(page, 'ראשונה')).toBeChecked();
  await expect(checkbox(page, 'שנייה')).not.toBeChecked();
  expect((await readTask('ראשונה')).position).toBe(0);
  // Toggling does not select the row.
  await expect(page.getByText('בחר משימה מהרשימה כדי לצפות בפרטיה')).toBeVisible();
});

test('a server error puts the checkbox back and shows a message', async ({ page }) => {
  await page.route('**/api/tasks/*/status', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL_ERROR","message":"x"}}' }),
  );
  await page.goto('/');
  await checkbox(page, 'ראשונה').click();
  await expect(page.getByRole('alert')).toHaveText(STATUS_FAILED);
  await expect(checkbox(page, 'ראשונה')).not.toBeChecked();
  expect((await readTask('ראשונה')).completed).toBe(false);

  // A retry once the server is back works.
  await page.unroute('**/api/tasks/*/status');
  await checkbox(page, 'ראשונה').click();
  await expect(page.getByRole('alert')).toBeHidden();
  await expect.poll(async () => (await readTask('ראשונה')).completed).toBe(true);
});

test('checking the selected task keeps its unsaved draft and does not save it', async ({ page }) => {
  await page.goto('/');
  await row(page, 'שלישית').getByTestId('task-select').click();
  await page.getByLabel('כותרת', { exact: true }).fill('טיוטה שלא נשמרה');

  await checkbox(page, 'שלישית').click();
  await expect.poll(async () => (await readTask('שלישית'))?.completed).toBe(true);
  await expect(page.getByLabel('כותרת', { exact: true })).toHaveValue('טיוטה שלא נשמרה');
  // The list still shows the saved title; the draft was not saved.
  await expect(row(page, 'שלישית')).toHaveCount(1);
});

test.describe('API', () => {
  test.skip(({ isMobile }) => isMobile, 'once is enough');

  test('PATCH /status saves explicit values and rejects bad input', async ({ request }) => {
    const { rows } = await db.query<{ id: string }>("select id from public.tasks where title = 'ראשונה'");
    const url = `/api/tasks/${rows[0].id}/status`;

    let res = await request.patch(url, { data: { completed: true } });
    expect(res.status()).toBe(200);
    expect((await res.json()).completed).toBe(true);
    res = await request.patch(url, { data: { completed: true } });
    expect((await res.json()).completed).toBe(true);

    expect((await request.patch(url, { data: { completed: 'yes' } })).status()).toBe(400);
    expect((await request.patch(url, { data: {} })).status()).toBe(400);
    expect((await request.patch('/api/tasks/not-a-uuid/status', { data: { completed: true } })).status()).toBe(400);
    expect(
      (await request.patch('/api/tasks/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b/status', { data: { completed: true } })).status(),
    ).toBe(404);
  });
});
