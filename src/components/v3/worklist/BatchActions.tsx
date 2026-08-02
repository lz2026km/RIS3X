/**
 * G005 放射RIS系统 v3.0.1 - 批量操作栏
 * 对标卫宁 / 英飞达 PACS
 */
import React, { useState, useCallback } from 'react'
import { Button, Space, Modal, Select, Input, message, Popconfirm, Tag } from 'antd'
import {
  Users,
  Download,
  Printer,
  Send,
  Trash2,
  X,
  CheckSquare,
  Square,
} from 'lucide-react'

export interface BatchActionsProps {
  selectedCount: number
  totalCount: number
  onClear?: () => void
  onSelectAll?: () => void
  onReassign?: (assignee: string) => Promise<void> | void
  onExport?: (format: 'excel' | 'csv' | 'pdf') => Promise<void> | void
  onPrint?: () => void
  onDelete?: () => Promise<void> | void
  onSubmit?: () => Promise<void> | void
  assignees?: { id: string; name: string }[]
  busy?: boolean
}

export const BatchActions: React.FC<BatchActionsProps> = ({
  selectedCount,
  totalCount,
  onClear,
  onSelectAll,
  onReassign,
  onExport,
  onPrint,
  onDelete,
  onSubmit,
  assignees = [],
  busy = false,
}) => {
  const [reassignOpen, setReassignOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [assignee, setAssignee] = useState<string | undefined>()
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv' | 'pdf'>('excel')

  const handleReassignOk = useCallback(async () => {
    if (!assignee) {
      message.warning('请选择目标医生')
      return
    }
    try {
      await onReassign?.(assignee)
      message.success(`已批量改派 ${selectedCount} 条 → ${assignee}`)
      setReassignOpen(false)
      setAssignee(undefined)
    } catch {
      message.error('改派失败')
    }
  }, [assignee, onReassign, selectedCount])

  const handleExportOk = useCallback(async () => {
    try {
      await onExport?.(exportFormat)
      message.success(`已导出 ${selectedCount} 条为 ${exportFormat.toUpperCase()}`)
      setExportOpen(false)
    } catch {
      message.error('导出失败')
    }
  }, [exportFormat, onExport, selectedCount])

  if (selectedCount === 0) {
    return (
      <div
        data-testid="batch-actions-empty"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          fontSize: 12,
          color: '#64748b',
          gap: 8,
        }}
      >
        <Button
          size="small"
          type="text"
          icon={<CheckSquare size={12} />}
          onClick={onSelectAll}
          data-testid="batch-select-all"
        >
          全选({totalCount})
        </Button>
        <span>未选中</span>
      </div>
    )
  }

  return (
    <>
      <div
        data-testid="batch-actions"
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          background: '#eef2ff',
          border: '1px solid #6366f1',
          borderRadius: 6,
          fontSize: 12,
          gap: 8,
        }}
      >
        <Tag color="blue" style={{ fontWeight: 600, margin: 0 }}>
          已选 {selectedCount} / {totalCount}
        </Tag>
        <Button size="small" type="text" icon={<X size={12} />} onClick={onClear} data-testid="batch-clear">
          取消
        </Button>
        <div style={{ flex: 1 }} />
        {onReassign && (
          <Button
            size="small"
            icon={<Users size={12} />}
            onClick={() => setReassignOpen(true)}
            disabled={busy}
            data-testid="batch-reassign"
          >
            批量改派
          </Button>
        )}
        {onSubmit && (
          <Button
            size="small"
            icon={<Send size={12} />}
            onClick={onSubmit}
            disabled={busy}
            data-testid="batch-submit"
          >
            批量提交
          </Button>
        )}
        {onPrint && (
          <Button size="small" icon={<Printer size={12} />} onClick={onPrint} disabled={busy}>
            批量打印
          </Button>
        )}
        {onExport && (
          <Button
            size="small"
            icon={<Download size={12} />}
            onClick={() => setExportOpen(true)}
            disabled={busy}
            data-testid="batch-export"
          >
            批量导出
          </Button>
        )}
        {onDelete && (
          <Popconfirm
            title={`确认删除 ${selectedCount} 条?`}
            onConfirm={async () => {
              try {
                await onDelete()
                message.success('已删除')
              } catch {
                message.error('删除失败')
              }
            }}
          >
            <Button
              size="small"
              danger
              icon={<Trash2 size={12} />}
              disabled={busy}
              data-testid="batch-delete"
            >
              批量删除
            </Button>
          </Popconfirm>
        )}
      </div>

      <Modal
        title="批量改派"
        open={reassignOpen}
        onCancel={() => setReassignOpen(false)}
        onOk={handleReassignOk}
        okText="确认改派"
        cancelText="取消"
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>将 <strong>{selectedCount}</strong> 条检查改派给:</div>
          <Select
            data-testid="batch-reassign-select"
            value={assignee}
            onChange={setAssignee}
            placeholder="选择医生"
            style={{ width: '100%' }}
            showSearch
            options={assignees.map((a) => ({ value: a.id, label: a.name }))}
          />
        </Space>
      </Modal>

      <Modal
        title="批量导出"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={handleExportOk}
        okText="导出"
        cancelText="取消"
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <div>导出 <strong>{selectedCount}</strong> 条检查,格式:</div>
          <Select
            value={exportFormat}
            onChange={(v) => setExportFormat(v)}
            style={{ width: '100%' }}
            data-testid="batch-export-format"
            options={[
              { value: 'excel', label: 'Excel (.xlsx)' },
              { value: 'csv', label: 'CSV' },
              { value: 'pdf', label: 'PDF' },
            ]}
          />
        </Space>
      </Modal>
    </>
  )
}

export default BatchActions
