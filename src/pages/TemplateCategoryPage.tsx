// ============================================================
// G005 放射科RIS系统 v1.0.2 - 模板分类树管理
// Phase R2：按设备 / 部位 / 病种 三维分类树 + 拖拽管理
// [v3.0.6.11-96 Wave3B P1] 接真实 /templates/categories (CRUD + 树渲染),
//   失败回退本地静态树 + 标注; 编辑/删除按真实分类
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { templatesApi, type TemplateCategoryDto, type TemplateDto } from '../services/api/templatesApi';
import { LoadingBanner, ErrorBanner, AppEmpty } from '../components/feedback';
import { t } from '../i18n/appI18n';
import { StatusTag } from '../components/common/StatusTag';
import {
  FolderTree, Folder, FolderOpen, FileText, Plus, Edit2,
  ChevronRight, ChevronDown, Search, Tag, Layers,
  ArrowRight, Move, GitBranch, Trash2, X, ArrowLeft, List, Grid,
} from 'lucide-react';
import {
  TEMPLATE_CATEGORY_TREE,
  type TemplateCategoryNode,
  flattenCategoryTree,
  countByLevel,
  findCategoryById,
} from '../data/templateCategoryTree';

// [v3.0.6.11-96 Wave3B P1] 真实分类(扁平, name/sortOrder) → 树根节点; 按 code 匹配静态子树作为后代
function buildTreeFromCategories(cats: TemplateCategoryDto[]): TemplateCategoryNode[] {
  return [...cats]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((c) => {
      const staticRoot = TEMPLATE_CATEGORY_TREE.find((n) => n.code.toUpperCase() === String(c.name ?? '').toUpperCase());
      if (staticRoot) {
        return { ...staticRoot, id: c.id, name: c.name, description: c.description || staticRoot.description };
      }
      return {
        id: c.id,
        name: c.name,
        code: String(c.name ?? '').toUpperCase(),
        level: 'modality' as const,
        children: [],
        templateCount: 0,
        description: c.description,
      };
    });
}

// ============================================================
// 模拟每个分类下的模板数量
// ============================================================
const TEMPLATE_COUNT_MAP: Record<string, number> = {
  'cat-ct': 12,
  'cat-ct-head': 4,
  'cat-ct-head-plain': 2,
  'cat-ct-head-enhance': 1,
  'cat-ct-head-cta': 1,
  'cat-ct-chest': 5,
  'cat-ct-chest-plain': 2,
  'cat-ct-chest-enhance': 2,
  'cat-ct-chest-lungcancer': 1,
  'cat-ct-abdomen': 3,
  'cat-ct-cardiac': 2,
  'cat-ct-spine': 2,
  'cat-mr': 10,
  'cat-mr-head': 4,
  'cat-mr-head-plain': 2,
  'cat-mr-head-enhance': 1,
  'cat-mr-head-mra': 1,
  'cat-mr-spine': 3,
  'cat-mr-abdomen': 2,
  'cat-mr-joint': 1,
  'cat-mg': 3,
  'cat-mg-screening': 1,
  'cat-mg-diagnosis': 1,
  'cat-mg-followup': 1,
  'cat-dr': 4,
  'cat-dr-chest': 1,
  'cat-dr-abdomen': 1,
  'cat-dr-spine': 1,
  'cat-dr-limb': 1,
  'cat-us': 4,
  'cat-us-thyroid': 1,
  'cat-us-abdomen': 1,
  'cat-us-cardiac': 1,
  'cat-us-vascular': 1,
  'cat-special': 3,
  'cat-special-petct': 1,
  'cat-special-dsa': 1,
  'cat-special-gi': 1,
};

