/**
 * 角色归一化工具 — G005 RIS v3.0.6.11-73 (P1 登录角色对齐)
 *
 * 决策: 全系统角色以英文枚举为规范 (与后端 Prisma UserRole 一致:
 * DOCTOR/TECHNICIAN/NURSE/ADMIN/DIRECTOR), 中文角色作为兼容输入。
 * 所有角色比较入口统一经过 normalizeRole, 中文/英文两种存储均可正确判断。
 */

export type CanonicalRole = 'DOCTOR' | 'TECHNICIAN' | 'NURSE' | 'ADMIN' | 'DIRECTOR';

export const CANONICAL_ROLES: readonly CanonicalRole[] = [
  'DOCTOR',
  'TECHNICIAN',
  'NURSE',
  'ADMIN',
  'DIRECTOR',
];

const CH_TO_EN: Record<string, CanonicalRole> = {
  '医生': 'DOCTOR',
  '技师': 'TECHNICIAN',
  '护士': 'NURSE',
  '管理员': 'ADMIN',
  '主任': 'DIRECTOR',
};

export const ROLE_LABELS: Record<CanonicalRole, string> = {
  DOCTOR: '医生',
  TECHNICIAN: '技师',
  NURSE: '护士',
  ADMIN: '管理员',
  DIRECTOR: '主任',
};

/** 中文或英文角色 → 规范英文枚举; 未知角色回退 DOCTOR */
export function normalizeRole(role?: string | null): CanonicalRole {
  if (!role) return 'DOCTOR';
  const ch = CH_TO_EN[role];
  if (ch) return ch;
  const upper = role.toUpperCase();
  const found = CANONICAL_ROLES.find((r) => r === upper);
  return found ?? 'DOCTOR';
}

/** 规范角色 → 中文展示名 (未知原样返回) */
export function roleLabel(role?: string | null): string {
  if (!role) return '';
  return ROLE_LABELS[normalizeRole(role)] ?? role;
}

/** 用户角色是否在允许角色列表中 (两端均归一化比较) */
export function rolesMatch(
  userRole: string | null | undefined,
  allowed?: readonly string[] | null | undefined,
): boolean {
  if (!allowed || allowed.length === 0) return true;
  const ur = normalizeRole(userRole);
  return allowed.some((r) => normalizeRole(r) === ur);
}

export const isCanonicalAdmin = (role?: string | null): boolean =>
  normalizeRole(role) === 'ADMIN';

export const isCanonicalDoctor = (role?: string | null): boolean => {
  const r = normalizeRole(role);
  return r === 'DOCTOR' || r === 'DIRECTOR';
};

export const isCanonicalTechnician = (role?: string | null): boolean =>
  normalizeRole(role) === 'TECHNICIAN';
