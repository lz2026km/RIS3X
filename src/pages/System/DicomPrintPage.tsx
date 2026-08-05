// G005 DICOM Print SCP 胶片打印管理子系统 v1.0.0
import React, { useState, useEffect } from 'react'
import { Printer, Film, Clock, CheckCircle, XCircle, Loader2, Plus, RefreshCw } from 'lucide-react'
import { printQueueManager, PrintJob, printHistory as initialHistory } from '../../data/printQueue'
import { PageContainer, PageHeader } from '../../components/common'

// 深蓝色主题
const C = {
  primary: '#1a365d',
  primaryLight: '#2c5282',
  primaryLighter: '#3182ce',
  white: '#ffffff',
  bg: '#f7fafc',
  border: '#e2e8f0',
  textDark: '#1a202c',
  textMid: '#4a5568',
  textLight: '#a0aec0',
  success: '#38a169',
  warning: '#d69e2e',
  danger: '#e53e3e',
  info: '#3182ce',
  pending: '#d69e2e',
  printing: '#3182ce',
  completed: '#38a169',
  failed: '#e53e3e',
}

// 状态颜色映射
const statusColor: Record<string, string> = {
  Pending: C.pending,
  Printing: C.printing,
  Completed: C.completed,
  Failed: C.failed,
}

// 状态标签文本
const statusText: Record<string, string> = {
  Pending: '等待中',
  Printing: '打印中',
  Completed: '已完成',
  Failed: '失败',
}

// 状态图标
const StatusIcon: React.FC<{ status: PrintJob['status'] }> = ({ status }) => {
  const iconProps = { size: 16 }
  switch (status) {
    case 'Pending':
      return <Clock {...iconProps} color={C.pending} />
    case 'Printing':
      return <Loader2 {...iconProps} color={C.printing} className="animate-spin" />
    case 'Completed':
      return <CheckCircle {...iconProps} color={C.completed} />
    case 'Failed':
      return <XCircle {...iconProps} color={C.failed} />
    default:
      return null
  }
}

