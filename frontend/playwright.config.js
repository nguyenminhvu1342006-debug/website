import { defineConfig } from '@playwright/test';
import process from 'node:process';

const python = process.env.CLINIC_TEST_PYTHON || (process.platform === 'win32'
  ? '../backend/venv/Scripts/python.exe' : '../backend/venv/bin/python');

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4174', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: [
    { command: `"${python}" ../backend/browser_test_server.py`, url: 'http://127.0.0.1:8011/api/doctors/', timeout: 60000 },
    { command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort', url: 'http://127.0.0.1:4174',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:8011/api/' } },
  ],
});
