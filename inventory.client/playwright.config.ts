import { defineConfig, devices } from '@playwright/test';

const smokeBaseUrl = process.env['SmokeBaseUrl']?.replace(/\/$/, '');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'playwright-results.xml' }]],

  use: {
    baseURL: smokeBaseUrl ?? 'https://localhost:50212',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },

  webServer: (smokeBaseUrl || process.env['SKIP_WEBSERVER']) ? [] : [
    {
      command: 'dotnet run --project ../Inventory.Server',
      url: 'https://localhost:7150/healthz',
      ignoreHTTPSErrors: true,
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'npm start',
      url: 'https://localhost:50212',
      ignoreHTTPSErrors: true,
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: /synthetic/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'synthetic',
      testDir: './e2e/synthetic',
      timeout: 10 * 60_000,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        userAgent: `${devices['Desktop Chrome'].userAgent} crgolden-synthetic/1.0`,
        actionTimeout: 30_000,
        navigationTimeout: 60_000,
      },
    },
  ],
});
