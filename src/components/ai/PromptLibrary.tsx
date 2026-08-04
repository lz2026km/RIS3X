/**
 * G005 放射RIS系统 v3.0.6.5 - Prompt 模板库 UI
 * A5-AI-ORCH / 20 点
 */

import React, { useEffect, useState } from 'react';
import { Card, Input, Select, List, Tag, Space, Button, message, Modal, Tabs, Empty, Statistic, Row, Col, Rate, Drawer } from 'antd';
import { Search, FileText, Star, Copy, Eye, Play, Plus, BookOpen } from 'lucide-react';
import { promptLibrary } from '../../services/ai/prompts/PromptLibrary';
import { useStreamingAI } from '../../hooks/useStreamingAI';
import type { AIPromptTemplate } from '../../types/ai/orchestrator';

const { Search: AntSearch } = Input;
const { TextArea } = Input;

export const PromptLibraryView: React.FC = () => {
  const [templates, setTemplates] = useState<AIPromptTemplate[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string; count: number }[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [selected, setSelected] = useState<AIPromptTemplate | null>(null);
  const [renderVars, setRenderVars] = useState<Record<string, string>>({});
  const [testModal, setTestModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTpl, setNewTpl] = useState({
    name: '',
    category: '',
    description: '',
    systemPrompt: '',
    userPrompt: '',
    tags: '',
  });
  const streaming = useStreamingAI();

  useEffect(() => {
    void load();
  }, [search, category]);

  const load = async () => {
    const [list, cats] = await Promise.all([promptLibrary.list(category, search), promptLibrary.listCategories()]);
    setTemplates(list);
    setCategories(cats);
  };

  const handleRender = async () => {
    if (!selected) return;
    const result = await promptLibrary.render(selected.id, renderVars);
    if (result.missingVariables.length > 0) {
      message.warning(`缺少变量: ${result.missingVariables.join(', ')}`);
      return;
    }
    streaming.start(result.systemPrompt + '\n\n' + result.userPrompt);
    setTestModal(false);
    void promptLibrary.recordUsage(selected.id);
  };

  // 新建模板：保存到 Prompt 库（内存库，可复用 render/测试）
  const handleCreate = async () => {
    if (!newTpl.name.trim()) { message.warning('请输入模板名称'); return; }
    if (!newTpl.category.trim()) { message.warning('请选择分类'); return; }
    if (!newTpl.systemPrompt.trim() && !newTpl.userPrompt.trim()) { message.warning('请输入至少一段提示词'); return; }
    setSaving(true);
    try {
      const variables = Array.from(new Set([
        ...Array.from(newTpl.systemPrompt.matchAll(/\{(\w+)\}/g), (m) => m[1]!),
        ...Array.from(newTpl.userPrompt.matchAll(/\{(\w+)\}/g), (m) => m[1]!),
      ])).map((name) => ({ name, description: name, required: false }));
      const tpl = await promptLibrary.save({
        name: newTpl.name.trim(),
        category: newTpl.category.trim(),
        version: '1.0.0',
        description: newTpl.description.trim() || '自定义模板',
        systemPrompt: newTpl.systemPrompt.trim(),
        userPrompt: newTpl.userPrompt.trim(),
        variables,
        tags: newTpl.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        authorId: 'current-user',
        authorName: '当前用户',
      });
      setCreateModal(false);
      setNewTpl({ name: '', category: '', description: '', systemPrompt: '', userPrompt: '', tags: '' });
      await load();
      setSelected(tpl);
      message.success(`模板已创建: ${tpl.name}`);
    } catch {
      message.error('模板保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="prompt-library" style={{ padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <BookOpen size={24} color="#fbbf24" />
        <h2 style={{ margin: 0 }}>Prompt 模板库</h2>
        <Tag>{templates.length} 个模板</Tag>
        <Tag color="green">{categories.length} 分类</Tag>
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateModal(true)}>新建模板</Button>
      </div>

      <Row gutter={12}>
        <Col span={6}>
          <Card size="small" title="分类" style={{ background: '#1e293b', borderColor: '#334155' }}>
            <div
              onClick={() => setCategory(undefined)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                borderRadius: 4,
                background: !category ? '#3b82f6' : 'transparent',
                color: !category ? 'white' : '#cbd5e1',
                fontSize: 12,
                marginBottom: 2,
              }}
            >
              全部
            </div>
            {categories.map((c) => (
              <div
                key={c.id}
                onClick={() => setCategory(c.id)}
                style={{
                  padding: '6px 8px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  background: category === c.id ? '#3b82f6' : 'transparent',
                  color: category === c.id ? 'white' : '#cbd5e1',
                  fontSize: 12,
                  marginBottom: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{c.label}</span>
                <span style={{ color: '#94a3b8' }}>{c.count}</span>
              </div>
            ))}
          </Card>
        </Col>

        <Col span={18}>
          <div style={{ background: '#1e293b', padding: 12, borderRadius: 6, marginBottom: 12 }}>
            <Space>
              <AntSearch placeholder="搜索模板" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 240 }} allowClear />
            </Space>
          </div>
          {templates.length === 0 ? (
            <Empty description="未找到模板" />
          ) : (
            <List
              grid={{ gutter: 8, xs: 1, sm: 2, md: 2, lg: 3 }}
              dataSource={templates}
              renderItem={(t) => (
                <List.Item>
                  <Card
                    size="small"
                    hoverable
                    style={{ background: '#1e293b', borderColor: '#334155' }}
                    bodyStyle={{ padding: 12 }}
                    onClick={() => setSelected(t)}
                  >
                    <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
                      <FileText size={18} color="#3b82f6" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>v{t.version} · {t.usageCount}次</div>
                        <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4, height: 32, overflow: 'hidden' }}>{t.description}</div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {t.tags.slice(0, 3).map((tag) => <Tag key={tag} style={{ fontSize: 12 }}>{tag}</Tag>)}
                        </div>
                      </div>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          )}
        </Col>
      </Row>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        width={720}
        title={selected?.name}
        extra={
          selected && (
            <Space>
              <Button icon={<Play size={14} />} type="primary" onClick={() => setTestModal(true)}>测试</Button>
              <Button icon={<Copy size={14} />} onClick={() => navigator.clipboard?.writeText(selected.userPrompt).then(() => message.success('已复制'))}>复制</Button>
            </Space>
          )
        }
      >
        {selected && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <Tag color="blue">{selected.category}</Tag>
              <Tag>v{selected.version}</Tag>
              <Tag color="green">使用 {selected.usageCount}</Tag>
              <Rate disabled value={selected.avgRating} allowHalf style={{ fontSize: 12 }} />
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1' }}>{selected.description}</p>
            <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600 }}>系统提示</div>
            <pre style={{ background: '#020617', padding: 8, borderRadius: 4, fontSize: 12, color: '#cbd5e1', overflow: 'auto' }}>{selected.systemPrompt}</pre>
            <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600 }}>用户提示</div>
            <pre style={{ background: '#020617', padding: 8, borderRadius: 4, fontSize: 12, color: '#cbd5e1', overflow: 'auto' }}>{selected.userPrompt}</pre>
            <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600 }}>变量 ({selected.variables.length})</div>
            {selected.variables.map((v) => (
              <div key={v.name} style={{ padding: 4, fontSize: 12, color: '#94a3b8' }}>
                <code style={{ color: '#fbbf24' }}>{`{${v.name}}`}</code> — {v.description} {v.required && <Tag color="red" style={{ fontSize: 12 }}>必填</Tag>}
              </div>
            ))}
            {streaming.text && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>实时输出 {streaming.status === 'active' ? '●' : ''}</div>
                <pre style={{ background: '#020617', padding: 8, borderRadius: 4, fontSize: 12, color: '#10b981', maxHeight: 200, overflow: 'auto' }}>{streaming.text}</pre>
                {streaming.status === 'active' && <Button size="small" onClick={streaming.cancel}>停止</Button>}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        title="测试模板"
        open={testModal}
        onCancel={() => setTestModal(false)}
        onOk={handleRender}
        okText="渲染并运行"
        width={600}
      >
        {selected?.variables.map((v) => (
          <div key={v.name} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {`{${v.name}}`} {v.required && <span style={{ color: '#ef4444' }}>*</span>} — {v.description}
            </div>
            <Input value={renderVars[v.name] ?? ''} onChange={(e) => setRenderVars({ ...renderVars, [v.name]: e.target.value })} />
          </div>
        ))}
      </Modal>

      <Modal
        title="新建 Prompt 模板"
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        confirmLoading={saving}
        width={680}
      >
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>模板名称 *</div>
            <Input value={newTpl.name} onChange={(e) => setNewTpl({ ...newTpl, name: e.target.value })} placeholder="如：胸部CT报告助手" />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>分类 *</div>
            <Input value={newTpl.category} onChange={(e) => setNewTpl({ ...newTpl, category: e.target.value })} placeholder="如：report / triage / qc" />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>描述</div>
            <Input value={newTpl.description} onChange={(e) => setNewTpl({ ...newTpl, description: e.target.value })} placeholder="模板用途说明" />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>系统提示</div>
            <TextArea rows={4} value={newTpl.systemPrompt} onChange={(e) => setNewTpl({ ...newTpl, systemPrompt: e.target.value })} placeholder="系统角色设定，支持 {变量}" style={{ background: '#020617', color: '#e2e8f0' }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>用户提示</div>
            <TextArea rows={4} value={newTpl.userPrompt} onChange={(e) => setNewTpl({ ...newTpl, userPrompt: e.target.value })} placeholder="用户提示词，支持 {变量}" style={{ background: '#020617', color: '#e2e8f0' }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>标签（逗号分隔）</div>
            <Input value={newTpl.tags} onChange={(e) => setNewTpl({ ...newTpl, tags: e.target.value })} placeholder="如：CT,报告,结构化" />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PromptLibraryView;
