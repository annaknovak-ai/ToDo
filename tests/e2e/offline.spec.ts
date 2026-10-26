import { expect, test, type Page } from '@playwright/test';
import type pg from 'pg';
import { createDevPool, replaceTasks } from '../helpers/devDb.js';

// No offline mode: a banner, failing actions and nothing stored on the device (PRD FR-10, ADR-10).
const OFFLINE = 'אין חיבור לאינטרנט. לא ניתן לצפות במשימות או לשנות אותן עד שהחיבור יחזור.';

let db: pg.Pool;

test.beforeAll(() => {
  db = createDevPool();
});

test.afterAll(async () => {
  await db?.end();
});

test.beforeEach(async () => {
  await replaceTasks(db, [{ title: 'ראשונה' }, { title: 'שנייה' }]);
});

const row = (page: Page, title: string) => page.getByTestId('task-row').filter({ hasText: title });

async function savedTask(title: string) {
  const { rows } = await db.query('select title, completed from public.tasks where title = $1', [title]);
  return rows[0];
}

test('the banner appears on both pages while offline and disappears when back online', async ({ page, context }) => {
  await page.goto('/');
  await expect(row(page, 'ראשונה')).toBeVisible();
  await expect(page.getByTestId('offline-banner')).toHaveCount(0);

  await context.setOffline(true);
  await expect(page.getByTestId('offline-banner')).toHaveText(OFFLINE);
  await page.getByRole('link', { name: 'אודות' }).click();
  await expect(page.getByTestId('offline-banner')).toHaveText(OFFLINE);

  await context.setOffline(false);
  await expect(page.getByTestId('offline-banner')).toHaveCount(0);
});

test('actions fail while offline, the screen returns to its last saved state, and nothing is saved', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(row(page, 'ראשונה')).toBeVisible();
  await row(page, 'ראשונה').getByTestId('task-select').click();
  await context.setOffline(true);

  // Status change reverts.
  await row(page, 'שנייה').getByRole('checkbox').click();
  await expect(page.locator('.list-notice')).toContainText(OFFLINE);
  await expect(row(page, 'שנייה').getByRole('checkbox')).not.toBeChecked();

  // Saving details keeps the typed text in the form.
  const details = page.getByTestId('details-panel');
  await details.getByLabel('כותרת', { exact: true }).fill('ראשונה ערוכה');
  await details.getByRole('button', { name: 'שמור שינויים' }).click();
  await expect(details.getByRole('alert')).toHaveText(OFFLINE);
  await expect(details.getByLabel('כותרת', { exact: true })).toHaveValue('ראשונה ערוכה');

  // Creating keeps the modal and its values.
  await page.getByRole('button', { name: 'הוסף משימה' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'הוספת משימה' });
  await dialog.getByLabel('כותרת', { exact: true }).fill('חדשה בלי אינטרנט');
  await dialog.getByRole('button', { name: 'הוסף משימה' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(OFFLINE);
  await expect(dialog.getByLabel('כותרת', { exact: true })).toHaveValue('חדשה בלי אינטרנט');

  expect(await savedTask('שנייה')).toEqual({ title: 'שנייה', completed: false });
  expect(await savedTask('ראשונה ערוכה')).toBeUndefined();
  expect(await savedTask('חדשה בלי אינטרנט')).toBeUndefined();
  await context.setOffline(false);
});

test('reloading while offline shows no task list; back online, the list comes from the server', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(row(page, 'ראשונה')).toBeVisible();

  await context.setOffline(true);
  await page.reload().catch(() => {});
  await expect(page.getByTestId('task-row')).toHaveCount(0);

  await context.setOffline(false);
  await page.goto('/');
  await expect(page.getByTestId('task-row')).toHaveText(['ראשונה', 'שנייה']);
});

test('nothing is kept in browser storage', async ({ page }) => {
  await page.goto('/');
  await expect(row(page, 'ראשונה')).toBeVisible();
  await row(page, 'ראשונה').getByTestId('task-select').click();
  await row(page, 'שנייה').getByRole('checkbox').click();
  await expect(row(page, 'שנייה').getByRole('checkbox')).toBeEnabled();

  const storage = await page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    indexedDb: (await indexedDB.databases()).length,
    caches: (await caches.keys()).length,
  }));
  expect(storage).toEqual({ local: 0, session: 0, indexedDb: 0, caches: 0 });
});