// ============================================================
// 树节点组件
// ============================================================
const TreeNode: React.FC<{
  node: TemplateCategoryNode;
  depth: number;
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  searchTerm: string;
  templateCount: Record<string, number>;
}> = ({ node, depth, expanded, selectedId, onToggle, onSelect, searchTerm, templateCount }) => {
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  const tplCount = templateCount[node.id] || 0;
  const totalCount = useMemo(() => countTemplatesInTreeWithOverride(node, templateCount), [node, templateCount]);

  // 搜索高亮匹配
  const matchesSearch = searchTerm && (
    node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (node.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (searchTerm && !matchesSearch && !hasMatchingDescendant(node, searchTerm)) {
    return null;
  }

  const levelColors: Record<string, string> = {
    modality: 'var(--color-primary-800)',
    bodyPart: '#7c3aed',
    disease: 'var(--color-info-600)',
  };
  const color = levelColors[node.level] || '#64748b';

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(node.id) } }}
        style={{
          padding: '6px 8px',
          paddingLeft: 8 + depth * 16,
          background: isSelected ? `${color}15` : 'transparent',
          borderLeft: isSelected ? `3px solid ${color}` : '3px solid transparent',
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
            onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
            style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span style={{ width: 12, display: 'inline-block' }} />
        )}

        {isExpanded && hasChildren ? (
          <FolderOpen size={13} color={color} />
        ) : (
          <Folder size={13} color={color} />
        )}

        {node.icon && <span style={{ fontSize: 12 }}>{node.icon}</span>}

        <span style={{ flex: 1, fontWeight: isSelected ? 600 : 500 }}>{node.name}</span>

        {tplCount > 0 && (
          <span style={{
            fontSize: 12, padding: '1px 5px', borderRadius: 8,
            background: `${color}20`, color: color, fontWeight: 700,
          }}>{totalCount}</span>
        )}

        <span style={{
          fontSize: 12, padding: '1px 4px', borderRadius: 3,
          background: node.level === 'modality' ? 'var(--color-info-bg)' : node.level === 'bodyPart' ? '#8b5cf622' : 'var(--color-info-bg)',
          color: node.level === 'modality' ? 'var(--color-primary-800)' : node.level === 'bodyPart' ? '#7c3aed' : '#0e7490',
          fontWeight: 700,
        }}>{node.level === 'modality' ? t('tplCategory.levelModality') : node.level === 'bodyPart' ? t('tplCategory.levelBodyPart') : t('tplCategory.levelDisease')}</span>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              searchTerm={searchTerm}
              templateCount={templateCount}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 工具：递归查找匹配后代
function hasMatchingDescendant(node: TemplateCategoryNode, term: string): boolean {
  const t = term.toLowerCase();
  for (const c of node.children) {
    if (c.name.toLowerCase().includes(t) || c.code.toLowerCase().includes(t) || hasMatchingDescendant(c, t)) {
      return true;
    }
  }
  return false;
}

// 工具：带覆盖的计数
function countTemplatesInTreeWithOverride(node: TemplateCategoryNode, countMap?: Record<string, number>): number {
  const map = countMap || TEMPLATE_COUNT_MAP;
  const own = map[node.id] || 0;
  let total = own;
  for (const c of node.children) {
    total += countTemplatesInTreeWithOverride(c, map);
  }
  return total;
}

