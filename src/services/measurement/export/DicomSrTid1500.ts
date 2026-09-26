// ============================================================
// G005 放射RIS系统 v3.0.6.5 - DICOM SR TID 1500 (Imaging Measurement Report)
// Phase R11 W5: 完整导出 RECIST/WHO 测量报告,符合 DICOM PS 3.3 TID 1500
// 40 升级点:容器 / 分组 / 测量项 / 参考图像 / 编码映射
// ============================================================

import type {
  DicomSrDocument,
  DicomContentSequence,
  DicomContentItem,
  DicomDataElement,
} from '../../../types/R3/R3.INTEGRATION';
import type { TrackedLesion, LesionSnapshot } from '../../../types/measurement';
import { buildDicomSrDataset, buildContentItem, dumpDicomSr, validateDicomSr } from '../../integration/dicomSrService';
import { applyDeIdentify } from '../../integration/dicomDeId';
import type { DeIdentifyConfig } from '../../../types/measurement';

/** TID 1500 Imaging Measurement Report 核心概念编码 */
const TID1500_CONCEPTS = {
  report: '126000',
  imagingMeasGroup: '125007',
  finding: '121071',
  lesionTracker: 'RID38913',
  trackingId: '112040',
  longDiameter: 'RID3924',
  shortDiameter: 'RID3925',
  response: 'RID4944',
  crCode: 'RID3900',
  prCode: 'RID3901',
  sdCode: 'RID3902',
  pdCode: 'RID3903',
  neCode: 'RID3904',
};

const REPORT_TITLE = 'Imaging Measurement Report';
const GROUP_TITLE = 'Measurement Group';
const TRACKING_ID_TITLE = 'Tracking ID';
const LONG_AXIS_TITLE = 'Long Axis';
const SHORT_AXIS_TITLE = 'Short Axis';
const RESPONSE_TITLE = 'Response';

const RESPONSE_TO_CODE: Record<string, string> = {
  CR: TID1500_CONCEPTS.crCode,
  PR: TID1500_CONCEPTS.prCode,
  SD: TID1500_CONCEPTS.sdCode,
  PD: TID1500_CONCEPTS.pdCode,
  NE: TID1500_CONCEPTS.neCode,
};

const RESPONSE_TO_MEANING: Record<string, string> = {
  CR: '完全缓解',
  PR: '部分缓解',
  SD: '疾病稳定',
  PD: '疾病进展',
  NE: '无法评估',
};

async function delay(ms = 60): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * 为单个病灶的快照构造测量项条目
 *
 * @param snapshot 病灶快照(单次研究)
 * @param lesion   病灶元数据(含 ID / 标签)
 */
export function buildLesionMeasurementItems(snapshot: LesionSnapshot, lesion: TrackedLesion): DicomContentItem[] {
  const items: DicomContentItem[] = [];
  // 病灶追踪 ID
  items.push(
    buildContentItem(TID1500_CONCEPTS.trackingId, '病灶追踪 ID', TRACKING_ID_TITLE, 'TEXT', {
      text: lesion.id,
    }),
  );
  // 病灶位置文本
  const locationText = [lesion.location.organ, lesion.location.subStructure].filter(Boolean).join(' ');
  if (locationText) {
    items.push(
      buildContentItem('RID3877', '解剖位置', 'Anatomic Location', 'TEXT', {
        text: locationText,
      }),
    );
  }
  // 长径
  items.push(
    buildContentItem(TID1500_CONCEPTS.longDiameter, '长径', LONG_AXIS_TITLE, 'NUM', {
      num: snapshot.longDiameter,
      unit: 'mm',
    }),
  );
  // 短径(可选)
  if (snapshot.shortDiameter !== undefined) {
    items.push(
      buildContentItem(TID1500_CONCEPTS.shortDiameter, '短径', SHORT_AXIS_TITLE, 'NUM', {
        num: snapshot.shortDiameter,
        unit: 'mm',
      }),
    );
  }
  // 体积(可选)
  if (snapshot.volume !== undefined) {
    items.push(
      buildContentItem('RID3843', '体积', 'Volume', 'NUM', {
        num: snapshot.volume,
        unit: 'mm3',
      }),
    );
  }
  // 平均 HU
  if (snapshot.meanHU !== undefined) {
    items.push(
      buildContentItem('RID3838', '平均 CT 值', 'Mean CT Value', 'NUM', {
        num: snapshot.meanHU,
        unit: 'HU',
      }),
    );
  }
  // 反应评估
  if (snapshot.response) {
    items.push(
      buildContentItem(TID1500_CONCEPTS.response, '反应评估', RESPONSE_TITLE, 'CODE', {
        code: RESPONSE_TO_CODE[snapshot.response] ?? TID1500_CONCEPTS.neCode,
        codeMeaning: RESPONSE_TO_MEANING[snapshot.response] ?? '无法评估',
      }),
    );
  }
  return items;
}

/**
 * 为单次研究构造测量分组容器(TID 1500:Imaging Measurement Group)
 *
 * @param lesions  本研究中包含的病灶
 * @param studyUID 研究 UID
 * @param _seriesUID 系列 UID(预留,用于引用)
 * @param acquisitionDate 获取日期
 */
