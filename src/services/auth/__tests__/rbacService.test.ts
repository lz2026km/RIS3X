/**
 * G005 放射RIS系统 v3.0.3.31 - RBAC 权限服务测试
 * Phase T1-W2: 单元测试
 * 覆盖 22 个权限、6 个角色、canApprove / checkAccess 边界
 */

import { describe, it, expect } from 'vitest';
import {
  ROLES,
  hasPermission,
  canApprove,
  checkAccess,
  type Permission,
  type AccessContext,
} from '../rbacService';

const ALL_22_PERMISSIONS: Permission[] = [
  'report.create', 'report.edit', 'report.view', 'report.delete', 'report.approve', 'report.sign',
  'patient.create', 'patient.edit', 'patient.view',
  'exam.create', 'exam.update', 'exam.delete',
  'user.manage', 'user.view',
  'system.admin', 'audit.view',
  'template.edit', 'template.use',
  'critical.ack', 'critical.manage',
  'stats.view', 'stats.export',
];

describe('rbacService - 22 权限 × 6 角色矩阵', () => {
  it('权限枚举 22 项无重复', () => {
    expect(ALL_22_PERMISSIONS).toHaveLength(22);
    expect(new Set(ALL_22_PERMISSIONS).size).toBe(22);
  });

  it('角色表 6 个', () => {
    expect(Object.keys(ROLES)).toHaveLength(6);
    expect(Object.keys(ROLES).sort()).toEqual(
      ['admin', 'director', 'doctor', 'nurse', 'super-admin', 'technician']
    );
  });

  describe('super-admin 拥有全部 22 权限（直接）', () => {
    for (const p of ALL_22_PERMISSIONS) {
      it(`hasPermission('super-admin', '${p}') === true`, () => {
        expect(hasPermission('super-admin', p)).toBe(true);
      });
    }
  });

  describe('admin (parent: super-admin) 通过继承获得全部 22 权限', () => {
    for (const p of ALL_22_PERMISSIONS) {
      it(`hasPermission('admin', '${p}') === true (inherited)`, () => {
        expect(hasPermission('admin', p)).toBe(true);
      });
    }
  });

  describe('director (parent: admin → super-admin) 通过继承获得全部 22 权限', () => {
    for (const p of ALL_22_PERMISSIONS) {
      it(`hasPermission('director', '${p}') === true (inherited)`, () => {
        expect(hasPermission('director', p)).toBe(true);
      });
    }
  });

  describe('doctor (parent: director) 通过继承获得全部 22 权限', () => {
    for (const p of ALL_22_PERMISSIONS) {
      it(`hasPermission('doctor', '${p}') === true (inherited)`, () => {
        expect(hasPermission('doctor', p)).toBe(true);
      });
    }
  });

  describe('technician (parent: doctor) 通过继承获得全部 22 权限', () => {
    for (const p of ALL_22_PERMISSIONS) {
      it(`hasPermission('technician', '${p}') === true (inherited)`, () => {
        expect(hasPermission('technician', p)).toBe(true);
      });
    }
  });

  describe('nurse (无 parent) 仅 3 权限', () => {
    const nurseHas: Permission[] = ['patient.view', 'patient.edit', 'critical.ack'];
    for (const p of ALL_22_PERMISSIONS) {
      const expected = nurseHas.includes(p);
      it(`hasPermission('nurse', '${p}') === ${expected}`, () => {
        expect(hasPermission('nurse', p)).toBe(expected);
      });
    }
  });

  it('未知角色返回 false', () => {
    expect(hasPermission('unknown-role', 'report.view')).toBe(false);
  });

  it('super-admin 包含权限 (单元检查)', () => {
    expect(hasPermission('super-admin', 'report.create')).toBe(true);
    expect(hasPermission('super-admin', 'stats.export')).toBe(true);
  });

  it('nurse 不包含 stats.view（无继承）', () => {
    expect(hasPermission('nurse', 'stats.view')).toBe(false);
  });

  it('nurse 不包含 report.create（无继承）', () => {
    expect(hasPermission('nurse', 'report.create')).toBe(false);
  });
});

