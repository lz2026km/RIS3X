/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1B - 国标 13 类危急值诊断字典 + 内存 overlay
 *
 * 孤儿/内存 overlay 模式 (不修改 prisma schema):
 *   - 国标 13 类危急值诊断字典 NATIONAL_CRITICAL_DIAGNOSES (编码 + 名称 + 是否国标 + 关键字)。
 *   - 危急值记录补充字段 notifiedAt / notifiedBy / receivedBy / receiveNote 走内存 overlay,
 *     DB 可用时与 CriticalValue 既有列 (voiceCalledAt/voiceCalledBy/confirmedBy/confirmedComment) 合并复用。
 *   - 确定性 seed: 无真实记录时回退内置示例 (发现→通报时间差固定, 保证 10 分钟边界可测)。
 */

/** 国标危急值诊断字典项 */
export interface NationalCriticalDiagnosis {
  /** 字典编码 */
  code: string
  /** 诊断名称 */
  name: string
  /** 系统分类 */
  category: string
  /** 是否国标 13 类 */
  isNational: boolean
  /** 描述匹配关键字 (用于将危急值描述归入国标类别) */
  keywords: string[]
}

/**
 * 国标 13 类危急值诊断字典。
 * 说明: 急性主动脉夹层 (DeBakey I·II 型) 与急性主动脉瘤破裂同属急性主动脉综合征,
 * 合并为一个国标类别 (名称同时包含两种表述, 便于描述匹配)。
 */
export const NATIONAL_CRITICAL_DIAGNOSES: NationalCriticalDiagnosis[] = [
  {
    code: 'GW-01',
    name: '急性肺栓塞',
    category: '胸部',
    isNational: true,
    keywords: ['急性肺栓塞', '肺栓塞', '肺动脉栓塞', '肺动脉充盈缺损'],
  },
  {
    code: 'GW-02',
    name: '急性主动脉夹层 (DeBakey I·II 型)/急性主动脉瘤破裂',
    category: '心血管',
    isNational: true,
    keywords: ['急性主动脉夹层', '主动脉夹层', 'DeBakey', '内膜片', '主动脉瘤破裂', '主动脉破裂'],
  },
  {
    code: 'GW-03',
    name: '心包填塞',
    category: '心血管',
    isNational: true,
    keywords: ['心包填塞', '心脏压塞', '大量心包积液'],
  },
  {
    code: 'GW-04',
    name: '大量液·血·气胸',
    category: '胸部',
    isNational: true,
    keywords: ['大量气胸', '张力性气胸', '血气胸', '液气胸', '大量胸腔积液'],
  },
  {
    code: 'GW-05',
    name: '气管·支气管异物',
    category: '呼吸',
    isNational: true,
    keywords: ['气管异物', '支气管异物', '气道异物', '气管支气管异物'],
  },
  {
    code: 'GW-06',
    name: '急性脑梗死',
    category: '神经',
    isNational: true,
    keywords: ['急性脑梗死', '脑梗死', '脑梗塞', '缺血性卒中', 'DWI 高信号'],
  },
  {
    code: 'GW-07',
    name: '急性脑出血',
    category: '神经',
    isNational: true,
    keywords: ['急性脑出血', '脑出血', '脑内血肿', '脑实质出血'],
  },
  {
    code: 'GW-08',
    name: '急性硬膜外·硬膜下出血',
    category: '神经',
    isNational: true,
    keywords: ['硬膜外血肿', '硬膜下血肿', '硬膜外出血', '硬膜下出血'],
  },
  {
    code: 'GW-09',
    name: '急性蛛网膜下腔出血',
    category: '神经',
    isNational: true,
    keywords: ['急性蛛网膜下腔出血', '蛛网膜下腔出血', '脑沟高密度'],
  },
  {
    code: 'GW-10',
    name: '脑疝',
    category: '神经',
    isNational: true,
    keywords: ['脑疝', '中线结构移位', '中线移位'],
  },
  {
    code: 'GW-11',
    name: '消化道穿孔',
    category: '腹部',
    isNational: true,
    keywords: ['消化道穿孔', '胃肠穿孔', '膈下游离气体'],
  },
  {
    code: 'GW-12',
    name: '腹腔内脏器破裂出血',
    category: '腹部',
    isNational: true,
    keywords: ['腹腔内脏器破裂', '脏器破裂', '肝破裂', '脾破裂', '肾破裂', '腹腔积血', '腹腔出血'],
  },
  {
    code: 'GW-13',
    name: '绞窄性肠梗阻',
    category: '腹部',
    isNational: true,
    keywords: ['绞窄性肠梗阻', '肠壁积气', '肠系膜缺血', '绞窄性'],
  },
]

/** 国标 13 类危急值类别数 */
export const NATIONAL_CRITICAL_COUNT = NATIONAL_CRITICAL_DIAGNOSES.length

/** 国标口径 10 分钟通报时限 (分钟) */
export const NATIONAL_NOTIFY_DEADLINE_MIN = 10

const NATIONAL_CODE_SET = new Set(NATIONAL_CRITICAL_DIAGNOSES.map((d) => d.code))

