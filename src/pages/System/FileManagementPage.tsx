// G005 放射RIS系统 v3.0.6.11-79 - W1-A 文件管理页面
// 流程: getUploadUrl(预签名 token) → upload(raw body, 进度) → upload-complete(校验和)
// 后端无文件列表端点 → 列表为本会话上传台账 (sessionStorage)
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  UploadCloud, FileText, Download, RefreshCw, CheckCircle2, XCircle,
  Loader2, FolderOpen, HardDrive, FileType2, Trash2,
} from 'lucide-react'
import {
  filesApi, isSupportedFile, sha256Hex,
  type UploadedFileRecord,
} from '../../services/api/filesApi'
import { PageContainer, PageHeader } from '../../components/common'

const C = {
  primary: '#1a365d',
  primaryLight: '#2c5282',
  primaryLighter: '#3182ce',
  white: '#ffffff',
  bg: '#f7fafc',
  border: '#e2e8f0',
  textDark: '#1a202c',
  textMid: '#4a5568',
  textLight: '#94a3b8',
  success: '#38a169',
  danger: '#e53e3e',
  info: '#3182ce',
}

interface UploadTask {
  fileName: string
  size: number
  progress: number
  status: 'pending' | 'uploading' | 'confirming' | 'done' | 'error'
  error?: string
}

