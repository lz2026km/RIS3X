/**
 * G005 放射RIS系统 v3.0.5.1 - 报告批注便签
 * R3.OTHER 组:便签式批注(Sticky Notes)
 * 10 升级点
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Card, Space, Button, Tag, Tooltip, message, Modal, Form, Input, Select, Switch, ColorPicker,
  Empty, Dropdown, InputNumber, Statistic, Row, Col, Divider,
} from 'antd';
import {
  StickyNote, Plus, Trash2, Edit3, Eye, EyeOff, Pin, PinOff, ChevronDown, Highlighter,
  MessageCircle, Reply, CheckCircle2, Clock, User, AtSign, Smile, Send, X,
} from 'lucide-react';

export type NoteStatus = 'open' | 'resolved' | 'archived';
export type NotePriority = 'low' | 'normal' | 'high' | 'critical';

export interface ReportNote {
  id: string;
  reportId: string;
  page: number;
  position: { x: number; y: number };
  content: string;
  contentEn: string;
  color: string;
  status: NoteStatus;
  priority: NotePriority;
  author: string;
  authorId: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  pinned: boolean;
  replies: NoteReply[];
  reactions: { emoji: string; count: number; users: string[] }[];
  mentions: string[];
  visibility: 'private' | 'team' | 'department' | 'all';
  tags: string[];
}

export interface NoteReply {
  id: string;
  author: string;
  authorId: string;
  content: string;
  createdAt: string;
}

const NOTE_COLORS = [
  { value: '#fef3c7', label: '黄色' },
  { value: '#dbeafe', label: '蓝色' },
  { value: '#d1fae5', label: '绿色' },
  { value: '#fee2e2', label: '红色' },
  { value: '#ede9fe', label: '紫色' },
  { value: '#fed7aa', label: '橙色' },
];

const SEED_NOTES: ReportNote[] = [
  { id: 'n-1', reportId: 'rpt-038', page: 1, position: { x: 25, y: 30 }, content: '请补充"短毛刺征"的细节描述,可能与"分叶征"鉴别。', contentEn: 'Please add details about spiculation sign.', color: '#fef3c7', status: 'open', priority: 'normal', author: '王主任', authorId: 'u-002', authorRole: '主任医师', createdAt: '2026-09-15T10:30:00Z', updatedAt: '2026-09-15T10:30:00Z', pinned: true, replies: [{ id: 'r-1', author: '陈医师', authorId: 'u-001', content: '好的,马上补充', createdAt: '2026-09-15T10:35:00Z' }], reactions: [{ emoji: '👍', count: 1, users: ['u-001'] }], mentions: ['@陈医师'], visibility: 'team', tags: ['描述', '毛刺'] },
  { id: 'n-2', reportId: 'rpt-038', page: 1, position: { x: 60, y: 50 }, content: '建议添加病灶体积,便于术后随访。', contentEn: 'Recommend adding lesion volume for follow-up.', color: '#dbeafe', status: 'open', priority: 'low', author: '李医生', authorId: 'u-003', authorRole: '主治医师', createdAt: '2026-09-15T10:40:00Z', updatedAt: '2026-09-15T10:40:00Z', pinned: false, replies: [], reactions: [], mentions: [], visibility: 'team', tags: ['建议'] },
  { id: 'n-3', reportId: 'rpt-038', page: 1, position: { x: 40, y: 70 }, content: '⚠️ 危急值!请立即通知临床!', contentEn: '⚠️ CRITICAL VALUE!', color: '#fee2e2', status: 'open', priority: 'critical', author: '系统', authorId: 'sys', authorRole: '系统', createdAt: '2026-09-15T10:45:00Z', updatedAt: '2026-09-15T10:45:00Z', pinned: true, replies: [], reactions: [], mentions: ['@全体医生'], visibility: 'all', tags: ['危急值'] },
];

interface Props {
  reportId: string;
  onAdd?: (note: ReportNote) => void;
  readOnly?: boolean;
}

export const ReportAnnotation: React.FC<Props> = ({ reportId, onAdd, readOnly = false }) => {
  const [notes, setNotes] = useState<ReportNote[]>(SEED_NOTES);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [filterPriority, setFilterPriority] = useState<NotePriority | 'all'>('all');
  const [replyText, setReplyText] = useState('');
  const [addForm, setAddForm] = useState<Partial<ReportNote>>({
    content: '', color: '#fef3c7', priority: 'normal', visibility: 'team', tags: [],
  });

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (!showResolved && n.status === 'resolved') return false;
      if (filterPriority !== 'all' && n.priority !== filterPriority) return false;
      if (n.reportId !== reportId) return false;
      return true;
    });
  }, [notes, showResolved, filterPriority, reportId]);

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);

  const handleAdd = useCallback(() => {
    if (!addForm.content?.trim()) { message.warning('请填写便签内容'); return; }
    const note: ReportNote = {
      id: `n-${Date.now()}`,
      reportId, page: 1, position: { x: Math.random() * 80 + 10, y: Math.random() * 70 + 20 },
      content: addForm.content, contentEn: addForm.contentEn ?? '',
      color: addForm.color ?? '#fef3c7', status: 'open', priority: addForm.priority as NotePriority ?? 'normal',
      author: '陈医师', authorId: 'u-001', authorRole: '主治医师',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      pinned: false, replies: [], reactions: [], mentions: [],
      visibility: addForm.visibility as ReportNote['visibility'] ?? 'team', tags: addForm.tags ?? [],
    };
    setNotes((arr) => [note, ...arr]);
    onAdd?.(note);
    setShowAdd(false);
    setAddForm({ content: '', color: '#fef3c7', priority: 'normal', visibility: 'team', tags: [] });
    message.success('便签已添加');
  }, [addForm, reportId, onAdd]);

  const handleResolve = useCallback((id: string) => {
    setNotes((arr) => arr.map((n) => n.id === id ? { ...n, status: 'resolved' as const, resolvedAt: new Date().toISOString(), resolvedBy: '陈医师' } : n));
    message.success('已解决');
  }, []);

  const handlePin = useCallback((id: string) => {
    setNotes((arr) => arr.map((n) => n.id === id ? { ...n, pinned: !n.pinned } : n));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setNotes((arr) => arr.filter((n) => n.id !== id));
    setSelectedId(null);
  }, []);

  const handleReply = useCallback(() => {
    if (!selected || !replyText.trim()) return;
    const reply: NoteReply = { id: `r-${Date.now()}`, author: '陈医师', authorId: 'u-001', content: replyText, createdAt: new Date().toISOString() };
    setNotes((arr) => arr.map((n) => n.id === selected.id ? { ...n, replies: [...n.replies, reply] } : n));
    setReplyText('');
  }, [selected, replyText]);

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={6}><Card size="small"><Statistic title="总便签" value={notes.length} prefix={<StickyNote className="w-3 h-3" style={{ color: '#f59e0b' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="待处理" value={notes.filter((n) => n.status === 'open').length} prefix={<Clock className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已解决" value={notes.filter((n) => n.status === 'resolved').length} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="已置顶" value={notes.filter((n) => n.pinned).length} prefix={<Pin className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
      </Row>

      <div className="grid grid-cols-3 gap-3">
        {/* 便签列表面板 */}
        <Card size="small" className="shadow-sm col-span-2" title={
          <div className="flex items-center justify-between">
            <Space><StickyNote className="w-4 h-4" /><span>便签列表</span></Space>
            <Space>
              <Select size="small" value={filterPriority} onChange={setFilterPriority} style={{ width: 100 }} options={[
                { value: 'all', label: '全部' },
                { value: 'critical', label: '危急' },
                { value: 'high', label: '高' },
                { value: 'normal', label: '普通' },
                { value: 'low', label: '低' },
              ]} />
              <Switch size="small" checked={showResolved} onChange={setShowResolved} checkedChildren="显示已解决" unCheckedChildren="隐藏" />
              <Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowAdd(true)} disabled={readOnly}>添加便签</Button>
            </Space>
          </div>
        }>
          {filtered.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {filtered.map((n) => (
                <div
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  className={`relative p-3 rounded-lg shadow-sm cursor-pointer transition hover:shadow-md ${selectedId === n.id ? 'ring-2 ring-blue-500' : ''}`}
                  style={{ background: n.color, transform: n.pinned ? 'rotate(-1deg)' : 'none' }}
                >
                  {n.pinned && <Pin className="w-3 h-3 absolute top-1 right-1 text-red-500" />}
                  {n.priority === 'critical' && <div className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded">危急</div>}

                  <div className="flex items-center gap-1 mb-1 text-[10px] text-slate-600">
                    <User className="w-3 h-3" />
                    <span className="font-semibold">{n.author}</span>
                    <span>·</span>
                    <span>{n.authorRole}</span>
                  </div>

                  <div className="text-sm text-slate-800 line-clamp-3">{n.content}</div>

                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1">
                      {n.status === 'resolved' ? <Tag color="green" className="text-[10px] m-0">已解决</Tag> : <Tag color="blue" className="text-[10px] m-0">待处理</Tag>}
                      <span>{new Date(n.createdAt).toLocaleTimeString()}</span>
                    </div>
                    {n.replies.length > 0 && <div className="flex items-center gap-0.5"><Reply className="w-3 h-3" />{n.replies.length}</div>}
                  </div>

                  {n.mentions.length > 0 && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600">
                      <AtSign className="w-3 h-3" />{n.mentions.join(' ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty description="暂无便签" />
          )}
        </Card>

        {/* 详情/回复面板 */}
        <Card size="small" className="shadow-sm" title={
          <Space><MessageCircle className="w-4 h-4" /><span>便签详情</span></Space>
        }>
          {selected ? (
            <div className="space-y-3">
              <div className="p-2 rounded" style={{ background: selected.color }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold">{selected.author} · {selected.authorRole}</div>
                  <Tag color={selected.status === 'resolved' ? 'green' : 'blue'}>{selected.status === 'resolved' ? '已解决' : '待处理'}</Tag>
                </div>
                <div className="text-sm">{selected.content}</div>
                {selected.contentEn && <div className="text-xs text-slate-500 italic mt-1">{selected.contentEn}</div>}
                <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                  <Clock className="w-3 h-3" />{new Date(selected.createdAt).toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold mb-1">回复 ({selected.replies.length})</div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selected.replies.map((r) => (
                    <div key={r.id} className="p-2 bg-slate-50 rounded text-xs">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-semibold">{r.author}</span>
                        <span className="text-slate-400 text-[10px]">{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                      <div>{r.content}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Input.TextArea
                  rows={2}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="输入回复..."
                  disabled={readOnly}
                />
                <Button type="primary" size="small" icon={<Send className="w-3 h-3" />} onClick={handleReply} disabled={!replyText.trim() || readOnly} className="mt-1">回复</Button>
              </div>

              <Divider className="my-2" />

              <div className="flex flex-col gap-1">
                {selected.status === 'open' && <Button icon={<CheckCircle2 className="w-3 h-3" />} onClick={() => handleResolve(selected.id)}>标记已解决</Button>}
                <Button icon={selected.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />} onClick={() => handlePin(selected.id)}>{selected.pinned ? '取消置顶' : '置顶'}</Button>
                <Button danger icon={<Trash2 className="w-3 h-3" />} onClick={() => handleDelete(selected.id)}>删除便签</Button>
              </div>
            </div>
          ) : <Empty description="请选择便签" />}
        </Card>
      </div>

      <Modal title={<Space><Plus className="w-4 h-4" /><span>添加便签</span></Space>} open={showAdd} onCancel={() => setShowAdd(false)} footer={null}>
        <Form layout="vertical">
          <Form.Item label="内容"><Input.TextArea rows={3} value={addForm.content} onChange={(e) => setAddForm((f) => ({ ...f, content: e.target.value }))} placeholder="写下你的批注..." /></Form.Item>
          <Form.Item label="颜色">
            <Select value={addForm.color} onChange={(v) => setAddForm((f) => ({ ...f, color: v }))} options={NOTE_COLORS.map((c) => ({ value: c.value, label: <Tag color={c.value}>{c.label}</Tag> }))} />
          </Form.Item>
          <Form.Item label="优先级">
            <Select value={addForm.priority} onChange={(v) => setAddForm((f) => ({ ...f, priority: v as NotePriority }))} options={[
              { value: 'low', label: '低' }, { value: 'normal', label: '普通' }, { value: 'high', label: '高' }, { value: 'critical', label: '危急' },
            ]} />
          </Form.Item>
          <Form.Item label="可见性">
            <Select value={addForm.visibility} onChange={(v) => setAddForm((f) => ({ ...f, visibility: v as ReportNote['visibility'] }))} options={[
              { value: 'private', label: '仅自己' }, { value: 'team', label: '团队' }, { value: 'department', label: '科室' }, { value: 'all', label: '全部' },
            ]} />
          </Form.Item>
        </Form>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setShowAdd(false)}>取消</Button>
          <Button type="primary" onClick={handleAdd}>添加</Button>
        </div>
      </Modal>
    </div>
  );
};

export default ReportAnnotation;
