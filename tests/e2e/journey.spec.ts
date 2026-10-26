import { expect, test, type Page } from '@playwright/test';
import type pg from 'pg';
import { createDevPool, replaceTasks } from '../helpers/devDb.js';
import { drag } from '../helpers/drag.js';

// The whole product in one visit, then two visitors side by side (PRD 3.ב, flows 1–7).
const NO_SELECTION = 'בחר משימה מהרשימה כדי לצפות בפרטיה';
const SAVED = 'המשימה נשמרה בהצלחה';

let db: pg.Pool;

test.beforeAll(() => {
  db = createDevPool();
});

test.afterAll(async () => {
  await db?.end();
});

test.beforeEach(async () => {
  await replaceTasks(db, [{ title: 'קיימת א' }, { title: 'קיימת ב' }]);
});

const rows = (page: Page) => page.getByTestId('task-row');
const row = (page: Page, title: string) => rows(page).filter({ hasText: title });
const details = (page: Page) => page.getByTestId('details-panel');

async function deleteSelected(page: Page) {
  await details(page).getByRole('button', { name: 'מחק משימה' }).click();
  await page.getByRole('dialog', { name: 'מחיקת משימה' }).getByRole('button', { name: 'אישור' }).click();
}

test('view, create, edit, complete, reorder, navigate, refresh and delete', async ({ page, isMobile }) => {
  // View.
  await page.goto('/');
  await expect(rows(page)).toHaveText(['קיימת א', 'קיימת ב']);
  await expect(page.getByText(NO_SELECTION)).toBeVisible();

  // Create.
  await page.getByRole('button', { name: 'הוסף משימה' }).click();
  const dialog = page.getByRole('dialog', { name: 'הוספת משימה' });
  await dialog.getByLabel('כותרת', { exact: true }).fill('מסע מלא');
  await dialog.getByLabel('תיאור', { exact: true }).fill('נוצרה בבדיקת המסע');
  await dialog.getByRole('button', { name: 'הוסף משימה' }).click();
  await expect(dialog).toBeHidden();
  await expect(rows(page)).toHaveText(['קיימת א', 'קיימת ב', 'מסע מלא']);
  await expect(row(page, 'מסע מלא')).toHaveClass(/is-selected/);

  // Edit and save.
  await details(page).getByLabel('כותרת', { exact: true }).fill('מסע מלא ערוך');
  await details(page).getByLabel('תאריך יעד', { exact: true }).fill('2030-01-15');
  await details(page).getByRole('button', { name: 'שמור שינויים' }).click();
  await expect(details(page).getByText(SAVED)).toBeVisible();
  await expect(row(page, 'מסע מלא ערוך')).toBeVisible();

  // Complete.
  const checkbox = row(page, 'מסע מלא ערוך').getByRole('checkbox');
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeEnabled();

  // Reorder: move the new task to the top.
  const saved = page.waitForResponse((res) => res.url().endsWith('/api/tasks/order'));
  await drag(page, isMobile, 'מסע מלא ערוך', 'קיימת א');
  expect((await saved).status()).toBe(200);
  await expect(rows(page)).toHaveText(['מסע מלא ערוך', 'קיימת א', 'קיימת ב']);

  // Navigate away and back, then refresh: everything comes from the server.
  await page.getByRole('link', { name: 'אודות' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'אודות' })).toBeVisible();
  await page.getByRole('link', { name: 'דף הבית' }).click();
  await page.reload();
  await expect(rows(page)).toHaveText(['מסע מלא ערוך', 'קיימת א', 'קיימת ב']);
  await expect(row(page, 'מסע מלא ערוך')).toHaveClass(/is-completed/);
  await row(page, 'מסע מלא ערוך').getByTestId('task-select').click();
  await expect(details(page).getByLabel('תיאור', { exact: true })).toHaveValue('נוצרה בבדיקת המסע');
  await expect(details(page).getByLabel('תאריך יעד', { exact: true })).toHaveValue('2030-01-15');

  // Delete.
  await deleteSelected(page);
  await expect(rows(page)).toHaveText(['קיימת א', 'קיימת ב']);
  await expect(page.getByText(NO_SELECTION)).toBeVisible();

  const { rows: left } = await db.query<{ title: string }>('select title from public.tasks order by position');
  expect(left.map((r) => r.title)).toEqual(['קיימת א', 'קיימת ב']);
});

test('another window sees edits and deletions only after a refresh', async ({ page, browser }) => {
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await page.goto('/');
    await otherPage.goto('/');
    await expect(rows(otherPage)).toHaveText(['קיימת א', 'קיימת ב']);

    await row(page, 'קיימת א').getByTestId('task-select').click();
    await details(page).getByLabel('כותרת', { exact: true }).fill('נערכה בחלון אחר');
    await details(page).getByRole('button', { name: 'שמור שינויים' }).click();
    await expect(details(page).getByText(SAVED)).toBeVisible();

    await row(page, 'קיימת ב').getByTestId('task-select').click();
    await deleteSelected(page);
    await expect(rows(page)).toHaveText(['נערכה בחלון אחר']);

    // No background updates: the other window keeps the old list until it refreshes.
    await otherPage.waitForTimeout(1000);
    await expect(rows(otherPage)).toHaveText(['קיימת א', 'קיימת ב']);
    await otherPage.reload();
    await expect(rows(otherPage)).toHaveText(['נערכה בחלון אחר']);
  } finally {
    await other.close();
  }
});
