import React, { useState, useCallback } from "react";
import {
  Card,
  Space,
  Tag,
  Button,
  Tabs,
  Row,
  Col,
  message,
  Input,
  Form,
  Select,
  Modal,
  Popconfirm,
  Alert,
} from "antd";
import {
  Send,
  Search,
  Plus,
  Delete,
  Users,
  Fingerprint,
  Activity,
} from "lucide-react";
import { iheApi } from "../../services/api/integrationApi";
import { usePagination } from "../../hooks/usePagination";
import { t } from "../../i18n/appI18n";
import { DataTable } from "../../components/common";

const { TextArea } = Input;

interface PixMapping {
  id: string;
  assigningAuthority: string;
  externalId: string;
  internalPatientId: string;
}

interface PixFeedResult {
  success: boolean;
  ack: string;
  storedPid?: string;
  transaction?: string;
}

interface PixQueryResult {
  transaction: string;
  count: number;
  patientId: string;
  sourceDomain: string;
  results: Array<{
    patientId: string;
    assigningAuthority: string;
    identifiers: Array<{
      domain: string;
      value: string;
      assigningAuthority: string;
    }>;
    name: { family: string; given: string[] };
  }>;
}

interface PdqResult {
  patientId: string;
  assigningAuthority: string;
  identifiers: Array<{ domain: string; value: string }>;
  name: { family: string; given: string[] };
  birthDate: string;
  gender: string;
  address?: string;
  phone?: string;
  confidence: number;
}

const DEMO_MAPPINGS: PixMapping[] = [
  {
    id: "1",
    assigningAuthority: "HOSPITAL_A",
    externalId: "P001",
    internalPatientId: "G005-00001",
  },
  {
    id: "2",
    assigningAuthority: "CLINIC_B",
    externalId: "CL-1002",
    internalPatientId: "G005-00002",
  },
  {
    id: "3",
    assigningAuthority: "HOSPITAL_C",
    externalId: "HC-2034",
    internalPatientId: "G005-00003",
  },
];

