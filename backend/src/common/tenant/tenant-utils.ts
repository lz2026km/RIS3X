import { getCurrentTenantId } from '../interceptors/tenant-context.interceptor'

/**
 * [W5] 默认租户 ID: 环境变量 DEFAULT_TENANT_ID 优先, 无则回退 'default'。
 * 用于无认证 (@Public) 请求或上下文缺失时的租户兜底, 保持既有行为。
 */
export const DEFAULT_TENANT_ID: string =
  (process.env['DEFAULT_TENANT_ID'] ?? '').trim() || 'default'

/**
 * 共享租户上下文 helper (SEC3):
 * 读取 AsyncLocalStorage 中由 TenantContextInterceptor 写入的当前租户 ID。
 * 无认证 (@Public) 请求或上下文缺失时回退到 DEFAULT_TENANT_ID，保持既有行为。
 */
export function currentTenantId(): string {
  return getCurrentTenantId()
}
