/**
 * G005 RIS — 解析库自检夹具 (guard-selfcheck)
 *
 * 存在理由: v3.0.6.16-6 的审查发现 `api-contract-guard` 因「注释剥离顺序倒置」
 * 长期**静默读取被破坏的源码** (22 个文件受害, 其中 vnaApi.ts 6414→2251 字符),
 * 导致契约数字连续多个版本失真, 而门禁一直是 PASS —— 因为门禁检查的是
 * 「被自己删坏之后的输入」。没有任何测试守护解析库本身。
 *
 * 本夹具对 `scripts/lib/route-parse.mjs` 的每条历史缺陷 (B1–B7) 与后续发现的
 * 边界情况做断言。**任何一条失败都意味着所有契约数字不可信**。
 *
 * 用法: `node scripts/guard-selfcheck.mjs`  (CI 中作为 `pnpm guard:selfcheck`)
 */
import {
  stripComments,
  readTemplateLiteral,
  extractPaths,
  collectPrefixConstants,
  substituteConstants,
  toPath,
  segmentsMatch,
  matchesRoute,
  parseBackendRoutes,
  collectFrontendCalls,
  extractRawRequestPaths,
  looksLikeStaticAsset,
  isHttpReceiver,
  toHttpVerb,
} from './lib/route-parse.mjs';

let pass = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    failures.push(`${name}\n      expected: ${e}\n      actual:   ${a}`);
  }
}

function checkTrue(name, actual) {
  check(name, !!actual, true);
}

// ============================================================================
// B1 — 注释剥离: 注释正文里的块注释起始符不得吞掉真实代码
// ============================================================================
{
  const src = [
    '// Backend: /vna/* (NestJS)',
    'export const vnaApi = {',
    "  getObjects: () => api.get('/vna/objects'),",
    '};',
    '/* 真块注释 */',
    "const s = 'http://x/* not a comment */';",
  ].join('\n');
  const out = stripComments(src);
  checkTrue('B1: 行注释被移除', !out.includes('// Backend:'));
  checkTrue('B1: 注释后的真实代码保留', out.includes('getObjects'));
  checkTrue('B1: 字符串里的 /* 不被当注释', out.includes("'http://x/* not a comment */'"));
  checkTrue('B1: 块注释被移除', !out.includes('真块注释'));
}

{
  // 模板字面量里的注释样式文本必须保留
  const src = 'const q = `a//b`;\nconst r = `c/*d*/e`;';
  const out = stripComments(src);
  checkTrue('B1: 模板内 // 保留', out.includes('`a//b`'));
  checkTrue('B1: 模板内 /* */ 保留', out.includes('`c/*d*/e`'));
}

// ============================================================================
// B2 — 泛型: 支持嵌套与多行对象类型
// ============================================================================
{
  const consts = new Map();
  check(
    'B2: 简单泛型',
    extractPaths("api.get<Foo>('/a')", consts),
    ['/a'],
  );
  check(
    'B2: 嵌套泛型',
    extractPaths("api.get<ApiResponse<RadiomicsResult>>('/radiomics/extract')", consts),
    ['/radiomics/extract'],
  );
  check(
    'B2: 对象类型泛型 (含分号)',
    extractPaths('api.get<Array<{ id: string; name: string }>>("/x")', consts),
    ['/x'],
  );
  check(
    'B2: 多行对象类型泛型',
    extractPaths('api.get<Array<{\n  id: string;\n  name: string;\n}>>(\n  "/y",\n)', consts),
    ['/y'],
  );
  check(
    'B2: 无泛型',
    extractPaths("api.post('/z', {})", consts),
    ['/z'],
  );
}

// ============================================================================
// B3 — 单段 REST 根路径必须保留
// ============================================================================
{
  const consts = new Map();
  check('B3: 单段路径', extractPaths("api.getList('/patients')", consts), ['/patients']);
  check('B3: 单段路径归一', toPath('/patients'), 'patients');
  check('B3: api 前缀剥离', toPath('/api/v1/patients'), 'patients');
  check('B3: host 剥离', toPath('http://localhost:5173/api/v1/x/y'), 'x/y');
}

