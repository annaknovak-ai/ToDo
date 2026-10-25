import { expect, test } from '@playwright/test';

test('navigates between home and about, and reloads /about directly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('link', { name: 'דף הבית' })).toHaveClass(/active/);

  await page.getByRole('link', { name: 'אודות' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { level: 1, name: 'אודות' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'אודות' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'אודות' })).toHaveClass(/active/);

  await page.getByRole('link', { name: 'דף הבית' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'המשימות שלי' })).toBeVisible();
});

test('API routes are not swallowed by the SPA fallback', async ({ request }) => {
  const res = await request.get('/api/tasks');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/json');
  expect(res.headers()['cache-control']).toBe('no-store');
  expect(Array.isArray(await res.json())).toBe(true);

  // An empty task reaches the API handler and is rejected by validation, not served the SPA.
  const post = await request.post('/api/tasks', { data: {} });
  expect(post.status()).toBe(422);
  expect((await post.json()).error.code).toBe('VALIDATION_ERROR');

  const unsupported = await request.delete('/api/tasks');
  expect(unsupported.status()).toBe(405);
});
