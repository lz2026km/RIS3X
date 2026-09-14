import { usePagination } from "../../hooks/usePagination";
import { wadoRsApi } from "../../services/api/wadoRsApi";
import { WadoRsSeries, WadoRsStudy } from '../../services/api/wadoRsApi'
import {
  Card,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Button,
  Input,
  Spin,
  Alert,
  Typography,
  message,
  Modal,
  List,
} from "antd";
import { Globe, Search, Download, RefreshCw, Loader2 } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { t } from "../../i18n/appI18n";

const { Text } = Typography;

const WadoRsPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [studies, setStudies] = useState<WadoRsStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrieving, setRetrieving] = useState<string | null>(null);
  const [retrieveResult, setRetrieveResult] = useState<WadoRsStudy | null>(null);
  const [seriesList, setSeriesList] = useState<WadoRsSeries[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await wadoRsApi.queryStudies();
      if (res.success) {
        setStudies(res.data ?? []);
      } else {
        setError(res.error?.message ?? t("wadoRs.loadFailed"));
        setStudies([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? t("wadoRs.loadFailed"));
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRetrieve = async (study: WadoRsStudy) => {
    setRetrieving(study.studyInstanceUid);
    setError("");
    try {
      const res = await wadoRsApi.getStudy(study.studyInstanceUid);
      if (res.success && res.data) {
        setRetrieveResult(res.data);
        setSeriesLoading(true);
        const sr = await wadoRsApi.getSeries(study.studyInstanceUid);
        setSeriesList(sr.success ? (sr.data ?? []) : []);
        setSeriesLoading(false);
        setDownloaded(prev => {
          const next = new Set(prev);
          next.add(study.studyInstanceUid);
          return next;
        });
        message.success(t("wadoRs.retrieved", { patient: res.data.patientName, count: res.data.seriesCount }));
      } else {
        message.warning(res.error?.message ?? t("wadoRs.retrieveFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t("wadoRs.retrieveFailed"));
    } finally {
      setRetrieving(null);
    }
  };

  const handleDownloadSeries = async (studyUid: string, series: WadoRsSeries) => {
    try {
      const res = await wadoRsApi.getInstances(studyUid, series.seriesInstanceUid);
      const instances = res.success ? (res.data ?? []) : [];
      const urls = instances.map(i => i.wadoUri).filter(Boolean);
      const blob = new Blob([JSON.stringify({
        studyUid, seriesUid: series.seriesInstanceUid,
        description: series.seriesDescription,
        instanceCount: instances.length,
        wadoUris: urls,
      }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `WADO-RS_${series.seriesInstanceUid.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      message.success(t("wadoRs.seriesDownloaded", { num: series.seriesNumber, count: instances.length }));
    } catch {
      message.error(t('wadoRs.downloadFailed'));
    }
  };

  const filtered = studies.filter(
    (s) =>
      s.patientName.toLowerCase().includes(search.toLowerCase()) ||
      s.studyInstanceUid.includes(search),
  );
  const filteredPagination = usePagination(filtered, 10);

  const columns = [
    {
      title: t("wadoRs.colStudyUid"),
      dataIndex: "studyInstanceUid",
      key: "uid",
      render: (v: string) => (
        <Text copyable style={{ fontSize: 11, fontFamily: "monospace" }}>
          {v}
        </Text>
      ),
    },
    { title: t("wadoRs.colPatient"), dataIndex: "patientName", key: "patientName" },
    { title: t("wadoRs.colDate"), dataIndex: "studyDate", key: "studyDate" },
    { title: t("wadoRs.colDescription"), dataIndex: "studyDescription", key: "desc" },
    {
      title: t("wadoRs.colModality"),
      dataIndex: "modality",
      key: "modality",
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: t("wadoRs.colSeries"), dataIndex: "seriesCount", key: "series" },
    { title: t("wadoRs.colInstances"), dataIndex: "instanceCount", key: "instances" },
    {
      title: t("wadoRs.colAction"),
      key: "action",
      render: (_: unknown, record: WadoRsStudy) => (
        <Space>
          <Button
            size="small"
            icon={retrieving === record.studyInstanceUid ? <Loader2 size={14} /> : <Download size={14} />}
            loading={retrieving === record.studyInstanceUid}
            onClick={() => void handleRetrieve(record)}
          >
            {downloaded.has(record.studyInstanceUid) ? t("wadoRs.retrievedFlag") : "Retrieve"}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Globe size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("wadoRs.title")}</span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          {t("wadoRs.refresh")}
        </Button>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title={t("wadoRs.totalStudies")} value={studies.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("wadoRs.totalInstances")}
              value={studies.reduce((s, r) => s + r.instanceCount, 0)}
            />
          </Card>
        </Col>
      </Row>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Input
            prefix={<Search size={14} />}
            placeholder={t("wadoRs.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 400 }}
          />
        </Space>
      </Card>
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 
              {t("wadoRs.retry")}
            </Button>
          }
        />
      )}
      <Card>
        <Spin spinning={loading}>
          <Table
            rowKey="studyInstanceUid"
            dataSource={filteredPagination.pageData}
            columns={columns}
            pagination={filteredPagination.pagination}
            size="small"
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>

      <Modal
        title={t("wadoRs.resultTitle", { patient: retrieveResult?.patientName ?? '' })}
        open={!!retrieveResult}
        onCancel={() => setRetrieveResult(null)}
        footer={null}
        width={560}
      >
        <Spin spinning={seriesLoading}>
          {retrieveResult && (
            <>
              <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
                <Tag color="blue">Study: {retrieveResult.studyInstanceUid.slice(0, 20)}...</Tag>
                <span>{t("wadoRs.resultSummary", { patient: retrieveResult.patientName, modality: retrieveResult.modality, series: retrieveResult.seriesCount, instances: retrieveResult.instanceCount })}</span>
              </Space>
              <List
                size="small"
                dataSource={seriesList}
                locale={{ emptyText: t('wadoRs.noSeries') }}
                renderItem={(s) => (
                  <List.Item
                    actions={[
                      <Button key="dl" size="small" icon={<Download size={12} />} onClick={() => void handleDownloadSeries(retrieveResult.studyInstanceUid, s)}>
                        {t("wadoRs.download")}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<Space><Tag>#{s.seriesNumber}</Tag>{s.seriesDescription || s.modality}</Space>}
                      description={t("wadoRs.seriesMeta", { count: s.instanceCount, bodyPart: s.bodyPart || '-' })}
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default WadoRsPage;