const initialTask: UploadTask = {
  fileName: '',
  size: 0,
  progress: 0,
  status: 'pending',
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function shortChecksum(checksum: string): string {
  if (!checksum) return '-'
  return checksum.length > 12 ? `${checksum.slice(0, 8)}…${checksum.slice(-4)}` : checksum
}

export default function FileManagementPage() {
  const [files, setFiles] = useState<UploadedFileRecord[]>(() => filesApi.listFiles())
  const [selected, setSelected] = useState<File | null>(null)
  const [task, setTask] = useState<UploadTask>(initialTask)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    setFiles(filesApi.listFiles())
  }, [])

  const stats = useMemo(() => {
    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    const byType = new Map<string, number>()
    for (const f of files) {
      const key = f.contentType || '未知类型'
      byType.set(key, (byType.get(key) ?? 0) + 1)
    }
    return {
      count: files.length,
      totalSize,
      byType: Array.from(byType.entries()).map(([type, count]) => ({ type, count })),
    }
  }, [files])

  const onPickFile = useCallback((file: File | null) => {
    setError(null)
    setTask(initialTask)
    if (!file) {
      setSelected(null)
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      setError('文件大小超过限制 (100MB)')
      setSelected(null)
      return
    }
    if (!isSupportedFile(file)) {
      setError('不支持的文件类型，仅支持 jpg/png/gif/webp/dcm/pdf/zip')
      setSelected(null)
      return
    }
    setSelected(file)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!selected) return
    setError(null)
    setTask({ fileName: selected.name, size: selected.size, progress: 0, status: 'uploading' })
    try {
      // 1/3 预签名上传地址
      const presign = await filesApi.getUploadUrl(selected.name, selected.type || 'application/octet-stream', selected.size)
      // 2/3 raw body 上传
      const result = await filesApi.upload(selected, presign.token, (percent) => {
        setTask((t) => ({ ...t, progress: percent, status: 'uploading' }))
      })
      setTask((t) => ({ ...t, progress: 100, status: 'confirming' }))
      // 3/3 上传完成确认 (校验和)
      const checksum = await sha256Hex(await selected.arrayBuffer())
      await filesApi.completeUpload({
        token: presign.token,
        metadata: { size: result.size, checksum, filename: selected.name },
      })
      const record: UploadedFileRecord = {
        id: result.id,
        name: selected.name,
        contentType: selected.type || 'application/octet-stream',
        size: result.size,
        checksum: result.checksum || checksum,
        uploadedAt: result.uploadedAt,
        downloadUrl: result.url,
      }
      setFiles(filesApi.saveSessionFile(record))
      setTask({ ...initialTask, fileName: selected.name, size: selected.size, progress: 100, status: 'done' })
      setSelected(null)
    } catch (err) {
      setTask((t) => ({
        ...t,
        status: 'error',
        error: (err as Error)?.message || '上传失败',
      }))
    }
  }, [selected])

  const handleDownload = useCallback(async (record: UploadedFileRecord) => {
    setDownloadingId(record.id)
    setError(null)
    try {
      const result = await filesApi.download(record.id, record.name)
      if (!result) {
        setError('下载失败: 文件不存在或上传会话已过期')
        return
      }
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename || record.name
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('下载失败: 网络错误')
    } finally {
      setDownloadingId(null)
    }
  }, [])

  const handleClear = useCallback(() => {
    filesApi.clearSessionFiles()
    setFiles([])
  }, [])

  const uploading = task.status === 'uploading' || task.status === 'confirming'
  const busy = uploading || downloadingId !== null

  return (
    <PageContainer>
      <PageHeader
        icon={<FolderOpen size={20} color="#1e40af" />}
        title="文件管理"
        subtitle="文件上传 / 下载 · 预签名上传 · 校验和确认"
        actions={
          <button
            onClick={handleClear}
            disabled={files.length === 0}
            style={btnSecondary(files.length === 0)}
          >
            <Trash2 size={15} /> 清空会话记录
          </button>
        }
      />

      {/* 统计卡片 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <StatCard icon={<FolderOpen size={20} color={C.primaryLighter} />} label="文件数量" value={`${stats.count} 个`} />
        <StatCard icon={<HardDrive size={20} color={C.primaryLighter} />} label="总大小" value={formatSize(stats.totalSize)} />
        <StatCard
          icon={<FileType2 size={20} color={C.primaryLighter} />}
          label="类型分布"
          value={stats.byType.map((t) => t.type).join(' / ') || '-'}
        />
      </div>

      {/* 上传区 */}
      <div style={cardStyle}>
        <div style={sectionTitle}>
          <UploadCloud size={18} color={C.primary} /> 上传文件
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 8,
            border: `1px dashed ${C.primaryLighter}`,
            background: '#ebf4ff',
            color: C.primaryLight,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}>
            <FolderOpen size={16} />
            {selected ? selected.name : '选择文件 (jpg/png/gif/webp/dcm/pdf/zip)'}
            <input
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {selected && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              style={btnPrimary(uploading)}
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              {task.status === 'confirming' ? '确认中…' : uploading ? '上传中…' : '开始上传'}
            </button>
          )}
        </div>

        {/* 进度 */}
        {task.status !== 'pending' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMid, marginBottom: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} />
                {task.fileName} ({formatSize(task.size)})
              </span>
              <span>
                {task.status === 'done' && (
                  <span style={{ color: C.success, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={14} /> 上传成功
                  </span>
                )}
                {task.status === 'error' && (
                  <span style={{ color: C.danger, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <XCircle size={14} /> {task.error}
                  </span>
                )}
                {uploading && <span>{task.progress}%</span>}
                {task.status === 'confirming' && <span>校验中…</span>}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${task.status === 'done' ? 100 : task.progress}%`,
                borderRadius: 4,
                background: task.status === 'error' ? C.danger : C.primaryLighter,
                transition: 'width 0.2s',
              }} />
            </div>
          </div>
        )}

        {error && (
          <div style={errorBanner}>
            <XCircle size={16} /> {error}
          </div>
        )}
      </div>

      {/* 已上传文件列表 */}
      <div style={cardStyle}>
        <div style={{ ...sectionTitle, justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color={C.primary} /> 本次会话已上传文件 ({files.length})
          </span>
          <button
            onClick={() => setFiles(filesApi.listFiles())}
            style={btnSecondary(false)}
          >
            <RefreshCw size={14} /> 刷新
          </button>
        </div>
        {files.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textLight }}>
            <FolderOpen size={36} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>暂无上传记录，请选择文件上传</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}`, background: C.bg }}>
                  {['文件名', '类型', '大小', '上传时间', '校验和', '操作'].map((h) => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: C.textMid, fontSize: 12, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((f, idx) => (
                  <tr
                    key={f.id}
                    style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? C.white : C.bg }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? C.white : C.bg)}
                  >
                    <td style={{ padding: '10px 12px', color: C.textDark }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={15} color={C.primaryLighter} /> {f.name}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: C.textMid }}>{f.contentType}</td>
                    <td style={{ padding: '10px 12px', color: C.textDark }}>{formatSize(f.size)}</td>
                    <td style={{ padding: '10px 12px', color: C.textMid, whiteSpace: 'nowrap' }}>{formatTime(f.uploadedAt)}</td>
                    <td style={{ padding: '10px 12px', color: C.textLight, fontFamily: 'monospace', fontSize: 12 }}>{shortChecksum(f.checksum)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button
                        onClick={() => handleDownload(f)}
                        disabled={busy}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 14px',
                          borderRadius: 6,
                          border: 'none',
                          background: C.primaryLight,
                          color: C.white,
                          cursor: busy ? 'not-allowed' : 'pointer',
                          fontSize: 13,
                          opacity: busy ? 0.6 : 1,
                        }}
                      >
                        {downloadingId === f.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        下载
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageContainer>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 180,
      padding: '14px 16px',
      borderRadius: 10,
      background: C.white,
      border: `1px solid ${C.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: '#ebf4ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, color: C.textLight }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>{value}</div>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
}

const sectionTitle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 15,
  fontWeight: 700,
  color: C.textDark,
  marginBottom: 12,
}

const errorBanner: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 14px',
  borderRadius: 8,
  background: '#fef2f2',
  border: `1px solid #fecaca`,
  color: C.danger,
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: C.primary,
    color: C.white,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
    fontWeight: 600,
    opacity: disabled ? 0.6 : 1,
  }
}

function btnSecondary(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.white,
    color: C.textMid,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
    opacity: disabled ? 0.5 : 1,
  }
}
