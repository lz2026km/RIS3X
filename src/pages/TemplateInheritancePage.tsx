// ============================================================
// G005 放射科RIS系统 v1.0.2 - 模板继承与克隆
// Phase R2：模板继承 / 克隆 / 版本管理 / 使用统计
// ============================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Typography } from 'antd';

const { Title } = Typography
import {
  GitBranch, GitFork, Copy, History, ChevronRight, ChevronDown,
  GitMerge, Plus, Tag, Eye, X,
  TrendingUp, Users, Layers, BarChart3, Activity, FileCode,
} from 'lucide-react';
import { templatesApi } from '../services/api/templatesApi';
import { AppEmpty } from '../components/feedback';
import { t } from '../i18n/appI18n';

// ============================================================
// 模拟继承关系数据
// ============================================================
interface TemplateNode {
  id: string;
  name: string;
  parentId: string | null;
  version: string;
  childIds: string[];
  createdBy: string;
  createdAt: string;
  usageCount: number;
  status: 'active' | 'deprecated' | 'draft';
  type: 'parent' | 'child' | 'sibling';
  description?: string;
}

// 基于现有 6 大模板构造继承关系 (演示回退数据)
const buildInheritanceTree = (): TemplateNode[] => {
  const now = new Date();
  const isoDaysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString().slice(0, 10);

  return [
    // 胸部CT 家族
    { id: 'tpl-chest-ct-001', name: '胸部CT平扫+增强', parentId: null, version: 'v1.0', childIds: ['tpl-chest-ct-002', 'tpl-chest-ct-003'], createdBy: '张明远', createdAt: isoDaysAgo(120), usageCount: 245, status: 'active', type: 'parent', description: '原始版本，含 Lung-RADS' },
    { id: 'tpl-chest-ct-002', name: '胸部CT平扫（克隆）', parentId: 'tpl-chest-ct-001', version: 'v1.0', childIds: [], createdBy: '李慧敏', createdAt: isoDaysAgo(60), usageCount: 89, status: 'active', type: 'child', description: '仅平扫，无 Lung-RADS' },
    { id: 'tpl-chest-ct-003', name: '胸部CT增强（克隆）', parentId: 'tpl-chest-ct-001', version: 'v1.0', childIds: [], createdBy: '李慧敏', createdAt: isoDaysAgo(50), usageCount: 67, status: 'active', type: 'child', description: '仅增强，重点肺血管' },
    { id: 'tpl-chest-ct-004', name: '胸部CT平扫+增强 v2.0', parentId: 'tpl-chest-ct-001', version: 'v2.0', childIds: [], createdBy: '王建华', createdAt: isoDaysAgo(15), usageCount: 23, status: 'active', type: 'sibling', description: '升级：含 LI-RADS' },

    // 头颅CT 家族
    { id: 'tpl-head-ct-001', name: '头颅CT平扫', parentId: null, version: 'v1.0', childIds: ['tpl-head-ct-002'], createdBy: '张明远', createdAt: isoDaysAgo(180), usageCount: 312, status: 'active', type: 'parent' },
    { id: 'tpl-head-ct-002', name: '急诊头颅CT（克隆）', parentId: 'tpl-head-ct-001', version: 'v1.0', childIds: [], createdBy: '刘文博', createdAt: isoDaysAgo(90), usageCount: 156, status: 'active', type: 'child', description: '急诊专用，含脑卒中评估' },

    // 乳腺钼靶 家族
    { id: 'tpl-mg-001', name: 'MG', parentId: null, version: 'v1.0', childIds: ['tpl-mg-002'], createdBy: '赵雪琴', createdAt: isoDaysAgo(150), usageCount: 198, status: 'active', type: 'parent' },
    { id: 'tpl-mg-002', name: '乳腺钼靶+超声（克隆）', parentId: 'tpl-mg-001', version: 'v1.0', childIds: [], createdBy: '陈晓燕', createdAt: isoDaysAgo(30), usageCount: 45, status: 'active', type: 'child' },

    // 腹部CT 家族
    { id: 'tpl-abd-ct-001', name: '腹部CT平扫+增强', parentId: null, version: 'v1.0', childIds: [], createdBy: '张明远', createdAt: isoDaysAgo(100), usageCount: 178, status: 'active', type: 'parent' },

    // 冠脉CTA
    { id: 'tpl-coronary-cta-001', name: '冠脉CTA', parentId: null, version: 'v1.0', childIds: [], createdBy: '赵雪琴', createdAt: isoDaysAgo(80), usageCount: 89, status: 'active', type: 'parent' },

    // 甲状腺超声
    { id: 'tpl-thyroid-us-001', name: '甲状腺超声', parentId: null, version: 'v1.0', childIds: [], createdBy: '王建华', createdAt: isoDaysAgo(60), usageCount: 134, status: 'active', type: 'parent' },

    // 草稿
    { id: 'tpl-draft-001', name: '心肌MRI（草稿）', parentId: null, version: 'v0.1', childIds: [], createdBy: '孙立军', createdAt: isoDaysAgo(3), usageCount: 0, status: 'draft', type: 'parent' },
  ];
};

