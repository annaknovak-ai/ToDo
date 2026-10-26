import { expect, test, type Page } from '@playwright/test';
import { createDevPool, restoreSnapshot, takeSnapshot } from '../helpers/devDb.js';

const LIST_FULL = 'הרשימה מלאה (1,000 משימות). כדי להוסיף משימה, מחק משימה קיימת.';
const LIST_FULL_ON_CREATE = 'לא ניתן להוסיף משימה: הרשימה התמלאה. מחק משימה קיימת ונסה שוב.';
const SAVE_FAILED = 'השמירה נכשלה. נסה שוב.';

// The device's local date, as the form computes it.
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function openModal(page: Page) {
  await page.goto('/');
  const add = page.getByRole('button', { name: 'הוסף משימה' });
  await expect(add).toBeEnabled();
  await add.click();
  const dialog = page.getByRole('dialog', { name: 'הוספת משימה' });
  await expect(dialog).toBeVisible();
  return dialog;
}

function submit(page: Page) {
  return page.getByRole('dialog').getByRole('button', { name: 'הוסף משימה' }).click();
}

const rows = (page: Page) => page.getByTestId('task-row');

test.describe('create a task (real Dev data)', () => {
  test('with a title only: appears last, is selected, and survives refresh and a new window', async ({ page, browser }) => {
    const title = `E2E כותרת ${Date.now()}`;
    const dialog = await openModal(page);
    await expect(dialog.getByLabel('כותרת', { exact: true })).toHaveValue('');
    await expect(dialog.getByLabel('כותרת', { exact: true })).toHaveAttribute('placeholder', 'הזן כותרת (לא חובה)');
    await expect(dialog.getByLabel('תיאור', { exact: true })).toHaveAttribute('placeholder', 'הזן תיאור (לא חובה)');
    await expect(dialog.getByLabel('תאריך יעד', { exact: true })).toHaveValue(localToday());

    await dialog.getByLabel('כותרת', { exact: true }).fill(title);
    await submit(page);

    await expect(dialog).toBeHidden();
    const last = rows(page).last();
    await expect(last).toHaveText(title);
    await expect(last).toHaveClass(/is-selected/);
    await expect(last.getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByTestId('details-panel').getByLabel('כותרת', { exact: true })).toHaveValue(title);
    await expect(page.getByTestId('details-panel').getByLabel('כותרת', { exact: true })).toBeInViewport();

    await page.reload();
    await expect(rows(page).last()).toHaveText(title);

    // Another visitor (separate browser context) sees it too.
    const other = await browser.newContext();
    try {
      const otherPage = await other.newPage();
      await otherPage.goto('/');
      await expect(otherPage.getByTestId('task-row').filter({ hasText: title })).toHaveCount(1);
    } finally {
      await other.close();
    }

    // Exactly one row in the database, saved as "to do".
    const db = createDevPool();
    try {
      const { rows: saved } = await db.query('select completed from public.tasks where title = $1', [title]);
      expect(saved).toEqual([{ completed: false }]);
    } finally {
      await db.end();
    }
  });

  test('with a description only and no due date', async ({ page }) => {
    const description = `E2E תיאור בלבד ${Date.now()}`;
    const dialog = await openModal(page);
    await dialog.getByLabel('תיאור', { exact: true }).fill(description);
    await dialog.getByLabel('תאריך יעד', { exact: true }).fill('');
    await submit(page);

    await expect(dialog).toBeHidden();
    await expect(rows(page).last()).toHaveText(description);
    const details = page.getByTestId('details-panel');
    await expect(details.getByLabel('תיאור', { exact: true })).toHaveValue(description);
    await expect(details.getByLabel('תאריך יעד', { exact: true })).toHaveValue('');
  });

  test('with a title, description and a future date', async ({ page }) => {
    const title = `E2E מלאה ${Date.now()}`;
    const dialog = await openModal(page);
    await dialog.getByLabel('כותרת', { exact: true }).fill(title);
    await dialog.getByLabel('תיאור', { exact: true }).fill('שורה ראשונה\nשורה שנייה');
    await dialog.getByLabel('תאריך יעד', { exact: true }).fill('2030-01-15');
    await submit(page);

    await expect(dialog).toBeHidden();
    const details = page.getByTestId('details-panel');
    await expect(details.getByLabel('כותרת', { exact: true })).toHaveValue(title);
    await expect(details.getByLabel('תיאור', { exact: true })).toHaveValue('שורה ראשונה\nשורה שנייה');
    await expect(details.getByLabel('תאריך יעד', { exact: true })).toHaveValue('2030-01-15');
  });
});

