# G005 RIS 临床配置中心 (ClinicalConfigCenter)

> 阶段 1 + 2 实施 (v3.0.6.8-108+)
> 范围：牙科 + 眼科 30+ 类硬编码参数抽象为 JSON + zod + 双轨架构

## 架构总览

```
src/config/clinicalConfig/
  primitives.ts         # 共享 zod primitive (idSchema, probabilitySchema, modalitySchema, ...)
  loader.ts             # JSON loader + mergeLayers (defaults <- override <- patch) + validate
  registry.ts           # 模块注册中心 (7 个模块元数据)
  bootstrap.ts          # 启动时一次加载 (loadAll) + 缓存
  index.ts              # 公开 API 出口
  defaults/             # 项目内置默认 JSON (7 个)
  modules/              # 每类参数的 zod schema (7 个)
  hooks/                # React hook (useGradingScales)
  __tests__/            # vitest 单元测试 (12 通过)

src/components/config/
  ConfigBootstrapper.tsx # 启动校验 + ConfigurationError 页 (Epic 风格)

src/App.tsx             # 挂载 <ConfigBootstrapper> 在最外层
```

## 7 个模块

| Key | 类别 | 用途 | 默认 JSON |
|---|---|---|---|
| gradingScales | clinical | 眼科分级量表 (DR/LOCS3/ETDRS/ISNT…) | 5 个 full + 6 个 metadata |
| aiModels | clinical | AI 模型注册 (12 vendor 模型) + 诊断结果 | 3 demo |
| imagingDevices | device | 牙科 CBCT/Pano/Periapical/Scan 设备 | 25 条 |
| kpiThresholds | operational | 24 个 KPI 指标 + 目标值 + 趋势 | 3 demo |
| reportTemplates | reporting | 报告章节结构 (text/findings/grading/images) | 2 demo |
| findingsLexicon | clinical | 92 条影像所见词典 (严重度+关键词) | 3 demo |
| iolFormulas | clinical | 8 种 IOL 公式 (SRK/T/Holladay/Barrett/Kane…) | 7 公式 + 4 AL band |

## 启动流程

1. App 启动 → `ConfigBootstrapper` 渲染
2. `await loadAll()` 触发每个模块的 `loadDefaults` + `mergeLayers` + `validate`
3. 成功 → 渲染原 App
4. 失败 → 显示 `ConfigurationError` 页面 (Epic 风格：不让应用启动)
5. 错误信息包含：模块名、schema 版本、最多 5 条具体错误路径

## 用法

### 在页面里读取

```ts
import { useGradingScales } from "@/config/clinicalConfig/hooks/useGradingScales";

const { scales } = useGradingScales();
scales.forEach(s => s.options.map(...));
```

### 重新加载某模块（admin UI 保存后）

```ts
import { reloadModule } from "@/config/clinicalConfig/bootstrap";
await reloadModule("aiModels");
```

### 添加新模块

1. 在 `modules/` 加 `xxx.schema.ts` (用 zod)
2. 在 `defaults/` 加 `xxx.json`
3. 在 `registry.ts` 加 meta + 切 case 在 `loadDefaults`
4. (可选) 在 `hooks/` 加 `useXxx.ts`

## 错误恢复

- 启动时 zod 失败 → ConfigurationError 页面 + Retry 按钮
- 校验失败的 JSON 不进入缓存，下次启动仍报错
- 阶段 5 将加入 `public/config-overrides/` 覆盖层 + dev HMR

## 验证状态 (本阶段末)

- `npm run build`: 64s 通过
- 186 sidebar 链接 page error: 0
- vitest 单元测试: 12 个全过 (gradingScales schema + loader merge/validate)
- 行为不变: 原页面继续用旧的 `MOCK_xxx` import，coexistence OK