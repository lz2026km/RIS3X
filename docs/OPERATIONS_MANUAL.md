# G005 放射RIS 运维手册

**版本**: v3.0.6.11-33 | **更新日期**: 2026-07-22

## 目录

- [系统架构概览](#系统架构概览)
- [启动方式](#启动方式)
- [健康检查](#健康检查)
- [日志查看](#日志查看)
- [常见问题排查](#常见问题排查)
- [扩容方法](#扩容方法)
- [监控与告警](#监控与告警)
- [配置管理](#配置管理)

---

## 系统架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户终端                                  │
│            Chrome 120+ / Edge 120+ / Firefox 120+                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS / WSS
┌───────────────────────────▼─────────────────────────────────────┐
│                    Nginx / 负载均衡器                              │
│          SPA fallback + 静态资源缓存 + API 代理                    │
└────┬────────────────────────────────────┬───────────────────────┘
     │ /api/*                             │ 静态资源 (dist/)
┌────▼────────────────────┐  ┌───────────▼───────────────────────┐
│   ris-backend (Node.js) │  │ ris-frontend (React 18 + Vite)    │
│   Express + 中间件栈    │  │ Cornerstone3D + Yjs + Dexie      │
│   Port 3001             │  │ Port 5173                         │
│                         │  │ MSW Mock (开发模式)               │
└──┬──────────┬───────────┘  └───────────────────────────────────┘
   │          │
   ▼          ▼
┌──────┐ ┌──────┐
│PostgreSQL    │ Redis │
│ 16   │ │ 7    │
└──┬───┘ └──────┘
   │
   ▼
┌──────┐
│MinIO │
│(S3)  │
└──────┘
```

### 核心组件

| 组件 | 技术栈 | 端口 | 说明 |
|------|--------|------|------|
| 前端 | React 18 + Vite + Antd 5 | 5173/5191 | SPA, DICOM 浏览器, CRDT 协同 |
| 后端 | Express + Prisma | 3001 | REST API, HL7/FHIR 网关 |
| 数据库 | PostgreSQL 15/16 | 5432 | 主数据存储 |
| 缓存 | Redis 7 | 6379 | 会话/限流/队列 |
| 对象存储 | MinIO (S3 协议) | 9000 | DICOM 文件/备份 |
| 反向代理 | Nginx | 80/443 | 静态托管 + API 代理 |

---

## 启动方式

### 开发模式

```bash
# 前端开发服务器 (HMR)
npm run dev          # → http://localhost:5191

# 后端开发服务器 (热重载)
npm run server:dev   # → http://localhost:3001

# 使用 MSW Mock (无需后端)
VITE_USE_MSW=true npm run dev
```

### 生产构建

```bash
# 构建前端
npm run build        # 产物 → dist/

# 启动后端服务
npm run server       # → http://localhost:3001
```

### Docker Compose

```bash
# 启动全栈 (PostgreSQL + Redis + MinIO + 后端 + 前端)
docker compose -f deploy/docker-compose.yml up -d

# 查看日志
docker compose -f deploy/docker-compose.yml logs -f ris-backend

# 停止
docker compose -f deploy/docker-compose.yml down
```

### 停止服务

```bash
# 本地开发
# 按 Ctrl+C 终止 dev/server 进程

# Docker Compose
docker compose -f deploy/docker-compose.yml down

# Kubernetes (无损停止)
kubectl scale deployment g005-ris --replicas=0
```

### 重启服务

```bash
# 本地开发
# 重新执行 npm run dev 或 npm run server

# Docker Compose
docker compose -f deploy/docker-compose.yml restart

# Kubernetes 滚动重启
kubectl rollout restart deployment g005-ris
kubectl rollout status deployment g005-ris
```

### Kubernetes

```bash
# 部署到 K8s 集群
kubectl apply -f deploy/kubernetes.yaml

# 查看部署状态
kubectl get pods -l app=g005-ris
kubectl get svc -l app=g005-ris

# 使用 Helm
helm upgrade --install g005-ris deploy/helm/ --namespace ris --create-namespace
```

---

## 健康检查

### 端点

```
GET /api/health
```

### 响应示例

```json
{
  "status": "ok",
  "version": "3.0.6.11-33"
}
```

### Docker HEALTHCHECK

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /api/health
    port: 3001
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## 日志查看

### Docker

```bash
docker compose -f deploy/docker-compose.yml logs -f ris-backend
docker compose -f deploy/docker-compose.yml logs -f ris-frontend
```

### Kubernetes

```bash
# 查看后端 pod 日志
kubectl logs -f pod/ris-backend-xxx

# 查看前端 pod 日志
kubectl logs -f deploy/g005-ris

# 查看特定容器的日志
kubectl logs -l app=g005-ris --all-containers

# 最近 1 小时日志
kubectl logs --since=1h -l app=g005-ris
```

### 审计日志 (应用层)

后端自动记录审计日志到控制台:
```
[AUDIT] POST /api/v1/reports 201 45ms
[AUDIT] GET /api/v1/worklist 200 12ms
```

### 日志级别

环境变量 `LOG_LEVEL` 控制后端日志级别:
- `error` — 仅错误
- `warn` — 警告 + 错误
- `info` — 常规 (默认)
- `debug` — 详细调试

---

## 常见问题排查

### 启动失败

| 现象 | 原因 | 排查方法 | 解决方案 |
|------|------|----------|----------|
| 端口占用 | 3001/5173/5432/6379 被占用 | `netstat -ano | findstr :3001` | 修改 PORT 环境变量或停用占用进程 |
| 依赖缺失 | node_modules 不完整 | `npm ls` 检查缺失包 | `npm ci` 重新安装 |
| Prisma 错误 | 数据库模型变更 | `npx prisma generate` | 重新生成 Prisma client |
| MSW 注册失败 | Service Worker 未注册 | 浏览器 DevTools → Application → Service Workers | `npx msw init public/ --save` |

### 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
docker compose ps postgres

# 测试连接
psql -h localhost -U g005 -d g005 -c "SELECT 1"

# 查看连接池状态
kubectl exec -it pod/postgres-xxx -- psql -U g005 -c "SELECT * FROM pg_stat_activity;"
```

**环境变量检查**:
```bash
echo %DATABASE_URL%
# 期望: postgresql://g005:g005@localhost:5432/g005?schema=public
```

### Redis 连接失败

```bash
# 检查 Redis 是否运行
docker compose ps redis

# 测试连接
redis-cli -h localhost -p 6379 ping
# 期望: PONG

# 检查 Redis 配置
kubectl exec -it pod/redis-xxx -- redis-cli info server
```

### API 502 / 服务不可用

排查步骤:
1. 检查后端 pod 状态: `kubectl get pods`
2. 检查健康检查端点: `curl http://localhost:3001/api/health`
3. 检查后端日志: `kubectl logs -f pod/ris-backend-xxx`
4. 检查 Nginx 配置: `kubectl exec -it pod/nginx-xxx -- cat /etc/nginx/conf.d/default.conf`
5. 检查 ingress: `kubectl describe ingress g005-ris-ingress`

### 内存/CPU 过高

```bash
# 查看资源使用
kubectl top pods
kubectl top nodes

# 查看容器资源限制
kubectl describe pod ris-backend-xxx | findstr -A2 "Limits"
```

---

## 扩容方法

### Kubernetes HPA (自动扩缩容)

当前配置 (deploy/kubernetes.yaml):
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - resource:
        name: cpu
        target:
          averageUtilization: 70
          type: Utilization
    - resource:
        name: memory
        target:
          averageUtilization: 80
          type: Utilization
```

**手动调整副本数**:
```bash
# 临时调整 (近期将恢复)
kubectl scale deployment g005-ris --replicas=5

# 永久调整 (修改 HPA 配置)
kubectl edit hpa g005-ris-hpa
# 修改 minReplicas/maxReplicas 字段
```

**修改 Helm values**:
```yaml
# deploy/helm/values.yaml
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
```

### 垂直扩容 (资源调整)

```bash
kubectl edit deployment g005-ris
# 修改 resources.limits.cpu / resources.limits.memory
```

### PodDisruptionBudget (PDB)

当前配置保证最少 1 个 pod 可用:
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
spec:
  minAvailable: 1
```

---

## 监控与告警

详见 [MONITORING.md](./MONITORING.md)。

### 关键指标

| 指标 | 端点 | 说明 |
|------|------|------|
| HTTP 请求总数 | `/metrics` | Prometheus 格式 |
| 请求延迟 P95 | `/metrics` | 分位数延迟 |
| 错误率 | `/metrics` | 5xx 比例 |
| DB 连接错误 | `/metrics` | 数据库连接失败数 |
| 服务 UP 状态 | `/metrics` | 探活状态 |

### 告警通道

- **钉钉机器人**: Webhook 推送
- **企业微信机器人**: Webhook 推送
- **邮件**: SMTP 通知
- **PagerDuty**: 严重告警回调

---

## 配置管理

### 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `PORT` | 否 | `3001` | 后端端口 |
| `NODE_ENV` | 否 | `production` | 运行环境 |
| `DATABASE_URL` | 是 | — | PostgreSQL 连接串 |
| `REDIS_URL` | 否 | — | Redis 连接串 |
| `JWT_SECRET` | 是 | — | JWT 签名密钥 |
| `MINIO_ENDPOINT` | 否 | — | MinIO/S3 端点 |
| `CORS_ORIGINS` | 否 | `http://localhost:5173,http://localhost:5191` | 允许的跨域源 |
| `LOG_LEVEL` | 否 | `info` | 日志级别 |
| `BACKUP_DIR` | 否 | `/data/backups` | 备份存储路径 |

### Kubernetes Secrets

```bash
# 创建/更新 JWT secret
kubectl create secret generic g005-ris-secret \
  --from-literal=JWT_SECRET=your-secret-here \
  --from-literal=DB_PASSWORD=your-db-password \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## 升级流程

```bash
# 1. 备份数据库
pg_dump -U g005 -d g005 > backup-$(date +%Y%m%d).sql

# 2. 拉取新版本
git pull origin main

# 3. 安装依赖
npm ci

# 4. 数据库迁移 (如有)
npx prisma migrate deploy

# 5. 构建
npm run build

# 6. 滚动部署
kubectl rollout restart deployment g005-ris
kubectl rollout status deployment g005-ris

# 7. 验证
curl http://localhost:3001/api/health
```

---

## 灾备

详见 [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md)。

---

**联系方式**:
- 运维: ops@g005.hospital
- 值班电话: 内线 8002
- 紧急: 138-0000-0000
