# G005 放射RIS 备份恢复手册

**版本**: v3.0.6.11-31 | **更新日期**: 2026-07-22

## 目录

- [备份策略](#备份策略)
- [备份操作](#备份操作)
- [恢复操作](#恢复操作)
- [验证备份完整性](#验证备份完整性)
- [灾难恢复](#灾难恢复)
- [备份存储管理](#备份存储管理)

---

## 备份策略

| 备份类型 | 周期 | 保留时间 | 存储位置 | 说明 |
|----------|------|----------|----------|------|
| 每日全量 | 每天 02:00 | 30 天 | MinIO/S3 + 本地 | 完整数据库 + 文件 |
| 增量备份 | 每 6 小时 | 7 天 | MinIO/S3 | WAL 归档 + 变更 |
| 实时 WAL 归档 | 连续 | 24 小时 | 本地磁盘 | PostgreSQL WAL |

### 备份内容

| 数据项 | 备份方式 | 预估大小 |
|--------|----------|----------|
| PostgreSQL 数据库 | `pg_dump` | 500 MB - 2 GB |
| DICOM 文件 (MinIO) | `rclone sync` | 50 GB - 500 GB |
| 应用配置文件 | `tar` | 10 MB |
| 环境变量/Secrets | 加密导出 | 1 MB |

### RPO / RTO 目标

| 场景 | RPO (数据丢失) | RTO (恢复时间) |
|------|---------------|---------------|
| 单节点故障 | 0 (无丢失) | < 5 分钟 |
| 数据库损坏 | < 1 小时 (上次全量) | < 30 分钟 |
| 整个集群故障 | < 6 小时 (上次增量) | < 2 小时 |
| 灾难性故障 (机房级) | < 24 小时 | < 4 小时 |

---

## 备份操作

### 手动全量备份

```bash
# 触发备份
curl -X POST /api/backup \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type": "full"}'
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "backup-20260711-020001",
    "type": "full",
    "status": "completed",
    "sizeBytes": 1540000000,
    "fileCount": 6,
    "checksum": "sha256:a1b2c3d4e5f6...",
    "startedAt": "2026-07-11T02:00:01.000Z",
    "completedAt": "2026-07-11T02:15:23.000Z",
    "components": [
      {"name": "postgres", "status": "ok", "size": 850000000},
      {"name": "minio", "status": "ok", "size": 680000000},
      {"name": "config", "status": "ok", "size": 10000000}
    ]
  }
}
```

### 数据库独立备份 (pg_dump)

```bash
# 全量导出
pg_dump -U g005 -d g005 -Fc -f /data/backups/g005-$(date +%Y%m%d).dump

# 仅 schema
pg_dump -U g005 -d g005 -s -f /data/backups/g005-schema-$(date +%Y%m%d).sql

# 仅数据
pg_dump -U g005 -d g005 -a -f /data/backups/g005-data-$(date +%Y%m%d).sql
```

### MinIO 文件备份

```bash
# 使用 rclone 同步到远程 S3
rclone sync minio:/g005-dicom remote:backup/g005-dicom-$(date +%Y%m%d) \
  --progress --checksum

# 备份到本地
rclone sync minio:/g005-dicom /data/backups/dicom-$(date +%Y%m%d) --progress
```

### 配置备份

```bash
# 备份环境配置
tar czf /data/backups/config-$(date +%Y%m%d).tar.gz \
  .env.production \
  deploy/nginx.conf \
  deploy/kubernetes.yaml \
  deploy/docker-compose.yml

# 加密敏感配置
gpg --symmetric --cipher-algo AES256 \
  /data/backups/config-$(date +%Y%m%d).tar.gz
```

### 自动化备份 (CronJob)

```yaml
# K8s CronJob 配置示例
apiVersion: batch/v1
kind: CronJob
metadata:
  name: g005-backup-full
spec:
  schedule: "0 2 * * *"         # 每天 02:00
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: bitnami/postgresql:16
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h postgres -U g005 -d g005 -Fc \
                > /backups/g005-$(date +%Y%m%d).dump
              curl -X POST http://ris-backend:3001/api/backup \
                -H "Authorization: Bearer $(cat /secrets/token)"
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: g005-ris-secret
                  key: DB_PASSWORD
            volumeMounts:
            - name: backup-storage
              mountPath: /backups
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: g005-ris-pvc
```

---

## 恢复操作

### 从备份列表恢复

```bash
# 查询可用备份
curl -X GET /api/backup \
  -H "Authorization: Bearer <token>"

# 恢复指定备份
curl -X POST /api/backup/backup-20260711-020001/restore \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "components": ["postgres", "minio", "config"],
    "confirm": true
  }'
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "restore-20260711-030001",
    "backupId": "backup-20260711-020001",
    "status": "in_progress",
    "startedAt": "2026-07-11T03:00:01.000Z",
    "estimatedCompletion": "2026-07-11T03:15:00.000Z",
    "steps": [
      {"name": "preflight_check", "status": "passed"},
      {"name": "restore_postgres", "status": "pending"},
      {"name": "restore_minio", "status": "pending"},
      {"name": "restore_config", "status": "pending"},
      {"name": "verify", "status": "pending"}
    ]
  }
}
```

### PostgreSQL 独立恢复

```bash
# 恢复全量备份
pg_restore -U g005 -d g005 -Fc \
  --clean --if-exists \
  /data/backups/g005-20260711.dump

# 从 SQL 恢复
psql -U g005 -d g005 -f /data/backups/g005-data-20260711.sql

# 恢复到指定时间点 (PITR) - 需要 WAL 归档
# 1. 恢复全量备份
pg_restore -U g005 -d g005 -Fc /data/backups/g005-base.dump

# 2. 配置 recovery.conf
# restore_command = 'cp /wal_archive/%f %p'
# recovery_target_time = '2026-07-11 03:30:00+08'
```

### MinIO 文件恢复

```bash
# 从远程备份恢复
rclone sync remote:backup/g005-dicom-20260711 minio:/g005-dicom \
  --progress --checksum

# 从本地备份恢复
rclone sync /data/backups/dicom-20260711 minio:/g005-dicom --progress
```

### 完整灾难恢复步骤

```
1. 拉起基础设施 (PostgreSQL + Redis + MinIO)
   ↓
2. 恢复 PostgreSQL (pg_restore)
   ↓
3. 恢复 MinIO 文件 (rclone sync)
   ↓
4. 恢复应用配置
   ↓
5. 启动后端服务
   ↓
6. 验证数据库连接和数据完整性
   ↓
7. 启动前端服务
   ↓
8. 验证业务功能
   ↓
9. 通知用户恢复完成
```

---

## 验证备份完整性

### 自动校验

备份完成后自动执行:
```bash
# 校验备份文件 checksum
sha256sum -c /data/backups/g005-$(date +%Y%m%d).dump.sha256

# 尝试恢复到一个临时数据库
createdb g005_verify
pg_restore -U g005 -d g005_verify -Fc /data/backups/g005-20260711.dump
pg_dump -U g005 -d g005_verify -t patients -a | grep -c "INSERT"
# 期望: 与生产环境患者数一致
dropdb g005_verify
```

### 定期恢复演练

每月执行一次全量恢复演练:
```bash
# 1. 在隔离环境拉起新实例
docker compose -f deploy/docker-compose.yml up -d postgres minio

# 2. 恢复备份
pg_restore -U g005 -d g005 -Fc /data/backups/g005-latest.dump

# 3. 启动应用验证
docker compose -f deploy/docker-compose.yml up -d ris-backend ris-frontend

# 4. 自动验证
curl -f http://localhost:3001/api/health
curl -f http://localhost:3001/api/v1/reports?page=1

# 5. 清理
docker compose -f deploy/docker-compose.yml down -v
```

### 恢复演练记录

每次演练后记录以下信息:

| 日期 | 演练类型 | 数据量 | RTO 实测 | RPO 实测 | 结果 | 负责人 | 备注 |
|------|----------|--------|----------|----------|------|--------|------|
| 2026-07-01 | 全量恢复 | 1.5 GB | 12 min | <1 h | ✅ 通过 | 张三 | — |
| 2026-06-01 | 全量恢复 | 1.4 GB | 15 min | <1 h | ✅ 通过 | 李四 | — |
| 2026-05-01 | 增量+PITR | 1.4 GB | 8 min | 5 min | ✅ 通过 | 张三 | — |

**演练步骤**:

```bash
# 1. 在隔离环境拉起新实例
docker compose -f deploy/docker-compose.yml up -d postgres minio

# 2. 恢复备份
pg_restore -U g005 -d g005 -Fc /data/backups/g005-latest.dump

# 3. 启动应用验证
docker compose -f deploy/docker-compose.yml up -d ris-backend ris-frontend

# 4. 自动验证
curl -f http://localhost:3001/api/health
curl -f http://localhost:3001/api/v1/reports?page=1

# 5. 清理
docker compose -f deploy/docker-compose.yml down -v
```

### 监控备份健康

```bash
# Prometheus 指标集成
curl http://localhost:3001/api/backup/status
```

**成功响应**:
```json
{
  "success": true,
  "data": {
    "lastFullBackup": "2026-07-11T02:00:01.000Z",
    "lastFullBackupSize": 1540000000,
    "lastFullBackupStatus": "completed",
    "lastIncrementalBackup": "2026-07-11T08:00:01.000Z",
    "incrementalCount24h": 4,
    "totalBackups": 42,
    "diskUsageBytes": 52000000000,
    "diskFreeBytes": 150000000000,
    "integrityChecksPassed": true
  }
}
```

---

## 备份存储管理

### 存储位置分层

| 层级 | 位置 | 延迟 | 容量 | 用途 |
|------|------|------|------|------|
| L1 | 本地磁盘 (PV) | < 1ms | 50 GB | 当日备份, 快速恢复 |
| L2 | MinIO (同机房) | < 10ms | 500 GB | 7 天内备份 |
| L3 | 远程 S3 (异地) | < 100ms | 不限 | 长期归档, 灾备 |

### 清理策略

| 备份年龄 | 保留策略 |
|----------|----------|
| < 7 天 | 全部保留 (全量 + 增量) |
| 7-30 天 | 每日全量 |
| 30-90 天 | 每周全量 |
| > 90 天 | 每月全量, 压缩归档到冷存储 |

### 清理命令

```bash
# 清理 30 天前的备份
curl -X DELETE /api/backup/cleanup \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"olderThan": "30d"}'
```

---

## 安全注意事项

1. 备份文件必须加密存储 (AES-256-GCM)
2. 传输过程使用 TLS 加密
3. 恢复操作需要双人审批 (管理员 + 运维)
4. 备份访问权限最小化 (RBAC)
5. 异地备份与主站物理隔离
6. 密钥管理: 使用 K8s Secrets / Vault, 不硬编码

---

**联系方式**:
- 备份失败告警: ops@g005.hospital
- 紧急恢复: 138-0000-0000 (24h)
