import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Row,
  Col,
  Modal,
  Descriptions,
} from "antd";
import {
  Activity,
  Search,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RefreshCw,
  Plus,
  FileText,
} from "lucide-react";
import {
  radpathApi as radPathApi,
  type RadPathRecord,
  type RadPathStats,
} from "../../services/api/radpathApi";
import { message } from "antd";
import { ErrorBanner } from "../../components/feedback";
import { StatCard, StatCardGrid } from "../../components/common";
import { t } from "../../i18n/appI18n";

const consistencyColor: Record<string, string> = {
  concordant: "#10b981",
  discordant: "#ef4444",
  pending: "#94a3b8",
};
const consistencyLabel = (c: string): string => ({
  concordant: t('radPath.concordant'),
  discordant: t('radPath.discordant'),
  pending: t('radPath.pending'),
}[c] ?? c);

const RadPathPage: React.FC = () => {
  const [records, setRecords] = useState<RadPathRecord[]>([]);
  const [stats, setStats] = useState<RadPathStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<RadPathRecord | null>(
    null,
  );
  const [showDetail, setShowDetail] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchReportId, setMatchReportId] = useState("");
  const [matchPathologyId, setMatchPathologyId] = useState("");
  // [W2-C] 受控分页
  const [recordPage, setRecordPage] = useState(1);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await radPathApi.getRecords();
      if (res.success) { setRecords(res.data); setLoadError(null); }
      else setLoadError(t('w9.states.error'));
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
      setLoadError(t('w9.states.error'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await radPathApi.getStats();
      if (res.success) setStats(res.data);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchStats();
  }, [fetchRecords, fetchStats]);

  const handleMatch = async () => {
    if (!matchReportId || !matchPathologyId) return;
    try {
      const res = await radPathApi.matchReport(matchReportId, matchPathologyId);
      if (res.success) {
        message.success(t('radPath.matchSuccess'));
        setShowMatchModal(false);
        fetchRecords();
      }
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };

  const filteredRecords = records.filter(
    (r) =>
      !search ||
      r.reportId.toLowerCase().includes(search.toLowerCase()) ||
      r.report.patient.name.toLowerCase().includes(search.toLowerCase()),
  );

  const columns = [
    {
      title: t('radPath.colReportId'),
      dataIndex: "reportId",
      key: "reportId",
      render: (id: string) => (
        <span style={{ fontFamily: "monospace" }}>{id}</span>
      ),
    },
    {
      title: t('radPath.colPathologyId'),
      dataIndex: "pathologyId",
      key: "pathologyId",
      render: (id: string) => (
        <span style={{ fontFamily: "monospace" }}>{id}</span>
      ),
    },
    {
      title: t('radPath.colPatient'),
      key: "patient",
      render: (_: unknown, r: RadPathRecord) => r.report.patient.name,
    },
    {
      title: t('radPath.colExam'),
      key: "exam",
      render: (_: unknown, r: RadPathRecord) =>
        r.report.exam
          ? `${r.report.exam.modality}/${r.report.exam.bodyPart}`
          : "-",
    },
    {
      title: t('radPath.colConsistency'),
      dataIndex: "consistency",
      key: "consistency",
      render: (c: string) => (
        <Tag color={consistencyColor[c]}>{consistencyLabel(c)}</Tag>
      ),
    },
    {
      title: t('radPath.colActions'),
      key: "actions",
      render: (_: unknown, r: RadPathRecord) => (
        <Button
          size="small"
          onClick={() => {
            setSelectedRecord(r);
            setShowDetail(true);
          }}
        >
          {t('radPath.detail')}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Activity size={20} color="#8b5cf6" />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{t('radPath.title')}</h1>
        <Tag color="purple">{t('radPath.radPathTag')}</Tag>
      </div>
      {loadError && !loading && <ErrorBanner message={loadError} />}
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('radPath.totalComparisons')} value={stats?.total ?? records.length} icon={<FileText size={16} />} />
        <StatCard title={t('radPath.concordant')} value={stats?.concordant ?? 0} color="success" icon={<CheckCircle2 size={16} />} />
        <StatCard title={t('radPath.discordant')} value={stats?.discordant ?? 0} color="error" icon={<XCircle size={16} />} />
        <StatCard title={t('radPath.consistencyRate')} value={stats?.positiveConsistency ?? 0} suffix="%" icon={<TrendingUp size={16} />} />
      </StatCardGrid>
      <Card
        extra={
          <Space>
            <Input
              placeholder={t('radPath.search')}
              prefix={<Search size={14} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 200 }}
            />
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setShowMatchModal(true)}
            >
              {t('radPath.manualMatch')}
            </Button>
            <Button
              icon={<RefreshCw size={14} />}
              onClick={() => {
                fetchRecords();
                fetchStats();
              }}
            >
              {t('radPath.refresh')}
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={filteredRecords}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ current: recordPage, pageSize: 10, total: filteredRecords.length, onChange: setRecordPage, showSizeChanger: false, showTotal: (total) => t('radPath.totalItems', { count: total }) }}
          size="small"
        scroll={{ x: 'max-content' }}
        />
      </Card>
      <Modal
        title={t('radPath.detailTitle')}
        open={showDetail}
        onCancel={() => {
          setShowDetail(false);
          setSelectedRecord(null);
        }}
        footer={null}
        width={700}
      >
        {selectedRecord && (
          <div>
            <Descriptions
              bordered
              column={2}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label={t('radPath.colReportId')}>
                {selectedRecord.reportId}
              </Descriptions.Item>
              <Descriptions.Item label={t('radPath.colPathologyId')}>
                {selectedRecord.pathologyId}
              </Descriptions.Item>
              <Descriptions.Item label={t('radPath.colConsistency')}>
                <Tag color={consistencyColor[selectedRecord.consistency]}>
                  {consistencyLabel(selectedRecord.consistency)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('radPath.createdAt')}>
                {new Date(selectedRecord.createdAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
            </Descriptions>
            <Row gutter={16}>
              <Col span={12}>
                <Card size="small" title={t('radPath.imagingReport')}>
                  <div
                    style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}
                  >
                    {t('radPath.findings')}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      padding: 8,
                      background: "var(--bg-primary)",
                      borderRadius: 4,
                      minHeight: 60,
                    }}
                  >
                    {selectedRecord.radFinding ||
                      selectedRecord.report.findings}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      margin: "12px 0 4px",
                    }}
                  >
                    {t('radPath.conclusion')}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      padding: 8,
                      background: "var(--bg-primary)",
                      borderRadius: 4,
                    }}
                  >
                    {selectedRecord.report.conclusion}
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title={t('radPath.pathologyReport')}>
                  <div
                    style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}
                  >
                    {t('radPath.pathResult')}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      padding: 8,
                      background: "#f0fdf4",
                      borderRadius: 4,
                      minHeight: 100,
                    }}
                  >
                    {selectedRecord.pathResult}
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
      <Modal
        title={t('radPath.manualMatch')}
        open={showMatchModal}
        onOk={handleMatch}
        onCancel={() => {
          setShowMatchModal(false);
          setMatchReportId("");
          setMatchPathologyId("");
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>{t('radPath.colReportId')}</div>
          <Input
            value={matchReportId}
            onChange={(e) => setMatchReportId(e.target.value)}
            placeholder={t('radPath.reportIdPlaceholder')}
          />
        </div>
        <div>
          <div style={{ marginBottom: 8 }}>{t('radPath.colPathologyId')}</div>
          <Input
            value={matchPathologyId}
            onChange={(e) => setMatchPathologyId(e.target.value)}
            placeholder={t('radPath.pathologyIdPlaceholder')}
          />
        </div>
      </Modal>
    </div>
  );
};

export default RadPathPage;
