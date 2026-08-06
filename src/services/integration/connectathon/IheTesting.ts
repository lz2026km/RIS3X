/**
 * G005 放射RIS系统 v3.0.6.0 - IHE Connectathon 测试框架
 * 20 升级点:测试用例执行 / 步骤断言 / 报告导出 / 评分
 *      XDS / PIX / PDQ / ATNA / PAM Profile 测试
 */

import type { IheTestCase, IheTestStep, IheTestStatus, IheConnectathonSession, IheProfileId, IheTestCategory } from '../../../types/integration';

let session: IheConnectathonSession | null = null;

function genId(prefix: string): string { return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`; }

function makeStep(id: string, description: string, status: IheTestStatus = 'pending', durationMs = 0): IheTestStep {
  return { id, description, status, durationMs };
}

function evaluateAssertion(actual: string | undefined, expected: string | undefined, op: 'eq' | 'ne' | 'contains' | 'exists' | 'regex' | 'gt' | 'lt'): boolean {
  if (op === 'exists') return !!actual;
  if (actual === undefined) return false;
  if (op === 'eq') return actual === expected;
  if (op === 'ne') return actual !== expected;
  if (op === 'contains') return expected !== undefined && actual.includes(expected);
  if (op === 'regex') return expected !== undefined && new RegExp(expected).test(actual);
  if (op === 'gt' || op === 'lt') {
    const a = Number(actual); const e = Number(expected ?? '0');
    if (isNaN(a) || isNaN(e)) return false;
    return op === 'gt' ? a > e : a < e;
  }
  return false;
}

// ============================================================
// 1. 会话管理
// ============================================================
export function startSession(opts: { name: string; venue: string; track: string; monitor: string; profiles: IheProfileId[]; systemUnderTest: { id: string; name: string; vendor: string; version: string } }): IheConnectathonSession {
  session = {
    id: genId('conn'),
    name: opts.name, venue: opts.venue, track: opts.track, monitor: opts.monitor,
    startedAt: new Date().toISOString(),
    status: 'planning',
    profiles: opts.profiles,
    testCases: [],
    passCount: 0, failCount: 0, warnCount: 0, skipCount: 0, totalCount: 0,
    systemUnderTest: opts.systemUnderTest,
  };
  return session;
}

export function getSession(): IheConnectathonSession | null { return session; }
export function endSession(): IheConnectathonSession | null {
  if (!session) return null;
  session.status = 'completed';
  session.finishedAt = new Date().toISOString();
  return session;
}

// ============================================================
// 2. 测试用例模板
// ============================================================
export function createTestCase(opts: {
  profile: IheProfileId;
  category: IheTestCategory;
  actor: string;
  role: IheTestCase['role'];
  title: string;
  titleEn: string;
  description: string;
  precondition?: string[];
  postcondition?: string[];
}): IheTestCase {
  return {
    id: genId('tc'),
    profile: opts.profile, category: opts.category, actor: opts.actor, role: opts.role,
    title: opts.title, titleEn: opts.titleEn, description: opts.description,
    precondition: opts.precondition ?? [],
    postcondition: opts.postcondition ?? [],
    steps: [],
    status: 'pending', durationMs: 0,
  };
}

export function addStep(testCase: IheTestCase, description: string): IheTestStep {
  const step = makeStep(genId('step'), description, 'pending', 0);
  testCase.steps.push(step);
  return step;
}

// ============================================================
// 3. 执行测试
// ============================================================
export async function runTestCase(testCase: IheTestCase, runner: (step: IheTestStep) => Promise<{ message?: string; expected?: string; actual?: string; status: IheTestStatus }>): Promise<IheTestCase> {
  testCase.status = 'running';
  testCase.startedAt = new Date().toISOString();
  const start = Date.now();
  for (const step of testCase.steps) {
    if (step.status === 'pass' || step.status === 'fail') continue;
    try {
      const r = await runner(step);
      step.actual = r.actual;
      step.expected = r.expected;
      step.message = r.message;
      step.status = r.status;
    } catch (err) {
      step.status = 'fail';
      step.message = err instanceof Error ? err.message : String(err);
    }
  }
  testCase.durationMs = Date.now() - start;
  testCase.finishedAt = new Date().toISOString();
  // 汇总
  const fails = testCase.steps.filter((s) => s.status === 'fail').length;
  const warns = testCase.steps.filter((s) => s.status === 'warning').length;
  const skips = testCase.steps.filter((s) => s.status === 'skip').length;
  const passes = testCase.steps.filter((s) => s.status === 'pass').length;
  if (fails > 0) testCase.status = 'fail';
  else if (skips === testCase.steps.length) testCase.status = 'skip';
  else if (warns > 0) testCase.status = 'warning';
  else if (passes > 0) testCase.status = 'pass';
  else testCase.status = 'pending';
  if (session) {
    const idx = session.testCases.findIndex((t) => t.id === testCase.id);
    if (idx >= 0) session.testCases[idx] = testCase;
    else session.testCases.push(testCase);
    recount();
  }
  return testCase;
}

export async function runSession(tests: IheTestCase[], runner: (step: IheTestStep) => Promise<{ message?: string; expected?: string; actual?: string; status: IheTestStatus }>): Promise<IheConnectathonSession> {
  if (!session) throw new Error('请先调用 startSession');
  session.status = 'running';
  for (const tc of tests) {
    await runTestCase(tc, runner);
  }
  return session;
}

function recount(): void {
  if (!session) return;
  session.totalCount = session.testCases.length;
  session.passCount = session.testCases.filter((t) => t.status === 'pass').length;
  session.failCount = session.testCases.filter((t) => t.status === 'fail').length;
  session.warnCount = session.testCases.filter((t) => t.status === 'warning').length;
  session.skipCount = session.testCases.filter((t) => t.status === 'skip').length;
}

// ============================================================
// 4. 报告导出
// ============================================================
export function exportReport(s: IheConnectathonSession, format: 'json' | 'summary' | 'kat' = 'json'): string {
  if (format === 'json') return JSON.stringify(s, null, 2);
  if (format === 'summary') {
    return [
      `# IHE Connectathon Report`,
      `Session: ${s.name}`,
      `Venue: ${s.venue}`,
      `Track: ${s.track}`,
      `Started: ${s.startedAt}`,
      `Status: ${s.status}`,
      ``,
      `Summary: ${s.passCount}/${s.totalCount} passed, ${s.failCount} failed, ${s.warnCount} warnings, ${s.skipCount} skipped`,
      ``,
      ...s.testCases.map((t) => `  - [${t.status.toUpperCase()}] ${t.titleEn} (${t.profile})`),
    ].join('\n');
  }
  // KAT 格式(简化)
  return s.testCases.map((t) => `${t.profile}|${t.role}|${t.status}|${t.durationMs}ms|${t.steps.length}steps`).join('\n');
}