/** 判断编码是否属于国标 13 类 */
export function isNationalDiagnosisCode(code?: string): boolean {
  return !!code && NATIONAL_CODE_SET.has(code)
}

/** 按描述匹配国标危急值诊断 (确定性: 按字典顺序, 命中名称或关键字) */
export function matchNationalDiagnosis(description?: string): NationalCriticalDiagnosis | undefined {
  if (!description) return undefined
  for (const diagnosis of NATIONAL_CRITICAL_DIAGNOSES) {
    if (description === diagnosis.name) return diagnosis
    for (const keyword of diagnosis.keywords) {
      if (description.includes(keyword)) return diagnosis
    }
  }
  return undefined
}

/**
 * 危急值记录补充字段 (内存 overlay)。
 * notifiedAt/notifiedBy/receivedBy/receiveNote 无对应 DB 列, 走内存回退。
 */
export interface CriticalRqiOverlayRecord {
  criticalId: string
  diagnosisCode?: string
  diagnosisName?: string
  patientId?: string
  patientName?: string
  /** 发现时间 (默认取 CriticalValue.createdAt) */
  foundAt?: string
  /** 通报时间 (5 步流程「通知」步骤写入) */
  notifiedAt?: string
  /** 通报人 */
  notifiedBy?: string
  /** 接收人 */
  receivedBy?: string
  /** 接收记录 */
  receiveNote?: string
}

/** 危急值 RQI 补充字段内存 overlay: criticalId → 记录 */
export const criticalRqiOverlay = new Map<string, CriticalRqiOverlayRecord>()

/** 写入/合并危急值补充字段 (内存 overlay 回退) */
export function recordCriticalNotification(
  criticalId: string,
  patch: Partial<Omit<CriticalRqiOverlayRecord, 'criticalId'>>,
): CriticalRqiOverlayRecord {
  const prev = criticalRqiOverlay.get(criticalId) ?? { criticalId }
  const next: CriticalRqiOverlayRecord = { ...prev, ...patch, criticalId }
  criticalRqiOverlay.set(criticalId, next)
  return next
}

/** 读取危急值补充字段 */
export function getCriticalNotificationOverlay(criticalId: string): CriticalRqiOverlayRecord | undefined {
  return criticalRqiOverlay.get(criticalId)
}

/** 计算发现→通报耗时 (分钟, 保留 1 位); 无通报时间返回 undefined */
export function notifyMinutes(foundAt?: string, notifiedAt?: string): number | undefined {
  if (!foundAt || !notifiedAt) return undefined
  const diff = (new Date(notifiedAt).getTime() - new Date(foundAt).getTime()) / 60000
  return Number.isFinite(diff) ? Math.round(diff * 10) / 10 : undefined
}

/**
 * 确定性 seed: 国标危急值记录示例 (无真实记录时回退)。
 * 通报时间差固定 (含 =10min 边界), 保证 RQI 统计与边界测试确定性。
 */
export function seedRqiRecords(now: number = Date.now()): CriticalRqiOverlayRecord[] {
  const iso = (offsetMin: number) => new Date(now - offsetMin * 60_000).toISOString()
  return [
    {
      criticalId: 'cv-rqi-seed-1',
      diagnosisCode: 'GW-06',
      diagnosisName: '急性脑梗死',
      patientId: 'RAD-P001',
      patientName: '张伟',
      foundAt: iso(40),
      notifiedAt: iso(30),
      notifiedBy: '李技师',
      receivedBy: '王医生',
      receiveNote: '已收治神经内科',
    },
    {
      criticalId: 'cv-rqi-seed-2',
      diagnosisCode: 'GW-07',
      diagnosisName: '急性脑出血',
      patientId: 'RAD-P002',
      patientName: '李明',
      foundAt: iso(25),
      notifiedAt: iso(18),
      notifiedBy: '李技师',
      receivedBy: '王医生',
      receiveNote: '',
    },
    {
      criticalId: 'cv-rqi-seed-3',
      diagnosisCode: 'GW-01',
      diagnosisName: '急性肺栓塞',
      patientId: 'RAD-P003',
      patientName: '赵敏',
      foundAt: iso(60),
      notifiedAt: iso(54),
      notifiedBy: '张技师',
      receivedBy: '',
      receiveNote: '',
    },
    {
      criticalId: 'cv-rqi-seed-4',
      diagnosisCode: 'GW-13',
      diagnosisName: '绞窄性肠梗阻',
      patientId: 'RAD-P004',
      patientName: '周婷',
      foundAt: iso(90),
      notifiedAt: iso(74),
      notifiedBy: '张技师',
      receivedBy: '赵医生',
      receiveNote: '已急诊手术',
    },
    {
      criticalId: 'cv-rqi-seed-5',
      diagnosisCode: 'GW-03',
      diagnosisName: '心包填塞',
      patientId: 'RAD-P005',
      patientName: '吴强',
      foundAt: iso(120),
      notifiedBy: '',
      receivedBy: '',
      receiveNote: '',
    },
  ]
}
