// ============================================================
// G005 放射RIS系统 v2.1.0 - DICOMweb (WADO-RS/QIDO-RS/STOW-RS) 客户端
// Phase R10 W1: DICOM 影像检索 / 下载 / 上传
// ============================================================

export interface DicomWebConfig {
  baseUrl: string;          // e.g. 'https://server/dicomweb'
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  qidoRsEnabled?: boolean;
  wadoRsEnabled?: boolean;
  stowRsEnabled?: boolean;
}

export interface DicomStudy {
  studyInstanceUID: string;
  studyID: string;
  studyDate: string;
  studyDescription: string;
  patientID: string;
  patientName: string;
  patientSex: 'M' | 'F' | 'O';
  patientBirthDate: string;
  accessionNumber: string;
  modalitiesInStudy: string[];
  numberOfStudyRelatedSeries: number;
  numberOfStudyRelatedInstances: number;
}

export interface DicomSeries {
  seriesInstanceUID: string;
  seriesNumber: number;
  modality: string;
  seriesDescription: string;
  bodyPartExamined: string;
  sliceThickness: number;
  numberOfSeriesRelatedInstances: number;
  studyInstanceUID: string;
}

export interface DicomInstance {
  sopInstanceUID: string;
  sopClassUID: string;
  instanceNumber: number;
  seriesInstanceUID: string;
  studyInstanceUID: string;
}

// WADO-RS 客户端
export class DicomWebClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(config: DicomWebConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.headers = {
      Accept: 'application/dicom+json',
      'Content-Type': 'application/dicom+json',
    };
  }

  // QIDO-RS: 搜索研究
  async searchStudies(filter: Partial<DicomStudy> = {}): Promise<DicomStudy[]> {
    const url = new URL(`${this.baseUrl}/studies`);
    Object.entries(filter).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
    url.searchParams.set('limit', '50');
    const resp = await fetch(url.toString(), { headers: this.headers });
    if (!resp.ok) throw new Error(`QIDO-RS studies failed: ${resp.status}`);
    return resp.json();
  }

  // QIDO-RS: 搜索系列
  async searchSeries(studyInstanceUID: string): Promise<DicomSeries[]> {
    const url = `${this.baseUrl}/studies/${encodeURIComponent(studyInstanceUID)}/series`;
    const resp = await fetch(url, { headers: this.headers });
    if (!resp.ok) throw new Error(`QIDO-RS series failed: ${resp.status}`);
    return resp.json();
  }

  // QIDO-RS: 搜索实例
  async searchInstances(seriesInstanceUID: string): Promise<DicomInstance[]> {
    const url = `${this.baseUrl}/series/${encodeURIComponent(seriesInstanceUID)}/instances`;
    const resp = await fetch(url, { headers: this.headers });
    if (!resp.ok) throw new Error(`QIDO-RS instances failed: ${resp.status}`);
    return resp.json();
  }

  // WADO-RS: 获取单实例 (DICOM 字节流)
  async fetchInstance(sopInstanceUID: string, transferSyntax?: string): Promise<ArrayBuffer> {
    let url = `${this.baseUrl}/instances/${encodeURIComponent(sopInstanceUID)}`;
    if (transferSyntax) url += `?transfer-syntax=${transferSyntax}`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/dicom' },
    });
    if (!resp.ok) throw new Error(`WADO-RS instance failed: ${resp.status}`);
    return resp.arrayBuffer();
  }

  // WADO-RS: 获取单实例 (multipart/related 用于 DICOMweb frames)
  async fetchFrames(sopInstanceUID: string, frameNumbers: number[]): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/instances/${encodeURIComponent(sopInstanceUID)}/frames/${frameNumbers.join(',')}`;
    const resp = await fetch(url, {
      headers: { Accept: 'multipart/related; type="application/octet-stream"' },
    });
    if (!resp.ok) throw new Error(`WADO-RS frames failed: ${resp.status}`);
    return resp.arrayBuffer();
  }

  // WADO-RS: 渲染为 PNG（multiframe 缩略图）
  async fetchRendered(sopInstanceUID: string, frame: number = 1, viewport: { rows: number; columns: number } = { rows: 256, columns: 256 }): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/instances/${encodeURIComponent(sopInstanceUID)}/rendered?frame=${frame}&viewport=${viewport.rows},${viewport.columns}`;
    const resp = await fetch(url, { headers: { Accept: 'image/png' } });
    if (!resp.ok) throw new Error(`WADO-RS rendered failed: ${resp.status}`);
    return resp.arrayBuffer();
  }

  // STOW-RS: 上传 DICOM 文件
  async storeInstance(data: ArrayBuffer | Blob): Promise<void> {
    const url = `${this.baseUrl}/studies`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/dicom' },
      body: data,
    });
    if (!resp.ok) throw new Error(`STOW-RS store failed: ${resp.status}`);
  }
}

