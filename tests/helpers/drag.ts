import type { Locator, Page } from '@playwright/test';

const row = (page: Page, title: string) => page.getByTestId('task-row').filter({ hasText: title });
const handle = (page: Page, title: string) => row(page, title).getByTestId('drag-handle');

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Drags a row by its handle onto another row: real mouse events on desktop, real touch events
// (through the Chrome DevTools protocol) on the phone project.
export async function drag(page: Page, isMobile: boolean, from: string, to: string) {
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
