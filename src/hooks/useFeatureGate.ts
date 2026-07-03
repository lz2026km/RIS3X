/**
 * useFeatureGate - 集中权限/功能可见性检查 hook
 *
 * v3.0.6.10-1: 业务侧替换散落的 v-if / 三元 / hidden 逻辑
 * 配合 <PermissionGate /> 一起使用, 提供两种粒度:
 *  - gate(perm): 布尔权限检查
 *  - gateAll([perm1, perm2]): 多权限 AND
 *  - gateAny([perm1, perm2]): 多权限 OR
 */
import { useMemo } from "react";
import { useRBAC } from "./useRBAC";
import { useAuth } from "./useAuth";
import { hasPermission } from "../services/auth/rbacService";
import type { Permission } from "../services/auth/rbacService";

export function useFeatureGate() {
  const { user } = useAuth();
  const { can } = useRBAC();
  return useMemo(
    () => ({
      /** 单权限检查 */
      gate: (permission: Permission | string) =>
        can(permission as Permission),
      /** 多权限全部满足 */
      gateAll: (perms: Array<Permission | string>) =>
        perms.every((p) => hasPermission(user?.role ?? "guest", p as Permission)),
      /** 多权限任一满足 */
      gateAny: (perms: Array<Permission | string>) =>
        perms.some((p) => hasPermission(user?.role ?? "guest", p as Permission)),
      /** 当前用户角色 */
      role: user?.role ?? "guest",
    }),
    [user, can]
  );
}

export default useFeatureGate;