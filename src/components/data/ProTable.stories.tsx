/**
 * G005 放射RIS系统 v3.0.0 - ProTable / Statistic Story
 * Phase T2-W5
 */

import type { Meta, StoryObj } from '@storybook/react';
import { ProTable, AppStatistic, AppDescriptions, AppTabs, AppCollapse, PageContainer } from './ProTable';
import { Card, Space, Tag, Progress } from 'antd';
import { Button } from 'antd';

const meta: Meta = {
  title: 'Data/ProTable Statistic Descriptions Tabs Collapse',
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj;

// ============= 模拟数据 =============
const SAMPLE_REPORTS = [
  { id: 'rpt-001', reportId: 'RP20260604001', patientId: 'P001', patientName: '张志远', age: 58, gender: '男', modality: 'CT', bodyPart: '胸部', status: '已发布', qualityScore: 92, criticalFinding: true, examDate: '2026-06-04 08:15' },
  { id: 'rpt-002', reportId: 'RP20260604002', patientId: 'P002', patientName: '王秀英', age: 45, gender: '女', modality: 'CT', bodyPart: '头颅', status: '已审核', qualityScore: 88, criticalFinding: false, examDate: '2026-06-04 09:30' },
  { id: 'rpt-003', reportId: 'RP20260604003', patientId: 'P003', patientName: '李建国', age: 67, gender: '男', modality: 'MR', bodyPart: '腹部', status: '初审中', qualityScore: 75, criticalFinding: false, examDate: '2026-06-04 10:00' },
  { id: 'rpt-004', reportId: 'RP20260604004', patientId: 'P004', patientName: '赵丽华', age: 52, gender: '女', modality: 'MG', bodyPart: '乳腺', status: '待分配', qualityScore: 0, criticalFinding: false, examDate: '2026-06-04 11:20' },
  { id: 'rpt-005', reportId: 'RP20260604005', patientId: 'P005', patientName: '陈志强', age: 73, gender: '男', modality: 'DR', bodyPart: '胸部', status: '已签发', qualityScore: 95, criticalFinding: false, examDate: '2026-06-04 14:30' },
  { id: 'rpt-006', reportId: 'RP20260604006', patientId: 'P006', patientName: '刘文静', age: 38, gender: '女', modality: 'US', bodyPart: '甲状腺', status: '已发布', qualityScore: 90, criticalFinding: false, examDate: '2026-06-04 15:45' },
  { id: 'rpt-007', reportId: 'RP20260604007', patientId: 'P007', patientName: '孙明华', age: 61, gender: '男', modality: 'DSA', bodyPart: '冠脉', status: '已驳回', qualityScore: 60, criticalFinding: false, examDate: '2026-06-04 16:20' },
  { id: 'rpt-008', reportId: 'RP20260604008', patientId: 'P008', patientName: '周丽华', age: 49, gender: '女', modality: 'CT', bodyPart: '腹部', status: '已发布', qualityScore: 87, criticalFinding: false, examDate: '2026-06-04 17:10' },
];

const STATUS_COLOR: Record<string, string> = {
  '已发布': 'green',
  '已签发': 'blue',
  '已审核': 'cyan',
  '初审中': 'orange',
  '待分配': 'default',
  '已驳回': 'red',
};

// ============= ProTable Story =============
export const ProTableBasic: Story = {
  render: () => (
    <ProTable
      dataSource={SAMPLE_REPORTS}
      rowKey="id"
      columns={[
        { title: '报告 ID', dataIndex: 'reportId', width: 160, searchable: true },
        { title: '患者姓名', dataIndex: 'patientName', width: 120, searchable: true },
        { title: '设备', dataIndex: 'modality', width: 80, render: (v) => <Tag color="blue">{String(v)}</Tag> },
        { title: '部位', dataIndex: 'bodyPart', width: 100 },
        { title: '状态', dataIndex: 'status', width: 100, render: (v) => <Tag color={STATUS_COLOR[String(v)]}>{String(v)}</Tag> },
        { title: '质量分', dataIndex: 'qualityScore', width: 100, render: (v) => Number(v) > 0 ? <Tag color={Number(v) >= 90 ? 'green' : Number(v) >= 80 ? 'blue' : 'orange'}>{String(v)}</Tag> : '—' },
        { title: '危急值', dataIndex: 'criticalFinding', width: 80, render: (v) => v ? <Tag color="red">是</Tag> : <Tag>否</Tag> },
        { title: '检查时间', dataIndex: 'examDate', width: 160 },
      ]}
      onExport={(data) => { console.log(`[ProTable] 导出 ${data.length} 条报告`); }}
      onRefresh={() => { console.log('[ProTable] 刷新数据'); }}
    />
  ),
};

export const ProTableWithSelection: Story = {
  render: () => (
    <ProTable
      dataSource={SAMPLE_REPORTS}
      rowKey="id"
      rowSelection={{ type: 'checkbox' }}
      columns={[
        { title: '报告 ID', dataIndex: 'reportId' },
        { title: '患者', dataIndex: 'patientName' },
        { title: '设备', dataIndex: 'modality' },
        { title: '状态', dataIndex: 'status' },
      ]}
    />
  ),
};

export const ProTableEmpty: Story = {
  render: () => (
    <ProTable
      dataSource={[]}
      rowKey="id"
      columns={[
        { title: '报告 ID', dataIndex: 'reportId' },
        { title: '患者', dataIndex: 'patientName' },
      ]}
    />
  ),
};

// ============= Statistic Story =============
export const StatisticBasic: Story = {
  render: () => (
    <Space size="large" wrap>
      <Card style={{ width: 240 }}>
        <AppStatistic title="今日检查" value={247} />
      </Card>
      <Card style={{ width: 240 }}>
        <AppStatistic title="待报告" value={97} trend={{ value: 12, positive: false }} />
      </Card>
      <Card style={{ width: 240 }}>
        <AppStatistic title="已发布" value={150} prefix="✓" trend={{ value: 8, positive: true }} />
      </Card>
      <Card style={{ width: 240 }}>
        <AppStatistic
          title="危急值"
          value={10}
          precision={0}
          suffix="例"
          color="#dc2626"
          trend={{ value: 25, positive: false }}
        />
      </Card>
    </Space>
  ),
};

export const StatisticWithProgress: Story = {
  render: () => (
    <Card title="报告质量分布" style={{ width: 400 }}>
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        <AppStatistic
          title="平均质量分"
          value={85.6}
          precision={1}
          suffix="/ 100"
          color="#1e40af"
        />
        <div>
          <div style={{ marginBottom: 4, fontSize: 13, color: '#64748b' }}>质量分布</div>
          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            <div>优秀 (90-100) <Progress percent={40} strokeColor="#22c55e" /></div>
            <div>良好 (80-89) <Progress percent={35} strokeColor="#3b82f6" /></div>
            <div>合格 (70-79) <Progress percent={15} strokeColor="#f59e0b" /></div>
            <div>不合格 (&lt;70) <Progress percent={10} strokeColor="#dc2626" /></div>
          </Space>
        </div>
      </Space>
    </Card>
  ),
};

// ============= Descriptions Story =============
export const DescriptionsBasic: Story = {
  render: () => (
    <AppDescriptions
      title="报告 RP20260604001"
      column={2}
      items={[
        { key: 'patient', label: '患者姓名', value: '张志远' },
        { key: 'gender', label: '性别', value: '男' },
        { key: 'age', label: '年龄', value: '58' },
        { key: 'modality', label: '检查设备', value: <Tag color="blue">CT</Tag> },
        { key: 'bodyPart', label: '检查部位', value: '胸部' },
        { key: 'clinical', label: '临床诊断', value: '咳嗽咳痰 2 周,疑似肺部占位' },
        { key: 'status', label: '报告状态', value: <Tag color="green">已发布</Tag>, span: 2 },
        { key: 'doctor', label: '报告医生', value: '张明远(主任医师)' },
        { key: 'reviewer', label: '审核医生', value: '李慧敏(副主任医师)' },
        { key: 'quality', label: '质量评分', value: <Tag color="green">92</Tag> },
        { key: 'critical', label: '危急值', value: <Tag color="red">是 - 主动脉夹层?</Tag> },
      ]}
    />
  ),
};

// ============= Tabs Story =============
export const TabsBasic: Story = {
  render: () => (
    <AppTabs
      items={[
        { key: 'overview', label: '概览', children: <div style={{ padding: 16 }}>报告概览内容</div> },
        { key: 'findings', label: '影像所见', children: <div style={{ padding: 16 }}>右肺上叶见磨玻璃结节影...</div> },
        { key: 'diagnosis', label: '诊断意见', children: <div style={{ padding: 16 }}>考虑肺腺癌可能</div> },
        { key: 'images', label: '影像', children: <div style={{ padding: 16 }}>[DICOM 图像]</div> },
        { key: 'history', label: '历史', children: <div style={{ padding: 16 }}>历史报告对比</div> },
        { key: 'audit', label: '审计链', children: <div style={{ padding: 16 }}>[Merkle 审计链]</div>, disabled: false },
      ]}
      defaultActiveKey="overview"
    />
  ),
};

export const TabsCard: Story = {
  render: () => (
    <AppTabs
      type="card"
      items={[
        { key: 'tab1', label: '基本信息', children: <Card>患者基本信息</Card> },
        { key: 'tab2', label: '检查记录', children: <Card>历史检查</Card> },
        { key: 'tab3', label: '报告', children: <Card>报告内容</Card> },
      ]}
      defaultActiveKey="tab1"
    />
  ),
};

// ============= Collapse Story =============
export const CollapseBasic: Story = {
  render: () => (
    <AppCollapse
      items={[
        {
          key: '1',
          label: '检查技术(Technique)',
          children: <p>胸部 CT 平扫 + 增强,层厚 5mm,120kVp,自动 mAs。</p>,
        },
        {
          key: '2',
          label: '影像所见(Findings)',
          children: (
            <div>
              <p>双肺纹理清晰,右肺上叶后段见一磨玻璃结节影,直径约 8mm,边缘可见分叶征及短毛刺。</p>
              <p>纵隔内未见明显肿大淋巴结。</p>
            </div>
          ),
        },
        {
          key: '3',
          label: '诊断意见(Diagnosis)',
          children: <p>右肺上叶磨玻璃结节,考虑周围型肺腺癌可能(Lung-RADS 4A)。</p>,
        },
        {
          key: '4',
          label: '建议(Recommendation)',
          children: <p>建议 3 个月后复查 LDCT,必要时 PET-CT 检查或组织活检。</p>,
          disabled: false,
        },
      ]}
      defaultActiveKey="2"
    />
  ),
};

// ============= PageContainer Story =============
export const PageContainerBasic: Story = {
  render: () => (
    <PageContainer
      title="报告列表"
      extra={
        <Space>
          <Button>导出</Button>
          <Button type="primary">新建报告</Button>
        </Space>
      }
    >
      <Card>内容区域</Card>
    </PageContainer>
  ),
};

export const PageContainerNoBackground: Story = {
  render: () => (
    <PageContainer
      title="设置"
      noBackground
      noPadding
    >
      <div>无背景容器(嵌入其他容器)</div>
    </PageContainer>
  ),
};