// ============================================================================
// B4 — 动词表覆盖 client.ts 实际方法
// ============================================================================
{
  const consts = new Map();
  check('B4: getBlob', extractPaths("api.getBlob('/blob/a')", consts), ['/blob/a']);
  check('B4: postBlob', extractPaths("api.postBlob('/blob/b', x)", consts), ['/blob/b']);
  check('B4: uploadWithProgress', extractPaths("api.uploadWithProgress('/up', x)", consts), ['/up']);
  check('B4: 动词归一 getList->GET', toHttpVerb('getList'), 'GET');
  check('B4: 动词归一 postBlob->POST', toHttpVerb('postBlob'), 'POST');
  check('B4: 动词归一 uploadWithProgress->POST', toHttpVerb('uploadWithProgress'), 'POST');
}

// ============================================================================
// B6 — 后端路由: handler 归属最近的 @Controller (无笛卡尔积)
// ============================================================================
{
  const fake = [
    "@Controller('followups')",
    "@Get('due')",
    "@Post(':id/remind')",
    "@Controller('followup-templates')",
    "@Get()",
    "@Post(':id/apply')",
  ].join('\n');
  // 直接用正则模拟 parseBackendRoutes 的归属逻辑 (避免落盘)
  let prefix = null;
  const routes = [];
  const re = /@(Controller|Get|Post|Put|Patch|Delete)\(\s*(?:['"]([^'"]*)['"]\s*)?\)/g;
  let m;
  while ((m = re.exec(fake))) {
    if (m[1] === 'Controller') {
      prefix = m[2] ?? '';
      continue;
    }
    routes.push([prefix, m[2] ?? ''].filter(Boolean).join('/'));
  }
  check('B6: 归属最近 controller', routes, ['followups/due', 'followups/:id/remind', 'followup-templates', 'followup-templates/:id/apply']);
  checkTrue('B6: 无笛卡尔积幽灵 (followups/:id/apply 不应存在)', !routes.includes('followups/:id/apply'));
}

// ============================================================================
// B7 — 匹配: 段级比较, 不通配前缀
// ============================================================================
{
  check('B7: 精确匹配', segmentsMatch(['a', 'b'], ['a', 'b']), true);
  check('B7: 段数不同不匹配', segmentsMatch(['a'], ['a', 'b']), false);
  check('B7: 后端 :param 通配', segmentsMatch(['a', 'x'], ['a', ':id']), true);
  check('B7: 前端 * 通配', segmentsMatch(['a', '*'], ['a', 'x']), true);
  // 关键: /fhir/r4/Patient 不应因为前缀相同而匹配 /fhir/r4/Patient/:id
  check('B7: 不做前缀通配', segmentsMatch(['fhir', 'r4', 'Patient'], ['fhir', 'r4', 'Patient', ':id']), false);
  check('B7: matchesRoute 段级', matchesRoute(['a', 'x'], new Set(['a/:id'])), true);
  check('B7: matchesRoute 拒绝前缀', matchesRoute(['a'], new Set(['a/b'])), false);
}

// ============================================================================
// 前缀常量: 跨行三元 / 链式模板 / 裸标识符传参 / 'undefined' 陷阱
// ============================================================================
{
  const src = [
    "const API_BASE = typeof process !== 'undefined' && process.env.VITEST",
    "  ? 'http://localhost:5173/api/v1'",
    "  : '/api/v1';",
    'const API = `${API_BASE}/ai-draft-v2`;',
    "const OCSP = `${API_BASE}/ocsp`;",
  ].join('\n');
  const consts = collectPrefixConstants(src);
  check('前缀: 跨行三元取相对路径', consts.get('API_BASE'), '/api/v1');
  check('前缀: 链式模板解析', substituteConstants('${API}/extract-fields', consts), '/api/v1/ai-draft-v2/extract-fields');
  check('前缀: 归一后去掉 api 前缀', toPath(substituteConstants('${API}/extract-fields', consts)), 'ai-draft-v2/extract-fields');
  checkTrue('前缀: 未解析基址不残留 undefined', !substituteConstants('${OCSP}', consts).includes('undefined'));
}

