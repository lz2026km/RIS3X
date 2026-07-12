# G005 放射RIS 监控告警手册

**版本**: v3.0.6.11-18 | **更新日期**: 2026-07-12

## 目录

- [Prometheus 指标](#prometheus-指标)
- [关键告警规则](#关键告警规则)
- [Grafana 仪表盘](#grafana-仪表盘)
- [告警通知渠道](#告警通知渠道)
- [告警响应流程](#告警响应流程)
- [自监控](#自监控)

---

## Prometheus 指标

后端 `/metrics` 端点暴露 Prometheus 格式指标。

### 指标端点

```
GET /api/health   # 健康检查 (已经接入 liveness/readiness probe)
GET /metrics      # Prometheus 指标 (已启用, 通过 express-prom-bundle 暴露)
```

### 应用内指标 (server/middleware/metrics.ts)

| 指标键 | 类型 | 标签 | 说明 |
|--------|------|------|------|
| `requestsTotal` | Counter | — | 总请求数 |
| `requestsByMethod` | Gauge | method | 按 HTTP 方法统计 |
| `requestsByPath` | Gauge | path | 按请求路径统计 |
| `requestsByStatus` | Gauge | status | 按响应状态码统计 |
| `errorsTotal` | Counter | — | 5xx 错误总数 |
| `avgResponseTimeMs` | Gauge | — | 平均响应时间 (ms) |
| `uptime` | Gauge | — | 运行时长 (秒) |
| `responseTimeTotal` | Counter | — | 响应时间累加 (用于计算) |

### 接入 Prometheus 示例

```yaml
# prometheus.yml scrape config
scrape_configs:
  - job_name: 'g005-ris'
    scrape_interval: 15s
    metrics_path: /metrics
    static_configs:
      - targets:
        - 'ris-backend:3001'
        labels:
          app: g005-ris
          env: production
```

### 自定义指标 (建议扩展)

| 指标名 | 类型 | 说明 |
|--------|------|------|
| `ris_requests_total` | Counter | HTTP 请求总数 (method, path, status) |
| `ris_request_duration_seconds` | Histogram | 请求延迟分布 (50ms/100ms/200ms/500ms/1s/5s buckets) |
| `ris_db_connection_errors_total` | Counter | 数据库连接失败数 |
| `ris_redis_connection_errors_total` | Counter | Redis 连接失败数 |
| `ris_up` | Gauge | 服务存活状态 (0/1) |
| `ris_reports_total` | Gauge | 报告总数 (status 标签) |
| `ris_exams_total` | Gauge | 检查总数 (status, modality 标签) |
| `ris_critical_values_open` | Gauge | 未处理危急值数量 |
| `ris_backup_last_success_timestamp` | Gauge | 最近成功备份时间戳 |
| `ris_backup_status` | Gauge | 备份状态 (0=fail, 1=success) |

---

## 关键告警规则

### 告警规则清单 (deploy/prometheus/PrometheusRule.yaml)

| # | 告警名称 | 表达式 | 级别 | 触发条件 | 说明 |
|---|----------|--------|------|----------|------|
| 1 | **ServiceDown** | `up{job="g005-ris"} == 0` | critical | 持续 1m | RIS 服务不可用 |
| 2 | **DatabaseConnectionFailed** | `rate(db_connection_errors_total[5m]) > 0` | critical | 持续 1m | 数据库连接失败 |
| 3 | **APIErrorRateHigh** | `5xx 错误率 > 5%` | critical | 持续 2m | API 错误率超过阈值 |
| 4 | **CriticalResultTimeout** | `P95 请求延迟 > 30s` | critical | 持续 1m | 危急值报告响应超时 |
| 5 | **ReportSLABreach** | `报告接口出现 5xx` | critical | 持续 2m | 报告生成 SLA 违例 |

### 告警规则 YAML

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: g005-ris-alerts
  labels:
    app: g005-ris
    release: kube-prometheus-stack
spec:
  groups:
  - name: g005-ris-critical
    interval: 30s
    rules:
    - alert: CriticalResultTimeout
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="g005-ris",path=~"/api/results/.*"}[5m])) > 30
      for: 1m
      labels: { severity: critical }
      annotations:
        summary: "危急值报告超时"
        description: "95% 的危急值报告响应时间超过 30s (当前值: {{ $value }}s)"

    - alert: ReportSLABreach
      expr: rate(http_requests_total{job="g005-ris",path="/api/reports",status=~"5.."}[5m]) > 0
      for: 2m
      labels: { severity: critical }
      annotations:
        summary: "报告生成 SLA 违例"
        description: "报告生成接口出现 5xx 错误"

    - alert: ServiceDown
      expr: up{job="g005-ris"} == 0
      for: 1m
      labels: { severity: critical }
      annotations:
        summary: "RIS 服务不可用"
        description: "G005 RIS 后端服务已宕机超过 1 分钟"

    - alert: DatabaseConnectionFailed
      expr: rate(db_connection_errors_total{job="g005-ris"}[5m]) > 0
      for: 1m
      labels: { severity: critical }
      annotations:
        summary: "数据库连接失败"
        description: "数据库连接错误率 > 0"

    - alert: APIErrorRateHigh
      expr: (sum(rate(http_requests_total{job="g005-ris",status=~"5.."}[5m])) / sum(rate(http_requests_total{job="g005-ris"}[5m]))) * 100 > 5
      for: 2m
      labels: { severity: critical }
      annotations:
        summary: "API 错误率超过 5%"
        description: "API 5xx 错误率 {{ $value }}% 已超过 5% 阈值"
```

### 部署告警规则

```bash
# 使用 kubectl 直接部署
kubectl apply -f deploy/prometheus/PrometheusRule.yaml

# 使用 Helm
helm upgrade --install g005-ris deploy/helm/ \
  --set prometheusRule.enabled=true
```

---

## Grafana 仪表盘

### 仪表盘导入

```bash
# 方式 1: Grafana API 导入
curl -X POST http://admin:password@grafana:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @deploy/grafana/g005-ris-dashboard.json

# 方式 2: Grafana UI
# 1. 登录 Grafana (默认 http://grafana:3000, admin/admin)
# 2. 点击 `+` → `Import`
# 3. 上传 JSON 或粘贴 Dashboard ID
# 4. 选择 Prometheus 数据源
# 5. 点击 Import
```

### 推荐仪表盘面板

| 面板名称 | 指标 | 图表类型 | 刷新间隔 |
|----------|------|----------|----------|
| 服务状态 | `up{job="g005-ris"}` | Stat | 15s |
| 请求速率 | `rate(ris_requests_total[5m])` | Time series | 15s |
| 错误率 | `rate(ris_requests_total{status=~"5.."}[5m])` | Time series | 15s |
| P95 延迟 | `histogram_quantile(0.95, ...)` | Time series | 30s |
| 数据库连接 | `ris_db_connection_errors_total` | Stat | 30s |
| 报告统计 | `ris_reports_total` | Pie chart | 60s |
| 检查分布 | `ris_exams_total` | Bar chart | 60s |
| 危急值 | `ris_critical_values_open` | Stat | 30s |
| 备份状态 | `ris_backup_status` | Stat | 300s |
| 资源使用 | `container_cpu_usage_seconds_total` | Time series | 30s |

### 关键告警面板阈值

| 面板 | 绿色 | 黄色 (Warning) | 红色 (Critical) |
|------|------|----------------|-----------------|
| 服务状态 | 1 | — | 0 |
| 错误率 | < 1% | 1-5% | > 5% |
| P95 延迟 | < 5s | 5-30s | > 30s |
| DB 连接 | 0 | > 0 (任意) | — |
| 危急值 | < 5 | 5-20 | > 20 |

---

## 告警通知渠道

### 钉钉机器人

```bash
# 配置钉钉 Webhook
export DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
export DINGTALK_SECRET=your-secret-key

# 测试消息
curl -X POST $DINGTALK_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{
    "msgtype": "markdown",
    "markdown": {
      "title": "G005 RIS 告警测试",
      "text": "## 🔴 RIS 服务告警\n**服务**: ris-backend\n**级别**: critical\n**状态**: ServiceDown\n**时间**: 2026-07-11 14:30:00"
    }
  }'
```

### 企业微信机器人

```bash
export WECHAT_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx

curl -X POST $WECHAT_WEBHOOK \
  -H "Content-Type: application/json" \
  -d '{
    "msgtype": "markdown",
    "markdown": {
      "content": "## 🔴 RIS 服务告警\n> **服务**: ris-backend\n> **级别**: critical\n> **状态**: ServiceDown\n> **时间**: 2026-07-11 14:30:00"
    }
  }'
```

### 邮件告警

```yaml
# AlertManager 配置 (alertmanager.yml)
receivers:
- name: 'email'
  email_configs:
  - to: 'ops@g005.hospital'
    from: 'alertmanager@g005.hospital'
    smarthost: 'smtp.g005.hospital:587'
    auth_username: 'alertmanager'
    auth_password: 'xxx'
    require_tls: true

- name: 'dingtalk'
  webhook_configs:
  - url: 'https://oapi.dingtalk.com/robot/send?access_token=xxx'

- name: 'wechat'
  webhook_configs:
  - url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx'

route:
  receiver: 'dingtalk'
  routes:
  - match:
      severity: critical
    receiver: 'email'
    continue: true
  - match:
      severity: critical
    receiver: 'dingtalk'
  - match:
      severity: warning
    receiver: 'wechat'
```

### PagerDuty (可选)

```yaml
receivers:
- name: 'pagerduty'
  pagerduty_configs:
  - routing_key: 'your-pagerduty-key'
    severity: 'critical'
```

### 告警通知模板

**钉钉/企业微信 Markdown 模板**:

```
## {{ if eq .Status "firing" }}🔴{{ else }}🟢{{ end }} G005 RIS {{ .Status }}

**告警名称**: {{ .GroupLabels.alertname }}
**级别**: {{ .CommonLabels.severity }}
**状态**: {{ .Status }}
**开始时间**: {{ .StartsAt }}

**标签**:
{{ range .CommonLabels }}- {{ .Name }}: {{ .Value }}
{{ end }}

**描述**:
{{ range .Alerts }}{{ .Annotations.description }}
{{ end }}

**操作建议**:
- {{ if eq .GroupLabels.alertname "ServiceDown" }}kubectl rollout restart deployment g005-ris
- {{ else if eq .GroupLabels.alertname "DatabaseConnectionFailed" }}kubectl logs -l app=postgres --tail=50
- {{ else }}查看运维手册 OPERATIONS_MANUAL.md{{ end }}
```

---

## 告警响应流程

```
告警触发
   ↓
AlertManager 路由 → 通知渠道 (钉钉/企微/邮件)
   ↓
值班运维确认 (15 分钟内)
   ↓
├── 误报 → 标记已处理, 更新告警规则
├── 低影响 → 记录日志, 排入计划修复
└── 高影响 → 启动应急响应:
    ├── 1. 检查服务状态 (kubectl get pods)
    ├── 2. 查看日志 (kubectl logs)
    ├── 3. 确认影响范围 (用户/功能)
    ├── 4. 执行恢复操作 (重启/回滚/扩缩容)
    └── 5. 通知用户恢复完成
```

### 告警升级策略

| 级别 | 响应时间 | 通知对象 | 通知方式 |
|------|----------|----------|----------|
| P0 (Critical) | 立即 | 全体运维 + 研发 TL | 电话 + 钉钉 + 邮件 |
| P1 (Warning) | 15 分钟 | 值班运维 | 钉钉 + 邮件 |
| P2 (Info) | 2 小时 | 运维群 | 钉钉 |

---

## 自监控

### 监控自身健康

```bash
# AlertManager 健康检查
curl -f http://alertmanager:9093/-/healthy

# Prometheus 健康检查
curl -f http://prometheus:9090/-/healthy

# Grafana 健康检查
curl -f http://grafana:3000/api/health
```

### 关键监控指标自身

| 指标 | 告警阈值 | 级别 | 说明 |
|------|----------|------|------|
| `prometheus_tsdb_head_series` | > 500000 | warning | Prometheus 时间序列过多 |
| `alertmanager_alerts` | > 50 (firing) | warning | 活跃告警过多, 可能误报 |
| `up{job="grafana"}` | == 0 | critical | Grafana 不可用 |

---

**最后更新**: 2026-07-11 | **维护人**: DevOps Team
