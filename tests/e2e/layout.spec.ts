import { expect, test, type Page } from '@playwright/test';
import type pg from 'pg';
import { createDevPool, replaceTasks } from '../helpers/devDb.js';

// Screen structure from the wireframes, desktop and mobile (DESIGN 1.1, 1.6, 2.4–2.5).
let db: pg.Pool;

test.beforeAll(async () => {
  db = createDevPool();
  // Long enough to need scrolling, with a long Hebrew title to be cut visually.
  const tasks = Array.from({ length: 30 }, (_, i) => ({ title: `משימת פריסה ${i + 1}` }));
  tasks[3] = { title: 'משימה עם כותרת ארוכה מאוד שאמורה להיחתך בשורת הרשימה ולא לשבור את הפריסה של המסך' };
  await replaceTasks(db, tasks);
});

test.afterAll(async () => {
  await db?.end();
});

async function noHorizontalScroll(page: Page) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

test('the page is Hebrew and right-to-left', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('desktop: list on the right, details on the left; a long list scrolls inside its panel', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop layout');
  await page.goto('/');
  await expect(page.getByTestId('task-row')).toHaveCount(30);

  const list = (await page.locator('.list-panel').boundingBox())!;
  const details = (await page.getByTestId('details-panel').boundingBox())!;
  expect(list.x).toBeGreaterThan(details.x);
  expect(Math.abs(list.y - details.y)).toBeLessThan(2);

  // The page itself does not scroll; the list body does.
  const scroll = await page.evaluate(() => {
    const body = document.querySelector('[data-testid="list-body"]')!;
    return {
      page: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      list: body.scrollHeight - body.clientHeight,
    };
  });
  expect(scroll.page).toBeLessThanOrEqual(1);
  expect(scroll.list).toBeGreaterThan(0);

  await page.getByTestId('task-row').last().getByTestId('task-select').click();
  await expect(page.getByTestId('details-panel')).toBeInViewport();
  await noHorizontalScroll(page);
});

test('mobile: one column, list above details, selecting scrolls to the details, no sideways scrolling', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile layout');
  await page.goto('/');
  await expect(page.getByTestId('task-row')).toHaveCount(30);
  await noHorizontalScroll(page);

  const list = (await page.locator('.list-panel').boundingBox())!;
  const details = (await page.getByTestId('details-panel').boundingBox())!;
  expect(details.y).toBeGreaterThan(list.y + list.height - 1);
  expect(Math.abs(details.x - list.x)).toBeLessThan(2);

  // Wireframe order: navigation, full-width add button, list.
  const add = (await page.getByRole('button', { name: 'הוסף משימה' }).boundingBox())!;
  expect(add.y).toBeLessThan(list.y);
  expect(add.width).toBeGreaterThan(list.width - 2);

  // Touch targets for the checkbox area and the drag handle.
  const first = page.getByTestId('task-row').first();
  for (const target of [first.locator('.task-check'), first.getByTestId('drag-handle')]) {
    const b = (await target.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }

  await page.getByTestId('task-row').nth(3).getByTestId('task-select').click();
  await expect(page.getByTestId('details-panel').getByLabel('כותרת', { exact: true })).toBeInViewport();
  await noHorizontalScroll(page);

  const addButton = page.getByRole('button', { name: 'הוסף משימה' });
  await addButton.scrollIntoViewIfNeeded();
  await addButton.click();
  const dialog = page.getByRole('dialog', { name: 'הוספת משימה' });
  await expect(dialog).toBeVisible();
  const d = (await dialog.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(d.x).toBeGreaterThanOrEqual(0);
  expect(d.x + d.width).toBeLessThanOrEqual(viewport.width);
  await noHorizontalScroll(page);
});

test('a long title is cut with an ellipsis inside its row', async ({ page }) => {
  await page.goto('/');
  const label = page.getByTestId('task-row').nth(3).locator('.task-label');
  await expect(label).toBeVisible();
  const cut = await label.evaluate((el) => ({
    overflow: getComputedStyle(el).textOverflow,
    truncated: el.scrollWidth > el.clientWidth,
  }));
  expect(cut).toEqual({ overflow: 'ellipsis', truncated: true });
});

test('the about page keeps the same navigation, with its link active', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1, name: 'אודות' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'אודות' })).toHaveClass(/active/);
  await expect(page.getByRole('link', { name: 'דף הבית' })).not.toHaveClass(/active/);
  await noHorizontalScroll(page);
});
