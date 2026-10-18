/**
 * G005 RIS — 路由解析共享库
 *
 * [v3.0.6.16-7] 本库的存在是为了消除三套守卫 (api-contract / demo / select) 各自
 * 重复实现且口径不一致的解析逻辑, 并修掉 v3.0.6.16-6 审查发现的解析缺陷:
 *
 *   B1 注释剥离顺序倒置 -> 注释里的 `/*` 被当块注释起点, 吞掉整段代码
 *      (vnaApi.ts 6414 -> 2251 字符, getObjects 等整段消失; 共 22 个文件受害)
 *      修复: 改为逐字符状态机 (字符串/模板/注释), 不再用正则盲替换。
 *   B2 泛型正则 `<[^>]*>` 不支持嵌套 -> `api.get<ApiResponse<Foo>>('/x')` 漏检
 *      修复: 见到 `<` 后用括号平衡扫描跳过泛型。
 *   B3 `!p.includes('/')` 丢弃单段 REST 根 -> `api.get('/patients')` 等 ~45 条漏检
 *      修复: 单段路径保留 (后端确有 @Controller('patients') 这类根路由)。
 *   B4 动词表缺 getBlob/postBlob/getList/uploadWithProgress
 *      修复: 动词表与 client.ts 实际暴露的方法对齐。
 *   B6 后端路由用「@Controller 前缀 × 文件内全部 handler」笛卡尔积 -> +435 幽灵
 *      修复: 线性扫描, 每个 handler 归属其前面最近的 @Controller。
 *   B7 匹配过宽 (含 `*` 时退化为 startsWith; 且完全忽略 HTTP 动词)
 *      修复: 一律段级比较; 另建 (verb, path) 索引以暴露动词不匹配。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** 与 src/services/api/client.ts 实际暴露的方法对齐 */
export const HTTP_VERBS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'getList',
  'getBlob',
  'postBlob',
  'putBlob',
  'patchBlob',
  'uploadWithProgress',
];

const VERB_SET = new Set(HTTP_VERBS);

/**
 * 客户端方法名 -> 实际 HTTP 动词。
 * `api.getList(...)` 发的是 GET, `api.postBlob(...)` 发的是 POST ——
 * 若不归一, 动词不匹配检查会把它们全部误报。
 */
const VERB_TO_HTTP = {
  get: 'GET',
  getList: 'GET',
  getBlob: 'GET',
  post: 'POST',
  postBlob: 'POST',
  uploadWithProgress: 'POST',
  put: 'PUT',
  putBlob: 'PUT',
  patch: 'PATCH',
  patchBlob: 'PATCH',
  delete: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
};

export function toHttpVerb(method) {
  return VERB_TO_HTTP[method] ?? method.toUpperCase();
}

/**
 * 接收者必须是 HTTP 客户端。
 *
 * 实测口径 (v3.0.6.16-7):
 *   - api 层: `api` 2257 次; 其余命中都是缓存/Map (`responseCache`/`tileObjectUrls`/
 *     `formData`/`invalidatedUrls`/`fallbackSubscribers`) —— 全非 HTTP。
 *   - 页面层: 命中最多的是 `searchParams`/`next`/`map`/`params`/`state`/`q` —— 全非 HTTP。
 * 因此改为**白名单**: 显式客户端名, 或以 `Api`/`api` 结尾的跨模块 api 对象
 * (`templatesApi`、`notificationsApi` …)。
 */
export function isHttpReceiver(name) {
  if (!name) return false;
  if (/^(api|client|http|httpClient|apiClient|axios|this|request)$/i.test(name)) return true;
  return /(Api|api)$/.test(name);
}

export const norm = (p) => p.replace(/\\/g, '/');

export function walk(dir, out = [], skipDirs = new Set(['node_modules', 'dist', '.git', 'coverage', 'build', '__tests__'])) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (skipDirs.has(e)) continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out, skipDirs);
    else out.push(p);
  }
  return out;
}

