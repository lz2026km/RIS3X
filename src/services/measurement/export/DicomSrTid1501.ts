// ============================================================
// G005 放射RIS系统 v3.0.6.5 - DICOM SR TID 1501 (Procedure Log)
// Phase R11 W5: 导出操作流程日志(操作员 / 工具 / 时间戳)
// 20 升级点:日志条目 / 操作员 / 工具 / 时间 / 关联 SOP
// ============================================================

import type {
  DicomSrDocument,
  DicomContentSequence,
  DicomContentItem,
} from '../../../types/R3/R3.INTEGRATION';
import { buildDicomSrDataset, buildContentItem, dumpDicomSr, validateDicomSr } from '../../integration/dicomSrService';

/** TID 1501 Procedure Log 内容编码 */
const TID1501_CONCEPTS = {
  procedureLog: '121120',
  procedureStep: '121121',
  operator: '121122',
  action: '121123',
  timestamp: '121124',
  tool: '121125',
};

const PROC_LOG_TITLE = 'Procedure Log';
const PROC_STEP_TITLE = 'Procedure Step';

/** 操作日志条目(单步) */
export interface ProcedureLogEntry {
  /** ISO 时间戳 */
  timestamp: string;
  /** 操作员(医师 / 技师) */
  operator: string;
  /** 操作类型 */
  action: 'create' | 'update' | 'delete' | 'measure' | 'annotate' | 'export' | 'view' | 'sign';
  /** 使用工具(可选) */
  tool?: string;
  /** 操作描述 */
  description: string;
  /** 关联 SOP Instance(可选) */
  sopInstanceUID?: string;
}

async function delay(ms = 50): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * 将单条日志转成 DICOM Content Item
 */
export function buildLogItem(entry: ProcedureLogEntry): DicomContentItem {
  const children: DicomContentItem[] = [];
  children.push(
    buildContentItem(TID1501_CONCEPTS.operator, '操作员', 'Operator', 'PNAME', { text: entry.operator }),
  );
  children.push(
    buildContentItem(TID1501_CONCEPTS.action, '操作', 'Action', 'CODE', {
      code: entry.action.toUpperCase(),
      codeMeaning: entry.action,
    }),
  );
  children.push(
    buildContentItem(TID1501_CONCEPTS.timestamp, '时间戳', 'Timestamp', 'DATETIME', { text: entry.timestamp }),
  );
  if (entry.tool) {
    children.push(
      buildContentItem(TID1501_CONCEPTS.tool, '工具', 'Tool', 'TEXT', { text: entry.tool }),
    );
  }
  if (entry.sopInstanceUID) {
    children.push(
      buildContentItem('RID3864', '引用图像', 'Referenced Image', 'IMAGE', {}),
    );
  }
  children.push(
    buildContentItem('121072', '描述', 'Description', 'TEXT', { text: entry.description }),
  );
  return {
    relationshipType: 'CONTAINS',
    conceptCode: { code: TID1501_CONCEPTS.procedureStep, codeSchemeDesignator: 'DCM', codeMeaning: PROC_STEP_TITLE, codeMeaningEn: PROC_STEP_TITLE },
    valueType: 'CONTAINER',
    children,
  };
}

/**
 * 生成完整的 TID 1501 DICOM SR 文档(Procedure Log)
 *
 * @param input.studyInstanceUID 关联研究 UID
 * @param input.seriesInstanceUID 关联系列 UID
 * @param input.entries 日志条目
 * @param input.observer 操作员
 */
export async function generateTid1501(input: {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  entries: ProcedureLogEntry[];
  observer?: string;
  patientId?: string;
  patientName?: string;
}): Promise<DicomSrDocument> {
  await delay(90);
  const ts = Date.now();
  const sopInstanceUID = `1.2.840.10008.5.1.4.1.1.88.11.${ts}.1501`;
  const seriesInstanceUID = input.seriesInstanceUID ?? `1.2.840.10008.5.1.4.1.1.2.1.${ts}.1501`;

  const items: DicomContentItem[] = input.entries.map((e) => buildLogItem(e));
  items.unshift(
    buildContentItem('111001', '过程名称', 'Procedure Name', 'TEXT', {
      text: 'G005 标注与测量过程日志',
    }),
  );

  const topLevel: DicomContentSequence = {
    conceptCode: { code: TID1501_CONCEPTS.procedureLog, codeSchemeDesignator: 'DCM', codeMeaning: PROC_LOG_TITLE, codeMeaningEn: PROC_LOG_TITLE },
    continuity: 'SEPARATE',
    items,
  };

  const dataElements = buildDicomSrDataset({
    sopInstanceUID,
    studyInstanceUID: input.studyInstanceUID,
    seriesInstanceUID,
    contentSequence: [topLevel],
    patientId: input.patientId,
    patientName: input.patientName,
    modality: 'SR',
  });

  const sr: DicomSrDocument = {
    id: sopInstanceUID,
    sopClassUID: '1.2.840.10008.5.1.4.1.1.88.11',
    sopInstanceUID,
    studyInstanceUID: input.studyInstanceUID,
    seriesInstanceUID,
    instanceNumber: 1,
    templateId: 'TID1500',
    completionFlag: 'COMPLETE',
    verificationFlag: 'VERIFIED',
    contentSequence: [topLevel],
    dataElements,
    referencedInstances: [],
    transferSyntaxUID: '1.2.840.10008.1.2.1',
    mediaStorageSOPInstanceUID: sopInstanceUID,
    generatedAt: new Date().toISOString(),
    generator: `G005-TID1501-Builder/${input.observer ?? 'doctor@g005.local'}`,
    size: 0,
    validation: { passed: true, errors: [], warnings: [] },
  };
  const text = dumpDicomSr(sr);
  sr.size = new Blob([text]).size;
  sr.validation = validateDicomSr(sr);
  return sr;
}

export const DicomSrTid1501 = {
  generateTid1501,
  buildLogItem,
};

export default DicomSrTid1501;
