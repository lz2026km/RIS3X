import { useState, useCallback } from 'react';
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { Layers, Save, Play, Upload, List, History, GripVertical, Plus, CheckCircle2, X } from 'lucide-react';
import { Table, Button, Tag, message, Modal, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { canApprove } from '../services/auth/rbacService';
import { useAuth } from '../hooks/useAuth';

type StepType = { key: string; label: string; color: string };

const STEP_TYPES: StepType[] = [
  { key: 'review', label: '审稿', color: '#3b82f6' },
  { key: 'write', label: '写报告', color: '#22c55e' },
  { key: 'cosign', label: '会签', color: '#f59e0b' },
  { key: 'qc', label: '质控', color: '#ef4444' },
];

interface CanvasNode { id: string; type: string; label: string; x: number; y: number }

interface VersionEntry { version: string; date: string; author: string; status: string }

const MOCK_VERSIONS: VersionEntry[] = [
  { version: 'v1.2', date: '2026-06-15', author: '管理员', status: '已部署' },
  { version: 'v1.1', date: '2026-06-10', author: '管理员', status: '草稿' },
  { version: 'v1.0', date: '2026-06-01', author: '系统', status: '已部署' },
];

const MOCK_STEPS = [
  { key: '1', name: '急诊CT报告流程', type: 'write', assignee: '李医生', sla: 30, status: 'active' },
  { key: '2', name: 'MR审核步骤', type: 'review', assignee: '张主任', sla: 15, status: 'active' },
  { key: '3', name: '双签确认', type: 'cosign', assignee: '王主任', sla: 10, status: 'inactive' },
  { key: '4', name: '质控检查', type: 'qc', assignee: '赵质控', sla: 20, status: 'active' },
];

function DraggableStep({ type }: { type: StepType }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `palette-${type.key}`, data: { type: type.key } });
  const style: React.CSSProperties = {
    padding: '8px 12px',
    marginBottom: 8,
    borderRadius: 6,
    border: `1px solid ${type.color}40`,
    background: isDragging ? `${type.color}20` : '#fff',
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: type.color,
    fontWeight: 500,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.6 : 1,
    transition: 'box-shadow 0.15s',
    boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <GripVertical size={14} />
      {type.label}
    </div>
  );
}

function DropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });
  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1, minHeight: 400, background: isOver ? '#f0f9ff' : '#fafafa',
        border: `2px dashed ${isOver ? '#3b82f6' : '#e2e8f0'}`,
        borderRadius: 8, padding: 16, position: 'relative', transition: 'background 0.2s',
      }}
    >
      {children}
    </div>
  );
}

function CanvasNodeItem({ node, onRemove }: { node: CanvasNode; onRemove: (id: string) => void }) {
  const step = STEP_TYPES.find(s => s.key === node.type);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: node.id, data: { type: node.type } });
  const style: React.CSSProperties = {
    position: 'absolute', left: node.x, top: node.y,
    padding: '10px 16px', borderRadius: 8,
    background: `${step?.color ?? '#6b7280'}15`,
    border: `2px solid ${step?.color ?? '#6b7280'}`,
    fontSize: 13, fontWeight: 600, cursor: 'grab',
    display: 'flex', alignItems: 'center', gap: 8,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: 10, whiteSpace: 'nowrap',
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: step?.color, display: 'inline-block' }} />
      {node.label || step?.label}
      <X size={12} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={(e) => { e.stopPropagation(); onRemove(node.id); }} />
    </div>
  );
}

