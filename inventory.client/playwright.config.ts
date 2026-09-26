import { defineConfig, devices } from '@playwright/test';
import { newId } from '@crgolden/modules/testing';
import { bffPort } from './e2e/bff-launch';
import e2eSettings from './e2e/e2e-settings.json';
import { AGAINST_MOCKS, localOrigin } from './e2e/mocks/mock-dependencies';

const walkerBaseUrl = process.env['WalkerBaseUrl']?.replace(/\/$/, '');
const againstMocks = AGAINST_MOCKS;

const mockServers = [
  { script: 'e2e/mocks/oidc-server.ts', port: e2eSettings.mockOidcPort, extraArguments: [e2eSettings.mockIdentityCookie] },
  { script: 'e2e/mocks/products-server.ts', port: e2eSettings.mockProductsPort, extraArguments: [] },
  { script: 'e2e/mocks/manuals-server.ts', port: e2eSettings.mockManualsPort, extraArguments: [] },
].map(({ script, port, extraArguments }) => ({
  command: ['node', script, port, ...extraArguments].join(' '),
  port,
  reuseExistingServer: false,
  timeout: 30000,
}));

const bffAgainstMocks = {
  OidcAuthority: localOrigin(e2eSettings.mockOidcPort),
  ProductsApiAddress: localOrigin(e2eSettings.mockProductsPort),
  ManualsApiAddress: localOrigin(e2eSettings.mockManualsPort),
  InventoryClientId: newId(),
  InventoryClientSecret: newId(),
  OpenIdConnectOptions__RequireHttpsMetadata: 'false',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'playwright-results.xml' }]],

  use: {
    baseURL: walkerBaseUrl ?? 'https://localhost:50212',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },

  webServer: (walkerBaseUrl || process.env['SKIP_WEBSERVER']) ? [] : [
    ...(againstMocks ? mockServers : []),
    {
      command: againstMocks
        ? 'dotnet run --project ../Inventory.Server --no-build --configuration Release'
        : 'dotnet run --project ../Inventory.Server',
      port: bffPort(),
      reuseExistingServer: !againstMocks,
      timeout: 60000,
      ...(againstMocks ? { env: bffAgainstMocks } : {}),
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
        storageState: e2eSettings.authStateFile,
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
      },
    },
  ],
});
