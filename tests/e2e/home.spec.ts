import { expect, test, type Page } from '@playwright/test';
import { createDevPool, insertTask } from '../helpers/devDb.js';

const NO_SELECTION = 'בחר משימה מהרשימה כדי לצפות בפרטיה';
const EMPTY = 'אין עדיין משימות. לחץ על "הוסף משימה" כדי להתחיל.';
const LOAD_FAILED = 'לא הצלחנו לטעון את המשימות. בדוק את החיבור לאינטרנט ורענן את הדף.';

function fakeTasks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    title: `משימה מספר ${i + 1}`,
    description: i === 1 ? 'תיאור המשימה' : null,
    dueDate: i === 1 ? '2026-12-01' : null,
    completed: i === 2,
    position: i,
  }));
}

async function mockTasks(page: Page, body: unknown, status = 200) {
  await page.route('**/api/tasks', (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

test.describe('home page with real Dev data', () => {
  let insertedTitle: string;
  let untitledText: string;

  test.beforeAll(async () => {
    // Make sure the list is not empty and has a task without a title.
    const db = createDevPool();
    try {
      const { rows } = await db.query<{ max: number | null }>('select max(position) as max from public.tasks');
      const next = (rows[0].max ?? -1) + 1;
      insertedTitle = `E2E ${Date.now()}`;
      untitledText = `משימת בדיקה בלי כותרת ${Date.now()}`;
      await insertTask(db, { title: insertedTitle, description: 'נוצר בבדיקה', dueDate: '2026-12-20', position: next });
      await insertTask(db, { title: null, description: untitledText, completed: true, position: next + 1 });
    } finally {
      await db.end();
    }
  });

  test('loads tasks from the server with no selection, then shows details on click', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'המשימות שלי' })).toBeVisible();
    await expect(page.getByText(NO_SELECTION)).toBeVisible();

    const row = page.getByTestId('task-row').filter({ hasText: insertedTitle });
    await expect(row).toBeVisible();

    const untitled = page.getByTestId('task-row').filter({ hasText: untitledText });
    await expect(untitled).toHaveClass(/is-completed/);
    await expect(untitled.getByRole('checkbox')).toBeChecked();

    await row.getByTestId('task-select').click();
    await expect(page.getByText(NO_SELECTION)).toHaveCount(0);
    await expect(page.getByLabel('כותרת', { exact: true })).toHaveValue(insertedTitle);
    await expect(page.getByLabel('תיאור', { exact: true })).toHaveValue('נוצר בבדיקה');
    await expect(page.getByLabel('תאריך יעד', { exact: true })).toHaveValue('2026-12-20');
  });

  test('shows a task added to the database after a refresh, without local storage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('task-row').first()).toBeVisible();

    const title = `נוסף אחרי טעינה ${Date.now()}`;
    const db = createDevPool();
    try {
      const { rows } = await db.query<{ max: number }>('select max(position) as max from public.tasks');
      await insertTask(db, { title, position: rows[0].max + 1 });
    } finally {
      await db.end();
    }

    await expect(page.getByText(title)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(title)).toBeVisible();

    const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
    expect(storage).toEqual({ local: 0, session: 0 });
  });
});

test.describe('home page states (mocked API)', () => {
  test('empty list shows the empty message', async ({ page }) => {
    await mockTasks(page, []);
    await page.goto('/');
    await expect(page.getByText(EMPTY)).toBeVisible();
    await expect(page.getByText(NO_SELECTION)).toBeVisible();
  });

  test('server error shows the load error, not the empty message', async ({ page }) => {
    await mockTasks(page, { error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500);
    await page.goto('/');
    await expect(page.getByText(LOAD_FAILED)).toBeVisible();
    await expect(page.getByText(EMPTY)).toHaveCount(0);
  });
});

test.describe('desktop layout', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop only');

  test('list is on the right, details on the left, and a long list scrolls inside its panel', async ({ page }) => {
    await mockTasks(page, fakeTasks(60));
    await page.goto('/');
    await expect(page.getByTestId('task-row')).toHaveCount(60);

    const list = await page.getByTestId('list-body').boundingBox();
    const details = await page.getByTestId('details-panel').boundingBox();
    expect(list!.x).toBeGreaterThan(details!.x);

    const scroll = await page.getByTestId('list-body').evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
    const pageScrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    expect(pageScrolls).toBe(false);

    await page.getByTestId('task-row').last().scrollIntoViewIfNeeded();
    await page.getByTestId('task-row').last().getByTestId('task-select').click();
    await expect(page.getByLabel('כותרת', { exact: true })).toBeInViewport();
    await expect(page.getByLabel('כותרת', { exact: true })).toHaveValue('משימה מספר 60');
  });
});

test.describe('mobile layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile only');

  test('list is above details and selecting a task scrolls to the details', async ({ page }) => {
    await mockTasks(page, fakeTasks(15));
    await page.goto('/');
    await expect(page.getByTestId('task-row')).toHaveCount(15);

    const list = await page.getByTestId('list-body').boundingBox();
    const details = await page.getByTestId('details-panel').boundingBox();
    expect(details!.y).toBeGreaterThan(list!.y + list!.height - 1);
    await expect(page.getByTestId('details-panel')).not.toBeInViewport();

    await page.getByTestId('task-row').nth(1).getByTestId('task-select').click();
    await expect(page.getByLabel('כותרת', { exact: true })).toBeInViewport();
    await expect(page.getByLabel('כותרת', { exact: true })).toHaveValue('משימה מספר 2');
  });
});
