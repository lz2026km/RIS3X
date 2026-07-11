/// <reference types="vitest" />
/**
 * G005 放射RIS系统 v3.0.1 - Vitest 配置
 * Phase T1-W1/W2: 测试基线
 *
 * v3.0.1:覆盖率阈值提升至 70%
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'e2e',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary', 'lcov', 'cobertura'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/__tests__/**',
        'src/test/**',
        'src/main.tsx',
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/types/**',
        'src/data/**',
      ],
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 65,
        lines: 60,
      },
      reportOnFailure: true,
    },
    reporters: ['default', ['html', { open: false }]],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    isolate: true,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    slowTestThreshold: 1000,
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@data': path.resolve(__dirname, './src/data'),
      '@types': path.resolve(__dirname, './src/types'),
      '@i18n': path.resolve(__dirname, './src/i18n'),
      '@machines': path.resolve(__dirname, './src/machines'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@a11y': path.resolve(__dirname, './src/a11y'),
      '@observability': path.resolve(__dirname, './src/observability'),
      '@security': path.resolve(__dirname, './src/security'),
    },
  },
});
