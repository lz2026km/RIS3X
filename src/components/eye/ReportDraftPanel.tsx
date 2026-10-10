import React from "react";
import { MOCK_REPORT_AUDIT } from "../../data/eyeImageQcMock";
import { Card, Tag, Timeline, Space, Empty } from "antd";
import {
  History,
  FileText,
  CheckCircle,
  Printer,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Inbox } from 'lucide-react'

const actionIcon: Record<string, React.ReactNode> = {
  created: <FileText size={14} />,
  amended: <FileText size={14} color="var(--color-warning-500)" />,
  reviewed: <CheckCircle size={14} color="var(--color-success-500)" />,
  published: <CheckCircle size={14} color="var(--color-primary-600)" />,
  printed: <Printer size={14} color="#64748b" />,
  critical_value: <AlertTriangle size={14} color="var(--color-error-500)" />,
  reverted: <RotateCcw size={14} color="#f97316" />,
};
const actionColor: Record<string, string> = {
  created: "blue",
  amended: "orange",
  reviewed: "green",
  published: "blue",
  printed: "gray",
  critical_value: "red",
  reverted: "orange",
};

const ReportDraftPanel: React.FC<{ reportId: string }> = ({ reportId }) => {
  const entries = MOCK_REPORT_AUDIT.filter(
    (e) => e.reportId === reportId,
  ).slice(-8);
  if (entries.length === 0)
    return (
      <Card size="small" title="报告历史">
        <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无历史" />
      </Card>
    );
  return (
    <Card
      size="small"
      title={
        <Space>
          <History size={14} />
          报告历史 ({entries.length})
        </Space>
      }
    >
      <Timeline
        items={entries.reverse().map((e) => ({
          color: actionColor[e.action] || "gray",
          children: (
            <div style={{ fontSize: 12 }}>
              <Tag icon={actionIcon[e.action]} color={actionColor[e.action]}>
                v{e.version} {e.action}
              </Tag>
              <span style={{ marginLeft: 'var(--space-1, 4px)' }}>{e.userName}</span>
              <div style={{ color: "#64748b" }}>
                {new Date(e.timestamp).toLocaleString()}
              </div>
              {e.changes && (
                <div style={{ color: "#475569" }}>修改: {e.changes}</div>
              )}
              {e.notes && (
                <div style={{ color: "#94a3b8" }}>备注: {e.notes}</div>
              )}
            </div>
          ),
        }))}
      />
    </Card>
  );
};
export default ReportDraftPanel;