export function buildMeasurementGroup(
  lesions: TrackedLesion[],
  studyUID: string,
  _seriesUID: string,
  acquisitionDate: string,
): DicomContentSequence {
  const items: DicomContentItem[] = [];
  // 引用图像
  items.push(
    buildContentItem('RID3864', '引用图像', 'Referenced Image', 'IMAGE', {}),
  );
  // 每个病灶一个子容器
  for (const lesion of lesions) {
    const snapshot = lesion.snapshots.find((s) => s.studyInstanceUID === studyUID);
    if (!snapshot) continue;
    items.push({
      relationshipType: 'CONTAINS',
      conceptCode: { code: '121071', codeSchemeDesignator: 'DCM', codeMeaning: '病灶', codeMeaningEn: 'Finding' },
      valueType: 'CONTAINER',
      children: buildLesionMeasurementItems(snapshot, lesion),
    });
  }
  // 研究日期
  items.push(
    buildContentItem('111060', '研究日期', 'Study Date', 'DATE', { text: acquisitionDate }),
  );
  return {
    conceptCode: { code: TID1500_CONCEPTS.imagingMeasGroup, codeSchemeDesignator: 'DCM', codeMeaning: GROUP_TITLE, codeMeaningEn: GROUP_TITLE },
    continuity: 'SEPARATE',
    items,
  };
}

/**
 * 生成完整的 TID 1500 DICOM SR 文档(Imaging Measurement Report)
 *
 * @param input.lesions 待导出的病灶(通常按患者筛选)
 * @param input.patientId 患者 ID
 * @param input.patientName 患者姓名
 * @param input.observer 评估医师
 * @param input.deIdentifyConfig 去标识化配置(可选)
 */
export async function generateTid1500(input: {
  lesions: TrackedLesion[];
  patientId?: string;
  patientName?: string;
  patientBirthDate?: string;
  observer?: string;
  deIdentifyConfig?: DeIdentifyConfig;
}): Promise<DicomSrDocument> {
  await delay(120);
  const ts = Date.now();
  const sopInstanceUID = `1.2.840.10008.5.1.4.1.1.88.11.${ts}.1500`;
  const seriesInstanceUID = `1.2.840.10008.5.1.4.1.1.2.1.${ts}.1500`;
  const studyInstanceUID = input.lesions[0]?.snapshots[0]?.studyInstanceUID
    ?? `1.2.840.10008.5.1.4.1.1.2.1.${ts}`;

  // 按 study 分组
  const byStudy = new Map<string, TrackedLesion[]>();
  for (const lesion of input.lesions) {
    for (const snap of lesion.snapshots) {
      const list = byStudy.get(snap.studyInstanceUID) ?? [];
      list.push(lesion);
      byStudy.set(snap.studyInstanceUID, list);
    }
  }

  const measurementGroups: DicomContentSequence[] = [];
  const referencedInstances: DicomSrDocument['referencedInstances'] = [];
  for (const [studyUid, studyLesions] of byStudy) {
    const firstSnap = studyLesions
      .flatMap((l) => l.snapshots)
      .find((s) => s.studyInstanceUID === studyUid);
    if (!firstSnap) continue;
    measurementGroups.push(
      buildMeasurementGroup(studyLesions, studyUid, firstSnap.seriesInstanceUID ?? seriesInstanceUID, firstSnap.acquisitionDate),
    );
    if (firstSnap.sopInstanceUID) {
      referencedInstances.push({
        sopClassUID: '1.2.840.10008.5.1.4.1.1.2.1',
        sopInstanceUID: firstSnap.sopInstanceUID,
        purpose: 'Source image for measurements',
      });
    }
  }

  const topLevel: DicomContentSequence = {
    conceptCode: { code: TID1500_CONCEPTS.report, codeSchemeDesignator: 'DCM', codeMeaning: REPORT_TITLE, codeMeaningEn: REPORT_TITLE },
    continuity: 'SEPARATE',
    items: measurementGroups.flatMap((g) => g.items),
  };

  // 构造 dataset
  let dataElements = buildDicomSrDataset({
    sopInstanceUID,
    studyInstanceUID,
    seriesInstanceUID,
    contentSequence: [topLevel],
    patientId: input.patientId,
    patientName: input.patientName,
    patientBirthDate: input.patientBirthDate,
    modality: 'SR',
  });

  // 可选去标识化
  if (input.deIdentifyConfig) {
    dataElements = applyDeIdentify(dataElements, input.deIdentifyConfig);
  }

  const sr: DicomSrDocument = {
    id: sopInstanceUID,
    sopClassUID: '1.2.840.10008.5.1.4.1.1.88.11',
    sopInstanceUID,
    studyInstanceUID,
    seriesInstanceUID,
    instanceNumber: 1,
    templateId: 'TID1500',
    completionFlag: 'COMPLETE',
    verificationFlag: 'VERIFIED',
    contentSequence: [topLevel],
    dataElements,
    referencedInstances,
    transferSyntaxUID: '1.2.840.10008.1.2.1',
    mediaStorageSOPInstanceUID: sopInstanceUID,
    generatedAt: new Date().toISOString(),
    generator: `G005-TID1500-Builder/${input.observer ?? 'doctor@g005.local'}`,
    size: 0,
    validation: { passed: true, errors: [], warnings: [] },
  };

  const text = dumpDicomSr(sr);
  sr.size = new Blob([text]).size;
  sr.validation = validateDicomSr(sr);
  return sr;
}

/**
 * 内部工具:从 dataset 元素取值(辅助)
 */
export function getElementValue(elements: DicomDataElement[], tag: string): string | number | string[] | number[] | undefined {
  return elements.find((e) => e.tag === tag)?.value;
}

/** 工具:为给定的 tag 列表快速构造 dataset 子集 */
export function subsetByTags(elements: DicomDataElement[], tags: string[]): DicomDataElement[] {
  return elements.filter((e) => tags.includes(e.tag));
}

export const DicomSrTid1500 = {
  generateTid1500,
  buildLesionMeasurementItems,
  buildMeasurementGroup,
  getElementValue,
  subsetByTags,
};

export default DicomSrTid1500;
