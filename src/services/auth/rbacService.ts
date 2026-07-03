import { mfaService } from '../security/mfa/MfaService';

export type Permission =
  | 'report.create' | 'report.edit' | 'report.view' | 'report.delete' | 'report.approve' | 'report.sign' | 'report.publish'
  | 'patient.create' | 'patient.edit' | 'patient.view'
  | 'exam.create' | 'exam.update' | 'exam.delete' | 'exam.view'
  | 'user.manage' | 'user.view' | 'user.create' | 'user.update' | 'user.delete'
  | 'system.admin' | 'audit.view' | 'audit.approve'
  | 'template.edit' | 'template.use'
  | 'critical.ack' | 'critical.manage'
  | 'stats.view' | 'stats.export'
  | 'mfa.required' | 'mfa.enroll' | 'mfa.bypass';

export type ResourceType = 'report' | 'patient' | 'exam' | 'user' | 'template' | 'critical' | 'stats' | 'system';

export type MfaStatus = 'not-required' | 'required' | 'verified' | 'failed';

export interface Role {
  id: string;
  name: string;
  parent?: string;
  permissions: Permission[];
  description: string;
}

/** 敏感操作 (需要 MFA) 列表 */
export const SENSITIVE_OPERATIONS: ReadonlySet<string> = new Set([
  'report.sign', 'report.publish', 'report.delete',
  'patient.delete',
  'user.create', 'user.delete', 'user.update',
  'system.admin',
  'audit.approve',
  'phi.bulk-export',
  'config.change',
  'mfa.required', 'mfa.bypass',
  'key.rotate', 'key.compromise',
  'compliance.audit', 'compliance.override',
]);

export const ROLES: Record<string, Role> = {
  'super-admin': { id: 'super-admin', name: '超级管理员', permissions: ['report.create', 'report.edit', 'report.view', 'report.delete', 'report.approve', 'report.sign', 'report.publish', 'patient.create', 'patient.edit', 'patient.view', 'exam.create', 'exam.update', 'exam.delete', 'user.manage', 'user.view', 'user.create', 'user.update', 'user.delete', 'system.admin', 'audit.view', 'audit.approve', 'template.edit', 'template.use', 'critical.ack', 'critical.manage', 'stats.view', 'stats.export', 'mfa.required', 'mfa.enroll', 'mfa.bypass'], description: '全部权限' },
  'admin': { id: 'admin', name: '管理员', parent: 'super-admin', permissions: ['user.manage', 'user.create', 'user.update', 'user.delete', 'system.admin', 'stats.view', 'audit.view', 'audit.approve', 'mfa.required', 'mfa.enroll'], description: '系统管理' },
  'director': { id: 'director', name: '科主任', parent: 'admin', permissions: ['report.approve', 'report.sign', 'report.view', 'report.publish', 'stats.view', 'stats.export', 'template.edit', 'critical.manage', 'audit.approve'], description: '审核/统计' },
  'doctor': { id: 'doctor', name: '诊断医师', parent: 'director', permissions: ['report.create', 'report.edit', 'report.view', 'patient.view', 'exam.view', 'template.use', 'critical.ack'], description: '写报告' },
  'technician': { id: 'technician', name: '技师', parent: 'doctor', permissions: ['exam.create', 'exam.update', 'patient.view', 'exam.view'], description: '检查操作' },
  'nurse': { id: 'nurse', name: '护士', permissions: ['patient.view', 'patient.edit', 'critical.ack'], description: '护理/通知' },
};

export function hasPermission(userRole: string, requiredPermission: Permission): boolean {
  const role = ROLES[userRole];
  if (!role) return false;
  if (role.permissions.includes('*' as any)) return true;
  if (role.permissions.includes(requiredPermission)) return true;
  if (role.parent) return hasPermission(role.parent, requiredPermission);
  return false;
}

export interface AccessContext {
  user: { role: string; department: string; userId: string; };
  resource: { type: ResourceType; ownerDept?: string; ownerId?: string; };
  action: 'create' | 'read' | 'update' | 'delete' | 'approve';
  environment: { time: Date; location?: string; };
  /** MFA 是否已通过 (可选, 用于敏感操作) */
  mfaVerified?: boolean;
}

export interface AccessResult {
  allowed: boolean;
  mfaRequired: boolean;
  mfaStatus: MfaStatus;
  reason?: string;
}

export function canApprove(userId: string, resourceOwnerId: string): boolean {
  return userId !== resourceOwnerId;
}

/** 检测当前操作是否属于敏感操作 (需要 MFA) */
export function isSensitiveOperation(action: string, resourceType: ResourceType): boolean {
  return SENSITIVE_OPERATIONS.has(`${resourceType}.${action}`)
      || SENSITIVE_OPERATIONS.has(action);
}

/**
 * 增强版访问控制: 检查 RBAC + MFA 要求
 * - 敏感操作必须 MFA 已通过
 * - 自审禁止
 * - 部门 / 个人级资源隔离
 */
export function checkAccess(ctx: AccessContext): boolean {
  const r = checkAccessWithMfa(ctx);
  return r.allowed;
}

export function checkAccessWithMfa(ctx: AccessContext): AccessResult {
  // Fix 1: Deny self-approval
  if (ctx.action === 'approve' && ctx.resource.ownerId && ctx.resource.ownerId === ctx.user.userId) {
    return { allowed: false, mfaRequired: false, mfaStatus: 'not-required', reason: 'self_approval_forbidden' };
  }

  // RBAC 检查
  // RBAC 检查 (action 动词到权限后缀的映射: read→view, update→edit)
  const ACTION_TO_PERM: Record<string, string> = { read: 'view', update: 'edit' };
  const permAction = ACTION_TO_PERM[ctx.action] ?? ctx.action;
  const rbacGranted = hasPermission(ctx.user.role, (ctx.resource.type + "." + permAction) as Permission);

  // Fix 2: Patient-level access control
  let patientGranted = false;
  if (!rbacGranted && ctx.resource.type === 'patient') {
    if (ctx.action === 'read') {
      if (ctx.resource.ownerId && ctx.resource.ownerId === ctx.user.userId) patientGranted = true;
      else if (ctx.resource.ownerDept && ctx.user.department === ctx.resource.ownerDept) patientGranted = true;
    }
  }

  const deptGranted = !rbacGranted && !patientGranted
    && ctx.action === 'read'
    && !!ctx.resource.ownerDept
    && ctx.user.department === ctx.resource.ownerDept;

  const allowed = rbacGranted || patientGranted || deptGranted;
  if (!allowed) return { allowed: false, mfaRequired: false, mfaStatus: 'not-required', reason: 'rbac_denied' };

  // MFA 检查 (仅当操作被允许 + 敏感)
  const sensitive = isSensitiveOperation(ctx.action, ctx.resource.type);
  if (!sensitive) return { allowed: true, mfaRequired: false, mfaStatus: 'not-required' };

  // 敏感操作: 调用 mfaService 判定
  const mfaEnrolled = mfaService.getEnrollment(ctx.user.userId);
  if (!mfaEnrolled?.enabled) {
    return { allowed: false, mfaRequired: true, mfaStatus: 'required', reason: 'mfa_not_enrolled' };
  }
  if (!ctx.mfaVerified) {
    return { allowed: false, mfaRequired: true, mfaStatus: 'required', reason: 'mfa_required' };
  }
  return { allowed: true, mfaRequired: true, mfaStatus: 'verified' };
}
