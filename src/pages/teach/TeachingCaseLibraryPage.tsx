/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 18 - 教学病例库页面 (PACS 教学深功能)
 * 覆盖后端 TeachModule TeachingCaseService 全部端点:
 *   POST /teach/case            收藏教学病例 (从检查/报告一键收藏)
 *   GET  /teach/cases           病例列表 (病种/部位/难度/标签/搜索筛选)
 *   GET  /teach/categories      分类树
 *   GET  /teach/stats           统计
 *   POST /teach/case/:id/share  分享 (链接 + QR 数据)
 *   GET/POST /teach/case/:id/comments  评论
 *   POST /teach/exam/generate   考试抽题
 *   POST /teach/exam/submit     评分
 *   GET/DELETE /teach/wrong-book 错题本
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Card, Button, Input, Select, Tag, Modal, Form, message, Popconfirm, Radio, Empty,
  Statistic, Progress, Space, Row, Col, Switch, Spin, Divider, InputNumber, Alert,
} from 'antd'
import {
  BookOpen, Search, Share2, MessageSquare, Eye, Trash2, Plus, RefreshCw,
  GraduationCap, FileText, Award, Heart, FolderOpen, Tag as TagIcon, Scan, Filter,
} from 'lucide-react'
import {
  teachingCaseApi,
  type TeachingCaseDto,
  type CategoryNodeDto,
  type CaseDifficulty,
  type TeachingCommentDto,
  type ExamPaperDto,
  type ExamResultDto,
  type WrongBookItemDto,
  type TeachingCaseStatsDto,
} from '../../services/api/teachingCaseApi'

const DIFFICULTIES: CaseDifficulty[] = ['入门', '进阶', '高级']

const DIFFICULTY_COLORS: Record<string, string> = {
  入门: '#52c41a',
  进阶: '#1677ff',
  高级: '#fa8c16',
}

const MODALITY_COLORS: Record<string, string> = {
  CT: 'var(--color-primary-500)', MR: '#60a5fa', DR: 'var(--color-success-500)', DSA: 'var(--color-warning-500)', XR: 'var(--color-info-500)', MG: '#ec4899',
}