export const PixPage: React.FC = () => {
  const [tab, setTab] = useState("feed");
  const [feedForm] = Form.useForm();
  const [queryForm] = Form.useForm();
  const [pdqForm] = Form.useForm();

  const [feedResult, setFeedResult] = useState<PixFeedResult | null>(null);
  const [queryResult, setQueryResult] = useState<PixQueryResult | null>(null);
  const [pdqResults, setPdqResults] = useState<PdqResult[]>([]);
  const [mappings, setMappings] = useState<PixMapping[]>(DEMO_MAPPINGS);
  const [mappingModal, setMappingModal] = useState(false);
  const [mappingForm] = Form.useForm();
  const [sending, setSending] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [pdqLoading, setPdqLoading] = useState(false);

  // [v3.0.6.11-95] W4-B P2: 受控分页 (查询结果/映射表/PDQ 结果)
  const queryPagination = usePagination(queryResult?.results ?? [], 10);
  const mappingsPagination = usePagination(mappings, 10);
  const pdqPagination = usePagination(pdqResults, 10);

  const handleFeed = useCallback(async () => {
    setSending(true);
    setFeedResult(null);
    let pid = "";
    try {
      const values = await feedForm.validateFields();
      pid = values.patientId;
      const body = {
        patientId: values.patientId,
        assigningAuthority: values.assigningAuthority,
        identifiers: (
          (values.identifiers?.split("\n").filter(Boolean) as string[]) ?? []
        ).map((l: string) => {
          const [domain, value] = l.split("|");
          return {
            domain: domain?.trim() || "",
            value: value?.trim() || "",
            assigningAuthority: values.assigningAuthority,
          };
        }),
        name: {
          family: values.familyName || values.patientId,
          given: [values.givenName || ""],
        },
        birthDate: values.birthDate || "2000-01-01",
        gender: values.gender || "U",
      };
      const res = await iheApi.pixFeed(body);
      if (res.success) {
        setFeedResult({
          success: true,
          ack: res.data.ack,
          storedPid: res.data.storedPid || pid,
        });
        message.success(t("pixPage.feedSuccess"));
      } else {
        setFeedResult({ success: false, ack: "AE" });
        message.error(t("pixPage.feedFailed"));
      }
    } catch (err) {
      console.warn("[PixPage] PIX Feed 服务不可用，已使用演示响应", err);
      message.warning(t("pixPage.feedFallback"));
      setFeedResult({
        success: true,
        ack: "AA",
        storedPid: pid || feedForm.getFieldValue("patientId"),
      });
    }
    setSending(false);
  }, [feedForm]);

  const handleQuery = useCallback(async () => {
    setQuerying(true);
    setQueryResult(null);
    const qv = queryForm.getFieldsValue();
    try {
      const values = await queryForm.validateFields();
      const body = {
        patientId: values.patientId,
        sourceDomain: values.sourceDomain,
        targetDomains: (
          (values.targetDomains?.split("\n").filter(Boolean) as string[]) ?? []
        ).map((s: string) => s.trim()),
      };
      const res = await iheApi.pixQuery(body);
      if (res.success) {
        setQueryResult(res.data);
        message.success(t("pixPage.querySuccess"));
      } else {
        message.error(t("pixPage.queryFailed"));
      }
    } catch (err) {
      console.warn("[PixPage] PIX 查询服务不可用，已使用演示数据", err);
      message.warning(t("pixPage.queryFallback"));
      const mockPid = qv.patientId || "P001";
      const mockSrc = qv.sourceDomain || "HOSPITAL_A";
      const domains = (qv.targetDomains || "HOSPITAL_B")
        .split("\n")
        .filter(Boolean)
        .map((s: string) => s.trim());
      setQueryResult({
        transaction: `TXN-${Date.now()}`,
        count: domains.length,
        patientId: mockPid,
        sourceDomain: mockSrc,
        results: domains.map((d: string) => ({
          patientId: mockPid,
          assigningAuthority: d,
          identifiers: [
            { domain: d, value: `${d}-${mockPid}`, assigningAuthority: d },
          ],
          name: { family: "张", given: ["三"] },
        })),
      });
    }
    setQuerying(false);
  }, [queryForm]);

  const handlePdqQuery = useCallback(async () => {
    setPdqLoading(true);
    setPdqResults([]);
    try {
      const values = await pdqForm.validateFields();
      const body = {
        patientId: values.patientId,
        familyName: values.name,
        birthDate: values.birthDate,
        gender: values.gender,
      };
      const res = await iheApi.pdqQuery(body);
      if (res.success) {
        setPdqResults(
          res.data.results.sort((a, b) => b.confidence - a.confidence),
        );
        message.success(t("pixPage.pdqSuccess"));
      } else {
        message.error(t("pixPage.pdqFailed"));
      }
    } catch (err) {
      console.warn("[PixPage] PDQ 服务不可用，已使用演示数据", err);
      message.warning(t("pixPage.pdqFallback"));
      setPdqResults([
        {
          patientId: "P001",
          assigningAuthority: "HOSPITAL_A",
          identifiers: [{ domain: "HOSPITAL_A", value: "P001" }],
          name: { family: "张", given: ["三"] },
          birthDate: "1985-06-15",
          gender: "M",
          address: "测试地址1",
          phone: "13800138001",
          confidence: 0.98,
        },
        {
          patientId: "CL-1002",
          assigningAuthority: "CLINIC_B",
          identifiers: [{ domain: "CLINIC_B", value: "CL-1002" }],
          name: { family: "张", given: ["三"] },
          birthDate: "1985-06-15",
          gender: "M",
          address: "测试地址2",
          phone: "13800138002",
          confidence: 0.85,
        },
      ]);
    }
    setPdqLoading(false);
  }, [pdqForm]);

  const handleAddMapping = async () => {
    try {
      const values = await mappingForm.validateFields();
      const newMapping: PixMapping = { id: `${Date.now()}`, ...values };
      setMappings([...mappings, newMapping]);
      setMappingModal(false);
      mappingForm.resetFields();
      message.success(t("pixPage.mappingAdded"));
    } catch (err) {
      console.warn("[PixPage] handleAddMapping failed", err);
    }
  };

  const handleDeleteMapping = (id: string) => {
    setMappings(mappings.filter((m) => m.id !== id));
    message.success(t("pixPage.mappingDeleted"));
  };

  const identitiesColumns = [
    {
      title: t("pixPage.assigningAuthority"),
      dataIndex: "assigningAuthority",
      key: "aa",
    },
    { title: t("pixPage.patientId"), dataIndex: "patientId", key: "pid" },
    {
      title: t("pixPage.identifiers"),
      key: "ids",
      render: (_: any, r: any) =>
        r.identifiers?.map((i: any) => (
          <Tag key={i.domain}>
            {i.domain}: {i.value}
          </Tag>
        )),
    },
    {
      title: t("pixPage.name"),
      key: "name",
      render: (_: any, r: any) =>
        r.name ? `${r.name.family} ${r.name.given?.join(" ")}` : "-",
    },
  ];

  return (
    <div style={{ padding: 24, background: "var(--bg-primary)",}}>
      <Space style={{ marginBottom: 16 }}>
        <Fingerprint size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("pixPage.title")}</span>
        <Tag color="cyan">v3.0.6.8</Tag>
        <Tag color="green">ITI-8 Feed</Tag>
        <Tag color="blue">ITI-9 Query</Tag>
        <Tag color="orange">PDQ</Tag>
        <Tag color="gold">{t("pixPage.demoData")}</Tag>
      </Space>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        type="card"
        items={[
          {
            key: "feed",
            label: (
              <span>
                <Send size={14} style={{ marginRight: 4 }} />
                PIX Feed
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title={t("pixPage.feedCardTitle")}>
                    <Form form={feedForm} layout="vertical" size="small">
                      <Form.Item
                        name="patientId"
                        label={t("pixPage.patientId")}
                        rules={[{ required: true }]}
                      >
                        <Input placeholder={t("pixPage.patientIdPlaceholder")} />
                      </Form.Item>
                      <Form.Item
                        name="assigningAuthority"
                        label={t("pixPage.assigningAuthority")}
                        rules={[{ required: true }]}
                      >
                        <Input placeholder={t("pixPage.assigningAuthorityPlaceholder")} />
                      </Form.Item>
                      <Form.Item
                        name="identifiers"
                        label={t("pixPage.identifiersHint")}
                      >
                        <TextArea rows={3} placeholder="HOSPITAL_A|P001" />
                      </Form.Item>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item name="familyName" label={t("pixPage.familyName")}>
                            <Input placeholder={t("pixPage.familyName")} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="givenName" label={t("pixPage.givenName")}>
                            <Input placeholder={t("pixPage.givenName")} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item>
                        <Button
                          type="primary"
                          icon={<Send size={14} />}
                          loading={sending}
                          onClick={handleFeed}
                        >
                          {t("pixPage.sendFeed")}
                        </Button>
                      </Form.Item>
                    </Form>
                    {feedResult && (
                      <Alert
                        type={feedResult.success ? "success" : "error"}
                        title={`ACK: ${feedResult.ack}${feedResult.storedPid ? ` | Stored PID: ${feedResult.storedPid}` : ""}${feedResult.transaction ? ` | TXN: ${feedResult.transaction}` : ""}`}
                        showIcon
                        style={{ marginTop: 8 }}
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "query",
            label: (
              <span>
                <Search size={14} style={{ marginRight: 4 }} />
                {t("pixPage.tabQuery")}
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card size="small" title={t("pixPage.queryCardTitle")}>
                    <Form form={queryForm} layout="vertical" size="small">
                      <Form.Item
                        name="patientId"
                        label={t("pixPage.patientId")}
                        rules={[{ required: true }]}
                      >
                        <Input placeholder={t("pixPage.patientIdPlaceholder")} />
                      </Form.Item>
                      <Form.Item
                        name="sourceDomain"
                        label={t("pixPage.sourceDomain")}
                        rules={[{ required: true }]}
                      >
                        <Input placeholder={t("pixPage.assigningAuthorityPlaceholder")} />
                      </Form.Item>
                      <Form.Item
                        name="targetDomains"
                        label={t("pixPage.targetDomains")}
                        rules={[{ required: true }]}
                      >
                        <TextArea
                          rows={3}
                          placeholder="HOSPITAL_B&#10;CLINIC_C"
                        />
                      </Form.Item>
                      <Form.Item>
                        <Button
                          type="primary"
                          icon={<Search size={14} />}
                          loading={querying}
                          onClick={handleQuery}
                        >
                          {t("pixPage.queryBtn")}
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
                <Col span={12}>
                  {queryResult && (
                    <Card
                      size="small"
                      title={`${t("pixPage.queryResult")} (${queryResult.count} ${t("pixPage.items")})`}
                    >
                      <DataTable scroll={{ x: 'max-content' }}
                        dataSource={queryPagination.pageData}
                        rowKey={(r) => `${r.assigningAuthority}-${r.patientId}`}
                        pagination={queryPagination.pagination}
                        columns={identitiesColumns}
                      />
                      {queryResult.transaction && (
                        <div
                          style={{ fontSize: 11, color: "#999", marginTop: 4 }}
                        >
                          {t("pixPage.transaction")}: {queryResult.transaction}
                        </div>
                      )}
                    </Card>
                  )}
                </Col>
              </Row>
            ),
          },
          {
            key: "mapping",
            label: (
              <span>
                <Users size={14} style={{ marginRight: 4 }} />
                {t("pixPage.tabMapping")}
              </span>
            ),
            children: (
              <Card
                size="small"
                title={t("pixPage.mappingCardTitle")}
                extra={
                  <Button
                    type="primary"
                    icon={<Plus size={14} />}
                    onClick={() => setMappingModal(true)}
                  >
                    {t("pixPage.addMapping")}
                  </Button>
                }
              >
                <DataTable scroll={{ x: 'max-content' }}
                  dataSource={mappingsPagination.pageData}
                  rowKey="id"
                  pagination={mappingsPagination.pagination}
                  columns={[
                    {
                      title: t("pixPage.assigningAuthority"),
                      dataIndex: "assigningAuthority",
                    },
                    { title: t("pixPage.externalId"), dataIndex: "externalId" },
                    {
                      title: t("pixPage.internalPatientId"),
                      dataIndex: "internalPatientId",
                    },
                    {
                      title: t("pixPage.actions"),
                      render: (_: any, r: PixMapping) => (
                        <Popconfirm
                          title={t("pixPage.confirmDelete")}
                          onConfirm={() => handleDeleteMapping(r.id)}
                        >
                          <Button
                            size="small"
                            danger
                            icon={<Delete size={12} />}
                          >
                            {t("pixPage.delete")}
                          </Button>
                        </Popconfirm>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "pdq",
            label: (
              <span>
                <Activity size={14} style={{ marginRight: 4 }} />
                {t("pixPage.tabPdq")}
              </span>
            ),
            children: (
              <Row gutter={16}>
                <Col span={10}>
                  <Card
                    size="small"
                    title={t("pixPage.pdqCardTitle")}
                  >
                    <Form form={pdqForm} layout="vertical" size="small">
                      <Form.Item name="patientId" label={t("pixPage.patientId")}>
                        <Input placeholder={t("pixPage.patientIdPlaceholder")} />
                      </Form.Item>
                      <Form.Item name="name" label={t("pixPage.name")}>
                        <Input placeholder={t("pixPage.patientNamePlaceholder")} />
                      </Form.Item>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item name="birthDate" label={t("pixPage.birthDate")}>
                            <Input placeholder="YYYY-MM-DD" />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="gender" label={t("pixPage.gender")}>
                            <Select
                              allowClear
                              placeholder={t("pixPage.selectGender")}
                              options={[
                                { value: "M", label: t("pixPage.genderMale") },
                                { value: "F", label: t("pixPage.genderFemale") },
                                { value: "O", label: t("pixPage.genderOther") },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item>
                        <Button
                          type="primary"
                          icon={<Search size={14} />}
                          loading={pdqLoading}
                          onClick={handlePdqQuery}
                        >
                          {t("pixPage.queryBtn")}
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </Col>
                <Col span={14}>
                  {pdqResults.length > 0 && (
                    <Card
                      size="small"
                      title={`${t("pixPage.pdqResult")} (${pdqResults.length})`}
                    >
                      <DataTable scroll={{ x: 'max-content' }}
                        dataSource={pdqPagination.pageData}
                        rowKey={(r) => `${r.assigningAuthority}-${r.patientId}`}
                        pagination={pdqPagination.pagination}
                        columns={[
                          { title: t("pixPage.patientId"), dataIndex: "patientId" },
                          {
                            title: t("pixPage.assigningAuthority"),
                            dataIndex: "assigningAuthority",
                          },
                          {
                            title: t("pixPage.name"),
                            render: (_: any, r: PdqResult) =>
                              `${r.name.family} ${r.name.given?.join(" ")}`,
                          },
                          { title: t("pixPage.birthDate"), dataIndex: "birthDate" },
                          { title: t("pixPage.gender"), dataIndex: "gender" },
                          { title: t("pixPage.phone"), dataIndex: "phone" },
                          {
                            title: t("pixPage.confidence"),
                            dataIndex: "confidence",
                            render: (v: number) => (
                              <Tag
                                color={
                                  v >= 0.9
                                    ? "green"
                                    : v >= 0.7
                                      ? "orange"
                                      : "red"
                                }
                              >
                                {(v * 100).toFixed(0)}%
                              </Tag>
                            ),
                          },
                        ]}
                     
                      />
                    </Card>
                  )}
                </Col>
              </Row>
            ),
          },
        ]}
      />

      <Modal
        title={t("pixPage.addMappingTitle")}
        open={mappingModal}
        onCancel={() => setMappingModal(false)}
        onOk={handleAddMapping}
      >
        <Form form={mappingForm} layout="vertical" size="small">
          <Form.Item
            name="assigningAuthority"
            label={t("pixPage.assigningAuthority")}
            rules={[{ required: true }]}
          >
            <Input placeholder={t("pixPage.assigningAuthorityPlaceholder")} />
          </Form.Item>
          <Form.Item
            name="externalId"
            label={t("pixPage.externalId")}
            rules={[{ required: true }]}
          >
            <Input placeholder={t("pixPage.patientIdPlaceholder")} />
          </Form.Item>
          <Form.Item
            name="internalPatientId"
            label={t("pixPage.internalPatientId")}
            rules={[{ required: true }]}
          >
            <Input placeholder={t("pixPage.internalPatientIdPlaceholder")} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PixPage;
