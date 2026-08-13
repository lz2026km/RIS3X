// @ts-nocheck
import { Card, Popconfirm, message } from 'antd'
// NOTE: 未解决 - 替换此文件中所有硬编码中文文本为 i18n t() 调用 (约 2,207 字符)
// ============================================================
// G005 放射科RIS系统 - 典型病例库 v1.0.0
// 汉东省人民医院放射科
// ============================================================
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search, Filter, X, ChevronDown, ChevronUp,
  Eye, Heart, MessageSquare, Clock, Calendar,
  Stethoscope, FileText, Tag, Plus, Upload,
  Download, AlertTriangle, Share2, ThumbsUp,
  Image as ImageIcon, Bookmark, BookmarkCheck,
  Activity, Scan, Monitor, BookOpen, List,
  FilterX, Award, Settings, RefreshCw, Edit3, Trash2, FolderOpen, Star
} from 'lucide-react'
import { TYPICAL_CASES_SEED as mockTypicalCases, type TypicalCase } from '../services/mockBackend/typicalCasesSeed'
import { typicalCaseApi } from '../services/api/typicalCaseApi'
import { TeachingExamModal } from './teach/TeachingExamModal'

// [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-06)] 影像教学收藏 (localStorage 持久化)
const FAVORITES_KEY = 'g005_teaching_favorites'
const TEACHING_TAGS_KEY = 'g005_teaching_tags'
const TEACHING_TAG_OPTIONS = ['教学重点', '罕见病例', '经典征象', '鉴别诊断']

// ============================================================
// 样式常量 - 蓝色主题
// ============================================================
const COLORS = {
  primary: '#1e40af',
  primaryLight: '#2563eb',
  primaryDark: '#172554',
  white: '#ffffff',
  background: 'var(--bg-card)',
  backgroundLight: '#f8fafc',
  text: '#1e293b',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  border: 'var(--border-color)',
  success: '#059669',
  successBg: '#ecfdf5',
  warning: '#d97706',
  warningBg: '#fffbeb',
  danger: '#dc2626',
  dangerBg: '#fef2f2',
  info: '#2563eb',
  infoBg: '#eff6ff',
  purple: '#7c3aed',
  purpleBg: '#f5f3ff',
}

const MODALITY_COLORS: Record<string, string> = {
  CT: '#3b82f6', MR: '#60a5fa', DR: '#22c55e',
  DSA: '#f59e0b', XR: '#06b6d4', MG: '#ec4899',
}

// ============================================================
// 类型定义
// ============================================================

// ============================================================
// 模拟数据 - 10个典型病例
// ============================================================

// ============================================================
// 辅助函数
// ============================================================
const getBodyPartColor = (bodyPart: string) => {
  const colors: Record<string, string> = {
    '头颅': '#3b82f6', '胸部': '#3b82f6', '腹部': '#22c55e',
    '脊柱': '#f59e0b', '心脏': '#ef4444', '盆腔': '#ec4899',
  }
  return colors[bodyPart] || '#64748b'
}

const getModalityColor = (modality: string) => {
  return MODALITY_COLORS[modality] || '#64748b'
}

const formatDate = (date: string) => {
  if (!date) return '-'
  return date
}

const formatDateFull = (date: string) => {
  if (!date) return ''
  const d = new Date(date)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

const getAnnotationColor = (type: string) => {
  const colors: Record<string, string> = {
    stenosis: COLORS.danger,
    mass: COLORS.warning,
    emboli: '#ff6b6b',
    edema: COLORS.purple,
    hematoma: COLORS.danger,
    herniation: COLORS.info,
    calc: COLORS.warning,
    cyst: COLORS.teal,
    inflammation: COLORS.warning,
    thrombus: COLORS.danger,
  }
  return colors[type] || COLORS.info
}

const getStatusConfig = (status: string) => {
  const configs: Record<string, { bg: string; color: string }> = {
    '已审核': { bg: COLORS.successBg, color: COLORS.success },
    '待审核': { bg: COLORS.warningBg, color: COLORS.warning },
    '编辑中': { bg: COLORS.infoBg, color: COLORS.info },
  }
  return configs[status] || { bg: COLORS.backgroundLight, color: COLORS.textMuted }
}

// ============================================================
// 子组件：标签胶囊
// ============================================================
interface TagBadgeProps { text: string; color: string; bg: string; size?: 'small' | 'default' }
const TagBadge: React.FC<TagBadgeProps> = ({ text, color, bg, size = 'default' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: size === 'small' ? '1px 6px' : '2px 10px',
    borderRadius: 12, fontSize: size === 'small' ? 10 : 11,
    fontWeight: 600, color, background: bg, gap: 4,
  }}>{text}</span>
)

// ============================================================
// 子组件：统计卡片
// ============================================================
interface StatCardProps { icon: React.ReactNode; label: string; value: string | number; color: string; bg: string }
const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bg }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
    <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{value}</div>
      <div style={{ fontSize: 12, color: COLORS.textMuted }}>{label}</div>
    </div>
  </div>
)

// ============================================================
// 子组件：手风琴折叠面板
// ============================================================
interface AccordionProps { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; count?: number }
const Accordion: React.FC<AccordionProps> = ({ title, icon, children, defaultOpen = false, count }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={() => setIsOpen(!isOpen)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', background: isOpen ? COLORS.infoBg : COLORS.white,
        cursor: 'pointer', transition: 'all 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: isOpen ? COLORS.info : COLORS.textMuted }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: isOpen ? COLORS.info : COLORS.text }}>{title}</span>
          {count !== undefined && (
            <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 10, background: isOpen ? COLORS.info : COLORS.textLight, color: COLORS.white }}>{count}</span>
          )}
        </div>
        {isOpen ? <ChevronUp size={16} style={{ color: COLORS.textMuted }} /> : <ChevronDown size={16} style={{ color: COLORS.textMuted }} />}
      </div>
      {isOpen && (
        <div style={{ padding: 12, background: COLORS.white, borderTop: `1px solid ${COLORS.border}` }}>{children}</div>
      )}
    </div>
  )
}

