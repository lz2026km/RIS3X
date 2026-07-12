// v3.0.6.11-7: 全面功能对齐版 - 251 endpoint + 12 store + 40 报表 + AI 洞察
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./i18n/index.ts";

import "./styles/animations.css";
import "./styles/transitions.css";
import "./styles/responsive.css";
import "./styles/z-index.css";

const APP_VERSION = "3.0.6.11-17";
console.info(`[v${APP_VERSION}] === BOOT START ===`);
console.info(`[v${APP_VERSION}] Location:`, window.location.href);

// v3.0.6.11-6: 同步等待 SW cleanup 完成 (避免 MSW 检测到�?SW 触发 reload)
async function nukeSWAndCacheSync(timeoutMs = 3000): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
    return;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("nukeSW timeout")), timeoutMs),
  );

  const cleanup = (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs && regs.length > 0) {
        console.info(`[v${APP_VERSION}] Cleaning ${regs.length} old SWs`);
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (e) {
      console.warn(`[v${APP_VERSION}] SW cleanup error:`, e);
    }
    try {
      if ("caches" in window) {
        const names = await caches.keys();
        if (names && names.length > 0) {
          console.info(`[v${APP_VERSION}] Clearing ${names.length} caches`);
          await Promise.all(names.map((n) => caches.delete(n)));
        }
      }
    } catch (e) {
      console.warn(`[v${APP_VERSION}] cache cleanup error:`, e);
    }
  })();

  try {
    await Promise.race([cleanup, timeoutPromise]);
    console.info(`[v${APP_VERSION}] SW cleanup OK`);
  } catch (e) {
    console.warn(`[v${APP_VERSION}] SW cleanup skipped:`, e);
  }
}

async function startMSWWithTimeout(timeoutMs = 10000): Promise<boolean> {
  try {
    const { startMockBackend } = await import("./services/mockBackend/worker");
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`MSW timeout after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );
    // Race 启动 vs timeout
    const startPromise = startMockBackend().then(() => {
      console.info(`[v${APP_VERSION}] MSW startup resolved`);
      return true;
    });
    await Promise.race([startPromise, timeoutPromise]);
    console.info(`[v${APP_VERSION}] MSW started OK`);
    return true;
  } catch (err) {
    // 详细诊断
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      console.warn(
        `[v${APP_VERSION}] SW state: controller=${!!navigator.serviceWorker.controller}, registrations=${regs.length}`,
      );
      regs.forEach((r, i) => {
        console.warn(
          `  reg[${i}]: scope=${r.scope}, active=${r.active?.state}, installing=${r.installing?.state}, waiting=${r.waiting?.state}`,
        );
      });
    } catch {}
    console.warn(`[v${APP_VERSION}] MSW failed (continuing anyway):`, err);
    return false;
  }
}

async function bootstrap(): Promise<void> {
  // Phase 1: SW cleanup 同步 (避免 MSW 检测到�?controller 触发 reload)
  console.info(`[v${APP_VERSION}] Phase 1: SW cleanup`);
  await nukeSWAndCacheSync(3000);

  // Phase 2: MSW 必须等启动完�?(10s timeout 保护)
  console.info(`[v${APP_VERSION}] Phase 2: MSW start (max 10s)`);
  const mswOk = await startMSWWithTimeout(10000);
  if (!mswOk) {
    console.warn(`[v${APP_VERSION}] MSW unavailable, API will fallback`);
  }

  // Phase 3: 渲染 React
  console.info(`[v${APP_VERSION}] Phase 3: React render`);
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    console.error(`[v${APP_VERSION}] FATAL: no #root element`);
    return;
  }

  // 清掉 loading placeholder
  const placeholder = document.getElementById("loading-placeholder");
  if (placeholder) placeholder.remove();

  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    console.info(`[v${APP_VERSION}] === BOOT DONE ===`);
  } catch (err) {
    console.error(`[v${APP_VERSION}] FATAL: React render failed:`, err);
  }
}

void bootstrap();
