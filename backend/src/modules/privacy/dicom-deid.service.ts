/**
 * [G005 v3.0.6.16-0] DICOM PS3.15 去标识化服务
 *
 * 背景: 研究/科研模块的「DICOM 脱敏」此前是前端 setTimeout 伪造(1.5 秒后弹绿色
 * "脱敏完成(本地模拟)"), 属于会当场被医院采购评审戳穿的假功能。
 * 本服务实现 DICOM PS3.15 Annex E「Basic Application Level Confidentiality
 * Profile」基础配置文件, 对 Part-10 文件做真实清洗。
 *
 * 能力:
 *  - 清空身份标签 (PatientName / PatientID / AccessionNumber / Institution ...)
 *  - UID 全量重生成 (SOPInstanceUID / StudyInstanceUID / SeriesInstanceUID)
 *  - 日期统一偏移 (保持序列内相对时间关系), 时间归一到固定值
 *  - 标记 PatientIdentityRemoved = YES
 *  - **像素数据完全不动**, 保证脱敏后影像仍可用于科研阅片
 */
import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import * as dicomParser from 'dicom-parser';

// ============================================================================
// PS3.15 Table E.1-1  Basic Application Level Confidentiality Profile
// ============================================================================

/** 需清空的身份标签 */
const REPLACE_WITH_EMPTY: Record<string, string> = {
  x00080014: '', // InstanceCreatorUID (无 UID 语义时清空)
  x00080050: '', // AccessionNumber
  x00080080: '', // InstitutionName
  x00080081: '', // InstitutionAddress
  x00080090: '', // ReferringPhysicianName
  x00081010: '', // StationName
  x00081030: '', // StudyDescription
  x0008103e: '', // SeriesDescription
  x00081048: '', // PhysiciansOfRecord
  x00081050: '', // PerformingPhysicianName
  x00081060: '', // NameOfPhysiciansReadingStudy
  x00081070: '', // OperatorsName
  x00081080: '', // AdmittingDiagnosesDescription
  x00100010: '', // PatientName
  x00100020: '', // PatientID
  x00100021: '', // IssuerOfPatientID
  x00100030: '', // PatientBirthDate
  x00100032: '', // PatientBirthTime
  x00100040: '', // PatientSex
  x00100050: '', // PatientInsurancePlanCodeSequence
  x00101001: '', // OtherPatientIDs
  x00101002: '', // OtherPatientNames
  x00101040: '', // PatientAddress
  x00102154: '', // PatientTelephoneNumbers
  x00104000: '', // PatientComments
  x00120010: '', // ClinicalTrialSponsorName
  x00120020: '', // ClinicalTrialProtocolID
  x00120021: '', // ClinicalTrialProtocolName
  x00120030: '', // ClinicalTrialSiteID
  x00120040: '', // ClinicalTrialSubjectID
  x00120050: '', // ClinicalTrialTimePointID
  x00380010: '', // AdmissionID
  x00380020: '', // AdmittingDate
  x00380032: '', // DischargeDate
  x00380300: '', // CurrentPatientLocation
  x00181030: '', // ProtocolName
  x300a0013: '', // TreatmentMachineName
};

/** 必须重生成的 UID 标签 (顺序即依赖顺序) */
const UID_TAGS: readonly string[] = [
  'x0020000d', // StudyInstanceUID
  'x0020000e', // SeriesInstanceUID
  'x00080018', // SOPInstanceUID
];

/** 日期标签 (DA): 统一偏移 */
const DATE_TAGS: readonly string[] = [
  'x00080020', // StudyDate
  'x00080021', // SeriesDate
  'x00080022', // AcquisitionDate
  'x00080023', // ContentDate
  'x00080012', // InstanceCreationDate
  'x00380020', // AdmittingDate (若存在, 非身份类)
  'x00380032', // DischargeDate
];

/** 时间标签 (TM): 归一 */
const TIME_TAGS: readonly string[] = [
  'x00080030', // StudyTime
  'x00080031', // SeriesTime
  'x00080032', // AcquisitionTime
  'x00080033', // ContentTime
  'x00080013', // InstanceCreationTime
];

