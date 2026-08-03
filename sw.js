// v3.0.6.11-53: DEPRECATED — 此根目录 sw.js 为 no-op,仅保留历史说明。
//
// PWA 已恢复(vite-plugin-pwa injectManifest):
//   - build 产物使用 dist/sw.js(由 src/sw.ts 编译生成,含离线缓存 + 危急值 Web Push)
//   - dev 模式不注册 SW(devOptions.enabled=false),避免与 MSW mockServiceWorker.js 冲突
//   - 注册逻辑在 src/main.tsx (virtual:pwa-register),仅 build/real 模式生效
//
// 本文件未被 index.html 引用,不参与任何运行流程;可安全删除。
// 注意: 不要恢复 public/sw.js 的 no-op 拷贝,它会覆盖 vite-plugin-pwa 生成的 dist/sw.js。

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  return
})
