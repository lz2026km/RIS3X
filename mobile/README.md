# G005 RIS Mobile — 移动原生 App 打包指南

G005 RIS 移动端基于 Vite + React + TypeScript，使用 **Capacitor** 封装为 Android/iOS 原生 App（对标 Sectra/Infinitt 移动端体验）。

## 目录结构

```
mobile/
├── capacitor.config.ts     # Capacitor 配置（appId com.g005.ris）
├── public/
│   ├── manifest.webmanifest # PWA manifest
│   ├── sw.js               # Service Worker（离线缓存）
│   ├── favicon.svg
│   └── icons/              # 应用图标（192/512）
├── src/                    # React 移动端应用
└── dist/                   # vite build 产物（Capacitor webDir）
```

## 前置要求

- Node.js ≥ 18，npm ≥ 9
- Android 打包：JDK 17 + Android SDK（`ANDROID_HOME` 环境变量）
- iOS 打包：macOS + Xcode（本项目 CI 仅验证配置就绪，不执行 gradle 构建）

## 打包流程

```bash
# 1. 安装依赖（含 @capacitor/core、@capacitor/cli、@capacitor/android）
npm install

# 2. 构建 Web 资源（输出到 dist/，即 capacitor.config.ts 的 webDir）
npm run build

# 3. 首次添加 Android 原生工程（生成 android/ 目录，仅需一次）
npx cap add android
# iOS: npx cap add ios（需 macOS）

# 4. 同步 Web 产物到原生工程（每次 npm run build 后执行）
npx cap sync

# 5. 打开原生 IDE 构建/运行
npx cap open android
```

> 注：`android/` 目录由 `npx cap add android` 生成，已加入 `.gitignore`（如未忽略可自行追加）。
> 环境无 Android SDK 时无需执行 gradle 构建——配置就绪即可。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run cap:add:android` | 构建 + 添加 Android 工程 |
| `npm run cap:sync` | 构建 + 同步到原生工程 |
| `npm run cap:sync:android` | 仅同步 Android |
| `npm run cap:open:android` | 打开 Android Studio |
| `npm run dev` | Vite 开发服务器（端口 5192，代理 /api → 5191） |

## 移动端 API

后端端点统一前缀 `/api`，移动端子应用代理 `/api` → `http://localhost:5191`。

移动端专属端点（`backend/src/mobile/`）：

| 端点 | 说明 |
| --- | --- |
| `GET /api/mobile/jscode2session?code=` | 微信登录 code 换 session |
| `GET /api/mobile/today-summary` | 今日概览（检查量/待办/危急值） |
| `GET /api/mobile/worklist?status=` | 移动端工作列表 |
| `GET /api/mobile/critical-values` | 危急值列表 |
| `POST /api/mobile/critical-values/:id/ack` | 危急值确认 |
| `GET /api/mobile/reports/latest?limit=` | 最新报告 |
| `POST /api/mobile/device-token` | 推送 token 注册 |

## PWA

- `manifest.webmanifest`：安装到主屏幕（standalone、主题色 #1e3a5f）
- `sw.js`：导航请求网络优先 + 静态资源缓存优先，支持离线打开
- Service Worker 仅在 `PROD` 构建注册

## CI

`.github/workflows/ci.yml` 与 `release.yml`：lint / typecheck / test / build，并验证 `npx cap sync --dry-run`（如有配置）。
