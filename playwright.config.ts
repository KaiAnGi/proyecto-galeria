import { defineConfig, devices } from '@playwright/test'
import { ECOSIA_USER_AGENT } from './e2e/helpers'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_GOOGLE_CLIENT_ID: 'e2e-client-id' },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] } },
    { name: 'ecosia', use: { ...devices['Desktop Chrome'], userAgent: ECOSIA_USER_AGENT } },
  ],
})
