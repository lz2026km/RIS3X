/**
 * G005 RIS v3.0.6.6 - PACS 驱动自动检测面板
 * 显示最近收到的 SR TID 1500 测量,命中自动检测规则时高亮提示
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Tag, Space, Row, Col, Statistic, Table, Button, Alert, Empty,
  Drawer, Descriptions, message,
} from 'antd';
import { Cpu, Activity, Zap, AlertOctagon, RefreshCw, FlaskConical } from 'lucide-react';
import { autoDetector } from '../../services/critical/autoDetect/AutoDetector';
import type { AutoDetectInput, AutoDetectResult } from '../../services/critical/autoDetect/AutoDetector';
import type { DicomSrDocument } from '../../services/critical/autoDetect/SrTid1500Parser';
import { srTid1500Parser } from '../../services/critical/autoDetect/SrTid1500Parser';

const SEVERITY_META = {
  critical: { color: '#7f1d1d', bg: '#fee2e2', label: '危急' },
  urgent: { color: '#dc2626', bg: '#fef2f2', label: '紧急' },
  warning: { color: '#f59e0b', bg: '#fef3c7', label: '警告' },
  info: { color: '#3b82f6', bg: '#dbeafe', label: '提示' },
};

const MOCK_STUDIES: AutoDetectInput[] = [
  {
    studyInstanceUid: 'study-001',
    patientId: 'P-2001',
    patientName: '赵明',
    modality: 'CT',
    bodyPart: '胸部',
    examDate: new Date().toISOString(),
    measurements: srTid1500Parser.parse({
      measurements: [
        { path: '心率', conceptCode: '8867-4', conceptName: '心率', value: 138, unit: 'bpm', refLow: 60, refHigh: 100, type: 'numeric' },
        { path: '收缩压', conceptCode: '8480-6', conceptName: '收缩压', value: 198, unit: 'mmHg', refLow: 90, refHigh: 140, type: 'numeric' },
        { path: '血红蛋白', conceptCode: '718-7', conceptName: '血红蛋白', value: 55, unit: 'g/L', refLow: 120, refHigh: 160, type: 'numeric' },
      ],
    }),
    freeText: '主动脉夹层 Debakey I 型,累及升主动脉,心包积液',
  },
  {
    studyInstanceUid: 'study-002',
    patientId: 'P-2002',
    patientName: '钱星',
    modality: 'CT',
    bodyPart: '头颅',
    examDate: new Date(Date.now() - 5 * 60_000).toISOString(),
    measurements: srTid1500Parser.parse({
      measurements: [
        { path: '心率', conceptCode: '8867-4', conceptName: '心率', value: 78, unit: 'bpm', refLow: 60, refHigh: 100, type: 'numeric' },
      ],
    }),
    freeText: '左侧基底节区脑出血,周围水肿带,占位效应轻',
  },
];

export interface AutoDetectPanelProps {
  /** 注入检测数据,默认使用 Mock */
  studies?: AutoDetectInput[];
  /** 点击"创建危急值" 回调 */
  onCreateCritical?: (input: AutoDetectInput, result: AutoDetectResult) => void;
}

