import { getCurrentTenantId } from '../interceptors/tenant-context.interceptor'

/**
 * 共享租户上下文 helper (SEC3):
 * 读取 AsyncLocalStorage 中由 TenantContextInterceptor 写入的当前租户 ID。
 * 无认证 (@Public) 请求或上下文缺失时回退到 'default'，保持既有行为。
 */
export function currentTenantId(): string {
  return getCurrentTenantId()
}
