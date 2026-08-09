// [v3.0.6.8-42] PR 9: 教学病例?
// 对标: Heidelberg 病例?+ 科研 DICOM 标注 + DICOM PS 3.15 脱敏
import React, { useState, useEffect } from "react";
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Input,
  Form,
  Row,
  Col,
  Divider,
  message,
  Tabs,
  List,
  Statistic,
  Alert,
  Progress,
  Avatar,
  Drawer,
  Descriptions,
  Modal,
} from "antd";
import {
  BookOpen,
  Save,
  Edit,
  Download,
  Search,
  Plus,
  Shield,
  FileText,
  Library,
  GraduationCap,
  Filter,
  Microscope,
} from "lucide-react";

const MODALITY_LABELS_DICT: Record<string, string> = {
  fundus: "眼底照相",
  fundus_photo: "眼底照相",
  oct: "OCT",
  oct_a: "OCT-A",
  oct_bscan: "OCT B-Scan",
  ffa: "FFA",
  icga: "ICG",
  corneal_endothelium: "角膜内皮",
  tear_film: "泪膜",
  fundus_autofluorescence: "眼底自发荧光",
  slit_lamp: "裂隙灯",
  topography: "角膜地形图",
  visual_field: "视野",
  specular: "角膜内皮镜",
  ultrasound: "眼部超声",
};
const STATUS_LABELS_DICT: Record<string, string> = {
  archive: "已归档",
  published: "已发布",
  pending_review: "待审核",
  critical_value: "危急值",
  draft: "草稿",
};

