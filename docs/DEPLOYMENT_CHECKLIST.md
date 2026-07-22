# G005 放射RIS 部署检查清单

**版本**: v3.0.6.11-31 | **更新日期**: 2026-07-22

> 每次部署前逐项确认，完成后在 `[ ]` 中标记 `✓`。

---

## 0. 前置检查 (Pre-flight) — 部署前务必执行

> 部署前逐项验证，全部通过方可开始部署。

```bash
# 0.1 数据库就绪
pg_isready -h $DB_HOST -p 5432 -U g005
# 期望: 响应含 "accepting connections"

# 0.2 缓存就绪
redis-cli -h $REDIS_HOST -p 6379 ping
# 期望: PONG

# 0.3 密钥存在
kubectl get secret g005-ris-secret
# 期望: 不返回 Not Found

# 0.4 存储卷就绪
kubectl get pvc g005-ris-pvc
# 期望: STATUS=Bound

# 0.5 当前版本确认
git describe --tags
# 期望: v3.0.6.11-31（与部署计划一致）

# 0.6 CI 状态
# 检查 GitHub Actions: https://github.com/lz2026km/g005-radiology-ris/actions
# 期望: 最近一次 main 分支 CI 通过

# 0.7 依赖安装
npm ci --legacy-peer-deps
# 期望: 无报错

# 0.8 构建验证
npm run build
# 期望: 产物生成在 dist/ 目录
```

| # | 检查项 | 验证方法 | 通过条件 |
|---|--------|----------|----------|
| 0.1 | 数据库就绪 | `pg_isready` | 返回 accepting connections |
| 0.2 | 缓存就绪 | `redis-cli ping` | 返回 PONG |
| 0.3 | 密钥存在 | `kubectl get secret` | Secret 存在 |
| 0.4 | 存储卷就绪 | `kubectl get pvc` | STATUS=Bound |
| 0.5 | 版本一致 | `git describe --tags` | 与部署计划匹配 |
| 0.6 | CI 通过 | GitHub Actions | 最近提交 CI 绿 |
| 0.7 | 依赖正常 | `npm ci` | 无报错 |
| 0.8 | 构建通过 | `npm run build` | dist/ 生成 |

---

## 1. 基础设施 (8 项)

- [ ] 1.1 **DNS 配置** — 域名已解析到生产 IP，A/CNAME 记录生效
- [ ] 1.2 **TLS 证书** — 已申请并安装有效的 SSL 证书，通配符或 SAN 覆盖所有子域名
- [ ] 1.3 **负载均衡** — Nginx/ALB/Ingress Controller 已配置，健康检查端点正确
- [ ] 1.4 **CDN 配置** — 静态资源 (js/css/font) 已配置 CDN 缓存，Cache-Control 策略合理
- [ ] 1.5 **网络策略** — 安全组/防火墙仅开放必要端口 (80/443/3001/5432/6379)
- [ ] 1.6 **存储卷** — PV/PVC 已创建，StorageClass 配置正确，容量满足需求
- [ ] 1.7 **资源配额** — Namespace/Project 资源配额已设置 CPU/Memory 上限
- [ ] 1.8 **异地容灾** — 跨可用区部署或异地机房已规划

---

## 2. 后端配置 (6 项)

- [ ] 2.1 **JWT_SECRET** — 已设置为高强度随机密钥 (>= 256 位)，非默认值 `change-me-in-production`
- [ ] 2.2 **数据库连接** — `DATABASE_URL` 指向生产 PostgreSQL，连接池大小已调优
- [ ] 2.3 **Redis 连接** — `REDIS_URL` 指向生产 Redis，密码已配置
- [ ] 2.4 **MinIO/S3 配置** — 对象存储端点、AccessKey、SecretKey 已正确配置
- [ ] 2.5 **CORS 配置** — `CORS_ORIGINS` 仅允许前端域名，不暴露到公网
- [ ] 2.6 **日志级别** — `LOG_LEVEL=info` (生产不建议使用 debug)

---

## 3. 前端配置 (5 项)

- [ ] 3.1 **API 基础 URL** — `VITE_API_BASE_URL` 指向生产后端域名
- [ ] 3.2 **MSW Mock 已禁用** — `VITE_USE_MSW=false`
- [ ] 3.3 **AI Provider** — `VITE_AI_PROVIDER` 配置为后端代理方式，非直接暴露 API Key
- [ ] 3.4 **Sentry DSN** — 前端错误监控已配置 `VITE_SENTRY_DSN`
- [ ] 3.5 **WebRTC 信令** — 生产环境使用自托管信令服务器，非公共节点

