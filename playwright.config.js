import { defineConfig } from '@playwright/test';
const production = process.env.BASE_URL;
const baseURL = production ? `${production.replace(/\/$/, '')}/` : 'http://127.0.0.1:8049/ContentBatch/';
export default defineConfig({ testDir: './tests/e2e', timeout: 360000, expect: { timeout: 45000 }, workers: 1, use: { baseURL, launchOptions: { executablePath: process.env.CONTENTBATCH_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } }, webServer: production ? undefined : { command: 'python3 -m http.server 8049 --bind 127.0.0.1 --directory ..', url: baseURL, reuseExistingServer: false } });
