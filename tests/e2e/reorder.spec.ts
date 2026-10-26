import { expect, test, type Locator, type Page } from '@playwright/test';
import type pg from 'pg';
import { createDevPool } from '../helpers/devDb.js';

const ORDER_FAILED = 'לא הצלחנו לשמור את הסדר החדש. נסה שוב.';
const ORDER_CONFLICT = 'הרשימה השתנתה בינתיים. רענן כדי לראות את הגרסה העדכנית.';
const NO_SELECTION = 'בחר משימה מהרשימה כדי לצפות בפרטיה';

let db: pg.Pool;

test.beforeAll(() => {
  db = createDevPool();
});

test.afterAll(async () => {
  await db?.end();
});

// Each test starts from its own known list; the run's data is restored afterwards (ADR-11).
async function resetTasks(tasks: { title: string; completed?: boolean }[]) {
  await db.query('delete from public.tasks');
  for (const [position, task] of tasks.entries()) {
    await db.query('insert into public.tasks (title, completed, position) values ($1, $2, $3)', [
      task.title,
      task.completed ?? false,
      position,
    ]);
  }
}

async function savedOrder() {
  const { rows } = await db.query<{ title: string; position: number }>(
    'select title, position from public.tasks order by position, id',
  );
  return rows;
}

const savedTitles = async () => (await savedOrder()).map((r) => r.title);

const row = (page: Page, title: string) => page.getByTestId('task-row').filter({ hasText: title });
const handle = (page: Page, title: string) => row(page, title).getByTestId('drag-handle');
const titles = (page: Page) => page.getByTestId('task-row').allTextContents();

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Drags a row by its handle onto another row: real mouse events on desktop, real touch events
// (through the Chrome DevTools protocol) on the phone project.
async function drag(page: Page, isMobile: boolean, from: string, to: string) {
  // On a phone, selecting a task scrolls the page down to the details.
  await page.getByTestId('list-body').scrollIntoViewIfNeeded();
  const start = await center(handle(page, from));
  const target = await center(row(page, to));
  const end = { x: start.x, y: target.y + (target.y > start.y ? 8 : -8) };
  const steps = 12;

  if (!isMobile) {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(start.x, start.y + ((end.y - start.y) * i) / steps);
    }
    await page.mouse.up();
    return;
  }

  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
    });
  await touch('touchStart', start.x, start.y);
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', start.x, start.y + ((end.y - start.y) * i) / steps);
    await page.waitForTimeout(16);
  }
  await touch('touchEnd', end.x, end.y);
  await cdp.detach();
}

async function waitForOrderSave(page: Page) {
  return page.waitForResponse((res) => res.url().endsWith('/api/tasks/order') && res.request().method() === 'PUT');
}

test.beforeEach(async () => {
  await resetTasks([{ title: 'ראשונה' }, { title: 'שנייה', completed: true }, { title: 'שלישית' }, { title: 'רביעית' }]);
});

test('dragging by the handle saves the exact order, which survives a refresh', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.getByTestId('task-row')).toHaveCount(4);

  const saved = waitForOrderSave(page);
  await drag(page, isMobile, 'ראשונה', 'שלישית');
  expect((await saved).status()).toBe(200);
  expect(await titles(page)).toEqual(['שנייה', 'שלישית', 'ראשונה', 'רביעית']);
  expect(await savedOrder()).toEqual([
    { title: 'שנייה', position: 0 },
    { title: 'שלישית', position: 1 },
    { title: 'ראשונה', position: 2 },
    { title: 'רביעית', position: 3 },
  ]);

  await page.reload();
  await expect(page.getByTestId('task-row')).toHaveCount(4);
  expect(await titles(page)).toEqual(['שנייה', 'שלישית', 'ראשונה', 'רביעית']);
  // Dragging neither selected a task nor toggled one.
  await expect(page.getByText(NO_SELECTION)).toBeVisible();
  await expect(row(page, 'ראשונה').getByRole('checkbox')).not.toBeChecked();
});

test('a completed task can be dragged like any other, and stays completed', async ({ page, isMobile }) => {
  await page.goto('/');
  const saved = waitForOrderSave(page);
  await drag(page, isMobile, 'שנייה', 'רביעית');
  await saved;
  expect(await savedTitles()).toEqual(['ראשונה', 'שלישית', 'רביעית', 'שנייה']);
  await expect(row(page, 'שנייה').getByRole('checkbox')).toBeChecked();
  await expect(row(page, 'שנייה')).toHaveClass(/is-completed/);
});

test('dragging upwards works too', async ({ page, isMobile }) => {
  await page.goto('/');
  const saved = waitForOrderSave(page);
  await drag(page, isMobile, 'רביעית', 'ראשונה');
  await saved;
  expect(await savedTitles()).toEqual(['רביעית', 'ראשונה', 'שנייה', 'שלישית']);
});

test('a tap or click on the handle does not select the task, toggle it or save an order', async ({ page, isMobile }) => {
  await page.goto('/');
  let orderRequests = 0;
  page.on('request', (req) => {
    if (req.url().endsWith('/api/tasks/order')) orderRequests++;
  });
  if (isMobile) await handle(page, 'שלישית').tap();
  else await handle(page, 'שלישית').click();
  await page.waitForTimeout(500);
  await expect(page.getByText(NO_SELECTION)).toBeVisible();
  await expect(row(page, 'שלישית').getByRole('checkbox')).not.toBeChecked();
  expect(orderRequests).toBe(0);
});

