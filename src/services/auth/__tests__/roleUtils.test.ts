/**
 * G005 放射RIS系统 v3.0.6.11-73 - 登录角色对齐 (P1)
 * 覆盖: 中文/英文角色归一化, useAuth 判定语义, RBAC 映射一致性
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRole,
  rolesMatch,
  roleLabel,
  isCanonicalAdmin,
  isCanonicalDoctor,
  isCanonicalTechnician,
  CANONICAL_ROLES,
} from '../roleUtils';

describe('roleUtils - 角色归一化 (中文/英文兼容)', () => {
  it('中文角色 → 规范英文枚举', () => {
    expect(normalizeRole('管理员')).toBe('ADMIN');
    expect(normalizeRole('主任')).toBe('DIRECTOR');
    expect(normalizeRole('医生')).toBe('DOCTOR');
    expect(normalizeRole('技师')).toBe('TECHNICIAN');
    expect(normalizeRole('护士')).toBe('NURSE');
  });

  it('英文角色原样通过 (与后端 Prisma UserRole 一致)', () => {
    expect(normalizeRole('ADMIN')).toBe('ADMIN');
    expect(normalizeRole('DOCTOR')).toBe('DOCTOR');
    expect(normalizeRole('TECHNICIAN')).toBe('TECHNICIAN');
    expect(normalizeRole('NURSE')).toBe('NURSE');
    expect(normalizeRole('DIRECTOR')).toBe('DIRECTOR');
  });

  it('大小写不敏感; 未知/空回退 DOCTOR', () => {
    expect(normalizeRole('admin')).toBe('ADMIN');
    expect(normalizeRole('')).toBe('DOCTOR');
    expect(normalizeRole(null)).toBe('DOCTOR');
    expect(normalizeRole(undefined)).toBe('DOCTOR');
    expect(normalizeRole('REGISTRAR')).toBe('DOCTOR');
  });

  it('角色集合覆盖后端 5 个枚举', () => {
    expect([...CANONICAL_ROLES].sort()).toEqual(
      ['ADMIN', 'DIRECTOR', 'DOCTOR', 'NURSE', 'TECHNICIAN'],
    );
  });

  it('rolesMatch 中文与英文混合比较均可命中', () => {
    const adminAllowed = ['管理员'];
    const doctorAllowed = ['医生', '主任', '管理员'];
    expect(rolesMatch('ADMIN', adminAllowed)).toBe(true);
    expect(rolesMatch('管理员', adminAllowed)).toBe(true);
    expect(rolesMatch('DOCTOR', doctorAllowed)).toBe(true);
    expect(rolesMatch('医生', doctorAllowed)).toBe(true);
    expect(rolesMatch('TECHNICIAN', doctorAllowed)).toBe(false);
    expect(rolesMatch(null, undefined)).toBe(true);
    expect(rolesMatch(null, adminAllowed)).toBe(false);
  });

  it('isAdmin/isDoctor/isTechnician 语义与 useAuth 一致', () => {
    expect(isCanonicalAdmin('管理员')).toBe(true);
    expect(isCanonicalAdmin('ADMIN')).toBe(true);
    expect(isCanonicalAdmin('DOCTOR')).toBe(false);

    expect(isCanonicalDoctor('医生')).toBe(true);
    expect(isCanonicalDoctor('DOCTOR')).toBe(true);
    expect(isCanonicalDoctor('主任')).toBe(true);
    expect(isCanonicalDoctor('DIRECTOR')).toBe(true);
    expect(isCanonicalDoctor('技师')).toBe(false);

    expect(isCanonicalTechnician('技师')).toBe(true);
    expect(isCanonicalTechnician('TECHNICIAN')).toBe(true);
    expect(isCanonicalTechnician('医生')).toBe(false);
  });

  it('roleLabel 输出中文展示名', () => {
    expect(roleLabel('ADMIN')).toBe('管理员');
    expect(roleLabel('管理员')).toBe('管理员');
    expect(roleLabel('')).toBe('');
  });
});
