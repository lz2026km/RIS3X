import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Space, Tag, Descriptions, Steps, Divider, message } from "antd";
import { Activity, Clock, ArrowRight, GitBranch } from "lucide-react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { iheApi } from "../../services/api/integrationApi";
import type { VisitState } from "../../services/api/integrationApi";
import {
  LoadingBanner,
  ErrorBanner,
  AppEmpty,
} from "../../components/feedback";
import { ActionButton, DataTable, ExportButton } from "../../components/common";
import { FilterBar } from "../../components/common/FilterBar";
import { t } from "../../i18n/appI18n";
import { PageContainer } from "../../components/common";

const STATE_STEPS = [
  {
    key: "registered",
    titleKey: "visitDetail.state.registered",
    color: "default",
  },
  { key: "admitted", titleKey: "visitDetail.state.admitted", color: "blue" },
  {
    key: "inProgress",
    titleKey: "visitDetail.state.inProgress",
    color: "processing",
  },
  { key: "completed", titleKey: "visitDetail.state.completed", color: "green" },
  { key: "discharged", titleKey: "visitDetail.state.discharged", color: "red" },
];

const STATE_MAP: Record<string, number> = {
  registered: 0,
  admitted: 1,
  inProgress: 2,
  completed: 3,
  discharged: 4,
};

