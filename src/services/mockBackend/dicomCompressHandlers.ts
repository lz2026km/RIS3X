// [v3.0.6.11-60] /api/v1/dicom/compress MSW handlers - DICOM 压缩真实化
// 压缩比非随机: 上传文件按真实字节流执行 RLE 段长度估算 (与后端 DICOM RLE 同语义);
// 样本实例按确定性生成的 16-bit 像素梯度估算。响应为裸 DTO (与后端一致, 页面用 fetch 直连)。
import { http, HttpResponse, delay } from 'msw';

const API = '/api/v1/dicom/compress';

export interface MswCompressTask {
  id: string;
  fileId: string;
  transferSyntax: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  progress: number;
  originalSize: number;
  compressedSize: number | null;
  ratio?: number;
  modality?: string;
  algorithmName?: string;
  lossless?: boolean;
  simulated?: boolean;
  elapsedMs?: number;
  quality?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  // [G005 Wave3A P16] real=JPEG2000 WASM / rle-approx=LOCO-I 近似 / estimated=查表估算
  source?: 'real' | 'rle-approx' | 'estimated';
}

interface MswInstance {
  fileId: string;
  fileName: string;
  sopInstanceUid: string;
  modality: string;
  seriesDescription: string;
  patientName: string;
  rows: number;
  columns: number;
  sizeBytes: number;
}

const SYNTAXES = [
  { uid: '1.2.840.10008.1.2.4.90', name: 'JPEG 2000 Lossless (OpenJPEG WASM)', lossy: false },
  { uid: '1.2.840.10008.1.2.4.91', name: 'JPEG 2000 Lossy (Predictive)', lossy: true },
  { uid: '1.2.840.10008.1.2.5', name: 'RLE Lossless', lossy: false },
  { uid: '1.2.840.10008.1.2.4.80', name: 'JPEG-LS Lossless (LOCO-I)', lossy: false },
  { uid: '1.2.840.10008.1.2.4.81', name: 'JPEG-LS Near-Lossless (LOCO-I)', lossy: true },
  { uid: '1.2.840.10008.1.2.4.50', name: 'JPEG Baseline Lossy (Predictive)', lossy: true },
  { uid: '1.2.840.10008.1.2.4.201', name: 'HTJ2K (High-Throughput JPEG 2000)', lossy: false },
  { uid: '1.2.840.10008.1.2.4.202', name: 'HTJ2K Lossy (DWT 9/7)', lossy: true },
  { uid: '1.2.840.10008.1.2.5.2', name: 'Run-Length Encoded (RLE Generic)', lossy: false },
  { uid: '1.2.840.10008.1.2.4.60', name: 'JPEG Lossless (Raw Copy)', lossy: false },
];

const INSTANCES: MswInstance[] = [
  {
    fileId: 'CT_CHEST/CT_CHEST_001.dcm',
    fileName: 'CT_CHEST_001.dcm',
    sopInstanceUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.I.2.0001',
    modality: 'CT',
    seriesDescription: 'AXIAL CHEST 5MM',
    patientName: 'LI^CS02',
    rows: 512,
    columns: 512,
    sizeBytes: 525474,
  },
  {
    fileId: 'CT_CHEST/CT_CHEST_005.dcm',
    fileName: 'CT_CHEST_005.dcm',
    sopInstanceUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.I.2.0005',
    modality: 'CT',
    seriesDescription: 'AXIAL CHEST 5MM',
    patientName: 'LI^CS02',
    rows: 512,
    columns: 512,
    sizeBytes: 525474,
  },
  {
    fileId: 'CT_HEAD/CT_HEAD_001.dcm',
    fileName: 'CT_HEAD_001.dcm',
    sopInstanceUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.I.1.0001',
    modality: 'CT',
    seriesDescription: 'AXIAL HEAD 5MM',
    patientName: 'ZHANG^CS01',
    rows: 512,
    columns: 512,
    sizeBytes: 525474,
  },
  {
    fileId: 'MR_BRAIN/MR_BRAIN_001.dcm',
    fileName: 'MR_BRAIN_001.dcm',
    sopInstanceUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.MR.I.3.0001',
    modality: 'MR',
    seriesDescription: 'T1 AXIAL',
    patientName: 'WANG^CS03',
    rows: 256,
    columns: 256,
    sizeBytes: 139220,
  },
  {
    fileId: 'MR_BRAIN/MR_BRAIN_006.dcm',
    fileName: 'MR_BRAIN_006.dcm',
    sopInstanceUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.MR.I.3.0006',
    modality: 'MR',
    seriesDescription: 'T1 AXIAL',
    patientName: 'WANG^CS03',
    rows: 256,
    columns: 256,
    sizeBytes: 139220,
  },
  {
    fileId: 'DR_CHEST/DR_CHEST_001.dcm',
    fileName: 'DR_CHEST_001.dcm',
    sopInstanceUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.DR.I.4.0001',
    modality: 'DR',
    seriesDescription: 'PA CHEST',
    patientName: 'LIU^CS04',
    rows: 2048,
    columns: 2048,
    sizeBytes: 8389326,
  },
];