/** QR 概念图案: 由 qrData 确定性生成的矩阵 */
function QrPattern({ data, size = 9 }: { data: string; size?: number }) {
  const cells = useMemo(() => {
    let h = 2166136261
    const seed = data
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const out: boolean[][] = []
    for (let r = 0; r < size; r++) {
      const row: boolean[] = []
      for (let c = 0; c < size; c++) {
        h = (h * 31 + r * 17 + c * 7) >>> 0
        row.push(h % 3 !== 0)
      }
      out.push(row)
    }
    return out
  }, [data, size])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${size}, 8px)`, gap: 1, background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border-default, rgba(0,0,0,0.12))', padding: 'var(--space-1, 4px)', borderRadius: 6 }}>
      {cells.flat().map((on, i) => (
        <div key={i} style={{ width: 8, height: 8, background: on ? '#111827' : 'var(--bg-card, #ffffff)' }} />
      ))}
    </div>
  )
}

export default function TeachingCaseLibraryPage() {
  const { t } = useTranslation('v3teachCase')
  const [activeTab, setActiveTab] = useState('library')

  // ── 病例库状态 ──
  const [cases, setCases] = useState<TeachingCaseDto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<CategoryNodeDto[]>([])
  const [stats, setStats] = useState<TeachingCaseStatsDto | null>(null)
  const [query, setQuery] = useState<{ search?: string; disease?: string; bodyPart?: string; difficulty?: string; tag?: string; sharedOnly?: boolean }>({})
  const [favoriteOpen, setFavoriteOpen] = useState(false)
  const [favoriteForm] = Form.useForm()
  const [shareTarget, setShareTarget] = useState<TeachingCaseDto | null>(null)
  const [shareInfo, setShareInfo] = useState<{ shareUrl: string; qrData: string } | null>(null)
  const [commentTarget, setCommentTarget] = useState<TeachingCaseDto | null>(null)
  const [comments, setComments] = useState<TeachingCommentDto[]>([])
  const [commentText, setCommentText] = useState('')

  // ── 考试模式状态 ──
  const [examConfig, setExamConfig] = useState<{ count: number; difficulty: string; category?: string }>({ count: 5, difficulty: '全部' })
  const [paper, setPaper] = useState<ExamPaperDto | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [examResult, setExamResult] = useState<ExamResultDto | null>(null)
  const [wrongBook, setWrongBook] = useState<WrongBookItemDto[]>([])
  const [busy, setBusy] = useState(false)

  const fetchCases = useCallback(async () => {
    setLoading(true)
    try {
      const res = await teachingCaseApi.list({ page: 1, pageSize: 100, ...query })
      const data = res.data as unknown
      if (res.success && data) {
        const rec = data as { items?: TeachingCaseDto[]; total?: number }
        setCases(Array.isArray(rec.items) ? rec.items : [])
        setTotal(rec.total ?? rec.items?.length ?? 0)
      }
    } catch { /* 后端不可用保持空 */ }
    setLoading(false)
  }, [query])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await teachingCaseApi.categories()
      if (res.success && Array.isArray(res.data)) setCategories(res.data as CategoryNodeDto[])
    } catch { /* 分类树不可用 */ }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await teachingCaseApi.stats()
      if (res.success && res.data) setStats(res.data as TeachingCaseStatsDto)
    } catch { /* 统计不可用 */ }
  }, [])

  const fetchWrongBook = useCallback(async () => {
    try {
      const res = await teachingCaseApi.wrongBook()
      if (res.success && Array.isArray(res.data)) setWrongBook(res.data as WrongBookItemDto[])
    } catch { /* 错题本不可用 */ }
  }, [])

  useEffect(() => {
    void fetchCases()
    void fetchCategories()
    void fetchStats()
    void fetchWrongBook()
  }, [fetchCases, fetchCategories, fetchStats, fetchWrongBook])

  // ── 收藏教学病例 ──
  const handleFavorite = async () => {
    const values = await favoriteForm.validateFields()
    setBusy(true)
    try {
      const res = await teachingCaseApi.create({
        title: values.title,
        examId: values.examId,
        reportId: values.reportId,
        disease: values.disease,
        bodyPart: values.bodyPart,
        difficulty: values.difficulty,
        keyPoints: values.keyPoints ? values.keyPoints.split(/[，,；;\n]/).map((s: string) => s.trim()).filter(Boolean) : [],
        tags: values.tags ? values.tags.split(/[，,；;\n]/).map((s: string) => s.trim()).filter(Boolean) : [],
      })
      if (res.success && res.data) {
        message.success(t('favoriteSuccess', '已收藏为教学病例'))
        setFavoriteOpen(false)
        favoriteForm.resetFields()
        void fetchCases()
        void fetchStats()
      } else {
        message.error(res.error?.message ?? t('favoriteFailed', '收藏失败'))
      }
    } catch (e) {
      message.error((e as Error)?.message || t('favoriteFailed', '收藏失败'))
    }
    setBusy(false)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await teachingCaseApi.remove(id)
      if (res.success) {
        message.success(t('deleteSuccess', '已删除'))
        void fetchCases()
        void fetchStats()
      }
    } catch { message.error(t('deleteFailed', '删除失败')) }
  }

  // ── 分享 ──
  const handleShare = async (c: TeachingCaseDto) => {
    try {
      const res = await teachingCaseApi.share(c.id)
      if (res.success && res.data) {
        setShareTarget(c)
        setShareInfo({ shareUrl: res.data.shareUrl, qrData: res.data.qrData })
      } else {
        message.error(res.error?.message ?? t('shareFailed', '分享失败'))
      }
    } catch { message.error(t('shareFailed', '分享失败')) }
  }

  // ── 评论 ──
  const openComments = async (c: TeachingCaseDto) => {
    setCommentTarget(c)
    setCommentText('')
    try {
      const res = await teachingCaseApi.listComments(c.id)
      if (res.success && Array.isArray(res.data)) setComments(res.data as TeachingCommentDto[])
    } catch { setComments([]) }
  }

  const handleAddComment = async () => {
    if (!commentTarget || !commentText.trim()) return
    try {
      const res = await teachingCaseApi.addComment(commentTarget.id, commentText.trim())
      if (res.success) {
        message.success(t('commentSuccess', '评论已发布'))
        setCommentText('')
        const list = await teachingCaseApi.listComments(commentTarget.id)
        if (list.success && Array.isArray(list.data)) setComments(list.data as TeachingCommentDto[])
      }
    } catch { message.error(t('commentFailed', '评论失败')) }
  }

  // ── 考试模式 ──
  const handleGenerate = async () => {
    setBusy(true)
    setExamResult(null)
    setAnswers({})
    try {
      const res = await teachingCaseApi.generateExam({ count: examConfig.count, difficulty: examConfig.difficulty, category: examConfig.category })
      if (res.success && res.data) {
        setPaper(res.data as ExamPaperDto)
      } else {
        message.error(res.error?.message ?? t('examGenerateFailed', '抽题失败'))
      }
    } catch (e) { message.error((e as Error)?.message || t('examGenerateFailed', '抽题失败')) }
    setBusy(false)
  }

  const handleSubmit = async () => {
    if (!paper) return
    setBusy(true)
    try {
      const res = await teachingCaseApi.submitExam(paper.examId, Object.entries(answers).map(([caseId, selectedIndex]) => ({ caseId, selectedIndex })))
      if (res.success && res.data) {
        setExamResult(res.data as ExamResultDto)
        void fetchWrongBook()
      } else {
        message.error(res.error?.message ?? t('examSubmitFailed', '提交失败'))
      }
    } catch (e) { message.error((e as Error)?.message || t('examSubmitFailed', '提交失败')) }
    setBusy(false)
  }

  const handleClearWrongBook = async () => {
    try {
      const res = await teachingCaseApi.clearWrongBook()
      if (res.success) {
        message.success(t('wrongBookCleared', '错题本已清空'))
        setWrongBook([])
      }
    } catch { message.error(t('deleteFailed', '删除失败')) }
  }

  // ── 渲染: 分类树 ──
  const renderCategoryTree = (groups: CategoryNodeDto[]) => {
    const icons = [<FolderOpen key="0" size={13} />, <Scan key="1" size={13} />, <Award key="2" size={13} />, <TagIcon key="3" size={13} />]
    return groups.map((g, gi) => (
      <div key={g.name} style={{ marginBottom: 'var(--space-2, 8px)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #334155)', marginBottom: 'var(--space-1, 4px)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
          {icons[gi % icons.length]}
          {g.name}
          <span style={{ color: 'var(--text-muted, #94a3b8)', fontWeight: 400 }}>{g.count}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1, 4px)', paddingLeft: 'var(--space-4, 16px)' }}>
          {(g.children ?? []).slice(0, 12).map((child) => {
            const active =
              (gi === 0 && query.disease === child.name) ||
              (gi === 1 && query.bodyPart === child.name) ||
              (gi === 2 && query.difficulty === child.name) ||
              (gi === 3 && query.tag === child.name)
            return (
              <Tag
                key={child.name}
                color={active ? 'blue' : undefined}
                style={{ cursor: 'pointer', marginInlineEnd: 0 }}
                onClick={() => {
                  const key = gi === 0 ? 'disease' : gi === 1 ? 'bodyPart' : gi === 2 ? 'difficulty' : 'tag'
                  setQuery((prev) => ({ ...prev, [key]: active ? undefined : child.name }))
                }}
              >
                {child.name} {child.count}
              </Tag>
            )
          })}
        </div>
      </div>
    ))
  }

  const filteredCategories = useMemo(() => categories, [categories])

  return (
    <div style={{ padding: 'var(--space-4, 16px)', maxWidth: 1400, margin: '0 auto' }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3, 12px)' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <GraduationCap size={20} color="#1677ff" />
            {t('title', '教学病例库')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginTop: 2 }}>{t('subtitle', '病例收藏 / 分类管理 / 分享评论 / 考试模式')}</div>
        </div>
        <Space>
          <Button icon={<RefreshCw size={14} />} onClick={() => { void fetchCases(); void fetchStats() }}>
            {t('refresh', '刷新')}
          </Button>
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setFavoriteOpen(true)}>
            {t('favoriteCase', '收藏教学病例')}
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 'var(--space-3, 12px)' }}>
        {[
          { icon: <BookOpen size={18} />, label: t('statTotal', '病例总数'), value: stats?.total ?? total, color: '#1677ff', bg: '#e6f4ff' },
          { icon: <Share2 size={18} />, label: t('statShared', '已分享'), value: stats?.shared ?? 0, color: '#722ed1', bg: '#f9f0ff' },
          { icon: <Heart size={18} />, label: t('statFavorites', '累计收藏'), value: stats?.favorites ?? 0, color: '#eb2f96', bg: '#fff0f6' },
          { icon: <MessageSquare size={18} />, label: t('statComments', '评论数'), value: stats?.comments ?? 0, color: '#52c41a', bg: '#f6ffed' },
        ].map((s) => (
          <Col xs={12} md={6} key={s.label}>
            <Card size="small" styles={{ body: { display: 'flex', alignItems: 'center', gap: 10 } }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)' }}>{s.label}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Tab 区域 */}
      <Card size="small" styles={{ body: { padding: 'var(--space-3, 12px)' } }}>
        <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))', marginBottom: 'var(--space-3, 12px)' }}>
          {[
            { key: 'library', label: t('tabLibrary', '病例库'), icon: <BookOpen size={14} /> },
            { key: 'exam', label: t('tabExam', '考试模式'), icon: <Award size={14} /> },
            { key: 'wrong', label: t('tabWrongBook', '错题本'), icon: <FileText size={14} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? '#1677ff' : 'var(--text-secondary, #475569)',
                borderBottom: activeTab === tab.key ? '2px solid #1677ff' : '2px solid transparent',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ 病例库 ═══ */}
        {activeTab === 'library' && (
          <div style={{ display: 'flex', gap: 14 }}>
            {/* 分类树 */}
            <div style={{ width: 250, flexShrink: 0, borderRight: '1px solid var(--border-default, rgba(0,0,0,0.12))', paddingRight: 'var(--space-3, 12px)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #334155)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                <Filter size={13} />
                {t('categories', '分类')}
              </div>
              {filteredCategories.length > 0 ? renderCategoryTree(filteredCategories) : <Spin size="small" />}
            </div>
            {/* 病例列表 */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', flexWrap: 'wrap', marginBottom: 'var(--space-3, 12px)' }}>
                <Input
                  style={{ width: 220 }}
                  prefix={<Search size={14} color="var(--text-muted, #94a3b8)" />}
                  placeholder={t('searchPlaceholder', '搜索病种/诊断/标签...')}
                  value={query.search}
                  onChange={(e) => setQuery((prev) => ({ ...prev, search: e.target.value }))}
                />
                <Select
                  style={{ width: 110 }}
                  placeholder={t('difficulty', '难度')}
                  allowClear
                  value={query.difficulty}
                  onChange={(v) => setQuery((prev) => ({ ...prev, difficulty: v }))}
                  options={DIFFICULTIES.map((d) => ({ value: d, label: d }))}
                />
                <Switch
                  checkedChildren={t('sharedOnly', '仅看已分享')}
                  unCheckedChildren={t('sharedOnly', '仅看已分享')}
                  checked={Boolean(query.sharedOnly)}
                  onChange={(v) => setQuery((prev) => ({ ...prev, sharedOnly: v || undefined }))}
                />
                {(query.search || query.disease || query.bodyPart || query.difficulty || query.tag || query.sharedOnly) && (
                  <Button size="small" onClick={() => setQuery({})}>{t('resetFilter', '重置筛选')}</Button>
                )}
              </div>
              <Spin spinning={loading}>
                {cases.length === 0 ? (
                  <Empty description={t('noData', '暂无教学病例')} />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3, 12px)' }}>
                    {cases.map((c) => {
                      return (
                        <Card key={c.id} size="small" styles={{ body: { padding: 'var(--space-3, 12px)' } }}>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{
                              width: 64, height: 64, borderRadius: 8, flexShrink: 0,
                              background: `linear-gradient(135deg, ${MODALITY_COLORS[c.modality] ?? '#64748b'}22, ${MODALITY_COLORS[c.modality] ?? '#64748b'}44)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', color: MODALITY_COLORS[c.modality] ?? '#64748b',
                            }}>
                              <Scan size={26} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a', lineHeight: 1.4 }}>{c.title}</div>
                              <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', marginTop: 'var(--space-1, 4px)', flexWrap: 'wrap' }}>
                                <Tag color={DIFFICULTY_COLORS[c.difficulty] ?? undefined} style={{ fontSize: 11, marginInlineEnd: 0 }}>{c.difficulty}</Tag>
                                <Tag style={{ fontSize: 11, marginInlineEnd: 0 }}>{c.disease}</Tag>
                                <Tag style={{ fontSize: 11, marginInlineEnd: 0 }}>{c.bodyPart}</Tag>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary, #475569)', marginTop: 'var(--space-1, 4px)' }}>
                                <Eye size={11} style={{ verticalAlign: -1 }} /> {c.viewCount}
                                <Heart size={11} style={{ verticalAlign: -1, marginLeft: 'var(--space-2, 8px)' }} /> {c.favoriteCount}
                                {c.shared && <Tag color="purple" style={{ fontSize: 10, marginLeft: 'var(--space-2, 8px)', marginInlineEnd: 0 }}>{t('sharedBadge', '已分享')}</Tag>}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary, #475569)', marginTop: 'var(--space-2, 8px)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {c.diagnosis}
                          </div>
                          {c.keyPoints.length > 0 && (
                            <div style={{ marginTop: 6 }}>
                              {c.keyPoints.slice(0, 2).map((kp) => (
                                <div key={kp} style={{ fontSize: 11, color: '#722ed1', lineHeight: 1.5 }}>· {kp}</div>
                              ))}
                            </div>
                          )}
                          <Divider style={{ margin: '8px 0' }} />
                          <Space size={4}>
                            <Button size="small" icon={<Share2 size={12} />} onClick={() => void handleShare(c)}>{t('share', '分享')}</Button>
                            <Button size="small" icon={<MessageSquare size={12} />} onClick={() => void openComments(c)}>{t('comment', '评论')}</Button>
                            <Popconfirm title={t('deleteConfirm', '确定删除该教学病例？')} onConfirm={() => void handleDelete(c.id)}>
                              <Button aria-label="删除" size="small" danger icon={<Trash2 size={12} />} />
                            </Popconfirm>
                          </Space>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </Spin>
            </div>
          </div>
        )}

        {/* ═══ 考试模式 ═══ */}
        {activeTab === 'exam' && (
          <div>
            <Card size="small" style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <Space wrap>
                <span style={{ fontSize: 12 }}>{t('examCount', '抽题数量')}</span>
                <InputNumber min={2} max={20} value={examConfig.count} onChange={(v) => setExamConfig((prev) => ({ ...prev, count: v ?? 5 }))} />
                <span style={{ fontSize: 12 }}>{t('examDifficulty', '难度')}</span>
                <Select
                  style={{ width: 100 }}
                  value={examConfig.difficulty}
                  onChange={(v) => setExamConfig((prev) => ({ ...prev, difficulty: v }))}
                  options={['全部', ...DIFFICULTIES].map((d) => ({ value: d, label: d }))}
                />
                <Button type="primary" loading={busy} onClick={() => void handleGenerate()}>
                  {t('examStart', '随机抽题')}
                </Button>
                {paper && !examResult && (
                  <Button type="primary" danger loading={busy} onClick={() => void handleSubmit()}>
                    {t('examSubmit', '提交评分')} ({Object.keys(answers).length}/{paper.total})
                  </Button>
                )}
                {paper && (
                  <Button onClick={() => { setPaper(null); setExamResult(null); setAnswers({}) }}>
                    {t('examRestart', '重新抽题')}
                  </Button>
                )}
              </Space>
            </Card>
            {!paper && <Empty description={t('examEmpty', '配置抽题数量与难度后开始考试 (病例→诊断选项→评分→错题本)')} />}
            {paper && examResult && (
              <Card size="small" style={{ marginBottom: 'var(--space-3, 12px)', borderColor: examResult.passed ? '#b7eb8f' : '#ffccc7' }}>
                <Row gutter={16} align="middle">
                  <Col><Progress type="circle" percent={examResult.score} size={72} status={examResult.passed ? 'success' : 'exception'} /></Col>
                  <Col>
                    <Statistic title={t('examCorrect', '答对题数')} value={`${examResult.correct}/${examResult.total}`} />
                    <div style={{ color: examResult.passed ? '#52c41a' : '#f5222d', fontSize: 12, fontWeight: 600 }}>
                      {examResult.passed ? t('examPassed', '通过 (≥60分)') : t('examFailed', '未通过 (≥60分)')}
                    </div>
                  </Col>
                </Row>
                {examResult.wrongQuestions.length > 0 && (
                  <Alert
                    style={{ marginTop: 10 }}
                    type="warning"
                    showIcon
                    message={`${t('wrongSaved', '以下错题已记入错题本')} (${examResult.wrongQuestions.length})`}
                    description={examResult.wrongQuestions.slice(0, 4).map((w) => `${w.title}: 选择「${w.selected}」 正确答案「${w.answer}」`).join('; ')}
                  />
                )}
              </Card>
            )}
            {paper && !examResult && (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {paper.questions.map((q, qi) => (
                  <Card key={q.caseId} size="small" title={<span style={{ fontSize: 12 }}>{qi + 1}. {q.title}</span>}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', background: 'var(--bg-primary, #f8fafc)', padding: 10, borderRadius: 6, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                      {q.findings}
                    </div>
                    <Radio.Group
                      value={answers[q.caseId]}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.caseId]: e.target.value }))}
                    >
                      <Space direction="vertical">
                        {q.options.map((opt, oi) => (
                          <Radio key={oi} value={oi} style={{ fontSize: 12 }}>{String.fromCharCode(65 + oi)}. {opt}</Radio>
                        ))}
                      </Space>
                    </Radio.Group>
                  </Card>
                ))}
              </Space>
            )}
          </div>
        )}

        {/* ═══ 错题本 ═══ */}
        {activeTab === 'wrong' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3, 12px)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)' }}>
                {t('wrongCount', '错题数量')}: <b>{wrongBook.length}</b>
              </div>
              <Popconfirm title={t('wrongClearConfirm', '确定清空错题本？')} onConfirm={() => void handleClearWrongBook()}>
                <Button size="small" danger icon={<Trash2 size={12} />}>{t('wrongClear', '清空错题本')}</Button>
              </Popconfirm>
            </div>
            {wrongBook.length === 0 ? (
              <Empty description={t('wrongEmpty', '暂无错题, 考试中答错的题目会自动收录')} />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {wrongBook.map((w) => (
                  <Card key={w.caseId} size="small">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{w.title}</span>
                        <Tag style={{ marginLeft: 'var(--space-2, 8px)', fontSize: 11 }}>{w.disease}</Tag>
                      </div>
                      <Tag color="red" style={{ fontSize: 11 }}>{t('wrongTimes', '错 {{count}} 次', { count: w.wrongCount })}</Tag>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginTop: 6 }}>
                      {t('wrongAnswer', '正确答案')}: <b style={{ color: '#52c41a' }}>{w.diagnosis}</b>
                      <span style={{ color: 'var(--text-muted, #94a3b8)' }}> · {w.lastWrongAt}</span>
                    </div>
                  </Card>
                ))}
              </Space>
            )}
          </div>
        )}
      </Card>

      {/* 收藏教学病例 Modal */}
      <Modal
        title={t('favoriteCase', '收藏教学病例')}
        open={favoriteOpen}
        onCancel={() => setFavoriteOpen(false)}
        onOk={() => void handleFavorite()}
        confirmLoading={busy}
        okText={t('save', '保存')}
        cancelText={t('cancel', '取消')}
      >
        <Form form={favoriteForm} layout="vertical">
          <Form.Item name="title" label={t('caseTitle', '病例标题')} rules={[{ required: true, message: t('titleRequired', '请输入病例标题') }]}>
            <Input placeholder={t('titlePlaceholder', '如: 右肺上叶磨玻璃结节')} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="examId" label={t('examId', '检查 ID (可选)')}>
                <Input placeholder="EXAM-xxx" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reportId" label={t('reportId', '报告 ID (可选)')}>
                <Input placeholder="REPORT-xxx" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="disease" label={t('disease', '病种')}>
                <Input placeholder={t('diseasePlaceholder', '如: 肺结节')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bodyPart" label={t('bodyPart', '部位')}>
                <Input placeholder={t('bodyPartPlaceholder', '如: 胸部')} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="difficulty" label={t('difficulty', '难度')} initialValue="入门">
            <Select options={DIFFICULTIES.map((d) => ({ value: d, label: d }))} />
          </Form.Item>
          <Form.Item name="keyPoints" label={t('keyPoints', '教学要点 (逗号分隔)')}>
            <Input placeholder="如: 磨玻璃结节分型, 随访策略" />
          </Form.Item>
          <Form.Item name="tags" label={t('tags', '标签 (逗号分隔)')}>
            <Input placeholder="如: 经典征象, 鉴别诊断" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分享 Modal */}
      <Modal
        title={shareTarget ? `${t('share', '分享')}: ${shareTarget.title}` : ''}
        open={Boolean(shareTarget)}
        onCancel={() => { setShareTarget(null); setShareInfo(null) }}
        footer={null}
      >
        {shareTarget && shareInfo && (
          <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', alignItems: 'center' }}>
            <QrPattern data={shareInfo.qrData} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', marginBottom: 'var(--space-1, 4px)' }}>{t('shareLink', '分享链接')}</div>
              <Input readOnly value={shareInfo.shareUrl} onFocus={(e) => e.target.select()} />
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 'var(--space-2, 8px)' }}>
                {t('shareHint', '扫码或复制链接即可查看病例详情 (教学共享)')}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 评论 Modal */}
      <Modal
        title={commentTarget ? `${t('comment', '评论')}: ${commentTarget.title}` : ''}
        open={Boolean(commentTarget)}
        onCancel={() => setCommentTarget(null)}
        footer={null}
        width={560}
      >
        <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 'var(--space-3, 12px)' }}>
          {comments.length === 0 && <Empty description={t('noComment', '暂无评论')} />}
          {comments.map((cm) => (
            <div key={cm.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: '#1677ff' }}>{cm.user}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{cm.time}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary, #334155)', marginTop: 2 }}>{cm.content}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
          <Input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={t('commentPlaceholder', '写下你的教学见解...')}
            onPressEnter={() => void handleAddComment()}
          />
          <Button type="primary" onClick={() => void handleAddComment()} icon={<MessageSquare size={13} />}>
            {t('commentSubmit', '发布')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