export const VisitDetailPage: React.FC = () => {
  const { patientId, visitNumber } = useParams<{
    patientId: string;
    visitNumber: string;
  }>();
  const navigate = useNavigate();
  const [visit, setVisit] = useState<VisitState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // [v3.0.6.16-6] ADT 消息筛选 (关键词/时间范围/消息类型)
  const [keyword, setKeyword] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);

  const adtMessages = visit?.adtMessages ?? [];

  const filteredAdtMessages = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return adtMessages.filter((m) => {
      const matchKw =
        !kw ||
        [m.id, m.messageType, m.content].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(kw),
        );
      const matchType =
        !filterValues.messageType || m.messageType === filterValues.messageType;
      let matchDate = true;
      if (dateRange && (dateRange[0] || dateRange[1])) {
        const d = dayjs(m.timestamp);
        if (!d.isValid()) matchDate = false;
        else {
          if (dateRange[0] && d.isBefore(dateRange[0].startOf("day")))
            matchDate = false;
          if (dateRange[1] && d.isAfter(dateRange[1].endOf("day")))
            matchDate = false;
        }
      }
      return matchKw && matchType && matchDate;
    });
  }, [adtMessages, keyword, filterValues, dateRange]);

  const adtTypeOptions = useMemo(
    () =>
      Array.from(new Set(adtMessages.map((m) => m.messageType)))
        .filter(Boolean)
        .map((v) => ({ value: String(v), label: `ADT^${v}` })),
    [adtMessages],
  );

  useEffect(() => {
    if (patientId && visitNumber) loadVisit();
  }, [patientId, visitNumber]);

  const loadVisit = async () => {
    if (!patientId || !visitNumber) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await iheApi.getVisitDetail(patientId, visitNumber);
      if (res.success) {
        setVisit(res.data);
      } else {
        setVisit({
          patientId,
          visitNumber,
          status: "inProgress",
          classCode: "AMB",
          admitDateTime: "2026-07-12 08:00:00",
          adtMessages: [
            {
              id: "1",
              messageType: "A01",
              timestamp: "2026-07-12 08:00:00",
              content: "MSH|^~\\&|...",
            },
            {
              id: "2",
              messageType: "A08",
              timestamp: "2026-07-12 09:15:00",
              content: "MSH|^~\\&|...",
            },
            {
              id: "3",
              messageType: "A08",
              timestamp: "2026-07-12 09:30:00",
              content: "MSH|^~\\&|...",
            },
          ],
        });
        setLoadError(t("w9.states.error"));
        message.warning(t("visitDetail.loadFailedDemo"));
      }
    } catch {
      setLoadError(t("w9.states.error"));
    } finally {
      setLoading(false);
    }
  };

  const currentIdx = visit
    ? (STATE_MAP[visit.status as keyof typeof STATE_MAP] ?? 0)
    : 0;

  return (
    <PageContainer
      maxWidth="full"
      padding="var(--space-6, 24px)"
      style={{ background: "var(--bg-primary)" }}
    >
      <Space style={{ marginBottom: "var(--space-4, 16px)" }}>
        <GitBranch size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          {t("visitDetail.title")}
        </span>
        <Tag color="cyan">v3.0.6.0</Tag>
        <Tag color="blue">{patientId}</Tag>
        <Tag color="purple">{visitNumber}</Tag>
        <ActionButton action="cancel" onClick={() => navigate(-1)}>
          {t("w45.visitDetail.back")}
        </ActionButton>
        <ActionButton
          action="refresh"
          loading={loading}
          onClick={() => void loadVisit()}
        >
          {t("w45.actions.refresh")}
        </ActionButton>
        <ExportButton
          data={() => visit?.adtMessages ?? []}
          filename={`visit-${patientId}-${visitNumber}`}
          label={t("w45.actions.export")}
          size="small"
          formats={["csv", "json"]}
        />
      </Space>

      {loading && <LoadingBanner message={t("w9.states.loading")} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {!visit && !loading && !loadError && <AppEmpty variant="no-data" />}

      {visit && (
        <Space orientation="vertical" style={{ width: "100%" }} size={16}>
          <Card
            size="small"
            title={
              <Space>
                <Activity size={14} />
                {t("visitDetail.stateMachine")}
              </Space>
            }
          >
            <Steps
              current={currentIdx}
              size="small"
              items={STATE_STEPS.map((s, i) => ({
                title: t(s.titleKey),
                status:
                  i < currentIdx
                    ? "finish"
                    : i === currentIdx
                      ? "process"
                      : "wait",
                description:
                  i === currentIdx ? t("visitDetail.current") : undefined,
              }))}
            />
            <Divider />
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "var(--space-2, 8px)",
                flexWrap: "wrap",
              }}
            >
              {STATE_STEPS.map((s, i) => (
                <React.Fragment key={s.key}>
                  <Tag
                    color={i <= currentIdx ? s.color : "default"}
                    style={{
                      padding: "4px 12px",
                      fontWeight: i <= currentIdx ? 600 : 400,
                      opacity: i <= currentIdx ? 1 : 0.4,
                    }}
                  >
                    {t(s.titleKey)}
                  </Tag>
                  {i < STATE_STEPS.length - 1 && (
                    <ArrowRight
                      size={14}
                      style={{ color: "#d9d9d9", alignSelf: "center" }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </Card>

          <Card
            size="small"
            title={
              <span>
                <Clock
                  size={14}
                  style={{ marginRight: "var(--space-1, 4px)" }}
                />
                {t("visitDetail.timestamps")}
              </span>
            }
          >
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label={t("visitDetail.admit")}>
                {visit?.admitDateTime ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label={t("visitDetail.inProgress")}>
                {visit?.inProgressAt ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label={t("visitDetail.completed")}>
                {visit?.completedAt ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label={t("visitDetail.discharge")}>
                {visit?.dischargeDateTime ?? "-"}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            size="small"
            title={
              <span>
                <GitBranch
                  size={14}
                  style={{ marginRight: "var(--space-1, 4px)" }}
                />
                {t("visitDetail.adtMessages")}
              </span>
            }
          >
            <FilterBar
              searchPlaceholder="搜索消息类型/内容..."
              searchValue={keyword}
              onSearchChange={setKeyword}
              dateRange={{ value: dateRange, onChange: setDateRange }}
              filters={[
                {
                  key: "messageType",
                  label: t("visitDetail.col.messageType"),
                  options: adtTypeOptions,
                },
              ]}
              filterValues={filterValues}
              onFilterChange={(k, v) =>
                setFilterValues((prev) => ({ ...prev, [k]: v }))
              }
              onReset={() => {
                setKeyword("");
                setFilterValues({});
                setDateRange(null);
              }}
              summary={`共 ${filteredAdtMessages.length} 条`}
            />
            <DataTable
              dataSource={filteredAdtMessages}
              rowKey="id"
              pagination={false}
              scroll={{ x: "max-content" }}
              columns={[
                { title: t("visitDetail.col.id"), dataIndex: "id", width: 60 },
                {
                  title: t("visitDetail.col.messageType"),
                  dataIndex: "messageType",
                  render: (mt: string) => <Tag color="blue">ADT^{mt}</Tag>,
                },
                {
                  title: t("visitDetail.col.timestamp"),
                  dataIndex: "timestamp",
                },
                {
                  title: t("visitDetail.col.content"),
                  dataIndex: "content",
                  render: (c: string) => (
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: 11,
                        background: "var(--bg-card)",
                        padding: "2px 6px",
                        borderRadius: 3,
                      }}
                    >
                      {c.slice(0, 50)}
                      {c.length > 50 ? "..." : ""}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </Space>
      )}
    </PageContainer>
  );
};

export default VisitDetailPage;
