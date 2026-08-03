import { MobileService } from '../src/mobile/mobile.service'

describe('MobileService', () => {
  let svc: MobileService
  let mockConfig: any
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns not-configured error when appid/secret missing', async () => {
    mockConfig = { get: jest.fn().mockReturnValue('') }
    svc = new MobileService(mockConfig)
    const r = await svc.jscode2session('code1')
    expect(r).toEqual({ errcode: -1, errmsg: 'WeChat not configured' })
  })

  it('calls WeChat API and returns json when configured', async () => {
    mockConfig = {
      get: jest.fn((key: string, def: string) => (key === 'WECHAT_APPID' ? 'app1' : key === 'WECHAT_SECRET' ? 'sec1' : def)),
    }
    svc = new MobileService(mockConfig)
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ openid: 'openid-1', session_key: 'sk' }),
    })
    globalThis.fetch = fetchMock as any
    const r = await svc.jscode2session('js-code-123')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('appid=app1&secret=sec1&js_code=js-code-123'))
    expect(r.openid).toBe('openid-1')
  })
})