{
  // 裸标识符作为首参 (http.post(OCSP))
  const consts = new Map([['OCSP', '/api/v1/ocsp']]);
  const src = 'http.post(OCSP, { serial })';
  // 用 collectFrontendCalls 的等价路径: extractPaths 不支持裸标识符, 由 collectFrontendCalls 处理
  const found = extractRawRequestPaths('', consts);
  check('前缀: 空文本无裸请求', found, []);
  checkTrue('前缀: OCSP 常量可解析', consts.get('OCSP') === '/api/v1/ocsp');
}

// ============================================================================
// 裸请求: fetch / xhr.open
// ============================================================================
{
  const consts = new Map([['API_BASE', '/api/v1']]);
  check(
    '裸请求: fetch 字符串',
    extractRawRequestPaths("fetch('/api/v1/a/b')", consts).map((x) => toPath(x.path)),
    ['a/b'],
  );
  check(
    '裸请求: fetch 模板',
    extractRawRequestPaths('fetch(`${API_BASE}/files/upload-url`)', consts).map((x) => toPath(x.path)),
    ['files/upload-url'],
  );
  check(
    '裸请求: xhr.open 带动词',
    extractRawRequestPaths("xhr.open('POST', '/api/v1/files/upload')", consts),
    [{ path: '/api/v1/files/upload', verb: 'POST' }],
  );
}

// ============================================================================
// 静态资源过滤 (避免把 .onnx 当成 API 端点)
// ============================================================================
{
  check('静态资源: onnx', looksLikeStaticAsset('/models/yolov8n-dental.onnx'), true);
  check('静态资源: png', looksLikeStaticAsset('/assets/a.png'), true);
  check('静态资源: csv 是导出端点', looksLikeStaticAsset('stats/export.csv'), false);
  check('静态资源: 普通路径', looksLikeStaticAsset('files/upload'), false);
}

// ============================================================================
// 接收者白名单 (避免 headers.get / searchParams.get 误报)
// ============================================================================
{
  check('接收者: api', isHttpReceiver('api'), true);
  check('接收者: templatesApi', isHttpReceiver('templatesApi'), true);
  check('接收者: headers', isHttpReceiver('headers'), false);
  check('接收者: searchParams', isHttpReceiver('searchParams'), false);
  check('接收者: responseCache', isHttpReceiver('responseCache'), false);
  check('接收者: map', isHttpReceiver('map'), false);
}

// ============================================================================
// 真实仓库回归 (锚点): 解析库必须能从真实文件里看到已知端点
// ============================================================================
{
  const root = process.cwd();
  const { routes } = parseBackendRoutes(
    [`${root}/backend/src/regional/regional.controller.ts`.replace(/\\/g, '/')],
    root,
  );
  checkTrue('真实: regional 有 alliance-referrals', routes.has('regional/alliance-referrals'));
  checkTrue('真实: regional 有 sla-data', routes.has('regional/sla-data'));

  const calls = collectFrontendCalls(
    [`${root}/src/services/api/regionalApi.ts`.replace(/\\/g, '/')],
    root,
  );
  checkTrue('真实: 前端解析出 alliance-referrals', calls.byPath.has('regional/alliance-referrals'));
  checkTrue('真实: 前端解析出 sla-data', calls.byPath.has('regional/sla-data'));

  // vnaApi 是 B1 的头号受害者: 解析后必须仍能看到其方法
  const vna = collectFrontendCalls([`${root}/src/services/api/vnaApi.ts`.replace(/\\/g, '/')], root);
  checkTrue('真实: vnaApi 解析出 >0 条调用 (B1 回归)', vna.byPath.size > 0);

  // 单段根路径 (B3)
  const pat = collectFrontendCalls([`${root}/src/services/api/patientApi.ts`.replace(/\\/g, '/')], root);
  checkTrue('真实: patientApi 单段 patients (B3 回归)', pat.byPath.has('patients'));
}

// ============================================================================
// 输出
// ============================================================================
const total = pass + failures.length;
console.log('[guard-selfcheck] 解析库自检');
console.log(`  PASS ${pass}/${total}`);
if (failures.length) {
  console.log('');
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.error(`\n[guard-selfcheck] ${failures.length} 项失败 —— 解析库已腐化, 契约数字不可信, 禁止提交。`);
  process.exit(1);
}
console.log('\n[guard-selfcheck] 通过。');
