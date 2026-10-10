import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Tag,
  Space,
  Select,
  Button,
  message,
} from "antd";
import { ArrowLeftRight, Eye, TrendingUp, TrendingDown, Trash2 } from "lucide-react";

import { eyeApi } from "@/services/api/eyeApi";
import { ErrorBanner } from "@/components/feedback";
import { ActionButton, ExportButton } from "@/components/common";
import { t } from "../../../i18n/appI18n";
import { DataTable } from "../../../components/common";

const ImageComparePage: React.FC = () => {
  const [pairIdx, setPairIdx] = useState(0);
  const [pairs, setPairs] = useState<any[]>([]);
  const [_loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await eyeApi.getComparison([]);
        if (!cancelled && res.success && Array.isArray(res.data)) {
          setPairs(res.data);
        } else if (!cancelled && !res.success) {
          setLoadError(t('w9.states.error'));
        }
      } catch { setLoadError(t('w9.states.error')); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const pair = pairs[pairIdx];

  if (!pair) {
    return (
      <div
        style={{
          padding: 'var(--space-4, 16px)',
          background: "var(--bg-card)",
          minHeight: "calc(100vh - 56px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          fontSize: 14,
        }}
      >
        {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
        {t('w9d.imageCompare.noData')}
      </div>
    );
  }

  // [G005 2B] 本地移除测量项
  const removeMeasurement = (parameter: string) => {
    if (!pair) return;
    setPairs(prev => prev.map((p, i) =>
      i === pairIdx
        ? { ...p, measurements: (p.measurements ?? []).filter((m: any) => m.parameter !== parameter) }
        : p,
    ));
    message.success(t('w9d.imageCompare.measureDeleted', { name: parameter }));
  };

  return (
    <div
      style={{
        padding: 'var(--space-4, 16px)',
        background: "var(--bg-card)",
        minHeight: "calc(100vh - 56px)",
      }}
    >
      <Row gutter={12}>
        <Col span={24} style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <Space>
            <ArrowLeftRight size={20} color="var(--color-primary-600)" />
            <span style={{ fontSize: 16, fontWeight: 600 }}>{t('w9d.imageCompare.title')}</span>
            <Select
              value={pairIdx}
              onChange={setPairIdx}
              style={{ width: 280 }}
              options={pairs.map((p, i) => ({
                value: i,
                label: `${p.patientName} - ${p.eyeSide === "OD" ? t('w9d.imageCompare.right') : t('w9d.imageCompare.left')}${t('w9d.imageCompare.eyeSuffix')} (${p.priorDate ? new Date(p.priorDate).toLocaleDateString() : "—"} vs ${p.currentDate ? new Date(p.currentDate).toLocaleDateString() : "—"})`,
              }))}
            />
            <ActionButton action="refresh" loading={_loading} onClick={() => setReloadTick((n) => n + 1)}>{t('w45.actions.refresh')}</ActionButton>
            <ExportButton
              data={() => pairs}
              filename="image-compare"
              label={t('w45.actions.export')}
              size="small"
              formats={["csv", "json"]}
            />
          </Space>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col span={7}>
          <Card
            size="small"
            title={
              <>
                <Eye size={14} /> {t('w9d.imageCompare.priorExam')}{" "}
                <Tag>{new Date(pair.priorDate).toLocaleDateString()}</Tag>
              </>
            }
          >
            <div
              style={{
                background: "#0f172a",
                height: 300,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
              }}
            >
              {t('w9d.imageCompare.priorImage')}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 'var(--space-1, 4px)' }}>
              {pair.priorModality}
            </div>
          </Card>
        </Col>
        <Col
          span={2}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeftRight size={28} color="var(--text-secondary)" />
        </Col>
        <Col span={7}>
          <Card
            size="small"
            title={
              <>
                <Eye size={14} /> {t('w9d.imageCompare.currentExam')}{" "}
                <Tag>{new Date(pair.currentDate).toLocaleDateString()}</Tag>
              </>
            }
          >
            <div
              style={{
                background: "#0f172a",
                height: 300,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
              }}
            >
              {t('w9d.imageCompare.currentImage')}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 'var(--space-1, 4px)' }}>
              {pair.currentModality}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title={t('w9d.imageCompare.compareMeasures')}>
            <DataTable
              dataSource={pair.measurements}
              rowKey="parameter"
              pagination={false}
              columns={[
                { title: t('w9d.imageCompare.colParam'), dataIndex: "parameter", key: "parameter" },
                {
                  title: t('w9d.imageCompare.colPrior'),
                  dataIndex: "priorValue",
                  key: "priorValue",
                  render: (v: number, r: any) => `${v} ${r.unit}`,
                },
                {
                  title: t('w9d.imageCompare.colCurrent'),
                  dataIndex: "currentValue",
                  key: "currentValue",
                  render: (v: number, r: any) => `${v} ${r.unit}`,
                },
                {
                  title: t('w9d.imageCompare.colChange'),
                  key: "change",
                  render: (_, r) => (
                    <Tag
                      color={
                        r.direction === "worsened"
                          ? "red"
                          : r.direction === "improved"
                            ? "green"
                            : "default"
                      }
                    >
                      {r.change > 0 ? "+" : ""}
                      {r.changePercent.toFixed(1)}%
                    </Tag>
                  ),
                },
                {
                  title: t('w9d.imageCompare.colTrend'),
                  key: "trend",
                  render: (_, r) =>
                    r.direction === "worsened" ? (
                      <TrendingDown size={14} color="var(--color-error-500)" />
                    ) : r.direction === "improved" ? (
                      <TrendingUp size={14} color="var(--color-success-500)" />
                    ) : (
                      <Eye size={14} color="var(--text-secondary)" />
                    ),
                },
                {
                  title: t('w9d.imageCompare.colAction'),
                  key: "action",
                  render: (_, r) => (
                    <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => removeMeasurement(r.parameter)}>{t('w9d.imageCompare.delete')}</Button>
                  ),
                },
              ]}
            scroll={{ x: 'max-content' }}
            />
          </Card>
          <Card size="small" title={t('w9d.imageCompare.aiProgression')} style={{ marginTop: 'var(--space-2, 8px)' }}>
            <div style={{ fontSize: 12, lineHeight: 1.8, color: "var(--text-secondary)" }}>
              {pair.aiProgression}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 'var(--space-2, 8px)' }}>
              {t('w9d.imageCompare.conclusion')}{" "}
              <Tag color={pair.conclusion.includes("进展") ? "red" : "green"}>
                {pair.conclusion}
              </Tag>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default ImageComparePage;