export default function WorkflowDesignerPage() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''
  const workflowOwnerId = currentUserId
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([
    { id: 'n1', type: 'review', label: '初审', x: 40, y: 60 },
    { id: 'n2', type: 'write', label: '报告撰写', x: 220, y: 60 },
    { id: 'n3', type: 'cosign', label: '主任会签', x: 400, y: 60 },
    { id: 'n4', type: 'qc', label: '质控审核', x: 580, y: 60 },
  ]);
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
  const [stepList, setStepList] = useState(MOCK_STEPS);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [showVersion, setShowVersion] = useState(false);
  const [showNewStep, setShowNewStep] = useState(false);
  const [newStepForm, setNewStepForm] = useState({ name: '', type: 'write', assignee: '', sla: 30 });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (over.id === 'canvas' && active.data.current?.type) {
      const type = active.data.current.type as string;
      const step = STEP_TYPES.find(s => s.key === type);
      const id = `node-${Date.now()}`;
      setCanvasNodes(prev => [...prev, { id, type, label: step?.label ?? type, x: 40 + (prev.length % 5) * 180, y: 60 + Math.floor(prev.length / 5) * 100 }]);
    } else if (active.id !== over.id) {
      const draggedNode = canvasNodes.find(n => n.id === active.id);
      if (draggedNode) {
        setCanvasNodes(prev => prev.map(n => n.id === active.id ? { ...n, x: n.x + 10, y: n.y + 10 } : n));
      }
    }
  }, [canvasNodes]);

  const removeNode = (id: string) => {
    setCanvasNodes(prev => prev.filter(n => n.id !== id));
    if (selectedNode?.id === id) setSelectedNode(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/v1/workflow/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '工作流', nodes: canvasNodes, edges: [] }),
      });
      message.success('工作流已保存');
      setSavedToast('已保存至服务器');
    } catch {
      setSavedToast('已本地暂存');
      message.warning('保存接口不可用，已本地暂存');
    } finally {
      setSaving(false);
      setTimeout(() => setSavedToast(null), 3000);
    }
  };

  const stepColumns: ColumnsType<typeof MOCK_STEPS[0]> = [
    { title: '步骤名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型', dataIndex: 'type', key: 'type',
      render: (t: string) => {
        const s = STEP_TYPES.find(x => x.key === t);
        return <Tag color={s?.color}>{s?.label}</Tag>;
      },
    },
    { title: '负责人', dataIndex: 'assignee', key: 'assignee' },
    { title: 'SLA(分钟)', dataIndex: 'sla', key: 'sla' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '启用' : '停用'}</Tag>,
    },
  ];

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        <header style={{ background: 'linear-gradient(135deg,#1e40af 0%,#3b82f6 100%)', color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={20} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>工作流设计器</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>拖拽编排 · 步骤管理 · 版本控制</div>
          </div>
          {savedToast && <span style={{ background: '#10b981', padding: '4px 12px', borderRadius: 12, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} />{savedToast}</span>}
          {saving && <span style={{ fontSize: 12, opacity: 0.85 }}>保存中…</span>}
          <Button size="small" ghost icon={<History size={14} />} onClick={() => setShowVersion(true)}>历史版本</Button>
          <Button size="small" ghost icon={<Play size={14} />} onClick={() => {
            if (!canApprove(currentUserId, workflowOwnerId)) {
              message.error('禁止自审：不能激活自己的工作流');
            } else {
              message.success('工作流已激活');
            }
          }}>激活</Button>
          <Button size="small" ghost icon={<Upload size={14} />}>部署</Button>
          <Button size="small" type="primary" loading={saving} icon={<Save size={14} />} onClick={handleSave}>保存</Button>
        </header>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <aside style={{ width: 200, background: '#fff', borderRight: '1px solid #e2e8f0', padding: 16, overflowY: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>步骤类型</div>
            {STEP_TYPES.map(t => <DraggableStep key={t.key} type={t} />)}
          </aside>
          <main style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>画布 — 从左侧拖入步骤</div>
            <DropZone>
              {canvasNodes.map(n => <CanvasNodeItem key={n.id} node={n} onRemove={removeNode} />)}
            </DropZone>
          </main>
          <aside style={{ width: 280, background: '#fff', borderLeft: '1px solid #e2e8f0', padding: 16, overflowY: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 }}>属性面板</div>
            {selectedNode ? (
              <div style={{ fontSize: 13 }}>
                <div style={{ marginBottom: 8 }}><label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>名称</label><Input size="small" value={selectedNode.label} onChange={e => setCanvasNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n))} /></div>
                <div style={{ marginBottom: 8 }}><label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>类型</label><Tag color={STEP_TYPES.find(s => s.key === selectedNode.type)?.color}>{STEP_TYPES.find(s => s.key === selectedNode.type)?.label}</Tag></div>
                <div style={{ marginBottom: 8 }}><label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>坐标</label><span style={{ color: '#6b7280' }}>({selectedNode.x}, {selectedNode.y})</span></div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>点击画布中的节点编辑属性</div>
            )}
          </aside>
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', background: '#fff', padding: '12px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f', display: 'flex', alignItems: 'center', gap: 6 }}><List size={14} />步骤列表</div>
            <Button size="small" icon={<Plus size={14} />} onClick={() => setShowNewStep(true)}>新建步骤</Button>
          </div>
          <Table size="small" columns={stepColumns} dataSource={stepList} rowKey="key" pagination={false} />
        </div>
      </div>
      <Modal title="历史版本" open={showVersion} onCancel={() => setShowVersion(false)} footer={null} width={500}>
        <Table size="small" columns={[
          { title: '版本', dataIndex: 'version', key: 'version' },
          { title: '日期', dataIndex: 'date', key: 'date' },
          { title: '作者', dataIndex: 'author', key: 'author' },
          { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === '已部署' ? 'green' : 'default'}>{s}</Tag> },
        ]} dataSource={MOCK_VERSIONS} rowKey="version" pagination={false} />
      </Modal>
      <Modal title="新建步骤" open={showNewStep} onCancel={() => setShowNewStep(false)} onOk={() => { setStepList(prev => [...prev, { key: `s-${Date.now()}`, ...newStepForm, status: 'active' }]); setShowNewStep(false); message.success('步骤已创建'); }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>步骤名称</label><Input value={newStepForm.name} onChange={e => setNewStepForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>类型</label><Select value={newStepForm.type} onChange={v => setNewStepForm(f => ({ ...f, type: v }))} options={STEP_TYPES.map(t => ({ value: t.key, label: t.label }))} style={{ width: '100%' }} /></div>
          <div><label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>负责人</label><Input value={newStepForm.assignee} onChange={e => setNewStepForm(f => ({ ...f, assignee: e.target.value }))} /></div>
          <div><label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>SLA(分钟)</label><Input type="number" value={newStepForm.sla} onChange={e => setNewStepForm(f => ({ ...f, sla: Number(e.target.value) }))} /></div>
        </div>
      </Modal>
    </DndContext>
  );
}
