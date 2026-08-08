import React from "react";
import { Card, Tag, Progress, Tooltip, Space, Badge } from "antd";
import { Brain, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { AiDiagnosis } from "../../types/eye";

const AiDiagnosisCard: React.FC<{ diagnosis: AiDiagnosis }> = ({
  diagnosis,
}) => (
  <Card
    size="small"
    style={{ marginBottom: 8, borderLeft: "4px solid #2563eb" }}
    title={
      <Space>
        <Brain size={16} />
        <span style={{ fontSize: 13 }}>
          {diagnosis.modelName} v{diagnosis.modelVersion}
        </span>
        <Tag color="cyan">{diagnosis.vendor}</Tag>
      </Space>
    }
    extra={
      diagnosis.reviewStatus === "pending" ? (
        <Tag icon={<Clock size={12} />} color="warning">
          待审核
        </Tag>
      ) : diagnosis.reviewStatus === "accepted" ? (
        <Tag icon={<CheckCircle size={12} />} color="success">
          已采纳
        </Tag>
      ) : (
        <Tag color="default">已修改</Tag>
      )
    }
  >
    <div style={{ fontSize: 13, marginBottom: 8 }}>
      <Badge
        status={
          diagnosis.severity === "severe"
            ? "error"
            : diagnosis.severity === "moderate"
              ? "warning"
              : "success"
        }
      />
      <strong>{diagnosis.primaryDiagnosis}</strong>
      <span style={{ marginLeft: 8, color: "#64748b" }}>
        ({Math.round(diagnosis.primaryConfidence * 100)}%)
      </span>
      {diagnosis.alerts.map((a, i) => (
        <Tag key={i} color="error" style={{ marginLeft: 8 }}>
          {a}
        </Tag>
      ))}
    </div>
    <div style={{ marginBottom: 8 }}>
      {diagnosis.findings.map((f, i) => (
        <div
          key={i}
          style={{ fontSize: 12, color: "#475569", padding: "2px 0" }}
        >
          • {f}
        </div>
      ))}
    </div>
    <div style={{ marginBottom: 8 }}>
      {diagnosis.classificationCards.map((c, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 0",
            borderTop: "1px solid #f1f5f9",
            fontSize: 12,
          }}
        >
          <span style={{ minWidth: 100, fontWeight: 500 }}>{c.condition}</span>
          <Progress
            percent={Math.round(c.probability * 100)}
            size="small"
            style={{ flex: 1, margin: 0 }}
            strokeColor={
              c.critical
                ? "#ef4444"
                : c.confidence > 0.8
                  ? "#22c55e"
                  : "#f59e0b"
            }
          />
          <span style={{ minWidth: 40 }}>{c.grade}</span>
          {c.critical && (
            <Tooltip title="危急">
              <AlertTriangle size={14} color="#ef4444" />
            </Tooltip>
          )}
        </div>
      ))}
    </div>
    <div
      style={{
        fontSize: 12,
        color: "#94a3b8",
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <span>处理时间: {(diagnosis.processingTimeMs / 1000).toFixed(1)}s</span>
      <span>建议: {diagnosis.recommendAction}</span>
    </div>
  </Card>
);
export default AiDiagnosisCard;
