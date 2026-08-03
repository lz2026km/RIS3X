/**
 * web-push 可选依赖类型声明 (Phase 1.5)
 * web-push 未安装时, push-send 返回 web-push-not-installed;
 * 安装后删除本文件并使用官方类型 (npm i web-push @types/web-push)
 */
declare module 'web-push' {
  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
  ): void
  export function sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload?: string | Buffer,
    options?: Record<string, unknown>,
  ): Promise<unknown>
}