// ============================================================
// 5. 预置测试用例(示例)
// ============================================================
export function presetXdsTestCases(): IheTestCase[] {
  return [
    createTestCase({
      profile: 'XDS.b', category: 'XDS', actor: 'Document Source', role: 'source',
      title: '提供并注册文档', titleEn: 'Provide and Register Document Set-b',
      description: '验证文档能够成功注册到 Registry 并返回成功响应',
      precondition: ['已配置 affinity domain', '已配置 repositoryUniqueId', '已配置 sourceId'],
      postcondition: ['Registry 应存储 DocumentEntry 与 SubmissionSet', 'Repository 存储文档二进制'],
    }),
    createTestCase({
      profile: 'XDS.b', category: 'XDS', actor: 'Document Consumer', role: 'consumer',
      title: '存储查询', titleEn: 'Stored Query (ITI-18)',
      description: '按患者 ID 查询已注册文档',
      precondition: ['至少存在 1 个已注册文档', '配置 RegistryStoredQuery'],
      postcondition: ['返回所有匹配文档条目'],
    }),
    createTestCase({
      profile: 'XDS.b', category: 'XDS', actor: 'Document Consumer', role: 'consumer',
      title: '检索文档', titleEn: 'Retrieve Document Set (ITI-43)',
      description: '从 Repository 拉取文档二进制',
      precondition: ['存在 entryUUID'],
      postcondition: ['成功返回 multipart 响应'],
    }),
  ];
}

export function presetPixTestCases(): IheTestCase[] {
  return [
    createTestCase({
      profile: 'PIX', category: 'PIX', actor: 'PIX Source', role: 'source-pix',
      title: '患者标识符提交', titleEn: 'Patient Identity Feed (ITI-8)',
      description: '提交患者多域标识符',
      precondition: ['配置 PIX Manager', '已知 assigningAuthority'],
      postcondition: ['PIX 存储交叉引用'],
    }),
    createTestCase({
      profile: 'PIX', category: 'PIX', actor: 'PIX Consumer', role: 'consumer-pix',
      title: 'PIX 查询', titleEn: 'PIX Query (ITI-9)',
      description: '按源域 + 患者 ID 查询目标域标识符',
      precondition: ['存在已注册交叉引用'],
      postcondition: ['返回所有目标域标识符'],
    }),
  ];
}

export function presetPdqvTestCases(): IheTestCase[] {
  return [
    createTestCase({
      profile: 'PDQ', category: 'PDQ', actor: 'PDQ Supplier', role: 'supplier',
      title: 'PDQ 查询', titleEn: 'PDQ Query (ITI-21)',
      description: '按姓名/出生日期等条件查询患者人口学',
      precondition: ['存在匹配患者记录'],
      postcondition: ['返回符合条件且 confidence>0.9 的患者'],
    }),
  ];
}

export function presetAtnaTestCases(): IheTestCase[] {
  return [
    createTestCase({
      profile: 'ATNA', category: 'ATNA', actor: 'ATNA Secure Node', role: 'source',
      title: '审计事件记录', titleEn: 'Record Audit Event (ITI-20)',
      description: 'SYSLOG RFC5424 格式审计消息',
      precondition: ['已配置 Audit Repository', '已认证节点'],
      postcondition: ['Audit Repository 返回 200 OK'],
    }),
  ];
}

export function presetPamTestCases(): IheTestCase[] {
  return [
    createTestCase({
      profile: 'PAM', category: 'PAM', actor: 'Patient Source', role: 'source',
      title: 'ADT A01 入院登记', titleEn: 'ADT^A01 - Admit/visit notification',
      description: '发送 ADT^A01 通知患者入院',
      precondition: ['已配置 ADT 接收方', '存在 patientId'],
      postcondition: ['接收方返回 AA ACK'],
    }),
  ];
}

export { evaluateAssertion };
