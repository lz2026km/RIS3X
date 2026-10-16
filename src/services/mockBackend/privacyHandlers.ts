// [G005 v3.0.6.16-0] 隐私 / DICOM 去标识化 MSW handler
//
// 演示环境(mock)下让「研究/科研 - DICOM 脱敏」可完整走通 UI 流程。
// 注意: 真实去标识化在**后端** backend/src/modules/privacy 完成, 这里只是
// 前端演示兜底 —— 返回结构与真实端点完全一致, 便于真实/演示双环境对拍。
import { http, HttpResponse, delay } from 'msw';

const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1');

const ok = (data: unknown) => HttpResponse.json({ success: true, data });
const bad = (message: string, status = 400) =>
  HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message } }, { status });

/** 确定性散列, 保证同一文件每次演示得到一致结果 */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const PROFILES = [
  {
    id: 'basic',
    label: '基础配置文件',
    description: '清空身份标签 / 重生成 UID / 日期偏移 / 时间归一; 保留影像描述字段',
  },
  {
    id: 'hipaa',
    label: 'HIPAA 安全港',
    description: '在基础之上额外清空检查/序列描述, 不保留任何可能含姓名的自由文本',
  },
  {
    id: 'expert',
    label: '专家判定(保守)',
    description: '额外清空协议名/治疗设备名等, 临床可用性下降, 需人工复核',
  },
] as const;

const ACTION_PLAN: Array<{ tag: string; keyword: string; action: 'empty' | 'uid' | 'date-shift' | 'time-normalize' | 'flag' }> = [
  { tag: 'x0020000d', keyword: 'StudyInstanceUID', action: 'uid' },
  { tag: 'x0020000e', keyword: 'SeriesInstanceUID', action: 'uid' },
  { tag: 'x00080018', keyword: 'SOPInstanceUID', action: 'uid' },
  { tag: 'x00080050', keyword: 'AccessionNumber', action: 'empty' },
  { tag: 'x00080080', keyword: 'InstitutionName', action: 'empty' },
  { tag: 'x00080090', keyword: 'ReferringPhysicianName', action: 'empty' },
  { tag: 'x00081030', keyword: 'StudyDescription', action: 'empty' },
  { tag: 'x0008103e', keyword: 'SeriesDescription', action: 'empty' },
  { tag: 'x00081050', keyword: 'PerformingPhysicianName', action: 'empty' },
  { tag: 'x00100010', keyword: 'PatientName', action: 'empty' },
  { tag: 'x00100020', keyword: 'PatientID', action: 'empty' },
  { tag: 'x00100030', keyword: 'PatientBirthDate', action: 'empty' },
  { tag: 'x00100040', keyword: 'PatientSex', action: 'empty' },
  { tag: 'x00080020', keyword: 'StudyDate', action: 'date-shift' },
  { tag: 'x00080021', keyword: 'SeriesDate', action: 'date-shift' },
  { tag: 'x00080030', keyword: 'StudyTime', action: 'time-normalize' },
  { tag: 'x00120062', keyword: 'PatientIdentityRemoved', action: 'flag' },
];

/** 演示态: 不真正改写像素, 原样回传, 保证"下载后仍是可打开的 DICOM" */
function passthrough(dataBase64: string): string {
  return dataBase64;
}

export const privacyHandlers = [
  // GET /privacy/de-identify/profile — 能力说明 (含免责声明)
  http.get(`${API_BASE}/privacy/de-identify/profile`, async () => {
    await delay(80);
    return ok({
      standard: 'DICOM PS3.15 Annex E - Basic Application Level Confidentiality Profile',
      profiles: PROFILES,
      guarantees: [
        '像素数据 (PixelData) 逐字节不变, 脱敏后影像仍可用于阅片与科研统计',
        '文件在原位覆写, 字节长度不变, DICOM 结构不被破坏',
        '批次内同一检查的序列/图像共享同一新 StudyInstanceUID/SeriesInstanceUID',
        'SOPInstanceUID 逐文件唯一',
      ],
      limitations: [
        '不支持 Clean Pixel Data(烧录在像素里的文字需另行处理)',
        '不支持 Clean Structured Content / Clean Descriptors',
        '私标签 (奇数组号) 不在基础配置范围内, 建议导出前人工抽查',
      ],
      defaultDateShiftDays: 365,
    });
  }),

  // POST /privacy/de-identify — 批量脱敏
  http.post(`${API_BASE}/privacy/de-identify`, async ({ request }) => {
    await delay(600);
    let body: { profile?: string; dateShiftDays?: number; files?: Array<{ name?: string; dataBase64?: string }> };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return bad('请求体不是合法 JSON');
    }
    const files = body?.files ?? [];
    if (files.length === 0) return bad('未提供待脱敏文件');
    if (files.length > 200) return bad('单次最多脱敏 200 个文件, 请分批提交', 400);

    const dateShiftDays = Number.isFinite(body.dateShiftDays)
      ? Math.trunc(Number(body.dateShiftDays))
      : 365;

    // 批次级: 同一"检查"共享同一新 UID (用第一个文件的哈希做种子)
    const firstFile = files[0];
    const batchSeed = hashStr(firstFile?.dataBase64?.slice(0, 256) ?? firstFile?.name ?? '');
    const MOD = 10000000000000000000; // < Number.MAX_SAFE_INTEGER, 避免 bigint 混算
    const studyUid = `2.25.${batchSeed % MOD}`;
    const seriesUid = `2.25.${(batchSeed + 7919) % MOD}`;

    const reports = files.map((f, i) => {
      const h = hashStr(f.dataBase64 ?? f.name ?? String(i));
      return {
        fileName: f.name ?? `instance-${i + 1}.dcm`,
        sopInstanceUid: `2.25.${(h + i * 104729) % MOD}`,
        studyInstanceUid: studyUid,
        seriesInstanceUid: seriesUid,
        bytesIn: Math.floor((f.dataBase64?.length ?? 0) * 0.75),
        bytesOut: Math.floor((f.dataBase64?.length ?? 0) * 0.75),
        actions: ACTION_PLAN,
        pixelDataPreserved: true,
        transferSyntax: '1.2.840.10008.1.2.1',
      };
    });

    return ok({
      result: {
        profile: body.profile ?? 'basic',
        dateShiftDays,
        files: reports,
        totalBytesIn: reports.reduce((s, r) => s + r.bytesIn, 0),
        totalBytesOut: reports.reduce((s, r) => s + r.bytesOut, 0),
        cleanedTagCount: reports.reduce((s, r) => s + r.actions.length, 0),
      },
      files: files.map((f, i) => ({
        name: reports[i]?.fileName ?? f.name ?? `instance-${i + 1}.dcm`,
        dataBase64: passthrough(f.dataBase64 ?? ''),
      })),
    });
  }),
];
