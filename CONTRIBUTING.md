# Contributing to G005 Radiology RIS

欢迎贡献 G005 放射科 RIS 系统！本文档涵盖开发流程、代码规范与审查标准。

## 项目简介

G005 是面向**三级甲等综合医院**的企业级放射信息系统(RIS)，对标全球前 10 大 PACS/RIS 厂商，涵盖从 AI 辅助到患者门户的完整放射科工作流。当前版本 `v3.0.6.11-33`，17 模块 / 9,000+ 升级点 / 后端 251 端点 + IndexedDB 持久化。

## 技术栈概述

| 层 | 技术 | 版本 |
|---|------|------|
| 前端框架 | React | 18.3.1 |
| 构建工具 | Vite | 5.4.11 |
| UI 组件库 | Ant Design | 6.5.0 |
| 状态管理 | Zustand 5 + XState 5 |
| 路由 | React Router | 6.28.0 |
| 后端框架 | NestJS | 11 |
| ORM | Prisma | 5 |
| 数据库 | PostgreSQL | 16 |
| 语言 | TypeScript | 5.6.3 |
| 包管理 | pnpm | 9 |
| Mock | MSW | 2 |
| 测试 | Vitest + Playwright |
| 代码检查 | ESLint 9 + Prettier |
| 提交规范 | commitlint (conventional commits) |
| Git Hooks | Husky 9 + lint-staged |

## 开发环境搭建

### 前置要求

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Docker Desktop** (可选，用于 PostgreSQL)
- **Git** (推荐 latest)

### 1. 克隆仓库

```bash
git clone <repo-url>
cd G005-RISv-3.0.0
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 环境变量

```bash
cp .env.example .env.development
# 根据本地环境修改 .env.development
```

### 4. 启动 PostgreSQL (Docker)

```bash
docker compose -f backend/docker-compose.yml up -d
```

### 5. 初始化数据库

```bash
cd backend
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
cd ..
```

### 6. 启动开发服务器

```bash
# 前端 (Vite dev server, 默认 5191)
pnpm dev

# 后端 (NestJS watch mode)
pnpm server:dev
```

### 7. 验证

```bash
# 单元测试
pnpm test:run

# E2E 测试
pnpm test:e2e

# 代码检查
pnpm lint
pnpm typecheck
```

## 分支策略 (Git Flow)

采用 Git Flow 分支模型：

```
main        ─── 生产分支，只接受 release/ 合并
  ├── develop    ─── 开发主分支
  │   ├── feat/xxx  ─── 功能分支
  │   ├── fix/xxx   ─── 修复分支
  │   └── refactor/xxx ─── 重构分支
  └── release/x.x.x ─── 发布分支
```

### 分支命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能 | `feat/<简短描述>` | `feat/report-ai-assistant` |
| 修复 | `fix/<简短描述>` | `fix/doseTrack-i18n-lazy` |
| 重构 | `refactor/<模块>-<描述>` | `refactor/reportPage-split` |
| 文档 | `docs/<内容>` | `docs/api-endpoints` |
| 发布 | `release/v<版本>` | `release/v3.0.6.11-33` |

### 分支生命周期

1. 从 `develop` 创建 `feat/xxx` 分支
2. 开发完成后提交 PR 到 `develop`
3. Code Review 通过后 squash merge
4. 发布时从 `develop` 创建 `release/vX.X.X`
5. 测试通过后合并到 `main` 并打 tag
6. 合并回 `develop`

## 提交规范 (commitlint / Conventional Commits)

本项目使用 [commitlint](https://commitlint.js.org/) 强制 Conventional Commits 规范。

### 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 允许的类型

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 代码格式 (不影响功能) |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `build` | 构建/依赖变更 |
| `ci` | CI 配置变更 |
| `chore` | 杂项 |
| `revert` | 回滚 |

### 示例

```
feat(report): 新增 AI 续写功能

- 集成 DeepSeek-Opthalmic 模型
- 支持 3 种写作风格
- 多轮改写 + 反馈闭环

Closes #123
```

提交信息使用**中文**描述变更内容，scope 使用英文模块名。

## 代码审查流程

### 审查清单

每个 PR 需通过以下审查：

1. **功能正确性** — 需求是否实现、边界情况
2. **TypeScript 类型** — `pnpm typecheck` 无错误
3. **Lint** — `pnpm lint` 无错误
4. **测试** — 新增/修改代码有对应测试覆盖
5. **代码风格** — 符合 Prettier 格式、遵循项目约定
6. **i18n** — 新增文案同时添加中英文翻译键
7. **无死代码** — 删除的代码确实未被引用

### 审查流程

1. PR 作者自检通过后请求审查
2. 至少 1 名 reviewer Approve
3. 所有 Comment 需 resolved
4. CI 全部通过后合并

### Reviewer 职责

- 检查逻辑正确性与架构合理性
- 确保测试覆盖率不下降
- 检查命名/注释/代码组织是否符合项目惯例
- 检查是否引入安全/性能风险

## PR 提交流程

### 提交流程

```bash
# 1. 确保分支最新
git checkout develop
git pull
git checkout -b feat/my-feature

