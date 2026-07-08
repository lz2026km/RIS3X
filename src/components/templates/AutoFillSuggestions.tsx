/**
 * G005 RIS v3.0.6.5 - 自动填充建议面板
 * 40 升级点 - 字段建议 / 来源标签 / 一键应用 / 置信度
 */
import React, { useMemo, useState, useCallback } from 'react';
import {
  Card, List, Tag, Space, Button, Tooltip, Empty, Statistic, Row, Col,
  Switch, Tabs, Badge, Alert,
} from 'antd';
import {
  Sparkles, ChevronRight, History, FlaskConical, Pill,
  Brain, User, BookOpen, Database, Shield as ShieldIcon, Check as CheckIcon, X, Wand2, FileText,
} from 'lucide-react';
import type { AutoFillContext, AutoFillSuggestion, AutoFillSource } from '@/types/templates/calculations';
import { AutoFillEngine } from '@services/templates/autoFill/AutoFillEngine';

const SOURCE_META: Record<AutoFillSource, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  'prior-report': { label: '既往报告', color: 'blue', icon: History },
  'emr-allergy': { label: 'EMR 过敏', color: 'red', icon: ShieldIcon },
  'emr-medication': { label: 'EMR 用药', color: 'purple', icon: Pill },
  'emr-diagnosis': { label: 'EMR 诊断', color: 'orange', icon: FileText },
  'emr-lab': { label: 'EMR 化验', color: 'cyan', icon: FlaskConical },
  'order': { label: '检查申请', color: 'geekblue', icon: BookOpen },
  'patient-demographics': { label: '人口学', color: 'green', icon: User },
  'study-history': { label: '检查史', color: 'lime', icon: Database },
  'similar-case': { label: '相似病例', color: 'magenta', icon: BookOpen },
  'protocol': { label: '协议默认', color: 'default', icon: BookOpen },
  'ai-prediction': { label: 'AI 预测', color: 'volcano', icon: Brain },
};

interface Props {
  context: AutoFillContext;
  onApply?: (suggestion: AutoFillSuggestion) => void;
  onApplyAll?: (suggestions: AutoFillSuggestion[]) => void;
}

export const AutoFillSuggestions: React.FC<Props> = ({ context, onApply, onApplyAll }) => {
  const engine = useMemo(() => AutoFillEngine.getInstance(), []);
  const [autoApply, setAutoApply] = useState(false);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'all' | 'high' | 'needs-approval'>('all');

  const suggestions = useMemo(
    () => engine.suggestAll(context),
    [engine, context],
  );

  const filtered = useMemo(() => {
    return suggestions.filter((s) => {
      if (dismissed.has(s.id)) return false;
      if (accepted.has(s.id)) return false;
      if (tab === 'high') return s.confidence >= 0.8;
      if (tab === 'needs-approval') return s.requiresApproval;
      return true;
    });
  }, [suggestions, accepted, dismissed, tab]);

  const summary = useMemo(() => {
    const high = suggestions.filter((s) => s.confidence >= 0.8 && !s.requiresApproval).length;
    const needs = suggestions.filter((s) => s.requiresApproval).length;
    return { total: suggestions.length, high, needs };
  }, [suggestions]);

  const handleAccept = useCallback((s: AutoFillSuggestion) => {
    setAccepted((prev) => new Set(prev).add(s.id));
    if (autoApply) onApply?.(s);
  }, [autoApply, onApply]);

  const handleDismiss = useCallback((s: AutoFillSuggestion) => {
    setDismissed((prev) => new Set(prev).add(s.id));
  }, []);

  const handleApplyAll = useCallback(() => {
    const ready = filtered.filter((s) => !s.requiresApproval);
    onApplyAll?.(ready);
    setAccepted((prev) => new Set([...prev, ...ready.map((s) => s.id)]));
  }, [filtered, onApplyAll]);

  return (
    <Card
      size="small"
      className="shadow-sm"
      title={
        <Space>
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>智能填充建议</span>
          <Badge count={summary.total} style={{ backgroundColor: '#8b5cf6' }} />
        </Space>
      }
      extra={
        <Space>
          <span className="text-xs text-slate-500">自动应用</span>
          <Switch size="small" checked={autoApply} onChange={setAutoApply} />
        </Space>
      }
    >
      <Row gutter={8} className="mb-2">
        <Col span={8}>
          <Statistic
            title="建议总数"
            value={summary.total}
            valueStyle={{ fontSize: 18, color: '#8b5cf6' }}
            prefix={<Wand2 className="w-4 h-4" />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="高置信度"
            value={summary.high}
            valueStyle={{ fontSize: 18, color: '#10b981' }}
            prefix={<CheckIcon className="w-4 h-4" />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="需审核"
            value={summary.needs}
            valueStyle={{ fontSize: 18, color: '#f59e0b' }}
            prefix={<ShieldIcon className="w-4 h-4" />}
          />
        </Col>
      </Row>

      <Tabs
        size="small"
        activeKey={tab}
        onChange={(k) => setTab(k as 'all' | 'high' | 'needs-approval')}
        items={[
          { key: 'all', label: `全部 (${suggestions.length})` },
          { key: 'high', label: `高置信度 (${summary.high})` },
          { key: 'needs-approval', label: `需审核 (${summary.needs})` },
        ]}
      />

      {filtered.length === 0 ? (
        <Empty description="暂无建议" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={filtered}
          size="small"
          renderItem={(s: AutoFillSuggestion) => {
            const meta = SOURCE_META[s.source]!;
            const Icon = meta.icon;
            return (
              <List.Item
                actions={[
                  <Tooltip key="accept" title="应用此建议">
                    <Button
                      type="text"
                      size="small"
                      icon={<CheckIcon className="w-4 h-4 text-green-500" />}
                      onClick={() => handleAccept(s)}
                    />
                  </Tooltip>,
                  <Tooltip key="dismiss" title="忽略">
                    <Button
                      type="text"
                      size="small"
                      icon={<X className="w-4 h-4 text-slate-400" />}
                      onClick={() => handleDismiss(s)}
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div
                      className="rounded-full p-1.5"
                      style={{ background: '#f3f4f6' }}
                    >
                      <Icon />
                    </div>
                  }
                  title={
                    <Space>
                      <span className="font-medium">{s.fieldLabel}</span>
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <span className="text-xs text-slate-400">
                        置信度 {Math.round(s.confidence * 100)}%
                      </span>
                      {s.requiresApproval && <Tag color="warning">需审核</Tag>}
                    </Space>
                  }
                  description={
                    <div>
                      <div className="text-xs text-slate-500">{s.rationale}</div>
                      {s.evidence && (
                        <Alert
                          type="info"
                          showIcon
                          className="mt-1"
                          message={<span className="text-xs">{s.evidence}</span>}
                        />
                      )}
                      {s.suggestedValue !== undefined && s.suggestedValue !== null && (
                        <div className="text-xs mt-1">
                          <span className="text-slate-400">建议值: </span>
                          <code className="px-1 bg-slate-100 rounded">{String(s.suggestedValue)}</code>
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}

      {filtered.length > 0 && (
        <div className="mt-3 flex justify-end">
          <Button type="primary" size="small" onClick={handleApplyAll} icon={<ChevronRight className="w-4 h-4" />}>
            批量应用高置信度建议
          </Button>
        </div>
      )}
    </Card>
  );
};

export default AutoFillSuggestions;
