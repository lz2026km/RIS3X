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
      message.error('加载模板库数据失败')
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
    return list.filter((t) => {
      if (selectedKeys.length === 0) return true
      const key = String(selectedKeys[0])
      if (key.startsWith('modality:')) return t.modality === key.slice('modality:'.length)
      if (key.startsWith('dept:')) return t.dept === key.slice('dept:'.length)
      if (key.startsWith('purpose:')) return t.purpose === key.slice('purpose:'.length)
      return true
    })
  }, [templates, searchResult, keyword, tagFilter, modalityFilter, deptFilter, purposeFilter, selectedKeys])

  const loadUsageStats = useCallback(async () => {
    const ids = displayed.slice(0, 12).map((t) => t.id)
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
      message.success(`已使用模板: ${res.data?.name}`)
      await reloadTemplates()
    } else {
      message.error(res.error?.message ?? '记录使用失败')
    }
  }

  const handleFavorite = async (id: string) => {
    const res = await templateLibraryV2Api.toggleFavorite(id, 'u-001')
    if (res.success) {
      message.success(res.data?.favorite ? '已收藏' : '已取消收藏')
      await reloadTemplates()
    }
  }

  const handleCopy = async (id: string) => {
    const res = await templateLibraryV2Api.copyTemplate(id, '当前用户')
    if (res.success) {
      message.success(`已复制: ${res.data?.name}`)
      await reloadTemplates()
    } else {
      message.error(res.error?.message ?? '复制失败')
    }
  }

  const handleExport = async (ids: string[]) => {
    const res = await templateLibraryV2Api.exportTemplates(ids)
    if (res.success && res.data) {
      downloadTextFile(`template-library-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(res.data, null, 2), 'application/json; charset=utf-8')
      message.success(`已导出 ${res.data.templates.length} 个模板 (JSON)`)
    } else {
      message.error(res.error?.message ?? '导出失败')
    }
  }

  const handleImportFile = async (file: File) => {
    const text = await file.text()
    const res = await templateLibraryV2Api.importTemplates(text, '当前用户')
    if (res.success) {
      message.success(`导入成功: ${res.data?.imported} 个模板`)
      await reloadTemplates()
    } else {
      message.error(res.error?.message ?? '导入失败 (JSON 格式不正确)')
    }
  }

  const columns: ColumnsType<ReportTemplateLibraryItemV2> = [
    { title: '模板名称', dataIndex: 'name', width: 190, render: (v: string, t) => (
        <Space size={4}>
          <FileText size={13} color="#4f46e5" />
          <span>{v}</span>
          {t.isSystem && <Tag color="cyan" style={{ fontSize: 10, lineHeight: '14px', marginInlineEnd: 0 }}>内置</Tag>}
          {t.sourceTemplateId && <Tag color="geekblue" style={{ fontSize: 10, lineHeight: '14px', marginInlineEnd: 0 }}>副本</Tag>}
        </Space>
      ) },
    { title: '模态', dataIndex: 'modality', width: 55, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '科室', dataIndex: 'dept', width: 90 },
    { title: '用途', dataIndex: 'purpose', width: 80, render: (v: TemplatePurposeV2) => <Tag>{PURPOSE_LABEL_V2[v]}</Tag> },
    { title: '部位', dataIndex: 'bodyPart', width: 70 },
    { title: '标签', dataIndex: 'tags', width: 150, render: (tags: string[]) => tags.slice(0, 3).map((tag) => <Tag key={tag} color="purple" style={{ marginInlineEnd: 4 }}>{tag}</Tag>) },
    { title: '使用', dataIndex: 'usageCount', width: 60, align: 'center' as const },
    { title: '采纳率', width: 70, align: 'center' as const, render: (_, t) => {
        const s = usageStats[t.id]
        return <span style={{ color: (s?.adoptionRate ?? 0) >= 50 ? '#10b981' : '#64748b' }}>{(s?.adoptionRate ?? 0).toFixed(1)}%</span>
      } },
    { title: '最近使用', width: 100, render: (_, t) => formatDateTime(t.lastUsedAt) },
    { title: '收藏', dataIndex: 'favoriteCount', width: 55, align: 'center' as const, render: (v: number) => v > 0 ? <Star size={13} color="#f59e0b" fill="#f59e0b" /> : <span style={{ color: '#cbd5e1' }}>0</span> },
    { title: '操作', width: 210, fixed: 'right' as const, render: (_, t) => (
        <Space size={4} wrap>
          <Tooltip title="使用模板 (计入统计)">
            <Button size="small" type="primary" icon={<Zap size={11} />} onClick={() => void handleUse(t.id)}>使用</Button>
          </Tooltip>
          <Tooltip title="收藏">
            <Button size="small" icon={<Bookmark size={11} />} onClick={() => void handleFavorite(t.id)} />
          </Tooltip>
          <Tooltip title="复制模板">
            <Button size="small" icon={<Copy size={11} />} onClick={() => void handleCopy(t.id)} />
          </Tooltip>
          <Tooltip title="导出 JSON">
            <Button size="small" icon={<Download size={11} />} onClick={() => void handleExport([t.id])} />
          </Tooltip>
        </Space>
      ) },
  ]

  const headerItems = [
    { title: '模板总数', value: stats?.total ?? '-', prefix: <FileText size={14} /> },
    { title: '内置模板', value: stats?.systemCount ?? '-', prefix: <PackageOpen size={14} /> },
    { title: '总使用', value: stats?.totalUsage ?? '-', prefix: <Zap size={14} /> },
    { title: '平均采纳率', value: stats ? `${stats.avgAdoptionRate}%` : '-', prefix: <TrendingUp size={14} /> },
    ...(compact ? [] : [
      { title: '总收藏', value: stats?.totalFavorites ?? '-', prefix: <Star size={14} /> },
      { title: '自定义', value: stats?.userCount ?? '-', prefix: <Sparkles size={14} /> },
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
    <div data-testid="template-library-panel-v2" role="region" aria-label="模板库 V2 面板">
      <div style={{ background: 'linear-gradient(135deg, #0e7490 0%, #164e63 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <LayoutGrid size={18} />
            <strong style={{ fontSize: 16 }}>模板库 V2</strong>
            <Tag color="cyan">Wave 7B · F13</Tag>
            <Tag color="gold">分类树 + 推荐 + 统计</Tag>
          </Space>
          <Space>
            <Tooltip title="导出全部模板 (JSON)">
              <Button size="small" ghost icon={<Download size={12} />} onClick={() => void handleExport(templates.map((t) => t.id))}>
                全部导出
              </Button>
            </Tooltip>
            <Tooltip title="导入模板 (JSON)">
              <Button size="small" ghost icon={<Upload size={12} />} onClick={() => fileInputRef.current?.click()}>
                导入
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
            <Tooltip title="刷新">
              <Button size="small" ghost icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>
                刷新
              </Button>
            </Tooltip>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
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
          { label: '模板库', value: 'library' },
          { label: `我的收藏 (${favorites.length})`, value: 'favorites' },
          { label: '推荐分析', value: 'recommend' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {tab === 'library' && (
        <Row gutter={12}>
          <Col span={5}>
            <Card size="small" title={<Space><FolderTree size={14} color="#0e7490" />分类树</Space>} styles={{ body: { maxHeight: 520, overflowY: 'auto' } }}>
              {treeData.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="分类加载中" /> : (
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
            <Card size="small" title={<Space><Search size={14} color="#0e7490" />搜索与列表 ({displayed.length})</Space>} extra={<Tag color="blue">共 {searchResult.total || templates.length} 个</Tag>}>
              <Space wrap style={{ marginBottom: 12 }}>
                <Input allowClear prefix={<Search size={12} />} placeholder="搜索名称/内容/标签" style={{ width: 220 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                <Select allowClear placeholder="标签" style={{ width: 130 }} value={tagFilter} onChange={(v) => setTagFilter(v)} options={TAG_OPTIONS} />
                <Select allowClear placeholder="模态" style={{ width: 100 }} value={modalityFilter} onChange={(v) => setModalityFilter(v)} options={MODALITY_OPTIONS} />
                <Select allowClear placeholder="科室" style={{ width: 130 }} value={deptFilter} onChange={(v) => setDeptFilter(v)} options={Array.from(new Set(templates.map((t) => t.dept))).map((d) => ({ value: d, label: d }))} />
                <Select allowClear placeholder="用途" style={{ width: 120 }} value={purposeFilter} onChange={(v) => setPurposeFilter(v)} options={PURPOSE_OPTIONS} />
                {selectedKeys.length > 0 && (
                  <Tag color="gold" closable onClose={() => setSelectedKeys([])}>已按分类筛选</Tag>
                )}
              </Space>
              <Table
                rowKey="id" size="small" loading={loading} dataSource={displayed} columns={columns}
                pagination={{ pageSize: compact ? 6 : 8, showSizeChanger: false, showTotal: (t) => `共 ${t} 个模板` }}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty description="暂无模板" /> }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {tab === 'favorites' && (
        <Card size="small" title={<Space><Star size={14} color="#f59e0b" />我的收藏 ({favorites.length})</Space>}>
          <Table
            rowKey="id" size="small" loading={loading} dataSource={favorites} columns={columns}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty description="暂无收藏, 点击模板行的收藏按钮添加" /> }}
          />
        </Card>
      )}

      {tab === 'recommend' && (
        <Row gutter={12}>
          <Col span={14}>
            <Card size="small" title={<Space><Sparkles size={14} color="#7c3aed" />智能推荐 (确定性评分)</Space>} extra={<Tag color="purple">频率×时效×分类匹配</Tag>}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {recommendations.map((r, i) => (
                  <div key={r.templateId} style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: 10, background: i === 0 ? 'linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%)' : undefined }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <span style={{ fontSize: 15, fontWeight: 700, color: i === 0 ? '#7c3aed' : '#334155' }}>#{i + 1}</span>
                        <FileText size={13} color="#7c3aed" />
                        <strong>{r.template.name}</strong>
                        <Tag color="blue">{r.template.modality}</Tag>
                        <Tag>{r.template.dept}</Tag>
                      </Space>
                      <Space>
                        <Tag color="purple">评分 {r.score.toFixed(1)}</Tag>
                        <Button size="small" type="primary" icon={<Zap size={11} />} onClick={() => void handleUse(r.template.id)}>使用</Button>
                        <Button size="small" icon={<Bookmark size={11} />} onClick={() => void handleFavorite(r.template.id)} />
                      </Space>
                    </Space>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>推荐理由: {r.reason}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4, maxHeight: 40, overflow: 'hidden' }}>{r.template.content.slice(0, 80)}...</div>
                  </div>
                ))}
                {recommendations.length === 0 && <Empty description="暂无推荐" />}
              </Space>
            </Card>
          </Col>
          <Col span={10}>
            <Card size="small" title={<Space><Eye size={14} color="#0e7490" />使用统计速览</Space>}>
              <Table
                rowKey="id" size="small" loading={loading}
                dataSource={displayed.slice(0, 10)}
                columns={[
                  { title: '模板', dataIndex: 'name', ellipsis: true, width: 140 },
                  { title: '使用次数', dataIndex: 'usageCount', width: 70, align: 'center' as const },
                  { title: '采纳率', width: 70, align: 'center' as const, render: (_, t) => `${(usageStats[t.id]?.adoptionRate ?? 0).toFixed(1)}%` },
                  { title: '最近使用', width: 100, render: (_, t) => formatDateTime(t.lastUsedAt) },
                ]}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" /> }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>
        推荐评分 = 使用频率 ×40 + 时效衰减 ×30 + 分类匹配 (模态50/科室25/用途15/标签5/部位10) · 分类树按 检查类型/科室/用途 组织 · 内置 {stats?.systemCount ?? '30+'} 个放射模板 (seed 回退)
      </div>
    </div>
  )
}

export default TemplateLibraryPanelV2
