/**
 * FHIR Subscription SSRF 防护 (SEC3):
 * 仅允许 http/https 公网 endpoint；禁止回环/私网/链路本地等内网地址。
 * 纯 URL 解析 + IP 判断，不依赖 DNS 解析（避免 DNS rebinding 与解析阻塞）。
 */

function isPrivateIpv4(host: string): boolean {
  if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return false
  const [a, b, c, d] = host.split('.').map(Number)
  if ([a, b, c, d].some((n) => n < 0 || n > 255)) return false
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19))
  )
}

function isPrivateHost(host: string): boolean {
  const lower = host.toLowerCase().replace(/\.$/, '')
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local')) return true
  const ipv6 = lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower
  if (ipv6.includes(':')) {
    if (ipv6 === '::' || ipv6 === '::1') return true
    if (ipv6.startsWith('fe80:') || ipv6.startsWith('fec0:') || ipv6.startsWith('fc') || ipv6.startsWith('fd')) return true
    const v4mapped = ipv6.startsWith('::ffff:') ? ipv6.slice(7) : ''
    return v4mapped ? isPrivateIpv4(v4mapped) : false
  }
  return isPrivateIpv4(lower)
}

export function isPublicUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const host = url.hostname
  if (!host) return false
  return !isPrivateHost(host)
}
