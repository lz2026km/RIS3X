// [v3.0.6.11-60] Cloud Storage 配置 MSW Handlers
// GET/PUT /system/storage-config, POST /system/storage-config/test
import { http, HttpResponse, delay } from 'msw';
import type { StorageAlertsConfig, StorageConfigDto, StorageStatsDto } from '../api/storageConfigApi';

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
];
