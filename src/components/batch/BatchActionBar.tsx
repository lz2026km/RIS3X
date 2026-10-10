import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { TaskProgress, type TaskState } from './TaskProgress';

interface BatchAction {
  key: string;
  label: string;
  icon: ReactNode;
  confirm?: string;
}

interface BatchActionBarProps {
  selectedCount: number;
  onAction: (action: string) => void;
  actions: BatchAction[];
  onClear?: () => void;
  /** 任务进度状态（传入后显示 TaskProgress） */
  task?: TaskState;
  /** SSE 端点 URL */
  taskSseUrl?: string;
  /** 取消任务 */
  onTaskCancel?: () => void;
  /** 重试失败项 */
  onTaskRetry?: () => void;
  /** 进度回调 */
  onTaskProgress?: (state: TaskState) => void;
}

const PRIMARY = 'var(--color-primary-800)';

export default function BatchActionBar({ selectedCount, onAction, actions, onClear, task, taskSseUrl, onTaskCancel, onTaskRetry, onTaskProgress }: BatchActionBarProps) {
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  if (selectedCount === 0) return null;

  const handleClick = (action: BatchAction) => {
    if (action.confirm && confirmKey !== action.key) {
      setConfirmKey(action.key);
      return;
    }
    setConfirmKey(null);
    onAction(action.key);
  };

  return (
    <div
      role="region"
      aria-label="批量操作栏"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        background: 'var(--bg-card)',
        borderRadius: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        border: '1px solid #e2e8f0',
      }}
    >
      {task && (
        <TaskProgress
          task={task}
          sseUrl={taskSseUrl}
          onCancel={onTaskCancel}
          onRetryFailed={onTaskRetry}
          onProgress={onTaskProgress}
        />
      )}
      <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
        已选中 <span style={{ color: PRIMARY, fontWeight: 700 }}>{selectedCount}</span> 项
      </span>
      <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
      {actions.map((action) => (
        <button
          key={action.key}
          onClick={() => handleClick(action)}
          onMouseLeave={() => setConfirmKey(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: confirmKey === action.key ? '8px 16px' : '8px 14px',
            borderRadius: 8,
            border: '1px solid',
            borderColor: confirmKey === action.key ? 'var(--color-error-600)' : '#e2e8f0',
            background: confirmKey === action.key ? '#fef2f2' : 'var(--bg-card)',
            color: confirmKey === action.key ? 'var(--color-error-600)' : '#334155',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          {action.icon}
          {confirmKey === action.key ? (action.confirm || '确认?') : action.label}
        </button>
      ))}
      {onClear && (
        <>
          <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
          <button
            onClick={onClear}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <X size={14} />
            取消选择
          </button>
        </>
      )}
    </div>
  );
}
