/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AMEND 修订历史树
 * A5-REPORT / 40 点
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Tree, Tag, Space, Typography, Button, Tooltip, Empty, Alert, Row, Col, Statistic, Timeline, Badge } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { GitBranch, Edit, CheckCircle2, XCircle, Clock, User, RotateCcw, ShieldCheck, ArrowRight } from 'lucide-react';
import type { RevisionEntry, AmendAction } from '../../../../types/R3/R3.AMEND';
import { AMEND_COUNT_LIMIT } from '../../../../types/R3/R3.AMEND';
import { amendService } from '../../../../services/amend/amendService';

const { Title, Text, Paragraph } = Typography;

export interface RevisionHistoryProps {
  reportId: string;
  onSelect?: (revision: RevisionEntry) => void;
  onRollback?: (revision: RevisionEntry) => void;
  showTree?: boolean;
}

const ACTION_META: Record<AmendAction, { label: string; color: string; icon: React.ReactNode }> = {
  start: { label: '启动修订', color: 'blue', icon: <Edit size={12} /> },
  edit: { label: '编辑', color: 'cyan', icon: <Edit size={12} /> },
  approve: { label: '审批通过', color: 'green', icon: <CheckCircle2 size={12} /> },
  reject: { label: '驳回', color: 'red', icon: <XCircle size={12} /> },
  cosign: { label: '双签', color: 'purple', icon: <ShieldCheck size={12} /> },
  complete: { label: '完成', color: 'green', icon: <CheckCircle2 size={12} /> },
  abandon: { label: '放弃', color: 'default', icon: <XCircle size={12} /> },
  publish: { label: '发布', color: 'gold', icon: <CheckCircle2 size={12} /> },
  rollback: { label: '回滚', color: 'orange', icon: <RotateCcw size={12} /> },
  supplement: { label: '补充', color: 'magenta', icon: <Edit size={12} /> },
};

export const RevisionHistory: React.FC<RevisionHistoryProps> = ({
  reportId,
  onSelect,
  onRollback,
  showTree = true,
}) => {
  const [revisions, setRevisions] = useState<RevisionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    amendService
      .listRevisions(reportId)
      .then(setRevisions)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [reportId]);

  const treeData: DataNode[] = useMemo(() => {
    const map = new Map<number, DataNode>();
    revisions
      .slice()
      .sort((a, b) => a.version - b.version)
      .forEach((r) => {
        const meta = ACTION_META[r.action];
        const node: DataNode = {
          key: r.id,
          title: (
            <Space>
              <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>
              <Text>v{r.version}</Text>
              <Text>{r.authorName}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{new Date(r.createdAt).toLocaleString('zh-CN')}</Text>
              {r.reSignedAt && <Tag color="green">已重签</Tag>}
            </Space>
          ),
          children: [],
        };
        map.set(r.version, node);
        if (r.parentVersion !== undefined && map.has(r.parentVersion)) {
          map.get(r.parentVersion)!.children!.push(node);
        }
      });
    return Array.from(map.values()).filter(
      (n) => !revisions.some((r) => r.version !== n.key && map.get(r.version)?.children?.includes(n))
    );
  }, [revisions]);

  const stats = useMemo(() => {
    const total = revisions.length;
    const completed = revisions.filter((r) => r.action === 'complete').length;
    const rolledBack = revisions.filter((r) => r.action === 'rollback').length;
    const lastVersion = total > 0 ? Math.max(...revisions.map((r) => r.version)) : 0;
    return { total, completed, rolledBack, lastVersion };
  }, [revisions]);

  const remaining = AMEND_COUNT_LIMIT - revisions.length;

  return (
    <Card
      title={
        <Space>
          <GitBranch size={18} />
          <span>修订历史树</span>
          {revisions.length > 0 && <Tag color={remaining > 0 ? 'blue' : 'red'}>已修订 {revisions.length}/{AMEND_COUNT_LIMIT}</Tag>}
        </Space>
      }
      extra={
        <Space>
          <Button onClick={() => void amendService.listRevisions(reportId).then(setRevisions)} loading={loading}>
            刷新
          </Button>
        </Space>
      }
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Statistic title="修订总数" value={stats.total} suffix={`/ ${AMEND_COUNT_LIMIT}`} />
        </Col>
        <Col span={6}>
          <Statistic title="已完成" value={stats.completed} prefix={<CheckCircle2 size={14} />} styles={{ content: {  color: '#10b981'  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="回滚" value={stats.rolledBack} prefix={<RotateCcw size={14} />} styles={{ content: {  color: '#f59e0b'  } }} />
        </Col>
        <Col span={6}>
          <Statistic title="最新版本" value={`v${stats.lastVersion}`} />
        </Col>
      </Row>

      {remaining === 0 && (
        <Alert type="warning" showIcon title={`已达到修订次数上限 ${AMEND_COUNT_LIMIT}，无法继续修订`} style={{ marginBottom: 12 }} />
      )}

      {revisions.length === 0 ? (
        <Empty description={loading ? '加载中...' : '暂无修订历史'} />
      ) : (
        <>
          {showTree && treeData.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>修订树</Title>
              <Tree
                treeData={treeData}
                defaultExpandAll
                showLine
                onSelect={(keys) => {
                  if (keys[0]) {
                    const found = revisions.find((r) => r.id === keys[0]);
                    if (found) onSelect?.(found);
                  }
                }}
              />
            </div>
          )}

          <Title level={5}>修订时间线</Title>
          <Timeline
            items={revisions
              .slice()
              .sort((a, b) => b.version - a.version)
              .map((r) => {
                const meta = ACTION_META[r.action];
                return {
                  dot: meta.icon,
                  color: meta.color,
                  children: (
                    <Space orientation="vertical" size={2}>
                      <Space>
                        <Tag color={meta.color}>{meta.label}</Tag>
                        <Text strong>v{r.version}</Text>
                        {r.reSignedAt && <Tag color="green" icon={<ShieldCheck size={10} />}>已重签</Tag>}
                        {r.cosignId && <Tag color="purple">双签</Tag>}
                      </Space>
                      <Text>{r.reason}</Text>
                      <Space size={4}>
                        <User size={12} />
                        <Text type="secondary">{r.authorName} ({r.authorTitle})</Text>
                        <Clock size={12} />
                        <Text type="secondary">{new Date(r.createdAt).toLocaleString('zh-CN')}</Text>
                      </Space>
                      {onRollback && r.action === 'complete' && (
                        <Button size="small" icon={<RotateCcw size={12} />} onClick={() => onRollback(r)}>
                          回滚到此版本
                        </Button>
                      )}
                    </Space>
                  ),
                };
              })}
          />
        </>
      )}
    </Card>
  );
};

export default RevisionHistory;