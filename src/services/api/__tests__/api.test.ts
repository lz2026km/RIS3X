import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, invalidateApiCache, invalidateApiCacheByPrefix, __clearApiCacheForTest } from '../client';

vi.mock('../../../utils/auth', () => ({
  getToken: vi.fn(() => null),
  refreshToken: vi.fn(async () => false),
}));

function mockFetchOnce(status: number, body: unknown, ok?: boolean) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(),
    redirected: false,
    statusText: status === 200 ? 'OK' : 'Error',
    type: 'basic' as ResponseType,
    url: '',
    clone: () => ({} as Response),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(''),
  } as unknown as Response);
}

describe('api client - URL construction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __clearApiCacheForTest();
  });

  it('get constructs correct URL', async () => {
    const mock = mockFetchOnce(200, { success: true, data: {} });
    await api.get('/reports');
    expect(mock).toHaveBeenCalledWith('/api/v1/reports', expect.objectContaining({ method: 'GET' }));
  });

  it('post constructs correct URL with body', async () => {
    const mock = mockFetchOnce(200, { success: true, data: {} });
    await api.post('/reports', { status: 'draft' });
    expect(mock).toHaveBeenCalledWith('/api/v1/reports', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ status: 'draft' }),
    }));
  });

  it('put constructs correct URL', async () => {
    const mock = mockFetchOnce(200, { success: true, data: {} });
    await api.put('/reports/rpt-1', { status: 'submitted' });
    expect(mock).toHaveBeenCalledWith('/api/v1/reports/rpt-1', expect.objectContaining({ method: 'PUT' }));
  });

  it('delete constructs correct URL', async () => {
    const mock = mockFetchOnce(200, { success: true, data: {} });
    await api.delete('/reports/rpt-1');
    expect(mock).toHaveBeenCalledWith('/api/v1/reports/rpt-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('handles query parameters in URL', async () => {
    const mock = mockFetchOnce(200, { success: true, data: [] });
    await api.get('/worklist?status=pending&page=1');
    expect(mock).toHaveBeenCalledWith('/api/v1/worklist?status=pending&page=1', expect.any(Object));
  });
});

describe('api client - error handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __clearApiCacheForTest();
  });

  it('returns success for 200 response', async () => {
    mockFetchOnce(200, { success: true, data: { id: '1' } });
    const res = await api.get('/reports/1');
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: '1' });
  });

  it('returns error for non-ok response', async () => {
    mockFetchOnce(400, { error: { code: 'BAD_REQUEST', message: '无效请求' } }, false);
    const res = await api.get('/reports/invalid');
    expect(res.success).toBe(false);
    expect(res.error?.message).toBe('无效请求');
  });

  it('returns network error on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const res = await api.get('/reports');
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('NETWORK_ERROR');
  });

  it('handles 204 no content', async () => {vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: vi.fn().mockRejectedValue(new Error('No body')),
      headers: new Headers(),
      redirected: false,
      statusText: 'No Content',
      type: 'basic' as ResponseType,
      url: '',
      clone: () => ({} as Response),
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      text: () => Promise.resolve(''),
    } as unknown as Response);
    const res = await api.delete('/reports/1');
    expect(res.success).toBe(true);
  });
});

describe('api client - in-memory LRU cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __clearApiCacheForTest();
  });

  it('caches GET responses and serves second call from cache', async () => {
    const mock = mockFetchOnce(200, { success: true, data: { id: 'cache-1' } });
    const r1 = await api.get('/cache-test/1');
    const r2 = await api.get('/cache-test/1');
    expect(mock).toHaveBeenCalledTimes(1);
    expect(r1.data).toEqual({ id: 'cache-1' });
    expect(r2.data).toEqual({ id: 'cache-1' });
  });

  it('does not cache POST requests', async () => {
    let calls = 0;
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      calls++;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true, data: { url: String(input) } }),
        headers: new Headers(),
        redirected: false,
        statusText: 'OK',
        type: 'basic' as ResponseType,
        url: String(input),
        clone: () => ({} as Response),
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        blob: () => Promise.resolve(new Blob()),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve(''),
      } as unknown as Response);
    });
    await api.post('/cache-test/post-a', { foo: 1 });
    await api.post('/cache-test/post-b', { foo: 2 });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(calls).toBe(2);
  });

  it('invalidateApiCache forces refetch on next GET', async () => {
    mockFetchOnce(200, { success: true, data: { v: 1 } });
    const r1 = await api.get('/cache-test/3');
    expect(r1.data).toEqual({ v: 1 });

    await invalidateApiCache('/cache-test/3');

    mockFetchOnce(200, { success: true, data: { v: 2 } });
    const r2 = await api.get('/cache-test/3');
    expect(r2.data).toEqual({ v: 2 });
  });

  it('invalidateApiCacheByPrefix drops matching cached entries', async () => {
    mockFetchOnce(200, { success: true, data: { n: 'a' } });
    mockFetchOnce(200, { success: true, data: { n: 'b' } });
    await api.get('/worklist?status=pending');
    await api.get('/worklist/123');

    await invalidateApiCacheByPrefix('/worklist');

    const m3 = mockFetchOnce(200, { success: true, data: { n: 'a2' } });
    await api.get('/worklist?status=pending');
    expect(m3).toHaveBeenCalledTimes(1);
  });

  it('does not cache error responses', async () => {
    mockFetchOnce(500, { error: { code: 'SERVER_ERROR', message: 'x' } }, false);
    const r1 = await api.get('/cache-test/4');
    expect(r1.success).toBe(false);

    const m2 = mockFetchOnce(200, { success: true, data: { ok: 1 } });
    const r2 = await api.get('/cache-test/4');
    expect(m2).toHaveBeenCalledTimes(1);
    expect(r2.data).toEqual({ ok: 1 });
  });

  it('LRU evicts oldest entry when exceeding MAX_CACHE_ENTRIES', async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    try {
      for (let i = 0; i < 100; i++) {
        mockFetchOnce(200, { success: true, data: { i } });
        await api.get(`/lru/${i}`);
      }
      // 101st insertion should evict the first entry
      mockFetchOnce(200, { success: true, data: { i: 100 } });
      await api.get('/lru/100');

      const reMock = mockFetchOnce(200, { success: true, data: { i: 0, refetched: true } });
      const r = await api.get('/lru/0');
      expect(reMock).toHaveBeenCalledTimes(1);
      expect(r.data).toEqual({ i: 0, refetched: true });
    } finally {
      vi.useRealTimers();
      __clearApiCacheForTest();
    }
  });
});
