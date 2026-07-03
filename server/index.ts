import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

import { authMiddleware } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// JSON 文件数据库（持久化到磁盘，无需编译）
const DB_PATH = path.join(__dirname, 'db', 'ris-db.json');
function readDB(): Record<string, unknown[]> {
  try {
    if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ exams: [], reports: [], criticalValues: [], devices: [], appointments: [], printJobs: [], deliveryRecords: [], queueCalls: [], patients: [], users: [] }), 'utf-8');
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch { return {}; }
}
function writeDB(data: Record<string, unknown[]>) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// 自动种子：DB 为空时填充 50 条检查 + 50 条报告
async function autoSeed(): Promise<void> {
  const db = readDB();
  if ((db.exams || []).length === 0) {
    const { seedData } = await import('./db/seed.js');
    const seed = seedData();
    writeDB(seed);
    console.log(`[Seed] 已填充 ${seed.exams.length} 条检查 + ${seed.reports.length} 条报告 + ${seed.patients.length} 条患者`);
  }
}
void autoSeed();

// 工具函数
function uid() { return randomUUID().slice(0, 8); }
function now() { return new Date().toISOString(); }

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5191').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));

// 健康检查 (v3.0.3.31: 必须在 authMiddleware 之前 - 否则 Docker HEALTHCHECK 失败)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0.3.31' });
});

// 认证中间件 (排除 /api/health 与 /auth/login)
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path.startsWith('/api/v1/auth/')) return next();
  return authMiddleware(req, res, next);
});

// 检查路由
app.get('/api/v1/worklist', (req, res) => {
  const db = readDB();
  const exams = (db.exams || []) as Record<string, unknown>[];
  const { status, modality, priority, search } = req.query as Record<string, string>;
  let filtered = exams;
  if (status && status !== 'all') filtered = filtered.filter((e: any) => e.status === status);
  if (modality && modality !== 'all') filtered = filtered.filter((e: any) => e.modality === modality);
  if (priority && priority !== 'all') filtered = filtered.filter((e: any) => e.priority === priority);
  if (search) filtered = filtered.filter((e: any) => (e.patientName || '').includes(search) || (e.examId || '').includes(search));
  res.json({ success: true, data: filtered, meta: { total: filtered.length } });
});

app.get('/api/v1/worklist/:id', (req, res) => {
  const db = readDB();
  const exam = (db.exams || []).find((e: any) => e.id === req.params.id);
  if (!exam) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
  res.json({ success: true, data: exam });
});

app.post('/api/v1/worklist', (req, res) => {
  const db = readDB();
  const b = req.body;
  const id = `EX-${uid()}`;
  const exam = { id, examId: b.examId || id, patientId: b.patientId, patientName: b.patientName, gender: b.gender, age: b.age, modality: b.modality, bodyPart: b.bodyPart, status: '已登记', priority: b.priority || '普通', patientType: b.patientType || '门诊', scheduledAt: b.scheduledAt, deviceId: b.deviceId, roomId: b.roomId, doctorId: b.doctorId, clinicalDiagnosis: b.clinicalDiagnosis, imagesAcquired: 0, createdAt: now(), updatedAt: now() };
  db.exams = [...(db.exams || []), exam];
  writeDB(db);
  res.status(201).json({ success: true, data: exam });
});

// 状态流转守卫 + 持久化
const EXAM_TRANSITIONS: Record<string, string[]> = { '已登记': ['待检查', '已取消'], '待检查': ['检查中', '已取消'], '检查中': ['待报告', '检查异常'], '待报告': ['已报告'], '已报告': ['已发布'] };
app.post('/api/v1/worklist/:id/checkin', transitionExam('待检查'));
app.post('/api/v1/worklist/:id/start', transitionExam('检查中'));
app.post('/api/v1/worklist/:id/complete', transitionExam('待报告'));
app.post('/api/v1/worklist/:id/cancel', transitionExam('已取消'));

function transitionExam(toStatus: string) {
  return (req: any, res: any) => {
    const db = readDB();
    const idx = (db.exams || []).findIndex((e: any) => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    const exam = (db.exams as any[])[idx];
    const allowed = EXAM_TRANSITIONS[exam.status] || [];
    if (!allowed.includes(toStatus)) return res.status(400).json({ success: false, error: { code: 'ILLEGAL_TRANSITION', message: `不允许从 ${exam.status} 转换为 ${toStatus}` } });
    (db.exams as any[])[idx] = { ...exam, status: toStatus, updatedAt: now() };
    writeDB(db);
    res.json({ success: true, data: (db.exams as any[])[idx] });
  };
}

// 报告路由
const REPORT_TRANSITIONS: Record<string, string[]> = { '待分配': ['已分配', '已驳回'], '已分配': ['书写中', '已驳回'], '书写中': ['已提交', '已驳回'], '已提交': ['初审中', '已驳回'], '初审中': ['初审通过', '已驳回'], '初审通过': ['终审中', '已驳回'], '终审中': ['已审核', '已驳回'], '已审核': ['签发中', '已驳回'], '签发中': ['已签发'], '已签发': ['已发布', '修订中'], '已发布': ['修订中'], '修订中': ['已修订'], '已修订': ['已发布'], '已驳回': ['书写中', '修订中'] };

app.get('/api/v1/reports', (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.reports || [] });
});

