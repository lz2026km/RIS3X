/**
 * [G005 v3.0.6.11-101 Wave 7B F13] 模板库 V2 面板
 * 能力: 分类树 (检查类型/科室/用途) + 搜索 (关键词/标签/类型) + 推荐卡片 (确定性评分)
 *      + 使用统计 (次数/采纳率/最近使用) + 收藏 + 复制 + JSON 导入导出
 * 数据源: templateLibraryV2Api (后端孤儿模块 + seed 回退)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Card, Table, Tag, Space, Row, Col, Statistic, Button, Input, Select,
  message, Empty, Tooltip, Segmented, Tree,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TreeDataNode } from 'antd'
import {
  LayoutGrid, Search, Star, Copy, Download, Upload, RefreshCw, Zap, TrendingUp,
  FileText, Bookmark, Eye, FolderTree, Sparkles, PackageOpen,
} from 'lucide-react'
import {
  templateLibraryV2Api,
  PURPOSE_LABEL_V2,
  type ReportTemplateLibraryItemV2,
  type TemplateCategoryNodeV2,
  type TemplateLibraryStatsV2,
  type TemplatePurposeV2,
  type TemplateRecommendationV2,
  type TemplateSearchResultV2,
  type TemplateUsageStatsV2,
} from '../../../services/api/templateLibraryV2Api'
import { t } from '../../../i18n/appI18n'

const PURPOSE_OPTIONS = Object.entries(PURPOSE_LABEL_V2).map(([value, label]) => ({ value, label }))

const MODALITY_OPTIONS = ['CT', 'MR', 'DR', 'MG', 'US', 'DSA', 'PET', 'CR'].map((m) => ({ value: m, label: m }))

const TAG_OPTIONS = ['危急', '增强', '随访', '平扫', '肺结节', 'BI-RADS', '椎间盘', '骨折', '乳腺', '超声'].map((t) => ({ value: t, label: t }))

function formatDateTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function toTreeData(nodes: TemplateCategoryNodeV2[]): TreeDataNode[] {
  return nodes.map((n) => ({
    key: n.key,
    title: <Space size={4}><FolderTree size={12} color="#4f46e5" /><span style={{ fontWeight: 600 }}>{n.name}</span></Space>,
    children: n.children ? toTreeData(n.children) : undefined,
  }))
}

export interface TemplateLibraryPanelV2Props {
  compact?: boolean
}

const TemplateLibraryPanelV2: React.FC<TemplateLibraryPanelV2Props> = ({ compact = false }) => {
  const [tab, setTab] = useState('library')
  const [templates, setTemplates] = useState<ReportTemplateLibraryItemV2[]>([])
  const [searchResult, setSearchResult] = useState<TemplateSearchResultV2>({ items: [], total: 0 })
  const [stats, setStats] = useState<TemplateLibraryStatsV2 | null>(null)
  const [recommendations, setRecommendations] = useState<TemplateRecommendationV2[]>([])
  const [favorites, setFavorites] = useState<ReportTemplateLibraryItemV2[]>([])
  const [loading, setLoading] = useState(true)

  const [keyword, setKeyword] = useState('')
  const [tagFilter, setTagFilter] = useState<string>()
  const [modalityFilter, setModalityFilter] = useState<string>()
  const [deptFilter, setDeptFilter] = useState<string>()
  const [purposeFilter, setPurposeFilter] = useState<TemplatePurposeV2>()
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [usageStats, setUsageStats] = useState<Record<string, TemplateUsageStatsV2>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s, r] = await Promise.allSettled([
        templateLibraryV2Api.listTemplates(),
        templateLibraryV2Api.stats(),
        templateLibraryV2Api.recommend({ limit: compact ? 3 : 5 }),
      ])
      if (t.status === 'fulfilled' && t.value.success) setTemplates(t.value.data ?? [])
      if (s.status === 'fulfilled' && s.value.success) setStats(s.value.data)
      if (r.status === 'fulfilled' && r.value.success) setRecommendations(r.value.data ?? [])
      if (favorites.length === 0) {
        const f = await templateLibraryV2Api.listFavorites('u-001')
        if (f.success) setFavorites(f.data ?? [])
      }
    } catch {
      message.error(t('templateLibrary.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [compact, favorites.length])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    const timer = setTimeout(() => {
      const params: Record<string, string | string[] | number | undefined> = {
        keyword: keyword || undefined,
        tags: tagFilter ? [tagFilter] : undefined,
        modality: modalityFilter,
        dept: deptFilter,
        purpose: purposeFilter,
        pageSize: 50,
      }
      void templateLibraryV2Api.search(params).then((res) => {
        if (res.success && res.data) setSearchResult(res.data)
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [keyword, tagFilter, modalityFilter, deptFilter, purposeFilter])

  const displayed = useMemo(() => {
    const list = searchResult.items.length > 0 || keyword || tagFilter || modalityFilter || deptFilter || purposeFilter
      ? searchResult.items
      : templates
    return list.filter((tpl) => {
      if (selectedKeys.length === 0) return true
      const key = String(selectedKeys[0])
      if (key.startsWith('modality:')) return tpl.modality === key.slice('modality:'.length)
      if (key.startsWith('dept:')) return tpl.dept === key.slice('dept:'.length)
      if (key.startsWith('purpose:')) return tpl.purpose === key.slice('purpose:'.length)
      return true
    })
  }, [templates, searchResult, keyword, tagFilter, modalityFilter, deptFilter, purposeFilter, selectedKeys])

  const loadUsageStats = useCallback(async () => {
    const ids = displayed.slice(0, 12).map((tpl) => tpl.id)
    const results = await Promise.allSettled(ids.map((id) => templateLibraryV2Api.templateStats(id)))
    const map: Record<string, TemplateUsageStatsV2> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.success && r.value.data) {
        map[ids[i]!] = r.value.data
      }
    })
    setUsageStats(map)
  }, [displayed])

  useEffect(() => {
    void loadUsageStats()
  }, [loadUsageStats])

  const reloadTemplates = useCallback(async () => {
    const [t, s, r, f] = await Promise.allSettled([
      templateLibraryV2Api.listTemplates(),
      templateLibraryV2Api.stats(),
      templateLibraryV2Api.recommend({ limit: compact ? 3 : 5 }),
      templateLibraryV2Api.listFavorites('u-001'),
    ])
    if (t.status === 'fulfilled' && t.value.success) setTemplates(t.value.data ?? [])
    if (s.status === 'fulfilled' && s.value.success) setStats(s.value.data)
    if (r.status === 'fulfilled' && r.value.success) setRecommendations(r.value.data ?? [])
    if (f.status === 'fulfilled' && f.value.success) setFavorites(f.value.data ?? [])
    await loadUsageStats()
  }, [compact, loadUsageStats])

  const handleUse = async (id: string) => {
    const res = await templateLibraryV2Api.recordUsage(id, 'u-001')
    if (res.success) {
      message.success(t('templateLibrary.usedTemplate', { name: res.data?.name }))
      await reloadTemplates()
    } else {
      message.error(res.error?.message ?? t('templateLibrary.recordUsageFailed'))
    }
  }

  const handleFavorite = async (id: string) => {
    const res = await templateLibraryV2Api.toggleFavorite(id, 'u-001')
    if (res.success) {
      message.success(res.data?.favorite ? t('templateLibrary.favorited') : t('templateLibrary.unfavorited'))
      await reloadTemplates()
    }
  }

  const handleCopy = async (id: string) => {
    const res = await templateLibraryV2Api.copyTemplate(id, '当前用户')
    if (res.success) {
      message.success(t('templateLibrary.copiedTemplate', { name: res.data?.name }))
      await reloadTemplates()
    } else {
      message.error(res.error?.message ?? t('templateLibrary.copyFailed'))
    }
  }

  const handleExport = async (ids: string[]) => {
    const res = await templateLibraryV2Api.exportTemplates(ids)
    if (res.success && res.data) {
      downloadTextFile(`template-library-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(res.data, null, 2), 'application/json; charset=utf-8')
      message.success(t('templateLibrary.exported', { count: res.data.templates.length }))
    } else {
      message.error(res.error?.message ?? t('templateLibrary.exportFailed'))
    }
  }

  const handleImportFile = async (file: File) => {
    const text = await file.text()
    const res = await templateLibraryV2Api.importTemplates(text, '当前用户')
    if (res.success) {
      message.success(t('templateLibrary.imported', { count: res.data?.imported }))
      await reloadTemplates()
    } else {
      message.error(res.error?.message ?? t('templateLibrary.importFailed'))
    }
  }

  const columns: ColumnsType<ReportTemplateLibraryItemV2> = [
    { title: t('templateLibrary.col.name'), dataIndex: 'name', width: 190, render: (v: string, row) => (
        <Space size={4}>
          <FileText size={13} color="#4f46e5" />
          <span>{v}</span>
          {row.isSystem && <Tag color="cyan" style={{ fontSize: 10, lineHeight: '14px', marginInlineEnd: 0 }}>{t('templateLibrary.builtin')}</Tag>}
          {row.sourceTemplateId && <Tag color="geekblue" style={{ fontSize: 10, lineHeight: '14px', marginInlineEnd: 0 }}>{t('templateLibrary.copy')}</Tag>}
        </Space>
      ) },
    { title: t('templateLibrary.col.modality'), dataIndex: 'modality', width: 55, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('templateLibrary.col.dept'), dataIndex: 'dept', width: 90 },
    { title: t('templateLibrary.col.purpose'), dataIndex: 'purpose', width: 80, render: (v: TemplatePurposeV2) => <Tag>{PURPOSE_LABEL_V2[v]}</Tag> },
    { title: t('templateLibrary.col.bodyPart'), dataIndex: 'bodyPart', width: 70 },
    { title: t('templateLibrary.col.tags'), dataIndex: 'tags', width: 150, render: (tags: string[]) => tags.slice(0, 3).map((tag) => <Tag key={tag} color="purple" style={{ marginInlineEnd: 4 }}>{tag}</Tag>) },
    { title: t('templateLibrary.col.usage'), dataIndex: 'usageCount', width: 60, align: 'center' as const },
    { title: t('templateLibrary.col.adoptionRate'), width: 70, align: 'center' as const, render: (_, row) => {
        const s = usageStats[row.id]
        return <span style={{ color: (s?.adoptionRate ?? 0) >= 50 ? '#10b981' : '#64748b' }}>{(s?.adoptionRate ?? 0).toFixed(1)}%</span>
      } },
    { title: t('templateLibrary.col.lastUsed'), width: 100, render: (_, row) => formatDateTime(row.lastUsedAt) },
    { title: t('templateLibrary.col.favorite'), dataIndex: 'favoriteCount', width: 55, align: 'center' as const, render: (v: number) => v > 0 ? <Star size={13} color="var(--color-warning-500)" fill="var(--color-warning-500)" /> : <span style={{ color: '#cbd5e1' }}>0</span> },
    { title: t('templateLibrary.col.action'), width: 210, fixed: 'right' as const, render: (_, row) => (
        <Space size={4} wrap>
          <Tooltip title={t('templateLibrary.useTip')}>
            <Button size="small" type="primary" icon={<Zap size={11} />} onClick={() => void handleUse(row.id)}>{t('templateLibrary.use')}</Button>
          </Tooltip>
          <Tooltip title={t('templateLibrary.favoriteTip')}>
            <Button aria-label="收藏" size="small" icon={<Bookmark size={11} />} onClick={() => void handleFavorite(row.id)} />
          </Tooltip>
          <Tooltip title={t('templateLibrary.copyTip')}>
            <Button aria-label="复制" size="small" icon={<Copy size={11} />} onClick={() => void handleCopy(row.id)} />
          </Tooltip>
          <Tooltip title={t('templateLibrary.exportJsonTip')}>
            <Button aria-label="下载" size="small" icon={<Download size={11} />} onClick={() => void handleExport([row.id])} />
          </Tooltip>
        </Space>
      ) },
  ]

  const headerItems = [
    { title: t('templateLibrary.header.totalTemplates'), value: stats?.total ?? '-', prefix: <FileText size={14} /> },
    { title: t('templateLibrary.header.builtinTemplates'), value: stats?.systemCount ?? '-', prefix: <PackageOpen size={14} /> },
    { title: t('templateLibrary.header.totalUsage'), value: stats?.totalUsage ?? '-', prefix: <Zap size={14} /> },
    { title: t('templateLibrary.header.avgAdoptionRate'), value: stats ? `${stats.avgAdoptionRate}%` : '-', prefix: <TrendingUp size={14} /> },
    ...(compact ? [] : [
      { title: t('templateLibrary.header.totalFavorites'), value: stats?.totalFavorites ?? '-', prefix: <Star size={14} /> },
      { title: t('templateLibrary.header.custom'), value: stats?.userCount ?? '-', prefix: <Sparkles size={14} /> },
    ]),
  ]

  const [categoryTree, setCategoryTree] = useState<TemplateCategoryNodeV2[]>([])

  useEffect(() => {
    void templateLibraryV2Api.getCategories().then((res) => {
      if (res.success && res.data) setCategoryTree(res.data)
    })
  }, [])

  const treeData = useMemo(() => toTreeData(categoryTree), [categoryTree])

  return (
    <div data-testid="template-library-panel-v2" role="region" aria-label={t('templateLibrary.panelAria')}>
      <div style={{ background: 'linear-gradient(135deg, #0e7490 0%, #164e63 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 'var(--space-3, 12px)' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <LayoutGrid size={18} />
            <strong style={{ fontSize: 16 }}>{t('templateLibrary.title')}</strong>
            <Tag color="cyan">Wave 7B · F13</Tag>
            <Tag color="gold">{t('templateLibrary.subtitle')}</Tag>
          </Space>
          <Space>
            <Tooltip title={t('templateLibrary.exportAllTip')}>
              <Button size="small" ghost icon={<Download size={12} />} onClick={() => void handleExport(templates.map((tpl) => tpl.id))}>
                {t('templateLibrary.exportAll')}
              </Button>
            </Tooltip>
            <Tooltip title={t('templateLibrary.importTip')}>
              <Button size="small" ghost icon={<Upload size={12} />} onClick={() => fileInputRef.current?.click()}>
                {t('templateLibrary.import')}
              </Button>
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleImportFile(file)
                e.target.value = ''
              }}
            />
            <Tooltip title={t('templateLibrary.refresh')}>
              <Button size="small" ghost icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>
                {t('templateLibrary.refresh')}
              </Button>
            </Tooltip>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 'var(--space-3, 12px)' }}>
          {headerItems.map((s) => (
            <Col span={compact ? 6 : 24 / headerItems.length} key={s.title}>
              <Statistic title={<span style={{ color: '#fff' }}>{s.title}</span>} value={s.value} prefix={s.prefix} styles={{ content: { color: '#fff', fontSize: 18 } }} />
            </Col>
          ))}
        </Row>
      </div>

      <Segmented
        block value={tab}
        onChange={(v) => setTab(String(v))}
        options={[
          { label: t('templateLibrary.tab.library'), value: 'library' },
          { label: t('templateLibrary.tab.favorites', { count: favorites.length }), value: 'favorites' },
          { label: t('templateLibrary.tab.recommend'), value: 'recommend' },
        ]}
        style={{ marginBottom: 'var(--space-3, 12px)' }}
      />

      {tab === 'library' && (
        <Row gutter={12}>
          <Col span={5}>
            <Card size="small" title={<Space><FolderTree size={14} color="#0e7490" />{t('templateLibrary.categoryTree')}</Space>} styles={{ body: { maxHeight: 520, overflowY: 'auto' } }}>
              {treeData.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('templateLibrary.categoryLoading')} /> : (
                <Tree
                  treeData={treeData}
                  selectedKeys={selectedKeys}
                  onSelect={(keys) => setSelectedKeys(keys)}
                  defaultExpandAll
                />
              )}
            </Card>
          </Col>
          <Col span={19}>
            <Card size="small" title={<Space><Search size={14} color="#0e7490" />{t('templateLibrary.searchAndList', { count: displayed.length })}</Space>} extra={<Tag color="blue">{t('templateLibrary.totalCount', { count: searchResult.total || templates.length })}</Tag>}>
              <Space wrap style={{ marginBottom: 'var(--space-3, 12px)' }}>
                <Input allowClear prefix={<Search size={12} />} placeholder={t('templateLibrary.searchPlaceholder')} style={{ width: 220 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                <Select allowClear placeholder={t('templateLibrary.filterTags')} style={{ width: 130 }} value={tagFilter} onChange={(v) => setTagFilter(v)} options={TAG_OPTIONS} />
                <Select allowClear placeholder={t('templateLibrary.filterModality')} style={{ width: 100 }} value={modalityFilter} onChange={(v) => setModalityFilter(v)} options={MODALITY_OPTIONS} />
                <Select allowClear placeholder={t('templateLibrary.filterDept')} style={{ width: 130 }} value={deptFilter} onChange={(v) => setDeptFilter(v)} options={Array.from(new Set(templates.map((tpl) => tpl.dept))).map((d) => ({ value: d, label: d }))} />
                <Select allowClear placeholder={t('templateLibrary.filterPurpose')} style={{ width: 120 }} value={purposeFilter} onChange={(v) => setPurposeFilter(v)} options={PURPOSE_OPTIONS} />
                {selectedKeys.length > 0 && (
                  <Tag color="gold" closable onClose={() => setSelectedKeys([])}>{t('templateLibrary.filteredByCategory')}</Tag>
                )}
              </Space>
              <Table
                rowKey="id" size="small" loading={loading} dataSource={displayed} columns={columns}
                pagination={{ pageSize: compact ? 6 : 8, showSizeChanger: false, showTotal: (total) => t('templateLibrary.showTotal', { count: total }) }}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty description={t('templateLibrary.noTemplates')} /> }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {tab === 'favorites' && (
        <Card size="small" title={<Space><Star size={14} color="var(--color-warning-500)" />{t('templateLibrary.myFavorites', { count: favorites.length })}</Space>}>
          <Table
            rowKey="id" size="small" loading={loading} dataSource={favorites} columns={columns}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty description={t('templateLibrary.noFavorites')} /> }}
          />
        </Card>
      )}

      {tab === 'recommend' && (
        <Row gutter={12}>
          <Col span={14}>
            <Card size="small" title={<Space><Sparkles size={14} color="#7c3aed" />{t('templateLibrary.smartRecommend')}</Space>} extra={<Tag color="purple">{t('templateLibrary.recommendBasis')}</Tag>}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {recommendations.map((r, i) => (
                  <div key={r.templateId} style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 10, background: i === 0 ? 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%)' : undefined }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <span style={{ fontSize: 14, fontWeight: 700, color: i === 0 ? '#7c3aed' : '#334155' }}>#{i + 1}</span>
                        <FileText size={13} color="#7c3aed" />
                        <strong>{r.template.name}</strong>
                        <Tag color="blue">{r.template.modality}</Tag>
                        <Tag>{r.template.dept}</Tag>
                      </Space>
                      <Space>
                        <Tag color="purple">{t('templateLibrary.score', { score: r.score.toFixed(1) })}</Tag>
                        <Button size="small" type="primary" icon={<Zap size={11} />} onClick={() => void handleUse(r.template.id)}>{t('templateLibrary.use')}</Button>
                        <Button aria-label="收藏" size="small" icon={<Bookmark size={11} />} onClick={() => void handleFavorite(r.template.id)} />
                      </Space>
                    </Space>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 'var(--space-1, 4px)' }}>{t('templateLibrary.reason')} {r.reason}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 'var(--space-1, 4px)', maxHeight: 40, overflow: 'hidden' }}>{r.template.content.slice(0, 80)}...</div>
                  </div>
                ))}
                {recommendations.length === 0 && <Empty description={t('templateLibrary.noRecommend')} />}
              </Space>
            </Card>
          </Col>
          <Col span={10}>
            <Card size="small" title={<Space><Eye size={14} color="#0e7490" />{t('templateLibrary.usageOverview')}</Space>}>
              <Table
                rowKey="id" size="small" loading={loading}
                dataSource={displayed.slice(0, 10)}
                columns={[
                  { title: t('templateLibrary.col.template'), dataIndex: 'name', ellipsis: true, width: 140 },
                  { title: t('templateLibrary.col.usageCount'), dataIndex: 'usageCount', width: 70, align: 'center' as const },
                  { title: t('templateLibrary.col.adoptionRate'), width: 70, align: 'center' as const, render: (_, row) => `${(usageStats[row.id]?.adoptionRate ?? 0).toFixed(1)}%` },
                  { title: t('templateLibrary.col.lastUsed'), width: 100, render: (_, row) => formatDateTime(row.lastUsedAt) },
                ]}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('templateLibrary.noData')} /> }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>
        {t('templateLibrary.footer', { count: stats?.systemCount ?? '30+' })}
      </div>
    </div>
  )
}

export default TemplateLibraryPanelV2
