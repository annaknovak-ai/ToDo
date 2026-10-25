import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

// E2E tests run against `vercel dev` and the Dev database (ADR-11).
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'he-IL',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx vercel dev --listen ${PORT} --yes`,
    url: `http://localhost:${PORT}/api/tasks`,
    reuseExistingServer: true,
    timeout: 180000,
  },
});
