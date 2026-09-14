// G005 DICOM Print SCP 胶片打印管理子系统 v1.0.0
// [v3.0.6.11-81] W2-B: printQueueManager → printApi (/print/* MSW 演示数据, 失败回退本地模拟队列)
import React, { useState, useEffect } from 'react'
import { Printer, Film, Clock, CheckCircle, XCircle, Loader2, Plus, RefreshCw } from 'lucide-react'
import { printQueueManager, PrintJob } from '../../data/printQueue'
import { printApi, type PrintTaskDto } from '../../services/api/printApi'
import { PageContainer, PageHeader } from '../../components/common'
import { t } from '../../i18n/appI18n'

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
}> = ({ columns, data, emptyText = t('dicomPrint.noData') }) => {
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
  const [queue, setQueue] = useState<PrintJob[]>([])
  const [history, setHistory] = useState<PrintJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'api' | 'local'>('api')
  const [historyPage, setHistoryPage] = useState(1)
  const HISTORY_PAGE_SIZE = 8
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE))
  const historyPageData = history.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
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

  // [W2-B] 真实化: /print/* API + loading/error; 失败回退本地 printQueueManager
  const statusMap: Record<PrintTaskDto['status'], PrintJob['status']> = {
    queued: 'Pending', printing: 'Printing', completed: 'Completed', failed: 'Failed',
  }

  const toPrintJob = (task: PrintTaskDto): PrintJob => ({
    id: task.id,
    filmId: task.filmId ?? task.id,
    patientName: task.patientName,
    patientId: task.patientId ?? '',
    studyUid: '',
    examType: task.modality ?? 'CT',
    filmCount: task.copies ?? 1,
    layout: '2×2',
    medium: 'Blue Film',
    copies: task.copies ?? 1,
    printer: (task.printer as PrintJob['printer']) ?? '直连',
    status: statusMap[task.status],
    createTime: task.submitTime,
    completeTime: task.completeTime ?? undefined,
    progress: task.progress ?? 0,
    errorMsg: task.errorMsg,
  })

  const loadFromApi = async (): Promise<boolean> => {
    try {
      const [queueRes, historyRes] = await Promise.all([
        printApi.listQueue(),
        printApi.listHistory(),
      ])
      if (queueRes.success && Array.isArray(queueRes.data)) {
        setQueue(queueRes.data.map(toPrintJob))
        setSource('api')
        setError(null)
      }
      if (historyRes.success && Array.isArray(historyRes.data)) {
        setHistory(historyRes.data.map(toPrintJob))
        setSource('api')
      }
      return queueRes.success && historyRes.success
    } catch {
      return false
    }
  }

  const fallbackToLocal = () => {
    setSource('local')
    setQueue([...printQueueManager.getQueue()])
    setHistory([...printQueueManager.getHistory()])
    const unsubscribe = printQueueManager.subscribe((newQueue, newHistory) => {
      setQueue([...newQueue])
      setHistory([...newHistory])
      setHistoryPage(1)
    })
    return unsubscribe
  }

  // 订阅队列变化 (API 模式: 轮询; 本地模式: printQueueManager 订阅)
  useEffect(() => {
    let cancelled = false
    let unsubscribeLocal: (() => void) | null = null
    let timer: ReturnType<typeof setInterval> | null = null

    void (async () => {
      setLoading(true)
      const ok = await loadFromApi()
      if (cancelled) return
      if (ok) {
        // API 模式: 5s 轮询刷新 (绕过 client 内存缓存)
        timer = setInterval(() => {
          void loadFromApi()
        }, 5000)
      } else {
        setError(t('dicomPrint.apiUnavailable'))
        unsubscribeLocal = fallbackToLocal()
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      unsubscribeLocal?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 显示消息
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 3000)
  }

  // 提交新打印任务
  const handleSubmit = async () => {
    if (!form.patientName.trim()) {
      showMessage(t('dicomPrint.patientNameRequired'), 'error')
      return
    }
    if (!form.studyUid.trim()) {
      showMessage(t('dicomPrint.studyUidRequired'), 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await printApi.createJob({
        patientName: form.patientName,
        patientId: `P${Date.now()}`,
        copies: form.filmCount,
        filmSpec: form.layout,
        printer: form.printer,
      })
      if (!res.success) {
        showMessage(res.error?.message ?? t('dicomPrint.submitFailed'), 'error')
      } else {
        showMessage(t('dicomPrint.jobSubmitted'), 'success')
        await loadFromApi()
      }
      setForm({
        patientName: '',
        studyUid: '',
        printer: '直连',
        layout: '2×2',
        medium: 'Blue Film',
        copies: 1,
        filmCount: 1,
      })
    } catch {
      showMessage(t('dicomPrint.submitFailedRetry'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // 取消任务
  const handleCancel = async (jobId: string) => {
    const ok = await printApi.cancelJob(jobId)
    if (ok.success) {
      await loadFromApi()
      showMessage(t('dicomPrint.jobCancelled'), 'success')
    } else {
      showMessage(t('dicomPrint.cancelFailed'), 'error')
    }
  }

  // 重试任务
  const handleRetry = async (jobId: string) => {
    const ok = await printApi.retryJob(jobId)
    if (ok.success) {
      await loadFromApi()
      showMessage(t('dicomPrint.jobResubmitted'), 'success')
    } else {
      showMessage(t('dicomPrint.retryFailed'), 'error')
    }
  }

  // 队列列表列定义
  const queueColumns = [
    {
      key: 'filmId',
      title: t('dicomPrint.colFilmId'),
      width: '140px',
      render: (value: unknown) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(value)}</span>
      ),
    },
    {
      key: 'patientName',
      title: t('dicomPrint.colPatientName'),
      width: '100px',
    },
    {
      key: 'filmCount',
      title: t('dicomPrint.colFilmCount'),
      width: '80px',
      render: (value: unknown) => (
        <span style={{ textAlign: 'center', display: 'block' }}>{String(value)}</span>
      ),
    },
    {
      key: 'createTime',
      title: t('dicomPrint.colCreateTime'),
      width: '150px',
      render: (value: unknown) => (
        <span style={{ fontSize: 12, color: C.textMid }}>{String(value)}</span>
      ),
    },
    {
      key: 'status',
      title: t('dicomPrint.colStatus'),
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
      title: t('dicomPrint.colProgress'),
      width: '120px',
      render: (_: unknown, record: PrintJob) => {
        if (record.status === 'Pending') return <span style={{ color: C.textLight }}>{t('dicomPrint.statusPending')}</span>
        if (record.status === 'Completed') return <span style={{ color: C.success }}>{t('dicomPrint.statusCompleted')}</span>
        if (record.status === 'Failed') return <span style={{ color: C.danger }}>{record.errorMsg || t('dicomPrint.statusFailed')}</span>
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
      title: t('dicomPrint.colActions'),
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
              {t('dicomPrint.cancel')}
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
              {t('dicomPrint.retryBtn')}
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
      title: t('dicomPrint.colFilmId'),
      width: '140px',
      render: (value: unknown) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(value)}</span>
      ),
    },
    {
      key: 'patientName',
      title: t('dicomPrint.colPatientName'),
      width: '100px',
    },
    {
      key: 'examType',
      title: t('dicomPrint.colExamType'),
      width: '80px',
      render: (value: unknown) => (
        <span style={{ textAlign: 'center', display: 'block' }}>{String(value)}</span>
      ),
    },
    {
      key: 'filmCount',
      title: t('dicomPrint.colFilmCount'),
      width: '70px',
      render: (value: unknown) => (
        <span style={{ textAlign: 'center', display: 'block' }}>{String(value)}</span>
      ),
    },
    {
      key: 'layout',
      title: t('dicomPrint.colLayout'),
      width: '70px',
      render: (value: unknown) => (
        <span style={{ textAlign: 'center', display: 'block' }}>{String(value)}</span>
      ),
    },
    {
      key: 'medium',
      title: t('dicomPrint.colMedium'),
      width: '100px',
      render: (value: unknown) => {
        const MEDIUM_LABELS: Record<string, string> = {
          'blue film': '蓝膜',
          'blue-film': '蓝膜',
          'BLUE FILM': '蓝膜',
          'clear film': '透明膜',
          'clear-film': '透明膜',
          'CLEAR FILM': '透明膜',
        };
        const v = String(value ?? '');
        return <span style={{ textAlign: 'center', display: 'block' }}>{MEDIUM_LABELS[v] ?? v}</span>;
      },
    },
    {
      key: 'copies',
      title: t('dicomPrint.colCopies'),
      width: '60px',
      render: (value: unknown) => (
        <span style={{ textAlign: 'center', display: 'block' }}>{String(value)}</span>
      ),
    },
    {
      key: 'printer',
      title: t('dicomPrint.colPrinter'),
      width: '90px',
    },
    {
      key: 'createTime',
      title: t('dicomPrint.colCreateTime'),
      width: '150px',
      render: (value: unknown) => (
        <span style={{ fontSize: 12, color: C.textMid }}>{String(value)}</span>
      ),
    },
    {
      key: 'completeTime',
      title: t('dicomPrint.colCompleteTime'),
      width: '150px',
      render: (value: unknown) => (
        <span style={{ fontSize: 12, color: C.textMid }}>{value ? String(value) : '-'}</span>
      ),
    },
    {
      key: 'status',
      title: t('dicomPrint.colStatus'),
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
        title={t('dicomPrint.title')}
        subtitle={t('dicomPrint.subtitle')}
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
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading && <Loader2 size={16} color="#ffffff" className="animate-spin" />}
            <span style={{
              padding: '3px 12px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 500,
              background: source === 'api' ? 'rgba(56,161,105,0.25)' : 'rgba(214,158,46,0.25)',
              color: source === 'api' ? '#c6f6d5' : '#fefcbf',
            }}>
              {source === 'api' ? t('dicomPrint.sourceApi') : t('dicomPrint.sourceLocal')}
            </span>
            {error && <span style={{ fontSize: 12, color: '#feb2b2' }}>{error}</span>}
          </div>
        }
      />

      {/* 统计卡片 */}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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
              <div style={{ fontSize: 12, color: C.textMid }}>{t('dicomPrint.statusPending')}</div>
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
              <div style={{ fontSize: 12, color: C.textMid }}>{t('dicomPrint.statusPrinting')}</div>
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
              <div style={{ fontSize: 12, color: C.textMid }}>{t('dicomPrint.statusCompleted')}</div>
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
              <div style={{ fontSize: 12, color: C.textMid }}>{t('dicomPrint.statusFailed')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, padding: '0 24px 16px' }}>
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
              <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>{t('dicomPrint.queueTitle')}</span>
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
                if (source === 'api') {
                  void loadFromApi()
                } else {
                  setQueue([...printQueueManager.getQueue()])
                  setHistory([...printQueueManager.getHistory()])
                }
                setHistoryPage(1)
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
              {t('dicomPrint.refresh')}
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
            <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>{t('dicomPrint.newJobTitle')}</span>
          </div>
          <div style={{ padding: 16 }}>
            {/* 患者姓名 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: C.textMid }}>
                {t('dicomPrint.labelPatientName')}
              </label>
              <input
                type="text"
                placeholder={t('dicomPrint.patientNamePlaceholder')}
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
                {t('dicomPrint.labelStudyUid')}
              </label>
              <input
                type="text"
                placeholder={t('dicomPrint.studyUidPlaceholder')}
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
                {t('dicomPrint.labelPrinter')}
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
                {t('dicomPrint.labelLayout')}
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
                {t('dicomPrint.labelMedium')}
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
                <option value="Blue Film">{t('dicomPrint.blueFilm')}</option>
                <option value="Clear Film">{t('dicomPrint.clearFilm')}</option>
              </select>
            </div>

            {/* 复制份数 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, color: C.textMid }}>
                {t('dicomPrint.labelCopies')}
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
                {t('dicomPrint.labelFilmCount')}
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
              {submitting ? t('dicomPrint.submitting') : t('dicomPrint.submitJob')}
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
          <span style={{ fontSize: 16, fontWeight: 600, color: C.textDark }}>{t('dicomPrint.historyTitle')}</span>
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
        <SimpleTable columns={historyColumns} data={historyPageData} />
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
          <span style={{ fontSize: 13, color: C.textMid }}>{t('dicomPrint.pagination', { total: history.length, page: historyPage, pages: totalHistoryPages })}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button disabled={historyPage <= 1} onClick={() => setHistoryPage(p => Math.max(1, p - 1))} style={{
              padding: '6px 12px',
              fontSize: 12,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              background: historyPage <= 1 ? C.bg : C.white,
              color: historyPage <= 1 ? C.textLight : C.textMid,
              cursor: historyPage <= 1 ? 'not-allowed' : 'pointer',
            }}>
              {t('dicomPrint.prevPage')}
            </button>
            <button disabled={historyPage >= totalHistoryPages} onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))} style={{
              padding: '6px 12px',
              fontSize: 12,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              background: historyPage >= totalHistoryPages ? C.bg : C.white,
              color: historyPage >= totalHistoryPages ? C.textLight : C.textMid,
              cursor: historyPage >= totalHistoryPages ? 'not-allowed' : 'pointer',
            }}>
              {t('dicomPrint.nextPage')}
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
