/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AMEND 差异对比高亮
 * A5-REPORT / 30 点
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Space, Typography, Select, Row, Col, Tag, Alert, Button, Radio, Empty, Divider, Statistic } from 'antd';
import { GitCompare, Plus, Minus, Equal, FileText, ArrowLeftRight } from 'lucide-react';
import type { VersionDiff, RevisionEntry, FieldDiff, DiffHunk } from '../../../../types/R3/R3.AMEND';
import { amendService } from '../../../../services/amend/amendService';

const { Title, Text, Paragraph } = Typography;

export interface DiffViewerProps {
  reportId: string;
  fromVersion?: number;
  toVersion?: number;
  showFieldSelector?: boolean;
}

type DiffMode = 'unified' | 'split' | 'list';

const FIELD_LABEL: Record<FieldDiff['field'], string> = {
  examFindings: '影像所见',
  diagnosis: '诊断',
  impression: '诊断意见',
  recommendations: '建议',
};

export const DiffViewer: React.FC<DiffViewerProps> = ({
  reportId,
  fromVersion: initialFrom,
  toVersion: initialTo,
  showFieldSelector = true,
}) => {
  const [revisions, setRevisions] = useState<RevisionEntry[]>([]);
  const [fromVersion, setFromVersion] = useState<number | undefined>(initialFrom);
  const [toVersion, setToVersion] = useState<number | undefined>(initialTo);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [mode, setMode] = useState<DiffMode>('unified');
  const [selectedField, setSelectedField] = useState<FieldDiff['field'] | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    amendService
      .listRevisions(reportId)
      .then((list) => {
        setRevisions(list);
        if (list.length >= 2 && fromVersion === undefined && toVersion === undefined) {
          setFromVersion(list[list.length - 2]!.version);
          setToVersion(list[list.length - 1]!.version);
        } else if (list.length === 1 && fromVersion === undefined) {
          setFromVersion(list[0]!.version);
          setToVersion(list[0]!.version);
        }
      })
      .catch((e) => setError((e as Error).message));
  }, [reportId]);

  useEffect(() => {
    if (fromVersion === undefined || toVersion === undefined) return;
    setLoading(true);
    amendService
      .getDiff(fromVersion, toVersion)
      .then((d) => setDiff(d))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [fromVersion, toVersion]);

  const fieldsToShow: FieldDiff[] = useMemo(() => {
    if (!diff) return [];
    if (selectedField === 'all') return diff.fields;
    return diff.fields.filter((f) => f.field === selectedField);
  }, [diff, selectedField]);

  const totalAdditions = diff?.fields.reduce((acc, f) => acc + f.additions, 0) ?? 0;
  const totalDeletions = diff?.fields.reduce((acc, f) => acc + f.deletions, 0) ?? 0;

  return (
    <Card
      title={
        <Space>
          <GitCompare size={18} />
          <span>差异对比</span>
          {diff && (
            <Tag color="blue">
              {diff.totalChanges} 处变更
            </Tag>
          )}
        </Space>
      }
      extra={
        <Space>
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value as DiffMode)} size="small">
            <Radio.Button value="unified">合并视图</Radio.Button>
            <Radio.Button value="split">左右对照</Radio.Button>
            <Radio.Button value="list">变更列表</Radio.Button>
          </Radio.Group>
        </Space>
      }
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Text type="secondary">对比版本</Text>
          <Space>
            <Select
              value={fromVersion}
              onChange={setFromVersion}
              style={{ width: 120 }}
              placeholder="源版本"
            >
              {revisions.map((r) => (
                <Select.Option key={r.id} value={r.version}>v{r.version}</Select.Option>
              ))}
            </Select>
            <ArrowLeftRight size={14} />
            <Select
              value={toVersion}
              onChange={setToVersion}
              style={{ width: 120 }}
              placeholder="目标版本"
            >
              {revisions.map((r) => (
                <Select.Option key={r.id} value={r.version}>v{r.version}</Select.Option>
              ))}
            </Select>
          </Space>
        </Col>
        {showFieldSelector && diff && (
          <Col span={8}>
            <Text type="secondary">字段</Text>
            <Select
              value={selectedField}
              onChange={(v) => setSelectedField(v as FieldDiff['field'] | 'all')}
              style={{ width: 180 }}
            >
              <Select.Option value="all">全部字段</Select.Option>
              {diff.fields.map((f) => (
                <Select.Option key={f.field} value={f.field}>
                  {FIELD_LABEL[f.field]}
                </Select.Option>
              ))}
            </Select>
          </Col>
        )}
        <Col span={8}>
          <Space>
            <Statistic
              title="新增"
              value={totalAdditions}
              prefix={<Plus size={14} color="#10b981" />}
              styles={{ content: {  color: '#10b981', fontSize: 16  } }}
            />
            <Statistic
              title="删除"
              value={totalDeletions}
              prefix={<Minus size={14} color="#ef4444" />}
              styles={{ content: {  color: '#ef4444', fontSize: 16  } }}
            />
          </Space>
        </Col>
      </Row>

      {!diff ? (
        <Empty description={loading ? '加载中...' : '请选择版本'} />
      ) : (
        <>
          {mode === 'unified' && fieldsToShow.map((field) => (
            <Card
              key={field.field}
              size="small"
              title={
                <Space>
                  <FileText size={14} />
                  <Text strong>{FIELD_LABEL[field.field]}</Text>
                  <Tag color="green">+{field.additions}</Tag>
                  <Tag color="red">-{field.deletions}</Tag>
                </Space>
              }
              style={{ marginBottom: 12 }}
            >
              <div
                style={{
                  padding: 12,
                  background: '#f8fafc',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  lineHeight: 1.8,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {field.hunks.map((h, idx) => renderHunk(h, idx))}
              </div>
            </Card>
          ))}

          {mode === 'split' && fieldsToShow.map((field) => (
            <Card
              key={field.field}
              size="small"
              title={<Text strong>{FIELD_LABEL[field.field]}</Text>}
              style={{ marginBottom: 12 }}
            >
              <Row gutter={8}>
                <Col span={12}>
                  <Text type="secondary">v{fromVersion}</Text>
                  <Paragraph
                    style={{
                      padding: 8,
                      background: '#fef2f2',
                      borderRadius: 4,
                      fontSize: 13,
                      minHeight: 60,
                      whiteSpace: 'pre-wrap',
                      marginTop: 4,
                    }}
                  >
                    {field.before}
                  </Paragraph>
                </Col>
                <Col span={12}>
                  <Text type="secondary">v{toVersion}</Text>
                  <Paragraph
                    style={{
                      padding: 8,
                      background: '#ecfdf5',
                      borderRadius: 4,
                      fontSize: 13,
                      minHeight: 60,
                      whiteSpace: 'pre-wrap',
                      marginTop: 4,
                    }}
                  >
                    {field.after}
                  </Paragraph>
                </Col>
              </Row>
            </Card>
          ))}

          {mode === 'list' && (
            <Card size="small" title="变更列表">
              {fieldsToShow.map((field) => (
                <div key={field.field} style={{ marginBottom: 12 }}>
                  <Space>
                    <Tag color="blue">{FIELD_LABEL[field.field]}</Tag>
                    <Tag color="green">+{field.additions}</Tag>
                    <Tag color="red">-{field.deletions}</Tag>
                  </Space>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <Divider />
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        <Equal size={11} /> 绿色 = 新增内容，红色 = 删除内容，黑色 = 未变更内容。
        算法: 基于字段级 LCS (最长公共子序列) + 字符级 diff。
      </Paragraph>
    </Card>
  );
};

function renderHunk(h: DiffHunk, idx: number): React.ReactNode {
  if (h.type === 'equal') {
    return <span key={idx}>{h.text}</span>;
  }
  if (h.type === 'insert') {
    return (
      <span
        key={idx}
        style={{
          background: '#d1fae5',
          color: '#065f46',
          textDecoration: 'none',
          padding: '0 2px',
        }}
      >
        {h.text}
      </span>
    );
  }
  return (
    <span
      key={idx}
      style={{
        background: '#fee2e2',
        color: '#991b1b',
        textDecoration: 'line-through',
        padding: '0 2px',
      }}
    >
      {h.text}
    </span>
  );
}

export default DiffViewer;