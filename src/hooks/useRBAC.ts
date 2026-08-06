/**
 * useRBAC Hook - 基于角色的访问控制
 * G005 Radiology RIS System v3.0.3.31
 *
 * v3.0.3.31: 修复硬编码 'doctor' 角色 — 从 useAuth() 读取真实当前用户
 * v3.0.6.11-73: mapToRbacRole 支持英文枚举 (DOCTOR/ADMIN 等) 与中文角色
 */
import { useAuth } from './useAuth';
import { hasPermission, checkAccess, canField } from '../services/auth/rbacService';
import { normalizeRole, type CanonicalRole } from '../services/auth/roleUtils';
import type { Permission, AccessContext, ResourceType, FieldPermission } from '../services/auth/rbacService';

const RBAC_BY_CANONICAL: Record<CanonicalRole, string> = {
  ADMIN: 'admin',
  DIRECTOR: 'director',
  DOCTOR: 'doctor',
  TECHNICIAN: 'technician',
  NURSE: 'nurse',
};

export function useRBAC() {
  const { user } = useAuth();
  // 防御性映射 — 中文/英文角色均映射为英文 rbacService key (fallback 'guest')
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
  return RBAC_BY_CANONICAL[normalizeRole(chRole)] ?? 'guest';
}

export type { Permission, AccessContext, ResourceType, FieldPermission };