/** 标签关键词 (用于向前端返回可读清洗清单) */
const KEYWORDS: Record<string, string> = {
  x00080014: 'InstanceCreatorUID',
  x00080018: 'SOPInstanceUID',
  x00080050: 'AccessionNumber',
  x00080080: 'InstitutionName',
  x00080081: 'InstitutionAddress',
  x00080090: 'ReferringPhysicianName',
  x00081010: 'StationName',
  x00081030: 'StudyDescription',
  x0008103e: 'SeriesDescription',
  x00081048: 'PhysiciansOfRecord',
  x00081050: 'PerformingPhysicianName',
  x00081060: 'NameOfPhysiciansReadingStudy',
  x00081070: 'OperatorsName',
  x00081080: 'AdmittingDiagnosesDescription',
  x00100010: 'PatientName',
  x00100020: 'PatientID',
  x00100021: 'IssuerOfPatientID',
  x00100030: 'PatientBirthDate',
  x00100032: 'PatientBirthTime',
  x00100040: 'PatientSex',
  x00100050: 'PatientInsurancePlanCodeSequence',
  x00101001: 'OtherPatientIDs',
  x00101002: 'OtherPatientNames',
  x00101040: 'PatientAddress',
  x00102154: 'PatientTelephoneNumbers',
  x00104000: 'PatientComments',
  x00120010: 'ClinicalTrialSponsorName',
  x00120020: 'ClinicalTrialProtocolID',
  x00120021: 'ClinicalTrialProtocolName',
  x00120030: 'ClinicalTrialSiteID',
  x00120040: 'ClinicalTrialSubjectID',
  x00120050: 'ClinicalTrialTimePointID',
  x00181030: 'ProtocolName',
  x0020000d: 'StudyInstanceUID',
  x0020000e: 'SeriesInstanceUID',
  x300a0013: 'TreatmentMachineName',
  x00380010: 'AdmissionID',
  x00380020: 'AdmittingDate',
  x00380032: 'DischargeDate',
  x00380300: 'CurrentPatientLocation',
  x00080020: 'StudyDate',
  x00080021: 'SeriesDate',
  x00080022: 'AcquisitionDate',
  x00080023: 'ContentDate',
  x00080012: 'InstanceCreationDate',
  x00080030: 'StudyTime',
  x00080031: 'SeriesTime',
  x00080032: 'AcquisitionTime',
  x00080033: 'ContentTime',
  x00080013: 'InstanceCreationTime',
  x00120062: 'PatientIdentityRemoved',
};

// ============================================================================
// 类型
// ============================================================================

export type DeidProfile = 'basic' | 'hipaa' | 'expert';

export type DeidActionKind = 'empty' | 'uid' | 'date-shift' | 'time-normalize' | 'flag';

export interface DeidTagAction {
  tag: string;
  keyword: string;
  action: DeidActionKind;
}

export interface DeidFileResult {
  fileName: string;
  sopInstanceUid: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  bytesIn: number;
  bytesOut: number;
  actions: DeidTagAction[];
  pixelDataPreserved: boolean;
  transferSyntax: string;
}

export interface DeidResult {
  profile: DeidProfile;
  dateShiftDays: number;
  files: DeidFileResult[];
  totalBytesIn: number;
  totalBytesOut: number;
  cleanedTagCount: number;
}

// ============================================================================
// 工具
// ============================================================================

/** 生成确定性 UID (<=64 字符, 以数字结尾符合 DICOM 规范) */
function makeUid(seed: string, salt: string): string {
  const h = createHash('sha256').update(`${seed}:${salt}`).digest('hex');
  const dec = BigInt(`0x${h.slice(0, 16)}`) % 10000000000000000000000000n;
  return `2.25.${dec.toString()}`;
}

