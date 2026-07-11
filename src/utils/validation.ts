/**
 * Zod Validation Schemas
 * G005 Radiology RIS System
 * S2: Input validation for all forms
 */
import { z } from 'zod';

// ========== User Schemas ==========
export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, '姓名至少2个字符').max(20, '姓名最多20个字符'),
  username: z.string().min(3, '用户名至少3个字符').max(30, '用户名最多30个字符'),
  role: z.enum(['医生', '技师', '护士', '管理员', '主任']),
  department: z.string().min(1, '科室不能为空'),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  title: z.string().optional(),
  specialty: z.string().optional(),
});

export type UserInput = z.infer<typeof UserSchema>;

// Login schema (no password field in frontend)
export const LoginSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符'),
  password: z.string().min(6, '密码至少6个字符'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ========== Patient Schemas ==========
export const PatientSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, '姓名至少2个字符').max(20, '姓名最多20个字符'),
  gender: z.enum(['男', '女', '其他']),
  age: z.number().int().min(0, '年龄不能为负').max(150, '年龄超出范围'),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  idCard: z.string().regex(/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/, '身份证号格式不正确'),
  address: z.string().max(200, '地址最多200个字符').optional(),
  emergencyContact: z.string().max(50, '紧急联系人最多50个字符').optional(),
  emergencyPhone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式不正确').optional(),
  patientType: z.enum(['门诊', '住院', '体检', '急诊']),
  allergyHistory: z.string().max(500, '过敏史最多500个字符').optional(),
  medicalHistory: z.string().max(1000, '病史最多1000个字符').optional(),
});

export type PatientInput = z.infer<typeof PatientSchema>;

// ========== Exam/Report Schemas ==========
export const ExamSchema = z.object({
  patientId: z.string(),
  patientName: z.string().min(2, '患者姓名至少2个字符'),
  gender: z.enum(['男', '女', '其他']),
  age: z.number().int().min(0).max(150),
  patientType: z.enum(['门诊', '住院', '体检', '急诊']),
  examItemId: z.string().uuid(),
  examItemName: z.string().min(1, '检查项目不能为空'),
  modality: z.enum(['CT', 'MR', 'DR', 'DSA', 'CR', 'MG', 'RF', 'US', 'PET-CT', 'SPECT', 'GI']),
  bodyPart: z.enum(['头颅', '颈部', '胸部', '腹部', '盆腔', '脊柱', '四肢', '心脏', '血管', '全身']),
  examDate: z.string().datetime({ offset: true }),
  priority: z.enum(['普通', '紧急', '危重', '会诊']),
  clinicalDiagnosis: z.string().max(500).optional(),
  clinicalHistory: z.string().max(1000).optional(),
  examIndications: z.string().max(500).optional(),
});

export type ExamInput = z.infer<typeof ExamSchema>;

// ========== Report Schemas ==========
export const ReportSchema = z.object({
  examId: z.string(),
  examFindings: z.string().min(10, '检查所见至少10个字符').max(5000, '内容超出限制'),
  diagnosis: z.string().min(2, '诊断意见至少2个字符').max(2000, '内容超出限制'),
  impression: z.string().max(1000, '印象超出限制').optional(),
  recommendations: z.string().max(500, '建议超出限制').optional(),
  comparisonWithPrior: z.string().max(1000).optional(),
  criticalFinding: z.boolean().default(false),
  criticalFindingDetails: z.string().max(500).optional(),
  isPreliminary: z.boolean().default(false),
  isAddendum: z.boolean().default(false),
});

export type ReportInput = z.infer<typeof ReportSchema>;

// ========== Radiology Exam Schema ==========
export const RadiologyExamSchema = z.object({
  id: z.string().uuid().optional(),
  patientId: z.string(),
  patientName: z.string(),
  gender: z.enum(['男', '女', '其他']),
  age: z.number(),
  patientType: z.enum(['门诊', '住院', '体检', '急诊']),
  examItemId: z.string(),
  examItemName: z.string(),
  modality: z.enum(['CT', 'MR', 'DR', 'DSA', 'CR', 'MG', 'RF', 'US', 'PET-CT', 'SPECT', 'GI']),
  bodyPart: z.enum(['头颅', '颈部', '胸部', '腹部', '盆腔', '脊柱', '四肢', '心脏', '血管', '全身']),
  examDate: z.string(),
  priority: z.enum(['普通', '紧急', '危重', '会诊']),
  clinicalDiagnosis: z.string().optional(),
  clinicalHistory: z.string().optional(),
  examIndications: z.string().optional(),
  status: z.enum(['待登记', '已登记', '待检查', '检查中', '待报告', '已报告', '已发布', '已取消', '检查异常']),
});

export type RadiologyExamInput = z.infer<typeof RadiologyExamSchema>;

// ========== Validation Helper Functions ==========
export function validateFormData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.errors.map((err: { path: (string|number)[]; message: string }) => `${err.path.join('.')}: ${err.message}`);
  return { success: false, errors };
}

/**
 * Sanitize and validate string input
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>"'&]/g, '');
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * Validate ID card number
 */
export function validateIdCard(idCard: string): boolean {
  return /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard);
}