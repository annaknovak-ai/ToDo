import { defineConfig, devices } from '@playwright/test';

// Read-only checks against the live site after a push (ADR-11). The address is given on the
// command line, e.g. `PROD_URL=https://example.vercel.app npm run test:prod`; nothing is written.
const baseURL = process.env.PROD_URL;
if (!baseURL?.startsWith('https://')) {
  throw new Error('Set PROD_URL to the live site address (https://...)');
}

export default defineConfig({
  testDir: './tests/prod',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: { baseURL, locale: 'he-IL' },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
