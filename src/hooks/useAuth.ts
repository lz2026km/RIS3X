/**
 * useAuth Hook - 用户认证与角色管理
 * G005 Radiology RIS System v3.0.3.31
 *
 * v3.0.3.31: 修复硬编码管理员 — 从 localStorage 读取已登录用户,无登录态返回 null
 * v3.0.6.11-73: 角色判断支持英文枚举 (DOCTOR/ADMIN 等, 与后端一致), 中文兼容
 */
import { useMemo } from 'react';
import type { User, UserRole } from '../types';
import { safeGetItem } from '../utils/safeStorage';
import {
  rolesMatch,
  isCanonicalAdmin,
  isCanonicalDoctor,
  isCanonicalTechnician,
} from '../services/auth/roleUtils';

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDoctor: boolean;
  isTechnician: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  canAccess: (path: string) => boolean;
}

const AUTH_STORAGE_KEY = 'ris_current_user';

function loadCurrentUser(): User | null {
  try {
    const raw = safeGetItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function useAuth(): UseAuthReturn {
  const user = loadCurrentUser();

  const isAuthenticated = user !== null;
  const isAdmin = useMemo(() => isCanonicalAdmin(user?.role), [user?.role]);
  const isDoctor = useMemo(() => isCanonicalDoctor(user?.role), [user?.role]);
  const isTechnician = useMemo(() => isCanonicalTechnician(user?.role), [user?.role]);

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return rolesMatch(user.role, roles);
  };

  // 路径权限映射
  const pathPermissions: Record<string, UserRole[]> = {
    '/authority': ['管理员'],
    '/system/dicom-print': ['技师', '管理员'],
    '/equipment-lifecycle': ['技师', '主任', '管理员'],
    '/cost-analysis': ['主任', '管理员'],
  };

  const canAccess = (path: string): boolean => {
    if (!user) return false;
    const requiredRoles = pathPermissions[path];
    if (!requiredRoles) return true;
    return hasRole(requiredRoles);
  };

  return {
    user,
    isAuthenticated,
    isAdmin,
    isDoctor,
    isTechnician,
    hasRole,
    canAccess,
  };
}

export default useAuth;