export const AutoDetectPanel: React.FC<AutoDetectPanelProps> = ({ studies = MOCK_STUDIES, onCreateCritical }) => {
  const [tick, setTick] = useState(0);
  const [drawer, setDrawer] = useState<{ open: boolean; input?: AutoDetectInput; doc?: DicomSrDocument }>({ open: false });

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const detected = useMemo(() => {
    void tick;
    return studies
      .map((s) => ({ input: s, hits: autoDetector.detect(s, autoDetector.defaultRules()) }))
      .filter((r) => r.hits.length > 0);
  }, [studies, tick]);

  const stats = useMemo(() => {
    const total = studies.length;
    const triggered = detected.length;
    const critical = detected.filter((d) => d.hits.some((h) => h.criticalHint.severity === 'critical')).length;
    return { total, triggered, critical };
  }, [studies, detected]);

  return (
    <Card
      size="small"
      data-testid="auto-detect-panel"
      title={
        <Space>
          <Cpu size={16} color="#7c3aed" />
          <strong>PACS 自动危急值检测</strong>
          <Tag color="purple">SR TID 1500</Tag>
          <Tag color="cyan">real-time</Tag>
        </Space>
      }
      extra={
        <Button size="small" icon={<RefreshCw size={12} />} onClick={() => setTick((n) => n + 1)}>
          刷新
        </Button>
      }
    >
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Statistic
            title="监听中研究"
            value={stats.total}
            prefix={<FlaskConical size={14} />}
            styles={{ content: {  fontSize: 18  } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="触发检测"
            value={stats.triggered}
            prefix={<Zap size={14} color="#f59e0b" />}
            styles={{ content: {  fontSize: 18, color: '#f59e0b'  } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="命中危急"
            value={stats.critical}
            prefix={<AlertOctagon size={14} color="#dc2626" />}
            styles={{ content: {  fontSize: 18, color: '#dc2626'  } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="检测时延"
            value="<1"
            suffix="s"
            prefix={<Activity size={14} />}
            styles={{ content: {  fontSize: 18, color: '#10b981'  } }}
          />
        </Col>
      </Row>

      {detected.length === 0 ? (
        <Empty description="暂无自动检测命中" />
      ) : (
        <Space orientation="vertical" style={{ width: '100%' }} size={6}>
          {detected.map(({ input, hits }) => {
            const top = hits[0]!;
            const m = SEVERITY_META[top.criticalHint.severity];
            return (
              <div
                key={input.studyInstanceUid}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: m.bg,
                  borderLeft: `4px solid ${m.color}`,
                  cursor: 'pointer',
                }}
                onClick={() => setDrawer({ open: true, input, doc: input.measurements })}
              >
                <Row align="middle" gutter={8}>
                  <Col flex="auto">
                    <Space wrap>
                      <Tag color={m.color}>{m.label}</Tag>
                      <strong>{input.patientName}</strong>
                      <Tag>{input.modality} · {input.bodyPart}</Tag>
                      <Tag color="purple">{top.criticalHint.ruleCode}</Tag>
                    </Space>
                    <div style={{ fontSize: 12, color: '#1f2937', marginTop: 4 }}>
                      <strong>{top.criticalHint.ruleName}</strong> · {top.criticalHint.detail}
                    </div>
                  </Col>
                  <Col flex="100px" style={{ textAlign: 'right' }}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<Zap size={10} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateCritical?.(input, top);
                        message.success('已提交危急值创建');
                      }}
                    >
                      创建危急值
                    </Button>
                  </Col>
                </Row>
              </div>
            );
          })}
        </Space>
      )}

      <Drawer
        open={drawer.open}
        onClose={() => setDrawer({ open: false })}
        title={
          <Space>
            <FlaskConical size={16} />
            <span>SR TID 1500 测量详情</span>
          </Space>
        }
        width={520}
      >
        {drawer.input && (
          <Space orientation="vertical" style={{ width: '100%' }} size={12}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Study UID">{drawer.input.studyInstanceUid}</Descriptions.Item>
              <Descriptions.Item label="患者">{drawer.input.patientName}</Descriptions.Item>
              <Descriptions.Item label="检查">{drawer.input.modality} · {drawer.input.bodyPart}</Descriptions.Item>
              <Descriptions.Item label="时间">{new Date(drawer.input.examDate).toLocaleString()}</Descriptions.Item>
            </Descriptions>
            <Alert
              type="info"
              title="DICOM SR TID 1500 Measurable 文档已自动解析"
              description={`来源: ${drawer.doc?.sopInstanceUid ?? '-'}`}
              showIcon
            />
            <Table
              size="small"
              rowKey={(r) => `${r.path}-${r.conceptCode}`}
              dataSource={drawer.doc?.measurements ?? []}
              pagination={false}
              columns={[
                { title: '测量', dataIndex: 'conceptName', width: 100 },
                { title: '数值', dataIndex: 'value', width: 80, render: (v: number) => <strong>{v}</strong> },
                { title: '单位', dataIndex: 'unit', width: 80 },
                {
                  title: '参考',
                  width: 110,
                  render: (_: unknown, r) => r.refLow !== undefined && r.refHigh !== undefined
                    ? `${r.refLow}-${r.refHigh}`
                    : '-',
                },
                {
                  title: '异常',
                  dataIndex: 'abnormal',
                  width: 80,
                  render: (a: string | undefined) =>
                    a === 'low' ? <Tag color="blue">低</Tag>
                    : a === 'high' ? <Tag color="red">高</Tag>
                    : a === 'normal' ? <Tag color="green">正常</Tag>
                    : <Tag>-</Tag>,
                },
              ]}
            />
          </Space>
        )}
      </Drawer>
    </Card>
  );
};

export default AutoDetectPanel;