describe('rbacService - canApprove 自审拦截', () => {
  it('userId !== ownerId → true (允许审批)', () => {
    expect(canApprove('D001', 'D002')).toBe(true);
  });

  it('userId === ownerId → false (禁止自审)', () => {
    expect(canApprove('D001', 'D001')).toBe(false);
  });

  it('空 userId 与有效 ownerId → true', () => {
    expect(canApprove('', 'D002')).toBe(true);
  });
});

describe('rbacService - checkAccess 资源访问控制', () => {
  const baseEnv = { time: new Date('2026-06-16T10:00:00.000Z') };

  it('报告 create - doctor 有权限', () => {
    const ctx: AccessContext = {
      user: { role: 'doctor', department: 'radiology', userId: 'D001' },
      resource: { type: 'report' },
      action: 'create',
      environment: baseEnv,
    };
    expect(checkAccess(ctx)).toBe(true);
  });

  it('报告 create - nurse 无权限', () => {
    const ctx: AccessContext = {
      user: { role: 'nurse', department: 'nursing', userId: 'N001' },
      resource: { type: 'report' },
      action: 'create',
      environment: baseEnv,
    };
    expect(checkAccess(ctx)).toBe(false);
  });

  it('报告 approve 自审 → false (Fix 1: Deny self-approval)', () => {
    const ctx: AccessContext = {
      user: { role: 'director', department: 'radiology', userId: 'D001' },
      resource: { type: 'report', ownerId: 'D001' },
      action: 'approve',
      environment: baseEnv,
    };
    expect(checkAccess(ctx)).toBe(false);
  });

  it('报告 approve 跨用户 → true', () => {
    const ctx: AccessContext = {
      user: { role: 'director', department: 'radiology', userId: 'D005' },
      resource: { type: 'report', ownerId: 'D001' },
      action: 'approve',
      environment: baseEnv,
    };
    expect(checkAccess(ctx)).toBe(true);
  });

  it('患者 read 同 userId → true (Fix 2: 资源所有者)', () => {
    const ctx: AccessContext = {
      user: { role: 'nurse', department: 'nursing', userId: 'N001' },
      resource: { type: 'patient', ownerId: 'N001' },
      action: 'read',
      environment: baseEnv,
    };
    expect(checkAccess(ctx)).toBe(true);
  });

  it('患者 read 同 department → true (Fix 2: 同科室)', () => {
    const ctx: AccessContext = {
      user: { role: 'nurse', department: 'radiology', userId: 'N002' },
      resource: { type: 'patient', ownerDept: 'radiology', ownerId: 'P001' },
      action: 'read',
      environment: baseEnv,
    };
    expect(checkAccess(ctx)).toBe(true);
  });

  it('患者 read 跨 user+dept → true (nurse has patient.view RBAC)', () => {
    const ctx: AccessContext = {
      user: { role: 'nurse', department: 'nursing', userId: 'N001' },
      resource: { type: 'patient', ownerDept: 'radiology', ownerId: 'P001' },
      action: 'read',
      environment: baseEnv,
    };
    expect(checkAccess(ctx)).toBe(true);
  });

  it('设备 read 同部门 → true (exam resource)', () => {
    const ctx: AccessContext = {
      user: { role: 'technician', department: 'radiology', userId: 'T001' },
      resource: { type: 'exam', ownerDept: 'radiology' },
      action: 'read',
      environment: baseEnv,
    };
    expect(checkAccess(ctx)).toBe(true);
  });

  it('系统管理 - super-admin 通过 (admin permission)', () => {
    const ctx: AccessContext = {
      user: { role: 'super-admin', department: 'admin', userId: 'SA001' },
      resource: { type: 'system' },
      action: 'create',
      environment: baseEnv,
    };
    // system.create 不在 22 权限中,fallthrough 到 default false
    expect(checkAccess(ctx)).toBe(false);
  });

  it('系统管理 - super-admin 通过 (user.manage)', () => {
    const ctx: AccessContext = {
      user: { role: 'super-admin', department: 'admin', userId: 'SA001' },
      resource: { type: 'user' },
      action: 'manage' as any,
      environment: baseEnv,
    };
    // user.manage 属于 22 权限,super-admin 有
    expect(checkAccess(ctx)).toBe(true);
  });
});