// 内置 DICOM 解析器（基于 dicom-parser）
export function extractDicomMetadata(dataSet: any): {
  patientName: string;
  patientId: string;
  studyDate: string;
  modality: string;
  studyDescription: string;
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  pixelSpacing: [number, number];
  sliceThickness: number;
  windowCenter: number;
  windowWidth: number;
  pixelRepresentation: number;
  rescaleSlope: number;
  rescaleIntercept: number;
} {
  const getString = (tag: string): string => {
    try { return dataSet.string(tag) || ''; } catch { return ''; }
  };
  const getNumber = (tag: string, def = 0): number => {
    try {
      const v = dataSet.string(tag);
      return v ? parseFloat(v) : def;
    } catch { return def; }
  };
  return {
    patientName: getString('x00100010'),
    patientId: getString('x00100020'),
    studyDate: getString('x00080020'),
    modality: getString('x00080060'),
    studyDescription: getString('x00081030'),
    rows: getNumber('x00280010', 512),
    columns: getNumber('x00280011', 512),
    bitsAllocated: getNumber('x00280100', 16),
    bitsStored: getNumber('x00280101', 16),
    pixelSpacing: [getNumber('x00280030', 0.5), getNumber('x00280031', 0.5)],
    sliceThickness: getNumber('x00180050', 1.0),
    windowCenter: getNumber('x00281050', 40),
    windowWidth: getNumber('x00281051', 400),
    pixelRepresentation: getNumber('x00280103', 0),
    rescaleSlope: getNumber('x00281053', 1),
    rescaleIntercept: getNumber('x00281052', 0),
  };
}

// 窗宽窗位预设
export const WINDOW_PRESETS_DETAILED: Record<string, { ww: number; wc: number; modality: string[]; description: string }> = {
  CT_SOFT_TISSUE: { ww: 400, wc: 40, modality: ['CT'], description: 'CT 软组织窗' },
  CT_LUNG:       { ww: 1500, wc: -600, modality: ['CT'], description: 'CT 肺窗' },
  CT_BONE:       { ww: 2000, wc: 400, modality: ['CT'], description: 'CT 骨窗' },
  CT_BRAIN:      { ww: 80, wc: 40, modality: ['CT'], description: 'CT 脑窗' },
  CT_LIVER:      { ww: 150, wc: 50, modality: ['CT'], description: 'CT 肝窗' },
  CT_PELVIS:     { ww: 400, wc: 40, modality: ['CT'], description: 'CT 骨盆窗' },
  CT_ANGIO:      { ww: 600, wc: 200, modality: ['CT'], description: 'CT 血管窗' },
  CT_CARDIAC:    { ww: 350, wc: 50, modality: ['CT'], description: 'CT 心脏窗' },
  CT_LIVER_CONTRAST: { ww: 200, wc: 60, modality: ['CT'], description: 'CT 肝脏增强窗' },
  CT_ORBIT:      { ww: 300, wc: 50, modality: ['CT'], description: 'CT 眼眶窗' },
  MR_T1:         { ww: 800, wc: 400, modality: ['MR'], description: 'MR T1 窗' },
  MR_T2:         { ww: 1500, wc: 750, modality: ['MR'], description: 'MR T2 窗' },
  MR_FLAIR:      { ww: 1500, wc: 750, modality: ['MR'], description: 'MR FLAIR 窗' },
  MR_DWI:        { ww: 1500, wc: 750, modality: ['MR'], description: 'MR DWI 窗' },
  DR_CHEST:      { ww: 2500, wc: 1250, modality: ['DR'], description: 'DR 胸片窗' },
  DR_BONE:       { ww: 2000, wc: 500, modality: ['DR'], description: 'DR 骨窗' },
  DR_ABDOMEN:    { ww: 1800, wc: 900, modality: ['DR'], description: 'DR 腹部窗' },
  MG_DEFAULT:    { ww: 2500, wc: 1250, modality: ['MG'], description: 'MG 乳腺窗' },
  US_DEFAULT:    { ww: 255, wc: 128, modality: ['US'], description: 'US 腹部窗' },
  PT_DEFAULT:    { ww: 5000, wc: 2500, modality: ['PT'], description: 'PET 默认窗' },
  CBCT_BONE:     { ww: 2500, wc: 1200, modality: ['CBCT'], description: 'CBCT 骨窗' },
  CBCT_SOFT:     { ww: 800, wc: 400, modality: ['CBCT'], description: 'CBCT 软组织窗' },
};

export const WINDOW_PRESETS_LIST = Object.entries(WINDOW_PRESETS_DETAILED).map(([key, val]) => ({
  key,
  ...val,
}));
