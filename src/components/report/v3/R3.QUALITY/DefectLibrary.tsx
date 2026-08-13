/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.101-135 DefectLibrary 缺陷库
 *
 * 20 点: 缺陷分类 / 缺陷模板 / 缺陷记录 / 缺陷统计 / 严重度分级
 */
import { DEFECT_CATEGORIES } from '../../../../data/defectLibraryMock';
import { defectService } from '../../../../services/quality/defectService';
import type { DefectDetail, DefectSeverityLevel, DefectStatus, DefectFilter } from '../../../../types/R3/R3.DEFECT';
import type { DefectCategoryCode } from '../../../../types/R3/R3.QUALITY';
import {
  Card,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Input,
  Select,
  List,
  Button,
  Modal,
  message,
  Empty,
  Tabs,
  Drawer,
  Tooltip,
  Badge,
} from 'antd';
import {
  AlertOctagon,
  Search,
  Edit,
  Trash2,
  Plus,
  BarChart3,
  BookOpen,
  Tag as TagIcon,
  Filter,
  FileText,
  Star,
  Activity,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Inbox, SearchX } from 'lucide-react'

const SEVERITY_META: Record<DefectSeverityLevel, { color: string; label: string; rank: number }> = {
  minor: { color: 'gold', label: '轻微', rank: 1 },
  major: { color: 'orange', label: '重要', rank: 2 },
  critical: { color: 'red', label: '严重', rank: 3 },
};

const STATUS_META: Record<DefectStatus, { color: string; label: string }> = {
  active: { color: 'green', label: '启用' },
  deprecated: { color: 'default', label: '已停用' },
  draft: { color: 'blue', label: '草稿' },
  reviewing: { color: 'purple', label: '审核中' },
};

