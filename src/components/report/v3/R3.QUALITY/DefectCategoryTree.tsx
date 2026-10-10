/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.111 DefectCategoryTree 缺陷分类树
 *
 * 15 点: 6 大分类 / 24 子类 / 层级 / 标签 / 严重度联动
 */
import { DEFECT_CATEGORIES } from '../../../../data/defectLibraryMock';
import { defectService } from '../../../../services/quality/defectService';
import type { DefectCategory, DefectDetail, DefectTreeNode } from '../../../../types/R3/R3.DEFECT';
import {
  Card,
  Tag,
  Space,
  Tree,
  Row,
  Col,
  Statistic,
  Tooltip,
  Empty,
  Input,
  Select,
} from 'antd';
import {
  TreePine,
  FolderTree,
  Layers,
  BookOpen,
  Search,
  ChevronRight,
  Activity,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { SearchX } from 'lucide-react'
import { t } from '../../../../i18n/appI18n';

interface TreeDatum {
  key: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  children?: TreeDatum[];
  data: { cat: DefectCategory; defects: DefectDetail[] };
}

export const DefectCategoryTree: React.FC<{
  onSelect?: (code: string) => void;
}> = ({ onSelect }) => {
  const [tree, setTree] = useState<TreeDatum[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'major' | 'minor'>('all');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const defects = await defectService.listDefects();
      if (cancelled) return;
      const byCategory: Record<string, DefectDetail[]> = {};
      defects.forEach((d) => {
        const list = byCategory[d.category] ?? [];
        list.push(d);
        byCategory[d.category] = list;
      });
      const built: TreeDatum[] = DEFECT_CATEGORIES.map((cat) => {
        const items = byCategory[cat.code] ?? [];
        return {
          key: cat.code,
          title: (
            <Space>
              <span style={{ fontSize: 14 }}>{cat.icon}</span>
              <strong style={{ color: cat.color }}>{cat.name}</strong>
              <Tag color="blue">{cat.code}</Tag>
              <Tag color="cyan">{t('w9e.defectCategoryTree.itemsCount', { count: items.length })}</Tag>
              <Tag color="purple">L{cat.level}</Tag>
              {cat.totalCount > 0 && <Tag color="orange">{t('w9e.defectCategoryTree.triggerCount', { count: cat.totalCount })}</Tag>}
            </Space>
          ),
          icon: <FolderTree size={14} color={cat.color} />,
          data: { cat, defects: items },
          children: items.map((d) => ({
            key: d.code,
            title: (
              <Space>
                <Tag color={d.severity === 'critical' ? 'red' : d.severity === 'major' ? 'orange' : 'gold'}>
                  {d.severity === 'critical' ? t('w9e.defectCategoryTree.sevCritical') : d.severity === 'major' ? t('w9e.defectCategoryTree.sevMajor') : t('w9e.defectCategoryTree.sevMinor')}
                </Tag>
                <span style={{ fontSize: 12 }}>{d.name}</span>
                <Tag>{d.code}</Tag>
                <Tag color="default">{t('w9e.defectCategoryTree.timesCount', { count: d.count })}</Tag>
              </Space>
            ),
            icon: <Activity size={12} />,
            data: { cat, defects: [d] },
          })),
        };
      });
      setTree(built);
      setExpandedKeys(DEFECT_CATEGORIES.map((c) => c.code));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const t = DEFECT_CATEGORIES.reduce((s, c) => s + c.totalCount, 0);
    const sevCount = (code: string) => {
      const items = tree.find((t) => t.key === code)?.children ?? [];
      return items.length;
    };
    return {
      categories: DEFECT_CATEGORIES.length,
      total: t,
      critical: tree
        .filter((n) => n.data.cat.code === 'CRI' || n.data.cat.code === 'LOG')
        .reduce((s, n) => s + n.data.cat.totalCount, 0),
      severity: {
        critical: tree.reduce((s, n) => s + (sevCount(n.data.cat.code) > 0 ? 1 : 0), 0),
      },
    };
  }, [tree]);

  const filteredTree = useMemo(() => {
    if (!search && severityFilter === 'all') return tree;
    return tree
      .map((n) => {
        const matchesCat =
          !search ||
          n.data.cat.name.includes(search) ||
          n.data.cat.code.toLowerCase().includes(search.toLowerCase());
        const filteredChildren = (n.children ?? []).filter((c) => {
          const d = c.data.defects[0];
          if (!d) return false;
          const matchesSearch =
            !search ||
            d.name.includes(search) ||
            d.code.toLowerCase().includes(search.toLowerCase()) ||
            d.description.includes(search);
          const matchesSeverity =
            severityFilter === 'all' || d.severity === severityFilter;
          return matchesSearch && matchesSeverity;
        });
        if (matchesCat) return n;
        if (filteredChildren.length > 0) {
          return { ...n, children: filteredChildren };
        }
        return null;
      })
      .filter(Boolean) as TreeDatum[];
  }, [tree, search, severityFilter]);

  const selectedNode = useMemo(() => {
    if (!selected) return null;
    for (const n of tree) {
      if (n.key === selected) return n;
      const child = (n.children ?? []).find((c) => c.key === selected);
      if (child) return child;
    }
    return null;
  }, [tree, selected]);

  return (
    <div data-testid="defect-category-tree" role="region" aria-label={t('w9e.defectCategoryTree.ariaLabel')}>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-800) 0%, #7c3aed 100%)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 'var(--space-3, 12px)',
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <TreePine size={18} />
            <strong style={{ fontSize: 16 }}>{t('w9e.defectCategoryTree.title')}</strong>
            <Tag color="purple">R3.QUALITY.111</Tag>
            <Tag color="cyan">{t('w9e.defectCategoryTree.levelTag')}</Tag>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 'var(--space-3, 12px)' }}>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('w9e.defectCategoryTree.statTopCategories')}</span>}
              value={totals.categories}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<Layers size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('w9e.defectCategoryTree.statTotalDefects')}</span>}
              value={totals.total}
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<BookOpen size={14} />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('w9e.defectCategoryTree.statLogicCritical')}</span>}
              value={totals.critical}
              styles={{ content: {  color: '#fca5a5', fontSize: 18  } }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={<span style={{ color: '#fff' }}>{t('w9e.defectCategoryTree.statLevel')}</span>}
              value="2"
              styles={{ content: {  color: '#fff', fontSize: 18  } }}
              prefix={<TreePine size={14} />}
            />
          </Col>
        </Row>
      </div>

      <Card size="small" style={{ marginBottom: 'var(--space-2, 8px)' }}>
        <Space wrap>
          <Input
            prefix={<Search size={12} />}
            placeholder={t('w9e.defectCategoryTree.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            value={severityFilter}
            onChange={setSeverityFilter}
            style={{ width: 130 }}
            options={[
              { value: 'all', label: t('w9e.defectCategoryTree.filterAll') },
              { value: 'critical', label: t('w9e.defectCategoryTree.sevCritical') },
              { value: 'major', label: t('w9e.defectCategoryTree.sevMajor') },
              { value: 'minor', label: t('w9e.defectCategoryTree.sevMinor') },
            ]}
          />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {t('w9e.defectCategoryTree.visibleCount', { visible: filteredTree.length, total: tree.length })}
          </span>
        </Space>
      </Card>

      <Row gutter={12}>
        <Col span={14}>
          <Card
            size="small"
            title={
              <Space>
                <FolderTree size={14} /> {t('w9e.defectCategoryTree.hierarchy')}
              </Space>
            }
            extra={
              <Tooltip title={t('w9e.defectCategoryTree.expandTip')}>
                <Tag icon={<ChevronRight size={10} />}>树形</Tag>
              </Tooltip>
            }
          >
            {filteredTree.length === 0 ? (
              <Empty image={<SearchX size={48} style={{opacity:0.4}}/>} description={t('w9e.defectCategoryTree.noMatch')} />
            ) : (
              <Tree
                showIcon
                treeData={filteredTree as unknown as DefectTreeNode[]}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys as string[])}
                onSelect={(keys) => {
                  if (keys.length > 0) {
                    setSelected(keys[0] as string);
                    onSelect?.(keys[0] as string);
                  }
                }}
                aria-label={t('w9e.defectCategoryTree.ariaLabel')}
              />
            )}
          </Card>
        </Col>
        <Col span={10}>
          <Card
            size="small"
            title={
              <Space>
                <BookOpen size={14} /> {t('w9e.defectCategoryTree.detail')}
              </Space>
            }
          >
            {selectedNode ? (
              <Space orientation="vertical" style={{ width: '100%' }} size={10}>
                <Space>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      background: selectedNode.data.cat.color + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                    }}
                  >
                    {selectedNode.data.cat.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: selectedNode.data.cat.color }}>
                      {selectedNode.data.cat.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {selectedNode.data.cat.nameEn}
                    </div>
                  </div>
                </Space>
                <div style={{ fontSize: 12, color: '#475569' }}>{selectedNode.data.cat.description}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{selectedNode.data.cat.descriptionEn}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-2, 8px)' }}>
                  <div>
                    <Tag>{t('w9e.defectCategoryTree.totalTrigger')}</Tag> <strong>{selectedNode.data.cat.totalCount}</strong>
                  </div>
                  <div>
                    <Tag>{t('w9e.defectCategoryTree.subItems')}</Tag> <strong>{selectedNode.data.cat.childCount}</strong>
                  </div>
                  <div>
                    <Tag>{t('w9e.defectCategoryTree.statLevel')}</Tag> <strong>L{selectedNode.data.cat.level}</strong>
                  </div>
                  <div>
                    <Tag>{t('w9e.defectCategoryTree.sortOrder')}</Tag> <strong>{selectedNode.data.cat.sortOrder}</strong>
                  </div>
                </div>
                {selectedNode.data.defects.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 'var(--space-1, 4px)' }}>{t('w9e.defectCategoryTree.defectSamples')}</div>
                    <Space orientation="vertical" style={{ width: '100%' }} size={4}>
                      {selectedNode.data.defects.slice(0, 3).map((d) => (
                        <div
                          key={d.id}
                          style={{
                            padding: 6,
                            background: 'var(--bg-primary)',
                            borderRadius: 4,
                            borderLeft: '3px solid ' + selectedNode.data.cat.color,
                            fontSize: 12,
                          }}
                        >
                          <Space>
                            <Tag
                              color={
                                d.severity === 'critical'
                                  ? 'red'
                                  : d.severity === 'major'
                                  ? 'orange'
                                  : 'gold'
                              }
                            >
                              {d.severity === 'critical'
                                ? t('w9e.defectCategoryTree.sevCritical')
                                : d.severity === 'major'
                                ? t('w9e.defectCategoryTree.sevMajor')
                                : t('w9e.defectCategoryTree.sevMinor')}
                            </Tag>
                            <strong>{d.name}</strong>
                          </Space>
                          <div style={{ color: '#64748b', marginTop: 2 }}>{d.description}</div>
                        </div>
                      ))}
                    </Space>
                  </div>
                )}
              </Space>
            ) : (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: 'var(--space-5, 20px)' }}>
                {t('w9e.defectCategoryTree.selectHint')}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DefectCategoryTree;