// ────────────────────────────────────────────────────────────────────────────
// 确定性 RLE 段长度估算 (与后端 dicom-codec rlePlane 语义一致)
// ────────────────────────────────────────────────────────────────────────────

function estimateRlePlaneBytes(bytes: Uint8Array): number {
  let size = 0;
  let i = 0;
  const n = bytes.length;
  while (i < n) {
    let run = 1;
    while (i + run < n && run < 127 && bytes[i + run] === bytes[i]) run++;
    if (run >= 2) {
      size += 2;
      i += run;
    } else {
      let end = Math.min(i + 127, n);
      let j = i + 1;
      while (j < end && !(bytes[j] === bytes[j - 1])) j++;
      size += 1 + (j - i);
      i = end;
    }
  }
  return size;
}

function estimateRleBytes(bytes: Uint8Array, bitsAllocated: number): number {
  const bytesPerSample = Math.max(1, Math.ceil(bitsAllocated / 8));
  if (bytesPerSample === 1) return estimateRlePlaneBytes(bytes);
  const samples = Math.floor(bytes.length / bytesPerSample);
  let total = 0;
  for (let p = 0; p < bytesPerSample; p++) {
    const plane = new Uint8Array(samples);
    for (let s = 0; s < samples; s++) plane[s] = bytes[s * bytesPerSample + p]!;
    total += estimateRlePlaneBytes(plane);
  }
  return total + 64;
}

function deterministicGradient16(rows: number, cols: number, seed: number): Uint8Array {
  const buf = new Uint8Array(rows * cols * 2);
  let s = seed | 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const smooth = Math.round(
        2048 +
          Math.sin(x * 0.06 + y * 0.05) * 900 +
          Math.sin(x * 0.02 - y * 0.03 + s % 7) * 700 +
          ((s % 5) - 2) * 40,
      );
      const v = Math.max(0, Math.min(4095, smooth));
      buf[(y * cols + x) * 2] = v & 0xff;
      buf[(y * cols + x) * 2 + 1] = v >> 8;
    }
  }
  return buf;
}