// ============================================================
// 主组件
// ============================================================
export default function TemplateCategoryPage() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['cat-ct', 'cat-ct-head', 'cat-ct-chest', 'cat-mr', 'cat-mr-head'])
  );
  const [selectedId, setSelectedId] = useState<string | null>('cat-ct-chest');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  const [templateCount, setTemplateCount] = useState<Record<string, number>>(TEMPLATE_COUNT_MAP);
  // [v3.0.6.11-99 Wave8A P1] 真实模板列表 (templatesApi.list → 按分类过滤渲染)
  const [templates, setTemplates] = useState<TemplateDto[]>([]);

  // [v3.0.6.11-96 Wave3B P1] 真实分类: /templates/categories (CRUD), 失败回退本地静态树 + 标注
  const [categorySource, setCategorySource] = useState<'api' | 'fallback'>('api');
  const [realCategories, setRealCategories] = useState<TemplateCategoryDto[]>([]);
  const [tree, setTree] = useState<TemplateCategoryNode[]>(TEMPLATE_CATEGORY_TREE);
  const [catModal, setCatModal] = useState<{ mode: 'create' } | { mode: 'edit'; cat: TemplateCategoryNode } | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', sortOrder: 1 });
  const [catSaving, setCatSaving] = useState(false);
  // [v3.0.6.11-98 Wave3B P1] 移动分类: 目标父分类选择 Modal (DTO 无 parent 字段 → 本地重排序 + sortOrder 落库)
  const [moveModal, setMoveModal] = useState<{ cat: TemplateCategoryNode } | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string>('');
  const [moveSaving, setMoveSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    templatesApi.listCategories().then((res) => {
      if (cancelled) return;
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setRealCategories(res.data);
        setTree(buildTreeFromCategories(res.data));
        setCategorySource('api');
        setLoadError(null);
      } else {
        setCategorySource('fallback');
      }
    }).catch(() => {
      if (!cancelled) {
        setCategorySource('fallback');
        setLoadError(t('w9.states.error'));
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true };
  }, []);

  // [v3.0.6.11-96 Wave3B P1] 真实分类变更 → 重建树
  useEffect(() => {
    if (categorySource === 'api') setTree(buildTreeFromCategories(realCategories));
  }, [realCategories, categorySource]);

  useEffect(() => {
    templatesApi.list().then(res => {
      if (res.success && Array.isArray(res.data)) {
        // [v3.0.6.11-99 Wave8A P1] 真实模板数据: 全量保存 + 按分类计数 (替代占位行/硬编码计数)
        setTemplates(res.data);
        const byCategory: Record<string, number> = {}
        res.data.forEach(t => {
          byCategory[t.category] = (byCategory[t.category] || 0) + 1
        })
        setTemplateCount(prev => ({ ...prev, ...byCategory }))
      }
    }).catch(() => { setLoadError(t('w9.states.error')) })
  }, [])

  const stats = useMemo(() => countByLevel(tree), [tree]);
  const flatList = useMemo(() => flattenCategoryTree(tree), [tree]);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  // [v3.0.6.11-96 Wave3B P1] CRUD: 保存新建/编辑
  const openCreateModal = () => {
    setCatForm({ name: '', description: '', sortOrder: tree.length + 1 });
    setCatModal({ mode: 'create' });
  };

  const openEditModal = (cat: TemplateCategoryNode) => {
    setCatForm({ name: cat.name, description: cat.description ?? '', sortOrder: realCategories.find(c => c.id === cat.id)?.sortOrder ?? 1 });
    setCatModal({ mode: 'edit', cat });
  };

  const saveCategory = async () => {
    if (!catForm.name.trim()) { alert(t('tplCategory.nameRequired')); return; }
    setCatSaving(true);
    try {
      if (catModal?.mode === 'edit' && catModal.cat) {
        const res = await templatesApi.updateCategory(catModal.cat.id, { name: catForm.name, description: catForm.description, sortOrder: Number(catForm.sortOrder) });
        if (res.success && res.data) {
          setRealCategories(prev => prev.map(c => c.id === catModal.cat.id ? res.data as TemplateCategoryDto : c));
        } else {
          alert(res.error?.message ?? t('tplCategory.updateFailed'));
          setCatModal(null);
          setCatSaving(false);
          return;
        }
      } else {
        const res = await templatesApi.createCategory({ name: catForm.name, description: catForm.description, sortOrder: Number(catForm.sortOrder) });
        if (res.success && res.data) {
          setRealCategories(prev => [...prev, res.data as TemplateCategoryDto]);
        } else {
          alert(res.error?.message ?? t('tplCategory.createFailed'));
          setCatModal(null);
          setCatSaving(false);
          return;
        }
      }
      setCatModal(null);
    } catch {
      // [v3.0.6.11-96 Wave3B P1] 失败回退: 本地新增/更新 + 标注
      if (catModal?.mode === 'edit' && catModal.cat) {
        setRealCategories(prev => prev.map(c => c.id === catModal.cat.id ? { ...c, name: catForm.name, description: catForm.description, sortOrder: Number(catForm.sortOrder) } : c));
      } else {
        setRealCategories(prev => [...prev, { id: `TC-LOCAL-${Date.now()}`, name: catForm.name, description: catForm.description, sortOrder: Number(catForm.sortOrder), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
      }
      setCategorySource('fallback');
      setCatModal(null);
      alert(t('tplCategory.serviceUnavailableSave'));
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCategory = async (cat: TemplateCategoryNode) => {
    if (!window.confirm(t('tplCategory.confirmDelete', { name: cat.name }))) return;
    try {
      const res = await templatesApi.deleteCategory(cat.id);
      if (res.success) {
        setRealCategories(prev => prev.filter(c => c.id !== cat.id));
        if (selectedId === cat.id) setSelectedId(null);
      } else {
        alert(res.error?.message ?? t('tplCategory.deleteFailed'));
      }
    } catch {
      // [v3.0.6.11-96 Wave3B P1] 失败回退: 本地移除 + 标注
      setRealCategories(prev => prev.filter(c => c.id !== cat.id));
      setCategorySource('fallback');
      if (selectedId === cat.id) setSelectedId(null);
      alert(t('tplCategory.serviceUnavailableRemove'));
    }
  };

  // [v3.0.6.11-98 Wave3B P1] 移动分类: 选择目标父分类 → 本地重排序 (sortOrder) + updateCategory 落库
  const openMoveModal = (cat: TemplateCategoryNode) => {
    setMoveTargetId(cat.id);
    setMoveModal({ cat });
  };

  const saveMove = async () => {
    if (!moveModal) return;
    const { cat } = moveModal;
    setMoveSaving(true);
    try {
      const others = realCategories.filter(c => c.id !== cat.id);
      const ordered = [...others];
      if (moveTargetId !== cat.id && moveTargetId) {
        const atIdx = ordered.findIndex(c => c.id === moveTargetId);
        if (atIdx >= 0) ordered.splice(atIdx + 1, 0, realCategories.find(c => c.id === cat.id) ?? { id: cat.id, name: cat.name, sortOrder: 0 });
      } else {
        ordered.unshift(realCategories.find(c => c.id === cat.id) ?? { id: cat.id, name: cat.name, sortOrder: 0 });
      }
      const nextOrder = ordered.map((c, i) => ({ ...c, sortOrder: i + 1 }));
      const res = await templatesApi.updateCategory(cat.id, { sortOrder: nextOrder.find(c => c.id === cat.id)?.sortOrder ?? 1 });
      if (res.success) {
        setRealCategories(nextOrder);
        message.success(t('tplCategory.movedSuccess', { name: cat.name, order: nextOrder.find(c => c.id === cat.id)?.sortOrder ?? 1 }));
      } else {
        setRealCategories(nextOrder);
        setCategorySource('fallback');
        message.warning(t('tplCategory.serviceUnavailableReorder'));
      }
    } catch {
      setRealCategories(prev => {
        const others = prev.filter(c => c.id !== cat.id);
        return [...others, prev.find(c => c.id === cat.id)!].map((c, i) => ({ ...c, sortOrder: i + 1 }));
      });
      setCategorySource('fallback');
      message.warning(t('tplCategory.serviceUnavailableReorder'));
    } finally {
      setMoveSaving(false);
      setMoveModal(null);
    }
  };

  const selectedNode = selectedId ? findCategoryById(tree, selectedId) : null;
  const selectedStats = selectedNode ? countTemplatesInTreeWithOverride(selectedNode, templateCount) : 0;
  const selectedChildren = selectedNode ? selectedNode.children : [];
  // [v3.0.6.11-99 Wave8A P1] 真实模板按分类过滤 (category 匹配分类名/编码, 兼容 API/静态树)
  const categoryTemplateList = useMemo(() => {
    if (!selectedNode) return [];
    const cat = String(selectedNode.name ?? '').trim();
    const code = String(selectedNode.code ?? '').trim();
    return templates.filter(t =>
      String(t.category ?? '').trim() === cat ||
      String(t.category ?? '').trim() === code
    );
  }, [templates, selectedNode]);

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderTree size={20} color="var(--color-info-600)" /> {t('tplCategory.title')}
            <StatusTag status="success" style={{ fontWeight: 700 }}>R2</StatusTag>
            {categorySource === 'api'
              ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-success-bg)', color: 'var(--color-success-600)', border: '1px solid #bbf7d0' }}>{t('tplCategory.realtimeTag')}</span>
              : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f59e0b22', color: '#b45309', border: '1px solid #fcd34d' }}>{t('tplCategory.staticTag')}</span>}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('tplCategory.subtitle')} {categorySource === 'api' ? t('tplCategory.realCategories', { count: realCategories.length }) : t('tplCategory.staticData')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={openCreateModal}
            style={{
              padding: '6px 12px', border: '1px solid var(--color-primary-500)', borderRadius: 6,
              background: 'var(--color-primary-500)', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus size={12} /> {t('tplCategory.newCategory')}
          </button>
          <button
            onClick={() => navigate('/template-management')}
            style={{
              padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6,
              background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <ArrowLeft size={12} /> {t('tplCategory.backToList')}
          </button>
        </div>
      </div>

      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard icon={Layers} label={t('tplCategory.totalCategories')} value={stats.total} color="var(--color-primary-500)" />
        <StatCard icon={Folder} label={t('tplCategory.modalityCategories')} value={stats.modality} color="var(--color-primary-800)" />
        <StatCard icon={FolderOpen} label={t('tplCategory.bodyPartCategories')} value={stats.bodyPart} color="#7c3aed" />
        <StatCard icon={Tag} label={t('tplCategory.diseaseCategories')} value={stats.disease} color="var(--color-info-600)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 12 }}>
        {/* 左：树视图 */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <FolderTree size={12} color="var(--color-primary-800)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', flex: 1 }}>{t('tplCategory.categoryTree')}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setViewMode('tree')}
                style={{
                  padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: 3,
                  background: viewMode === 'tree' ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  color: viewMode === 'tree' ? 'var(--color-primary-800)' : '#64748b',
                  fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              ><List size={12} /> {t('tplCategory.tree')}</button>
              <button
                onClick={() => setViewMode('flat')}
                style={{
                  padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: 3,
                  background: viewMode === 'flat' ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  color: viewMode === 'flat' ? 'var(--color-primary-800)' : '#64748b',
                  fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              ><Grid size={12} /> {t('tplCategory.grid')}</button>
            </div>
          </div>

          {/* 搜索框 */}
          <div style={{ padding: 8, borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: 9, color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('tplCategory.searchPlaceholder')}
                style={{
                  width: '100%', padding: '6px 8px 6px 26px',
                  border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, }}
              />
            </div>
          </div>

          <div style={{ padding: 4, maxHeight: 540, overflowY: 'auto' }}>
            {tree.length === 0 && <AppEmpty variant="no-data" minHeight={120} />}
            {viewMode === 'tree' ? (
              tree.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  selectedId={selectedId}
                  onToggle={toggle}
                  onSelect={setSelectedId}
                  searchTerm={search}
                  templateCount={templateCount}
                />
              ))
            ) : (
              flatList
                .filter(n => !search || n.name.includes(search) || n.code.includes(search))
                .map(n => (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(n.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(n.id) } }}
                    style={{
                      padding: '4px 8px',
                      paddingLeft: 8 + n.depth * 12,
                      background: selectedId === n.id ? 'var(--color-info-bg)' : 'transparent',
                      cursor: 'pointer', fontSize: 12,
                      color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{n.code}</span>
                  </div>
                ))
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
              <div style={{
                padding: 16, borderBottom: '1px solid var(--border-color)',
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0c4a6e', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedNode.icon && <span style={{ fontSize: 24 }}>{selectedNode.icon}</span>}
                  {selectedNode.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                   {t('tplCategory.code')}<code style={{ background: 'var(--bg-card)', padding: '1px 4px', borderRadius: 3 }}>{selectedNode.code}</code> · {t('tplCategory.level')}<strong>{selectedNode.level === 'modality' ? t('tplCategory.levelModality') : selectedNode.level === 'bodyPart' ? t('tplCategory.levelBodyPart') : t('tplCategory.levelDisease')}</strong>
                </div>
                {selectedNode.description && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-primary)', padding: 8, background: 'var(--bg-card)', borderRadius: 4, border: '1px solid #bae6fd' }}>
                    {selectedNode.description}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={openCreateModal}
                    style={{
                      padding: '5px 10px', border: 'none', borderRadius: 4,
                      background: 'var(--color-primary-500)', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Plus size={11} /> {t('tplCategory.newTemplateUnderCategory')}
                  </button>
                  <button
                    onClick={() => openEditModal(selectedNode)}
                    style={{
                      padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: 4,
                      background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Edit2 size={11} /> {t('tplCategory.editCategory')}
                  </button>
                  <button
                    onClick={() => void deleteCategory(selectedNode)}
                    style={{
                      padding: '5px 10px', border: '1px solid #fecaca', borderRadius: 4,
                      background: 'var(--bg-card)', color: 'var(--color-error-600)', fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Trash2 size={11} /> {t('tplCategory.deleteCategory')}
                  </button>
                  <button
                    onClick={() => openMoveModal(selectedNode)}
                    style={{
                      padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: 4,
                      background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Move size={11} /> {t('tplCategory.move')}
                  </button>
                </div>
              </div>

              <div style={{ padding: 16 }}>
                {/* 子分类 */}
                {selectedChildren.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Folder size={12} /> {t('tplCategory.subCategories', { count: selectedChildren.length })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {selectedChildren.map(c => (
                        <div
                          key={c.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(c.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(c.id) } }}
                          style={{
                            padding: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 6, cursor: 'pointer', fontSize: 12,
                            display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-info-bg)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                        >
                          <span style={{ fontSize: 16 }}>{c.icon || ''}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.code}</div>
                          </div>
                          <span style={{
                            fontSize: 12, padding: '1px 5px', borderRadius: 8,
                            background: 'var(--color-info-bg)', color: 'var(--color-primary-800)', fontWeight: 700,
                            // [v3.0.6.11-99 Wave8A P1] 子分类计数用真实 templateCount (API 分类计数合并)
                          }}>{templateCount[c.id] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 该分类下的模板 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={12} /> {t('tplCategory.templateList', { own: templateCount[selectedNode.id] || 0, all: selectedStats })}
                  </div>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, minHeight: 80, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {categoryTemplateList.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {categoryTemplateList.map(tpl => (
                          <div key={tpl.id} style={{
                            padding: 8, background: 'var(--bg-card)', borderRadius: 4,
                            border: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            <FileText size={12} color="var(--color-primary-500)" />
                            <span style={{ fontWeight: 600, color: 'var(--color-primary-800)' }}>{tpl.name}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tpl.bodyPart}{tpl.modality ? ` · ${tpl.modality}` : ''}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tpl.createdAt ? tpl.createdAt.slice(0, 10) : ''}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, padding: '1px 4px', background: 'var(--color-success-bg)', color: '#047857', borderRadius: 2 }}>
                              {tpl.status === 'approved' ? t('tplCategory.statusEnabled') : tpl.status === 'pending' ? t('tplCategory.statusPending') : tpl.status === 'rejected' ? t('tplCategory.statusRejected') : t('tplCategory.statusDraft')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {t('tplCategory.noTemplates')}
                        <div style={{ marginTop: 8 }}>
                          <button
                            onClick={() => navigate('/template-designer')}
                            style={{
                              padding: '4px 12px', border: '1px dashed var(--color-primary-500)', borderRadius: 4,
                              background: 'transparent', color: 'var(--color-primary-800)', fontSize: 12,
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Plus size={11} /> {t('tplCategory.createFirstTemplate')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 路径面包屑 */}
                <div style={{ marginTop: 16, padding: 10, background: 'var(--color-warning-bg)', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <GitBranch size={12} /> {t('tplCategory.categoryPath')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', color: '#78350f' }}>
                    {(() => {
                      const pathNodes = flatList.filter(n => n.path === selectedNode.name || n.path.startsWith(selectedNode.name + ' / '));
                      if (pathNodes.length > 0) {
                        return (pathNodes[0]?.path ?? '').split(' / ').map((p, i, arr) => (
                          <React.Fragment key={i}>
                            <span style={{ padding: '1px 6px', background: 'var(--bg-card)', borderRadius: 3 }}>{p}</span>
                            {i < arr.length - 1 && <ArrowRight size={10} />}
                          </React.Fragment>
                        ));
                      }
                      return <span>{selectedNode.name}</span>;
                    })()}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
               {t('tplCategory.selectCategoryHint')}
            </div>
          )}
        </div>
      </div>

      {/* [v3.0.6.11-96 Wave3B P1] 新建/编辑分类 Modal (name/description/sortOrder) */}
      {catModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setCatModal(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 440, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderTree size={16} color="var(--color-info-600)" /> {catModal.mode === 'edit' ? t('tplCategory.editCategoryWithName', { name: catModal.cat.name }) : t('tplCategory.newCategory')}
              </div>
              <button onClick={() => setCatModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('tplCategory.nameLabel')}</label>
                <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} placeholder={t('tplCategory.namePlaceholder')} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, boxSizing: 'border-box',}} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('tplCategory.descriptionLabel')}</label>
                <textarea value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} rows={3} placeholder={t('tplCategory.descriptionPlaceholder')} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('tplCategory.sortOrderLabel')}</label>
                <input type="number" min={1} value={catForm.sortOrder} onChange={e => setCatForm({ ...catForm, sortOrder: Number(e.target.value) })} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, boxSizing: 'border-box',}} />
              </div>
              {categorySource === 'fallback' && (
                <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: '#f59e0b22', color: '#b45309', border: '1px solid #fcd34d' }}>
                  {t('tplCategory.localFallbackHint')}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => setCatModal(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('tplCategory.cancel')}</button>
                <button onClick={() => void saveCategory()} disabled={catSaving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--color-info-600)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: catSaving ? 'wait' : 'pointer' }}>{catSaving ? t('tplCategory.saving') : t('tplCategory.saveCategory')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* [v3.0.6.11-98 Wave3B P1] 移动分类 Modal: 选择目标父分类 (DTO 无 parent 字段 → 本地重排序 + sortOrder) */}
      {moveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setMoveModal(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 460, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-800)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Move size={16} color="var(--color-info-600)" /> {t('tplCategory.moveCategory')} · {moveModal.cat.name}
              </div>
              <button onClick={() => setMoveModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('tplCategory.moveTargetLabel')}</label>
                <select
                  value={moveTargetId}
                  onChange={e => setMoveTargetId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, boxSizing: 'border-box', background: 'var(--bg-card)' }}
                >
                  <option value="">{t('tplCategory.moveTopOption')}</option>
                  {realCategories.filter(c => c.id !== moveModal.cat.id).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                  {t('tplCategory.moveHint')}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => setMoveModal(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t('tplCategory.cancel')}</button>
                <button onClick={() => void saveMove()} disabled={moveSaving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--color-info-600)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: moveSaving ? 'wait' : 'pointer' }}>{moveSaving ? t('tplCategory.moving') : t('tplCategory.confirmMove')}</button>
              </div>
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
    background: 'var(--bg-card)', padding: 12, borderRadius: 8,
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
