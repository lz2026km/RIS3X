# Form Submit 验证报告 v3.0.6.11-21

生成时间: 2026-07-12T11:39:46.404Z

通过率: **5/10** (warn=2, fail=1, skip=2)

| # | 页面 | 路径 | 状态 | Form | API 调用 | UI 反馈 |
|---|------|------|------|------|----------|---------|
| 1 | login | /login | FAIL | Y | POST /api/v1/auth/login | URL=http://localhost:5191/login |
| 2 | critical-value | /critical-value | PASS | Y | GET /src/services/api/index.ts?t=1783855284242 / GET /src/services/api/safetyApi.ts?t=1783855284242 / GET /src/services/api/client.ts?t=1783855284242 |  | apiCalls=36 toast=1 |
| 3 | queue-call | /queue-call | SKIP | N | GET /src/services/api/index.ts?t=1783855284242 / GET /src/services/api/client.ts?t=1783855284242 / GET /src/services/api/v3Api.ts?t=1783855284242 | 未找到叫号按钮(空队列或仅 busy) |
| 4 | appointments | /appointments | PASS | Y | GET /src/services/api/index.ts?t=1783855284242 / GET /src/services/api/client.ts?t=1783855284242 / GET /src/services/api/v3Api.ts?t=1783855284242 | 新预约 - 新增API调用=0 |
| 5 | patient | /patients | PASS | Y | GET /src/services/api/index.ts?t=1783855284242 / GET /src/services/api/client.ts?t=1783855284242 / GET /src/services/api/v3Api.ts?t=1783855284242 | 新建患者 - 新增API调用=0 |
| 6 | regional-report | /regional-report | WARN | Y | GET /src/services/api/regionalApi.ts?t=1783855284242 / GET /src/services/api/client.ts?t=1783855284242 / GET /src/services/api/retry.ts | 会诊申请 - 新增API=0 |
| 7 | dental/implant | /dental/implant-3d | PASS | Y | GET /src/services/api/dentalApi.ts?t=1783855284242 / GET /src/services/api/client.ts?t=1783855284242 / GET /src/services/api/retry.ts | antd Form 提交 - 新增API=1 |
| 8 | dental/treatment | /dental/treatment | SKIP | N | GET /api/v1/dental/treatments / GET /api/v1/dental/treatments | form 数量=0 (页面无 form) |
| 9 | cosign | /cosign | PASS | Y | GET /src/services/api/reviewApi.ts?t=1783855284242 / GET /src/services/api/index.ts?t=1783855284242 / GET /src/services/api/client.ts?t=1783855284242 | 拒签表单 - 新增API=1 |
| 10 | compliance | /compliance | WARN | Y | GET /src/services/api/index.ts?t=1783855284242 / GET /src/services/api/client.ts?t=1783855284242 / GET /src/services/api/v3Api.ts?t=1783855284242 | URL=http://localhost:5191/ body含合规关键词=true |

## 详情

### login (fail)
- 路径: /login
- Form 元素: YES
- API 调用: 1
- 错误:
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.%s 
    at Navigate (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4442:5)
    at RenderedRoute (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4069:5)
    at Routes (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4539:5)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856276741:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856276741:32:3)
  - [console.error] Warning: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.%s 
    at Navigate (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4442:5)
    at RenderedRoute (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4069:5)
    at Routes (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4539:5)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856276741:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856276741:32:3)
  - [console.error] Warning: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.%s 
    at Navigate (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4442:5)
    at RenderedRoute (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4069:5)
    at Routes (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4539:5)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856276741:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856276741:32:3)
  - [console.error] Warning: Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render.%s 
    at Navigate (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4442:5)
    at RenderedRoute (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4069:5)
    at Routes (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4539:5)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856276741:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856276741:32:3)
- UI: URL=http://localhost:5191/login

### critical-value (pass)
- 路径: /critical-value
- Form 元素: YES
- API 调用: 36
- 错误:
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856283517:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856283517:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856283517:32:3)
- UI:  | apiCalls=36 toast=1