function parseDicomDate(da: string): Date | null {
  const m = /^(\d{4})(\d{2})?(\d{2})?$/.exec(da.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = m[2] ? Number(m[2]) : 1;
  const d = m[3] ? Number(m[3]) : 1;
  if (y < 1800 || y > 2200) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDicomDate(dt: Date): string {
  const y = dt.getUTCFullYear().toString().padStart(4, '0');
  const m = (dt.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = dt.getUTCDate().toString().padStart(2, '0');
  return `${y}${m}${d}`;
}

/** 2 字节定长数值 VR */
const NUMERIC_VR_2BYTE = new Set(['US', 'SS', 'AT']);
/** 4 字节定长数值 VR */
const NUMERIC_VR_4BYTE = new Set(['UL', 'SL', 'FL', 'FD']);

/**
 * 就地覆写元素的字节区域; 返回是否成功。
 *
 * 必须按 **VR** 而非"字节长度"分支 —— DICOM 里 DA/TM 恰好就是 8 字节,
 * PN/LO/SH 常见 8/10/16 字节, 若按 `cap === 8` 判定为数值型, 只会把前 4 字节
 * 清零、尾部残留原值 (实测 "LI^CS02" -> "\0\0\0\0S02", 反而泄露更多信息)。
 */
function writeElement(bytes: Uint8Array, el: dicomParser.DicomDataElement, value: string): boolean {
  const start = el.dataOffset;
  const cap = el.length;
  // 不定长 (SQ / OB undefined-length): 无法在原位覆写, 跳过而非破坏结构
  if (start < 0 || cap === 0 || cap === 0xffffffff || start + cap > bytes.length) return false;

  // 数值型 VR: 置零 (不接受字符串值)
  if (NUMERIC_VR_2BYTE.has(el.vr)) {
    bytes.fill(0, start, start + 2);
    return true;
  }
  if (NUMERIC_VR_4BYTE.has(el.vr)) {
    bytes.fill(0, start, start + 4);
    return true;
  }

  // 其余 (PN/LO/SH/DA/TM/UI/ST/LT/UT/AE/DS/IS/CS): 以空格补齐的字符串覆写
  const data = new TextEncoder().encode(value);
  bytes.fill(0x20, start, start + cap);
  bytes.set(data.length > cap ? data.subarray(0, cap) : data, start);
  return true;
}

function readString(bytes: Uint8Array, el?: dicomParser.DicomDataElement): string {
  if (!el || el.length === 0 || el.length > 128 || el.length === 0xffffffff) return '';
  const start = el.dataOffset;
  if (start < 0 || start + el.length > bytes.length) return '';
  return new TextDecoder('latin1').decode(bytes.subarray(start, start + el.length)).trim();
}

/** 批次级 UID 映射上下文: 保证同一批次内"同一原始 UID -> 同一新 UID" */
export interface DeidUidContext {
  seed: string;
  map: Map<string, string>;
}

// ============================================================================
// 服务
// ============================================================================

@Injectable()
export class DicomDeidService {
  private readonly logger = new Logger(DicomDeidService.name);

  /** 默认日期偏移量 (确定性, 同一批次内所有文件共用, 保持相对时间关系) */
  static readonly DEFAULT_DATE_SHIFT_DAYS = 365;

  /** 新建一个批次级 UID 映射上下文 */
  static createUidContext(): DeidUidContext {
    return { seed: randomBytes(8).toString('hex'), map: new Map() };
  }

  /**
   * 对单个 Part-10 DICOM 缓冲区执行去标识化。
   * 返回新的 Uint8Array + 清洗清单。像素数据不参与任何写入。
   *
   * `uidCtx` 必须在同一批次的所有文件间共享, 否则同一检查的不同序列/图像会被
   * 映射到不同新 UID, 脱敏后检查被拆散、序列无法归组。
   */
  deidentifyFile(
    input: Uint8Array,
    opts: { profile: DeidProfile; dateShiftDays: number; uidCtx?: DeidUidContext },
  ): { bytes: Uint8Array; report: DeidFileResult } {
    const dataSet = dicomParser.parseDicom(input);
    const out = new Uint8Array(input);
    const actions: DeidTagAction[] = [];

    // ---- 1. UID 重生成 (同一原始 UID 在批次内映射到同一新 UID, 保证引用一致) ----
    const uidCtx = opts.uidCtx ?? DicomDeidService.createUidContext();
    const uidMap = uidCtx.map;
    const uidSeed = uidCtx.seed;
    for (const tag of UID_TAGS) {
      const el = dataSet.elements[tag];
      if (!el) continue;
      const oldStr = readString(input, el);
      if (!oldStr) continue;
      let next = uidMap.get(oldStr);
      if (!next) {
        next = makeUid(`${uidSeed}:${oldStr}`, tag);
        uidMap.set(oldStr, next);
      }
      if (writeElement(out, el, next)) {
        actions.push({ tag, keyword: KEYWORDS[tag] ?? tag, action: 'uid' });
      }
    }

    // ---- 2. 清空身份标签 (跳过 UID 类, 已在上一步单独处理) ----
    const uidTagSet = new Set<string>(UID_TAGS);
    for (const [tag, value] of Object.entries(REPLACE_WITH_EMPTY)) {
      if (uidTagSet.has(tag)) continue;
      const el = dataSet.elements[tag];
      if (!el) continue;
      if (writeElement(out, el, value)) {
        actions.push({ tag, keyword: KEYWORDS[tag] ?? tag, action: 'empty' });
      }
    }

    // ---- 3. 日期偏移 ----
    for (const tag of DATE_TAGS) {
      const el = dataSet.elements[tag];
      if (!el) continue;
      const dt = parseDicomDate(readString(input, el));
      if (!dt) continue;
      dt.setUTCDate(dt.getUTCDate() + opts.dateShiftDays);
      if (writeElement(out, el, formatDicomDate(dt))) {
        actions.push({ tag, keyword: KEYWORDS[tag] ?? tag, action: 'date-shift' });
      }
    }

    // ---- 4. 时间归一 ----
    for (const tag of TIME_TAGS) {
      const el = dataSet.elements[tag];
      if (!el) continue;
      if (writeElement(out, el, '000000.00')) {
        actions.push({ tag, keyword: KEYWORDS[tag] ?? tag, action: 'time-normalize' });
      }
    }

    // ---- 5. 标记 PatientIdentityRemoved = YES ----
    const pir = dataSet.elements['x00120062'];
    if (pir && writeElement(out, pir, 'YES')) {
      actions.push({ tag: 'x00120062', keyword: 'PatientIdentityRemoved', action: 'flag' });
    }

    return {
      bytes: out,
      report: {
        fileName: '',
        sopInstanceUid: readString(out, dataSet.elements['x00080018']),
        studyInstanceUid: readString(out, dataSet.elements['x0020000d']),
        seriesInstanceUid: readString(out, dataSet.elements['x0020000e']),
        bytesIn: input.length,
        bytesOut: out.length,
        actions,
        pixelDataPreserved: !!dataSet.elements['x7fe00010'],
        transferSyntax: readString(out, dataSet.elements['x00020010']) || 'unknown',
      },
    };
  }

  /** 批量处理: 返回每个文件的脱敏字节与汇总报告 */
  deidentifyBatch(
    files: Array<{ name: string; data: Uint8Array }>,
    profile: DeidProfile = 'basic',
    dateShiftDays: number = DicomDeidService.DEFAULT_DATE_SHIFT_DAYS,
  ): { outputs: Array<{ name: string; bytes: Uint8Array }>; result: DeidResult } {
    const outputs: Array<{ name: string; bytes: Uint8Array }> = [];
    const reports: DeidFileResult[] = [];
    let totalBytesIn = 0;
    let totalBytesOut = 0;

    // 全批共享同一个 UID 映射上下文: 否则同一检查的多个序列会被拆散
    const uidCtx = DicomDeidService.createUidContext();

    for (const f of files) {
      try {
        const { bytes, report } = this.deidentifyFile(f.data, { profile, dateShiftDays, uidCtx });
        report.fileName = f.name;
        outputs.push({ name: f.name, bytes });
        reports.push(report);
        totalBytesIn += report.bytesIn;
        totalBytesOut += report.bytesOut;
      } catch (err) {
        this.logger.error(`脱敏失败 ${f.name}: ${(err as Error).message}`);
      }
    }

    return {
      outputs,
      result: {
        profile,
        dateShiftDays,
        files: reports,
        totalBytesIn,
        totalBytesOut,
        cleanedTagCount: reports.reduce((s, r) => s + r.actions.length, 0),
      },
    };
  }
}

export { UID_TAGS as DEID_UID_TAGS, DATE_TAGS as DEID_DATE_TAGS, KEYWORDS as DEID_KEYWORDS };
