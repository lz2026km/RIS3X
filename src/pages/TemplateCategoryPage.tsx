// ============================================================
// G005 放射科RIS系统 v1.0.2 - 模板分类树管理
// Phase R2：按设备 / 部位 / 病种 三维分类树 + 拖拽管理
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { templatesApi } from '../services/api/templatesApi';
import {
  FolderTree, Folder, FolderOpen, FileText, Plus, Edit2,
  ChevronRight, ChevronDown, Search, Tag, Layers,
  ArrowRight, Move, GitBranch,
} from 'lucide-react';
import {
  TEMPLATE_CATEGORY_TREE,
  type TemplateCategoryNode,
  flattenCategoryTree,
  countByLevel,
  findCategoryById,
} from '../data/templateCategoryTree';

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
    modality: '#1e40af',
    bodyPart: '#7c3aed',
    disease: '#0891b2',
  };
  const color = levelColors[node.level] || '#64748b';

  return (
    <div>
      <div
        onClick={() => onSelect(node.id)}
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
          color: node.level === 'modality' ? '#1e40af' : node.level === 'bodyPart' ? '#7c3aed' : '#0e7490',
          fontWeight: 700,
        }}>{node.level === 'modality' ? '设备' : node.level === 'bodyPart' ? '部位' : '病种'}</span>
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

  useEffect(() => {
    templatesApi.list().then(res => {
      if (res.success && Array.isArray(res.data)) {
        const byCategory: Record<string, number> = {}
        res.data.forEach(t => {
          byCategory[t.category] = (byCategory[t.category] || 0) + 1
        })
        setTemplateCount(prev => ({ ...prev, ...byCategory }))
      }
    })
  }, [])

  const stats = useMemo(() => countByLevel(TEMPLATE_CATEGORY_TREE), []);
  const flatList = useMemo(() => flattenCategoryTree(TEMPLATE_CATEGORY_TREE), []);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const selectedNode = selectedId ? findCategoryById(TEMPLATE_CATEGORY_TREE, selectedId) : null;
  const selectedStats = selectedNode ? countTemplatesInTreeWithOverride(selectedNode, templateCount) : 0;
  const selectedChildren = selectedNode ? selectedNode.children : [];

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FolderTree size={20} color="#0891b2" /> 模板分类管理
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R2</span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            按设备 → 部位 → 病种 三级分类管理 36 个标准模板分类
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/template-designer')}
            style={{
              padding: '6px 12px', border: '1px solid #3b82f6', borderRadius: 6,
              background: 'var(--bg-card)', color: '#1e40af', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus size={12} /> 新建分类
          </button>
          <button
            onClick={() => navigate('/template-management')}
            style={{
              padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 6,
              background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12,
              cursor: 'pointer',
            }}
          >
            返回模板列表
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard icon={Layers} label="总分类数" value={stats.total} color="#3b82f6" />
        <StatCard icon={Folder} label="设备分类" value={stats.modality} color="#1e40af" />
        <StatCard icon={FolderOpen} label="部位分类" value={stats.bodyPart} color="#7c3aed" />
        <StatCard icon={Tag} label="病种分类" value={stats.disease} color="#0891b2" />
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
            <FolderTree size={12} color="#1e40af" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', flex: 1 }}>分类树</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setViewMode('tree')}
                style={{
                  padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: 3,
                  background: viewMode === 'tree' ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  color: viewMode === 'tree' ? '#1e40af' : '#64748b',
                  fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              >树</button>
              <button
                onClick={() => setViewMode('flat')}
                style={{
                  padding: '2px 8px', border: '1px solid var(--border-color)', borderRadius: 3,
                  background: viewMode === 'flat' ? 'var(--color-info-bg)' : 'var(--bg-card)',
                  color: viewMode === 'flat' ? '#1e40af' : '#64748b',
                  fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              >平铺</button>
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
                placeholder="搜索分类..."
                style={{
                  width: '100%', padding: '6px 8px 6px 26px',
                  border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ padding: 4, maxHeight: 540, overflowY: 'auto' }}>
            {viewMode === 'tree' ? (
              TEMPLATE_CATEGORY_TREE.map(node => (
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
                    onClick={() => setSelectedId(n.id)}
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
                  编码：<code style={{ background: 'var(--bg-card)', padding: '1px 4px', borderRadius: 3 }}>{selectedNode.code}</code> · 层级：<strong>{selectedNode.level === 'modality' ? '设备' : selectedNode.level === 'bodyPart' ? '部位' : '病种'}</strong>
                </div>
                {selectedNode.description && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-primary)', padding: 8, background: 'var(--bg-card)', borderRadius: 4, border: '1px solid #bae6fd' }}>
                    {selectedNode.description}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => navigate('/template-designer')}
                    style={{
                      padding: '5px 10px', border: 'none', borderRadius: 4,
                      background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Plus size={11} /> 在此分类下新建模板
                  </button>
                  <button
                    style={{
                      padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: 4,
                      background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Edit2 size={11} /> 编辑分类
                  </button>
                  <button
                    style={{
                      padding: '5px 10px', border: '1px solid var(--border-color)', borderRadius: 4,
                      background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Move size={11} /> 移动
                  </button>
                </div>
              </div>

              <div style={{ padding: 16 }}>
                {/* 子分类 */}
                {selectedChildren.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Folder size={12} /> 子分类 ({selectedChildren.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {selectedChildren.map(c => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedId(c.id)}
                          style={{
                            padding: 10, background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 6, cursor: 'pointer', fontSize: 12,
                            display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-info-bg)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                        >
                          <span style={{ fontSize: 16 }}>{c.icon || '📁'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.code}</div>
                          </div>
                          <span style={{
                            fontSize: 12, padding: '1px 5px', borderRadius: 8,
                            background: 'var(--color-info-bg)', color: '#1e40af', fontWeight: 700,
                          }}>{TEMPLATE_COUNT_MAP[c.id] || 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 该分类下的模板 */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={12} /> 模板列表 (本分类 {templateCount[selectedNode.id] || 0} / 全部后代 {selectedStats})
                  </div>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, padding: 12, minHeight: 80, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {templateCount[selectedNode.id] ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {Array.from({ length: templateCount[selectedNode.id] }).map((_, i) => (
                          <div key={i} style={{
                            padding: 8, background: 'var(--bg-card)', borderRadius: 4,
                            border: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            <FileText size={12} color="#3b82f6" />
                            <span style={{ fontWeight: 600, color: '#1e40af' }}>{selectedNode.name} 模板 #{i + 1}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>v1.0</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, padding: '1px 4px', background: 'var(--color-success-bg)', color: '#047857', borderRadius: 2 }}>已启用</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        该分类暂无模板
                        <div style={{ marginTop: 8 }}>
                          <button
                            onClick={() => navigate('/template-designer')}
                            style={{
                              padding: '4px 12px', border: '1px dashed #3b82f6', borderRadius: 4,
                              background: 'transparent', color: '#1e40af', fontSize: 12,
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Plus size={11} /> 创建第一个模板
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 路径面包屑 */}
                <div style={{ marginTop: 16, padding: 10, background: 'var(--color-warning-bg)', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <GitBranch size={12} /> 分类路径
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', color: '#78350f' }}>
                    {(() => {
                      const pathNodes = flatList.filter(n => n.path === selectedNode.name || n.path.startsWith(selectedNode.name + ' / '));
                      if (pathNodes.length > 0) {
                        return pathNodes[0].path.split(' / ').map((p, i, arr) => (
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
              请从左侧选择分类查看详情
            </div>
          )}
        </div>
      </div>
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