export const DefectLibrary: React.FC<{ onSelect?: (code: string) => void }> = ({ onSelect }) => {
  const [defects, setDefects] = useState<DefectDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<DefectCategoryCode | 'all'>('all');
  const [severity, setSeverity] = useState<DefectSeverityLevel | 'all'>('all');
  const [status, setStatus] = useState<DefectStatus | 'all'>('all');
  const [customOnly, setCustomOnly] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState<DefectDetail | null>(null);
  const [detailDrawer, setDetailDrawer] = useState<DefectDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'template' | 'stats'>('list');

  const load = async () => {
    setLoading(true);
    try {
      const filter: DefectFilter = {
        search: search || undefined,
        category: category === 'all' ? undefined : category,
        severity: severity === 'all' ? undefined : severity,
        status: status === 'all' ? undefined : status,
        customOnly: customOnly || undefined,
      };
      const data = await defectService.listDefects(filter);
      setDefects(data);
    } catch (e) {
      message.error('加载缺陷库失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, severity, status, customOnly]);

  const stats = useMemo(
    () => ({
      total: defects.length,
      active: defects.filter((d) => d.isActive).length,
      custom: defects.filter((d) => d.customDefect).length,
      critical: defects.filter((d) => d.severity === 'critical').length,
      totalHits: defects.reduce((s, d) => s + d.count, 0),
      avgFix: defects.length > 0 ? (defects.reduce((s, d) => s + d.sla, 0) / defects.length).toFixed(1) : '0',
    }),
    [defects]
  );

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    defects.forEach((d) => {
      m[d.category] = (m[d.category] ?? 0) + d.count;
    });
    return m;
  }, [defects]);

  const handleDelete = async (code: string) => {
    Modal.confirm({
      title: '确认删除缺陷',
      content: `确定删除缺陷 ${code}？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          message.success('已删除 ' + code);
          load();
        } catch (e) {
          message.error('删除失败');
        }
      },
    });
  };

  const openCreate = () => {
    setEditing(null);
    setEditModal(true);
  };

  const openEdit = (d: DefectDetail) => {
    setEditing(d);
    setEditModal(true);
  };

  return (
    <div data-testid="defect-library" role="region" aria-label="缺陷库">
      <div
        style={{
          background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <AlertOctagon size={18} />
            <strong style={{ fontSize: 16 }}>缺陷库</strong>
            <Tag color="purple">R3.QUALITY.101-135</Tag>
            <Tag color="cyan">{DEFECT_CATEGORIES.length} 大类</Tag>
          </Space>
          <Space>
            <Button size="small" icon={<Plus size={12} />} onClick={openCreate}>
              新增缺陷
            </Button>
            <Button
              size="small"
              icon={<BarChart3 size={12} />}
              onClick={() => setActiveTab('stats')}
            >
              统计
            </Button>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>缺陷总数</span>}
              value={stats.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<BookOpen size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>启用</span>}
              value={stats.active}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<TagIcon size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>自定义</span>}
              value={stats.custom}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>严重</span>}
              value={stats.critical}
              styles={{ content: {  color: '#fca5a5', fontSize: 18  } }}
              prefix={<AlertOctagon size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>触发总数</span>}
              value={stats.totalHits}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Activity size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>平均 SLA(h)</span>}
              value={stats.avgFix}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Star size={14} />}
            />
          </Col>
        </Row>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'list' | 'template' | 'stats')}
        items={[
          {
            key: 'list',
            label: (
              <span>
                <FileText size={12} /> 缺陷记录
              </span>
            ),
          },
          {
            key: 'template',
            label: (
              <span>
                <BookOpen size={12} /> 缺陷模板
              </span>
            ),
          },
          {
            key: 'stats',
            label: (
              <span>
                <BarChart3 size={12} /> 缺陷统计
              </span>
            ),
          },
        ]}
      />

      <Card size="small" style={{ marginBottom: 8 }}>
        <Space wrap>
          <Input
            prefix={<Search size={12} />}
            placeholder="搜索缺陷名称/编码/描述"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={load}
            style={{ width: 240 }}
            aria-label="搜索缺陷"
          />
          <Select
            value={category}
            onChange={setCategory}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '全部分类' },
              ...DEFECT_CATEGORIES.map((c) => ({ value: c.code, label: c.name })),
            ]}
            aria-label="分类筛选"
          />
          <Select
            value={severity}
            onChange={setSeverity}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '全部严重度' },
              { value: 'minor', label: '轻微' },
              { value: 'major', label: '重要' },
              { value: 'critical', label: '严重' },
            ]}
            aria-label="严重度筛选"
          />
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'active', label: '启用' },
              { value: 'deprecated', label: '停用' },
              { value: 'draft', label: '草稿' },
              { value: 'reviewing', label: '审核中' },
            ]}
            aria-label="状态筛选"
          />
          <Button
            size="small"
            type={customOnly ? 'primary' : 'default'}
            onClick={() => setCustomOnly(!customOnly)}
            icon={<Filter size={12} />}
          >
            仅自定义
          </Button>
          <Button size="small" onClick={load} type="primary">
            查询
          </Button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            显示 {defects.length} 条
          </span>
        </Space>
      </Card>

      {activeTab === 'list' && (
        <List
          loading={loading}
          dataSource={defects}
          locale={{ emptyText: <Empty image={<SearchX size={48} style={{opacity:0.4}}/>} description="无匹配缺陷" /> }}
          style={{
            background: 'var(--bg-card)',
            borderRadius: 8,
            padding: 4,
            maxHeight: 600,
            overflowY: 'auto',
          }}
          renderItem={(d) => {
            const sm = SEVERITY_META[d.severity];
            const cat = DEFECT_CATEGORIES.find((c) => c.code === d.category);
            return (
              <List.Item
                key={d.id}
                data-testid={`defect-${d.code}`}
                style={{
                  padding: 10,
                  marginBottom: 4,
                  background: d.isActive ? 'var(--bg-card)' : 'var(--bg-primary)',
                  borderRadius: 6,
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
                onClick={() => setDetailDrawer(d)}
              >
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Badge count={sm.rank} showZero={false} color={sm.color} />
                      <Tag color={sm.color}>{sm.label}</Tag>
                      <strong>{d.name}</strong>
                      <Tag>{d.code}</Tag>
                      {cat && (
                        <Tag color="blue">
                          {cat.icon} {cat.name}
                        </Tag>
                      )}
                      {d.customDefect && <Tag color="purple">自定义</Tag>}
                      {!d.isActive && <Tag color="default">已停用</Tag>}
                      {d.trainingRequired && <Tag color="orange">需培训</Tag>}
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.description}</div>
                      {d.examples.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          示例：{d.examples.join('；')}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#0891b2', marginTop: 4 }}>
                        解决方案：{d.solution}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        触发 {d.count} 次 · 整改 SLA {d.sla}h · 更新 {new Date(d.updatedAt).toLocaleDateString()}
                        {d.tags.length > 0 && ` · 标签: ${d.tags.join(', ')}`}
                      </div>
                    </div>
                  }
                />
                <Space onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="详情">
                    <Button
                      size="small"
                      icon={<FileText size={10} />}
                      onClick={() => {
                        setDetailDrawer(d);
                        onSelect?.(d.code);
                      }}
                    />
                  </Tooltip>
                  <Button
                    size="small"
                    icon={<Edit size={10} />}
                    onClick={() => openEdit(d)}
                  >
                    编辑
                  </Button>
                  {d.customDefect && (
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={10} />}
                      onClick={() => handleDelete(d.code)}
                    >
                      删除
                    </Button>
                  )}
                </Space>
              </List.Item>
            );
          }}
        />
      )}

      {activeTab === 'template' && (
        <Row gutter={[12, 12]}>
          {DEFECT_CATEGORIES.slice(0, 6).map((cat) => {
            const items = defects.filter((d) => d.category === cat.code).slice(0, 4);
            return (
              <Col span={8} key={cat.code}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <span style={{ fontSize: 16 }}>{cat.icon}</span>
                      <strong style={{ color: cat.color }}>{cat.name}</strong>
                      <Tag>{cat.code}</Tag>
                    </Space>
                  }
                  extra={<Tag color="cyan">{items.length} 模板</Tag>}
                >
                  {items.length === 0 ? (
                    <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="该分类暂无模板" />
                  ) : (
                    <Space orientation="vertical" style={{ width: '100%' }} size={6}>
                      {items.map((d) => (
                        <div
                          key={d.id}
                          style={{
                            padding: 6,
                            background: 'var(--bg-primary)',
                            borderRadius: 4,
                            borderLeft: `3px solid ${cat.color}`,
                          }}
                        >
                          <Space>
                            <Tag color={SEVERITY_META[d.severity].color}>
                              {SEVERITY_META[d.severity].label}
                            </Tag>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</span>
                          </Space>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            模板：{d.solution}
                          </div>
                        </div>
                      ))}
                    </Space>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {activeTab === 'stats' && (
        <Row gutter={[12, 12]}>
          <Col span={14}>
            <Card size="small" title="按分类分布">
              <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                {DEFECT_CATEGORIES.map((cat) => {
                  const c = byCategory[cat.code] ?? 0;
                  const max = Math.max(1, ...Object.values(byCategory));
                  return (
                    <div key={cat.code}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          <span>{cat.icon}</span>
                          <span style={{ fontSize: 12 }}>{cat.name}</span>
                          <Tag>{cat.code}</Tag>
                        </Space>
                        <strong>{c} 次</strong>
                      </Space>
                      <div
                        style={{
                          height: 6,
                          background: 'var(--border-light)',
                          borderRadius: 3,
                          marginTop: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: ((c / max) * 100).toFixed(1) + '%',
                            height: '100%',
                            background: cat.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </Space>
            </Card>
          </Col>
          <Col span={10}>
            <Card size="small" title="按严重度">
              <Space orientation="vertical" style={{ width: '100%' }}>
                {(['critical', 'major', 'minor'] as DefectSeverityLevel[]).map((s) => {
                  const c = defects.filter((d) => d.severity === s).length;
                  return (
                    <Card key={s} size="small" style={{ background: SEVERITY_META[s].color + '10' }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Tag color={SEVERITY_META[s].color}>{SEVERITY_META[s].label}</Tag>
                        <strong>{c} 项</strong>
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            </Card>
            <Card size="small" title="Top 5 高频缺陷" style={{ marginTop: 12 }}>
              <List
                size="small"
                dataSource={[...defects].sort((a, b) => b.count - a.count).slice(0, 5)}
                renderItem={(d, i) => (
                  <List.Item>
                    <Space>
                      <Tag color="red">{i + 1}</Tag>
                      <span style={{ fontSize: 12 }}>{d.name}</span>
                    </Space>
                    <strong>{d.count}</strong>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Modal
        title={editing ? '编辑缺陷 - ' + editing.code : '新增自定义缺陷'}
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          setEditing(null);
        }}
        onOk={() => {
          setEditModal(false);
          setEditing(null);
          message.success('已保存');
          load();
        }}
        okText="保存"
        cancelText="取消"
        width={680}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={10}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12 }}>编码 *</div>
              <Input defaultValue={editing?.code} disabled={!!editing} placeholder="如 CUS-001" />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12 }}>名称 *</div>
              <Input defaultValue={editing?.name} placeholder="缺陷名称" />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12 }}>分类 *</div>
              <Select
                defaultValue={editing?.category}
                options={DEFECT_CATEGORIES.map((c) => ({ value: c.code, label: c.name }))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12 }}>严重度 *</div>
              <Select
                defaultValue={editing?.severity}
                options={[
                  { value: 'minor', label: '轻微' },
                  { value: 'major', label: '重要' },
                  { value: 'critical', label: '严重' },
                ]}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12 }}>整改 SLA (小时)</div>
              <Input type="number" defaultValue={editing?.sla ?? 24} />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12 }}>需培训</div>
              <Select
                defaultValue={editing?.trainingRequired ? 'yes' : 'no'}
                options={[
                  { value: 'yes', label: '是' },
                  { value: 'no', label: '否' },
                ]}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>描述 *</div>
            <Input.TextArea defaultValue={editing?.description} rows={2} />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>解决方案 *</div>
            <Input.TextArea defaultValue={editing?.solution} rows={2} />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontSize: 12 }}>示例 (用分号分隔)</div>
            <Input defaultValue={editing?.examples.join('；')} />
          </div>
        </Space>
      </Modal>

      <Drawer
        title={detailDrawer ? `${detailDrawer.name} (${detailDrawer.code})` : ''}
        open={!!detailDrawer}
        onClose={() => setDetailDrawer(null)}
        width={480}
      >
        {detailDrawer && (
          <Space orientation="vertical" style={{ width: '100%' }} size={12}>
            <Space>
              <Tag color={SEVERITY_META[detailDrawer.severity].color}>
                {SEVERITY_META[detailDrawer.severity].label}
              </Tag>
              <Tag color={STATUS_META[detailDrawer.isActive ? 'active' : 'deprecated'].color}>
                {STATUS_META[detailDrawer.isActive ? 'active' : 'deprecated'].label}
              </Tag>
              <Tag color="blue">{detailDrawer.category}</Tag>
            </Space>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>描述</div>
              <div style={{ fontSize: 13 }}>{detailDrawer.description}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>解决方案</div>
              <div style={{ fontSize: 13, color: '#0891b2' }}>{detailDrawer.solution}</div>
            </div>
            {detailDrawer.examples.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>示例</div>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {detailDrawer.examples.map((e, i) => (
                    <li key={i} style={{ fontSize: 12 }}>
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <Tag>触发次数</Tag> <strong>{detailDrawer.count}</strong>
              </div>
              <div>
                <Tag>整改 SLA</Tag> <strong>{detailDrawer.sla}h</strong>
              </div>
              <div>
                <Tag>标签</Tag> <strong>{detailDrawer.tags.join(', ') || '-'}</strong>
              </div>
              <div>
                <Tag>需培训</Tag>{' '}
                <strong>{detailDrawer.trainingRequired ? '是' : '否'}</strong>
              </div>
            </div>
            {detailDrawer.references.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>参考文献</div>
                <Space wrap>
                  {detailDrawer.references.map((r, i) => (
                    <Tag key={i}>{r}</Tag>
                  ))}
                </Space>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default DefectLibrary;
