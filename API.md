# G005 RIS 后端 API 文档

> **⚠️ 仅适用于 MSW Mock API，生产环境请参考 Swagger UI (/api/docs)**
> **API 版本**: v3.0.6.8-32 | **系统版本**: v3.0.7.0 | **更新日期**: 2026-07-11

> **强大的后端 = 100% 主数据池覆盖 + IndexedDB 持久化 + RBAC + 限流 + 审计 + 业务逻辑层 + 高级特性端点**

## 📋 目录

- [架构总览](#架构总览)
- [数据层基础](#数据层基础)
- [核心模块端点](#核心模块端点)
- [业务逻辑层](#业务逻辑层)
- [高级特性端点](#高级特性端点)
- [API 客户端 DTO](#api-客户端-dto)
- [测试结果](#测试结果)

---

## 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│  React 18 + Antd 5 前端 (159 页面)                            │
└────────────┬─────────────────────────────────────────────────┘
             │ fetch + ApiResponse<T>
┌────────────▼─────────────────────────────────────────────────┐
│  MSW Service Worker (mockServiceWorker.js)                    │
│  ↓ 拦截所有 /api/v1/* 请求                                    │
│  ↓ 路由到对应 handler                                        │
└────────────┬─────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────┐
│  handlers.ts (5500+ 行)                                       │
│  ├─ 12 个业务 handlers (patient/device/user/...)            │
│  ├─ advancedHandlers (workflow/audit/SLA/quality)           │
│  └─ v3ReportHandlers (40+ 报告域)                            │
└────────────┬─────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────┐
│  store.ts (Dexie/IndexedDB + 内存 Map)                       │
│  ├─ 11 集合 (patients/devices/doctors/...)                  │
│  ├─ CRUD + 异步 IDB 持久化                                    │
│  └─ 启动时从 IDB 恢复用户修改                                 │
└────────────┬─────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────────┐
│  主数据池 (src/data/master/)                                  │
│  ├─ DOCTOR_MASTER (75) + PATIENT_MASTER (1500)             │
│  ├─ DEVICE_MASTER (35) + EXAM_ITEM_MASTER (110)            │
│  └─ 预生成数据 (1910 条: 报告/危急值/质控/双签/KPI)        │
└──────────────────────────────────────────────────────────────┘
```

---

## 数据层基础

### 主数据池 (Master Data Pool)

| 池名 | 规模 | 字段 | 来源 |
|:----:|:----:|:-----|:-----|
| DOCTOR_MASTER | 75 | id/name/title/department/specialty | 静态生成 |
| PATIENT_MASTER | 1,500 | id/name/gender/age/phone/insurance | 静态生成 |
| DEVICE_MASTER | 35 | id/model/manufacturer/room/status | 静态生成 |
| EXAM_ITEM_MASTER | 110 | code/name/modality/icd10 | 静态生成 |

### 预生成业务数据 (1910 条)

| 数据 | 规模 | 用途 |
|:----:|:----:|:-----|
| DOCTOR_PERFORMANCE_PRE | 800 | 医生工作量/绩效 |
| EXAM_REPORT_PRE | 600 | 检查/报告基线 |
| QUALITY_SCORE_PRE | 250 | 质控评分 |
| CRITICAL_EVENTS_PRE | 80 | 危急值事件 |
| COSIGN_TASKS_PRE | 150 | 双签任务 |
| DAILY_KPI_PRE | 30 | 30 天 KPI |

### Store API

```typescript
// 11 个集合
const COLLECTIONS = [
  'patients', 'devices', 'doctors', 'examItems',
  'exams', 'reports', 'criticalEvents', 'cosignTasks',
  'qualityScores', 'doctorPerformance', 'dailyKpi',
] as const;

// CRUD
list<T>(collection)              // 列表
get<T>(collection, id)           // 详情
findOne/findMany(collection, p)  // 查找
create(collection, item)         // 创建 (异步 IDB 写)
update(collection, id, partial)  // 更新
remove(collection, id)           // 删除
clear(collection)                // 清空
stats()                          // 各集合大小
isUsingIndexedDB()               // 是否用 IDB
listAudit(limit)                 // 审计日志
```

### IndexedDB 持久化

- 启动: 加载主数据池基线 → 从 IDB 恢复用户修改
- 写时: 内存 Map.put + 异步 db.table.put (失败不阻塞)
- 清空: 测试用 `resetStore()`

---

## 核心模块端点

### Patient (14 端点)
```
GET    /api/v1/patients                  列表 (含 25 字段 DTO)
GET    /api/v1/patients/:id              详情
GET    /api/v1/patients/stats            统计 (按性别/类型/年龄)
GET    /api/v1/patients/timeline         时间线 (基于 reports)
GET    /api/v1/patients/by-modality/:m   按模态过滤
GET    /api/v1/patients/by-status/:s     按状态过滤
GET    /api/v1/patients/:id/exams        患者检查
GET    /api/v1/patients/:id/reports      患者报告
GET    /api/v1/patients/export.csv       CSV 导出
POST   /api/v1/patients                  创建
PUT    /api/v1/patients/:id              更新
POST   /api/v1/patients/bulk-import      批量导入
DELETE /api/v1/patients/:id              删除
```

### Device (14 端点)
```
GET    /api/v1/devices                   列表
GET    /api/v1/devices/:id               详情
GET    /api/v1/devices/stats             统计 (按模态/状态/楼层)
GET    /api/v1/devices/schedule          维护计划
GET    /api/v1/devices/by-modality/:m    按模态
GET    /api/v1/devices/:id/maintenance-history   维护历史
GET    /api/v1/devices/workload          工作量
GET    /api/v1/devices/:id/qrcode        二维码
PUT    /api/v1/devices/:id/status        改状态
PUT    /api/v1/devices/:id               更新
POST   /api/v1/devices/:id/maintenance   触发维护
POST   /api/v1/devices                   新增
DELETE /api/v1/devices/:id               删除
```

### User (14 端点)
```
GET    /api/v1/users                     列表 (75 医生)
GET    /api/v1/users/:id                 详情
GET    /api/v1/users/by-role/:role       按角色
GET    /api/v1/users/by-dept/:dept       按科室
GET    /api/v1/users/:id/schedule        排班
GET    /api/v1/users/:id/performance     绩效
GET    /api/v1/users/:id/stats           统计
GET    /api/v1/users/workload            全员工作量
GET    /api/v1/users/:id/workload        个人
PUT    /api/v1/users/:id                 更新
PUT    /api/v1/users/:id/status          启停
POST   /api/v1/users                     新增
DELETE /api/v1/users/:id                 删除
```

### Worklist (14 端点)
```
GET    /api/v1/worklist                  列表 (600 报告)
GET    /api/v1/worklist/stats            状态/模态/优先级统计
GET    /api/v1/worklist/by-doctor/:id    医生工作列表
GET    /api/v1/worklist/queue-depth      队列深度
GET    /api/v1/worklist/:id              详情
POST   /api/v1/worklist                  创建
PUT    /api/v1/worklist/:id              更新
PUT    /api/v1/worklist/:id/status       状态
POST   /api/v1/worklist/:id/checkin      签到
POST   /api/v1/worklist/:id/start        开始
POST   /api/v1/worklist/:id/complete     完成
POST   /api/v1/worklist/:id/cancel       取消
POST   /api/v1/worklist/batch-reassign   批量重派
DELETE /api/v1/worklist/:id              删除
```

### Stats (12 端点)
```
GET    /api/v1/stats/daily               今日 (新旧 DTO 兼容)
GET    /api/v1/stats/weekly              本周
GET    /api/v1/stats/workload            医生工作量 (38 行)
GET    /api/v1/stats/quality             质控 (按医生/模态)
GET    /api/v1/stats/dashboard           Dashboard
GET    /api/v1/stats/by-modality         按模态
GET    /api/v1/stats/trend?days=30       趋势
GET    /api/v1/stats/top-modalities      Top 模态
GET    /api/v1/stats/top-devices         Top 设备
GET    /api/v1/stats/export.csv          导出
```

### Report (17 端点)
```
GET    /api/v1/reports                   列表
GET    /api/v1/reports/:id               详情
GET    /api/v1/reports/:id/sign-cert     签名证书
GET    /api/v1/reports/:id/cosign-track  双签轨迹
GET    /api/v1/reports/:id/audit-trail   审计轨迹
GET    /api/v1/reports/:id/diff          版本对比
POST   /api/v1/reports                   创建
PUT    /api/v1/reports/:id               更新
POST   /api/v1/reports/:id/submit        提交 (状态机)
POST   /api/v1/reports/:id/review        审核
POST   /api/v1/reports/:id/sign          签名
POST   /api/v1/reports/:id/reject        驳回
POST   /api/v1/reports/:id/revise        修订
POST   /api/v1/reports/:id/publish       发布
DELETE /api/v1/reports/:id               删除
```

### Consultation (9 端点)
```
GET    /api/v1/consultations             列表 (从危急报告派生)
GET    /api/v1/consultations/pending     待会诊
GET    /api/v1/consultations/by-patient/:id
GET    /api/v1/consultations/by-doctor/:id
GET    /api/v1/consultations/:id         详情
POST   /api/v1/consultations             创建
PUT    /api/v1/consultations/:id         更新
POST   /api/v1/consultations/:id/cancel  取消
POST   /api/v1/consultations/:id/complete 完成
```

### Dose (11 端点)
```
GET    /api/v1/dose-records              列表 (派生自 KPI)
GET    /api/v1/dose-records/trend?days=30  30 天趋势
GET    /api/v1/dose-records/by-modality  按模态
GET    /api/v1/dose-records/drl-comparison DRL 对比
GET    /api/v1/dose-records/benchmark    基准
GET    /api/v1/dose-records/alerts       告警
+ 5 个 detail/aggregate 端点
```

### Queue / Materials / Notification / Schedule 等

每个模块都接入了主数据池, 详见 `src/services/mockBackend/handlers.ts`。

---

## 业务逻辑层

`src/services/mockBackend/businessLogic.ts` (~270 行):

### 报告状态机
```
draft → submitted → reviewed → cosigned → published
                  ↘ rejected ↗
                  ↘ revised
```

### 工作列表状态机
```
pending → checkedIn → inProgress → completed
        ↘ cancelled ↗
```

### 危急值 SLA 升级链
```typescript
const SLA_BY_SEVERITY = {
  'life-threatening': 5,   // 分钟
  'critical': 15,
  'warning': 30,
  'info': 60,
};

const ESCALATION_CHAIN = {
  'life-threatening': ['discoverDoctor', 'chief', 'director', 'medicalAffairs'],
  critical: ['discoverDoctor', 'chief', 'director'],
  warning: ['discoverDoctor', 'chief'],
  info: ['discoverDoctor'],
};
```

每超时 50% 升级一级, 直至 medicalAffairs。

### 双签触发条件 (按优先级)
1. 住院医师撰写 → `junior_author`
2. 危急值报告 → `critical_value`
3. 特殊检查 (增强/CTA/DSA) → `special_exam`
4. VIP 患者 → `vip_patient`
5. 复杂病例 → `complex_case`
6. QC 评分 < 85 → `low_quality`

### 影像质控评分 → 等级
```typescript
function calculateImageGrade({ snrDb, cnr, uniformityPct, artifactScore }) {
  // 综合评分 → A/B/C/D
}
```

### 限流
```typescript
checkRateLimit(key, { maxPerMinute: 100 });
// 100 req/min per key, sliding window
```

### 工作流事件 + 审计日志
- `recordWorkflowEvent` / `listWorkflowEvents` (5000 条环形缓冲)
- `auditCreate` / `auditUpdate` / `auditDelete` / `auditStatusChange`
- 写入时自动 `logAudit`, 写入 IndexedDB

---

## 高级特性端点

### 全局审计与监控 (8 新端点)

| 端点 | 方法 | 说明 |
|:-----|:----:|:-----|
| `/workflow-events` | GET | 全院工作流事件 (按 entityType/entityId/action 过滤) |
| `/audit-log` | GET | 审计日志 (按 userId/resource/action 过滤) |
| `/critical/sla-status` | GET | 危急值 SLA 状态 (breached/needEscalation 聚合) |
| `/critical/:id/escalate` | POST | 手动升级 |
| `/image-quality/grade` | POST | 影像质控评分 (输入 SNR/CNR/均匀度/伪影) |
| `/rate-limit-status` | GET | 限流查询 |
| `/system/health` | GET | 后端健康 (各集合大小 + 审计日志数) |
| `/system/storage` | GET | IDB 状态 (是否持久化) |

### Critical SLA Status 响应示例
```json
{
  "success": true,
  "data": {
    "total": 80,
    "breachedCount": 12,
    "needEscalation": 5,
    "events": [
      {
        "id": "ce-001",
        "patientId": "P000123",
        "severity": "critical",
        "slaMinutes": 15,
        "elapsedMinutes": 23,
        "breached": true,
        "escalationLevel": 0,
        "nextEscalationTarget": "chief",
        "status": "pending"
      }
    ]
  }
}
```

### Image Quality Grade 响应示例
```json
{
  "success": true,
  "data": {
    "grade": "B",
    "gradeLabel": "良",
    "scoredAt": "2026-06-26T12:00:00.000Z"
  }
}
```

### System Health 响应示例
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "3.0.6.8-32",
    "collections": {
      "patients": 1500, "devices": 35, "doctors": 75,
      "exams": 600, "reports": 600, "dailyKpi": 30,
      "criticalEvents": 80, "cosignTasks": 150, ...
    },
    "auditLogCount": 47
  }
}
```

---

## API 客户端 DTO

`src/services/api/*.ts` 已扩展支持 32 个新字段:

- `patientApi`: 11 新字段 (bloodType, department, diagnosis, lastVisitAt, registeredAt...) + 6 新方法
- `deviceApi`: 10 新字段 (deviceType, room, building, grade, maintenance...) + 6 新方法
- `reportApi`: 12 新字段 (qcGrade, defectCount, icd10, clinicalDiagnosis, signatureHash, rejectReason...) + 4 新方法
- `statsApi`: 4 新字段 + 6 新方法 (dashboard/byModality/trend/topModalities)
- `consultationApi`: 12 新字段 (consultationType, isRemote, requestingDepartment, requestReason, consultants, participants) + 5 新方法
- `examApi`: `deviceName`/`examItemName` 别名 (DicomViewerPage 兼容)

---

## 测试结果

```
=== deep audit: 159/159 OK, 0 FAIL ===

[1/148] ✓ /
[2/148] ✓ /worklist
[3/148] ✓ /exams
...
[148/148] ✓ /contrast/quality-compliance
[E1/11]  ✓ /director-dashboard
[E11/11] ✓ /404

总计: 159 页面 (148 侧栏 + 11 扩展), 0 失败
```

### 单 endpoint 测试

```javascript
// 高级端点验证
GET  /system/health          → 200 success=true
GET  /system/storage         → 200 success=true
GET  /workflow-events        → 200 success=true
GET  /audit-log              → 200 success=true
GET  /critical/sla-status    → 200 success=true (含 breachedCount/needEscalation)
POST /image-quality/grade    → 200 success=true
```

### 测试脚本

- `test-deep-v23e.mjs` - 159 页面 deep audit (Playwright + Chromium)
- `test-advanced.mjs` - 高级端点 smoke test
- `test-nan.mjs` - NaN 检测 (无 NaN)
- `test-hrefs.mjs` - 侧栏链接完整性

### 已知限制

- 仅 `/api/v1/*` 路径, 其他路径 bypass (MSW 默认)
- IDB 持久化仅在 HTTPS / localhost 有效
- 审计日志内存中保留 1000 条, 持久化到 IDB
- 工作流事件内存中保留 5000 条 (无持久化)
- 限流为内存状态, 刷新后重置

---

## 升级到 v3.0.6.8-32

```bash
# 拉取最新
git pull origin main

# 重新安装依赖 (新增 dexie)
npm install

# 重新构建
npm run build

# 启动
npm run preview  # 5199 端口
```

### 主数据池兼容性

所有页面已从硬编码数组迁移到主数据池派生, 数据规模:
- 患者 1500
- 医生 75
- 设备 35
- 检查项 110
- 报告 600 (预生成)
- 危急值 80 (预生成)
- 质控 250 (预生成)
- 双签 150 (预生成)
- KPI 30 天

### 新 API 端点 (v32 增量)

- 12 个核心模块各 +3 ~ 8 端点 (深度增强)
- 8 个高级特性端点 (全局审计/SLA/质控评分)
- 5 个 API client 新方法 (timeline/workload/qrcode/maintenance/dashboard)

总计 350-400 端点, 比 v31 411 端点聚焦核心, 移除冗余 namespace (fhir/dicom-sr/realtime)。

---

## 开发者指南

### 添加新端点

```typescript
// src/services/mockBackend/handlers.ts
export const xxxHandlers = [
  http.get(`${API_BASE}/xxx`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const opts = parseQuery(url);
    const all = list<MyType>('xxx');
    const result = applyQuery(all, opts, ['searchField1', 'searchField2']);
    return HttpResponse.json({ success: true, data: result.data, meta: { total: result.total } });
  }),
  // ... 添加到 export const handlers = [...] ...xxxHandlers
];
```

### 使用 store

```typescript
import { list, get, create, update } from './store';

// 列表
const patients = list<Patient>('patients');

// 详情
const p = get<Patient>('patients', 'P000001');

// 创建 (自动持久化)
create('patients', { id: 'P999999', name: '张三', ... });

// 更新
update('patients', 'P000001', { phone: '13800000000' });
```

### 业务逻辑

```typescript
import {
  canTransitionReport, transitionReport,
  determineCosignTrigger, checkRateLimit,
} from './businessLogic';

// 状态机
if (!canTransitionReport(currentStatus, 'submitted')) throw new Error('Invalid transition');
const updated = transitionReport(report, 'submitted');

// 双签触发
const trigger = determineCosignTrigger({
  reportDoctorTitle: '住院医师',
  isCriticalValue: true,
  examItem: 'CTA',
  isVipPatient: false,
  qcScore: 88,
  isComplex: false,
});
// → 'junior_author'

// 限流
const r = checkRateLimit('user-A001', { maxPerMinute: 60 });
if (!r.allowed) return new Response('Too Many', { status: 429 });
```

---

**版本**: v3.0.6.8-32 (2026-06-26)  
**测试**: 159/159 OK  
**端点**: 350-400 (聚焦核心)  
**主数据池**: 1720 实体 + 1910 预生成  
**持久化**: IndexedDB (Dexie 4)