### queue-call (skip)
- 路径: /queue-call
- Form 元素: NO
- API 调用: 35
- 错误:
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856295951:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856295951:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856295951:32:3)
  - [console.error] Warning: Received NaN for the `%s` attribute. If this is expected, cast the value to a string.%s children 
    at div
    at div
    at div
    at div
    at div
    at div
    at main
    at div
    at QueueCallPage (http://localhost:5191/src/pages/QueueCallPage.tsx?t=1783855284242:589:39)
    at RequireAuth (http://localhost:5191/src/components/auth/RequireAuth.tsx:21:31)
    at RenderedRoute (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4069:5)
    at Routes (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4539:5)
    at Suspense
    at div
    at div
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856295951:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856295951:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856295951:32:3)
- UI: 未找到叫号按钮(空队列或仅 busy)

### appointments (pass)
- 路径: /appointments
- Form 元素: YES
- API 调用: 35
- 错误:
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856295951:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856295951:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856295951:32:3)
- UI: 新预约 - 新增API调用=0

### patient (pass)
- 路径: /patients
- Form 元素: YES
- API 调用: 35
- 错误:
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856295951:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856295951:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856295951:32:3)
- UI: 新建患者 - 新增API调用=0

### regional-report (warn)
- 路径: /regional-report
- Form 元素: YES
- API 调用: 3
- 错误:
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856330787:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856330787:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856330787:32:3)
- UI: 会诊申请 - 新增API=0

### dental/implant (pass)
- 路径: /dental/implant-3d
- Form 元素: YES
- API 调用: 10
- 错误:
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856330787:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856330787:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856330787:32:3)
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856330787:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856330787:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856330787:32:3)
  - [console.error] Warning: [antd: Statistic] `valueStyle` is deprecated. Please use `styles.content` instead.
- 备注: /dental/implant form=0
- UI: antd Form 提交 - 新增API=1

### dental/treatment (skip)
- 路径: /dental/treatment
- Form 元素: NO
- API 调用: 2
- 错误:
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856330787:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856330787:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856330787:32:3)
- 备注: 当前 DentalTreatmentPage 仅渲染列表 (DentalTreatmentTable) — 无 form,记录 P0
- UI: form 数量=0 (页面无 form)

### cosign (pass)
- 路径: /cosign
- Form 元素: YES
- API 调用: 41
- 错误:
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856330787:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856330787:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856330787:32:3)
- UI: 拒签表单 - 新增API=1

### compliance (warn)
- 路径: /compliance
- Form 元素: YES
- API 调用: 33
- 错误:
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856330787:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856330787:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856330787:32:3)
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856330787:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856330787:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856330787:32:3)
  - [console.error] Warning: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.%s /integration/mllp-monitor 
    at div
    at nav
    at aside
    at div
    at AppLayout (http://localhost:5191/src/layouts/AppLayout.tsx?t=1783856330787:489:41)
    at AuthGate (http://localhost:5191/src/App.tsx?t=1783856330787:65:31)
    at UndoToastProvider (http://localhost:5191/src/components/UndoToast.tsx:22:37)
    at NProgressBar (http://localhost:5191/src/components/NProgressBar.tsx:21:32)
    at ErrorBoundary (http://localhost:5191/src/components/ErrorBoundary.tsx:23:5)
    at Router (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:4482:15)
    at BrowserRouter (http://localhost:5191/node_modules/.vite/deps/react-router-dom.js?v=46a2cc77:5228:5)
    at div
    at http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:24194:16
    at LocaleProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:8072:13)
    at MotionWrapper (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10265:32)
    at ProviderChildren (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10365:5)
    at ConfigProvider (http://localhost:5191/node_modules/.vite/deps/antd.js?v=46a2cc77:10702:27)
    at I18nextProvider (http://localhost:5191/node_modules/.vite/deps/react-i18next.js?v=9827b025:792:3)
    at ErrorBoundary (http://localhost:5191/node_modules/.vite/deps/react-error-boundary.js?v=1a29f53a:18:5)
    at Provider (http://localhost:5191/src/components/Provider.tsx:156:28)
    at ConfigBootstrapper (http://localhost:5191/src/components/config/ConfigBootstrapper.tsx:24:38)
    at App (http://localhost:5191/src/App.tsx?t=1783856330787:32:3)
  - [console.error] Warning: [antd: Space] `direction` is deprecated. Please use `orientation` instead.
- 备注: P0: src/pages/CompliancePage.tsx 未在 routeTable 注册;实际路由为 /audit-compliance (不同页面) | /audit-compliance forms=0
- UI: URL=http://localhost:5191/ body含合规关键词=true