test.describe('validation and closing', () => {
  test('blocks empty, too long and past-date input inside the form', async ({ page }) => {
    let posts = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/tasks')) posts++;
    });
    const dialog = await openModal(page);

    await dialog.getByLabel('כותרת', { exact: true }).fill('    ');
    await submit(page);
    await expect(dialog.getByRole('alert')).toHaveText('יש להזין כותרת או תיאור למשימה');

    await dialog.getByLabel('כותרת', { exact: true }).fill('א'.repeat(101));
    await dialog.getByLabel('תיאור', { exact: true }).fill('ב'.repeat(2001));
    await dialog.getByLabel('תאריך יעד', { exact: true }).fill('2020-01-01');
    await submit(page);
    await expect(dialog.getByText('הכותרת יכולה להכיל עד 100 תווים.')).toBeVisible();
    await expect(dialog.getByText('התיאור יכול להכיל עד 2,000 תווים.')).toBeVisible();
    await expect(dialog.getByText('תאריך היעד לא יכול להיות בעבר.')).toBeVisible();
    await expect(dialog.getByLabel('כותרת', { exact: true })).toHaveValue('א'.repeat(101));
    expect(posts).toBe(0);
  });

  test('closing with the icon, the close button or Esc resets the form; the overlay does not close it', async ({ page }) => {
    const dialog = await openModal(page);

    for (const close of [
      () => dialog.getByRole('button', { name: 'סגור' }).first().click(),
      () => dialog.getByRole('button', { name: 'סגור' }).last().click(),
      () => page.keyboard.press('Escape'),
    ]) {
      await dialog.getByLabel('כותרת', { exact: true }).fill('טיוטה');
      await dialog.getByLabel('תאריך יעד', { exact: true }).fill('');
      await close();
      await expect(dialog).toBeHidden();
      await page.getByRole('button', { name: 'הוסף משימה' }).click();
      await expect(dialog.getByLabel('כותרת', { exact: true })).toHaveValue('');
      await expect(dialog.getByLabel('תאריך יעד', { exact: true })).toHaveValue(localToday());
    }

    // Click on the dark overlay, outside the window.
    await dialog.getByLabel('כותרת', { exact: true }).fill('לא נמחק');
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('כותרת', { exact: true })).toHaveValue('לא נמחק');
  });
});

test.describe('server errors (mocked POST)', () => {
  test('a failed save keeps the modal and values, and a retry succeeds', async ({ page }) => {
    let failed = false;
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() === 'POST' && !failed) {
        failed = true;
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL_ERROR","message":"x"}}' });
      } else {
        await route.fallback();
      }
    });
    const title = `E2E אחרי כישלון ${Date.now()}`;
    const dialog = await openModal(page);
    await dialog.getByLabel('כותרת', { exact: true }).fill(title);
    await submit(page);

    await expect(dialog.getByRole('alert')).toHaveText(SAVE_FAILED);
    await expect(dialog.getByLabel('כותרת', { exact: true })).toHaveValue(title);

    await submit(page);
    await expect(dialog).toBeHidden();
    await expect(rows(page).last()).toHaveText(title);
  });

  test('a 409 from the server shows the list-filled message and keeps the values', async ({ page }) => {
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'TASK_LIMIT_REACHED', message: LIST_FULL_ON_CREATE } }),
        });
      } else {
        await route.fallback();
      }
    });
    const dialog = await openModal(page);
    await dialog.getByLabel('כותרת', { exact: true }).fill('לא תיכנס');
    await submit(page);
    await expect(dialog.getByRole('alert')).toHaveText(LIST_FULL_ON_CREATE);
    await expect(dialog.getByLabel('כותרת', { exact: true })).toHaveValue('לא תיכנס');
  });

  test('with 1,000 tasks the add button is disabled with a message', async ({ page }) => {
    const tasks = Array.from({ length: 1000 }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      title: `משימה ${i + 1}`,
      description: null,
      dueDate: null,
      completed: false,
      position: i,
    }));
    await page.route('**/api/tasks', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasks) }),
    );
    await page.goto('/');
    await expect(page.getByText(LIST_FULL)).toBeVisible();
    await expect(page.getByRole('button', { name: 'הוסף משימה' })).toBeDisabled();
  });
});

test.describe('task limit on the real API', () => {
  test.skip(({ isMobile }) => isMobile, 'API check runs once');

  test('two concurrent POSTs at 999 tasks: one 201, one 409, and 1,000 rows remain', async ({ request }) => {
    const db = createDevPool();
    const snapshot = await takeSnapshot(db);
    try {
      await db.query('delete from public.tasks');
      await db.query(
        `insert into public.tasks (title, position) select 'משימה ' || n, n - 1 from generate_series(1, 999) as n`,
      );
      const [a, b] = await Promise.all([
        request.post('/api/tasks', { data: { title: 'מבקר 1' } }),
        request.post('/api/tasks', { data: { title: 'מבקר 2' } }),
      ]);
      expect([a.status(), b.status()].sort()).toEqual([201, 409]);
      const rejected = a.status() === 409 ? a : b;
      expect((await rejected.json()).error.code).toBe('TASK_LIMIT_REACHED');

      const third = await request.post('/api/tasks', { data: { title: 'מבקר 3' } });
      expect(third.status()).toBe(409);

      const { rows: count } = await db.query<{ count: number }>('select count(*)::int as count from public.tasks');
      expect(count[0].count).toBe(1000);
    } finally {
      await restoreSnapshot(db, snapshot);
      await db.end();
    }
  });
});
