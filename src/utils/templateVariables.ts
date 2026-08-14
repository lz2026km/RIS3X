/**
 * G005 v3.0.6.11-98 Wave1B P0-2 — 模板变量自动填充
 * 支持 {{patientName}}/{{patientId}}/{{gender}}/{{age}}/{{modality}}/{{bodyPart}}/
 * {{accessionNumber}}/{{studyDate}}/{{priorDate}}/{{hospital}}/{{doctorName}}/{{clinicalDx}} 等。
 * 从报告上下文 (context.patient / context.exam / context 平铺字段) 填充;
 * 未知变量按配置保留原样 (keepUnresolved=true, 默认) 或替换为空。
 */

export interface TemplateVariableDef {
  key: string;
  label: string;
  /** 是否可由报告上下文自动填充 */
  auto: boolean;
}

/** 支持的变量元数据 (tooltip / 说明用) */
export const TEMPLATE_VARIABLES: TemplateVariableDef[] = [
  { key: 'patientName', label: '患者姓名', auto: true },
  { key: 'patientId', label: '患者ID', auto: true },
  { key: 'gender', label: '性别', auto: true },
  { key: 'age', label: '年龄', auto: true },
  { key: 'modality', label: '检查模态', auto: true },
  { key: 'bodyPart', label: '检查部位', auto: true },
  { key: 'accessionNumber', label: '检查号(Accession)', auto: true },
  { key: 'studyDate', label: '检查日期', auto: true },
  { key: 'priorDate', label: '老片日期(最近既往检查)', auto: true },
  { key: 'hospital', label: '医院名称', auto: true },
  { key: 'doctorName', label: '报告医生', auto: true },
  { key: 'clinicalDx', label: '临床诊断', auto: true },
  { key: 'examId', label: '检查ID', auto: true },
  { key: 'reportId', label: '报告ID', auto: true },
];

const VARIABLE_RE = /\{\{\s*([\w\u4e00-\u9fa5]+)\s*\}\}/g;

export interface VariableResolveOptions {
  /** 未知变量保留原样 (true, 默认) 或替换为空 (false) */
  keepUnresolved?: boolean;
}

/** 提取文本中的变量名列表 */
export function collectTemplateVariables(text: string): string[] {
  if (!text) return [];
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  VARIABLE_RE.lastIndex = 0;
  while ((m = VARIABLE_RE.exec(text)) !== null) {
    if (m[1] && !keys.includes(m[1])) keys.push(m[1]);
  }
  return keys;
}

/** 从报告上下文构建变量映射 (兼容 context.patient / context.exam / 平铺字段) */
export function buildVariableMap(ctx?: Record<string, unknown> | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!ctx || typeof ctx !== 'object') return map;

  const patient = (ctx.patient && typeof ctx.patient === 'object' ? ctx.patient : {}) as Record<string, unknown>;
  const exam = (ctx.exam && typeof ctx.exam === 'object' ? ctx.exam : {}) as Record<string, unknown>;
  const val = (k: string): unknown => ctx[k] ?? patient[k] ?? exam[k];

  const fmtDate = (d: unknown): string => {
    if (d == null || d === '') return '';
    const dt = new Date(String(d));
    return Number.isNaN(dt.getTime()) ? String(d) : dt.toISOString().slice(0, 10);
  };
  const put = (k: string, v: unknown) => {
    if (v != null && String(v) !== '') map[k] = String(v);
  };

  put('patientName', val('patientName') ?? val('name'));
  put('patientId', val('patientId'));
  put('gender', val('gender') ?? val('sex'));
  put('age', val('age'));
  put('modality', val('modality'));
  put('bodyPart', val('bodyPart') ?? val('bodyPartExamined'));
  put('accessionNumber', val('accessionNumber') ?? val('accessionNo'));
  put('studyDate', fmtDate(val('studyDate') ?? val('examDate') ?? val('date')));
  put('hospital', val('hospital') ?? val('hospitalName') ?? '本院');
  put('doctorName', val('doctorName') ?? val('reportDoctorName') ?? val('radiologistName'));
  put('clinicalDx', val('clinicalDiagnosis') ?? val('clinicalDx') ?? val('clinicalInfo'));
  put('examId', val('examId'));
  put('reportId', val('reportId') ?? val('id'));

  // priorDate: 优先取上下文最近既往报告日期 (priorReports 已按时间倒序由书写页维护)
  const prior = ctx.priorReports;
  if (Array.isArray(prior) && prior.length > 0) {
    const p0 = prior[0] as Record<string, unknown>;
    put('priorDate', fmtDate(p0?.studyDate ?? p0?.createdTime ?? p0?.date ?? val('priorDate')));
  } else {
    put('priorDate', fmtDate(val('priorDate')));
  }

  return map;
}

/** 解析模板/短语中的 {{变量}} — 返回替换后的文本 */
export function resolveTemplateVariables(
  text: string,
  ctx?: Record<string, unknown> | null,
  opts?: VariableResolveOptions,
): string {
  if (!text) return text;
  const keepUnresolved = opts?.keepUnresolved ?? true;
  const map = buildVariableMap(ctx);
  VARIABLE_RE.lastIndex = 0;
  return text.replace(VARIABLE_RE, (raw, key: string) => {
    const v = map[key];
    if (v !== undefined) return v;
    return keepUnresolved ? raw : '';
  });
}

/** 解析结果明细: 已填充变量 / 未填充(未知)变量 */
export function describeTemplateVariables(
  text: string,
  ctx?: Record<string, unknown> | null,
): { resolved: string[]; unresolved: string[] } {
  const map = buildVariableMap(ctx);
  const keys = collectTemplateVariables(text);
  const resolved: string[] = [];
  const unresolved: string[] = [];
  keys.forEach((k) => {
    if (map[k] !== undefined) resolved.push(k);
    else unresolved.push(k);
  });
  return { resolved, unresolved };
}

/** 变量说明 tooltip 内容 (插入时提示支持的变量) */
export function variablesTooltipTitle(vars: string[]): string {
  if (vars.length === 0) return '';
  const defs = new Map(TEMPLATE_VARIABLES.map((d) => [d.key, d]));
  const lines = vars.map((k) => {
    const d = defs.get(k);
    return d ? `{{${k}}} = ${d.label}${d.auto ? ' (自动填充)' : ''}` : `{{${k}}} (手动填写)`;
  });
  return `模板变量:\n${lines.join('\n')}`;
}
