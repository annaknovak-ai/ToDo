import { expect, test, type Page } from '@playwright/test';

// Read-only smoke test of the live site: no task is created, changed or deleted (ADR-11).
const EMPTY = 'אין עדיין משימות. לחץ על "הוסף משימה" כדי להתחיל.';

async function listLoaded(page: Page) {
  await expect(page.getByTestId('task-row').first().or(page.getByText(EMPTY))).toBeVisible();
}

test('the home page loads the shared list from the server', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'המשימות שלי' })).toBeAttached();
  await listLoaded(page);
});

test('the API answers over HTTPS without caching', async ({ request }) => {
  const response = await request.get('/api/tasks');
  expect(response.status()).toBe(200);
  expect(response.url()).toMatch(/^https:\/\//);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(Array.isArray(await response.json())).toBe(true);
});

test('navigation works, including a refresh on /about', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'אודות' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'אודות' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'אודות' })).toBeVisible();
  await page.getByRole('link', { name: 'דף הבית' }).click();
  await listLoaded(page);
});

test('the manifest and icons load and Chrome reports the site as installable', async ({ page, request }) => {
  await page.goto('/');
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ start_url: '/', display: 'standalone' });
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  }
  await listLoaded(page);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
  await cdp.detach();
});