app.get('/api/v1/reports/:id', (req, res) => {
  const db = readDB();
  const r = (db.reports || []).find((r: any) => r.id === req.params.id || r.reportId === req.params.id);
  if (!r) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
  res.json({ success: true, data: r });
});

app.post('/api/v1/reports', (req, res) => {
  const db = readDB();
  const b = req.body;
  const id = `RPT-${uid()}`;
  const report = { id, reportId: b.reportId || id, examId: b.examId, patientId: b.patientId, patientName: b.patientName, modality: b.modality, bodyPart: b.bodyPart, status: '待分配', findings: b.findings || '', diagnosis: b.diagnosis || '', impression: b.impression || '', doctorId: b.doctorId, doctorName: b.doctorName, reportSource: b.reportSource || 'manual', createdTime: now(), updatedTime: now(), qualityScore: 0, isPositive: false, isCritical: false };
  db.reports = [...(db.reports || []), report];
  writeDB(db);
  res.status(201).json({ success: true, data: report });
});

app.put('/api/v1/reports/:id', (req, res) => {
  const db = readDB();
  const idx = (db.reports || []).findIndex((r: any) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
  const b = req.body;
  (db.reports as any[])[idx] = { ...(db.reports as any[])[idx], ...b, updatedTime: now() };
  writeDB(db);
  res.json({ success: true, data: (db.reports as any[])[idx] });
});

function transitionReport(toStatus: string, extraFields?: Record<string, unknown>) {
  return (req: any, res: any) => {
    const db = readDB();
    const idx = (db.reports || []).findIndex((r: any) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    const report = (db.reports as any[])[idx];
    const allowed = REPORT_TRANSITIONS[report.status] || [];
    if (!allowed.includes(toStatus)) return res.status(400).json({ success: false, error: { code: 'ILLEGAL_TRANSITION', message: `不允许从 ${report.status} 转换为 ${toStatus}` } });
    (db.reports as any[])[idx] = { ...report, status: toStatus, updatedTime: now(), ...extraFields };
    writeDB(db);
    res.json({ success: true, data: (db.reports as any[])[idx] });
  };
}

app.post('/api/v1/reports/:id/submit', transitionReport('已提交'));
app.post('/api/v1/reports/:id/review', (req, res) => transitionReport('已审核')(req, res));
app.post('/api/v1/reports/:id/sign', (req, res) => {
  const code = `V${Date.now().toString(36).toUpperCase()}`;
  transitionReport('已签发', { signedTime: now(), reportVerificationCode: code })(req, res);
});
app.post('/api/v1/reports/:id/publish', (req, res) => {
  transitionReport('已发布', { publishedTime: now(), publishedBy: req.body?.publishedBy || 'system' })(req, res);
});
app.post('/api/v1/reports/:id/reject', transitionReport('已驳回'));
app.post('/api/v1/reports/:id/revise', transitionReport('修订中'));

// 危急值
app.get('/api/v1/critical', (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.criticalValues || [] });
});

app.put('/api/v1/critical/:id/acknowledge', (req, res) => {
  const db = readDB();
  const idx = (db.criticalValues || []).findIndex((c: any) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
  (db.criticalValues as any[])[idx] = { ...(db.criticalValues as any[])[idx], status: 'acknowledged', acknowledgedAt: now(), updatedAt: now() };
  writeDB(db);
  res.json({ success: true, data: (db.criticalValues as any[])[idx] });
});

app.put('/api/v1/critical/:id/resolve', (req, res) => {
  const db = readDB();
  const idx = (db.criticalValues || []).findIndex((c: any) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
  (db.criticalValues as any[])[idx] = { ...(db.criticalValues as any[])[idx], status: 'resolved', resolvedAt: now(), updatedAt: now() };
  writeDB(db);
  res.json({ success: true, data: (db.criticalValues as any[])[idx] });
});

// 设备和其它路由
app.get('/api/v1/devices', (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.devices || [] });
});

app.get('/api/v1/appointments', (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.appointments || [] });
});

app.get('/api/v1/patients', (req, res) => {
  const db = readDB();
  res.json({ success: true, data: db.patients || [] });
});

// 用户 (v3.0.3.31: 修复重复路由 + 敏感字段过滤 - 删除第一个未脱敏的路由)
app.get('/api/v1/users', (req, res) => {
  const db = readDB();
  res.json({ success: true, data: (db.users || []).map((u: any) => ({ id: u.id, name: u.name, username: u.username, role: u.role, department: u.department, title: u.title })) });
});

app.get('/api/v1/stats/daily', (req, res) => {
  const db = readDB();
  const exams = (db.exams || []) as any[];
  const reports = (db.reports || []) as any[];
  const criticalValues = (db.criticalValues || []) as any[];
  res.json({ success: true, data: { totalExams: exams.length, completedExams: exams.filter((e: any) => ['已报告', '已发布'].includes(e.status)).length, pendingReports: reports.filter((r: any) => !['已发布', '已归档'].includes(r.status)).length, criticalValues: criticalValues.filter((c: any) => c.status !== 'resolved').length } });
});

app.get('/api/v1/stats/quality', (req, res) => {
  res.json({ success: true, data: { averageScore: 85, byDoctor: [], byModality: [] } });
});

app.listen(PORT, () => {
  console.log(`[Server] G005 RIS Backend v3.0.2.8 running on http://localhost:${PORT}`);
  console.log(`[Server] Database: ${DB_PATH}`);
});
