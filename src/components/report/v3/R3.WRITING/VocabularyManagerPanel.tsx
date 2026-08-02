/**
 * G005 放射RIS系统 v3.0.6.5 - 自定义词汇面板
 * 20 升级点:词典管理 / 术语增删 / 权重调节
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Tag, Space, Button, Input, Select, Tooltip, List, Empty, Modal, Form, Switch, InputNumber, message, Row, Col, Statistic, Tabs, Divider, Popconfirm } from 'antd';
import { Plus, Search, BookOpen, Trash2, Edit3, Star, TrendingUp, Download, Upload, Library, Save, X } from 'lucide-react';
import { vocabularyManager } from '../../../services/voice/VocabularyManager';
import { VOCABULARY_CATEGORIES } from '../../../data/voice/medicalVocabulary';
import type { MedicalTerm, VocabCategory, CustomDictionary } from '../../../types/voice';

interface Props {
  onSelect?: (term: MedicalTerm) => void;
  filterModality?: string;
}

const CATEGORY_OPTIONS: { value: VocabCategory; label: string }[] = [
  { value: 'anatomy', label: '解剖结构' },
  { value: 'finding', label: '影像所见' },
  { value: 'diagnosis', label: '诊断术语' },
  { value: 'measurement', label: '测量单位' },
  { value: 'medication', label: '药物' },
  { value: 'procedure', label: '操作流程' },
  { value: 'modality', label: '扫描序列' },
  { value: 'modifier', label: '修饰词' },
  { value: 'custom', label: '自定义' },
];

export const VocabularyManagerPanel: React.FC<Props> = ({ onSelect, filterModality }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<VocabCategory | 'all'>('all');
  const [showCreateDict, setShowCreateDict] = useState(false);
  const [showAddTerm, setShowAddTerm] = useState(false);
  const [activeDict, setActiveDict] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [termForm] = Form.useForm();

  const refreshKey = useState(0)[1];
  const forceRefresh = useCallback(() => refreshKey((k) => k + 1), [refreshKey]);

  const allTerms = useMemo(() => vocabularyManager.getAllTerms(), [refreshKey]);
  const dictionaries = useMemo(() => vocabularyManager.listDictionaries(), [refreshKey]);
  const stats = useMemo(() => vocabularyManager.getStats(), [refreshKey]);

  const filtered = useMemo(() => {
    if (query) {
      return vocabularyManager.search(query, 50);
    }
    let result = allTerms;
    if (category !== 'all') result = result.filter((t: MedicalTerm) => t.category === category);
    if (filterModality) result = result.filter((t: MedicalTerm) => t.modality.includes(filterModality as never));
    return result;
  }, [query, category, allTerms, filterModality, refreshKey]);

  const handleCreateDict = useCallback(async () => {
    const v = await form.validateFields();
    vocabularyManager.createDictionary({
      name: v.name,
      description: v.description,
      scope: v.scope,
      ownerId: 'current-user',
      active: true,
    });
    message.success('词典创建成功');
    form.resetFields();
    setShowCreateDict(false);
    forceRefresh();
  }, [form, forceRefresh]);

  const handleAddTerm = useCallback(async () => {
    if (!activeDict) {
      message.warning('请先选择词典');
      return;
    }
    const v = await termForm.validateFields();
    const t = vocabularyManager.addTermToDictionary(activeDict, {
      term: v.term,
      fullTerm: v.fullTerm ?? v.term,
      pinyin: v.pinyin,
      pinyinInitials: v.pinyinInitials,
      en: v.en,
      category: v.category,
      modality: v.modality ?? [],
      bodyPart: v.bodyPart ?? [],
      synonyms: v.synonyms ? v.synonyms.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      weight: v.weight ?? 50,
      enabled: true,
      source: 'user',
      createdBy: 'current-user',
    });
    if (t) {
      message.success('术语添加成功');
      termForm.resetFields();
      setShowAddTerm(false);
      forceRefresh();
    }
  }, [activeDict, termForm, forceRefresh]);

  const handleDeleteDict = useCallback((id: string) => {
    vocabularyManager.deleteDictionary(id);
    if (activeDict === id) setActiveDict(null);
    message.success('已删除');
    forceRefresh();
  }, [activeDict, forceRefresh]);

  const handleBoost = useCallback((termId: string, delta: number) => {
    vocabularyManager.boostTerm(termId, delta);
    forceRefresh();
  }, [forceRefresh]);

  const handleExport = useCallback(() => {
    const json = vocabularyManager.export();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocab-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('已导出');
  }, []);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const r = vocabularyManager.import(reader.result as string);
        message.success(`导入完成: 新增 ${r.added} 个词典, 更新 ${r.updated} 个`);
        forceRefresh();
      };
      reader.readAsText(file);
    };
    input.click();
  }, [forceRefresh]);

  return (
    <Card
      size="small"
      title={
        <Space>
          <BookOpen className="w-4 h-4" style={{ color: '#0891b2' }} />
          <span className="font-semibold">医学词汇管理</span>
          <Tag color="cyan">{stats.total} 个术语</Tag>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="导出">
            <Button size="small" icon={<Download className="w-3 h-3" />} onClick={handleExport} />
          </Tooltip>
          <Tooltip title="导入">
            <Button size="small" icon={<Upload className="w-3 h-3" />} onClick={handleImport} />
          </Tooltip>
          <Button size="small" type="primary" icon={<Plus className="w-3 h-3" />} onClick={() => setShowCreateDict(true)}>
            新建词典
          </Button>
        </Space>
      }
      className="shadow-sm"
    >
      <Row gutter={8} className="mb-3">
        <Col span={6}><Statistic title="总术语" value={stats.total} styles={{ content: {  fontSize: 14  } }} /></Col>
        <Col span={6}><Statistic title="词典数" value={dictionaries.length} styles={{ content: {  fontSize: 14  } }} /></Col>
        <Col span={6}><Statistic title="分类" value={VOCABULARY_CATEGORIES.length} styles={{ content: {  fontSize: 14  } }} /></Col>
        <Col span={6}><Statistic title="高权重" value={allTerms.filter((t: MedicalTerm) => t.weight >= 90).length} styles={{ content: {  fontSize: 14, color: '#f59e0b'  } }} /></Col>
      </Row>

      <Tabs
        size="small"
        items={[
          {
            key: 'terms',
            label: '术语库',
            children: (
              <>
                <Space.Compact style={{ width: '100%' }} className="mb-2">
                  <Input
                    prefix={<Search className="w-3 h-3 text-slate-400" />}
                    placeholder="搜索术语 / 拼音 / 英文..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    allowClear
                  />
                  <Select
                    value={category}
                    onChange={setCategory}
                    style={{ minWidth: 120 }}
                    options={[{ value: 'all', label: '全部分类' }, ...CATEGORY_OPTIONS]}
                  />
                </Space.Compact>
                <div className="max-h-72 overflow-y-auto">
                  <List
                    size="small"
                    dataSource={filtered}
                    renderItem={(term) => (
                      <List.Item
                        className="hover:bg-slate-50 rounded px-2"
                        actions={[
                          term.weight >= 90 ? <Star key="star" className="w-3 h-3 text-amber-500" /> : null,
                          <Button key="up" size="small" type="text" icon={<TrendingUp className="w-3 h-3" />} onClick={() => handleBoost(term.id, 5)} />,
                          onSelect ? <Button key="pick" size="small" type="text" onClick={() => onSelect(term)}>选用</Button> : null,
                        ].filter(Boolean) as React.ReactNode[]}
                      >
                        <List.Item.Meta
                          title={
                            <Space wrap size={4}>
                              <span className="text-sm font-semibold text-slate-700">{term.term}</span>
                              {term.fullTerm !== term.term && <span className="text-[10px] text-slate-500">→ {term.fullTerm}</span>}
                              <Tag className="text-[10px]">{term.category}</Tag>
                              {term.pinyin && <span className="text-[10px] text-slate-400">[{term.pinyin}]</span>}
                              {term.en && <span className="text-[10px] text-blue-400">EN: {term.en}</span>}
                            </Space>
                          }
                          description={
                            <Space wrap size={2}>
                              {term.modality.map((m: string) => <Tag key={m} color="blue" className="text-[10px]">{m}</Tag>)}
                              <Tag color="default" className="text-[10px]">权重 {term.weight}</Tag>
                              {term.usageCount > 0 && <Tag color="cyan" className="text-[10px]">已用 {term.usageCount}</Tag>}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                  {filtered.length === 0 && <Empty description="无匹配术语" />}
                </div>
              </>
            ),
          },
          {
            key: 'dicts',
            label: `自定义词典 (${dictionaries.length})`,
            children: (
              <>
                {activeDict ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Space>
                        <Library className="w-4 h-4 text-cyan-600" />
                        <span className="text-sm font-semibold">{vocabularyManager.getDictionary(activeDict)?.name}</span>
                        <Tag>{vocabularyManager.getDictionary(activeDict)?.scope}</Tag>
                      </Space>
                      <Space>
                        <Button size="small" icon={<Plus className="w-3 h-3" />} onClick={() => setShowAddTerm(true)}>添加术语</Button>
                        <Button size="small" onClick={() => setActiveDict(null)}>返回</Button>
                      </Space>
                    </div>
                    <List
                      size="small"
                      dataSource={vocabularyManager.getDictionary(activeDict)?.terms ?? []}
                      renderItem={(t) => (
                        <List.Item
                          actions={[
                            <Button key="del" size="small" danger icon={<Trash2 className="w-3 h-3" />} onClick={() => { vocabularyManager.removeTermFromDictionary(activeDict, t.id); forceRefresh(); }} />,
                          ]}
                        >
                          <span className="text-sm">{t.term}</span>
                          {t.pinyin && <span className="text-[10px] text-slate-400 ml-1">[{t.pinyin}]</span>}
                          <Tag className="ml-2 text-[10px]">{t.category}</Tag>
                        </List.Item>
                      )}
                    />
                  </div>
                ) : (
                  <List
                    size="small"
                    dataSource={dictionaries}
                    locale={{ emptyText: <Empty description="暂无自定义词典,点击右上角创建" /> }}
                    renderItem={(d) => (
                      <List.Item
                        actions={[
                          <Switch key="active" size="small" checked={d.active} onChange={(v) => { vocabularyManager.updateDictionary(d.id, { active: v }); forceRefresh(); }} />,
                          <Button key="open" size="small" type="primary" onClick={() => setActiveDict(d.id)}>打开</Button>,
                          <Popconfirm key="del" title="确定删除该词典?" onConfirm={() => handleDeleteDict(d.id)}>
                            <Button size="small" danger icon={<Trash2 className="w-3 h-3" />} />
                          </Popconfirm>,
                        ]}
                      >
                        <List.Item.Meta
                          title={<span className="text-sm font-semibold">{d.name}</span>}
                          description={
                            <Space wrap>
                              <Tag>{d.scope}</Tag>
                              <Tag color="cyan">{d.terms.length} 个术语</Tag>
                              <span className="text-[10px] text-slate-400">更新于 {new Date(d.updatedAt).toLocaleDateString()}</span>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </>
            ),
          },
        ]}
      />

      {/* 新建词典 */}
      <Modal title="新建词典" open={showCreateDict} onCancel={() => setShowCreateDict(false)} onOk={handleCreateDict} okText="创建" cancelText="取消">
        <Form form={form} layout="vertical" size="small" initialValues={{ scope: 'user' }}>
          <Form.Item label="词典名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如: 本院胸组术语" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="作用域" name="scope" rules={[{ required: true }]}>
            <Select options={[
              { value: 'user', label: '个人' },
              { value: 'department', label: '科室' },
              { value: 'hospital', label: '全院' },
              { value: 'tenant', label: '租户' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加术语 */}
      <Modal title="添加术语" open={showAddTerm} onCancel={() => setShowAddTerm(false)} onOk={handleAddTerm} okText="添加" cancelText="取消">
        <Form form={termForm} layout="vertical" size="small" initialValues={{ category: 'custom', weight: 50 }}>
          <Form.Item label="简称" name="term" rules={[{ required: true, message: '请输入简称' }]}>
            <Input placeholder="例如: 结节" />
          </Form.Item>
          <Form.Item label="完整术语" name="fullTerm">
            <Input placeholder="例如: 肺结节" />
          </Form.Item>
          <Form.Item label="拼音" name="pinyin">
            <Input placeholder="例如: jie jie" />
          </Form.Item>
          <Form.Item label="拼音首字母" name="pinyinInitials">
            <Input placeholder="例如: jj" />
          </Form.Item>
          <Form.Item label="英文" name="en">
            <Input placeholder="例如: nodule" />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item label="别名(逗号分隔)" name="synonyms">
            <Input placeholder="例如: 结, 节结" />
          </Form.Item>
          <Form.Item label="权重" name="weight">
            <InputNumber min={0} max={200} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default VocabularyManagerPanel;
