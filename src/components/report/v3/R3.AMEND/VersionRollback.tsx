/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AMEND 版本回滚
 * A5-REPORT / 20 点
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, Space, Typography, Select, Button, Alert, Descriptions, Tag, Modal, message, Row, Col, Statistic } from 'antd';
import { RotateCcw, Clock, User, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { RevisionEntry, ReportSnapshot } from '../../../../types/R3/R3.AMEND';
import { AMEND_COUNT_LIMIT } from '../../../../types/R3/R3.AMEND';
import { amendService } from '../../../../services/amend/amendService';

const { Title, Text, Paragraph } = Typography;

export interface VersionRollbackProps {
  reportId: string;
  onRollbackComplete?: (revision: RevisionEntry) => void;
}

export const VersionRollback: React.FC<VersionRollbackProps> = ({ reportId, onRollbackComplete }) => {
  const [revisions, setRevisions] = useState<RevisionEntry[]>([]);
  const [targetVersion, setTargetVersion] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    void loadRevisions();
  }, [reportId]);

  const loadRevisions = async () => {
    setLoading(true);
    try {
      const list = await amendService.listRevisions(reportId);
      setRevisions(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const completed = useMemo(
    () => revisions.filter((r) => r.action === 'complete' || r.action === 'edit'),
    [revisions]
  );

  const target = useMemo(
    () => completed.find((r) => r.version === targetVersion),
    [completed, targetVersion]
  );

  const handleRollback = async () => {
    if (!targetVersion) {
      message.warning('请先选择目标版本');
      return;
    }
    try {
      const result = await amendService.rollbackToVersion(reportId, targetVersion);
      message.success(`已回滚到 v${targetVersion}，新版本 v${result.version}`);
      onRollbackComplete?.(result);
      setConfirmOpen(false);
      void loadRevisions();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const remaining = AMEND_COUNT_LIMIT - revisions.length;

  return (
    <Card
      title={
        <Space>
          <RotateCcw size={18} />
          <span>版本回滚</span>
        </Space>
      }
      style={{ width: '100%' }}
    >
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={8}>
          <Statistic title="可回滚版本" value={completed.length} prefix={<Clock size={14} />} />
        </Col>
        <Col span={8}>
          <Statistic
            title="剩余修订次数"
            value={remaining}
            suffix={`/ ${AMEND_COUNT_LIMIT}`}
            styles={{ content: {  color: remaining > 0 ? '#10b981' : '#ef4444'  } }}
          />
        </Col>
        <Col span={8}>
          <Statistic title="当前最新版本" value={`v${Math.max(0, ...revisions.map((r) => r.version))}`} />
        </Col>
      </Row>

      <Alert
        type="warning"
        showIcon
        icon={<ShieldAlert size={16} />}
        message="回滚说明"
        description="回滚将创建一个新版本，将当前报告恢复到目标版本的内容。原版本快照将保留在修订历史中。"
        style={{ marginBottom: 12 }}
      />

      <Space orientation="vertical" style={{ width: '100%' }}>
        <div>
          <Text strong>选择回滚目标版本</Text>
          <Select
            value={targetVersion}
            onChange={setTargetVersion}
            placeholder="选择要回滚到的版本"
            style={{ width: '100%', marginTop: 4 }}
          >
            {completed.map((r) => (
              <Select.Option key={r.id} value={r.version}>
                v{r.version} - {r.authorName} - {new Date(r.createdAt).toLocaleString('zh-CN')}
              </Select.Option>
            ))}
          </Select>
        </div>

        {target && target.postSnapshot && (
          <Card size="small" type="inner" title={`v${target.version} 快照内容`}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="影像所见">
                <Paragraph style={{ fontSize: 12, marginBottom: 0 }} ellipsis={{ rows: 3, expandable: true }}>
                  {target.postSnapshot.examFindings}
                </Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="诊断">
                <Text>{target.postSnapshot.diagnosis}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="诊断意见">
                <Paragraph style={{ fontSize: 12, marginBottom: 0 }} ellipsis={{ rows: 2, expandable: true }}>
                  {target.postSnapshot.impression}
                </Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="质量分">
                <Tag color="blue">{target.postSnapshot.qualityScore}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="快照时间">
                <Text type="secondary">{new Date(target.postSnapshot.capturedAt).toLocaleString('zh-CN')}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Button
          type="primary"
          danger
          icon={<RotateCcw size={14} />}
          onClick={() => setConfirmOpen(true)}
          disabled={!targetVersion}
          block
        >
          回滚到 v{targetVersion ?? '-'}
        </Button>
      </Space>

      <Modal
        title={
          <Space>
            <ShieldAlert size={18} color="#f59e0b" />
            <span>确认回滚</span>
          </Space>
        }
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={handleRollback}
        okText="确认回滚"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Paragraph>
          确认将报告 <Text strong>{reportId}</Text> 回滚到 <Text strong>v{targetVersion}</Text> 吗？
        </Paragraph>
        <Paragraph type="warning">
          回滚后将创建一个新版本，原报告内容会被覆盖。剩余修订次数: {remaining} / {AMEND_COUNT_LIMIT}
        </Paragraph>
      </Modal>
    </Card>
  );
};

export default VersionRollback;