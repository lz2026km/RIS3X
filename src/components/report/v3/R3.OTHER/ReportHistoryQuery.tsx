/**
 * G005 放射RIS系统 v3.0.5.1 - 报告历史查询
 * R3.OTHER 组:历史报告查询(支持 react-window 虚拟化 100+ 行)
 * 20 升级点
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Card, Space, Button, Tag, Tooltip, message, Empty, Row, Col, Divider,
  Statistic, Select, Input, DatePicker, Switch, Dropdown, Modal, Form, Tabs, Progress, Alert,
} from 'antd';
import { FixedSizeList as VirtualList } from 'react-window';
import {
  Search, Filter, Calendar, ChevronDown, ChevronRight, Eye, Edit, FileText, Download,
  Hash, Database, RefreshCw, X, Save, Layers, Activity, CheckCircle2, XCircle, Clock,
  User, Tag as TagIcon, Star, ArrowUpDown, BarChart3, FileSearch, History, Sparkles,
} from 'lucide-react';
import { VIRTUAL_REPORT_LIST, VIRTUAL_REPORT_TOTAL, type VirtualReportRow } from '@data/reportWritingMock';

interface Props {
  onSelect?: (row: VirtualReportRow) => void;
  height?: number;
}

const STATUS_COLORS: Record<string, string> = {
  '待分配': 'default', '已分配': 'cyan', '书写中': 'blue', '已提交': 'purple',
  '初审中': 'orange', '初审通过': 'geekblue', '终审中': 'magenta', '已审核': 'green',
  '签发中': 'gold', '已签发': 'lime', '已发布': 'success', '修订中': 'warning',
  '已修订': 'cyan', '已撤回': 'default', '已驳回': 'red', '已归档': 'default',
};

const PRIORITY_COLORS: Record<string, string> = {
  '普通': 'default', '紧急': 'orange', '危重': 'red', '会诊': 'purple',
};

const GROUP_LABELS: Record<VirtualReportRow['group'], string> = {
  draft: '草稿', review: '审核', sign: '签发', published: '已发布', special: '特殊',
};
const GROUP_COLORS: Record<VirtualReportRow['group'], string> = {
  draft: 'blue', review: 'orange', sign: 'gold', published: 'green', special: 'red',
};

export const ReportHistoryQuery: React.FC<Props> = ({ onSelect, height = 600 }) => {
  const [rows] = useState<VirtualReportRow[]>(VIRTUAL_REPORT_LIST);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterGroup, setFilterGroup] = useState<VirtualReportRow['group'][]>([]);
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterModality, setFilterModality] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'quality' | 'duration' | 'wordCount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);
  const [selectedRow, setSelectedRow] = useState<VirtualReportRow | null>(null);

  const filtered = useMemo(() => {
    let arr = rows.slice();
    if (searchText) {
      const q = searchText.toLowerCase();
      arr = arr.filter((r) => r.patientName.toLowerCase().includes(q) || r.reportId.toLowerCase().includes(q) || r.patientId.toLowerCase().includes(q) || r.authorName.toLowerCase().includes(q));
    }
    if (filterStatus.length) arr = arr.filter((r) => filterStatus.includes(r.status));
    if (filterGroup.length) arr = arr.filter((r) => filterGroup.includes(r.group));
    if (filterPriority.length) arr = arr.filter((r) => filterPriority.includes(r.priority));
    if (filterModality.length) arr = arr.filter((r) => filterModality.includes(r.modality));
    if (showOnlyCritical) arr = arr.filter((r) => r.hasCritical);

    arr.sort((a, b) => {
      const keyA = sortBy === 'date' ? new Date(a.studyDate).getTime() : sortBy === 'quality' ? a.qualityScore : sortBy === 'duration' ? a.writingDurationMin : a.wordCount;
      const keyB = sortBy === 'date' ? new Date(b.studyDate).getTime() : sortBy === 'quality' ? b.qualityScore : sortBy === 'duration' ? b.writingDurationMin : b.wordCount;
      return sortDir === 'asc' ? keyA - keyB : keyB - keyA;
    });
    return arr;
  }, [rows, searchText, filterStatus, filterGroup, filterPriority, filterModality, sortBy, sortDir, showOnlyCritical]);

  const stats = useMemo(() => ({
    total: filtered.length,
    draft: filtered.filter((r) => r.group === 'draft').length,
    review: filtered.filter((r) => r.group === 'review').length,
    sign: filtered.filter((r) => r.group === 'sign').length,
    published: filtered.filter((r) => r.group === 'published').length,
    critical: filtered.filter((r) => r.hasCritical).length,
    avgQuality: filtered.length > 0 ? Math.round(filtered.reduce((a, r) => a + r.qualityScore, 0) / filtered.length) : 0,
  }), [filtered]);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const r = filtered[index];
    if (!r) return null;
    const isSelected = selectedRow?.id === r.id;
    return (
      <div
        style={style}
        onClick={() => { setSelectedRow(r); onSelect?.(r); }}
        className={`flex items-center gap-2 px-3 py-2 border-b border-slate-100 cursor-pointer transition ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
      >
        <div className="w-12 text-center">
          <Tag color={STATUS_COLORS[r.status]} className="text-[10px] m-0">{r.status}</Tag>
        </div>
        <div className="w-24 text-xs font-mono text-blue-600">{r.reportId}</div>
        <div className="w-16 text-xs">{r.modality}</div>
        <div className="w-16 text-xs">{r.bodyPart}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{r.patientName}</div>
          <div className="text-[10px] text-slate-500">{r.patientGender} {r.patientAge}岁 · {r.patientId}</div>
        </div>
        <div className="w-20 text-xs text-slate-500">{new Date(r.studyDate).toLocaleDateString()}</div>
        <div className="w-16">
          <Tag color={PRIORITY_COLORS[r.priority]} className="text-[10px] m-0">{r.priority}</Tag>
        </div>
        <div className="w-16 text-xs text-center">
          <span style={{ color: r.qualityScore >= 85 ? '#10b981' : r.qualityScore >= 75 ? '#3b82f6' : r.qualityScore >= 60 ? '#f59e0b' : '#dc2626' }}>{r.qualityScore}</span>
        </div>
        <div className="w-14 text-xs text-center">{r.wordCount}</div>
        <div className="w-14 text-xs text-center">{r.writingDurationMin}m</div>
        <div className="w-16 text-xs truncate">{r.authorName}</div>
        <div className="w-6">
          {r.hasCritical && <span title="含危急值">⚠️</span>}
        </div>
        <div className="w-6">
          <Button size="small" type="text" icon={<Eye className="w-3 h-3" />} />
        </div>
      </div>
    );
  }, [filtered, selectedRow, onSelect]);

  return (
    <div className="space-y-3">
      {/* 概览 */}
      <Row gutter={8}>
        <Col span={4}><Card size="small"><Statistic title="查询结果" value={stats.total} suffix={`/ ${VIRTUAL_REPORT_TOTAL}`} prefix={<FileSearch className="w-3 h-3" style={{ color: '#3b82f6' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="待审" value={stats.review} prefix={<Clock className="w-3 h-3" style={{ color: '#f59e0b' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已发布" value={stats.published} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#10b981' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="含危急值" value={stats.critical} prefix={<Sparkles className="w-3 h-3" style={{ color: '#dc2626' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="平均质量分" value={stats.avgQuality} suffix="/100" prefix={<BarChart3 className="w-3 h-3" style={{ color: '#7c3aed' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="已签发" value={stats.sign} prefix={<CheckCircle2 className="w-3 h-3" style={{ color: '#059669' }} />} styles={{ content: {  fontSize: 18  } }} /></Card></Col>
      </Row>

      {/* 筛选 + 工具栏 */}
      <Card size="small" className="shadow-sm" title={
        <div className="flex items-center justify-between">
          <Space><History className="w-4 h-4" /><span>报告历史查询</span><Tag color="blue">{VIRTUAL_REPORT_TOTAL} 条</Tag></Space>
          <Space>
            <Button size="small" icon={<Download className="w-3 h-3" />}>导出</Button>
            <Button size="small" icon={<Save className="w-3 h-3" />}>保存筛选</Button>
            <Button size="small" icon={<RefreshCw className="w-3 h-3" />}>刷新</Button>
          </Space>
        </div>
      }>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              prefix={<Search className="w-3 h-3" />}
              placeholder="搜索患者/报告/医生"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Select
              size="small"
              mode="multiple"
              placeholder="状态"
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ minWidth: 160 }}
              maxTagCount="responsive"
              options={['待分配', '已分配', '书写中', '已提交', '初审中', '终审中', '已审核', '签发中', '已签发', '已发布', '修订中'].map((s) => ({ value: s, label: s }))}
            />
            <Select
              size="small"
              mode="multiple"
              placeholder="阶段"
              value={filterGroup}
              onChange={(v) => setFilterGroup(v as VirtualReportRow['group'][])}
              style={{ minWidth: 140 }}
              maxTagCount="responsive"
              options={Object.entries(GROUP_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
            <Select
              size="small"
              mode="multiple"
              placeholder="优先级"
              value={filterPriority}
              onChange={setFilterPriority}
              style={{ minWidth: 140 }}
              maxTagCount="responsive"
              options={['普通', '紧急', '危重', '会诊'].map((p) => ({ value: p, label: p }))}
            />
            <Select
              size="small"
              mode="multiple"
              placeholder="模态"
              value={filterModality}
              onChange={setFilterModality}
              style={{ minWidth: 160 }}
              maxTagCount="responsive"
              options={['CT', 'MR', 'DR', 'US', 'MG', 'DSA', 'PET-CT'].map((m) => ({ value: m, label: m }))}
            />
            <span className="text-xs text-slate-500">排序:</span>
            <Select size="small" value={sortBy} onChange={setSortBy} style={{ width: 100 }} options={[
              { value: 'date', label: '检查时间' }, { value: 'quality', label: '质量分' }, { value: 'duration', label: '书写时长' }, { value: 'wordCount', label: '字数' },
            ]} />
            <Button size="small" icon={<ArrowUpDown className="w-3 h-3" />} onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>{sortDir === 'asc' ? '升序' : '降序'}</Button>
            <span className="text-xs text-slate-500 ml-2">仅危急值</span>
            <Switch size="small" checked={showOnlyCritical} onChange={setShowOnlyCritical} />
          </div>
        </div>

        <Divider className="my-2" />

        {/* 表头 */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-xs font-semibold">
          <div className="w-12 text-center">状态</div>
          <div className="w-24">报告 ID</div>
          <div className="w-16">模态</div>
          <div className="w-16">部位</div>
          <div className="flex-1">患者</div>
          <div className="w-20">检查时间</div>
          <div className="w-16">优先级</div>
          <div className="w-16 text-center">质量分</div>
          <div className="w-14 text-center">字数</div>
          <div className="w-14 text-center">时长</div>
          <div className="w-16">作者</div>
          <div className="w-6"></div>
          <div className="w-6"></div>
        </div>

        {/* 虚拟列表 */}
        {filtered.length > 0 ? (
          <VirtualList
            height={height}
            itemCount={filtered.length}
            itemSize={48}
            width="100%"
            overscanCount={5}
          >
            {Row}
          </VirtualList>
        ) : (
          <Empty description="无符合条件数据" className="py-12" />
        )}

        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
          <span>使用 react-window 虚拟化,支持 100+ 行高性能滚动</span>
          <span>显示 {filtered.length} 条 · 共 {VIRTUAL_REPORT_TOTAL} 条</span>
        </div>
      </Card>

      {/* 选中行详情 */}
      {selectedRow && (
        <Card size="small" className="shadow-sm" title={
          <Space><FileText className="w-4 h-4" /><span>报告详情</span><Tag color={GROUP_COLORS[selectedRow.group]}>{GROUP_LABELS[selectedRow.group]}</Tag></Space>
        } extra={<Button size="small" icon={<X className="w-3 h-3" />} onClick={() => setSelectedRow(null)} />}>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="p-2 bg-slate-50 rounded">
              <div className="text-slate-500">报告 ID</div>
              <div className="font-mono text-blue-600">{selectedRow.reportId}</div>
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="text-slate-500">患者</div>
              <div>{selectedRow.patientName} ({selectedRow.patientGender} {selectedRow.patientAge}岁)</div>
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="text-slate-500">检查</div>
              <div>{selectedRow.modality} - {selectedRow.bodyPart}</div>
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="text-slate-500">时间</div>
              <div>{new Date(selectedRow.studyDate).toLocaleString()}</div>
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="text-slate-500">状态</div>
              <Tag color={STATUS_COLORS[selectedRow.status]}>{selectedRow.status}</Tag>
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="text-slate-500">质量分</div>
              <Progress percent={selectedRow.qualityScore} size="small" strokeColor={selectedRow.qualityScore >= 85 ? '#10b981' : selectedRow.qualityScore >= 75 ? '#3b82f6' : selectedRow.qualityScore >= 60 ? '#f59e0b' : '#dc2626'} />
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="text-slate-500">字数 / 时长</div>
              <div>{selectedRow.wordCount} 字 / {selectedRow.writingDurationMin} 分钟</div>
            </div>
            <div className="p-2 bg-slate-50 rounded">
              <div className="text-slate-500">作者 / 审核者</div>
              <div>{selectedRow.authorName} {selectedRow.reviewerName && `→ ${selectedRow.reviewerName}`}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReportHistoryQuery;
