import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../client';

vi.mock('../../../utils/auth', () => ({
  getToken: vi.fn(() => null),
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

  it('handles 204 no content', async () => {
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
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
