import { expect, test } from '@playwright/test';

// PWA installability without a service worker (ARCHITECTURE 2.8, ADR-10).
test('the page links a complete manifest whose icons load in the declared sizes', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');

  const response = await request.get(href!);
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ start_url: '/', scope: '/', display: 'standalone', lang: 'he', dir: 'rtl' });

  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const image = await request.get(icon.src);
    expect(image.status(), icon.src).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    const size = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, icon.src);
    expect(size).toBe(icon.sizes);
  }
});

test('Chrome reports the site as installable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('task-row').or(page.getByText('אין עדיין משימות', { exact: false })).first()).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
  await cdp.detach();
});

test('no service worker and no cache storage are used', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('task-row').or(page.getByText('אין עדיין משימות', { exact: false })).first()).toBeVisible();
  const state = await page.evaluate(async () => ({
    workers: (await navigator.serviceWorker.getRegistrations()).length,
    caches: (await caches.keys()).length,
  }));
  expect(state).toEqual({ workers: 0, caches: 0 });
});
