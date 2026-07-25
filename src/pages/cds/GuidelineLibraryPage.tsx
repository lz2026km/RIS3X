import { useState, useMemo } from 'react';
import { BookOpen, Search, FileText, Calendar, Tag, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Table, Input, Tree, Modal, Tag as AntTag, Card, Empty, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';

interface Guideline {
  id: string;
  name: string;
  category: string;
  version: string;
  status: string;
  updatedAt: string;
  description: string;
  source: string;
}

const CATEGORY_TREE: DataNode[] = [
  { title: '呼吸系统', key: 'respiratory', children: [
    { title: '肺结节', key: 'respiratory-nodule' },
    { title: '肺炎', key: 'respiratory-pneumonia' },
    { title: 'COPD', key: 'respiratory-copd' },
  ]},
  { title: '循环系统', key: 'circulatory', children: [
    { title: '冠心病', key: 'circulatory-chd' },
    { title: '心肌病', key: 'circulatory-cmp' },
  ]},
  { title: '消化系统', key: 'digestive', children: [
    { title: '肝病', key: 'digestive-liver' },
    { title: '胰腺', key: 'digestive-pancreas' },
  ]},
  { title: '神经系统', key: 'neurological', children: [
    { title: '脑血管', key: 'neuro-cerebrovascular' },
    { title: '退行性病变', key: 'neuro-degenerative' },
  ]},
];

const MOCK_GUIDELINES: Guideline[] = [
  { id: 'g1', name: '肺结节CT筛查与管理指南', category: 'respiratory-nodule', version: 'v2.1', status: '已发布', updatedAt: '2026-06-01', description: '基于Fleischner学会的最新肺结节管理建议', source: 'Fleischner Society' },
  { id: 'g2', name: '社区获得性肺炎影像诊断', category: 'respiratory-pneumonia', version: 'v1.0', status: '已发布', updatedAt: '2026-05-15', description: 'CAP的影像学诊断标准和随访建议', source: 'RSNA' },
  { id: 'g3', name: '慢性阻塞性肺疾病CT评估', category: 'respiratory-copd', version: 'v1.2', status: '草稿', updatedAt: '2026-04-20', description: 'COPD的CT定量评估方法', source: 'NICE' },
  { id: 'g4', name: '冠状动脉CTA报告指南', category: 'circulatory-chd', version: 'v3.0', status: '已发布', updatedAt: '2026-06-10', description: '冠脉CTA的结构化报告规范', source: 'SCCT' },
  { id: 'g5', name: '心肌病MRI评估共识', category: 'circulatory-cmp', version: 'v1.0', status: '已发布', updatedAt: '2026-03-01', description: '心肌病的CMR评估标准化方案', source: 'ESR' },
  { id: 'g6', name: '肝细胞癌影像诊断指南', category: 'digestive-liver', version: 'v2.0', status: '已发布', updatedAt: '2026-05-01', description: 'HCC的LI-RADS分类标准', source: 'ACR' },
  { id: 'g7', name: '急性胰腺炎影像评估', category: 'digestive-pancreas', version: 'v1.0', status: '草稿', updatedAt: '2026-02-10', description: '急性胰腺炎的CT严重度分级', source: 'RSNA' },
  { id: 'g8', name: '急性缺血性脑卒中影像指南', category: 'neuro-cerebrovascular', version: 'v2.0', status: '已发布', updatedAt: '2026-04-01', description: 'AIS的CT/MR影像评估和时间窗管理', source: 'ASA' },
  { id: 'g9', name: '阿尔茨海默病MRI评估', category: 'neuro-degenerative', version: 'v1.1', status: '已发布', updatedAt: '2026-03-15', description: 'AD的MRI海马体积测量标准', source: 'NIA-AA' },
];

const CATEGORY_LABELS: Record<string, string> = {
  'respiratory-nodule': '肺结节', 'respiratory-pneumonia': '肺炎', 'respiratory-copd': 'COPD',
  'circulatory-chd': '冠心病', 'circulatory-cmp': '心肌病',
  'digestive-liver': '肝病', 'digestive-pancreas': '胰腺',
  'neuro-cerebrovascular': '脑血管', 'neuro-degenerative': '退行性病变',
};

export default function GuidelineLibraryPage() {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detailGuideline, setDetailGuideline] = useState<Guideline | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['respiratory', 'circulatory', 'digestive', 'neurological']);

  const filtered = useMemo(() => {
    let items = MOCK_GUIDELINES;
    if (selectedCategory) {
      items = items.filter(g => g.category === selectedCategory);
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      items = items.filter(g => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q) || g.source.toLowerCase().includes(q));
    }
    return items;
  }, [searchText, selectedCategory]);

  const columns: ColumnsType<Guideline> = [
    {
      title: '指南名称', dataIndex: 'name', key: 'name',
      render: (name: string) => <a onClick={() => { const g = filtered.find(x => x.name === name); if (g) setDetailGuideline(g); }} style={{ cursor: 'pointer' }}>{name}</a>,
    },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: 120,
      render: (c: string) => <AntTag color="blue">{CATEGORY_LABELS[c] || c}</AntTag>,
    },
    { title: '版本', dataIndex: 'version', key: 'version', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: string) => <AntTag color={s === '已发布' ? 'green' : 'default'}>{s}</AntTag>,
    },
    { title: '更新日期', dataIndex: 'updatedAt', key: 'updatedAt', width: 110 },
    {
      title: '来源', dataIndex: 'source', key: 'source', width: 130,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontSize: 14 }}>
      <header style={{ background: 'linear-gradient(135deg,#059669 0%,#10b981 100%)', color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={20} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>临床指南库</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>基于循证医学的影像诊断指南 · 共 {MOCK_GUIDELINES.length} 篇</div>
        </div>
      </header>
      <div style={{ padding: 16, display: 'flex', gap: 16 }}>
        <Card title="分类导航" size="small" style={{ width: 240, flexShrink: 0 }}>
          <Tree
            treeData={CATEGORY_TREE}
            selectedKeys={selectedCategory ? [selectedCategory] : []}
            onSelect={(keys) => setSelectedCategory(keys[0] as string || null)}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            switcherIcon={(props: any) => props.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          />
        </Card>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 16 }}>
            <Input
              placeholder="搜索指南名称/描述/来源..."
              prefix={<Search size={14} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 360 }}
              allowClear
            />
          </div>
          <Table columns={columns} dataSource={filtered} rowKey="id" pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} size="middle" locale={{ emptyText: <Empty description="无匹配指南" /> }} />
        </div>
      </div>
      <Modal
        title={<span><FileText size={16} style={{ marginRight: 8 }} />{detailGuideline?.name}</span>}
        open={!!detailGuideline}
        onCancel={() => setDetailGuideline(null)}
        footer={null}
        width={640}
      >
        {detailGuideline && (
          <div>
            <p><strong>版本：</strong>{detailGuideline.version}</p>
            <p><strong>状态：</strong><AntTag color={detailGuideline.status === '已发布' ? 'green' : 'default'}>{detailGuideline.status}</AntTag></p>
            <p><strong>分类：</strong><AntTag color="blue">{CATEGORY_LABELS[detailGuideline.category]}</AntTag></p>
            <p><strong>来源：</strong>{detailGuideline.source}</p>
            <p><strong>更新日期：</strong>{detailGuideline.updatedAt}</p>
            <p><strong>描述：</strong>{detailGuideline.description}</p>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <AntTag icon={<ExternalLink size={12} />} color="blue" style={{ cursor: 'pointer' }}>查看原文</AntTag>
              <AntTag icon={<Calendar size={12} />} color="green" style={{ cursor: 'pointer' }}>添加到收藏</AntTag>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
