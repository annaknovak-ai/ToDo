import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Renders the PWA icons from the SVG sources with the project's Playwright Chromium (ADR-10).
// Run once with `npm run icons`; the PNG files are kept in Git.
const ICONS = [
  { source: 'public/icons/icon.svg', output: 'public/icons/icon-192.png', size: 192 },
  { source: 'public/icons/icon.svg', output: 'public/icons/icon-512.png', size: 512 },
  { source: 'public/icons/icon-maskable.svg', output: 'public/icons/icon-maskable-512.png', size: 512 },
];

const browser = await chromium.launch();
try {
  for (const icon of ICONS) {
    const svg = await readFile(icon.source, 'utf8');
    const page = await browser.newPage({ viewport: { width: icon.size, height: icon.size } });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${icon.size}" height="${icon.size}" `)}</body></html>`,
    );
    await page.screenshot({ path: icon.output, omitBackground: true });
    await page.close();
    console.log(`${icon.output} (${icon.size}x${icon.size})`);
  }
} finally {
  await browser.close();
}
