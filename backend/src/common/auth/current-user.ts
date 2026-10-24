/**
 * 认证用户上下文 helper。
 *
 * JWT payload 的用户标识字段是 `sub` (见 auth/jwt.strategy.ts 的 AuthenticatedUser),
 * 不是 `id`; 读取 `req.user.id` 恒为 undefined, 会让审计 actor 退化为占位符,
 * 并使客户端传入的 actorId 得以伪造操作人。
 *
 * 解析顺序: sub → username → 'unknown' (单一显式常量)。
 */
export interface AuthUser {
  sub?: string;
  username?: string;
  role?: string;
  tenantId?: string;
}

export function currentUserId(req: { user?: AuthUser }): string {
  return req.user?.sub ?? req.user?.username ?? "unknown";
}
