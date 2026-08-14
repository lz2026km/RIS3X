// [v3.0.6.11-60] Cloud Storage 配置 MSW Handlers
// GET/PUT /system/storage-config, POST /system/storage-config/test
import { http, HttpResponse, delay } from 'msw';
import type {
  BatchDeleteResult,
  CopyObjectResult,
  LifecyclePolicyDto,
  LifecyclePolicyInput,
  StorageAlertsConfig,
  StorageBucketDto,
  StorageConfigDto,
  StorageObjectDto,
  StorageStatsDto,
} from '../api/storageConfigApi';

const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost:5191/api/v1'; }
})();

// 内存存储的配置 (模拟 SystemConfig 表)
let savedConfig: StorageConfigDto = {
  driver: 'local',
  endpoint: 'http://localhost:9000',
  bucket: 'g005',
  region: 'us-east-1',
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
};

const STATS: StorageStatsDto = {
  driver: 'local',
  status: 'active',
  detail: '本地存储统计 (3 个目录)',
  objectCount: 12842,
  usedBytes: 4_215_384_576,
  truncated: false,
  latencyMs: 1,
};

// [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 容量阈值预警配置内存态 (与 backend SystemStorageService 对齐)
let alertsConfig: StorageAlertsConfig = {
  warnPercent: 80,
  criticalPercent: 90,
  notifyChannels: ['email', 'sms'],
};

// [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-28)] 云存储桶管理内存态 (与 backend seed 对齐)
interface BucketRecord extends StorageBucketDto {
  objects: StorageObjectDto[];
}
let buckets: BucketRecord[] = [
  {
    name: 'g005-dicom',
    provider: 's3',
    region: 'us-east-1',
    tenantId: 'default',
    objectCount: 4,
    usedBytes: 2_328_576,
    createdAt: '2026-06-01T08:00:00.000Z',
    objects: [
      { key: 'ct-frame-0001.dcm', size: 512_000, modified: '2026-08-10T03:24:00.000Z' },
      { key: 'ct-frame-0002.dcm', size: 512_000, modified: '2026-08-10T03:24:00.000Z' },
      { key: 'mr-cardiac-4d-0001.dcm', size: 1_048_576, modified: '2026-08-09T11:02:00.000Z' },
      { key: 'xr-chest-0001.dcm', size: 256_000, modified: '2026-08-08T05:40:00.000Z' },
    ],
  },
  {
    name: 'g005-vna',
    provider: 'minio',
    region: 'cn-north-1',
    tenantId: 'default',
    objectCount: 3,
    usedBytes: 228_096,
    createdAt: '2026-06-05T02:30:00.000Z',
    objects: [
      { key: 'report-0001.pdf', size: 128_000, modified: '2026-08-11T09:12:00.000Z' },
      { key: 'report-0002.pdf', size: 96_000, modified: '2026-08-10T15:48:00.000Z' },
      { key: 'archive-manifest.json', size: 4_096, modified: '2026-08-10T00:00:00.000Z' },
    ],
  },
  {
    name: 'g005-files',
    provider: 'local',
    region: 'us-east-1',
    tenantId: 'default',
    objectCount: 2,
    usedBytes: 10_436_608,
    createdAt: '2026-06-10T10:00:00.000Z',
    objects: [
      { key: 'teaching-case-001.png', size: 2_048_000, modified: '2026-08-07T08:20:00.000Z' },
      { key: 'dicom-export-20260813.zip', size: 8_388_608, modified: '2026-08-13T01:05:00.000Z' },
    ],
  },
];

