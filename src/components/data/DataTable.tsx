import { useState, useRef, useCallback, useMemo, useEffect, type ReactNode, type CSSProperties, type KeyboardEvent } from 'react'
import { Checkbox, Button, Dropdown, Space, Input, Badge } from 'antd'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import { Download, Columns, ChevronDown, ChevronUp, GripVertical, X, FileSpreadsheet, Trash2, Check } from 'lucide-react'

export interface DataTableColumn<T = Record<string, unknown>> {
  key: string
  title: string
  width?: number
  frozen?: boolean
  fixed?: 'left' | 'right'
  render?: (value: unknown, record: T, index: number) => ReactNode
  editable?: boolean
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: DataTableColumn<T>[]
  dataSource: T[]
  rowKey?: keyof T | ((record: T) => string)
  loading?: boolean
  onBulkAction?: (action: string, selectedIds: string[]) => void
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  height?: number
}

const cellStyle: CSSProperties = {
  borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
  padding: '8px 12px',
  fontSize: 13,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 300,
}

const headerCellStyle: CSSProperties = {
  ...cellStyle,
  fontWeight: 600,
  color: 'var(--text-secondary, #64748b)',
  background: 'var(--bg-card, #f8fafc)',
  position: 'sticky',
  top: 0,
  zIndex: 2,
  borderTop: '1px solid var(--border-subtle, #e2e8f0)',
  userSelect: 'none',
}

function getRowKey<T>(record: T, rowKey?: keyof T | ((record: T) => string)): string {
  if (!rowKey) return (record as Record<string, unknown>).id as string ?? JSON.stringify(record)
  if (typeof rowKey === 'function') return rowKey(record)
  return String(record[rowKey] ?? JSON.stringify(record))
}

