import React from "react";
import { Card, Tag, Space, Timeline, Badge } from 'antd';
import { AlertTriangle, UserCheck } from 'lucide-react';
import type { CriticalValue } from "../../types/eye";

const CriticalValueAlert: React.FC<{ items: CriticalValue[] }> = ({
  items,
}) => {
  if (!items || items.length === 0) return null;
  const openItems = items.filter(
    (i) => i.status === "open" || i.status === "acknowledged",
  );
  return (
    <Card
      size="small"
      title={
        <Space>
          <AlertTriangle size={16} color="var(--color-error-500)" />
          <span>危急值 ({openItems.length})</span>
        </Space>
      }
      style={{ borderLeft: "4px solid var(--color-error-500)", marginBottom: 'var(--space-2, 8px)' }}
    >
      <Timeline
        items={items.slice(0, 5).map((cv) => ({
          color:
            cv.severity === "emergent"
              ? "red"
              : cv.severity === "urgent"
                ? "orange"
                : "blue",
          children: (
            <div style={{ fontSize: 12 }}>
              <div>
                <strong>{cv.patientName}</strong>{" "}
                <Tag
                  color={
                    cv.severity === "emergent"
                      ? "red"
                      : cv.severity === "urgent"
                        ? "orange"
                        : "blue"
                  }
                  style={{ fontSize: 12 }}
                >
                  {cv.category}
                </Tag>
              </div>
              <div style={{ color: "#475569", margin: "2px 0" }}>
                {cv.finding}
              </div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 12,
                  display: "flex",
                  gap: 'var(--space-3, 12px)',
                }}
              >
                <span>{new Date(cv.createdAt).toLocaleString()}</span>
                <span>{cv.createdBy}</span>
                <Badge
                  status={
                    cv.status === "open"
                      ? "error"
                      : cv.status === "acknowledged"
                        ? "processing"
                        : "success"
                  }
                  text={
                    cv.status === "open"
                      ? "未处理"
                      : cv.status === "acknowledged"
                        ? "已确认"
                        : "已处理"
                  }
                />
                {cv.acknowledgedBy && (
                  <span>
                    <UserCheck size={12} /> {cv.acknowledgedBy}
                  </span>
                )}
              </div>
            </div>
          ),
        }))}
      />
    </Card>
  );
};
export default CriticalValueAlert;
