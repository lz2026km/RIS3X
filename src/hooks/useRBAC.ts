/**
 * useRBAC Hook - 基于角色的访问控制
 * G005 Radiology RIS System v3.0.3.31
 *
 * v3.0.3.31: 修复硬编码 'doctor' 角色 — 从 useAuth() 读取真实当前用户
 */
import { useAuth } from './useAuth';
import { hasPermission, checkAccess, canField } from '../services/auth/rbacService';
import type { Permission, AccessContext, ResourceType, FieldPermission } from '../services/auth/rbacService';

export function useRBAC() {
  const { user } = useAuth();
  // 防御性映射 — 中文角色映射为英文 rbacService key (fallback 'guest' 而非 'doctor')
  const userRole = user ? (mapToRbacRole(user.role)) : 'guest';
  const userId = user?.id ?? '';
  const department = user?.department ?? '';
  return {
    can: (permission: Permission) => hasPermission(userRole, permission),
    canField: (field: FieldPermission) => canField(userRole, field),
    checkAccess: (ctx: Omit<AccessContext, 'user'>) =>
      checkAccess({ user: { role: userRole, department, userId }, ...ctx }),
  };
}

function mapToRbacRole(chRole: string): string {
  switch (chRole) {
    case '管理员': return 'admin';
    case '主任': return 'director';
    case '医生': return 'doctor';
    case '技师': return 'technician';
    case '护士': return 'nurse';
    default: return 'guest';
  }
}

export type { Permission, AccessContext, ResourceType, FieldPermission };
