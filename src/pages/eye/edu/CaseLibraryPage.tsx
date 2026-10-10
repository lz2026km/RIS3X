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
  InputNumber,
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
  FolderPlus,
} from "lucide-react";
// [G005 Wave1A P0] /eye/edu/* 真实后端 (eye-edu 模块), MSW 仅 dev 兜底
import { eyeApi } from "../../../services/api/eyeApi";
import { ErrorBanner } from "../../../components/feedback";
import { t } from "../../../i18n/appI18n";

const MODALITY_LABELS_DICT: Record<string, string> = {
  fundus: "eyeCaseLibrary.modalityFundus",
  fundus_photo: "eyeCaseLibrary.modalityFundus",
  oct: "OCT",
  oct_a: "OCT-A",
  oct_bscan: "OCT B-Scan",
  ffa: "FFA",
  icga: "ICG",
  corneal_endothelium: "eyeCaseLibrary.modalityCornealEndothelium",
  tear_film: "eyeCaseLibrary.modalityTearFilm",
  fundus_autofluorescence: "eyeCaseLibrary.modalityFundusAutofluorescence",
  slit_lamp: "eyeCaseLibrary.modalitySlitLamp",
  topography: "eyeCaseLibrary.modalityTopography",
  visual_field: "eyeCaseLibrary.modalityVisualField",
  specular: "eyeCaseLibrary.modalitySpecular",
  ultrasound: "eyeCaseLibrary.modalityUltrasound",
};
const STATUS_LABELS_DICT: Record<string, string> = {
  archive: "eyeCaseLibrary.statusArchive",
  published: "eyeCaseLibrary.statusPublished",
  pending_review: "eyeCaseLibrary.statusPendingReview",
  critical_value: "eyeCaseLibrary.statusCriticalValue",
  draft: "eyeCaseLibrary.statusDraft",
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
    color: "var(--color-primary-600)",
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
  // [v3.0.6.11-103 Wave 3A] 创建标注项目 (后端 POST /eye/edu/annotation-projects)
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", total: 100, completed: 0 });
  // [G005 Wave1A P0] 后端可用性标注: 失败时回退本地 + 展示标记
  const [backendDown, setBackendDown] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
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
    setLoadError(null);
    try {
      const res = await eyeApi.getEduCases({ pageSize: 20 });
      if (res.success && Array.isArray(res.data)) {
        setCases(res.data);
        return;
      }
      if (Array.isArray((res.data as any)?.data)) {
        setCases((res.data as any).data);
        return;
      }
      throw new Error("getEduCases 形状不符");
    } catch (e) {
      setBackendDown(true);
      setLoadError(t("w9.states.error"));
      console.warn("[F03] 后端不可用, 回退本地:", (e as Error)?.message);
    }
  };

  const handleCreateCase = async () => {
    if (!newCase.patientName.trim() || !newCase.patientId.trim()) {
      message.warning(t("eyeCaseLibrary.enterPatientInfo"));
      return;
    }
    setCreating(true);
    try {
      const res = await eyeApi.createEduCase({ ...newCase, status: "draft" });
      if (res.success) {
        message.success(t("eyeCaseLibrary.caseCreated"));
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
        message.warning(t("eyeCaseLibrary.createUnavailableLocal"));
      }
    } catch {
      message.warning(t("eyeCaseLibrary.createUnavailableLocal"));
    }
    setBackendDown(true);
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
        await loadCases();
        const pres = await eyeApi.listEduAnnotationProjects();
        if (pres.success && Array.isArray(pres.data)) setProjects(pres.data);
      } catch (e) {
        setBackendDown(true);
        setLoadError(t("w9.states.error"));
        console.warn("[F03] Error:", (e as Error)?.message);
      }
    })();
  }, [reloadTick]);

  // 详情
  const handleCaseDetail = async (caseId: string) => {
    try {
      const res = await eyeApi.getEduCase(caseId);
      if (res.success) setSelectedCase(res.data);
      else setBackendDown(true);
    } catch (e: any) {
      setBackendDown(true);
      message.error(e.message);
    }
  };

  // 标注
  const handleAnnotate = async () => {
    if (!selectedCase) return;
    try {
      const res = await eyeApi.annotateEduCase(selectedCase.id || selectedCase.reportId, {
        annotationType: newAnnotation.type,
        coordinates: [
          [100, 100],
          [200, 200],
        ],
        label: newAnnotation.label || "test",
        color: newAnnotation.color,
      });
      if (res.success) message.success(t("eyeCaseLibrary.annotationAdded"));
      else setBackendDown(true);
    } catch (e: any) {
      setBackendDown(true);
      message.error(e.message);
    }
  };

  // DICOM-SR 导出
  const handleExportSR = async () => {
    if (!selectedCase) return;
    try {
      const res = await eyeApi.eduExportSr({
        caseId: selectedCase.id,
        annotations: [{ label: "视盘", annotationType: "roi" }],
        format: "sr-tid1500",
      });
      if (res.success) {
        setSrExportResult(res.data);
        message.success(t("eyeCaseLibrary.srExported"));
      } else setBackendDown(true);
    } catch (e: any) {
      setBackendDown(true);
      message.error(e.message);
    }
  };

  // 脱敏
  const handleDeidentify = async () => {
    if (!selectedCase) return;
    try {
      const res = await eyeApi.eduDeidentify({ caseId: selectedCase.id, level: "basic" });
      if (res.success) {
        setDeidentifiedResult(res.data);
        message.success(t("eyeCaseLibrary.deidDone"));
      } else setBackendDown(true);
    } catch (e: any) {
      setBackendDown(true);
      message.error(e.message);
    }
  };

  // 队列筛选
  const handleCohort = async () => {
    try {
      const res = await eyeApi.eduCohort({
        criteria: {
          disease: diseaseFilter,
          // [G005] 检索框接入队列筛选条件
          search: searchTerm.trim(),
          gender: "all",
          ageMin: 18,
          ageMax: 90,
        },
      });
      if (res.success) {
        const cohortData = res.data as any;
        setCohort(cohortData);
        // 立即获取统计
        const sres = await eyeApi.eduStats({ cohortId: cohortData.cohortId });
        if (sres.success) setStats(sres.data);
        message.success(
          t("eyeCaseLibrary.cohortMsg", { id: cohortData.cohortId, count: cohortData.totalCases }),
        );
      } else setBackendDown(true);
    } catch (e: any) {
      setBackendDown(true);
      message.error(e.message);
    }
  };

  // [v3.0.6.11-103 Wave 3A] 创建标注项目
  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      message.warning(t("eyeCaseLibrary.enterProjectName"));
      return;
    }
    setCreatingProject(true);
    try {
      const res = await eyeApi.createEduAnnotationProject(newProject);
      if (res.success) {
        message.success(t("eyeCaseLibrary.projectCreated"));
        setProjects((prev) => [res.data, ...prev]);
        setShowProjectModal(false);
        setNewProject({ name: "", total: 100, completed: 0 });
      } else {
        message.warning(t("eyeCaseLibrary.createUnavailable"));
      }
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setCreatingProject(false);
    }
  };

  return (
    <div style={{ padding: 'var(--space-6, 24px)', background: "var(--bg-card)",}}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <BookOpen size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("eyeCaseLibrary.title")}</span>
        <Tag color="cyan">PR9</Tag>
        <Tag color="purple">v3.0.6.8-42</Tag>
        <Tag color="blue">{t("eyeCaseLibrary.tagAnnotation")}</Tag>
        <Tag color="green">{t("eyeCaseLibrary.tagDeid")}</Tag>
        {/* [G005 Wave1A P0] /eye/edu/* 已接真实后端 (eye-edu 模块), 失败时回退本地并标注 */}
        {backendDown ? (
          <Tag color="orange">{t("eyeCaseLibrary.offlineFallback")}</Tag>
        ) : (
          <Tag color="green">{t("eyeCaseLibrary.realBackend")}</Tag>
        )}
      </Space>

      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t("w9.states.retry")} />}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: "cases",
            label: (
              <span>
                <Library size={14} /> {t("eyeCaseLibrary.tabCases")}
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
                          {t("eyeCaseLibrary.caseSearch")}
                        </Space>
                      }
                      size="small"
                    >
                      <Input
                        placeholder={t("eyeCaseLibrary.searchPlaceholder")}
                        prefix={<Search size={14} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ marginBottom: 'var(--space-2, 8px)' }}
                      />
                      <Select
                        placeholder={t("eyeCaseLibrary.filterByDisease")}
                        value={diseaseFilter || undefined}
                        onChange={setDiseaseFilter}
                        allowClear
                        style={{ width: "100%", marginBottom: 'var(--space-2, 8px)' }}
                        options={[
                          { value: "DR", label: t("eyeCaseLibrary.diseaseDR") },
                          { value: "AMD", label: t("eyeCaseLibrary.diseaseAMD") },
                          { value: "青光眼", label: t("eyeCaseLibrary.diseaseGlaucoma") },
                          { value: "白内障", label: t("eyeCaseLibrary.diseaseCataract") },
                        ]}
                      />
                      <Button
                        type="primary"
                        block
                        icon={<Filter size={14} />}
                        onClick={handleCohort}
                      >
                        {t("eyeCaseLibrary.cohortFilter")}
                      </Button>

                      {cohort && (
                        <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                          <Alert
                            title={t("eyeCaseLibrary.cohortMsg", { id: cohort.cohortId, count: cohort.totalCases })}
                            type="success"
                            showIcon
                          />
                          {stats && (
                            <div style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12 }}>
                              <Row gutter={[8, 4]}>
                                <Col span={12}>
                                  <Statistic
                                    title={t("eyeCaseLibrary.male")}
                                    value={stats.demographics.male}
                                  />
                                </Col>
                                <Col span={12}>
                                  <Statistic
                                    title={t("eyeCaseLibrary.female")}
                                    value={stats.demographics.female}
                                  />
                                </Col>
                                <Col span={24}>
                                  <Statistic
                                    title={t("eyeCaseLibrary.meanAge")}
                                    value={stats.demographics.meanAge}
                                    suffix={t("eyeCaseLibrary.yearsOld")}
                                  />
                                </Col>
                              </Row>
                              <Divider style={{ margin: "8px 0" }} />
                              <div style={{ fontWeight: 600, marginBottom: 'var(--space-1, 4px)' }}>
                                {t("eyeCaseLibrary.diseaseDistribution")}
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
                                      {t("eyeCaseLibrary.caseCount", { count: v })}
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
                          {t("eyeCaseLibrary.caseList")}
                          <Tag color="blue">{cases.length}</Tag>
                        </Space>
                      }
                      size="small"
                      extra={<Button icon={<Plus size={12} />} onClick={() => setShowCreateModal(true)}>{t("eyeCaseLibrary.add")}</Button>}
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
                                {t("eyeCaseLibrary.view")}
                              </Button>,
                            ]}
                          >
                            <List.Item.Meta
                              avatar={
                                <Avatar style={{ background: "var(--color-primary-600)" }}>
                                  {c.patientName?.slice(0, 1) || "P"}
                                </Avatar>
                              }
                              title={
                                <Space>
                                  <span>{c.patientName || t("eyeCaseLibrary.unknown")}</span>
                                  <Tag color="cyan">
                                    {t(MODALITY_LABELS_DICT[c.modality] ||
                                      c.modality ||
                                      "eyeCaseLibrary.modalityFundus")}
                                  </Tag>
                                  <Tag>
                                    {t(STATUS_LABELS_DICT[c.status] ||
                                      c.status ||
                                      "eyeCaseLibrary.statusArchive")}
                                  </Tag>
                                </Space>
                              }
                              description={
                                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                  ID: {c.id || c.reportId} |{" "}
                                  {c.chiefComplaint || t("eyeCaseLibrary.routineExam")}
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
                      {t("eyeCaseLibrary.caseDetail")} {selectedCase?.id}
                    </Space>
                  }
                  open={!!selectedCase}
                  onClose={() => setSelectedCase(null)}
                  width={680}
                >
                  {selectedCase && (
                    <>
                      <Descriptions bordered column={1} size="small">
                        <Descriptions.Item label={t("eyeCaseLibrary.patient")}>
                          {selectedCase.patientName}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("eyeCaseLibrary.modality")}>
                          {t(MODALITY_LABELS_DICT[selectedCase.modality] ||
                            selectedCase.modality ||
                            "eyeCaseLibrary.modalityFundus")}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("eyeCaseLibrary.bodyPart")}>
                          {selectedCase.bodyPart || "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("eyeCaseLibrary.chiefComplaint")}>
                          {selectedCase.chiefComplaint || "-"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("eyeCaseLibrary.diagnosis")}>
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
                                <Edit size={12} /> {t("eyeCaseLibrary.tabAnnotate")}
                              </span>
                            ),
                            children: (
                              <>
                                <Form layout="inline" size="small">
                                  <Form.Item label={t("eyeCaseLibrary.type")}>
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
                                        { value: "roi", label: t("eyeCaseLibrary.annoRoi") },
                                        {
                                          value: "segmentation",
                                          label: t("eyeCaseLibrary.annoSegmentation"),
                                        },
                                        { value: "measurement", label: t("eyeCaseLibrary.annoMeasurement") },
                                        { value: "text", label: t("eyeCaseLibrary.annoText") },
                                        { value: "arrow", label: t("eyeCaseLibrary.annoArrow") },
                                      ]}
                                    />
                                  </Form.Item>
                                  <Form.Item label={t("eyeCaseLibrary.label")}>
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
                                      {t("eyeCaseLibrary.add")}
                                    </Button>
                                  </Form.Item>
                                </Form>
                                <Alert
                                  title={t("eyeCaseLibrary.annotateSrHint")}
                                  type="info"
                                  showIcon
                                  style={{ marginTop: 'var(--space-2, 8px)' }}
                                />
                              </>
                            ),
                          },
                          {
                            key: "export",
                            label: (
                              <span>
                                <Download size={12} /> {t("eyeCaseLibrary.tabExportSr")}
                              </span>
                            ),
                            children: (
                              <>
                                <Button
                                  type="primary"
                                  icon={<Download size={12} />}
                                  onClick={handleExportSR}
                                >
                                  {t("eyeCaseLibrary.exportSrBtn")}
                                </Button>
                                {srExportResult && (
                                  <div style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12 }}>
                                    <div>
                                      {t("eyeCaseLibrary.sopInstanceUid")}{" "}
                                      <code>
                                        {srExportResult.sopInstanceUID}
                                      </code>
                                    </div>
                                    <div>{t("eyeCaseLibrary.formatLabel")} {srExportResult.format}</div>
                                    <div>
                                      {t("eyeCaseLibrary.contentCount")}{" "}
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
                                <Shield size={12} /> {t("eyeCaseLibrary.tabDeid")}
                              </span>
                            ),
                            children: (
                              <>
                                <Button
                                  type="primary"
                                  icon={<Shield size={12} />}
                                  onClick={handleDeidentify}
                                >
                                  {t("eyeCaseLibrary.deidBtn")}
                                </Button>
                                {deidentifiedResult && (
                                  <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                                    <Tag color="green">
                                      {deidentifiedResult.deidentifiedId}
                                    </Tag>
                                    <div style={{ fontSize: 12, marginTop: 'var(--space-2, 8px)' }}>
                                      {t("eyeCaseLibrary.actionsExecuted")}
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
                <Microscope size={14} /> {t("eye.edu.projects")}
              </span>
            ),
            children: (
              <>
                <Button
                  type="primary"
                  icon={<FolderPlus size={14} />}
                  style={{ marginBottom: 'var(--space-3, 12px)' }}
                  onClick={() => setShowProjectModal(true)}
                >
                  {t("eye.edu.createProject")}
                </Button>
                <Row gutter={[16, 16]}>
                  {projects.map((p) => (
                    <Col span={8} key={p.projectId}>
                      <Card size="small" title={p.name}>
                        <Progress
                          percent={Math.round((p.completed / p.total) * 100)}
                        />
                        <div
                          style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 'var(--space-2, 8px)' }}
                        >
                          {t("eyeCaseLibrary.annotationsProgress", { completed: p.completed, total: p.total })}
                        </div>
                        <Tag
                          color={p.status === "completed" ? "green" : "blue"}
                          style={{ marginTop: 'var(--space-1, 4px)' }}
                        >
                          {p.status === "completed" ? t("eyeCaseLibrary.completed") : t("eyeCaseLibrary.inProgress")}
                        </Tag>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            ),
          },
        ]}
      />

      <Modal
        title={t("eyeCaseLibrary.addCaseTitle")}
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        onOk={() => void handleCreateCase()}
        confirmLoading={creating}
        okText={t("eyeCaseLibrary.create")}
        width={500}
      >
        <Form layout="vertical" size="small">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label={t("eyeCaseLibrary.patientNameRequired")} required>
                <Input value={newCase.patientName} onChange={(e) => setNewCase({ ...newCase, patientName: e.target.value })} placeholder={t("eyeCaseLibrary.enterName")} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t("eyeCaseLibrary.patientIdRequired")} required>
                <Input value={newCase.patientId} onChange={(e) => setNewCase({ ...newCase, patientId: e.target.value })} placeholder={t("eyeCaseLibrary.patientIdPlaceholder")} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t("eyeCaseLibrary.examModality")}>
                <Select value={newCase.modality} onChange={(v) => setNewCase({ ...newCase, modality: v })} options={Object.entries(MODALITY_LABELS_DICT).map(([value, label]) => ({ value, label: t(label) }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t("eyeCaseLibrary.examDate")}>
                <Input type="date" value={newCase.studyDate} onChange={(e) => setNewCase({ ...newCase, studyDate: e.target.value })} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t("eyeCaseLibrary.chiefComplaint")}>
                <Input value={newCase.chiefComplaint} onChange={(e) => setNewCase({ ...newCase, chiefComplaint: e.target.value })} placeholder={t("eyeCaseLibrary.chiefComplaintPlaceholder")} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label={t("eyeCaseLibrary.diagnosis")}>
                <Input value={newCase.diagnosis} onChange={(e) => setNewCase({ ...newCase, diagnosis: e.target.value })} placeholder={t("eyeCaseLibrary.diagnosisPlaceholder")} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* [v3.0.6.11-103 Wave 3A] 创建标注项目 */}
      <Modal
        title={t("eye.edu.createProject")}
        open={showProjectModal}
        onCancel={() => setShowProjectModal(false)}
        onOk={() => void handleCreateProject()}
        confirmLoading={creatingProject}
        okText={t("eye.common.confirm")}
        width={420}
      >
        <Form layout="vertical" size="small">
          <Form.Item label={t("eye.edu.projectName")} required>
            <Input
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              placeholder={t("eyeCaseLibrary.projectNamePlaceholder")}
            />
          </Form.Item>
          <Form.Item label={t("eye.edu.projectTotal")}>
            <InputNumber
              value={newProject.total}
              onChange={(v) => setNewProject({ ...newProject, total: v || 0 })}
              min={1}
              max={10000}
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CaseLibraryPage;