export const CaseLibraryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("cases");
  // 教学病例
  const [cases, setCases] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [diseaseFilter, setDiseaseFilter] = useState<string>("");
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [newAnnotation, setNewAnnotation] = useState({
    type: "roi",
    label: "",
    color: "#2563eb",
  });

  // 标注项目
  const [projects, setProjects] = useState<any[]>([]);
  const [cohort, setCohort] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [deidentifiedResult, setDeidentifiedResult] = useState<any>(null);
  const [srExportResult, setSrExportResult] = useState<any>(null);

  // 新增病例
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCase, setNewCase] = useState({
    patientName: "",
    patientId: "",
    modality: "fundus_photo",
    bodyPart: "",
    chiefComplaint: "",
    diagnosis: "",
    studyDate: new Date().toISOString().split("T")[0],
  });

  const loadCases = async () => {
    try {
      const r = await fetch("/api/v1/eye/edu/cases?pageSize=20");
      const data = await r.json();
      if (data.success) setCases(data.data);
    } catch { /* ignore */ }
  };

  const handleCreateCase = async () => {
    if (!newCase.patientName.trim() || !newCase.patientId.trim()) {
      message.warning("请填写患者姓名与患者ID");
      return;
    }
    setCreating(true);
    try {
      const r = await fetch("/api/v1/eye/edu/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newCase, status: "draft" }),
      });
      const data = await r.json();
      if (data.success) {
        message.success("教学病例已创建");
        void loadCases();
        setShowCreateModal(false);
        setNewCase({
          patientName: "",
          patientId: "",
          modality: "fundus_photo",
          bodyPart: "",
          chiefComplaint: "",
          diagnosis: "",
          studyDate: new Date().toISOString().split("T")[0],
        });
        setCreating(false);
        return;
      } else {
        message.warning("创建接口不可用，已本地加入列表");
      }
    } catch {
      message.warning("创建接口不可用，已本地加入列表");
    }
    setCases(prev => [{
      id: `C${Date.now()}`,
      reportId: `R${Date.now()}`,
      patientName: newCase.patientName,
      patientId: newCase.patientId,
      modality: newCase.modality,
      chiefComplaint: newCase.chiefComplaint,
      diagnosis: newCase.diagnosis,
      status: "draft",
      studyDate: newCase.studyDate,
    }, ...prev]);
    setShowCreateModal(false);
    setNewCase({
      patientName: "",
      patientId: "",
      modality: "fundus_photo",
      bodyPart: "",
      chiefComplaint: "",
      diagnosis: "",
      studyDate: new Date().toISOString().split("T")[0],
    });
    setCreating(false);
  };

  // 加载病例
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/v1/eye/edu/cases?pageSize=20");
        const data = await r.json();
        if (data.success) setCases(data.data);

        const pr = await fetch("/api/v1/eye/edu/annotation-projects");
        const pd = await pr.json();
        if (pd.success) setProjects(pd.data);
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
      }
    })();
  }, []);

  // 详情
  const handleCaseDetail = async (caseId: string) => {
    try {
      const r = await fetch(`/api/v1/eye/edu/cases/${caseId}`);
      const data = await r.json();
      if (data.success) setSelectedCase(data.data);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 标注
  const handleAnnotate = async () => {
    if (!selectedCase) return;
    try {
      const r = await fetch("/api/v1/eye/edu/annotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id || selectedCase.reportId,
          annotationType: newAnnotation.type,
          coordinates: [
            [100, 100],
            [200, 200],
          ],
          label: newAnnotation.label || "test",
          color: newAnnotation.color,
        }),
      });
      const data = await r.json();
      if (data.success) message.success("标注已添加");
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // DICOM-SR 导出
  const handleExportSR = async () => {
    if (!selectedCase) return;
    try {
      const r = await fetch("/api/v1/eye/edu/export-sr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedCase.id,
          annotations: [{ label: "视盘", annotationType: "roi" }],
          format: "sr-tid1500",
        }),
      });
      const data = await r.json();
      if (data.success) {
        setSrExportResult(data.data);
        message.success("DICOM-SR 已导出");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 脱敏
  const handleDeidentify = async () => {
    if (!selectedCase) return;
    try {
      const r = await fetch("/api/v1/eye/edu/deidentify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: selectedCase.id, level: "basic" }),
      });
      const data = await r.json();
      if (data.success) {
        setDeidentifiedResult(data.data);
        message.success("脱敏完成");
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  // 队列筛选
  const handleCohort = async () => {
    try {
      const r = await fetch("/api/v1/eye/edu/cohort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criteria: {
            disease: diseaseFilter,
            gender: "all",
            ageMin: 18,
            ageMax: 90,
          },
        }),
      });
      const data = await r.json();
      if (data.success) {
        setCohort(data.data);
        // 立即获取统计
        const sr = await fetch(
          "/api/v1/eye/edu/stats?cohortId=" + data.data.cohortId,
        );
        const sd = await sr.json();
        if (sd.success) setStats(sd.data);
        message.success(
          `队列 ${data.data.cohortId}: ${data.data.totalCases} 例`,
        );
      }
    } catch (e: any) {
      message.error(e.message);
    }
  };

  return (
    <div style={{ padding: 24, background: "var(--bg-card)", minHeight: "100vh" }}>
      <Space style={{ marginBottom: 16 }}>
        <BookOpen size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>眼科教学病例库</span>
        <Tag color="cyan">PR9</Tag>
        <Tag color="purple">v3.0.6.8-42</Tag>
        <Tag color="blue">DICOM 标注 + SR 导出</Tag>
        <Tag color="green">DICOM PS 3.15 脱敏</Tag>
      </Space>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: "cases",
            label: (
              <span>
                <Library size={14} /> 病例库
              </span>
            ),
            children: (
              <>
                <Row gutter={16}>
                  <Col span={10}>
                    <Card
                      title={
                        <Space>
                          <Filter size={16} />
                          病例检索
                        </Space>
                      }
                      size="small"
                    >
                      <Input
                        placeholder="搜索患者姓名 / 主诉"
                        prefix={<Search size={14} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ marginBottom: 8 }}
                      />
                      <Select
                        placeholder="按病种筛选"
                        value={diseaseFilter || undefined}
                        onChange={setDiseaseFilter}
                        allowClear
                        style={{ width: "100%", marginBottom: 8 }}
                        options={[
                          { value: "DR", label: "DR 糖尿病视网膜病变" },
                          { value: "AMD", label: "AMD 老年黄斑变性" },
                          { value: "青光眼", label: "青光眼" },
                          { value: "白内障", label: "白内障" },
                        ]}
                      />
                      <Button
                        type="primary"
                        block
                        icon={<Filter size={14} />}
                        onClick={handleCohort}
                      >
                        科研队列筛选
                      </Button>

                      {cohort && (
                        <div style={{ marginTop: 12 }}>
                          <Alert
                            title={`队列 ${cohort.cohortId}: ${cohort.totalCases} 例`}
                            type="success"
                            showIcon
                          />
                          {stats && (
                            <div style={{ marginTop: 12, fontSize: 12 }}>
                              <Row gutter={[8, 4]}>
                                <Col span={12}>
                                  <Statistic
                                    title="男"
                                    value={stats.demographics.male}
                                  />
                                </Col>
                                <Col span={12}>
                                  <Statistic
                                    title="女"
                                    value={stats.demographics.female}
                                  />
                                </Col>
                                <Col span={24}>
                                  <Statistic
                                    title="平均年龄"
                                    value={stats.demographics.meanAge}
                                    suffix="岁"
                                  />
                                </Col>
                              </Row>
                              <Divider style={{ margin: "8px 0" }} />
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                病种分布:
                              </div>
                              {Object.entries(stats.diseaseDistribution).map(
                                ([k, v]: any) => (
                                  <div
                                    key={k}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                    }}
                                  >
                                    <span>{k}</span>
                                    <span style={{ fontWeight: 600 }}>
                                      {v} 例
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </Col>

                  <Col span={14}>
                    <Card
                      title={
                        <Space>
                          <GraduationCap size={16} />
                          病例列表 (前 20)
                          <Tag color="blue">{cases.length}</Tag>
                        </Space>
                      }
                      size="small"
                      extra={<Button icon={<Plus size={12} />} onClick={() => setShowCreateModal(true)}>新增</Button>}
                    >
                      <List
                        size="small"
                        dataSource={cases}
                        renderItem={(c) => (
                          <List.Item
                            actions={[
                              <Button
                                key="view"
                                size="small"
                                onClick={() =>
                                  handleCaseDetail(c.id || c.reportId)
                                }
                              >
                                查看
                              </Button>,
                            ]}
                          >
                            <List.Item.Meta
                              avatar={
                                <Avatar style={{ background: "#2563eb" }}>
                                  {c.patientName?.slice(0, 1) || "P"}
                                </Avatar>
                              }
                              title={
                                <Space>
                                  <span>{c.patientName || "未知"}</span>
                                  <Tag color="cyan">
                                    {MODALITY_LABELS_DICT[c.modality] ||
                                      c.modality ||
                                      "眼底照相"}
                                  </Tag>
                                  <Tag>
                                    {STATUS_LABELS_DICT[c.status] ||
                                      c.status ||
                                      "已归档"}
                                  </Tag>
                                </Space>
                              }
                              description={
                                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                  ID: {c.id || c.reportId} |{" "}
                                  {c.chiefComplaint || "常规检查"}
                                </span>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    </Card>
                  </Col>
                </Row>

                <Drawer
                  title={
                    <Space>
                      <FileText size={16} />
                      病例详情 {selectedCase?.id}
                    </Space>
                  }
                  open={!!selectedCase}
                  onClose={() => setSelectedCase(null)}
                  width={680}
                >
                  {selectedCase && (
                    <>
                      <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label="患者">
                          {selectedCase.patientName}
                        </Descriptions.Item>
                        <Descriptions.Item label="模态">
                          {MODALITY_LABELS_DICT[selectedCase.modality] ||
                            selectedCase.modality ||
                            "眼底照相"}
                        </Descriptions.Item>
                        <Descriptions.Item label="检查部位">
                          {selectedCase.bodyPart || "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label="主诉">
                          {selectedCase.chiefComplaint || "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label="诊断">
                          {selectedCase.diagnosis ||
                            selectedCase.impression ||
                            "-"}
                        </Descriptions.Item>
                      </Descriptions>

                      <Divider />

                      <Tabs
                        items={[
                          {
                            key: "annotate",
                            label: (
                              <span>
                                <Edit size={12} /> DICOM 标注
                              </span>
                            ),
                            children: (
                              <>
                                <Form layout="inline" size="small">
                                  <Form.Item label="类型">
                                    <Select
                                      value={newAnnotation.type}
                                      onChange={(v) =>
                                        setNewAnnotation({
                                          ...newAnnotation,
                                          type: v,
                                        })
                                      }
                                      style={{ width: 120 }}
                                      options={[
                                        { value: "roi", label: "ROI 区域" },
                                        {
                                          value: "segmentation",
                                          label: "分割",
                                        },
                                        { value: "measurement", label: "测量" },
                                        { value: "text", label: "文字" },
                                        { value: "arrow", label: "箭头" },
                                      ]}
                                    />
                                  </Form.Item>
                                  <Form.Item label="标签">
                                    <Input
                                      value={newAnnotation.label}
                                      onChange={(e) =>
                                        setNewAnnotation({
                                          ...newAnnotation,
                                          label: e.target.value,
                                        })
                                      }
                                      style={{ width: 200 }}
                                    />
                                  </Form.Item>
                                  <Form.Item>
                                    <Button
                                      type="primary"
                                      icon={<Save size={12} />}
                                      onClick={handleAnnotate}
                                    >
                                      添加
                                    </Button>
                                  </Form.Item>
                                </Form>
                                <Alert
                                  title="标注将使用 DICOM-SR TID 1500 标准导出"
                                  type="info"
                                  showIcon
                                  style={{ marginTop: 8 }}
                                />
                              </>
                            ),
                          },
                          {
                            key: "export",
                            label: (
                              <span>
                                <Download size={12} /> 导出 SR
                              </span>
                            ),
                            children: (
                              <>
                                <Button
                                  type="primary"
                                  icon={<Download size={12} />}
                                  onClick={handleExportSR}
                                >
                                  导出 DICOM-SR TID 1500
                                </Button>
                                {srExportResult && (
                                  <div style={{ marginTop: 12, fontSize: 12 }}>
                                    <div>
                                      SOP 实例 UID:{" "}
                                      <code>
                                        {srExportResult.sopInstanceUID}
                                      </code>
                                    </div>
                                    <div>格式: {srExportResult.format}</div>
                                    <div>
                                      内容数:{" "}
                                      {srExportResult.contentSequence?.length ||
                                        0}
                                    </div>
                                  </div>
                                )}
                              </>
                            ),
                          },
                          {
                            key: "deid",
                            label: (
                              <span>
                                <Shield size={12} /> 脱敏 (PS 3.15)
                              </span>
                            ),
                            children: (
                              <>
                                <Button
                                  type="primary"
                                  icon={<Shield size={12} />}
                                  onClick={handleDeidentify}
                                >
                                  脱敏 (basic 等级)
                                </Button>
                                {deidentifiedResult && (
                                  <div style={{ marginTop: 12 }}>
                                    <Tag color="green">
                                      {deidentifiedResult.deidentifiedId}
                                    </Tag>
                                    <div style={{ fontSize: 12, marginTop: 8 }}>
                                      已执行操作:
                                    </div>
                                    {deidentifiedResult.actions.map(
                                      (a: string, i: number) => (
                                        <div
                                          key={i}
                                          style={{
                                            fontSize: 12,
                                            color: "var(--text-secondary)",
                                          }}
                                        >
                                          • {a}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </>
                            ),
                          },
                        ]}
                      />
                    </>
                  )}
                </Drawer>
              </>
            ),
          },
          {
            key: "projects",
            label: (
              <span>
                <Microscope size={14} /> 标注项目
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
                {projects.map((p) => (
                  <Col span={8} key={p.projectId}>
                    <Card size="small" title={p.name}>
                      <Progress
                        percent={Math.round((p.completed / p.total) * 100)}
                      />
                      <div
                        style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}
                      >
                        {p.completed} / {p.total} 标注
                      </div>
                      <Tag
                        color={p.status === "completed" ? "green" : "blue"}
                        style={{ marginTop: 4 }}
                      >
                        {p.status === "completed" ? "已完成" : "进行中"}
                      </Tag>
                    </Card>
                  </Col>
                ))}
              </Row>
            ),
          },
        ]}
      />

      <Modal
        title="新增教学病例"
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        onOk={() => void handleCreateCase()}
        confirmLoading={creating}
        okText="创建"
        width={500}
      >
        <Form layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="患者姓名 *" required>
                <Input value={newCase.patientName} onChange={(e) => setNewCase({ ...newCase, patientName: e.target.value })} placeholder="请输入姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="患者ID *" required>
                <Input value={newCase.patientId} onChange={(e) => setNewCase({ ...newCase, patientId: e.target.value })} placeholder="如 p-1009" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="检查模态">
                <Select value={newCase.modality} onChange={(v) => setNewCase({ ...newCase, modality: v })} options={Object.entries(MODALITY_LABELS_DICT).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="检查日期">
                <Input type="date" value={newCase.studyDate} onChange={(e) => setNewCase({ ...newCase, studyDate: e.target.value })} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="主诉">
                <Input value={newCase.chiefComplaint} onChange={(e) => setNewCase({ ...newCase, chiefComplaint: e.target.value })} placeholder="如 视物模糊 2 周" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="诊断">
                <Input value={newCase.diagnosis} onChange={(e) => setNewCase({ ...newCase, diagnosis: e.target.value })} placeholder="如 糖尿病视网膜病变" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default CaseLibraryPage;
