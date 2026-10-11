// [W3-B] 应用信息统一入口
// VITE_APP_NAME / VITE_APP_VERSION / VITE_GIT_SHA / VITE_BUILD_TIME 声明接入点
export const APP_NAME: string = import.meta.env.VITE_APP_NAME || "G005 放射RIS";
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || "3.0.6.13-12";
export const GIT_SHA: string = (import.meta.env.VITE_GIT_SHA as string | undefined)?.trim() || "";
export const BUILD_TIME: string = (import.meta.env.VITE_BUILD_TIME as string | undefined)?.trim() || "";

/** 构建元信息 (用于侧边栏版本 tooltip / 启动日志), 空项自动忽略 */
export function buildMeta(): string {
  const parts: string[] = [];
  if (GIT_SHA) parts.push(`git:${GIT_SHA.length > 12 ? GIT_SHA.slice(0, 12) : GIT_SHA}`);
  if (BUILD_TIME) parts.push(`build:${BUILD_TIME}`);
  return parts.join(" | ");
}