---

## 4. 安全审计 (6 项)

- [ ] 4.1 **HTTPS 强制** — HSTS 头已配置，HTTP 自动重定向到 HTTPS
- [ ] 4.2 **CSP 头** — Content-Security-Policy 已配置，限制 script-src / connect-src
- [ ] 4.3 **敏感信息清理** — 代码中无硬编码密码/密钥/token，`.env` 不提交到 Git
- [ ] 4.4 **RBAC 验证** — 用户角色权限矩阵已配置，管理员/主任/医生/技师/护士职责分离
- [ ] 4.5 **审计日志启用** — 操作审计已开启，日志持久化到数据库或独立存储
- [ ] 4.6 **会话超时** — JWT token 过期时间 <= 30 分钟，refresh token 机制已实现

---

## 5. 数据与存储 (3 项)

- [ ] 5.1 **数据库迁移** — Prisma migrate 已执行，schema 与生产数据库一致
- [ ] 5.2 **种子数据** — 基础字典数据已导入 (设备、科室、用户、检查项目)
- [ ] 5.3 **IndexedDB 兼容** — 前端 IndexedDB 在 HTTPS 下正常工作已验证

---

## 6. 备份配置 (3 项)

- [ ] 6.1 **自动备份 CronJob** — 每日全量 + 每 6 小时增量备份已部署至 K8s
- [ ] 6.2 **备份存储** — 备份文件写入持久卷，异地同步已配置
- [ ] 6.3 **恢复演练** — 每月恢复演练已排入运维日历，最近一次已验证通过

---

## 7. 监控告警 (4 项)

- [ ] 7.1 **Prometheus 指标** — `/api/health` 端点可访问，指标已接入 Prometheus
- [ ] 7.2 **告警规则** — PrometheusRule.yaml 已应用 (ServiceDown/DB连接失败/错误率/超时/SLA)
- [ ] 7.3 **通知渠道** — 钉钉/企业微信/邮件告警通知已配置并测试
- [ ] 7.4 **Grafana 仪表盘** — 关键指标仪表盘已导入，性能基线已记录

---

## 8. 等保三级合规 (5 项)

- [ ] 8.1 **身份鉴别** — 双因素认证或强密码策略已实施
- [ ] 8.2 **访问控制** — 最小权限原则，默认禁止所有访问，按需授权
- [ ] 8.3 **数据完整** — 数据库读写使用 TLS，备份文件校验和已启用
- [ ] 8.4 **安全审计** — 用户操作日志保留 >= 180 天，日志不可篡改
- [ ] 8.5 **资源控制** — 会话超时、并发限制、API 限流已配置

---

## 9. 验收测试 (3 项)

- [ ] 9.1 **健康检查** — `curl -f https://ris.g005.local/api/health` 返回 200
- [ ] 9.2 **端到端测试** — Playwright E2E 测试全部通过 (`npm run test:e2e`)
- [ ] 9.3 **Lighthouse 审计** — 性能/可访问性/最佳实践评分 >= 90

---

## 10. 回滚预案 (2 项)

- [ ] 10.1 **回滚方案** — 回滚步骤文档化，包括数据库回滚和代码回退
- [ ] 10.2 **版本标记** — Git tag 标记当前版本，Docker image tag 版本明确

---

## 快速检查命令

```bash
# 健康检查
curl -f https://ris.g005.local/api/health

# 数据库连接
kubectl exec -it deploy/g005-ris -- curl -f localhost:3001/api/health

# 检查环境变量 (不应暴露生产密钥)
kubectl describe secret g005-ris-secret

# 检查 pod 运行状态
kubectl get pods -l app=g005-ris
kubectl get hpa -l app=g005-ris

# 检查备份状态
curl -f https://ris.g005.local/api/backup/status

# 检查 Prometheus rules
kubectl get prometheusrule g005-ris-alerts -o yaml

# 端到端验证
npm run test:e2e
```

---

**审批**:

| 角色 | 姓名 | 日期 | 签字 |
|------|------|------|------|
| 开发负责人 | — | — | — |
| 运维负责人 | — | — | — |
| 安全负责人 | — | — | — |