test('dragging the selected task keeps its unsaved draft and does not save it', async ({ page, isMobile }) => {
  await page.goto('/');
  await row(page, 'ראשונה').getByTestId('task-select').click();
  await page.getByLabel('כותרת', { exact: true }).fill('טיוטה שלא נשמרה');

  const saved = waitForOrderSave(page);
  await drag(page, isMobile, 'ראשונה', 'שלישית');
  await saved;
  await expect(page.getByLabel('כותרת', { exact: true })).toHaveValue('טיוטה שלא נשמרה');
  expect(await savedTitles()).toEqual(['שנייה', 'שלישית', 'ראשונה', 'רביעית']);
});

test('a server error puts the previous order back and shows a message', async ({ page, isMobile }) => {
  await page.route('**/api/tasks/order', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"code":"INTERNAL_ERROR","message":"x"}}' }),
  );
  await page.goto('/');
  await drag(page, isMobile, 'ראשונה', 'שלישית');
  await expect(page.getByRole('alert')).toHaveText(ORDER_FAILED);
  expect(await titles(page)).toEqual(['ראשונה', 'שנייה', 'שלישית', 'רביעית']);
  expect(await savedTitles()).toEqual(['ראשונה', 'שנייה', 'שלישית', 'רביעית']);
  await expect(page.getByRole('button', { name: 'רענן את הרשימה' })).toBeHidden();
});

test('a list changed meanwhile gets a 409: nothing is saved, and "refresh the list" shows the current list', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('task-row')).toHaveCount(4);
  // Another visitor adds a task after this page loaded.
  await db.query("insert into public.tasks (title, position) values ('של מבקר אחר', 4)");

  const saved = waitForOrderSave(page);
  await drag(page, isMobile, 'ראשונה', 'שלישית');
  expect((await saved).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText(ORDER_CONFLICT);
  expect(await titles(page)).toEqual(['ראשונה', 'שנייה', 'שלישית', 'רביעית']);
  expect(await savedTitles()).toEqual(['ראשונה', 'שנייה', 'שלישית', 'רביעית', 'של מבקר אחר']);

  await page.getByRole('button', { name: 'רענן את הרשימה' }).click();
  await expect(page.getByTestId('task-row')).toHaveCount(5);
  expect(await titles(page)).toEqual(['ראשונה', 'שנייה', 'שלישית', 'רביעית', 'של מבקר אחר']);
  await expect(page.getByRole('alert')).toBeHidden();
});

test("another visitor's changes appear only after a refresh, with no background loading", async ({ page, browser }) => {
  await page.goto('/');
  await expect(page.getByTestId('task-row')).toHaveCount(4);
  let listLoads = 0;
  page.on('request', (req) => {
    if (req.url().endsWith('/api/tasks') && req.method() === 'GET') listLoads++;
  });

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto('/');
  await expect(otherPage.getByTestId('task-row')).toHaveCount(4);
  await otherPage.getByTestId('task-row').filter({ hasText: 'רביעית' }).getByRole('checkbox').click();
  await expect.poll(async () => (await db.query("select completed from public.tasks where title = 'רביעית'")).rows[0].completed).toBe(true);
  await db.query("update public.tasks set position = case title when 'ראשונה' then 3 when 'רביעית' then 0 else position end");
  await other.close();

  await page.waitForTimeout(3000);
  expect(listLoads).toBe(0);
  expect(await titles(page)).toEqual(['ראשונה', 'שנייה', 'שלישית', 'רביעית']);
  await expect(row(page, 'רביעית').getByRole('checkbox')).not.toBeChecked();

  await page.reload();
  await expect(page.getByTestId('task-row')).toHaveCount(4);
  expect(await titles(page)).toEqual(['רביעית', 'שנייה', 'שלישית', 'ראשונה']);
  await expect(row(page, 'רביעית').getByRole('checkbox')).toBeChecked();
});

test.describe('API', () => {
  test.skip(({ isMobile }) => isMobile, 'once is enough');

  test('PUT /api/tasks/order: 200 for the full set, 409 for a changed set, 400 for bad input', async ({ request }) => {
    const { rows } = await db.query<{ id: string }>('select id from public.tasks order by position');
    const ids = rows.map((r) => r.id);

    let res = await request.put('/api/tasks/order', { data: { orderedIds: [...ids].reverse() } });
    expect(res.status()).toBe(200);
    expect((await res.json()).map((t: { position: number }) => t.position)).toEqual([0, 1, 2, 3]);
    expect(await savedTitles()).toEqual(['רביעית', 'שלישית', 'שנייה', 'ראשונה']);

    res = await request.put('/api/tasks/order', { data: { orderedIds: ids.slice(1) } });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe('ORDER_CONFLICT');
    res = await request.put('/api/tasks/order', { data: { orderedIds: [ids[0], ids[0], ids[1], ids[2]] } });
    expect(res.status()).toBe(409);
    expect(await savedTitles()).toEqual(['רביעית', 'שלישית', 'שנייה', 'ראשונה']);

    expect((await request.put('/api/tasks/order', { data: { orderedIds: ['x'] } })).status()).toBe(400);
    expect((await request.put('/api/tasks/order', { data: {} })).status()).toBe(400);
  });

  test('/api/tasks/order reaches its own function, not the single-task route or the SPA fallback', async ({ request }) => {
    const res = await request.get('/api/tasks/order');
    expect(res.status()).toBe(405);
    expect(res.headers()['allow']).toBe('PUT');
  });
});
