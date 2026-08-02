import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  List,
  Tag,
  Button,
  Space,
  Typography,
  Progress,
  Empty,
  Spin,
  message,
  Badge,
} from "antd";
import {
  CloudUpload,
  CloudOff,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { OfflineEditPayload, SyncBatchResult } from "../../types/mobile";
import { offlineSync } from "../../services/mobile/offline/OfflineSync";

const { Text } = Typography;

interface OfflineQueueProps {
  maxHeight?: number;
  autoRefresh?: boolean;
  onSyncComplete?: (result: SyncBatchResult) => void;
}

const STATUS_META: Record<
  string,
  { color: string; label: string; icon: React.ReactNode }
> = {
  pending: { color: "default", label: "待同步", icon: <Clock size={12} /> },
  syncing: {
    color: "processing",
    label: "同步中",
    icon: <RefreshCw size={12} />,
  },
  synced: {
    color: "success",
    label: "已同步",
    icon: <CheckCircle size={12} />,
  },
  failed: { color: "error", label: "失败", icon: <AlertCircle size={12} /> },
  conflict: {
    color: "warning",
    label: "冲突",
    icon: <AlertCircle size={12} />,
  },
};

export const OfflineQueue: React.FC<OfflineQueueProps> = ({
  maxHeight = 400,
  autoRefresh = true,
  onSyncComplete,
}) => {
  const [items, setItems] = useState<OfflineEditPayload[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [lastResult, setLastResult] = useState<SyncBatchResult | null>(null);
  const [loading, setLoading] = useState(true);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      const queue = await offlineSync.listQueue();
      setItems(queue);
    } catch {
      void message.error("加载同步队列失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
    if (!autoRefresh) return;
    const interval = setInterval(loadQueue, 5000);
    return () => clearInterval(interval);
  }, [loadQueue, autoRefresh]);

  useEffect(() => {
    const unsub = offlineSync.onProgress((e) => {
      setProgress({ completed: e.completed, total: e.total });
    });
    return unsub;
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setProgress({ completed: 0, total: items.length });
    try {
      const result = await offlineSync.sync();
      setLastResult(result);
      onSyncComplete?.(result);
      await loadQueue();
    } catch {
      void message.error("同步失败");
    } finally {
      setSyncing(false);
    }
  };

  const handleClear = async () => {
    try {
      const count = await offlineSync.clearSynced();
      void message.success(`已清除 ${count} 项`);
      await loadQueue();
    } catch {
      void message.error("清除失败");
    }
  };

  const handleRetryFailed = async () => {
    try {
      const count = await offlineSync.retryFailed();
      void message.success(`已重试 ${count} 项`);
      await loadQueue();
    } catch {
      void message.error("重试失败");
    }
  };

  const stats = {
    pending: items.filter((i) => i.status === "pending").length,
    failed: items.filter((i) => i.status === "failed").length,
    conflict: items.filter((i) => i.status === "conflict").length,
    synced: items.filter((i) => i.status === "synced").length,
  };

  return (
    <Card
      title={
        <Space>
          <CloudOff size={16} />
          <span>离线队列</span>
          <Badge count={stats.pending} style={{ backgroundColor: "#faad14" }} />
          {stats.failed > 0 && (
            <Badge
              count={stats.failed}
              style={{ backgroundColor: "#ff4d4f" }}
            />
          )}
        </Space>
      }
      size="small"
      extra={
        <Space size={4}>
          <Button
            size="small"
            icon={<RefreshCw size={12} />}
            onClick={loadQueue}
            loading={loading}
          />
          <Button
            size="small"
            icon={<Trash2 size={12} />}
            onClick={handleClear}
            disabled={items.length === 0}
          />
        </Space>
      }
    >
      {syncing && (
        <div style={{ padding: "8px 0", textAlign: "center" }}>
          <Progress
            percent={
              progress.total > 0
                ? Math.round((progress.completed / progress.total) * 100)
                : 0
            }
            size="small"
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            同步中 {progress.completed}/{progress.total}
          </Text>
        </div>
      )}

      {(stats.failed > 0 || stats.conflict > 0) && (
        <Space
          style={{ marginBottom: 8, width: "100%", justifyContent: "center" }}
        >
          {stats.failed > 0 && (
            <Button
              size="small"
              icon={<RefreshCw size={12} />}
              onClick={handleRetryFailed}
            >
              重试失败项
            </Button>
          )}
        </Space>
      )}

      {loading ? (
        <Spin style={{ display: "block", margin: "24px auto" }} />
      ) : items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span>
              <CloudUpload size={16} /> 暂无离线变更
            </span>
          }
        />
      ) : (
        <List
          style={{ maxHeight, overflowY: "auto" }}
          dataSource={items}
          renderItem={(item) => {
            const status = item.status ?? "pending";
            const meta = STATUS_META[status] ?? STATUS_META["pending"]!;
            return (
              <List.Item style={{ padding: "6px 0" }}>
                <List.Item.Meta
                  avatar={
                    <Tag icon={meta.icon} color={meta.color}>
                      {status}
                    </Tag>
                  }
                  title={
                    <Text style={{ fontSize: 12 }}>
                      {item.entityType} · {item.entityId}
                    </Text>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.operation} · {item.summary ?? item.capturedAt}
                    </Text>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}

      {items.length > 0 && (
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <Button
            type="primary"
            block
            icon={<CloudUpload size={14} />}
            onClick={handleSync}
            loading={syncing}
          >
            {syncing ? "同步中..." : `同步所有 (${stats.pending})`}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default OfflineQueue;
