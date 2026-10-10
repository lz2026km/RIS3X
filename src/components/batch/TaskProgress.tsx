import { useState, useEffect, useRef } from "react";
import { X, RotateCw, CheckCircle, Loader2 } from "lucide-react";
import { AppButton } from "../common/AppButton";

export interface TaskState {
  total: number;
  completed: number;
  failed: number;
  running: boolean;
  taskId?: string;
}

interface TaskProgressProps {
  /** 任务状态（外部控制） */
  task: TaskState;
  /** SSE 端点 URL（可选），开启后自动监听事件流 */
  sseUrl?: string;
  /** 取消回调 */
  onCancel?: () => void;
  /** 重试失败项回调 */
  onRetryFailed?: () => void;
  /** 进度变化回调 */
  onProgress?: (state: TaskState) => void;
}

export function TaskProgress({
  task,
  sseUrl,
  onCancel,
  onRetryFailed,
  onProgress,
}: TaskProgressProps) {
  const [expanded, setExpanded] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sseUrl || !task.running) return;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Partial<TaskState>;
        if (onProgress) {
          onProgress({ total: task.total, completed: task.completed, failed: task.failed, running: task.running, ...data });
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [sseUrl, task.running]);

  const progressPct = task.total > 0 ? ((task.completed + task.failed) / task.total) * 100 : 0;
  const failedPct = task.total > 0 ? (task.failed / task.total) * 100 : 0;

  if (!expanded) return null;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 8,
        border: "1px solid var(--border-color)",
        padding: "10px 14px",
        minWidth: 240,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#1e293b" }}>
          {task.running ? <Loader2 size={14} className="spin" /> : <CheckCircle size={14} style={{ color: "var(--color-success-500)" }} />}
          {task.running ? "任务执行中..." : "任务完成"}
        </div>
        <button aria-label="收起"
          onClick={() => setExpanded(false)}
          style={{ border: "none", background: "none", cursor: "pointer", padding: 2, color: "#94a3b8" }}
        >
          <X size={12} />
        </button>
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ display: "flex", gap: 'var(--space-4, 16px)', fontSize: 11, color: "#64748b" }}>
          <span>总计: <strong>{task.total}</strong></span>
          <span style={{ color: "var(--color-success-500)" }}>完成: <strong>{task.completed}</strong></span>
          {task.failed > 0 && <span style={{ color: "var(--color-error-500)" }}>失败: <strong>{task.failed}</strong></span>}
        </div>
      </div>

      <div style={{ position: "relative", height: 6, background: "var(--bg-primary)", borderRadius: 3, overflow: "hidden", marginBottom: 'var(--space-2, 8px)' }}>
        <div
          style={{
            height: "100%",
            width: `${progressPct}%`,
            background: "var(--color-success-500)",
            borderRadius: 3,
            transition: "width 0.3s",
          }}
        />
        {task.failed > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: `${failedPct}%`,
              background: "var(--color-error-500)",
              borderRadius: 3,
              opacity: 0.6,
              transition: "width 0.3s",
            }}
          />
        )}
      </div>

      {(onCancel || onRetryFailed) && (
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          {task.running && onCancel && (
            <AppButton variant="default" size="compact" onClick={onCancel} icon={<X size={12} />}>
              取消
            </AppButton>
          )}
          {!task.running && task.failed > 0 && onRetryFailed && (
            <AppButton variant="danger" size="compact" onClick={onRetryFailed} icon={<RotateCw size={12} />}>
              重试失败项
            </AppButton>
          )}
        </div>
      )}
    </div>
  );
}

export default TaskProgress;
