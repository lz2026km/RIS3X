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
import { t } from '../../../../i18n/appI18n';

const SEVERITY_META: Record<DefectSeverityLevel, { color: string; label: string; rank: number }> = {
  minor: { color: 'gold', label: t('defectLibrary.severity.minor'), rank: 1 },
  major: { color: 'orange', label: t('defectLibrary.severity.major'), rank: 2 },
  critical: { color: 'red', label: t('defectLibrary.severity.critical'), rank: 3 },
};

const STATUS_META: Record<DefectStatus, { color: string; label: string }> = {
  active: { color: 'green', label: t('defectLibrary.status.active') },
  deprecated: { color: 'default', label: t('defectLibrary.status.deprecated') },
  draft: { color: 'blue', label: t('defectLibrary.status.draft') },
  reviewing: { color: 'purple', label: t('defectLibrary.status.reviewing') },
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
      message.error(t('defectLibrary.loadFailed'));
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
      title: t('defectLibrary.deleteConfirmTitle'),
      content: t('w9e.defectLibrary.deleteConfirm', { code }),
      okText: t('defectLibrary.delete'),
      okType: 'danger',
      cancelText: t('defectLibrary.cancel'),
      onOk: async () => {
        try {
          message.success(t('defectLibrary.deleted') + code);
          load();
        } catch (e) {
          message.error(t('defectLibrary.deleteFailed'));
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
    <div data-testid="defect-library" role="region" aria-label={t('defectLibrary.title')}>
      <div
        style={{
          background: 'linear-gradient(135deg, #7f1d1d 0%, var(--color-error-600) 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 'var(--space-3, 12px)',
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <AlertOctagon size={18} />
            <strong style={{ fontSize: 16 }}>{t('defectLibrary.title')}</strong>
            <Tag color="purple">R3.QUALITY.101-135</Tag>
            <Tag color="cyan">{DEFECT_CATEGORIES.length} {t('defectLibrary.categoryUnit')}</Tag>
          </Space>
          <Space>
            <Button size="small" icon={<Plus size={12} />} onClick={openCreate}>
              {t('defectLibrary.addDefect')}
            </Button>
            <Button
              size="small"
              icon={<BarChart3 size={12} />}
              onClick={() => setActiveTab('stats')}
            >
              {t('defectLibrary.stats')}
            </Button>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectLibrary.totalDefects')}</span>}
              value={stats.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<BookOpen size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectLibrary.status.active')}</span>}
              value={stats.active}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<TagIcon size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectLibrary.custom')}</span>}
              value={stats.custom}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectLibrary.severity.critical')}</span>}
              value={stats.critical}
              styles={{ content: {  color: '#fca5a5', fontSize: 18  } }}
              prefix={<AlertOctagon size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectLibrary.totalHits')}</span>}
              value={stats.totalHits}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Activity size={14} />}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('defectLibrary.avgSla')}</span>}
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
                <FileText size={12} /> {t('defectLibrary.tab.records')}
              </span>
            ),
          },
          {
            key: 'template',
            label: (
              <span>
                <BookOpen size={12} /> {t('defectLibrary.tab.template')}
              </span>
            ),
          },
          {
            key: 'stats',
            label: (
              <span>
                <BarChart3 size={12} /> {t('defectLibrary.tab.stats')}
              </span>
            ),
          },
        ]}
      />

      <Card size="small" style={{ marginBottom: 'var(--space-2, 8px)' }}>
        <Space wrap>
          <Input
            prefix={<Search size={12} />}
            placeholder={t('defectLibrary.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={load}
            style={{ width: 240 }}
            aria-label={t('defectLibrary.searchAria')}
          />
          <Select
            value={category}
            onChange={setCategory}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: t('defectLibrary.allCategories') },
              ...DEFECT_CATEGORIES.map((c) => ({ value: c.code, label: c.name })),
            ]}
            aria-label={t('defectLibrary.categoryFilter')}
          />
          <Select
            value={severity}
            onChange={setSeverity}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: t('defectLibrary.allSeverities') },
              { value: 'minor', label: t('defectLibrary.severity.minor') },
              { value: 'major', label: t('defectLibrary.severity.major') },
              { value: 'critical', label: t('defectLibrary.severity.critical') },
            ]}
            aria-label={t('defectLibrary.severityFilter')}
          />
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            options={[
              { value: 'all', label: t('defectLibrary.allStatus') },
              { value: 'active', label: t('defectLibrary.status.active') },
              { value: 'deprecated', label: t('defectLibrary.statusDeprecatedShort') },
              { value: 'draft', label: t('defectLibrary.status.draft') },
              { value: 'reviewing', label: t('defectLibrary.status.reviewing') },
            ]}
            aria-label={t('defectLibrary.statusFilter')}
          />
          <Button
            size="small"
            type={customOnly ? 'primary' : 'default'}
            onClick={() => setCustomOnly(!customOnly)}
            icon={<Filter size={12} />}
          >
            {t('defectLibrary.customOnly')}
          </Button>
          <Button size="small" onClick={load} type="primary">
            {t('defectLibrary.query')}
          </Button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {t('defectLibrary.showing')} {defects.length} {t('defectLibrary.itemsUnit')}
          </span>
        </Space>
      </Card>

      {activeTab === 'list' && (
        <List
          loading={loading}
          dataSource={defects}
          locale={{ emptyText: <Empty image={<SearchX size={48} style={{opacity:0.4}}/>} description={t('defectLibrary.noMatch')} /> }}
          style={{
            background: 'var(--bg-card)',
            borderRadius: 8,
            padding: 'var(--space-1, 4px)',
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
                  marginBottom: 'var(--space-1, 4px)',
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
                      {d.customDefect && <Tag color="purple">{t('defectLibrary.custom')}</Tag>}
                      {!d.isActive && <Tag color="default">{t('defectLibrary.status.deprecated')}</Tag>}
                      {d.trainingRequired && <Tag color="orange">{t('defectLibrary.trainingRequired')}</Tag>}
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.description}</div>
                      {d.examples.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-1, 4px)' }}>
                          {t('defectLibrary.examplesPrefix')}{d.examples.join('；')}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: 'var(--color-info-600)', marginTop: 'var(--space-1, 4px)' }}>
                        {t('defectLibrary.solutionPrefix')}{d.solution}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-1, 4px)' }}>
                        {t('defectLibrary.trigger')} {d.count} {t('defectLibrary.timesUnit')} · {t('defectLibrary.remediationSla')} {d.sla}h · {t('defectLibrary.updated')} {new Date(d.updatedAt).toLocaleDateString()}
                        {d.tags.length > 0 && t('w9e.defectLibrary.tagsPrefix', { tags: d.tags.join(', ') })}
                      </div>
                    </div>
                  }
                />
                <Space onClick={(e) => e.stopPropagation()}>
                  <Tooltip title={t('defectLibrary.detail')}>
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
                    {t('defectLibrary.edit')}
                  </Button>
                  {d.customDefect && (
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={10} />}
                      onClick={() => handleDelete(d.code)}
                    >
                      {t('defectLibrary.delete')}
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
                  extra={<Tag color="cyan">{items.length} {t('defectLibrary.templatesUnit')}</Tag>}
                >
                  {items.length === 0 ? (
                    <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('defectLibrary.noTemplateInCategory')} />
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
                            {t('defectLibrary.templatePrefix')}{d.solution}
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
            <Card size="small" title={t('defectLibrary.byCategory')}>
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
                        <strong>{c} {t('defectLibrary.timesUnit')}</strong>
                      </Space>
                      <div
                        style={{
                          height: 6,
                          background: 'var(--border-light)',
                          borderRadius: 3,
                          marginTop: 'var(--space-1, 4px)',
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
            <Card size="small" title={t('defectLibrary.bySeverity')}>
              <Space orientation="vertical" style={{ width: '100%' }}>
                {(['critical', 'major', 'minor'] as DefectSeverityLevel[]).map((s) => {
                  const c = defects.filter((d) => d.severity === s).length;
                  return (
                    <Card key={s} size="small" style={{ background: SEVERITY_META[s].color + '10' }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Tag color={SEVERITY_META[s].color}>{SEVERITY_META[s].label}</Tag>
                        <strong>{c} {t('defectLibrary.entriesUnit')}</strong>
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            </Card>
            <Card size="small" title={t('defectLibrary.top5')} style={{ marginTop: 'var(--space-3, 12px)' }}>
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
        title={editing ? `${t('defectLibrary.editDefectTitle')} - ${editing.code}` : t('defectLibrary.createDefectTitle')}
        open={editModal}
        onCancel={() => {
          setEditModal(false);
          setEditing(null);
        }}
        onOk={() => {
          setEditModal(false);
          setEditing(null);
          message.success(t('defectLibrary.saved'));
          load();
        }}
        okText={t('defectLibrary.save')}
        cancelText={t('defectLibrary.cancel')}
        width={680}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={10}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('defectLibrary.field.code')}</div>
              <Input defaultValue={editing?.code} disabled={!!editing} placeholder={t('defectLibrary.codePlaceholder')} />
            </div>
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('defectLibrary.field.name')}</div>
              <Input defaultValue={editing?.name} placeholder={t('defectLibrary.namePlaceholder')} />
            </div>
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('defectLibrary.field.category')}</div>
              <Select
                defaultValue={editing?.category}
                options={DEFECT_CATEGORIES.map((c) => ({ value: c.code, label: c.name }))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('defectLibrary.field.severity')}</div>
              <Select
                defaultValue={editing?.severity}
                options={[
                  { value: 'minor', label: t('defectLibrary.severity.minor') },
                  { value: 'major', label: t('defectLibrary.severity.major') },
                  { value: 'critical', label: t('defectLibrary.severity.critical') },
                ]}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('defectLibrary.field.slaHours')}</div>
              <Input type="number" defaultValue={editing?.sla ?? 24} />
            </div>
            <div>
              <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('defectLibrary.field.trainingRequired')}</div>
              <Select
                defaultValue={editing?.trainingRequired ? 'yes' : 'no'}
                options={[
                  { value: 'yes', label: t('defectLibrary.yes') },
                  { value: 'no', label: t('defectLibrary.no') },
                ]}
                style={{ width: '100%' }}
              />
            </div>
          </div>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('defectLibrary.field.description')}</div>
            <Input.TextArea defaultValue={editing?.description} rows={2} />
          </div>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('defectLibrary.field.solution')}</div>
            <Input.TextArea defaultValue={editing?.solution} rows={2} />
          </div>
          <div>
            <div style={{ marginBottom: 'var(--space-1, 4px)', fontSize: 12 }}>{t('defectLibrary.field.examples')}</div>
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
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('defectLibrary.description')}</div>
              <div style={{ fontSize: 12 }}>{detailDrawer.description}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('defectLibrary.solution')}</div>
              <div style={{ fontSize: 12, color: 'var(--color-info-600)' }}>{detailDrawer.solution}</div>
            </div>
            {detailDrawer.examples.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('defectLibrary.examples')}</div>
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  {detailDrawer.examples.map((e, i) => (
                    <li key={i} style={{ fontSize: 12 }}>
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
              <div>
                <Tag>{t('defectLibrary.triggerCount')}</Tag> <strong>{detailDrawer.count}</strong>
              </div>
              <div>
                <Tag>{t('defectLibrary.remediationSla')}</Tag> <strong>{detailDrawer.sla}h</strong>
              </div>
              <div>
                <Tag>{t('defectLibrary.tags')}</Tag> <strong>{detailDrawer.tags.join(', ') || '-'}</strong>
              </div>
              <div>
                <Tag>{t('defectLibrary.trainingRequired')}</Tag>{' '}
                <strong>{detailDrawer.trainingRequired ? t('defectLibrary.yes') : t('defectLibrary.no')}</strong>
              </div>
            </div>
            {detailDrawer.references.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('defectLibrary.references')}</div>
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