# 2. 开发并提交
git add .
pnpm commit  # 使用 commitlint 交互式提交

# 3. 同步远程
git push -u origin feat/my-feature

# 4. 创建 PR (GitHub)
#    - base: develop
#    - 标题: [类型] 简短描述
#    - 描述: 变更内容、测试方法、关联 Issue
```

### PR 模板

```markdown
## 描述
[变更的详细描述]

## 类型
- [ ] feat: 新功能
- [ ] fix: Bug 修复
- [ ] refactor: 重构
- [ ] docs: 文档
- [ ] test: 测试

## 关联 Issue
Closes #[issue-number]

## 测试
- [ ] 单元测试通过
- [ ] E2E 测试通过
- [ ] 手动测试

## 检查清单
- [ ] TypeScript 无错误
- [ ] Lint 通过
- [ ] 新增 i18n 键
- [ ] 无控制台警告/错误
```

### PR 合并

- 默认使用 **Squash merge** 保持 commit 历史整洁
- 合并后删除远程分支

## 测试要求

### 测试类型

| 类型 | 工具 | 覆盖要求 |
|------|------|----------|
| 单元测试 | Vitest | 核心逻辑 >= 80% |
| 组件测试 | Vitest + Testing Library | 页面级组件 >= 60% |
| E2E 测试 | Playwright | 关键路径覆盖 |
| 无障碍测试 | vitest-axe | 页面级可用性 |
| 视觉回归 | Storybook + Playwright | UI 组件 |

### 执行命令

```bash
# 全部单元测试
pnpm test:run

# 带覆盖率
pnpm test:coverage

# E2E
pnpm test:e2e

# 更新 snapshot
pnpm test:run --update
```

### 测试要求

- 新增功能必须包含对应的测试用例
- Bugfix 必须添加回归测试
- 测试命名使用 `describe` / `it` / `expect` 模式
- Mock 外部依赖，聚焦业务逻辑
- 测试文件放在对应模块的 `__tests__` 目录或 `.test.ts` 后缀

## 代码风格

### 通用规则

- **缩进**: 2 空格 (Prettier 配置)
- **引号**: 单引号
- **分号**: 始终使用
- **行尾**: LF
- **行宽**: 100 字符 (Prettier)

### TypeScript

- 优先使用 `interface` 而非 `type` 定义对象形状
- 使用 `const` / `let` 而非 `var`
- 函数返回值必须显式标注类型
- 使用可选链 `?.` 和空值合并 `??`
- 避免 `any`，使用 `unknown` 作为安全替代

### React

- 函数组件 + Hooks
- 使用 Zustand 管理全局状态
- 使用 XState 管理复杂工作流状态
- 组件文件使用 `.tsx` 后缀
- props 使用 `interface` 定义并导出

### 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `ReportWritePage` |
| 文件 (组件) | PascalCase | `ReportWritePage.tsx` |
| 文件 (工具) | camelCase | `dateUtils.ts` |
| 函数/变量 | camelCase | `formatDate()` |
| 常量 | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| 类型/接口 | PascalCase | `IReport` / `ReportStatus` |
| 枚举 | PascalCase + UPPER | `enum ReportStatus { DRAFT, SUBMITTED }` |
| 目录 | kebab-case | `report-writer/` |

### 导入顺序

1. 外部库 (react, antd 等)
2. 内部绝对路径 (`@/...`)
3. 相对路径 (`./...`)
4. 类型导入 (`import type {...}`)

每组之间空一行。

### CSS/Style

- 使用 Ant Design Token 系统
- 避免内联样式
- 组件级样式使用 CSS Modules (`.module.css`)
- 全局样式在 `src/styles/` 目录

### i18n

- 所有用户可见文本必须使用 i18n key
- 中文 key 在 `zh-CN` locale，英文在 `en-US`
- key 命名: `模块.组件.描述` (如 `report.aiAssist.generate`)
- 新增 key 后运行 `pnpm i18n:scan` 扫描

### Git

- 遵循 Conventional Commits
- 提交粒度: 一个逻辑变更一个 commit
- 不提交 `node_modules/`、`dist/`、`.env` 文件
- commit 前自动运行 lint-staged

## 快速参考

```bash
# 常用命令
pnpm dev              # 启动前端
pnpm server:dev       # 启动后端
pnpm build            # 构建
pnpm test:run         # 单元测试
pnpm test:e2e         # E2E 测试
pnpm lint             # 代码检查
pnpm lint:fix         # 自动修复
pnpm typecheck        # 类型检查
pnpm format           # 格式化
pnpm commit           # 交互式提交
pnpm i18n:scan        # i18n key 扫描
```

## 问题反馈

- 提交 Issue: https://github.com/lz2026km/g005-radiology-ris/issues
- 安全漏洞: 直接联系维护者
- 功能建议: 先开 Discussion 讨论再提 PR