/**
 * [B1 修复] 逐字符状态机剥离注释。
 *
 * 之前的实现先用块注释正则、再剥行注释 —— 只要注释正文里出现块注释起始符
 * (例如 `// Backend: /vna/` 后面紧跟一个星号), 块注释正则就会从这里开始吞,
 * 一路吃到下一个块注释结束符, 把中间的**真实代码**删掉。
 *
 * 状态机保留字符串与模板字面量的原样内容 (它们内部可能出现 `//` 或 `/*`),
 * 只删除真正的注释。
 */
export function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    // 行注释
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // 块注释
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    // 单/双引号字符串: 原样保留 (含内部的 // 与 /*)
    if (c === "'" || c === '"') {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    // 模板字面量: 原样保留 (含 ${} 内的嵌套模板)
    if (c === '`') {
      out += c;
      i++;
      let depth = 0;
      while (i < n) {
        const ch = src[i];
        if (ch === '\\') {
          out += ch + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (ch === '$' && src[i + 1] === '{') {
          depth++;
          out += '${';
          i += 2;
          continue;
        }
        if (ch === '}' && depth > 0) {
          depth--;
          out += ch;
          i++;
          continue;
        }
        if (ch === '`' && depth === 0) {
          out += ch;
          i++;
          break;
        }
        out += ch;
        i++;
      }
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

/** 从 start 处的反引号起扫描完整模板字面量 (正确处理嵌套 ${} 与内层反引号) */
export function readTemplateLiteral(s, start) {
  let j = start + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === '`') return { value: s.slice(start + 1, j), end: j + 1 };
    if (c === '$' && s[j + 1] === '{') {
      let depth = 0;
      let k = j + 1;
      for (; k < s.length; k++) {
        if (s[k] === '`') {
          const r = readTemplateLiteral(s, k);
          if (!r) break;
          k = r.end - 1;
          continue;
        }
        if (s[k] === '{') depth++;
        else if (s[k] === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      j = k + 1;
      continue;
    }
    j++;
  }
  return null;
}

/**
 * [B2 修复] 跳过泛型参数 (支持任意嵌套, 且允许泛型内含对象类型/函数类型/换行)。
 *
 * 早期实现遇到 `;` `(` `)` 就放弃, 于是
 *   `api.get<Array<{ id: string; name: string }>>("/x")`
 * 这类**多行对象类型泛型**被整条漏掉 (regionalApi 的 3 个新端点就是这样丢的)。
 * 现在只按 `<>` 深度配对, 窗口内找不到配平才放弃。
 */
function skipGenerics(s, i) {
  if (s[i] !== '<') return i;
  let depth = 0;
  const limit = Math.min(s.length, i + 800);
  for (let j = i; j < limit; j++) {
    const c = s[j];
    if (c === '<') depth++;
    else if (c === '>') {
      depth--;
      if (depth === 0) return j + 1;
    } else if (c === ';' && depth === 0) {
      return i; // 语句已结束, 不是泛型
    }
  }
  return i;
}

/**
 * [B2/B3/B4 修复] 抽取 HTTP 调用路径。
 * 支持: 反引号模板 / 字符串字面量 / 裸标识符常量 (http.post(OCSP))。
 * 单段路径保留 (B3)。动词表含 getList/getBlob/postBlob/uploadWithProgress (B4)。
 * 泛型可嵌套 (B2)。排除非 HTTP 接收者 (headers/params/...) 与注释 (调用前请先 stripComments)。
 */
export function extractPaths(text, consts = new Map()) {
  const out = [];
  const re = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*/g;
  let m;
  while ((m = re.exec(text))) {
    const receiver = m[1];
    const verb = m[2];
    if (!VERB_SET.has(verb)) continue;
    if (!isHttpReceiver(receiver)) continue;

    let i = m.index + m[0].length;
    i = skipGenerics(text, i);
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] !== '(') continue;
    i++;
    while (i < text.length && /\s/.test(text[i])) i++;

    const c = text[i];
    if (c === '`') {
      const r = readTemplateLiteral(text, i);
      if (r && r.value) out.push(r.value);
      if (r) re.lastIndex = r.end;
    } else if (c === "'" || c === '"') {
      const end = text.indexOf(c, i + 1);
      if (end > 0) {
        out.push(text.slice(i + 1, end));
        re.lastIndex = end + 1;
      }
    } else if (c && /[A-Za-z_$]/.test(c)) {
      const idm = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
      const ident = idm ? idm[0] : '';
      if (ident && consts.has(ident)) out.push(consts.get(ident));
      if (ident) re.lastIndex = i + ident.length;
    }
  }
  return out;
}

/**
 * 收集路径前缀常量:
 *   - 普通字符串:  const API = '/templates'
 *   - 模板字面量:  const API = `${API_BASE}/ai-draft-v2`  (可链式引用)
 *   - 跨行表达式:  const API_BASE = cond ? 'http://x/api/v1' : '/api/v1'
 * 逐行锚定普通/模板常量, 否则 `const X = a !== 'undefined' ? 'y' : 'z'` 会把
 * 比较用的 'undefined' 当成 X 的值。
 */
export function collectPrefixConstants(src) {
  const map = new Map();
  for (const m of src.matchAll(/^[^\S\n]*const\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([^'"]*)['"]\s*[,;]?[^\S\n]*$/gm)) {
    map.set(m[1], m[2]);
  }
  for (const m of src.matchAll(/^[^\S\n]*const\s+([A-Za-z_$][\w$]*)\s*=\s*`([^`]*)`\s*[,;]?[^\S\n]*$/gm)) {
    if (!map.has(m[1])) map.set(m[1], m[2]);
  }
  // 跨行表达式常量: const API_BASE = cond ? 'http://x/api/v1' : '/api/v1';
  // 必须捕获到**整条语句** (到 `;` 为止), 只取一行会漏掉末行的相对路径分支。
  const declRe = /const\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]{0,400}?);/g;
  let d;
  while ((d = declRe.exec(src))) {
    const name = d[1];
    if (map.has(name)) continue;
    const rhs = d[2];
    const lits = [...rhs.matchAll(/['"]([^'"]+)['"]/g)].map((mm) => mm[1]);
    // 必须含 '/' 且不含 ':' (排除 http://host 这类绝对地址与 'undefined' 之类字面量),
    // 取最长的候选作为路径前缀。
    const pathLike = lits
      .filter((s) => s.includes('/') && !s.includes(':') && /^\/?[a-z][\w./-]*$/i.test(s))
      .sort((a, b) => b.length - a.length)[0];
    if (pathLike) map.set(name, pathLike);
  }
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const [k, v] of map) {
      if (!v.includes('${')) continue;
      const next = v.replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (full, n2) => (map.has(n2) ? map.get(n2) : full));
      if (next !== v) {
        map.set(k, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return map;
}

/** 迭代把 ${CONST} / ${expr} 替换为常量值或通配 (常量本身可能是模板) */
export function substituteConstants(tpl, consts) {
  let cur = tpl;
  for (let pass = 0; pass < 5; pass++) {
    if (!cur.includes('${')) break;
    const next = cur.replace(/\$\{([^}]*)\}/g, (_, expr) => {
      const name = expr.trim();
      if (consts.has(name)) return consts.get(name);
      const m = /^([A-Za-z_$][\w$]*)\s*[?:]/.exec(name);
      if (m && consts.has(m[1])) return consts.get(m[1]);
      return '*';
    });
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

/** 模板解析在复杂嵌套下可能带出后续代码, 这类结果不是真实路径 */
export function looksLikeCodeArtifact(p) {
  return /[`}{]/.test(p) || /\s:\s/.test(p) || p.includes('${');
}

/**
 * 静态资源 (不是 API 端点): `fetch('/models/yolov8n-dental.onnx')`、
 * 图片/字体/wasm 等。注意 `.csv`/`.json`/`.pdf` 可能是真实导出端点
 * (如后端确有 `stats/export.csv`), 因此不列入静态资源。
 */
const STATIC_ASSET_EXT = new Set([
  'onnx',
  'wasm',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'ico',
  'bmp',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  'mp4',
  'webm',
  'mp3',
  'wav',
  'glb',
  'gltf',
  'stl',
  'obj',
  'dcm',
  'nii',
  'gz',
  'zip',
  'html',
  'webmanifest',
]);

export function looksLikeStaticAsset(p) {
  const last = p.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  if (dot <= 0) return false;
  return STATIC_ASSET_EXT.has(last.slice(dot + 1).toLowerCase());
}

/**
 * 归一为「段数组」:
 *   - 去 host / 去 /api(/vN) 前缀
 *   - 去 query
 *   - 动态段 (含 ${} 或纯 *) -> '*'
 *   - 去掉前导无法解析的基址段 (未解析的常量基址会留下 '*')
 */
export function toSegments(full) {
  const stripped = full
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/?api(\/v\d+)?\/?/, '');
  const segs = stripped
    .split('?')[0]
    .split('/')
    .map((seg) => {
      if (seg === '*' || seg.includes('${')) return '*';
      const cleaned = seg.replace(/\*+$/, '');
      return cleaned === '' ? '*' : cleaned;
    })
    .filter((s) => s.length > 0);
  // 前导 '*' = 未解析的基址常量 -> 丢弃
  while (segs.length > 1 && segs[0] === '*') segs.shift();
  return segs;
}

export function toPath(full) {
  return toSegments(full).join('/');
}

/**
 * [B7 修复] 一律段级比较; 不再对 `*` 退化为 startsWith 前缀匹配。
 * 任一侧的 '*' 段, 以及后端侧 ':param' / '$op' 段视为通配。
 */
export function segmentsMatch(aSegs, bSegs) {
  if (aSegs.length !== bSegs.length) return false;
  for (let i = 0; i < aSegs.length; i++) {
    const a = aSegs[i];
    const b = bSegs[i];
    if (a === '*' || b === '*') continue;
    if (b.startsWith(':') || b.startsWith('$')) continue;
    if (a !== b) return false;
  }
  return true;
}

/** 路径命中集合 (集合元素为后端路由字符串, 段级比较) */
export function matchesRoute(pathSegs, routeSet) {
  for (const r of routeSet) {
    if (segmentsMatch(pathSegs, r.split('/'))) return true;
  }
  return false;
}

/**
 * [B6 修复] 解析后端 controller 路由。
 * 线性扫描: 每个 handler 归属其前面**最近**的 @Controller, 不再做前缀×handler 笛卡尔积。
 * 同时产出 (VERB, path) 索引以便检测动词不匹配 (B7)。
 */
export function parseBackendRoutes(files, root) {
  const routes = new Set();
  const verbRoutes = new Map();
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    const src = stripComments(raw);
    const rel = norm(relative(root, f));
    let prefix = null;
    const re = /@(Controller|Get|Post|Put|Patch|Delete|Head|Options)\(\s*(?:['"]([^'"]*)['"]\s*)?\)/g;
    let m;
    while ((m = re.exec(src))) {
      const kind = m[1];
      const arg = m[2] ?? '';
      if (kind === 'Controller') {
        prefix = arg;
        continue;
      }
      if (prefix === null) continue; // 无 @Controller 的 handler 不计
      const verb = kind.toUpperCase();
      const path = [prefix, arg]
        .filter(Boolean)
        .join('/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
      routes.add(path);
      const key = `${verb} ${path}`;
      if (!verbRoutes.has(key)) verbRoutes.set(key, new Set());
      verbRoutes.get(key).add(rel);
    }
  }
  return { routes, verbRoutes };
}

/**
 * 抽取「绕过统一 client」的裸请求路径:
 *   - `fetch('/api/v1/x')` / `fetch(\`${API}/x\`)`
 *   - `xhr.open('POST', '/api/v1/x')`
 * 这些调用同样会打到后端, 若不纳入契约对账, 就会出现两种失真:
 *   (a) 真实可达的后端端点被误报为「孤儿」(如 files/* 走 fetch 上传);
 *   (b) 页面里硬编码 `/api/v1` 的**不存在**端点完全不可见 (生产 404)。
 */
export function extractRawRequestPaths(text, consts = new Map()) {
  const out = [];
  const readArg = (i) => {
    while (i < text.length && /\s/.test(text[i])) i++;
    const c = text[i];
    if (c === '`') {
      const r = readTemplateLiteral(text, i);
      return r ? { value: r.value, end: r.end } : null;
    }
    if (c === "'" || c === '"') {
      const end = text.indexOf(c, i + 1);
      return end > 0 ? { value: text.slice(i + 1, end), end: end + 1 } : null;
    }
    return null;
  };

  const fetchRe = /(?:^|[^\w$.])fetch\s*\(\s*/g;
  let m;
  while ((m = fetchRe.exec(text))) {
    const i = m.index + m[0].length;
    const r = readArg(i);
    if (r && r.value) {
      out.push({ path: r.value, verb: 'GET' });
      fetchRe.lastIndex = r.end;
    }
  }

  const openRe = /\.open\s*\(\s*(['"])([A-Za-z]+)\1\s*,\s*/g;
  while ((m = openRe.exec(text))) {
    const verb = m[2].toUpperCase();
    const i = m.index + m[0].length;
    const r = readArg(i);
    if (r && r.value) {
      out.push({ path: r.value, verb });
      openRe.lastIndex = r.end;
    }
  }
  return out;
}

/** 前端调用点集合: path -> Set<file>; 同时保留 (verb, path) 明细 */
export function collectFrontendCalls(files, root, opts = {}) {
  const includeRaw = opts.includeRaw === true;
  const rawOnly = opts.rawOnly === true;
  const byPath = new Map();
  const byVerbPath = new Map();
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    const src = stripComments(raw);
    const consts = collectPrefixConstants(raw);
    const rel = norm(relative(root, f));

    if (includeRaw || rawOnly) {
      for (const { path: rawPath, verb } of extractRawRequestPaths(src, consts)) {
        const full = substituteConstants(rawPath, consts);
        if (looksLikeCodeArtifact(full)) continue;
        if (looksLikeStaticAsset(full)) continue;
        const path = toPath(full);
        if (!path) continue;
        if (!byPath.has(path)) byPath.set(path, new Set());
        byPath.get(path).add(rel);
        const vp = `${verb} ${path}`;
        if (!byVerbPath.has(vp)) byVerbPath.set(vp, new Set());
        byVerbPath.get(vp).add(rel);
      }
      if (rawOnly) continue;
    }

    const re = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*/g;
    let m;
    while ((m = re.exec(src))) {
      const receiver = m[1];
      const verb = m[2];
      if (!VERB_SET.has(verb)) continue;
      if (!isHttpReceiver(receiver)) continue;
      let i = m.index + m[0].length;
      i = skipGenerics(src, i);
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] !== '(') continue;
      i++;
      while (i < src.length && /\s/.test(src[i])) i++;
      const c = src[i];
      let rawPath = null;
      if (c === '`') {
        const r = readTemplateLiteral(src, i);
        if (r && r.value) rawPath = r.value;
        if (r) re.lastIndex = r.end;
      } else if (c === "'" || c === '"') {
        const end = src.indexOf(c, i + 1);
        if (end > 0) {
          rawPath = src.slice(i + 1, end);
          re.lastIndex = end + 1;
        }
      } else if (c && /[A-Za-z_$]/.test(c)) {
        const idm = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
        const ident = idm ? idm[0] : '';
        if (ident && consts.has(ident)) rawPath = consts.get(ident);
        if (ident) re.lastIndex = i + ident.length;
      }
      if (!rawPath) continue;
      const full = substituteConstants(rawPath, consts);
      if (looksLikeCodeArtifact(full)) continue;
      const path = toPath(full);
      if (!path) continue;
      if (!byPath.has(path)) byPath.set(path, new Set());
      byPath.get(path).add(rel);
      const vp = `${toHttpVerb(verb)} ${path}`;
      if (!byVerbPath.has(vp)) byVerbPath.set(vp, new Set());
      byVerbPath.get(vp).add(rel);
    }
  }
  return { byPath, byVerbPath };
}
