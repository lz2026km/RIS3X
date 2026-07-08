/**
 * G005 放射RIS系统 v3.0.0 - Vite 配置
 * Phase T4-W9: 性能优化 + 拆分 + 压缩 + 缓存
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';

const VERSION = process.env['VITE_RELEASE'] ?? '3.0.0';

// Security headers
const SECURITY_HEADERS = {
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
};

// CSP(生产模式更严格)
const CSP_HEADER = (isDev: boolean) => [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.sentry.io https://*.deepseek.com wss: https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  isDev ? '' : 'upgrade-insecure-requests',
].filter(Boolean).join('; ');

export default defineConfig({
  plugins: [
    react(),

    // PWA (v3.0.6.8-14: 完全禁用, 用我们自己的 simple SW)
    // 使用 generateSW: false + 自定义 public/sw.js (no-op SW, 不影响 MSW)
    VitePWA({
      registerType: 'autoUpdate',  // P0-11 v3.0.7: 启用 PWA,自动更新 SW
      strategies: 'generateSW',
      injectRegister: 'auto',
      disable: false,  // P0-11 v3.0.7: 启用 PWA 生成
      devOptions: { enabled: false },  // dev 模式不启用 (避免和 MSW sw.js 冲突)
      workbox: {
        // 缓存策略: app shell + 静态资源, MSW 路径不缓存
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}'],
        navigateFallback: '/g005-radiology-ris/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/g005-radiology-ris\/api\//, /^\/mockServiceWorker\.js/, /^\/sw\.js/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: { cacheName: 'html-cache', networkTimeoutSeconds: 3 },
          },
          {
            urlPattern: ({ request }) => ['style','script','worker'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'asset-cache' },
          },
        ],
      },
      manifest: {
        name: 'G005 放射科RIS系统',
        short_name: 'G005 RIS',
        description: '放射科放射信息系统',
        theme_color: '#1e3a5f',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/g005-radiology-ris/',
        start_url: '/g005-radiology-ris/',
        lang: 'zh-CN',
        icons: [
          { src: '/g005-radiology-ris/icons/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/g005-radiology-ris/icons/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    }),

    // 版本戳(CDN 缓存友好)
    {
      name: 'version-stamp',
      apply: 'build',
      writeBundle() {
        const htmlPath = 'dist/index.html';
        if (!fs.existsSync(htmlPath)) return;
        let html = fs.readFileSync(htmlPath, 'utf-8');
        html = html.replace(/(src|href)="(\/assets\/[^"]+\.js)"/g, `$1="$2?v=${VERSION}"`);
        html = html.replace(/(src|href)="(\/assets\/[^"]+\.css)"/g, `$1="$2?v=${VERSION}"`);
        fs.writeFileSync(htmlPath, html);
        console.log(`[Build] Version stamp v${VERSION} applied`);
      },
    },

    // 开发服务器安全头 + MSW
    {
      name: 'security-headers',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
            res.setHeader(key, value);
          }
          res.setHeader('Content-Security-Policy', CSP_HEADER(true));
          next();
        });
      },
    },

    // PWA / MSW Service Worker 复制到 dist(避免被 vite 当 worker 编译)
    {
      name: 'copy-service-workers',
      apply: 'build',
      closeBundle() {
        const files = ['public/mockServiceWorker.js', 'public/sw.js']
        for (const f of files) {
          if (fs.existsSync(f)) {
            const dest = 'dist/' + f.split('/').pop()
            fs.copyFileSync(f, dest)
            console.log('[Build] copied', f, '->', dest)
          }
        }
      },
    },

    // i18n 命名空间 JSON: src/i18n/locales/{zh-CN|en-US}/*.json
    // → dev:   由 middleware 直接从 src/i18n/locales 提供 /locales/{lng}/{ns}.json
    // → build: 复制到 dist/locales/{lng}/{ns}.json 供 i18next HttpBackend 运行时 fetch
    {
      name: 'i18n-locales',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/locales', (req, res, next) => {
          const url = req.url || '';
          const segs = url.split('?')[0].split('/').filter(Boolean);
          if (segs.length < 2) return next();
          const [lng, nsFile] = segs;
          const srcPath = path.resolve(__dirname, 'src/i18n/locales', lng, nsFile);
          if (!fs.existsSync(srcPath)) return next();
          const ext = path.extname(nsFile).toLowerCase();
          const ct = ext === '.json' ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8';
          res.setHeader('Content-Type', ct);
          res.setHeader('Cache-Control', 'public, max-age=300');
          fs.createReadStream(srcPath).pipe(res);
        });
      },
    },
    {
      name: 'i18n-locales-build',
      apply: 'build',
      closeBundle() {
        const srcRoot = path.resolve(__dirname, 'src/i18n/locales');
        const destRoot = path.resolve(__dirname, 'dist/locales');
        for (const lng of ['zh-CN', 'en-US']) {
          const srcDir = path.join(srcRoot, lng);
          const destDir = path.join(destRoot, lng);
          if (!fs.existsSync(srcDir)) continue;
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
          for (const file of fs.readdirSync(srcDir)) {
            if (!file.endsWith('.json')) continue;
            fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
          }
          console.log(`[Build] copied ${fs.readdirSync(srcDir).length} locale files -> ${destDir}`);
        }
      },
    },
  ],

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
      '@store': path.resolve(__dirname, './src/store'),
    },
  },

  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    minify: 'esbuild',
    cssMinify: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        format: 'es',
        // 手动分包
        manualChunks: {
          // 核心 React 栈
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // antd
          'antd-vendor': ['antd', '@ant-design/icons', '@ant-design/cssinjs'],

          // 3D
          'three-vendor': ['three'],

          // 协同(Yjs)
          'collab-vendor': ['yjs', 'y-webrtc', 'lib0', 'comlink'],

          // 状态机
          'xstate-vendor': ['xstate', '@xstate/react'],

          // 工具
          'utils-vendor': [
            'date-fns',
            'date-fns-tz',
            'decimal.js',
            'decimal.js-light',
            'uuid',
            'pinyin-pro',
            'qrcode',
            'dompurify',
            'zod',
            'zustand',
          ],

          // 图表
          'charts-vendor': ['recharts', 'lucide-react', '@dnd-kit/core'],

          // DICOM 堆栈已从 manualChunks 移除(@cornerstonejs/* / dcmjs / dicom-parser)
          // 改为由 Rollup 动态产出按需 chunk,避免被 modulepreload 强拉

          // 数据库
          'db-vendor': ['dexie', 'dexie-react-hooks'],

          // 规则引擎
          'rules-vendor': ['json-rules-engine'],

          // PDF
          'pdf-vendor': ['jspdf'],
        },
        // 文件名 hash
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'antd',
      '@ant-design/icons',
      'recharts',
      'dayjs',
    ],
    exclude: ['@cornerstonejs/dicom-image-loader'],
  },

  // cornerston3D / dicom-image-loader 的 web worker 默认 iife, code-splitting 不支持
  // 强制所有 worker 输出 ES 模块
  worker: {
    format: 'es',
  },

  // GitHub Pages 子路径 (本地开发用"/", 部署用 VITE_BASE_PATH)
  base: process.env['VITE_BASE_PATH'] || '/',

  server: {
    port: 5195,
    host: '0.0.0.0',
    headers: {
      ...SECURITY_HEADERS,
      'Content-Security-Policy': CSP_HEADER(true),
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 4173,
    host: '0.0.0.0',
    headers: {
      ...SECURITY_HEADERS,
      'Content-Security-Policy': CSP_HEADER(false),
    },
  },
});