// 简单表格组件
const SimpleTable: React.FC<{
  columns: { key: string; title: string; width?: string; render?: (value: unknown, record: PrintJob) => React.ReactNode }[]
  data: PrintJob[]
  emptyText?: string
}> = ({ columns, data, emptyText = '暂无数据' }) => {
  if (data.length === 0) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textLight }}>
        {emptyText}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.border}`, background: C.bg }}>
            {columns.map(col => (
              <th key={col.key} style={{
                padding: '10px 12px',
                textAlign: 'left',
                fontWeight: 600,
                color: C.textMid,
                fontSize: 12,
                whiteSpace: 'nowrap',
                width: col.width || 'auto',
              }}>
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((record, idx) => (
            <tr key={record.id} style={{
              borderBottom: `1px solid ${C.border}`,
              background: idx % 2 === 0 ? C.white : C.bg,
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
              onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? C.white : C.bg)}
            >
              {columns.map(col => {
                const value = (record as unknown as Record<string, unknown>)[col.key]
                return (
                  <td key={col.key} style={{ padding: '10px 12px', color: C.textDark }}>
                    {col.render ? col.render(value, record) : String(value ?? '')}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 新建打印任务表单
interface NewPrintForm {
  patientName: string
  studyUid: string
  printer: '直连' | '洗片机1' | '洗片机2'
  layout: '1×1' | '2×2' | '4×4' | '8×8'
  medium: 'Blue Film' | 'Clear Film'
  copies: number
  filmCount: number
}

const DicomPrintPage: React.FC = () => {
  const [queue, setQueue] = useState<PrintJob[]>(printQueueManager.getQueue())
  const [history, setHistory] = useState<PrintJob[]>(printQueueManager.getHistory())
  const [form, setForm] = useState<NewPrintForm>({
    patientName: '',
    studyUid: '',
    printer: '直连',
    layout: '2×2',
    medium: 'Blue Film',
    copies: 1,
    filmCount: 1,
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // 订阅队列变化
  useEffect(() => {
    const unsubscribe = printQueueManager.subscribe((newQueue, newHistory) => {
      setQueue([...newQueue])
      setHistory([...newHistory])
    })
    return () => unsubscribe()
  }, [])

  // 显示消息
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // 提交新打印任务
  const handleSubmit = () => {
    if (!form.patientName.trim()) {
      showMessage('请输入患者姓名', 'error')
      return
    }
    if (!form.studyUid.trim()) {
      showMessage('请输入检查UID', 'error')
      return
    }

    setSubmitting(true)
    setTimeout(() => {
      printQueueManager.addJob({
        patientName: form.patientName,
        patientId: `P${Date.now()}`,
        studyUid: form.studyUid,
        examType: 'CT',
        filmCount: form.filmCount,
        layout: form.layout,
        medium: form.medium,
        copies: form.copies,
        printer: form.printer,
      })
      showMessage('打印任务已提交', 'success')
      setForm({
        patientName: '',
        studyUid: '',
        printer: '直连',
        layout: '2×2',
        medium: 'Blue Film',
        copies: 1,
        filmCount: 1,
      })
      setSubmitting(false)
    }, 500)
  }

  // 取消任务
  const handleCancel = (jobId: string) => {
    printQueueManager.cancelJob(jobId)
    showMessage('任务已取消', 'success')
  }

  // 重试任务
  const handleRetry = (jobId: string) => {
    printQueueManager.retryJob(jobId)
    showMessage('任务已重新提交', 'success')
  }

  // 队列列表列定义
  const queueColumns = [
    {
      key: 'filmId',
      title: '胶片ID',
      width: '140px',
      render: (value: unknown) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(value)}</span>
      ),
    },
    {
      key: 'patientName',
      title: '患者姓名',
      width: '100px',
    },
    {
      key: 'filmCount',
      title: '胶片数',
      width: '80px',
      render: (value: unknown) => (
        <span style={{ textAlign: 'center', display: 'block' }}>{String(value)}</span>
      ),
    },
    {
      key: 'createTime',
      title: '创建时间',
      width: '150px',
      render: (value: unknown) => (
        <span style={{ fontSize: 12, color: C.textMid }}>{String(value)}</span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: '100px',
      render: (_: unknown, record: PrintJob) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusIcon status={record.status} />
          <span style={{ color: statusColor[record.status], fontWeight: 500 }}>
            {statusText[record.status]}
          </span>
        </div>
      ),
    },
    {
      key: 'progress',
      title: '进度',
      width: '120px',
      render: (_: unknown, record: PrintJob) => {
        if (record.status === 'Pending') return <span style={{ color: C.textLight }}>等待中</span>
        if (record.status === 'Completed') return <span style={{ color: C.success }}>已完成</span>
        if (record.status === 'Failed') return <span style={{ color: C.danger }}>{record.errorMsg || '失败'}</span>
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${record.progress || 0}%`,
                height: '100%',
                background: C.primaryLight,
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 12, color: C.textMid }}>{record.progress || 0}%</span>
          </div>
        )
      },
    },
    {
      key: 'action',
      title: '操作',
      width: '100px',
      render: (_: unknown, record: PrintJob) => (
        <div style={{ display: 'flex', gap: 8 }}>
          {record.status === 'Pending' && (
            <button
              onClick={() => handleCancel(record.id)}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                border: 'none',
                borderRadius: 4,
                background: C.danger,
                color: C.white,
                cursor: 'pointer',
              }}
            >
              取消
            </button>
          )}
          {record.status === 'Failed' && (
            <button
              onClick={() => handleRetry(record.id)}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                border: 'none',
                borderRadius: 4,
                background: C.primary,
                color: C.white,
                cursor: 'pointer',
              }}
            >
              重试
            </button>
          )}
        </div>
      ),
    },
  ]

  // 历史记录列定义
  const historyColumns = [
    {
      key: 'filmId',
      title: '胶片ID',
      width: '140px',
      render: (value: unknown) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(value)}</span>
      ),
    },
    {
      key: 'patientName',
      title: '患者姓名',
      width: '100px',
    },
    {
      key: 'examType',
      title: '检查类型',
      width: '80px',
      render: (value: unknown) => (
        <span style={{ textAlign: 'center', display: 'block' }}>{String(value)}</span>
      ),
    },
    {
      key: 'filmCount',
      title: '胶片数',
      width: '70px',
      render: (value: unknown) => (
        <span style={{ textAlign: 'center', display: 'block' }}>{String(value)}</span>
      ),
    },
    {
      key: 'layout',
      title: '布局',
      width: '70px',
      render: (value: unknown) => (
        <span style={{ textAlign: 'center', display: 'block' }}>{String(value)}</span>
      ),
    },
    {
      key: 'medium',
      title: '介质',
      width: '100px',
    },
    {
      key: 'copies',
      title: '份数',
      width: '60px',
      render: (value: unknown) => (
        <span style={{ textAlign: 'center', display: 'block' }}>{String(value)}</span>
      ),
    },
    {
      key: 'printer',
      title: '打印机',
      width: '90px',
    },
    {
      key: 'createTime',
      title: '创建时间',
      width: '150px',
      render: (value: unknown) => (
        <span style={{ fontSize: 12, color: C.textMid }}>{String(value)}</span>
      ),
    },
    {
      key: 'completeTime',
      title: '完成时间',
      width: '150px',
      render: (value: unknown) => (
        <span style={{ fontSize: 12, color: C.textMid }}>{value ? String(value) : '-'}</span>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: '90px',
      render: (_: unknown, record: PrintJob) => (
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 500,
          background: `${statusColor[record.status]}20`,
          color: statusColor[record.status],
        }}>
          {statusText[record.status]}
        </span>
      ),
    },
  ]

  // 统计数据
  const pendingCount = queue.filter(j => j.status === 'Pending').length
  const printingCount = queue.filter(j => j.status === 'Printing').length
  const completedCount = history.filter(j => j.status === 'Completed').length
  const failedCount = history.filter(j => j.status === 'Failed').length

  return (
    <PageContainer background="slate" maxWidth="full" padding={0} testId="dicom-print-page">
      {/* 消息提示 */}
      {message && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          borderRadius: 6,
          background: message.type === 'success' ? C.success : C.danger,
          color: C.white,
          fontSize: 14,
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {message.text}
        </div>
      )}

      {/* 顶部标题栏 */}
      <PageHeader
        title="DICOM打印管理"
        subtitle="DICOM Print SCP 胶片打印管理子系统"
        icon={
          <div style={{
            width: 48,
            height: 48,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Printer size={24} color="#ffffff" />
          </div>
        }
        variant="banner"
        bannerBg={`linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`}
      />

      {/* 统计卡片 */}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        padding: '16px 24px',
      }}>
        <div style={{
          background: C.white,
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: `${C.pending}20`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} color={C.pending} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.textDark }}>{pendingCount}</div>
              <div style={{ fontSize: 12, color: C.textMid }}>等待中</div>
            </div>
          </div>
        </div>
        <div style={{
          background: C.white,
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: `${C.printing}20`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={20} color={C.printing} className="animate-spin" />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.textDark }}>{printingCount}</div>
              <div style={{ fontSize: 12, color: C.textMid }}>打印中</div>
            </div>
          </div>
        </div>
        <div style={{
          background: C.white,
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: `${C.completed}20`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={20} color={C.completed} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.textDark }}>{completedCount}</div>
              <div style={{ fontSize: 12, color: C.textMid }}>已完成</div>
            </div>
          </div>
        </div>
        <div style={{
          background: C.white,
          borderRadius: 8,
          padding: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, background: `${C.failed}20`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={20} color={C.failed} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.textDark }}>{failedCount}</div>
              <div style={{ fontSize: 12, color: C.textMid }}>失败</div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, padding: '0 24px 16px' }}>
        {/* 左侧：打印机队列列表 */}
        <div style={{
          background: C.white,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Film size={18} color={C.primary} />
              <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>打印机队列</span>
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 500,
                background: `${C.primary}15`,
                color: C.primary,
              }}>
                {queue.length}
              </span>
            </div>
            <button
              onClick={() => {
                setQueue([...printQueueManager.getQueue()])
                setHistory([...printQueueManager.getHistory()])
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 12,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                background: C.white,
                color: C.textMid,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
          <SimpleTable columns={queueColumns} data={queue} />
        </div>

        {/* 右侧：新建打印任务表单 */}
        <div style={{
          background: C.white,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <Plus size={18} color={C.primary} />
            <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>新建打印任务</span>
          </div>
          <div style={{ padding: 16 }}>
            {/* 患者姓名 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: C.textMid }}>
                患者姓名
              </label>
              <input
                type="text"
                placeholder="请输入患者姓名"
                value={form.patientName}
                onChange={e => setForm({ ...form, patientName: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = C.primary)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>

            {/* 检查UID */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: C.textMid }}>
                检查UID
              </label>
              <input
                type="text"
                placeholder="请输入检查UID"
                value={form.studyUid}
                onChange={e => setForm({ ...form, studyUid: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = C.primary)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>

            {/* 打印机选择 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: C.textMid }}>
                打印机
              </label>
              <select
                value={form.printer}
                onChange={e => setForm({ ...form, printer: e.target.value as '直连' | '洗片机1' | '洗片机2' })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                  background: C.white,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <option value="直连">直连</option>
                <option value="洗片机1">洗片机1</option>
                <option value="洗片机2">洗片机2</option>
              </select>
            </div>

            {/* 胶片布局 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: C.textMid }}>
                胶片布局
              </label>
              <select
                value={form.layout}
                onChange={e => setForm({ ...form, layout: e.target.value as '1×1' | '2×2' | '4×4' | '8×8' })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                  background: C.white,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <option value="1×1">1×1</option>
                <option value="2×2">2×2</option>
                <option value="4×4">4×4</option>
                <option value="8×8">8×8</option>
              </select>
            </div>

            {/* 介质 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: C.textMid }}>
                介质
              </label>
              <select
                value={form.medium}
                onChange={e => setForm({ ...form, medium: e.target.value as 'Blue Film' | 'Clear Film' })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                  background: C.white,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <option value="Blue Film">蓝膜</option>
                <option value="Clear Film">透明膜</option>
              </select>
            </div>

            {/* 复制份数 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: C.textMid }}>
                复制份数 (1-9)
              </label>
              <input
                type="number"
                min={1}
                max={9}
                value={form.copies}
                onChange={e => setForm({ ...form, copies: Math.max(1, Math.min(9, parseInt(e.target.value) || 1)) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = C.primary)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>

            {/* 胶片数量 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: C.textMid }}>
                胶片数量
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.filmCount}
                onChange={e => setForm({ ...form, filmCount: Math.max(1, parseInt(e.target.value) || 1) })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = C.primary)}
                onBlur={e => (e.target.style.borderColor = C.border)}
              />
            </div>

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: 15,
                fontWeight: 600,
                border: 'none',
                borderRadius: 6,
                background: submitting ? C.textLight : C.primary,
                color: C.white,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = C.primaryLight }}
              onMouseLeave={e => { if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = C.primary }}
            >
              {submitting ? '提交中...' : '提交打印任务'}
            </button>
          </div>
        </div>
      </div>

      {/* 下方：打印历史记录表格 */}
      <div style={{
        margin: '0 24px 24px',
        background: C.white,
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <Clock size={18} color={C.primary} />
          <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>打印历史记录</span>
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 500,
            background: `${C.success}15`,
            color: C.success,
          }}>
            {history.length}
          </span>
        </div>
        <SimpleTable columns={historyColumns} data={history} />
      </div>

      {/* 分页 */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '12px 24px',
        borderTop: `1px solid ${C.border}`,
        background: C.white,
        margin: '0 24px 24px',
        borderRadius: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: C.textMid }}>共 {history.length} 条</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button disabled style={{
              padding: '6px 12px',
              fontSize: 12,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              background: C.white,
              color: C.textLight,
              cursor: 'not-allowed',
            }}>
              上一页
            </button>
            <button disabled style={{
              padding: '6px 12px',
              fontSize: 12,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              background: C.white,
              color: C.textLight,
              cursor: 'not-allowed',
            }}>
              下一页
            </button>
          </div>
        </div>
      </div>

      {/* Spin动画样式 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </PageContainer>
  )
}

export default DicomPrintPage