// [G005 v3.0.6.11-99 Wave 7A (G-28)] 对象生命周期策略内存态 (与 backend seed 对齐)
let lifecyclePolicies: LifecyclePolicyDto[] = [
  {
    id: 'lp-001',
    bucket: 'g005-dicom',
    prefix: 'ct-',
    transitionTo: 'tier2',
    afterDays: 90,
    deleteAfterDays: 365,
    enabled: true,
    tenantId: 'default',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 'lp-002',
    bucket: 'g005-dicom',
    prefix: '',
    transitionTo: 'archive',
    afterDays: 365,
    enabled: true,
    tenantId: 'default',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 'lp-003',
    bucket: 'g005-vna',
    prefix: 'report-',
    transitionTo: 'backup',
    afterDays: 30,
    deleteAfterDays: 730,
    enabled: false,
    tenantId: 'default',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
];
let lifecycleSeq = 3;

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function bucketDto(rec: BucketRecord): StorageBucketDto {
  return {
    name: rec.name,
    provider: rec.provider,
    region: rec.region,
    tenantId: rec.tenantId,
    objectCount: rec.objects.length,
    usedBytes: rec.objects.reduce((s, o) => s + o.size, 0),
    createdAt: rec.createdAt,
  };
}

export const storageHandlers = [
  http.get(`${API_BASE}/system/storage-config`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        config: savedConfig,
        active: STATS,
        envDriver: null,
        applied: true,
      },
    });
  }),

  http.put(`${API_BASE}/system/storage-config`, async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as StorageConfigDto;
    if (body.driver === 's3') {
      if (!body.endpoint || !body.bucket || !body.accessKey || !body.secretKey) {
        return HttpResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'S3 配置不完整: endpoint / bucket / accessKey / secretKey 必填' } },
          { status: 400 },
        );
      }
    }
    savedConfig = {
      driver: body.driver === 's3' ? 's3' : 'local',
      endpoint: body.endpoint,
      bucket: body.bucket,
      region: body.region,
      accessKey: body.accessKey,
      secretKey: body.secretKey,
    };
    return HttpResponse.json({
      success: true,
      data: {
        config: savedConfig,
        applied: true,
      },
    });
  }),

  http.post(`${API_BASE}/system/storage-config/test`, async ({ request }) => {
    await delay(600);
    let config: StorageConfigDto = savedConfig;
    try {
      const body = (await request.json()) as Partial<StorageConfigDto> | undefined;
      if (body && (body.driver === 's3' || body.driver === 'local')) {
        config = { ...savedConfig, ...body } as StorageConfigDto;
      }
    } catch {
      /* 空 body → 使用已保存配置 */
    }
    const ok = config.driver === 'local' || (Boolean(config.endpoint) && Boolean(config.bucket) && Boolean(config.accessKey) && Boolean(config.secretKey));
    return HttpResponse.json({
      success: true,
      data: {
        driver: config.driver,
        status: ok ? 'active' : 'inactive',
        detail: ok
          ? config.driver === 'local'
            ? '本地存储就绪'
            : `S3 连接成功: ${config.endpoint}/${config.bucket} (region=${config.region ?? 'us-east-1'})`
          : 'S3 连接失败: InvalidAccessKeyId - 凭证无效',
        latencyMs: 8,
      },
    });
  }),

  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 容量阈值预警配置
  http.get(`${API_BASE}/system/storage/alerts-config`, async () => {
    await delay(120);
    return HttpResponse.json({ success: true, data: alertsConfig });
  }),

  http.put(`${API_BASE}/system/storage/alerts-config`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as StorageAlertsConfig;
    if (body.warnPercent >= body.criticalPercent) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '严重阈值必须大于警告阈值' } },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.notifyChannels) || body.notifyChannels.length === 0) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '至少选择一个通知渠道' } },
        { status: 400 },
      );
    }
    alertsConfig = {
      warnPercent: body.warnPercent,
      criticalPercent: body.criticalPercent,
      notifyChannels: body.notifyChannels,
    };
    return HttpResponse.json({ success: true, data: alertsConfig });
  }),

  // [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-28)] 云存储桶管理
  http.get(`${API_BASE}/system/storage/buckets`, async () => {
    await delay(120);
    return HttpResponse.json({ success: true, data: buckets.map(bucketDto) });
  }),

  http.post(`${API_BASE}/system/storage/buckets`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { name: string; provider?: 'local' | 's3' | 'minio'; region?: string };
    const name = (body.name ?? '').trim();
    if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(name)) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '桶名仅允许字母/数字/点/中划线 (1-63 字符)' } },
        { status: 400 },
      );
    }
    if (buckets.some((b) => b.name === name)) {
      return HttpResponse.json(
        { success: false, error: { code: 'CONFLICT', message: `Bucket ${name} already exists` } },
        { status: 409 },
      );
    }
    const rec: BucketRecord = {
      name,
      provider: body.provider ?? 's3',
      region: (body.region ?? 'us-east-1').trim() || 'us-east-1',
      tenantId: 'default',
      objectCount: 0,
      usedBytes: 0,
      createdAt: new Date().toISOString(),
      objects: [],
    };
    buckets.push(rec);
    return HttpResponse.json({ success: true, data: bucketDto(rec) }, { status: 201 });
  }),

  http.delete(`${API_BASE}/system/storage/buckets/:name`, async ({ params }) => {
    await delay(150);
    const name = String(params.name);
    const idx = buckets.findIndex((b) => b.name === name);
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Bucket ${name} not found` } },
        { status: 404 },
      );
    }
    buckets.splice(idx, 1);
    return HttpResponse.json({ success: true, data: { deleted: name } });
  }),

  http.get(`${API_BASE}/system/storage/buckets/:name/objects`, async ({ params }) => {
    await delay(100);
    const name = String(params.name);
    const rec = buckets.find((b) => b.name === name);
    if (!rec) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Bucket ${name} not found` } },
        { status: 404 },
      );
    }
    return HttpResponse.json({ success: true, data: rec.objects.map((o) => ({ ...o })) });
  }),

  http.post(`${API_BASE}/system/storage/buckets/:name/upload`, async ({ params, request }) => {
    await delay(250);
    const name = String(params.name);
    const rec = buckets.find((b) => b.name === name);
    if (!rec) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Bucket ${name} not found` } },
        { status: 404 },
      );
    }
    const body = (await request.json()) as { key: string; size?: number };
    const key = (body.key ?? '').trim().replace(/[/\\]/g, '-').replace(/^\.+/, '');
    if (!key) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Object key 必填' } },
        { status: 400 },
      );
    }
    const existing = rec.objects.find((o) => o.key === key);
    if (existing) {
      existing.size = body.size ?? existing.size;
      existing.modified = new Date().toISOString();
      return HttpResponse.json({ success: true, data: { ...existing } });
    }
    const obj: StorageObjectDto = { key, size: body.size ?? 1024, modified: new Date().toISOString() };
    rec.objects.push(obj);
    return HttpResponse.json({ success: true, data: { ...obj } }, { status: 201 });
  }),

  http.get(`${API_BASE}/system/storage/buckets/:name/objects/:key/download`, async ({ params }) => {
    await delay(300);
    const name = String(params.name);
    const key = String(params.key);
    const rec = buckets.find((b) => b.name === name);
    const obj = rec?.objects.find((o) => o.key === key);
    if (!rec || !obj) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Object ${name}/${key} not found` } },
        { status: 404 },
      );
    }
    const contentType = key.endsWith('.json')
      ? 'application/json'
      : key.endsWith('.pdf')
        ? 'application/pdf'
        : key.endsWith('.png')
          ? 'image/png'
          : key.endsWith('.zip')
            ? 'application/zip'
            : 'application/octet-stream';
    const content = JSON.stringify(
      {
        bucket: name,
        key: obj.key,
        size: obj.size,
        modified: obj.modified,
        simulated: true,
        message: 'G005 模拟下载对象 (云端存储 → 本地 Blob)',
      },
      null,
      2,
    );
    return HttpResponse.json({
      success: true,
      data: {
        key: obj.key,
        size: obj.size,
        contentType,
        filename: obj.key,
        contentBase64: toBase64Utf8(content),
      },
    });
  }),

  // [G005 v3.0.6.11-99 Wave 7A (G-28)] 对象生命周期策略
  http.get(`${API_BASE}/system/storage/lifecycle-policies`, async () => {
    await delay(120);
    const sorted = [...lifecyclePolicies].sort(
      (a, b) => a.bucket.localeCompare(b.bucket) || a.afterDays - b.afterDays,
    );
    return HttpResponse.json({ success: true, data: sorted });
  }),

  http.post(`${API_BASE}/system/storage/lifecycle-policies`, async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as LifecyclePolicyInput;
    if (!buckets.some((b) => b.name === body.bucket)) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Bucket ${body.bucket} not found` } },
        { status: 404 },
      );
    }
    if (body.deleteAfterDays !== undefined && body.deleteAfterDays !== null && body.deleteAfterDays < body.afterDays) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '删除天数必须 ≥ 转存天数' } },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    lifecycleSeq += 1;
    const rec: LifecyclePolicyDto = {
      id: `lp-${String(lifecycleSeq).padStart(3, '0')}`,
      bucket: body.bucket,
      prefix: (body.prefix ?? '').trim(),
      transitionTo: body.transitionTo,
      afterDays: body.afterDays,
      deleteAfterDays: body.deleteAfterDays === null ? undefined : body.deleteAfterDays,
      enabled: body.enabled ?? true,
      tenantId: 'default',
      createdAt: now,
      updatedAt: now,
    };
    lifecyclePolicies.push(rec);
    return HttpResponse.json({ success: true, data: rec }, { status: 201 });
  }),

  http.patch(`${API_BASE}/system/storage/lifecycle-policies/:id`, async ({ params, request }) => {
    await delay(180);
    const id = String(params.id);
    const rec = lifecyclePolicies.find((p) => p.id === id);
    if (!rec) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Lifecycle policy ${id} not found` } },
        { status: 404 },
      );
    }
    const body = (await request.json()) as Partial<LifecyclePolicyInput>;
    const afterDays = body.afterDays ?? rec.afterDays;
    const deleteAfterDays = body.deleteAfterDays !== undefined ? (body.deleteAfterDays === null ? undefined : body.deleteAfterDays) : rec.deleteAfterDays;
    if (deleteAfterDays !== undefined && deleteAfterDays < afterDays) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '删除天数必须 ≥ 转存天数' } },
        { status: 400 },
      );
    }
    if (body.bucket !== undefined && body.bucket !== rec.bucket && !buckets.some((b) => b.name === body.bucket)) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Bucket ${body.bucket} not found` } },
        { status: 404 },
      );
    }
    rec.bucket = body.bucket?.trim() ?? rec.bucket;
    rec.prefix = body.prefix?.trim() ?? rec.prefix;
    rec.transitionTo = body.transitionTo ?? rec.transitionTo;
    rec.afterDays = afterDays;
    rec.deleteAfterDays = deleteAfterDays;
    rec.enabled = body.enabled ?? rec.enabled;
    rec.updatedAt = new Date().toISOString();
    return HttpResponse.json({ success: true, data: { ...rec } });
  }),

  http.delete(`${API_BASE}/system/storage/lifecycle-policies/:id`, async ({ params }) => {
    await delay(150);
    const id = String(params.id);
    const idx = lifecyclePolicies.findIndex((p) => p.id === id);
    if (idx === -1) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Lifecycle policy ${id} not found` } },
        { status: 404 },
      );
    }
    lifecyclePolicies.splice(idx, 1);
    return HttpResponse.json({ success: true, data: { deleted: id } });
  }),

  // [G005 v3.0.6.11-99 Wave 7A (G-28)] 对象批量操作
  http.post(`${API_BASE}/system/storage/buckets/:name/batch-delete`, async ({ params, request }) => {
    await delay(250);
    const name = String(params.name);
    const rec = buckets.find((b) => b.name === name);
    if (!rec) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Bucket ${name} not found` } },
        { status: 404 },
      );
    }
    const body = (await request.json()) as { keys: string[] };
    const wanted = new Set(body.keys ?? []);
    const deleted: string[] = [];
    const missing: string[] = [];
    rec.objects = rec.objects.filter((o) => {
      if (wanted.has(o.key)) {
        deleted.push(o.key);
        return false;
      }
      return true;
    });
    for (const k of body.keys ?? []) {
      if (!deleted.includes(k)) missing.push(k);
    }
    const result: BatchDeleteResult = { bucket: name, deleted, missing, source: 'simulated' };
    return HttpResponse.json({ success: true, data: result });
  }),

  http.post(`${API_BASE}/system/storage/buckets/:name/copy`, async ({ params, request }) => {
    await delay(250);
    const name = String(params.name);
    const src = buckets.find((b) => b.name === name);
    if (!src) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Bucket ${name} not found` } },
        { status: 404 },
      );
    }
    const body = (await request.json()) as { key: string; targetBucket: string };
    const obj = src.objects.find((o) => o.key === body.key);
    if (!obj) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Object ${name}/${body.key} not found` } },
        { status: 404 },
      );
    }
    const dst = buckets.find((b) => b.name === body.targetBucket);
    if (!dst) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Bucket ${body.targetBucket} not found` } },
        { status: 404 },
      );
    }
    if (dst.name === src.name) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '目标桶不能与源桶相同' } },
        { status: 400 },
      );
    }
    const copy: StorageObjectDto = { key: obj.key, size: obj.size, modified: new Date().toISOString() };
    const existing = dst.objects.find((o) => o.key === copy.key);
    if (existing) {
      existing.size = copy.size;
      existing.modified = copy.modified;
    } else {
      dst.objects.push(copy);
    }
    const result: CopyObjectResult = {
      key: copy.key,
      targetBucket: dst.name,
      size: copy.size,
      modified: copy.modified,
      copied: true,
      source: 'simulated',
    };
    return HttpResponse.json({ success: true, data: result });
  }),
];
