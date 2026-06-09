import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'worker',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'client-unit',
          environment: 'node',
          include: ['test/client/**/*.test.ts'],
          exclude: ['test/client/**/*.browser.test.ts'],
          setupFiles: ['./test/setup.three.node.ts'],
        },
      },
      {
        test: {
          name: 'client-browser',
          include: ['test/client/**/*.browser.test.ts'],
          setupFiles: ['./test/setup.three.browser.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
