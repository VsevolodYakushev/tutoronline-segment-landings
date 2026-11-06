import { defineConfig, devices } from '@playwright/test';

const widths = [
  { name: '360', viewport: { width: 360, height: 640 } },
  { name: '390', viewport: { width: 390, height: 844 } },
  { name: '768', viewport: { width: 768, height: 1024 } },
  { name: '1024', viewport: { width: 1024, height: 768 } },
  { name: '1440', viewport: { width: 1440, height: 900 } },
];

const engines = [
  { name: 'chromium', device: devices['Desktop Chrome'] },
  { name: 'webkit', device: devices['Desktop Safari'] },
];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8765',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  },
  projects: engines.flatMap(engine => widths.map(width => ({
    name: `${engine.name}-${width.name}`,
    use: { ...engine.device, viewport: width.viewport, hasTouch: width.viewport.width < 1024, isMobile: false },
  }))),
  webServer: {
    command: 'npm run build && node server.mjs',
    url: 'http://127.0.0.1:8765/5-9/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { LEAD_WEBHOOK_URL: 'https://example.invalid/hook' },
  },
});