// ============================================================
// 统计派生
// ============================================================
const computeStats = (nodes: TemplateNode[]) => ({
  total: nodes.length,
  active: nodes.filter(n => n.status === 'active').length,
  deprecated: nodes.filter(n => n.status === 'deprecated').length,
  drafts: nodes.filter(n => n.status === 'draft').length,
  totalUsage: nodes.reduce((s, n) => s + n.usageCount, 0),
  avgChildren: nodes.filter(n => n.childIds.length > 0).length / Math.max(nodes.filter(n => n.parentId === null).length, 1),
});

// ============================================================
// 主组件
// ============================================================
export default function TemplateInheritancePage() {
  const navigate = useNavigate();
  // [W2-A] templatesApi 实时 (失败回退演示继承树)
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'demo'>('demo');
  const [apiError, setApiError] = useState('');
  const [nodes, setNodes] = useState<TemplateNode[]>(buildInheritanceTree());
  const [selectedId, setSelectedId] = useState<string | null>('tpl-chest-ct-001');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['tpl-chest-ct-001', 'tpl-head-ct-001', 'tpl-mg-001']));
  // [v3.0.6.11-98 Wave3B P1] 模板内容预览 Modal + 使用统计 Modal (本地派生 + 标注)
  const [previewNode, setPreviewNode] = useState<TemplateNode | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await templatesApi.list();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped: TemplateNode[] = res.data.map((tpl: any) => ({
          id: tpl.id || '',
          name: tpl.name || t('tinh.unnamedTemplate'),
          parentId: tpl.parentId ?? null,
          version: `v${tpl.version ?? 1}.0`,
          childIds: [],
          createdBy: tpl.createdById || t('tinh.system'),
          createdAt: String(tpl.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
          usageCount: Number(tpl.usage ?? 0),
          status: tpl.status === 'draft' ? 'draft' : tpl.status === 'deprecated' ? 'deprecated' : 'active',
          type: tpl.parentId ? 'child' : 'parent',
          description: String(tpl.body || '').slice(0, 60),
        }));
        // 由 parentId 派生 childIds
        mapped.forEach(n => {
          n.childIds = mapped.filter(c => c.parentId === n.id).map(c => c.id);
        });
        const parents = mapped.filter(n => n.parentId === null);
        setNodes(mapped);
        setSelectedId(parents[0]?.id ?? mapped[0]?.id ?? null);
        setExpandedIds(new Set(parents.slice(0, 3).map(p => p.id)));
        setSource('api');
      } else {
        setSource('demo');
        setApiError(t('tinh.apiUnavailable'));
      }
    } catch (e) {
      setSource('demo');
      setApiError(e instanceof Error ? e.message : t('tinh.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const stats = useMemo(() => computeStats(nodes), [nodes]);

  // 派生根节点
  const rootNodes = useMemo(() => {
    return nodes.filter(n => n.parentId === null);
  }, [nodes]);

  // 选中节点
  const selectedNode = nodes.find(n => n.id === selectedId);
  const selectedChildren = nodes.filter(n => n.parentId === selectedId);
  const selectedParent = selectedNode ? nodes.find(n => n.id === selectedNode.parentId) : null;
  const selectedSiblings = selectedNode ? nodes.filter(n => n.parentId === selectedNode.parentId && n.id !== selectedNode.id) : [];

  // 切换展开
  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  // 克隆节点: API 源 → POST /templates/:id/clone 真实创建; 演示源 → 本地克隆
  const cloneNode = async (id: string) => {
    const src = nodes.find(n => n.id === id);
    if (!src) return;
    if (source === 'api') {
      try {
        const res = await templatesApi.clone(id);
        const created: TemplateNode = {
          ...src,
          id: res.data?.id || `tpl-clone-${Date.now()}`,
          name: res.data?.name || `${src.name}（克隆）`,
          version: res.data ? `v${(res.data as any)?.version ?? 1}.0` : 'v1.0',
          childIds: [],
          parentId: id,
          createdBy: res.data?.createdById || t('tinh.currentDoctor'),
          createdAt: String(res.data?.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
          usageCount: 0,
          status: 'draft',
          type: 'child',
        };
        setNodes(prev => prev.map(n => n.id === id ? { ...n, childIds: [...n.childIds, created.id] } : n));
        setNodes(prev => [created, ...prev]);
        setSelectedId(created.id);
        if (!expandedIds.has(id)) setExpandedIds(new Set([...expandedIds, id]));
        message.success(`已通过 templatesApi 克隆为新模板：${created.name} (ID: ${created.id})`);
        return;
      } catch (e) {
        message.error('克隆失败: ' + (e instanceof Error ? e.message : '未知错误'));
        return;
      }
    }
    const newNode: TemplateNode = {
      ...src,
      id: `tpl-clone-${Date.now()}`,
      name: `${src.name}（克隆）`,
      version: 'v1.0',
      childIds: [],
      parentId: src.id,
      createdBy: t('tinh.currentDoctor'),
      createdAt: new Date().toISOString().slice(0, 10),
      usageCount: 0,
      status: 'draft',
      type: 'child',
    };
    setNodes([...nodes, newNode]);
    setNodes(prev => prev.map(n => n.id === id ? { ...n, childIds: [...n.childIds, newNode.id] } : n));
    setSelectedId(newNode.id);
    if (!expandedIds.has(id)) {
      setExpandedIds(new Set([...expandedIds, id]));
    }
    message.success(`已克隆为新模板：${newNode.name} (ID: ${newNode.id})，可在模板设计器中编辑。`);
  };

  // 继承
  const inheritNode = (id: string) => {
    cloneNode(id); // 同样实现
  };

  // 树视图渲染
  const renderTree = (parentId: string | null, depth = 0) => {
    const children = nodes.filter(n => n.parentId === parentId);
    if (children.length === 0) return null;

    return (
      <div>
        {children.map(node => {
          const hasChildren = node.childIds.length > 0;
          const isExpanded = expandedIds.has(node.id);
          const isSelected = selectedId === node.id;

          return (
            <div key={node.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(node.id)}
                onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(node.id) } }}
                style={{
                  padding: '6px 8px',
                  paddingLeft: 8 + depth * 20,
                  background: isSelected ? 'var(--color-info-bg)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--color-primary-500)' : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: 'var(--text-primary)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {hasChildren ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
                    style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                ) : (
                  <span style={{ width: 12, display: 'inline-block' }} />
                )}

                {/* 类型图标 */}
                {node.type === 'parent' ? (
                  <Layers size={12} color="#7c3aed" />
                ) : node.type === 'child' ? (
                  <GitFork size={12} color="var(--color-info-600)" />
                ) : (
                  <GitBranch size={12} color="var(--text-secondary)" />
                )}

                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 600 : 500 }}>
                  {node.name}
                </span>

                <span style={{
                  fontSize: 12, padding: '0 4px', borderRadius: 3,
                  background: node.status === 'active' ? 'var(--color-success-bg)' : node.status === 'draft' ? 'var(--color-warning-bg)' : 'var(--color-error-bg)',
                  color: node.status === 'active' ? '#047857' : node.status === 'draft' ? '#92400e' : '#b91c1c',
                  fontWeight: 700,
                }}>{node.status}</span>

                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{node.version}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>×{node.usageCount}</span>
              </div>
              {isExpanded && hasChildren && renderTree(node.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ padding: 'var(--space-5, 20px)', maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 'var(--space-4, 16px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <GitBranch size={20} color="#7c3aed" /> {t('tinh.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R2</span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
              color: source === 'api' ? 'var(--color-success-600)' : '#92400e',
              border: `1px solid ${source === 'api' ? '#bbf7d0' : '#fde68a'}`,
              fontWeight: 500,
            }}>
              {loading ? t('tinh.syncing') : source === 'api' ? t('tinh.sourceApi') : t('tinh.sourceDemo')}
            </span>
          </Title>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('tinh.subtitle')}
            {apiError && <span style={{ color: 'var(--color-error-600)', marginLeft: 'var(--space-2, 8px)' }}>{apiError}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
          <button
            onClick={() => navigate('/template-designer')}
            style={{
              padding: '6px 12px', border: '1px solid var(--color-primary-500)', borderRadius: 6,
              background: 'var(--bg-card)', color: 'var(--color-primary-800)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
            }}
          >
            <Plus size={12} /> {t('tinh.newTemplate')}
          </button>
          <button
            onClick={() => navigate('/template-management')}
            style={{
              padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6,
              background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {t('tinh.backToList')}
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 'var(--space-4, 16px)' }}>
        <StatCard icon={Layers} label={t('tinh.statTotal')} value={stats.total} color="var(--color-primary-500)" />
        <StatCard icon={Activity} label={t('tinh.statActive')} value={stats.active} color="#10b981" />
        <StatCard icon={FileCode} label={t('tinh.statDrafts')} value={stats.drafts} color="var(--color-warning-500)" />
        <StatCard icon={GitFork} label={t('tinh.statTotalUsage')} value={stats.totalUsage} color="#7c3aed" />
        <StatCard icon={Users} label={t('tinh.statParents')} value={rootNodes.length} color="var(--color-info-600)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 'var(--space-3, 12px)' }}>
        {/* 左：树视图 / 列表 */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitBranch size={12} /> {t('tinh.treeTitle')}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-1, 4px)' }}>
              <button
                onClick={() => setViewMode('tree')}
                style={{
                  padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: 3,
                  background: viewMode === 'tree' ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  color: viewMode === 'tree' ? 'var(--color-primary-800)' : '#64748b',
                  fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              >{t('tinh.viewTree')}</button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: 3,
                  background: viewMode === 'list' ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  color: viewMode === 'list' ? 'var(--color-primary-800)' : '#64748b',
                  fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              >{t('tinh.viewList')}</button>
            </div>
          </div>
          <div style={{ padding: 'var(--space-1, 4px)', maxHeight: 600, overflowY: 'auto' }}>
            {nodes.length === 0 && <AppEmpty variant="no-data" minHeight={120} />}
            {viewMode === 'tree' ? renderTree(null) : (
              <div>
                <div style={{ padding: 6, borderBottom: '1px solid var(--border-color)' }}>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('tinh.searchPlaceholder')}
                    style={{
                      width: '100%', padding: '4px 8px',
                      border: '1px solid var(--border-color)', borderRadius: 3, fontSize: 12,
                    }}
                  />
                </div>
                {nodes
                  .filter(n => !search || n.name.includes(search) || n.id.includes(search))
                  .map(n => (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(n.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(n.id) } }}
                      style={{
                        padding: 6, fontSize: 12, cursor: 'pointer',
                        background: selectedId === n.id ? 'var(--color-info-bg)' : 'transparent',
                        borderRadius: 4,
                      }}
                    >
                      {n.name} <span style={{ color: 'var(--text-secondary)' }}>({n.version})</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* 右：详情面板 */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}>
          {selectedNode ? (
            <>
              {/* 节点详情头部 */}
              <div style={{
                padding: 'var(--space-4, 16px)', borderBottom: '1px solid var(--border-color)',
                background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--color-info-bg) 100%)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                      {selectedNode.type === 'parent' && <Layers size={18} color="#7c3aed" />}
                      {selectedNode.type === 'child' && <GitFork size={18} color="var(--color-info-600)" />}
                      {selectedNode.type === 'sibling' && <GitBranch size={18} color="var(--text-secondary)" />}
                      {selectedNode.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-1, 4px)' }}>
                      ID: {selectedNode.id} · {selectedNode.version} · {t('tinh.createdAtPrefix')}{selectedNode.createdAt}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{
                      fontSize: 12, padding: '2px 8px', borderRadius: 3,
                      background: selectedNode.status === 'active' ? 'var(--color-success-bg)' : selectedNode.status === 'draft' ? 'var(--color-warning-bg)' : 'var(--color-error-bg)',
                      color: selectedNode.status === 'active' ? '#047857' : selectedNode.status === 'draft' ? '#92400e' : '#b91c1c',
                      fontWeight: 700,
                    }}>{selectedNode.status === 'active' ? t('tinh.statusActive') : selectedNode.status === 'draft' ? t('tinh.statusDraft') : t('tinh.statusDeprecated')}</span>
                  </div>
                </div>

                {selectedNode.description && (
                  <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--text-secondary)', padding: 'var(--space-2, 8px)', background: 'var(--bg-card)', borderRadius: 4, border: '1px solid var(--border-color)' }}>
                    {selectedNode.description}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-3, 12px)' }}>
                  <button
                    onClick={() => void cloneNode(selectedNode.id)}
                    style={{
                      padding: '5px 10px', border: 'none', borderRadius: 4,
                      background: 'var(--color-primary-500)', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
                    }}
                  >
                    <Copy size={11} /> {t('tinh.clone')}
                  </button>
                  <button
                    onClick={() => void inheritNode(selectedNode.id)}
                    style={{
                      padding: '5px 10px', border: 'none', borderRadius: 4,
                      background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
                    }}
                  >
                    <GitFork size={11} /> {t('tinh.inherit')}
                  </button>
                  <button
                    onClick={() => setPreviewNode(selectedNode)}
                    style={{
                      padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: 4,
                      background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
                    }}
                  >
                    <Eye size={11} /> {t('tinh.preview')}
                  </button>
                  <button
                    onClick={() => setShowStatsModal(true)}
                    style={{
                      padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: 4,
                      background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
                    }}
                  >
                    <BarChart3 size={11} /> {t('tinh.usageStats')}
                  </button>
                </div>
              </div>

              {/* 关系图 */}
              <div style={{ padding: 'var(--space-4, 16px)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GitMerge size={12} /> {t('tinh.relationGraph')}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3, 12px)' }}>
                  {/* 父节点 */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 'var(--space-1, 4px)', textTransform: 'uppercase' }}>{t('tinh.parentTemplate')}</div>
                    {selectedParent ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedId(selectedParent.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(selectedParent.id) } }}
                        style={{
                          padding: 'var(--space-2, 8px)', background: '#8b5cf622', border: '1px solid #c4b5fd',
                          borderRadius: 6, cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#5b21b6', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                          <Layers size={10} /> {selectedParent.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 2 }}>{selectedParent.version} · ×{selectedParent.usageCount}</div>
                      </div>
                    ) : (
                      <div style={{ padding: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 6, border: '1px dashed var(--border-color)' }}>
                        {t('tinh.rootTemplate')}
                      </div>
                    )}
                  </div>

                  {/* 当前节点 */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 'var(--space-1, 4px)', textTransform: 'uppercase' }}>{t('tinh.current')}</div>
                    <div style={{
                      padding: 10, background: 'var(--color-info-bg)', border: '2px solid var(--color-primary-500)',
                      borderRadius: 6, fontSize: 12,
                    }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                        {selectedNode.type === 'parent' ? <Layers size={11} /> : <GitFork size={11} />}
                        {selectedNode.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-primary-800)', marginTop: 2 }}>{selectedNode.version} · ×{selectedNode.usageCount}</div>
                    </div>
                  </div>

                  {/* 子节点 */}
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 'var(--space-1, 4px)', textTransform: 'uppercase' }}>{t('tinh.childTemplate')} ({selectedChildren.length})</div>
                    {selectedChildren.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)' }}>
                        {selectedChildren.map(c => (
                          <div
                            key={c.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedId(c.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(c.id) } }}
                            style={{
                              padding: 6, background: '#06b6d422', border: '1px solid #a5f3fc',
                              borderRadius: 4, cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            <div style={{ fontWeight: 600, color: '#0e7490', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                              <GitFork size={10} /> {c.name}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-info-600)', marginTop: 1 }}>{c.version} · ×{c.usageCount}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 6, border: '1px dashed var(--border-color)' }}>
                        {t('tinh.noChildren')}
                      </div>
                    )}
                  </div>
                </div>

                {/* 兄弟节点 */}
                {selectedSiblings.length > 0 && (
                  <div style={{ marginTop: 'var(--space-4, 16px)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 'var(--space-1, 4px)', textTransform: 'uppercase' }}>
                      {t('tinh.siblings')} ({selectedSiblings.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedSiblings.map(s => (
                        <div
                          key={s.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(s.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(s.id) } }}
                          style={{
                            padding: '4px 8px', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 4, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
                          }}
                        >
                          <GitBranch size={10} />
                          {s.name}
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({s.version})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 使用统计 */}
                <div style={{ marginTop: 'var(--space-4, 16px)', padding: 'var(--space-3, 12px)', background: 'var(--color-info-bg)', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={12} /> {t('tinh.usageStats')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3, 12px)' }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('tinh.monthUsage')}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)' }}>{Math.floor(selectedNode.usageCount * 0.3)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('tinh.totalUsage')}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)' }}>{selectedNode.usageCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('tinh.creator')}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary-800)' }}>{selectedNode.createdBy}</div>
                    </div>
                  </div>
                </div>

                {/* 版本历史（模拟） */}
                <div style={{ marginTop: 'var(--space-4, 16px)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <History size={12} /> {t('tinh.versionHistory')}
                  </div>
                  <div style={{ background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-color)', padding: 'var(--space-2, 8px)' }}>
                    {[
                      { v: selectedNode.version, time: selectedNode.createdAt, author: selectedNode.createdBy, action: t('tinh.currentVersion') },
                      { v: 'v0.9', time: '...', author: t('tinh.previousAuthor'), action: t('tinh.history') },
                    ].map((h, i) => (
                      <div key={i} style={{
                        padding: 6, marginBottom: 'var(--space-1, 4px)', background: 'var(--bg-card)', borderRadius: 4,
                        border: '1px solid var(--border-color)', fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)',
                      }}>
                        <Tag size={11} color="#7c3aed" />
                        <strong style={{ color: 'var(--color-primary-800)' }}>{h.v}</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>·</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{h.author}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>·</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{h.time}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 12, padding: '1px 4px', background: i === 0 ? 'var(--color-info-bg)' : 'var(--bg-card)', color: i === 0 ? 'var(--color-primary-800)' : '#64748b', borderRadius: 2 }}>{h.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 'var(--space-10, 40px)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
              {t('tinh.selectPrompt')}
            </div>
          )}
        </div>
      </div>

      {/* [v3.0.6.11-98 Wave3B P1] 模板内容预览 Modal */}
      {previewNode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setPreviewNode(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-6, 24px)', width: 520, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <Eye size={16} color="var(--color-info-600)" /> {t('tinh.previewTitle')}
              </div>
              <button aria-label="关闭" onClick={() => setPreviewNode(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 'var(--space-1, 4px)' }}><X size={18} /></button>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              {previewNode.name} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({previewNode.version})</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-3, 12px)' }}>
              ID: {previewNode.id} · {t('tinh.creatorLabel')}{previewNode.createdBy} · {previewNode.createdAt} · {t('tinh.typeLabel')}{previewNode.type === 'parent' ? t('tinh.typeParent') : previewNode.type === 'child' ? t('tinh.typeChild') : t('tinh.typeSibling')}
            </div>
            {previewNode.description && (
              <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-primary)', padding: 'var(--space-3, 12px)', background: 'var(--color-info-bg)', borderRadius: 8, marginBottom: 'var(--space-3, 12px)' }}>
                {previewNode.description}
              </div>
            )}
            <div style={{ fontSize: 12, lineHeight: 1.9, color: 'var(--text-primary)', padding: 'var(--space-3, 12px)', background: 'var(--content-bg)', borderRadius: 8 }}>
              {t('tinh.findingsHeader')}<br />{t('tinh.bodyPlaceholder')}<br /><br />
              {t('tinh.diagnosisHeader')}<br />{t('tinh.basedOn', { name: previewNode.name })}
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setPreviewNode(null)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>{t('tinh.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-98 Wave3B P1] 使用统计 Modal (本地派生 + 标注: 使用次数待模板用量上报接口) */}
      {showStatsModal && selectedNode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowStatsModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-6, 24px)', width: 520, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <BarChart3 size={16} color="var(--color-info-600)" /> {t('tinh.usageStats')} · {selectedNode.name}
              </div>
              <button aria-label="关闭" onClick={() => setShowStatsModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 'var(--space-1, 4px)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: 'var(--space-3, 12px)', background: 'var(--content-bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('tinh.templateUsageCount')}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>{selectedNode.usageCount}</div>
              </div>
              <div style={{ padding: 'var(--space-3, 12px)', background: 'var(--content-bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('tinh.directChildren')}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-info-600)' }}>{selectedChildren.length}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 'var(--space-2, 8px)' }}>{t('tinh.familyUsageSummary')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {[selectedNode, ...selectedChildren, ...selectedSiblings].map(n => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 12 }}>
                  <span style={{ flex: 1, color: 'var(--text-primary)' }}>{n.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{n.version}</span>
                  <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 8, background: '#8b5cf622', color: '#7c3aed', fontWeight: 700 }}>×{n.usageCount}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: '#f59e0b22', color: '#b45309', border: '1px solid var(--color-warning-300, #fcd34d)', marginBottom: 14 }}>
              {t('tinh.usageNote')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowStatsModal(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>{t('tinh.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 统计卡片
// ============================================================
const StatCard: React.FC<{ icon: any; label: string; value: number | string; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div style={{
    background: 'var(--bg-card)', padding: 'var(--space-3, 12px)', borderRadius: 8,
    border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: `${color}15`, color: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  </div>
);
