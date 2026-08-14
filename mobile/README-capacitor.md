# Capacitor 原生打包 — G005 RIS v3.0.6.11-95 (Wave 3A, G-29)

> 生成时间: 2026-08-14 · 执行结果: **android 原生工程已生成 (`cap add android` 成功)**

## 当前状态

| 平台 | 状态 | 说明 |
| --- | --- | --- |
| Android | ✅ 工程已生成 | `mobile/android/` 由 `npx cap add android` 生成，`cap sync android` 已同步 web 资源 |
| iOS | ⏸ 未生成 | 未安装 `@capacitor/ios`（需 macOS + Xcode）；命令已就绪：`npm i -D @capacitor/ios && npx cap add ios` |

## 环境

- `@capacitor/core` / `@capacitor/cli` / `@capacitor/android`: `^6.2.0`
- `capacitor.config.ts`: appId `com.g005.ris`, appName `G005 RIS`, webDir `dist`
- 入口: 独立 Vite 应用（`mobile/index.html` → `mobile/src/main.tsx`），构建产物输出 `mobile/dist`（cap sync 已拷贝至 `android/app/src/main/assets/public`）

## 构建 → 打包 → 签名 步骤

```bash
cd mobile

# 1. 构建 Web 资源 (tsc + vite build → dist/)
npm run build

# 2. 同步到原生工程 (每次 build 后执行)
npx cap sync android

# 3. 打开 Android Studio (生成 debug APK)
npx cap open android
#   - 或命令行构建: cd android && ./gradlew assembleDebug
#   - 产物: android/app/build/outputs/apk/debug/app-debug.apk

# 4. 发布签名 (release APK)
cd android
./gradlew assembleRelease
# 签名配置: android/app/build.gradle 中 signingConfigs (keystore.properties 或环境变量)
#   storeFile / storePassword / keyAlias / keyPassword
# 产物: android/app/build/outputs/apk/release/app-release.apk
```

## iOS (macOS 机器)

```bash
npm i -D @capacitor/ios
npx cap add ios
npm run build && npx cap sync ios
npx cap open ios   # Xcode 打开 → 签名 Team → Archive → 上传
```

## 注意事项

- Android 原生工程无需 Android SDK 即可生成/同步；只有执行 gradle 构建时才需要
  JDK 17 + Android SDK (`ANDROID_HOME`)。
- 后端地址: 原生包内通过 `VITE_API_BASE`/环境配置指向后端 (开发代理仅限 vite dev)。
- 本机若网络受限: 重新生成原生工程命令 `npx cap add android` 可直接重跑，无网络时
  保留现有 `android/` 工程 + 上述命令文档即可。

## 相关 Wave 3A 变更

- G-29: 本工程 (G-29 完成)
- G-06: FusionPage SUV 真实化 (src/pages/dicom/FusionPage.tsx + backend fusion.service getSuv)
- G-23: BI socket 推送 (src/components/v3/stats/RealtimeOpsDashboard.tsx + backend notifications.gateway)