function csvEscape(val: unknown): string {
  const s = String(val ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

export function DataTable<T extends Record<string, unknown> = Record<string, unknown>>({
  columns,
  dataSource,
  rowKey,
  loading,
  onBulkAction,
  pageSize = 50,
  total: totalProp,
  onPageChange,
  height = 600,
}: DataTableProps<T>) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(columns.map((c) => c.key)),
  )
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map((c) => c.key))
  const [editingCell, setEditingCell] = useState<{ row: string; col: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const dragRef = useRef<{ key: string; startX: number; moveHandler: ((ev: MouseEvent) => void) | null; upHandler: (() => void) | null } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => {
    const d = dragRef.current
    if (!d) return
    if (d.moveHandler) document.removeEventListener('mousemove', d.moveHandler)
    if (d.upHandler) document.removeEventListener('mouseup', d.upHandler)
  }, [])

  const totalRows = totalProp ?? dataSource.length
  const totalPages = Math.ceil(totalRows / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const pageData = dataSource.slice(startIndex, startIndex + pageSize)
  const frozenCount = columns.filter((c) => c.frozen).length

  // columns prop 变化时同步内部 columnOrder 与 visibleColumns
  useEffect(() => {
    const keys = columns.map((c) => c.key);
    setColumnOrder(keys);
    setVisibleColumns(new Set(keys));
  }, [columns]);

  const visibleCols = useMemo(
    () =>
      columnOrder
        .filter((k) => visibleColumns.has(k))
        .map((k) => columns.find((c) => c.key === k))
        .filter((c): c is DataTableColumn<T> => Boolean(c)),
    [columnOrder, visibleColumns, columns],
  )

  const allPageSelected = pageData.length > 0 && pageData.every((r) => selectedKeys.has(getRowKey(r, rowKey)))

  const handleSelectAll = useCallback((e: CheckboxChangeEvent) => {
    if (e.target.checked) {
      const all = new Set(pageData.map((r) => getRowKey(r, rowKey)))
      setSelectedKeys(all)
    } else {
      setSelectedKeys(new Set())
    }
  }, [pageData, rowKey])

  const handleSelectRow = useCallback((id: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDragStart = useCallback((key: string, e: React.MouseEvent) => {
    if (dragRef.current?.moveHandler) document.removeEventListener('mousemove', dragRef.current.moveHandler)
    if (dragRef.current?.upHandler) document.removeEventListener('mouseup', dragRef.current.upHandler)
    const handler = (ev: MouseEvent) => {
      const cur = dragRef.current
      if (!cur) return
      const move = ev.clientX - cur.startX
      if (Math.abs(move) > 20) {
        const fromIdx = columnOrder.indexOf(cur.key)
        const toIdx = Math.min(Math.max(fromIdx + (move > 0 ? 1 : -1), 0), columnOrder.length - 1)
        if (fromIdx !== toIdx) {
          const newOrder = [...columnOrder]
          newOrder.splice(fromIdx, 1)
          newOrder.splice(toIdx, 0, cur.key)
          setColumnOrder(newOrder)
        }
        document.removeEventListener('mousemove', handler)
        document.removeEventListener('mouseup', upHandler)
        dragRef.current = null
      }
    }
    const upHandler = () => {
      const cur = dragRef.current
      if (cur?.moveHandler) document.removeEventListener('mousemove', cur.moveHandler)
      if (cur?.upHandler) document.removeEventListener('mouseup', cur.upHandler)
      dragRef.current = null
    }
    dragRef.current = { key, startX: e.clientX, moveHandler: handler, upHandler }
    document.addEventListener('mousemove', handler)
    document.addEventListener('mouseup', upHandler)
  }, [columnOrder])

  const toggleColumnVisibility = useCallback((key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key) && next.size > 1) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const startEdit = useCallback((rowId: string, colKey: string, currentValue: unknown) => {
    setEditingCell({ row: rowId, col: colKey })
    setEditValue(String(currentValue ?? ''))
  }, [])

  const commitEdit = useCallback(() => {
    setEditingCell(null)
    setEditValue('')
  }, [])

  const handleEditKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') commitEdit()
  }, [commitEdit])

  const exportCsv = useCallback(() => {
    const header = visibleCols.map((c) => csvEscape(c.title)).join(',')
    const rows = dataSource.map((row) =>
      visibleCols.map((c) => csvEscape(row[c.key])).join(','),
    )
    const bom = '\uFEFF'
    const blob = new Blob([bom + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `export-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [dataSource, visibleCols])

  const handleBulkAction = useCallback((action: string) => {
    onBulkAction?.(action, Array.from(selectedKeys))
  }, [onBulkAction, selectedKeys])

  const columnItems = columns.map((c) => ({
    key: c.key,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
        <Checkbox checked={visibleColumns.has(c.key)} onChange={() => toggleColumnVisibility(c.key)} />
        <span style={{ fontSize: 13 }}>{c.title}</span>
      </div>
    ),
  }))

  const pageStart = totalRows === 0 ? 0 : startIndex + 1
  const pageEnd = Math.min(startIndex + pageSize, totalRows)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 8, border: '1px solid var(--border-subtle, #e2e8f0)', background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedKeys.size > 0 && (
            <Badge count={selectedKeys.size} style={{ backgroundColor: '#3b82f6' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary, #64748b)', marginRight: 8 }}>已选</span>
            </Badge>
          )}
          {selectedKeys.size > 0 && (
            <Space size={4}>
              <Button size="small" icon={<Trash2 size={14} />} onClick={() => handleBulkAction('delete')} />
              <Button size="small" icon={<FileSpreadsheet size={14} />} onClick={() => handleBulkAction('export')} />
            </Space>
          )}
        </div>
        <Space size={4}>
          <Button size="small" icon={<Download size={14} />} onClick={exportCsv}>
            CSV
          </Button>
          <Dropdown menu={{ items: columnItems }} trigger={['click']} placement="bottomRight">
            <Button size="small" icon={<Columns size={14} />}>
              列
            </Button>
          </Dropdown>
          <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            {pageStart}-{pageEnd} / {totalRows}
          </span>
        </Space>
      </div>

      <div ref={tableRef} style={{ overflow: 'auto', height, position: 'relative' }} data-testid="data-table-body">
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...headerCellStyle, width: 40, zIndex: frozenCount > 0 ? 4 : 2, left: 0, textAlign: 'center' }}>
                <Checkbox checked={allPageSelected} onChange={handleSelectAll} />
              </th>
              {visibleCols.map((col) => {
                const isFrozen = col.frozen && frozenCount > visibleCols.indexOf(col) + 1
                return (
                  <th
                    key={col.key}
                    style={{
                      ...headerCellStyle,
                      width: col.width,
                      left: isFrozen ? 40 + visibleCols.slice(0, visibleCols.indexOf(col)).filter((c) => c.frozen).reduce((sum, c) => sum + (c.width ?? 120), 0) : undefined,
                      zIndex: isFrozen ? 3 : 2,
                      cursor: 'grab',
                    }}
                    onMouseDown={(e) => handleDragStart(col.key, e)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <GripVertical size={12} style={{ opacity: 0.3, flexShrink: 0 }} />
                      {col.title}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length + 1} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted, #94a3b8)', fontSize: 14 }}>
                  {loading ? '加载中...' : '暂无数据'}
                </td>
              </tr>
            ) : (
              pageData.map((record) => {
                const id = getRowKey(record, rowKey)
                const isSelected = selectedKeys.has(id)
                return (
                  <tr
                    key={id}
                    style={{
                      background: isSelected ? 'var(--blue-accent, #eff6ff)' : undefined,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, #f1f5f9)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''
                    }}
                  >
                    <td style={{ ...cellStyle, width: 40, textAlign: 'center' }}>
                      <Checkbox checked={isSelected} onChange={() => handleSelectRow(id)} />
                    </td>
                    {visibleCols.map((col) => {
                      const value = record[col.key]
                      const isEditing = editingCell?.row === id && editingCell?.col === col.key
                      return (
                        <td
                          key={col.key}
                          style={{
                            ...cellStyle,
                            cursor: col.editable ? 'pointer' : 'default',
                            background: isEditing ? '#fefce8' : undefined,
                          }}
                          onDoubleClick={() => {
                            if (col.editable) startEdit(id, col.key, value)
                          }}
                        >
                          {isEditing ? (
                            <Input
                              size="small"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              onBlur={commitEdit}
                              autoFocus
                              suffix={
                                <Space size={2}>
                                  <Check size={12} style={{ cursor: 'pointer', color: '#22c55e' }} onClick={commitEdit} />
                                  <X size={12} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={commitEdit} />
                                </Space>
                              }
                              style={{ height: 28, fontSize: 13 }}
                            />
                          ) : col.render ? (
                            col.render(value, record, pageData.indexOf(record))
                          ) : (
                            <span>{String(value ?? '-')}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--border-subtle, #e2e8f0)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            共 {totalRows} 条
          </span>
          <Space size={4}>
            <Button size="small" disabled={currentPage <= 1} onClick={() => { const p = Math.max(1, currentPage - 1); setCurrentPage(p); onPageChange?.(p) }}>
              <ChevronDown size={14} />
            </Button>
            <span style={{ fontSize: 13, padding: '0 8px', color: 'var(--text-primary, #1e293b)' }}>
              {currentPage} / {totalPages}
            </span>
            <Button size="small" disabled={currentPage >= totalPages} onClick={() => { const p = currentPage + 1; setCurrentPage(p); onPageChange?.(p) }}>
              <ChevronUp size={14} />
            </Button>
          </Space>
        </div>
      )}
    </div>
  )
}

export default DataTable
