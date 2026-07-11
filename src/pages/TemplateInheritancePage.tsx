// ============================================================
// G005 放射科RIS系统 v1.0.2 - 模板继承与克隆
// Phase R2：模板继承 / 克隆 / 版本管理 / 使用统计
// ============================================================

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch, GitFork, Copy, History, ChevronRight, ChevronDown,
  GitMerge, Plus, Tag, Eye,
  TrendingUp, Users, Layers, BarChart3, Activity, FileCode,
} from 'lucide-react';

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

// 基于现有 6 大模板构造继承关系
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
  const [nodes, setNodes] = useState<TemplateNode[]>(buildInheritanceTree());
  const [selectedId, setSelectedId] = useState<string | null>('tpl-chest-ct-001');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['tpl-chest-ct-001', 'tpl-head-ct-001', 'tpl-mg-001']));

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

  // 克隆节点
  const cloneNode = (id: string) => {
    const src = nodes.find(n => n.id === id);
    if (!src) return;
    const newNode: TemplateNode = {
      ...src,
      id: `tpl-clone-${Date.now()}`,
      name: `${src.name}（克隆）`,
      version: 'v1.0',
      childIds: [],
      parentId: src.id,
      createdBy: '当前医生',
      createdAt: new Date().toISOString().slice(0, 10),
      usageCount: 0,
      status: 'draft',
      type: 'child',
    };
    setNodes([...nodes, newNode]);
    // 添加到源节点的 childIds
    setNodes(prev => prev.map(n => n.id === id ? { ...n, childIds: [...n.childIds, newNode.id] } : n));
    setSelectedId(newNode.id);
    if (!expandedIds.has(id)) {
      setExpandedIds(new Set([...expandedIds, id]));
    }
    alert(`已克隆为新模板：${newNode.name}\nID: ${newNode.id}\n可在 TemplateDesignerPage 中编辑。`);
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
                onClick={() => setSelectedId(node.id)}
                style={{
                  padding: '6px 8px',
                  paddingLeft: 8 + depth * 20,
                  background: isSelected ? '#dbeafe' : 'transparent',
                  borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: '#1e293b',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {hasChildren ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
                    style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
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
                  <GitFork size={12} color="#0891b2" />
                ) : (
                  <GitBranch size={12} color="#475569" />
                )}

                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 600 : 500 }}>
                  {node.name}
                </span>

                <span style={{
                  fontSize: 12, padding: '0 4px', borderRadius: 3,
                  background: node.status === 'active' ? '#d1fae5' : node.status === 'draft' ? '#fef3c7' : '#fee2e2',
                  color: node.status === 'active' ? '#047857' : node.status === 'draft' ? '#92400e' : '#b91c1c',
                  fontWeight: 700,
                }}>{node.status}</span>

                <span style={{ fontSize: 12, color: '#94a3b8' }}>{node.version}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>×{node.usageCount}</span>
              </div>
              {isExpanded && hasChildren && renderTree(node.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch size={20} color="#7c3aed" /> 模板继承与克隆
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R2</span>
          </h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
            模板版本管理、克隆/继承、父子追溯、使用统计
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/template-designer')}
            style={{
              padding: '6px 12px', border: '1px solid #3b82f6', borderRadius: 6,
              background: '#fff', color: '#1e40af', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Plus size={12} /> 新建模板
          </button>
          <button
            onClick={() => navigate('/template-management')}
            style={{
              padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 6,
              background: '#fff', color: '#475569', fontSize: 12,
              cursor: 'pointer',
            }}
          >
            返回列表
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatCard icon={Layers} label="模板总数" value={stats.total} color="#3b82f6" />
        <StatCard icon={Activity} label="已启用" value={stats.active} color="#10b981" />
        <StatCard icon={FileCode} label="草稿" value={stats.drafts} color="#f59e0b" />
        <StatCard icon={GitFork} label="总使用次数" value={stats.totalUsage} color="#7c3aed" />
        <StatCard icon={Users} label="父模板数" value={rootNodes.length} color="#0891b2" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12 }}>
        {/* 左：树视图 / 列表 */}
        <div style={{
          background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
              <GitBranch size={12} /> 继承关系树
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setViewMode('tree')}
                style={{
                  padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: 3,
                  background: viewMode === 'tree' ? '#dbeafe' : '#fff',
                  color: viewMode === 'tree' ? '#1e40af' : '#64748b',
                  fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              >树</button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: 3,
                  background: viewMode === 'list' ? '#dbeafe' : '#fff',
                  color: viewMode === 'list' ? '#1e40af' : '#64748b',
                  fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              >列表</button>
            </div>
          </div>
          <div style={{ padding: 4, maxHeight: 600, overflowY: 'auto' }}>
            {viewMode === 'tree' ? renderTree(null) : (
              <div>
                <div style={{ padding: 6, borderBottom: '1px solid #e2e8f0' }}>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索模板..."
                    style={{
                      width: '100%', padding: '4px 8px',
                      border: '1px solid #cbd5e1', borderRadius: 3, fontSize: 12,
                    }}
                  />
                </div>
                {nodes
                  .filter(n => !search || n.name.includes(search) || n.id.includes(search))
                  .map(n => (
                    <div
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      style={{
                        padding: 6, fontSize: 12, cursor: 'pointer',
                        background: selectedId === n.id ? '#dbeafe' : 'transparent',
                        borderRadius: 4,
                      }}
                    >
                      {n.name} <span style={{ color: '#94a3b8' }}>({n.version})</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* 右：详情面板 */}
        <div style={{
          background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}>
          {selectedNode ? (
            <>
              {/* 节点详情头部 */}
              <div style={{
                padding: 16, borderBottom: '1px solid #e2e8f0',
                background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {selectedNode.type === 'parent' && <Layers size={18} color="#7c3aed" />}
                      {selectedNode.type === 'child' && <GitFork size={18} color="#0891b2" />}
                      {selectedNode.type === 'sibling' && <GitBranch size={18} color="#475569" />}
                      {selectedNode.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      ID: {selectedNode.id} · {selectedNode.version} · 创建于 {selectedNode.createdAt}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{
                      fontSize: 12, padding: '2px 8px', borderRadius: 3,
                      background: selectedNode.status === 'active' ? '#d1fae5' : selectedNode.status === 'draft' ? '#fef3c7' : '#fee2e2',
                      color: selectedNode.status === 'active' ? '#047857' : selectedNode.status === 'draft' ? '#92400e' : '#b91c1c',
                      fontWeight: 700,
                    }}>{selectedNode.status === 'active' ? '已启用' : selectedNode.status === 'draft' ? '草稿' : '已弃用'}</span>
                  </div>
                </div>

                {selectedNode.description && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#475569', padding: 8, background: '#fff', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                    {selectedNode.description}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => cloneNode(selectedNode.id)}
                    style={{
                      padding: '5px 10px', border: 'none', borderRadius: 4,
                      background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Copy size={11} /> 克隆
                  </button>
                  <button
                    onClick={() => inheritNode(selectedNode.id)}
                    style={{
                      padding: '5px 10px', border: 'none', borderRadius: 4,
                      background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <GitFork size={11} /> 继承
                  </button>
                  <button
                    style={{
                      padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: 4,
                      background: '#fff', color: '#475569', fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Eye size={11} /> 预览
                  </button>
                  <button
                    style={{
                      padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: 4,
                      background: '#fff', color: '#475569', fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Eye size={11} /> 预览
                  </button>
                  <button
                    style={{
                      padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: 4,
                      background: '#fff', color: '#475569', fontSize: 12,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <BarChart3 size={11} /> 使用统计
                  </button>
                </div>
              </div>

              {/* 关系图 */}
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GitMerge size={12} /> 关系图谱
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {/* 父节点 */}
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>父模板</div>
                    {selectedParent ? (
                      <div
                        onClick={() => setSelectedId(selectedParent.id)}
                        style={{
                          padding: 8, background: '#f5f3ff', border: '1px solid #c4b5fd',
                          borderRadius: 6, cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#5b21b6', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Layers size={10} /> {selectedParent.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 2 }}>{selectedParent.version} · ×{selectedParent.usageCount}</div>
                      </div>
                    ) : (
                      <div style={{ padding: 8, fontSize: 12, color: '#94a3b8', textAlign: 'center', background: '#f8fafc', borderRadius: 6, border: '1px dashed #cbd5e1' }}>
                        根模板
                      </div>
                    )}
                  </div>

                  {/* 当前节点 */}
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>当前</div>
                    <div style={{
                      padding: 10, background: '#dbeafe', border: '2px solid #3b82f6',
                      borderRadius: 6, fontSize: 12,
                    }}>
                      <div style={{ fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {selectedNode.type === 'parent' ? <Layers size={11} /> : <GitFork size={11} />}
                        {selectedNode.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#1e40af', marginTop: 2 }}>{selectedNode.version} · ×{selectedNode.usageCount}</div>
                    </div>
                  </div>

                  {/* 子节点 */}
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>子模板 ({selectedChildren.length})</div>
                    {selectedChildren.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {selectedChildren.map(c => (
                          <div
                            key={c.id}
                            onClick={() => setSelectedId(c.id)}
                            style={{
                              padding: 6, background: '#ecfeff', border: '1px solid #a5f3fc',
                              borderRadius: 4, cursor: 'pointer', fontSize: 12,
                            }}
                          >
                            <div style={{ fontWeight: 600, color: '#0e7490', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <GitFork size={10} /> {c.name}
                            </div>
                            <div style={{ fontSize: 12, color: '#0891b2', marginTop: 1 }}>{c.version} · ×{c.usageCount}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: 8, fontSize: 12, color: '#94a3b8', textAlign: 'center', background: '#f8fafc', borderRadius: 6, border: '1px dashed #cbd5e1' }}>
                        暂无子模板
                      </div>
                    )}
                  </div>
                </div>

                {/* 兄弟节点 */}
                {selectedSiblings.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>
                      同级模板 ({selectedSiblings.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedSiblings.map(s => (
                        <div
                          key={s.id}
                          onClick={() => setSelectedId(s.id)}
                          style={{
                            padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1',
                            borderRadius: 4, cursor: 'pointer', fontSize: 12, color: '#475569',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          <GitBranch size={10} />
                          {s.name}
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>({s.version})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 使用统计 */}
                <div style={{ marginTop: 16, padding: 12, background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp size={12} /> 使用统计
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>本月使用</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{Math.floor(selectedNode.usageCount * 0.3)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>总使用</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{selectedNode.usageCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>创建者</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af' }}>{selectedNode.createdBy}</div>
                    </div>
                  </div>
                </div>

                {/* 版本历史（模拟） */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <History size={12} /> 版本历史
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', padding: 8 }}>
                    {[
                      { v: selectedNode.version, time: selectedNode.createdAt, author: selectedNode.createdBy, action: '当前版本' },
                      { v: 'v0.9', time: '...', author: '前一位作者', action: '历史' },
                    ].map((h, i) => (
                      <div key={i} style={{
                        padding: 6, marginBottom: 4, background: '#fff', borderRadius: 4,
                        border: '1px solid #e2e8f0', fontSize: 12,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <Tag size={11} color="#7c3aed" />
                        <strong style={{ color: '#1e40af' }}>{h.v}</strong>
                        <span style={{ color: '#94a3b8' }}>·</span>
                        <span style={{ color: '#475569' }}>{h.author}</span>
                        <span style={{ color: '#94a3b8' }}>·</span>
                        <span style={{ color: '#475569' }}>{h.time}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 12, padding: '1px 4px', background: i === 0 ? '#dbeafe' : '#f1f5f9', color: i === 0 ? '#1e40af' : '#64748b', borderRadius: 2 }}>{h.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
              请从左侧选择一个模板查看详情
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
    background: '#fff', padding: 12, borderRadius: 8,
    border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: `${color}15`, color: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{value}</div>
    </div>
  </div>
);