// ============================================================
// 子组件：病例卡片
// ============================================================
interface CaseCardProps { caseData: TypicalCase; onView: (c: TypicalCase) => void; onEdit?: (c: TypicalCase) => void; onDelete?: (c: TypicalCase) => void; isAdmin?: boolean; favorited?: boolean; onToggleFavorite?: (c: TypicalCase) => void; teachingTags?: string[] }
const CaseCard: React.FC<CaseCardProps> = ({ caseData, onView, onEdit, onDelete, isAdmin, favorited, onToggleFavorite, teachingTags }) => {
  const { t } = useTranslation('v3report')
  const [isHovered, setIsHovered] = useState(false)
  const getModalityIcon = (modality: string) => <Scan size={14} style={{ color: MODALITY_COLORS[modality] || '#64748b' }} />

  return (
    <Card bordered={false} onClick={() => onView(caseData)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
      style={{
        background: COLORS.white, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16,
        cursor: 'pointer', transition: 'all 0.25s ease', transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
      }} styles={{ body: { padding: 0 } }}>
      {/* 顶部标签 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: `${MODALITY_COLORS[caseData.examType] || '#64748b'}18`, color: MODALITY_COLORS[caseData.examType] || '#64748b' }}>
          {getModalityIcon(caseData.examType)} {caseData.examType}
        </span>
        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: `${getBodyPartColor(caseData.bodyPart)}18`, color: getBodyPartColor(caseData.bodyPart) }}>
          {caseData.bodyPart}
        </span>
        {caseData.teaching && <TagBadge text={t('teachingBadge')} color={COLORS.danger} bg={COLORS.dangerBg} size="small" />}
        {caseData.status === '待审核' && <TagBadge text={t('pendingBadge')} color={COLORS.warning} bg={COLORS.warningBg} size="small" />}
        {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-06)] 收藏星标 */}
        <span
          role="button"
          aria-label={favorited ? '取消教学收藏' : '加入教学收藏'}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(caseData) }}
          style={{ marginLeft: 'auto', cursor: 'pointer', color: favorited ? COLORS.warning : COLORS.textLight, display: 'inline-flex', alignItems: 'center' }}
        >
          <Star size={16} fill={favorited ? COLORS.warning : 'transparent'} />
        </span>
      </div>

      {/* 缩略图 */}
      <div style={{
        width: '100%', height: 100, background: `linear-gradient(135deg, ${COLORS.primaryLight}15, ${COLORS.primary}10)`,
        borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${COLORS.border}`, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <ImageIcon size={28} style={{ color: COLORS.textLight }} />
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>{t('caseCardImage')}</span>
        </div>
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
          {caseData.images.slice(0, 3).map((_, idx) => (
            <div key={idx} style={{ width: 24, height: 24, borderRadius: 4, background: COLORS.primary, opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: COLORS.white }}>{idx + 1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 患者信息 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>
          {caseData.patientName} · {caseData.gender} · {caseData.age}岁
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>{caseData.examName}</div>
      </div>

      {/* 诊断 */}
      <div style={{ padding: '8px 10px', background: COLORS.backgroundLight, borderRadius: 6, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 2 }}>{t('caseCardDiagnosis')}</div>
        <div style={{ fontSize: 12, color: COLORS.text, fontWeight: 500 }}>
          {caseData.diagnosis.length > 50 ? caseData.diagnosis.substring(0, 50) + '...' : caseData.diagnosis}
        </div>
      </div>

      {/* 标签 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {caseData.tags.slice(0, 3).map((tag, idx) => (
          <span key={idx} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: COLORS.background, color: COLORS.textMuted }}>{tag}</span>
        ))}
        {caseData.tags.length > 3 && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 500, background: COLORS.background, color: COLORS.textMuted }}>+{caseData.tags.length - 3}</span>}
        {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-06)] 教学标记 chips */}
        {(teachingTags ?? []).map((tag) => (
          <span key={tag} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: COLORS.purpleBg, color: COLORS.purple }}>
            <Star size={10} style={{ marginRight: 3, verticalAlign: -1 }} />{tag}
          </span>
        ))}
      </div>

      {/* 底部统计 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: COLORS.textMuted }}><Eye size={14} /> {caseData.viewCount}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: COLORS.textMuted }}><Heart size={14} /> {caseData.likeCount}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: COLORS.textMuted }}><MessageSquare size={14} /> {caseData.discussions.length}</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textLight, display: 'flex', alignItems: 'center', gap: 6 }}>{caseData.createdAt}
            {isAdmin && (
              <>
                <span role="button" onClick={(e) => { e.stopPropagation(); onEdit?.(caseData) }} style={{ cursor: 'pointer', color: COLORS.info, fontWeight: 600 }}><Edit3 size={13} /></span>
                <Popconfirm title={t('deleteCaseConfirm')} onConfirm={(e) => { e?.stopPropagation?.(); onDelete?.(caseData) }} onCancel={(e) => e?.stopPropagation?.()} okText={t('formSave') ? '删除' : '删除'} cancelText="取消">
                  <span role="button" onClick={(e) => e.stopPropagation()} style={{ cursor: 'pointer', color: COLORS.danger, fontWeight: 600 }}><Trash2 size={13} /></span>
                </Popconfirm>
              </>
            )}
          </div>
        </div>
    </Card>
  )
}

// ============================================================
// 子组件：病例详情抽屉
// ============================================================
interface CaseDetailDrawerProps { caseData: TypicalCase | null; visible: boolean; onClose: () => void; isAdmin?: boolean; favorited?: boolean; onToggleFavorite?: (id: string) => void; teachingTags?: string[]; onToggleTeachingTag?: (id: string, tag: string) => void }
const CaseDetailDrawer: React.FC<CaseDetailDrawerProps> = ({ caseData, visible, onClose, isAdmin, favorited, onToggleFavorite, teachingTags, onToggleTeachingTag }) => {
  const { t } = useTranslation('v3report')
  const [activeTab, setActiveTab] = useState<'info' | 'images' | 'report' | 'discussion'>('info')
  const [likedDiscussions, setLikedDiscussions] = useState<Set<string>>(new Set())
  const [newComment, setNewComment] = useState('')
  const [selectedAnnotation, setSelectedAnnotation] = useState<number | null>(null)

  if (!visible || !caseData) return null

  const handleLikeDiscussion = (discId: string) => {
    setLikedDiscussions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(discId)) newSet.delete(discId)
      else newSet.add(discId)
      return newSet
    })
  }

  const tabStyle = (tab: string) => ({
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    borderBottom: activeTab === tab ? `2px solid ${COLORS.info}` : '2px solid transparent',
    color: activeTab === tab ? COLORS.info : COLORS.textMuted, transition: 'all 0.2s',
  })

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, width: '60vw', maxWidth: 900, height: '100vh', background: COLORS.white, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.white }}>{t('caseDetailTitle')}</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('caseDetailId')}: {caseData.id} | {caseData.examType} {caseData.examName}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onToggleFavorite?.(caseData.id)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: favorited ? COLORS.warning : 'rgba(255,255,255,0.2)', color: COLORS.white, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            {favorited ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            {favorited ? t('favored') : t('favorite')}
          </button>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: `典型病例: ${c.patientName}`,
                        text: `查看典型病例: ${c.patientName} - ${c.diagnosis}`,
                        url: window.location.href
                      })
                    } else {
                      navigator.clipboard.writeText(window.location.href)
                      // 显示复制成功Toast
                      const toast = document.createElement('div');
                      toast.textContent = t('linkCopied');
                      toast.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#059669;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:fadeIn 0.3s ease';
                      document.body.appendChild(toast);
                      setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => document.body.removeChild(toast), 300); }, 2000);
                    }
                  }}
                  style={{ ...styles.btn, ...styles.btnOutline }}>
                  <Share2 size={14} />
                </button>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.2)', color: COLORS.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 标签页 */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.white }}>
        <div style={tabStyle('info')} onClick={() => setActiveTab('info')}>{t('tabBasicInfo')}</div>
        <div style={tabStyle('images')} onClick={() => setActiveTab('images')}>{t('tabImages')}</div>
        <div style={tabStyle('report')} onClick={() => setActiveTab('report')}>{t('tabReport')}</div>
        <div style={tabStyle('discussion')} onClick={() => setActiveTab('discussion')}>{t('tabDiscussion')} ({caseData.discussions.length})</div>
      </div>

      {/* 内容区域 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {activeTab === 'info' && (
          <div>
            <div style={{ background: COLORS.backgroundLight, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: COLORS.textMuted }}>{t('sectionPatientInfo')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldName')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.patientName}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldGender')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.gender}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldAge')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.age}岁</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldExamType')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.examType}</div></div>
              </div>
            </div>

            <div style={{ background: COLORS.backgroundLight, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: COLORS.textMuted }}>{t('sectionExamInfo')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldExamItem')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.examName}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldBodyPart')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.bodyPart}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldDisease')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.disease}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldCreateDate')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.createdAt}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldCreatedBy')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.createdBy}</div></div>
                <div><div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('fieldStatus')}</div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{caseData.status}</div></div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: COLORS.textMuted }}>{t('fieldTags')}</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {caseData.tags.map((tag, idx) => (
                  <span key={idx} style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 500, background: COLORS.background, color: COLORS.text }}>
                    <Tag size={10} style={{ marginRight: 4 }} />{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-06)] 教学标记: 标签 chip 多选 (localStorage 按 id) */}
            <div style={{ marginBottom: 16, background: COLORS.purpleBg, borderRadius: 10, padding: 14, border: `1px solid ${COLORS.purple}30` }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: COLORS.purple, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Star size={14} />教学标记
              </h4>
              <p style={{ margin: '0 0 10px', fontSize: 11, color: COLORS.textMuted }}>点击切换教学标签 (localStorage 持久化, 仅本人可见)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {TEACHING_TAG_OPTIONS.map((tag) => {
                  const active = (teachingTags ?? []).includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => onToggleTeachingTag?.(caseData.id, tag)}
                      style={{
                        padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: active ? `1px solid ${COLORS.purple}` : `1px solid ${COLORS.border}`,
                        background: active ? COLORS.purple : COLORS.white,
                        color: active ? COLORS.white : COLORS.textMuted,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <Star size={11} fill={active ? '#fff' : 'transparent'} />{tag}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div style={{ padding: 12, background: COLORS.infoBg, borderRadius: 8, textAlign: 'center' }}>
                <Eye size={20} style={{ color: COLORS.info, marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.info }}>{caseData.viewCount}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('statViews')}</div>
              </div>
              <div style={{ padding: 12, background: COLORS.dangerBg, borderRadius: 8, textAlign: 'center' }}>
                <Heart size={20} style={{ color: COLORS.danger, marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.danger }}>{caseData.likeCount}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('statFavorites')}</div>
              </div>
              <div style={{ padding: 12, background: COLORS.warningBg, borderRadius: 8, textAlign: 'center' }}>
                <MessageSquare size={20} style={{ color: COLORS.warning, marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.warning }}>{caseData.discussions.length}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('statDiscussions')}</div>
              </div>
              <div style={{ padding: 12, background: COLORS.successBg, borderRadius: 8, textAlign: 'center' }}>
                <FileText size={20} style={{ color: COLORS.success, marginBottom: 4 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.success }}>{caseData.images.length}</div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('statImages')}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div>
            <div style={{ background: '#1a1a2e', borderRadius: 10, padding: 20, marginBottom: 16, minHeight: 400, position: 'relative' }}>
              <div style={{ width: '100%', height: 360, background: 'linear-gradient(135deg, #2d2d44, #1a1a2e)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {caseData.annotations.map((ann, idx) => (
                  <div key={ann.id} onClick={() => setSelectedAnnotation(selectedAnnotation === idx ? null : idx)} style={{
                    position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`, width: 24, height: 24, borderRadius: '50%',
                    background: ann.type === 'stenosis' ? COLORS.danger : ann.type === 'mass' ? COLORS.warning : ann.type === 'emboli' ? '#ff6b6b' : COLORS.info,
                    border: '2px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: COLORS.white, boxShadow: '0 2px 8px rgba(0,0,0,0.4)', transform: 'translate(-50%, -50%)', zIndex: 10,
                  }}>
                    {idx + 1}
                  </div>
                ))}

                {selectedAnnotation !== null && caseData.annotations[selectedAnnotation] && (
                  <div style={{
                    position: 'absolute', left: `${caseData.annotations[selectedAnnotation].x}%`, top: `${caseData.annotations[selectedAnnotation].y - 8}%`,
                    transform: 'translateX(-50%)', background: COLORS.white, borderRadius: 8, padding: '8px 12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)', zIndex: 20, minWidth: 160,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>{caseData.annotations[selectedAnnotation].label}</div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted }}>{caseData.annotations[selectedAnnotation].description}</div>
                  </div>
                )}

                <div style={{ fontSize: 48, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}><Monitor size={64} /></div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{t('imagePreviewArea')}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{caseData.images[0]?.description || t('imageDescription')}</div>

                <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8 }}>
                  <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>W: 1500</span>
                  <span style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>L: -600</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {caseData.annotations.map((ann, idx) => (
                  <div key={ann.id} onClick={() => setSelectedAnnotation(idx)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, cursor: 'pointer',
                  }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: ann.type === 'stenosis' ? COLORS.danger : ann.type === 'mass' ? COLORS.warning : ann.type === 'emboli' ? '#ff6b6b' : COLORS.info }} />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{idx + 1}. {ann.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: COLORS.textMuted }}>{t('imageList', { count: caseData.images.length })}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {caseData.images.map((img, idx) => (
                  <div key={idx} style={{
                    background: COLORS.backgroundLight, borderRadius: 8, padding: 12, cursor: 'pointer',
                    border: `1px solid ${idx === 0 ? COLORS.info : COLORS.border}`, transition: 'all 0.2s',
                  }}>
                    <div style={{ width: '100%', height: 60, background: COLORS.primaryLight, borderRadius: 4, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ImageIcon size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.text, textAlign: 'center' }}>{img.description}</div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: 'center' }}>序列 {idx + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'report' && (
          <div>
            <div style={{ background: COLORS.backgroundLight, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: COLORS.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={16} />{t('reportFindings')}
              </h4>
              <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.8 }}>{caseData.findings}</div>
            </div>

            <div style={{ background: COLORS.backgroundLight, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: COLORS.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
                <List size={16} />{t('reportFindingsSummary')}
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {caseData.findingsList.map((finding, idx) => (
                  <li key={idx} style={{ fontSize: 13, color: COLORS.text, marginBottom: 6, lineHeight: 1.6 }}>{finding}</li>
                ))}
              </ul>
            </div>

            <div style={{ background: `${COLORS.info}10`, borderRadius: 10, padding: 16, border: `1px solid ${COLORS.info}30` }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: COLORS.info, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} />{t('reportImpression')}
              </h4>
              <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.8, whiteSpace: 'pre-line' }}>{caseData.impression}</div>
            </div>

            {caseData.annotations.length > 0 && (
              <div style={{ marginTop: 16, background: COLORS.warningBg, borderRadius: 10, padding: 16, border: `1px solid ${COLORS.warning}30` }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: COLORS.warning, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Award size={16} />{t('reportAnnotations')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {caseData.annotations.map((ann, idx) => (
                    <div key={ann.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: COLORS.white, borderRadius: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: COLORS.warning, color: COLORS.white, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{ann.label}</div>
                        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{ann.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'discussion' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {caseData.discussions.map((disc) => (
                <div key={disc.id} style={{ padding: 14, background: COLORS.backgroundLight, borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: COLORS.primary, color: COLORS.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                      {disc.avatar}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{disc.user}</div>
                      <div style={{ fontSize: 12, color: COLORS.textMuted }}>{disc.time}</div>
                    </div>
                    <button onClick={() => handleLikeDiscussion(disc.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 4, border: 'none',
                      background: likedDiscussions.has(disc.id) ? COLORS.dangerBg : 'transparent',
                      color: likedDiscussions.has(disc.id) ? COLORS.danger : COLORS.textMuted, cursor: 'pointer', fontSize: 12,
                    }}>
                      <ThumbsUp size={14} />{disc.likes + (likedDiscussions.has(disc.id) ? 1 : 0)}
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6, paddingLeft: 46 }}>{disc.content}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: 14, background: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>{t('discussionAdd')}</div>
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={t('discussionPlaceholder')}
                style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setNewComment('')} disabled={!newComment.trim()} style={{
                  padding: '6px 16px', borderRadius: 6, border: 'none', background: newComment.trim() ? COLORS.info : COLORS.textLight,
                  color: COLORS.white, fontSize: 12, fontWeight: 600, cursor: newComment.trim() ? 'pointer' : 'not-allowed',
                }}>
                  {t('discussionPost')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 子组件：新增/编辑病例表单
// ============================================================
interface AddCaseFormProps { visible: boolean; onClose: () => void; onSubmit: (data: Partial<TypicalCase>) => void; initial?: Partial<TypicalCase> | null }
const AddCaseForm: React.FC<AddCaseFormProps> = ({ visible, onClose, onSubmit, initial }) => {
  const { t } = useTranslation('v3report')
  const [formData, setFormData] = useState({
    patientName: '', age: '', gender: '男', examType: 'CT', examName: '',
    bodyPart: '头颅', disease: '', diagnosis: '', findings: '', impression: '', tags: '', teaching: false,
  })

  // [G005 2B] 打开时重置表单 (新增清空 / 编辑预填)
  useEffect(() => {
    if (visible) {
      setFormData({
        patientName: initial?.patientName ?? '', age: initial?.age != null ? String(initial.age) : '',
        gender: initial?.gender ?? '男', examType: initial?.examType ?? 'CT', examName: initial?.examName ?? '',
        bodyPart: initial?.bodyPart ?? '头颅', disease: initial?.disease ?? '', diagnosis: initial?.diagnosis ?? '',
        findings: initial?.findings ?? '', impression: initial?.impression ?? '',
        tags: Array.isArray(initial?.tags) ? initial.tags.join(',') : '', teaching: initial?.teaching ?? false,
      })
    }
  }, [visible, initial])

  const handleSubmit = () => {
    onSubmit({
      ...formData, age: parseInt(formData.age) || 0,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
    })
    onClose()
  }

  if (!visible) return null

  const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13, outline: 'none' }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <Card bordered={false} style={{ width: '90%', maxWidth: 700, maxHeight: '90vh', background: COLORS.white, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} styles={{ body: { padding: 0 } }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.white }}>{initial ? t('editCaseFormTitle') : t('addCaseFormTitle')}</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.2)', color: COLORS.white, cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={labelStyle}>{t('formPatientName')}</label><input type="text" value={formData.patientName} onChange={(e) => setFormData({ ...formData, patientName: e.target.value })} style={inputStyle} placeholder={t('placeholderPatientName')} /></div>
            <div><label style={labelStyle}>{t('formAge')}</label><input type="number" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} style={inputStyle} placeholder={t('placeholderAge')} /></div>
            <div><label style={labelStyle}>{t('formGender')}</label><select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} style={inputStyle}><option value="男">{t('male')}</option><option value="女">{t('female')}</option></select></div>
            <div><label style={labelStyle}>{t('formExamType')}</label><select value={formData.examType} onChange={(e) => setFormData({ ...formData, examType: e.target.value })} style={inputStyle}><option value="CT">CT</option><option value="MR">MR</option><option value="DR">DR</option><option value="DSA">DSA</option></select></div>
            <div><label style={labelStyle}>{t('formExamName')}</label><input type="text" value={formData.examName} onChange={(e) => setFormData({ ...formData, examName: e.target.value })} style={inputStyle} placeholder={t('placeholderExamName')} /></div>
            <div><label style={labelStyle}>{t('formBodyPart')}</label><select value={formData.bodyPart} onChange={(e) => setFormData({ ...formData, bodyPart: e.target.value })} style={inputStyle}><option value="头颅">头颅</option><option value="胸部">胸部</option><option value="腹部">腹部</option><option value="脊柱">脊柱</option><option value="心脏">心脏</option><option value="盆腔">盆腔</option></select></div>
            <div><label style={labelStyle}>{t('formDisease')}</label><input type="text" value={formData.disease} onChange={(e) => setFormData({ ...formData, disease: e.target.value })} style={inputStyle} placeholder={t('placeholderDisease')} /></div>
            <div><label style={labelStyle}>{t('formTags')}</label><input type="text" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} style={inputStyle} placeholder={t('placeholderTags')} /></div>
          </div>
          <div style={{ marginTop: 16 }}><label style={labelStyle}>{t('formDiagnosis')}</label><textarea value={formData.diagnosis} onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })} style={{ ...inputStyle, minHeight: 60 }} placeholder={t('placeholderDiagnosis')} /></div>
          <div style={{ marginTop: 16 }}><label style={labelStyle}>{t('formFindings')}</label><textarea value={formData.findings} onChange={(e) => setFormData({ ...formData, findings: e.target.value })} style={{ ...inputStyle, minHeight: 100 }} placeholder={t('placeholderFindings')} /></div>
          <div style={{ marginTop: 16 }}><label style={labelStyle}>{t('formImpression')}</label><textarea value={formData.impression} onChange={(e) => setFormData({ ...formData, impression: e.target.value })} style={{ ...inputStyle, minHeight: 80 }} placeholder={t('placeholderImpression')} /></div>
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="teaching" checked={formData.teaching} onChange={(e) => setFormData({ ...formData, teaching: e.target.checked })} style={{ width: 16, height: 16 }} />
            <label htmlFor="teaching" style={{ ...labelStyle, marginBottom: 0 }}>{t('formTeaching')}</label>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.white, color: COLORS.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('formCancel')}</button>
          <button onClick={handleSubmit} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: COLORS.info, color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('formSave')}</button>
        </div>
      </Card>
    </div>
  )
}

// ============================================================
// 主组件：典型病例库页面
// ============================================================
export default function TypicalCasesPage() {
  const { t } = useTranslation('v3report')
  const [cases, setCases] = useState<TypicalCase[]>(mockTypicalCases)
  const [selectedCase, setSelectedCase] = useState<TypicalCase | null>(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [addFormVisible, setAddFormVisible] = useState(false)
  const [editingCase, setEditingCase] = useState<TypicalCase | null>(null)
  const [isAdmin, setIsAdmin] = useState(true)
  // [G005 Wave4B] G-04 在线考试模式
  const [examModeVisible, setExamModeVisible] = useState(false)

  // [W3-B] 典型病例 API (MSW 演示数据源) — loading/error + 内置演示数据回退
  const [syncing, setSyncing] = useState(false)
  const [apiError, setApiError] = useState('')
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>('fallback')
  // [G005 v3.0.6.11-91 W1-B P1 第12轮] 统计卡接后端 getStats (有值则优先展示)
  const [apiStats, setApiStats] = useState<{ total: number; teaching: number; pending: number; views: number; likes: number } | null>(null)

  const loadCases = useCallback(async () => {
    setSyncing(true)
    setApiError('')
    try {
      const res = await typicalCaseApi.list()
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const byId = new Map(mockTypicalCases.map((c) => [c.id, c]))
        const merged: TypicalCase[] = (res.data as Partial<TypicalCase>[]).map((api) => {
          const local = byId.get(api.id!)
          if (!local) {
            return {
              id: String(api.id ?? ''),
              patientName: api.patientName ?? '',
              age: api.age ?? 0,
              gender: api.gender ?? '男',
              examType: api.examType ?? 'CT',
              examName: api.examName ?? '',
              bodyPart: api.bodyPart ?? '头颅',
              disease: api.disease ?? '',
              diagnosis: api.diagnosis ?? '',
              findings: api.findings ?? '',
              impression: api.impression ?? '',
              findingsList: api.findingsList ?? [],
              tags: api.tags ?? [],
              teaching: api.teaching ?? false,
              images: api.images ?? [],
              annotations: api.annotations ?? [],
              discussions: api.discussions ?? [],
              likeCount: api.likeCount ?? 0,
              viewCount: api.viewCount ?? 0,
              createdAt: api.createdAt ?? '',
              createdBy: api.createdBy ?? '',
              status: api.status ?? '待审核',
              verified: api.verified ?? false,
            }
          }
          return { ...local, ...api, images: local.images, annotations: local.annotations, discussions: local.discussions, findings: local.findings, impression: local.impression }
        })
        setCases(merged)
        setDataSource('live')
      } else {
        setCases(mockTypicalCases)
        setDataSource('fallback')
      }
    } catch (e) {
      setApiError((e instanceof Error ? e.message : '病例数据加载失败') + ' — 已使用内置演示数据')
      setCases(mockTypicalCases)
      setDataSource('fallback')
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => { void loadCases() }, [loadCases])

  // [G005 v3.0.6.11-91 W1-B P1 第12轮] 统计卡: 后端 getStats (失败静默回退本地统计)
  useEffect(() => {
    void typicalCaseApi.getStats().then(res => {
      if (res.success && res.data && typeof (res.data as { total?: number }).total === 'number') {
        const s = res.data as { total: number; teaching: number; pending: number; views: number; likes: number }
        if (s.total > 0) setApiStats(s)
      }
    }).catch(() => { /* 回退本地统计 */ })
  }, [])

  const [searchKeyword, setSearchKeyword] = useState('')
  const [examTypeFilter, setExamTypeFilter] = useState<string[]>([])
  const [bodyPartFilter, setBodyPartFilter] = useState<string[]>([])
  const [diseaseFilter, setDiseaseFilter] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string[]>([])
  // [G005 2B] 分类筛选 (后端 /typical-cases/categories 按检查项目聚合)
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [categories, setCategories] = useState<Array<{ name: string; count: number }>>([])
  useEffect(() => {
    void typicalCaseApi.getCategories().then(res => {
      if (res.success && Array.isArray(res.data)) setCategories(res.data)
    }).catch(() => { /* 后端不可用 → 无分类筛选 */ })
  }, [])
  const [teachingOnly, setTeachingOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'latest' | 'hottest' | 'mostLiked'>('latest')
  const [showFilters, setShowFilters] = useState(true)
  // [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-06)] 教学收藏 (localStorage)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { const v = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] } catch { return [] }
  })
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [teachingTags, setTeachingTags] = useState<Record<string, string[]>>(() => {
    try { const v = JSON.parse(localStorage.getItem(TEACHING_TAGS_KEY) || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
  })

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)) } catch { /* storage 不可用 */ }
      message.success(next.includes(id) ? '已加入教学收藏' : '已取消教学收藏')
      return next
    })
  }, [])

  const toggleTeachingTag = useCallback((id: string, tag: string) => {
    setTeachingTags(prev => {
      const cur = prev[id] ?? []
      const nextTags = cur.includes(tag) ? cur.filter(x => x !== tag) : [...cur, tag]
      const next = { ...prev, [id]: nextTags }
      try { localStorage.setItem(TEACHING_TAGS_KEY, JSON.stringify(next)) } catch { /* storage 不可用 */ }
      message.success(nextTags.includes(tag) ? `已添加教学标记: ${tag}` : `已移除教学标记: ${tag}`)
      return next
    })
  }, [])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    cases.forEach(c => c.tags.forEach(t => tags.add(t)))
    return Array.from(tags)
  }, [cases])

  const allDiseases = useMemo(() => {
    const diseases = new Set<string>()
    cases.forEach(c => diseases.add(c.disease))
    return Array.from(diseases)
  }, [cases])

  const filteredCases = useMemo(() => {
    let result = [...cases]
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase()
      result = result.filter(c => c.patientName.toLowerCase().includes(kw) || c.disease.toLowerCase().includes(kw) || c.diagnosis.toLowerCase().includes(kw) || c.examName.toLowerCase().includes(kw) || c.tags.some(t => t.toLowerCase().includes(kw)))
    }
    if (examTypeFilter.length > 0) result = result.filter(c => examTypeFilter.includes(c.examType))
    if (bodyPartFilter.length > 0) result = result.filter(c => bodyPartFilter.includes(c.bodyPart))
    if (diseaseFilter.length > 0) result = result.filter(c => diseaseFilter.includes(c.disease))
    if (tagFilter.length > 0) result = result.filter(c => c.tags.some(t => tagFilter.includes(t)))
    if (categoryFilter.length > 0) result = result.filter(c => categoryFilter.includes(c.examName || c.examType))
    if (teachingOnly) result = result.filter(c => c.teaching)
    // [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-06)] 教学收藏筛选
    if (favoriteOnly) result = result.filter(c => favorites.includes(c.id))
    switch (sortBy) {
      case 'hottest': result.sort((a, b) => b.viewCount - a.viewCount); break
      case 'mostLiked': result.sort((a, b) => b.likeCount - a.likeCount); break
      default: result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return result
  }, [cases, searchKeyword, examTypeFilter, bodyPartFilter, diseaseFilter, tagFilter, teachingOnly, sortBy, categoryFilter, favoriteOnly, favorites])

  const stats = useMemo(() => ({
    total: apiStats?.total ?? cases.length,
    teaching: apiStats?.teaching ?? cases.filter(c => c.teaching).length,
    pending: apiStats?.pending ?? cases.filter(c => c.status === '待审核').length,
    views: apiStats?.views ?? cases.reduce((sum, c) => sum + c.viewCount, 0),
    likes: apiStats?.likes ?? cases.reduce((sum, c) => sum + c.likeCount, 0),
  }), [cases, apiStats])

  const handleViewDetail = useCallback((c: TypicalCase) => { setSelectedCase(c); setDetailVisible(true) }, [])
  // [G005 2B] 新建: 调后端 createCase, 失败回退本地新增
  const handleAddCase = useCallback(async (data: Partial<TypicalCase>) => {
    const newCase: TypicalCase = {
      id: `TC${String(cases.length + 1).padStart(3, '0')}`, patientName: data.patientName || '', age: data.age || 0,
      gender: data.gender || '男', examType: data.examType || 'CT', examName: data.examName || '',
      bodyPart: data.bodyPart || '头颅', disease: data.disease || '', diagnosis: data.diagnosis || '',
      findings: data.findings || '', impression: data.impression || '',
      findingsList: data.findings?.split('\n').filter(Boolean) || [], tags: data.tags || [],
      teaching: data.teaching || false, images: [{ thumbnail: 'default', description: t('defaultImage') }],
      annotations: [], discussions: [], likeCount: 0, viewCount: 0,
      createdAt: new Date().toISOString().split('T')[0], createdBy: '当前用户',
      status: '编辑中', verified: false,
    }
    try {
      const res = await typicalCaseApi.createCase({ ...newCase, id: undefined })
      if (res.success && res.data) {
        const created = res.data as Partial<TypicalCase>
        setCases(prev => [{ ...newCase, ...created }, ...prev])
        message.success('病例已通过后端 API 创建')
        return
      }
    } catch (e) { /* 后端不可用 → 本地回退 */ }
    setCases(prev => [newCase, ...prev])
    message.success('病例已创建 (本地回退, 后端不可用)')
  }, [cases.length, t])

  // [G005 2B] 编辑: 调后端 updateCase, 失败回退本地更新
  const handleEditCase = useCallback(async (data: Partial<TypicalCase>) => {
    if (!editingCase) return
    try {
      const res = await typicalCaseApi.updateCase(editingCase.id, data)
      if (res.success) message.success('病例已通过后端 API 更新')
    } catch (e) { /* 后端不可用 → 本地回退 */ }
    setCases(prev => prev.map(c => c.id === editingCase.id ? { ...c, ...data, id: c.id } : c))
    setEditingCase(null)
  }, [editingCase])

  // [G005 2B] 删除: 调后端 deleteCase, 失败仍本地移除并提示
  const handleDeleteCase = useCallback(async (c: TypicalCase) => {
    try {
      const res = await typicalCaseApi.deleteCase(c.id)
      if (!res.success) message.warning('后端删除失败，仅本地移除')
    } catch (e) { message.warning('后端不可用，仅本地移除') }
    setCases(prev => prev.filter(x => x.id !== c.id))
    if (selectedCase?.id === c.id) { setSelectedCase(null); setDetailVisible(false) }
  }, [selectedCase])

  const toggleArrayFilter = (arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    if (arr.includes(val)) setArr(arr.filter(v => v !== val))
    else setArr([...arr, val])
  }

  const clearFilters = () => {
    setSearchKeyword(''); setExamTypeFilter([]); setBodyPartFilter([]); setDiseaseFilter([]); setTagFilter([]); setTeachingOnly(false); setCategoryFilter([]); setFavoriteOnly(false)
  }

  const hasActiveFilters = searchKeyword || examTypeFilter.length > 0 || bodyPartFilter.length > 0 || diseaseFilter.length > 0 || tagFilter.length > 0 || teachingOnly || categoryFilter.length > 0 || favoriteOnly

  return (
    <div style={{ minHeight: '100vh', background: COLORS.background }}>
      {/* 顶部统计 */}
      <div style={{ background: COLORS.primary, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.white }}>{t('typicalCasesTitle')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('hospitalSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: dataSource === 'live' ? 'rgba(255,255,255,0.18)' : COLORS.warning,
            color: dataSource === 'live' ? '#fff' : '#fff',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {syncing ? '同步中…' : dataSource === 'live' ? '典型病例 API 实时 (MSW)' : '演示数据 (内置回退)'}
          </span>
          <button
            onClick={() => void loadCases()}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} />刷新
          </button>
          {/* [G005 Wave4B] G-04 在线考试模式入口 */}
          <button
            onClick={() => setExamModeVisible(true)}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#f59e0b', color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Award size={16} />考试模式
          </button>
          {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-06)] 教学收藏筛选 */}
          <button
            onClick={() => setFavoriteOnly(!favoriteOnly)}
            style={{ padding: '8px 16px', borderRadius: 6, border: favoriteOnly ? 'none' : '1px solid rgba(255,255,255,0.3)', background: favoriteOnly ? COLORS.warning : 'rgba(255,255,255,0.1)', color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Star size={16} fill={favoriteOnly ? '#fff' : 'transparent'} />教学收藏{favoriteOnly ? ` (${favorites.length})` : ''}
          </button>
          {isAdmin && (
            <button onClick={() => { setEditingCase(null); setAddFormVisible(true) }} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: COLORS.info, color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} />{t('addCase')}
            </button>
          )}
          <button
            onClick={async (evt) => {
              const btn = (evt?.target || evt?.currentTarget) as HTMLButtonElement;
              const originalText = btn.innerHTML;
              btn.innerHTML = t('importing');
              btn.disabled = true;
              await new Promise(r => setTimeout(r, 1500));
              const cases = (() => { try { return JSON.parse(localStorage.getItem('g005_typical_cases') || '[]') } catch { return [] } })();
              cases.push({ id: `TC${Date.now()}`, importTime: new Date().toISOString() });
              localStorage.setItem('g005_typical_cases', JSON.stringify(cases));
              btn.innerHTML = t('importSuccess');
              setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000);
            }}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={16} />{t('batchImport')}
          </button>
          <button
            onClick={() => {
              // Export typical cases to CSV
              const csvContent = [
                [t('csvHeaderName'), t('csvHeaderAge'), t('csvHeaderGender'), t('csvHeaderDiagnosis'), t('csvHeaderExamType'), t('csvHeaderTypicalFeatures')].join(','),
                ...filteredCases.map(c => [
                  c.patientName, c.age, c.gender, c.diagnosis, c.examType, c.typicalFeatures
                ].join(','))
              ].join('\n')
              const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `typical_cases_${new Date().toISOString().slice(0,10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: COLORS.white, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={16} />{t('exportCases')}
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {apiError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: COLORS.dangerBg, color: COLORS.danger, fontSize: 12, borderBottom: `1px solid ${COLORS.danger}` }}>
          <AlertTriangle size={14} />
          {apiError}
          <button onClick={() => void loadCases()} style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 4, border: `1px solid ${COLORS.danger}`, background: 'transparent', color: COLORS.danger, cursor: 'pointer', fontSize: 12 }}>重试</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, padding: '16px 24px', background: COLORS.white, borderBottom: `1px solid ${COLORS.border}` }}>
        <StatCard icon={<BookOpen size={20} />} label={t('statTotalCases')} value={stats.total} color={COLORS.primary} bg={COLORS.infoBg} />
        <StatCard icon={<Award size={20} />} label={t('statTeachingCases')} value={stats.teaching} color={COLORS.danger} bg={COLORS.dangerBg} />
        <StatCard icon={<Clock size={20} />} label={t('statPendingReview')} value={stats.pending} color={COLORS.warning} bg={COLORS.warningBg} />
        <StatCard icon={<Eye size={20} />} label={t('statTotalViews')} value={stats.views.toLocaleString()} color={COLORS.info} bg={COLORS.infoBg} />
        <StatCard icon={<Heart size={20} />} label={t('statTotalFavorites')} value={stats.likes.toLocaleString()} color={COLORS.danger} bg={COLORS.dangerBg} />
        {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-06)] 收藏数统计卡 */}
        <StatCard icon={<Star size={20} />} label="教学收藏" value={favorites.length} color={COLORS.purple} bg={COLORS.purpleBg} />
      </div>

      {/* 主内容区域 */}
      <div style={{ display: 'flex', padding: '16px 24px', gap: 16 }}>
        {/* 左侧筛选栏 */}
        {showFilters && (
          <div style={{ width: 280, flexShrink: 0, background: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}`, padding: 16, height: 'calc(100vh - 220px)', overflow: 'auto' }}>
            {/* 搜索 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '8px 12px', background: COLORS.backgroundLight }}>
                <Search size={16} style={{ color: COLORS.textMuted }} />
                <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder={t('searchCases')}
                  style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', background: 'transparent' }} />
              </div>
            </div>

            {hasActiveFilters && (
              <div style={{ marginBottom: 16 }}>
                <button onClick={clearFilters} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.white, color: COLORS.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <FilterX size={14} />{t('clearFilters')}
                </button>
              </div>
            )}

            {/* 检查类型 */}
            <Accordion title={t('examType')} icon={<Scan size={14} />} count={examTypeFilter.length} defaultOpen={true}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['CT', 'MR', 'DR', 'DSA'].map(type => (
                  <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
                    <input type="checkbox" checked={examTypeFilter.includes(type)} onChange={() => toggleArrayFilter(examTypeFilter, setExamTypeFilter, type)} style={{ width: 16, height: 16 }} />
                    <span style={{ width: 24, height: 16, borderRadius: 4, background: `${MODALITY_COLORS[type]}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Scan size={14} style={{ color: MODALITY_COLORS[type] }} />
                    </span>
                    <span style={{ fontSize: 13, color: COLORS.text }}>{type}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: COLORS.textMuted, background: COLORS.background, padding: '1px 6px', borderRadius: 8 }}>
                      {cases.filter(c => c.examType === type).length}
                    </span>
                  </label>
                ))}
              </div>
            </Accordion>

            {/* 检查部位 */}
            <Accordion title={t('bodyPart')} icon={<Stethoscope size={14} />} count={bodyPartFilter.length} defaultOpen={true}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['头颅', '胸部', '腹部', '脊柱', '心脏', '盆腔'].map(part => {
                  const count = cases.filter(c => c.bodyPart === part).length
                  if (count === 0) return null
                  return (
                    <button key={part} onClick={() => toggleArrayFilter(bodyPartFilter, setBodyPartFilter, part)} style={{
                      padding: '4px 10px', borderRadius: 6, border: `1px solid ${bodyPartFilter.includes(part) ? getBodyPartColor(part) : COLORS.border}`,
                      background: bodyPartFilter.includes(part) ? `${getBodyPartColor(part)}15` : COLORS.white,
                      color: bodyPartFilter.includes(part) ? getBodyPartColor(part) : COLORS.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {part} ({count})
                    </button>
                  )
                })}
              </div>
            </Accordion>

            {/* 疾病类型 */}
            <Accordion title={t('diseaseType')} icon={<Activity size={14} />} count={diseaseFilter.length} defaultOpen={false}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allDiseases.map(disease => {
                  const count = cases.filter(c => c.disease === disease).length
                  return (
                    <label key={disease} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
                      <input type="checkbox" checked={diseaseFilter.includes(disease)} onChange={() => toggleArrayFilter(diseaseFilter, setDiseaseFilter, disease)} style={{ width: 14, height: 14 }} />
                      <span style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>{disease}</span>
                      <span style={{ fontSize: 12, color: COLORS.textMuted }}>{count}</span>
                    </label>
                  )
                })}
              </div>
            </Accordion>

            {/* [G005 2B] 病例分类 (后端 getCategories) */}
            {categories.length > 0 && (
              <Accordion title={t('caseCategory')} icon={<FolderOpen size={14} />} count={categoryFilter.length} defaultOpen={false}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {categories.map(cat => (
                    <label key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
                      <input type="checkbox" checked={categoryFilter.includes(cat.name)} onChange={() => toggleArrayFilter(categoryFilter, setCategoryFilter, cat.name)} style={{ width: 14, height: 14 }} />
                      <span style={{ fontSize: 12, color: COLORS.text, flex: 1 }}>{cat.name}</span>
                      <span style={{ fontSize: 12, color: COLORS.textMuted }}>{cat.count}</span>
                    </label>
                  ))}
                </div>
              </Accordion>
            )}

            {/* 标签筛选 */}
            <Accordion title={t('tags')} icon={<Tag size={14} />} count={tagFilter.length} defaultOpen={false}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {allTags.map(tag => (
                  <button key={tag} onClick={() => toggleArrayFilter(tagFilter, setTagFilter, tag)} style={{
                    padding: '2px 8px', borderRadius: 10, border: `1px solid ${tagFilter.includes(tag) ? COLORS.info : COLORS.border}`,
                    background: tagFilter.includes(tag) ? COLORS.infoBg : COLORS.white,
                    color: tagFilter.includes(tag) ? COLORS.info : COLORS.textMuted, fontSize: 12, cursor: 'pointer',
                  }}>
                    {tag}
                  </button>
                ))}
              </div>
            </Accordion>

            {/* 教学病例 */}
            <div style={{ padding: '10px 12px', borderRadius: 8, background: COLORS.backgroundLight, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={teachingOnly} onChange={() => setTeachingOnly(!teachingOnly)} style={{ width: 16, height: 16 }} />
                <Award size={14} style={{ color: COLORS.danger }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{t('teachingOnly')}</span>
              </label>
            </div>
          </div>
        )}

        {/* 右侧病例列表 */}
        <div style={{ flex: 1 }}>
          {/* 工具栏 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setShowFilters(!showFilters)} style={{
                padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`,
                background: showFilters ? COLORS.infoBg : COLORS.white,
                color: showFilters ? COLORS.info : COLORS.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Filter size={14} />{showFilters ? t('hideFilters') : t('showFilters')}
              </button>
              <span style={{ fontSize: 13, color: COLORS.textMuted }}>{t('foundCases', { count: filteredCases.length }) }</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>{t('sortBy')}</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.white, fontSize: 12, color: COLORS.text, cursor: 'pointer' }}>
                <option value="latest">{t('latest')}</option>
                <option value="hottest">{t('hottest')}</option>
                <option value="mostLiked">{t('mostLiked')}</option>
              </select>
            </div>
          </div>

          {/* 病例卡片网格 */}
          {filteredCases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: COLORS.white, borderRadius: 10, border: `1px solid ${COLORS.border}` }}>
              <FileText size={48} style={{ color: COLORS.textLight, marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: COLORS.text }}>{t('noCasesFound')}</h3>
              <p style={{ margin: 0, fontSize: 13, color: COLORS.textMuted }}>{t('adjustFiltersHint')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {filteredCases.map(caseItem => (
                <CaseCard key={caseItem.id} caseData={caseItem} onView={handleViewDetail} onEdit={(c) => { setEditingCase(c); setAddFormVisible(true) }} onDelete={(c) => void handleDeleteCase(c)} isAdmin={isAdmin}
                  favorited={favorites.includes(caseItem.id)} onToggleFavorite={(c) => toggleFavorite(c.id)} teachingTags={teachingTags[caseItem.id] ?? []} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CaseDetailDrawer caseData={selectedCase} visible={detailVisible} onClose={() => setDetailVisible(false)} isAdmin={isAdmin}
        favorited={selectedCase ? favorites.includes(selectedCase.id) : false}
        onToggleFavorite={(id) => toggleFavorite(id)}
        teachingTags={selectedCase ? teachingTags[selectedCase.id] ?? [] : []}
        onToggleTeachingTag={(id, tag) => toggleTeachingTag(id, tag)} />
      <AddCaseForm visible={addFormVisible} initial={editingCase} onClose={() => { setAddFormVisible(false); setEditingCase(null) }} onSubmit={editingCase ? (d) => void handleEditCase(d) : (d) => void handleAddCase(d)} />
      <TeachingExamModal visible={examModeVisible} cases={cases} onClose={() => setExamModeVisible(false)} />
    </div>
  )
}