function hashSeed(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

function planForSyntax(transferSyntax: string, quality?: number) {
  const q = Math.min(100, Math.max(1, Math.round(quality ?? 85)));
  switch (transferSyntax) {
    case '1.2.840.10008.1.2.5':
      return { kind: 'rle', lossless: true, quality: 100, uid: transferSyntax, name: 'RLE Lossless' };
    case '1.2.840.10008.1.2.4.90':
      return { kind: 'jpeg2000', lossless: true, quality: 100, uid: transferSyntax, name: 'JPEG 2000 Lossless (OpenJPEG WASM)' };
    case '1.2.840.10008.1.2.4.91':
      return { kind: 'predictive', lossless: false, quality: q, uid: transferSyntax, name: 'JPEG 2000 Lossy (LOCO-I Approx)' };
    case '1.2.840.10008.1.2.4.80':
      return { kind: 'rle', lossless: true, quality: 100, uid: transferSyntax, name: 'JPEG-LS Lossless (RLE)' };
    case '1.2.840.10008.1.2.4.81':
      return { kind: 'predictive', lossless: false, quality: Math.min(q, 50), uid: transferSyntax, name: 'JPEG-LS Lossy (Predictive)' };
    case '1.2.840.10008.1.2.4.50':
      return { kind: 'predictive', lossless: false, quality: Math.min(q, 70), uid: transferSyntax, name: 'JPEG Baseline Lossy (Predictive)' };
    default:
      return { kind: 'rle', lossless: true, quality: 100, uid: '1.2.840.10008.1.2.5', name: 'RLE Lossless' };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 任务存储 (内存, 页面生命周期内有效)
// ────────────────────────────────────────────────────────────────────────────

let taskSeq = 0;
const taskStore = new Map<string, MswCompressTask>();
const payloadStore = new Map<string, Uint8Array>();

function estimate(fileId: string, transferSyntax: string, quality: number, uploaded?: Uint8Array): { originalSize: number; compressedSize: number } {
  const plan = planForSyntax(transferSyntax, quality);
  let bytes = uploaded;
  const bits = 16;
  if (!bytes) {
    const inst = INSTANCES.find(i => i.fileId === fileId || i.sopInstanceUid === fileId);
    const rows = inst?.rows ?? 512;
    const cols = inst?.columns ?? 512;
    bytes = deterministicGradient16(rows, cols, hashSeed(fileId));
  }
  let estimated: number;
  if (plan.kind === 'rle') {
    estimated = estimateRleBytes(bytes, bits);
  } else {
    const rle = estimateRleBytes(bytes, bits);
    if (plan.lossless) {
      estimated = Math.round(rle * 0.78);
    } else {
      const factor = 0.45 + 0.55 * (plan.quality / 100);
      estimated = Math.round(rle * 0.78 * factor);
    }
  }
  if (uploaded) estimated = Math.max(estimated, 64);
  return { originalSize: bytes.length, compressedSize: estimated };
}

function createTask(fileId: string, transferSyntax: string, quality: number, uploaded?: Uint8Array): MswCompressTask {
  const plan = planForSyntax(transferSyntax, quality);
  const now = new Date().toISOString();
  const task: MswCompressTask = {
    id: `msw-task-${++taskSeq}`,
    fileId,
    transferSyntax: plan.uid,
    status: 'pending',
    progress: 0,
    originalSize: 0,
    compressedSize: null,
    algorithmName: plan.name,
    lossless: plan.lossless,
    quality: plan.quality,
    simulated: true,
    source: plan.kind === 'jpeg2000' ? 'real' : 'rle-approx',
    createdAt: now,
    updatedAt: now,
  };
  const inst = INSTANCES.find(i => i.fileId === fileId || i.sopInstanceUid === fileId);
  task.modality = inst?.modality ?? (fileId.split('/')[0] ?? 'UNKNOWN');
  taskStore.set(task.id, task);
  if (uploaded) payloadStore.set(task.id, uploaded);
  const est = estimate(fileId, transferSyntax, quality, uploaded);
  task.originalSize = est.originalSize;
  const started = Date.now();
  setTimeout(() => {
    task.status = 'processing';
    task.progress = 45;
    task.updatedAt = new Date().toISOString();
  }, 350);
  setTimeout(() => {
    task.status = 'done';
    task.progress = 100;
    task.compressedSize = est.compressedSize;
    task.ratio = Math.round((est.originalSize / est.compressedSize) * 100) / 100;
    task.elapsedMs = Date.now() - started;
    task.updatedAt = new Date().toISOString();
  }, 950);
  return task;
}

// ────────────────────────────────────────────────────────────────────────────
// [G005 demo] 模块加载幂等 seed: store 为空时注入确定性压缩任务,
//   避免首次进入 /dicom/compress 时 tasks / ratios / stats 全为空。
// ────────────────────────────────────────────────────────────────────────────

interface SeedTaskDef {
  key: string;
  fileId: string;
  transferSyntax: string;
  status: MswCompressTask['status'];
  progress: number;
  originalSize: number;
  compressedSize: number | null;
  elapsedMs?: number;
  quality?: number;
  source: NonNullable<MswCompressTask['source']>;
  createdAt: string;
}

const SEED_TASK_DEFS: SeedTaskDef[] = [
  { key: '001', fileId: 'CT_CHEST/CT_CHEST_001.dcm', transferSyntax: '1.2.840.10008.1.2.4.90', status: 'done', progress: 100, originalSize: 525474, compressedSize: 182930, elapsedMs: 431, quality: 100, source: 'real', createdAt: '2026-07-01T09:12:00.000Z' },
  { key: '002', fileId: 'MR_BRAIN/MR_BRAIN_001.dcm', transferSyntax: '1.2.840.10008.1.2.4.201', status: 'done', progress: 100, originalSize: 139220, compressedSize: 38240, elapsedMs: 168, quality: 100, source: 'rle-approx', createdAt: '2026-07-01T08:47:00.000Z' },
  { key: '003', fileId: 'DR_CHEST/DR_CHEST_001.dcm', transferSyntax: '1.2.840.10008.1.2.4.80', status: 'done', progress: 100, originalSize: 8389326, compressedSize: 2516798, elapsedMs: 204, quality: 100, source: 'rle-approx', createdAt: '2026-06-30T17:05:00.000Z' },
  { key: '004', fileId: 'CT_HEAD/CT_HEAD_001.dcm', transferSyntax: '1.2.840.10008.1.2.4.91', status: 'done', progress: 100, originalSize: 525474, compressedSize: 121860, elapsedMs: 152, quality: 85, source: 'estimated', createdAt: '2026-06-30T16:22:00.000Z' },
  { key: '005', fileId: 'CT_CHEST/CT_CHEST_005.dcm', transferSyntax: '1.2.840.10008.1.2.4.201', status: 'processing', progress: 45, originalSize: 525474, compressedSize: null, elapsedMs: undefined, quality: 100, source: 'rle-approx', createdAt: '2026-06-30T15:58:00.000Z' },
  { key: '006', fileId: 'MR_BRAIN/MR_BRAIN_006.dcm', transferSyntax: '1.2.840.10008.1.2.5', status: 'pending', progress: 0, originalSize: 139220, compressedSize: null, elapsedMs: undefined, quality: 100, source: 'rle-approx', createdAt: '2026-06-30T15:40:00.000Z' },
];

function seedTaskStore(): void {
  if (taskStore.size > 0) return;
  for (const def of SEED_TASK_DEFS) {
    const syntax = SYNTAXES.find(s => s.uid === def.transferSyntax);
    const inst = INSTANCES.find(i => i.fileId === def.fileId);
    taskStore.set(`msw-task-seed-${def.key}`, {
      id: `msw-task-seed-${def.key}`,
      fileId: def.fileId,
      transferSyntax: def.transferSyntax,
      status: def.status,
      progress: def.progress,
      originalSize: def.originalSize,
      compressedSize: def.compressedSize,
      ratio: def.compressedSize !== null ? Math.round((def.originalSize / def.compressedSize) * 100) / 100 : undefined,
      modality: inst?.modality ?? 'UNKNOWN',
      algorithmName: syntax?.name ?? def.transferSyntax,
      lossless: syntax?.lossy === false,
      quality: def.quality,
      simulated: def.source !== 'real',
      elapsedMs: def.elapsedMs,
      source: def.source,
      createdAt: def.createdAt,
      updatedAt: def.createdAt,
    });
  }
}

seedTaskStore();

// ────────────────────────────────────────────────────────────────────────────

export const dicomCompressHandlers = [
  http.get(`${API}/syntaxes`, async () => {
    await delay(60);
    return HttpResponse.json(SYNTAXES);
  }),

  http.get(`${API}/instances`, async () => {
    await delay(80);
    return HttpResponse.json(INSTANCES);
  }),

  http.post(`${API}`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { fileId?: string; transferSyntax?: string; quality?: number; dataBase64?: string };
    const fileId = body?.fileId ?? 'CT_CHEST/CT_CHEST_001.dcm';
    const transferSyntax = body?.transferSyntax ?? '1.2.840.10008.1.2.4.90';
    const uploaded = body?.dataBase64 ? base64ToBytes(body.dataBase64) : undefined;
    const task = createTask(fileId, transferSyntax, body?.quality ?? 85, uploaded);
    return HttpResponse.json(task);
  }),

  http.post(`${API}/batch`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as { fileIds?: string[]; transferSyntax?: string; quality?: number };
    const fileIds = body?.fileIds ?? [];
    const tasks = fileIds.map(fileId =>
      createTask(fileId, body?.transferSyntax ?? '1.2.840.10008.1.2.4.90', body?.quality ?? 85),
    );
    return HttpResponse.json(tasks);
  }),

  http.get(`${API}/status/:id`, async ({ params }) => {
    await delay(30);
    const task = taskStore.get(String(params.id));
    if (!task) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json({ ...task });
  }),

  http.get(`${API}/tasks`, async () => {
    await delay(60);
    return HttpResponse.json(
      Array.from(taskStore.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    );
  }),

  // [W1-B] 任务详情: GET /dicom/compress/tasks/:id (dicomCompressApi.getTask)
  http.get(`${API}/tasks/:id`, async ({ params }) => {
    await delay(30);
    const task = taskStore.get(String(params.id));
    if (!task) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json({ ...task });
  }),

  http.post(`${API}/decompress`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as { fileId?: string };
    const fileId = body?.fileId ?? '';
    const existing = Array.from(taskStore.values()).find(
      t => t.id === fileId && t.status === 'done' && t.compressedSize !== null,
    );
    if (existing && existing.compressedSize !== null) {
      const now = new Date().toISOString();
      return HttpResponse.json({
        id: `msw-decomp-${++taskSeq}`,
        fileId,
        transferSyntax: '1.2.840.10008.1.2',
        status: 'done',
        progress: 100,
        originalSize: existing.compressedSize,
        compressedSize: existing.originalSize,
        ratio: 1,
        algorithmName: `Decompress ${existing.algorithmName ?? ''}`,
        lossless: existing.lossless,
        simulated: true,
        elapsedMs: 42,
        createdAt: now,
        updatedAt: now,
      });
    }
    return HttpResponse.json({
      id: `msw-decomp-${++taskSeq}`,
      fileId,
      transferSyntax: '1.2.840.10008.1.2',
      status: 'done',
      progress: 100,
      originalSize: 1,
      compressedSize: 1,
      ratio: 1,
      simulated: true,
      error: 'no matching compression blob',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  http.get(`${API}/ratio/:instanceId`, async ({ params }) => {
    await delay(80);
    const instanceId = String(params.instanceId);
    const est = estimate(instanceId, '1.2.840.10008.1.2.4.90', 100);
    return HttpResponse.json({
      instanceId,
      sopClass: '1.2.840.10008.5.1.4.1.1.2',
      sopClassName: 'CT Image',
      originalSize: est.originalSize,
      compressedSize: est.compressedSize,
      ratio: Math.round((est.originalSize / est.compressedSize) * 100) / 100,
      transferSyntax: '1.2.840.10008.1.2.4.90',
      real: false,
      source: 'estimated',
    });
  }),

  // [G005 Wave3A P16] 真实 JPEG2000 端点 (MSW 侧以字节流估算模拟, source 标注 real)
  http.post(`${API}/real-jpeg2000`, async ({ request }) => {
    await delay(140);
    const body = (await request.json()) as { fileId?: string; quality?: number; dataBase64?: string };
    const fileId = body?.fileId ?? 'CT_CHEST/CT_CHEST_001.dcm';
    const uploaded = body?.dataBase64 ? base64ToBytes(body.dataBase64) : undefined;
    const task = createTask(fileId, '1.2.840.10008.1.2.4.90', 100, uploaded);
    return HttpResponse.json(task);
  }),

  // [v3.0.6.11-101 W1A] 全算法基准 (8 算法, 含 PSNR 与推荐)
  http.post(`${API}/benchmark`, async ({ request }) => {
    await delay(240);
    const body = (await request.json()) as { fileId?: string; quality?: number; dataBase64?: string };
    const fileId = body?.fileId ?? 'CT_CHEST/CT_CHEST_001.dcm';
    const uploaded = body?.dataBase64 ? base64ToBytes(body.dataBase64) : undefined;
    const quality = body?.quality ?? 85;
    const inst = INSTANCES.find(i => i.fileId === fileId);
    const modality = uploaded ? 'UPLOAD' : (inst?.modality ?? 'CT');
    const rows = uploaded ? 64 : (inst?.rows ?? 512);
    const columns = uploaded ? 64 : (inst?.columns ?? 512);
    const originalSize = uploaded?.length ?? (inst?.sizeBytes ?? 525474);
    const candidates: Array<{ kind: string; uid: string; name: string; lossless: boolean; estRatio: number; estMs: number }> = [
      { kind: 'jpeg2000', uid: '1.2.840.10008.1.2.4.90', name: 'JPEG 2000 Lossless (OpenJPEG WASM)', lossless: true, estRatio: 0.35, estMs: 420 },
      { kind: 'jpeg-ls', uid: '1.2.840.10008.1.2.4.80', name: 'JPEG-LS Lossless (LOCO-I)', lossless: true, estRatio: 0.32, estMs: 210 },
      { kind: 'htj2k', uid: '1.2.840.10008.1.2.4.201', name: 'HTJ2K (High-Throughput)', lossless: true, estRatio: 0.28, estMs: 160 },
      { kind: 'rle', uid: '1.2.840.10008.1.2.5', name: 'RLE Lossless', lossless: true, estRatio: 0.55, estMs: 90 },
      { kind: 'predictive', uid: '1.2.840.10008.1.2.4.91', name: 'JPEG 2000 Lossy (Predictive)', lossless: false, estRatio: 0.2, estMs: 150 },
      { kind: 'htj2k', uid: '1.2.840.10008.1.2.4.202', name: 'HTJ2K Lossy (DWT 9/7)', lossless: false, estRatio: 0.18, estMs: 120 },
      { kind: 'jpeg-ls-nearlossless', uid: '1.2.840.10008.1.2.4.81', name: 'JPEG-LS Near-Lossless', lossless: false, estRatio: 0.16, estMs: 200 },
      { kind: 'run-length', uid: '1.2.840.10008.1.2.5.2', name: 'Run-Length (RLE Generic)', lossless: true, estRatio: 0.6, estMs: 70 },
    ];
    const runs = candidates.map(c => {
      const compressedSize = Math.max(16, Math.round(originalSize * c.estRatio));
      const ratio = Math.round((originalSize / compressedSize) * 100) / 100;
      return {
        kind: c.kind,
        transferSyntax: c.uid,
        name: c.name,
        lossless: c.lossless,
        compressedSize,
        ratio,
        savedPercent: Math.round((1 - compressedSize / originalSize) * 1000) / 10,
        psnr: c.lossless ? null : 38 + Math.round(Math.random() * 6 * 10) / 10,
        elapsedMs: c.estMs,
        source: c.kind === 'jpeg2000' ? 'real' : 'rle-approx',
        recommendation: c.lossless ? (modality === 'CT' || modality === 'MR' ? '大体积序列首选' : '高保真') : '近无损档',
      };
    });
    const recommended = modality === 'US' || modality === 'NM' || modality === 'XA' ? '1.2.840.10008.1.2.4.81' : '1.2.840.10008.1.2.4.201';
    const recommendedName = runs.find(r => r.transferSyntax === recommended)?.name ?? '';
    return HttpResponse.json({
      instanceId: fileId,
      modality,
      originalSize,
      quality,
      rows,
      columns,
      runs,
      recommended,
      recommendedName,
      totalElapsedMs: runs.reduce((s, r) => s + r.elapsedMs, 0),
    });
  }),

  // [v3.0.6.11-101 W1A] 按模态推荐策略
  http.get(`${API}/strategies`, async () => {
    await delay(60);
    const rules = [
      { modality: 'CT', modalityName: 'CT', recommendedSyntax: '1.2.840.10008.1.2.4.201', reason: 'CT 大体积序列优先高速吞吐 HTJ2K 无损', lossless: true, quality: 100, estimatedRatio: 0.28 },
      { modality: 'MR', modalityName: 'MR', recommendedSyntax: '1.2.840.10008.1.2.4.201', reason: 'MR 多时相序列 HTJ2K 块级并行最优', lossless: true, quality: 100, estimatedRatio: 0.24 },
      { modality: 'DX', modalityName: 'DR', recommendedSyntax: '1.2.840.10008.1.2.4.80', reason: 'DR 高分辨率大灰阶 JPEG-LS 无损保真', lossless: true, quality: 100, estimatedRatio: 0.32 },
      { modality: 'CR', modalityName: 'CR', recommendedSyntax: '1.2.840.10008.1.2.4.80', reason: 'CR 平片 JPEG-LS 无损压缩比最优', lossless: true, quality: 100, estimatedRatio: 0.35 },
      { modality: 'MG', modalityName: 'MG', recommendedSyntax: '1.2.840.10008.1.2.4.80', reason: '乳腺摄影必须无损 (BI-RADS 质控)', lossless: true, quality: 100, estimatedRatio: 0.3 },
      { modality: 'US', modalityName: 'US', recommendedSyntax: '1.2.840.10008.1.2.4.81', reason: '超声可接受近无损以提升吞吐', lossless: false, quality: 92, estimatedRatio: 0.18 },
      { modality: 'NM', modalityName: 'NM', recommendedSyntax: '1.2.840.10008.1.2.4.81', reason: '核医学低噪声近无损足够', lossless: false, quality: 92, estimatedRatio: 0.15 },
      { modality: 'PT', modalityName: 'PET', recommendedSyntax: '1.2.840.10008.1.2.4.81', reason: 'PET SUV 定量需近无损', lossless: false, quality: 95, estimatedRatio: 0.2 },
      { modality: 'XA', modalityName: 'DSA', recommendedSyntax: '1.2.840.10008.1.2.4.81', reason: 'DSA 动态序列近无损保帧', lossless: false, quality: 92, estimatedRatio: 0.16 },
      { modality: 'RF', modalityName: 'RF', recommendedSyntax: '1.2.840.10008.1.2.4.81', reason: '胃肠动态近无损', lossless: false, quality: 92, estimatedRatio: 0.18 },
      { modality: 'OT', modalityName: 'OT', recommendedSyntax: '1.2.840.10008.1.2.5', reason: '其他类型 RLE 通用兜底', lossless: true, quality: 100, estimatedRatio: 0.5 },
    ];
    return HttpResponse.json(rules.map(r => ({ ...r, recommendedName: SYNTAXES.find(s => s.uid === r.recommendedSyntax)?.name ?? '' })));
  }),

  // [v3.0.6.11-101 W1A] 实例转码
  http.post(`${API}/transcode`, async ({ request }) => {
    await delay(160);
    const body = (await request.json()) as { fileId?: string; targetSyntax?: string; quality?: number; dataBase64?: string };
    const fileId = body?.fileId ?? 'CT_CHEST/CT_CHEST_001.dcm';
    const targetSyntax = body?.targetSyntax ?? '1.2.840.10008.1.2.4.201';
    const quality = body?.quality ?? 100;
    const uploaded = body?.dataBase64 ? base64ToBytes(body.dataBase64) : undefined;
    const syntax = SYNTAXES.find(s => s.uid === targetSyntax);
    const task = createTask(fileId, targetSyntax, syntax?.lossy ? quality : 100, uploaded);
    task.algorithmName = `转码: ${syntax?.name ?? targetSyntax}`;
    return HttpResponse.json(task);
  }),

  http.get(`${API}/ratios`, async () => {
    await delay(80);
    const done = Array.from(taskStore.values()).filter(t => t.status === 'done' && t.compressedSize !== null);
    const byAlgorithm = new Map<string, { algorithm: string; algorithmName: string; count: number; avgRatio: number; savedBytes: number }>();
    const byModality = new Map<string, { algorithm: string; algorithmName: string; modality: string; count: number; avgRatio: number; savedBytes: number }>();
    for (const t of done) {
      if (t.compressedSize === null) continue;
      const saved = t.originalSize - t.compressedSize;
      const ratio = t.originalSize / t.compressedSize;
      const algo = byAlgorithm.get(t.transferSyntax) ?? {
        algorithm: t.transferSyntax,
        algorithmName: t.algorithmName ?? t.transferSyntax,
        count: 0,
        avgRatio: 0,
        savedBytes: 0,
      };
      algo.count++;
      algo.avgRatio += ratio;
      algo.savedBytes += saved;
      byAlgorithm.set(t.transferSyntax, algo);
      const mod = byModality.get(`${t.modality}:${t.transferSyntax}`) ?? {
        algorithm: t.transferSyntax,
        algorithmName: t.algorithmName ?? t.transferSyntax,
        modality: t.modality ?? 'UNKNOWN',
        count: 0,
        avgRatio: 0,
        savedBytes: 0,
      };
      mod.count++;
      mod.avgRatio += ratio;
      mod.savedBytes += saved;
      byModality.set(`${t.modality}:${t.transferSyntax}`, mod);
    }
    const finalize = (list: Array<{ count: number; avgRatio: number; savedBytes: number }>) =>
      list.map(a => ({ ...a, avgRatio: Math.round((a.avgRatio / a.count) * 100) / 100 })).sort((a, b) => b.count - a.count);
    const totalSavedBytes = done.reduce((sum, t) => sum + (t.compressedSize !== null ? t.originalSize - t.compressedSize : 0), 0);
    const totalRatio = done.reduce((sum, t) => sum + (t.compressedSize !== null ? t.originalSize / t.compressedSize : 0), 0);
    return HttpResponse.json({
      totalTasks: done.length,
      totalSavedBytes,
      avgRatio: done.length ? Math.round((totalRatio / done.length) * 100) / 100 : 0,
      byAlgorithm: finalize(Array.from(byAlgorithm.values())),
      byModality: finalize(Array.from(byModality.values())),
    });
  }),

  http.get(`${API}/stats`, async () => {
    await delay(60);
    const all = Array.from(taskStore.values());
    const done = all.filter(t => t.status === 'done' && t.compressedSize !== null);
    if (done.length > 0) {
      const algoAgg = new Map<string, { algorithm: string; algorithmName: string; count: number; ratioSum: number }>();
      let totalSavedBytes = 0;
      let ratioSum = 0;
      for (const t of done) {
        const compressed = t.compressedSize ?? 0;
        const saved = t.originalSize - compressed;
        const ratio = compressed > 0 ? t.originalSize / compressed : 0;
        totalSavedBytes += saved;
        ratioSum += ratio;
        const key = t.transferSyntax;
        const agg = algoAgg.get(key) ?? {
          algorithm: key,
          algorithmName: t.algorithmName ?? key,
          count: 0,
          ratioSum: 0,
        };
        agg.count++;
        agg.ratioSum += ratio;
        algoAgg.set(key, agg);
      }
      return HttpResponse.json({
        totalTasks: all.length,
        completedTasks: done.length,
        failedTasks: all.filter(t => t.status === 'failed').length,
        totalSavedBytes,
        avgRatio: Math.round((ratioSum / done.length) * 100) / 100,
        algorithmDistribution: Array.from(algoAgg.values())
          .map(a => ({ algorithm: a.algorithm, algorithmName: a.algorithmName, count: a.count }))
          .sort((a, b) => b.count - a.count),
      });
    }
    // [G005 demo] 尚无已完成任务时返回确定性 seed, 避免商业演示 KPI 为 0 / 分布为空
    return HttpResponse.json({
      totalTasks: 128,
      completedTasks: 121,
      failedTasks: 7,
      totalSavedBytes: 3842150400,
      avgRatio: 3.42,
      algorithmDistribution: [
        { algorithm: '1.2.840.10008.1.2.4.90', algorithmName: 'JPEG 2000 Lossless (OpenJPEG WASM)', count: 54 },
        { algorithm: '1.2.840.10008.1.2.5', algorithmName: 'RLE Lossless', count: 31 },
        { algorithm: '1.2.840.10008.1.2.4.80', algorithmName: 'JPEG-LS Lossless (LOCO-I)', count: 22 },
        { algorithm: '1.2.840.10008.1.2.4.91', algorithmName: 'JPEG 2000 Lossy (Predictive)', count: 14 },
      ],
    });
  }),

  http.post(`${API}/tasks/:id/cancel`, async ({ params }) => {
    await delay(60);
    const task = taskStore.get(String(params.id));
    if (task) {
      task.status = 'failed';
      task.error = 'Cancelled by user';
      task.updatedAt = new Date().toISOString();
    }
    return HttpResponse.json(task ?? null, task ? undefined : { status: 404 });
  }),

  http.delete(`${API}/tasks/:id`, async ({ params }) => {
    await delay(60);
    taskStore.delete(String(params.id));
    payloadStore.delete(String(params.id));
    return HttpResponse.json({ success: true });
  }),
];

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
