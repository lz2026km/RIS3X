import React, { useState, useEffect } from "react";
import { Save, Send } from "lucide-react";
import { message } from "antd";
import { DataTable } from "../components/common/DataTable";
import { StatusTag } from "../components/common/StatusTag";
import {
  regionalApi,
  type AccessApplicationDto,
  type ConsultationRequestDto,
  type AccessRecordDto,
  type InstitutionDto,
  type CrossInstitutionStudyDto,
  type DocumentRegistryEntryDto,
  type RetrievedDocumentDto,
  type AuditTrailEntryDto,
  type RegionalImagingDto,
  type DepartmentScheduleDto,
  type DepartmentDto,
  type IntegrationStatusDto,
} from "../services/api/regionalApi";
import { t } from "../i18n/appI18n";

// Types
type AccessApplication = AccessApplicationDto;
type ConsultationRequest = ConsultationRequestDto;
type AccessRecord = AccessRecordDto;
type Institution = InstitutionDto;
type DocumentEntry = DocumentRegistryEntryDto;

// Mock data removed - now fetched from API in each sub-component

// Tab Components
const ApplicationList: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [apps, setApps] = useState<AccessApplication[]>([]);
  const [_loading, setLoading] = useState(true);
  const [newApp, setNewApp] = useState({
    patientName: "",
    patientId: "",
    hospital: "东华区第一医院",
    modality: "CT",
    reason: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await regionalApi.listApplications();
        if (res.success && Array.isArray(res.data)) setApps(res.data);
      } catch { message.error(t('regionalImaging.loadAppsFailed')); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSubmit = async () => {
    try {
      const res = await regionalApi.createApplication(newApp);
      if (res.success) {
        setApps(prev => [...prev, res.data as AccessApplication]);
        message.success(t('regionalImaging.appSubmitted'));
      }
    } catch { message.error(t('regionalImaging.submitAppFailed')); }
    setShowModal(false);
    setNewApp({ patientName: "", patientId: "", hospital: "东华区第一医院", modality: "CT", reason: "" });
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{t('regionalImaging.appList')}</h3>
        <button style={styles.primaryBtn} onClick={() => setShowModal(true)}>
          + {t('regionalImaging.newApp')}
        </button>
      </div>
      <DataTable
        dataSource={apps}
        rowKey={(app) => app.id}
        pagination={false}
        showExport={false}
        showDensity={false}
        emptyText={t('regionalImaging.noSharingData')}
        columns={[
          { title: t('regionalImaging.appId'), dataIndex: 'id', key: 'id' },
          { title: t('regionalImaging.patientName'), dataIndex: 'patientName', key: 'patientName' },
          { title: t('regionalImaging.patientId'), dataIndex: 'patientId', key: 'patientId' },
          { title: t('regionalImaging.hospital'), dataIndex: 'hospital', key: 'hospital' },
          { title: t('regionalImaging.modality'), dataIndex: 'modality', key: 'modality' },
          { title: t('regionalImaging.applyDate'), dataIndex: 'applyDate', key: 'applyDate' },
          {
            title: t('regionalImaging.status'), key: 'status',
            render: (_v, app) => (
              <StatusTag status={app.status === 'pending' ? 'pending' : app.status === 'approved' ? 'approved' : 'rejected'}>
                {app.status === "pending"
                  ? t('regionalImaging.statusPending')
                  : app.status === "approved"
                    ? t('regionalImaging.statusApproved')
                    : t('regionalImaging.statusRejected')}
              </StatusTag>
            ),
          },
        ]}
      />
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h4 style={styles.modalTitle}>{t('regionalImaging.newApp')}</h4>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.patientName')}</label>
              <input
                style={styles.input}
                value={newApp.patientName}
                onChange={(e) =>
                  setNewApp({ ...newApp, patientName: e.target.value })
                }
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.idCard')}</label>
              <input
                style={styles.input}
                value={newApp.patientId}
                onChange={(e) =>
                  setNewApp({ ...newApp, patientId: e.target.value })
                }
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.hospital')}</label>
              <select
                style={styles.select}
                value={newApp.hospital}
                onChange={(e) =>
                  setNewApp({ ...newApp, hospital: e.target.value })
                }
              >
                <option>东华区第一医院</option>
                <option>国家医学中心直属医院</option>
                <option>青浦区分院</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.modality')}</label>
              <select
                style={styles.select}
                value={newApp.modality}
                onChange={(e) =>
                  setNewApp({ ...newApp, modality: e.target.value })
                }
              >
                <option>CT</option>
                <option>MRI</option>
                <option>X线</option>
                <option>超声</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.reason')}</label>
              <textarea
                style={styles.textarea}
                value={newApp.reason}
                onChange={(e) =>
                  setNewApp({ ...newApp, reason: e.target.value })
                }
              />
            </div>
            <div style={styles.modalActions}>
              <button
                style={styles.cancelBtn}
                onClick={() => setShowModal(false)}
              >
                {t('regionalImaging.cancel')}
              </button>
              <button style={{ ...styles.primaryBtn, display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleSubmit}>
                <Send size={14} />{t('regionalImaging.submitApp')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReceiveList: React.FC = () => {
  const [apps, setApps] = useState<AccessApplication[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await regionalApi.listApplications();
        if (res.success && Array.isArray(res.data)) setApps(res.data);
      } catch { message.error(t('regionalImaging.loadReceiveFailed')); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await regionalApi.approveApplication(id);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: "approved" as const } : a));
      message.success(t('regionalImaging.approved'));
    } catch { message.error(t('regionalImaging.approveFailed')); }
  };
  const handleReject = async (id: string) => {
    try {
      await regionalApi.rejectApplication(id);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: "rejected" as const } : a));
      message.success(t('regionalImaging.rejected'));
    } catch { message.error(t('regionalImaging.rejectFailed')); }
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{t('regionalImaging.receiveList')}</h3>
      </div>
      <DataTable
        dataSource={apps.filter((a) => a.status === "pending")}
        rowKey={(app) => app.id}
        pagination={false}
        showExport={false}
        showDensity={false}
        emptyText={t('regionalImaging.noSharingData')}
        columns={[
          { title: t('regionalImaging.appId'), dataIndex: 'id', key: 'id' },
          { title: t('regionalImaging.patientName'), dataIndex: 'patientName', key: 'patientName' },
          { title: t('regionalImaging.hospital'), dataIndex: 'hospital', key: 'hospital' },
          { title: t('regionalImaging.modality'), dataIndex: 'modality', key: 'modality' },
          { title: t('regionalImaging.reason'), key: 'reason', render: (_v, app) => app.reason || "复诊对比" },
          {
            title: t('regionalImaging.actions'), key: 'actions',
            render: (_v, app) => (
              <span>
                <button style={styles.approveBtn} onClick={() => handleApprove(app.id)}>{t('regionalImaging.approve')}</button>
                <button style={styles.rejectBtn} onClick={() => handleReject(app.id)}>{t('regionalImaging.reject')}</button>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
};

const ConsultationRequests: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [newCon, setNewCon] = useState<{
    patientName: string;
    hospital: string;
    diagnosis: string;
    priority: "normal" | "urgent" | "critical";
  }>({
    patientName: "",
    hospital: "东华区第一医院",
    diagnosis: "",
    priority: "normal",
  });
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await regionalApi.listConsultationRequests();
        if (res.success && Array.isArray(res.data)) setConsultations(res.data);
      } catch { message.error(t('regionalImaging.loadConsultsFailed')); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSubmit = async () => {
    try {
      const res = await regionalApi.createConsultationRequest({
        ...newCon,
        status: 'open',
        createDate: new Date().toISOString().split("T")[0],
      });
      if (res.success) {
        setConsultations(prev => [...prev, res.data as ConsultationRequest]);
        message.success(t('regionalImaging.consultSubmitted'));
      }
    } catch { message.error(t('regionalImaging.submitConsultFailed')); }
    setShowModal(false);
    setNewCon({ patientName: "", hospital: "东华区第一医院", diagnosis: "", priority: "normal" });
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{t('regionalImaging.consultRequests')}</h3>
        <button style={styles.primaryBtn} onClick={() => setShowModal(true)}>
          + {t('regionalImaging.newConsult')}
        </button>
      </div>
      <DataTable
        dataSource={consultations}
        rowKey={(con) => con.id}
        pagination={false}
        showExport={false}
        showDensity={false}
        emptyText={t('regionalImaging.noSharingData')}
        columns={[
          { title: t('regionalImaging.consultId'), dataIndex: 'id', key: 'id' },
          { title: t('regionalImaging.patientName'), dataIndex: 'patientName', key: 'patientName' },
          { title: t('regionalImaging.initHospital'), dataIndex: 'hospital', key: 'hospital' },
          { title: t('regionalImaging.diagnosis'), dataIndex: 'diagnosis', key: 'diagnosis' },
          {
            title: t('regionalImaging.priority'), key: 'priority',
            render: (_v, con) => (
              <StatusTag status={con.priority === 'critical' ? 'critical' : con.priority === 'urgent' ? 'urgent' : 'neutral'}>
                {con.priority === "critical"
                  ? t('regionalImaging.priorityCritical')
                  : con.priority === "urgent"
                    ? t('regionalImaging.priorityUrgent')
                    : t('regionalImaging.priorityNormal')}
              </StatusTag>
            ),
          },
          {
            title: t('regionalImaging.status'), key: 'status',
            render: (_v, con) => (
              <StatusTag status={con.status === 'completed' ? 'completed' : con.status === 'in-progress' ? 'in_progress' : 'neutral'}>
                {con.status === "completed"
                  ? t('regionalImaging.statusCompleted')
                  : con.status === "in-progress"
                    ? t('regionalImaging.statusInProgress')
                    : t('regionalImaging.statusPendingAccept')}
              </StatusTag>
            ),
          },
          { title: t('regionalImaging.expert'), key: 'expert', render: (_v, con) => con.expert || "-" },
        ]}
      />
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h4 style={styles.modalTitle}>{t('regionalImaging.consultRequestTitle')}</h4>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.patientName')}</label>
              <input
                style={styles.input}
                value={newCon.patientName}
                onChange={(e) =>
                  setNewCon({ ...newCon, patientName: e.target.value })
                }
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.initHospital')}</label>
              <select
                style={styles.select}
                value={newCon.hospital}
                onChange={(e) =>
                  setNewCon({ ...newCon, hospital: e.target.value })
                }
              >
                <option>东华区第一医院</option>
                <option>国家医学中心直属医院</option>
                <option>青浦区分院</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.initialDiagnosis')}</label>
              <input
                style={styles.input}
                value={newCon.diagnosis}
                onChange={(e) =>
                  setNewCon({ ...newCon, diagnosis: e.target.value })
                }
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.priority')}</label>
              <select
                style={styles.select}
                value={newCon.priority}
                onChange={(e) =>
                  setNewCon({ ...newCon, priority: e.target.value as any })
                }
              >
                <option value="normal">{t('regionalImaging.priorityNormal')}</option>
                <option value="urgent">{t('regionalImaging.priorityUrgent')}</option>
                <option value="critical">{t('regionalImaging.priorityCritical')}</option>
              </select>
            </div>
            <div style={styles.modalActions}>
              <button
                style={styles.cancelBtn}
                onClick={() => setShowModal(false)}
              >
                {t('regionalImaging.cancel')}
              </button>
              <button style={{ ...styles.primaryBtn, display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleSubmit}>
                <Send size={14} />{t('regionalImaging.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DicomViewer: React.FC = () => {
  const [activeTool, setActiveTool] = useState("pan");
  const [activeImage, setActiveImage] = useState(0);
  const tools = [
    { id: "pan", label: t('regionalImaging.toolPan') },
    { id: "zoom", label: t('regionalImaging.toolZoom') },
    { id: "window", label: t('regionalImaging.toolWindow') },
    { id: "measure", label: t('regionalImaging.toolMeasure') },
    { id: "annotate", label: t('regionalImaging.toolAnnotate') },
  ];

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{t('regionalImaging.dicomViewer')}</h3>
        <div style={styles.toolbar}>
          {tools.map((tool) => (
            <button
              key={tool.id}
              style={{
                ...styles.toolBtn,
                ...(activeTool === tool.id ? styles.toolBtnActive : {}),
              }}
              onClick={() => setActiveTool(tool.id)}
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.dicomGrid}>
        {[...Array(6)].map((_, idx) => (
          <div
            key={idx}
            role="button"
            tabIndex={0}
            style={{
              ...styles.dicomImage,
              ...(activeImage === idx ? styles.dicomImageActive : {}),
            }}
            onClick={() => setActiveImage(idx)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveImage(idx) } }}
          >
            <div style={styles.dicomPlaceholder}>
              <div style={styles.dicomImageContent}>
                <span style={styles.dicomLabel}>
                  IMG_{String(idx + 1).padStart(4, "0")}
                </span>
                <div style={styles.dicomMeasurements}>
                  <span>W: 400</span>
                  <span>L: 40</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={styles.viewerInfo}>
        <span>患者: 张伟 | 检查: 胸部CT | 日期: 2026-04-28</span>
        <span>当前图像: {activeImage + 1} / 6</span>
      </div>
    </div>
  );
};

const AccessRecords: React.FC = () => {
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await regionalApi.listAccessRecords();
        if (res.success && Array.isArray(res.data)) setRecords(res.data);
      } catch { message.error(t('regionalImaging.loadRecordsFailed')); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{t('regionalImaging.recordHistory')}</h3>
      </div>
      <DataTable
        dataSource={records}
        rowKey={(rec) => rec.id}
        pagination={false}
        showExport={false}
        showDensity={false}
        emptyText={t('regionalImaging.noSharingData')}
        columns={[
          { title: t('regionalImaging.recordId'), dataIndex: 'id', key: 'id' },
          { title: t('regionalImaging.patientName'), dataIndex: 'patientName', key: 'patientName' },
          { title: t('regionalImaging.idCard'), dataIndex: 'patientId', key: 'patientId' },
          { title: t('regionalImaging.modality'), dataIndex: 'studyType', key: 'studyType' },
          { title: t('regionalImaging.hospital'), dataIndex: 'hospital', key: 'hospital' },
          { title: t('regionalImaging.accessTime'), dataIndex: 'accessTime', key: 'accessTime' },
          { title: t('regionalImaging.accessor'), dataIndex: 'accessor', key: 'accessor' },
          { title: t('regionalImaging.purpose'), dataIndex: 'purpose', key: 'purpose' },
        ]}
      />
    </div>
  );
};

// ============ 新增: 跨机构查询 ============
const CrossInstitutionQuery: React.FC = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState("H001");
  const [queryType, setQueryType] = useState("patientId");
  const [queryValue, setQueryValue] = useState("");
  const [results, setResults] = useState<CrossInstitutionStudyDto[]>([]);
  const [retrieveProgress, setRetrieveProgress] = useState(0);
  const [retrieving, setRetrieving] = useState(false);
  const [queried, setQueried] = useState(false);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await regionalApi.listInstitutions();
        if (res.success && Array.isArray(res.data)) {
          setInstitutions(res.data);
          if (res.data.length > 0) setSelectedInstitution(res.data[0]!.id);
        }
      } catch { message.error(t('regionalImaging.loadInstitutionsFailed')); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleQuery = async () => {
    try {
      const res = await regionalApi.crossInstitutionQuery({
        institutionId: selectedInstitution,
        queryType,
        queryValue,
      });
      if (res.success && Array.isArray(res.data)) {
        setResults(res.data);
        setQueried(true);
      }
    } catch { message.error(t('regionalImaging.crossQueryFailed')); }
  };

  const handleRetrieve = (_study: any) => {
    setRetrieving(true);
    setRetrieveProgress(0);
    const interval = setInterval(() => {
      setRetrieveProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setRetrieving(false), 500);
          return 100;
        }
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 200);
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{t('regionalImaging.crossQuery')}</h3>
      </div>
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          background: "var(--bg-primary)",
          borderRadius: 8,
          border: "1px solid var(--border-default)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: 4,
              }}
            >
                {t('regionalImaging.targetPacs')}
            </label>
            <select
              style={{
                padding: "8px 12px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
              value={selectedInstitution}
              onChange={(e) => setSelectedInstitution(e.target.value)}
            >
              {institutions
                .filter((i) => i.status === "online")
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.aeTitle})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: 4,
              }}
            >
                {t('regionalImaging.queryType')}
            </label>
            <select
              style={{
                padding: "8px 12px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
              value={queryType}
              onChange={(e) => setQueryType(e.target.value)}
            >
              <option value="patientId">{t('regionalImaging.patientId')}</option>
              <option value="patientName">{t('regionalImaging.patientName')}</option>
              <option value="accession">{t('regionalImaging.accession')}</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: 4,
              }}
            >
                {t('regionalImaging.queryValue')}
            </label>
            <input
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: 12,
                boxSizing: "border-box",
              }}
              placeholder={t('regionalImaging.queryValuePlaceholder')}
              value={queryValue}
              onChange={(e) => setQueryValue(e.target.value)}
            />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button
              style={{
                padding: "8px 20px",
                background: "var(--color-primary)",
                color: "var(--text-inverse)",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
              }}
              onClick={handleQuery}
            >
              {t('regionalImaging.queryCFind')}
            </button>
          </div>
        </div>
      </div>
      {queried && (
        <div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
            查询结果: {results.length} 条检查记录 (来自{" "}
            {institutions.find((i) => i.id === selectedInstitution)?.name})
          </div>
          <DataTable
            dataSource={results}
            rowKey={(r) => r.id}
            pagination={false}
            showExport={false}
            showDensity={false}
            emptyText={t('regionalImaging.noSharingData')}
            columns={[
              { title: t('regionalImaging.patientId'), dataIndex: 'patientId', key: 'patientId' },
              { title: t('regionalImaging.name'), dataIndex: 'patientName', key: 'patientName' },
              { title: t('regionalImaging.studyDescription'), dataIndex: 'studyDescription', key: 'studyDescription' },
              { title: t('regionalImaging.device'), dataIndex: 'modality', key: 'modality' },
              { title: t('regionalImaging.date'), dataIndex: 'date', key: 'date' },
              {
                title: t('regionalImaging.status'), key: 'status',
                render: (_v, r) => (
                  <StatusTag status={r.status === 'available' ? 'success' : 'neutral'}>
                    {r.status === "available" ? t('regionalImaging.available') : t('regionalImaging.unavailable')}
                  </StatusTag>
                ),
              },
              {
                title: t('regionalImaging.actions'), key: 'actions',
                render: (_v, r) => (
                  retrieving ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 80, height: 6, background: "var(--bg-card)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${retrieveProgress}%`, background: "var(--color-primary)", borderRadius: 3, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{retrieveProgress}%</span>
                    </div>
                  ) : (
                    <button
                      style={{ padding: "4px 12px", background: "var(--color-primary)", color: "var(--text-inverse)", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                      onClick={() => handleRetrieve(r)}
                    >
                      {t('regionalImaging.cMoveRetrieve')}
                    </button>
                  )
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};

// ============ 新增: IHE XDS-I ============
const XDSIntegration: React.FC = () => {
  const [patientId, setPatientId] = useState("");
  const [docs, setDocs] = useState<DocumentRegistryEntryDto[]>([]);
  const [queried, setQueried] = useState(false);
  const [pixResult, setPixResult] = useState<{
    local: string;
    remote: string;
  } | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntryDto[]>([]);
  const [_loadingAudit, setLoadingAudit] = useState(true);
  // [G005 W1-Controls P0-2] IHE XDS-I 文档调阅
  const [retrieveOpen, setRetrieveOpen] = useState(false);
  const [retrieving, setRetrieving] = useState(false);
  const [retrievedDoc, setRetrievedDoc] = useState<RetrievedDocumentDto | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await regionalApi.listAuditTrail();
        if (res.success && Array.isArray(res.data)) setAuditTrail(res.data);
      } catch { message.error(t('regionalImaging.loadAuditFailed')); }
      finally { setLoadingAudit(false); }
    })();
  }, []);

  const handleQueryRegistry = async () => {
    try {
      const res = await regionalApi.listDocumentRegistry();
      if (res.success && Array.isArray(res.data)) {
        setDocs(res.data.filter(d => patientId ? d.patientId.includes(patientId) : true));
        setQueried(true);
      }
    } catch { message.error(t('regionalImaging.registryQueryFailed')); }
  };

  const handlePixQuery = async () => {
    try {
      const res = await regionalApi.pixQuery(patientId);
      if (res.success && res.data) {
        setPixResult(res.data as { local: string; remote: string });
      }
    } catch { message.error(t('regionalImaging.pixQueryFailed')); }
  };

  const handleRetrieveDoc = async (doc: DocumentEntry) => {
    // [G005 W1-Controls P0-2] IHE XDS-I Retrieve → regionalApi.retrieveDocument (MSW 确定性文档)
    setRetrieveOpen(true);
    setRetrievedDoc(null);
    setRetrieving(true);
    try {
      const res = await regionalApi.retrieveDocument(doc.id);
      if (res.success && res.data) {
        setRetrievedDoc(res.data);
        message.success(t('w1Controls.regional.retrieved', { title: res.data.title }));
      } else {
        message.error(res.error?.message ?? t('w1Controls.regional.retrieveFailed'));
        setRetrieveOpen(false);
      }
    } catch {
      message.error(t('w1Controls.regional.retrieveFailed'));
      setRetrieveOpen(false);
    } finally {
      setRetrieving(false);
    }
  };

  const handleDownloadDoc = () => {
    if (!retrievedDoc) return;
    const blob = new Blob([retrievedDoc.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${retrievedDoc.documentId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(t('w1Controls.regional.downloaded', { name: `${retrievedDoc.documentId}.txt` }));
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{t('regionalImaging.xdsTitle')}</h3>
      </div>
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          background: "var(--bg-primary)",
          borderRadius: 8,
          border: "1px solid var(--border-default)",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
            {t('regionalImaging.registryQuery')}
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: 4,
              }}
            >
                {t('regionalImaging.patientId')}
            </label>
            <input
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-default)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: 12,
                boxSizing: "border-box",
              }}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder={t('regionalImaging.patientIdPlaceholder')}
            />
          </div>
          <button
            style={{
              padding: "8px 20px",
              background: "var(--color-primary)",
              color: "var(--text-inverse)",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
            }}
            onClick={handleQueryRegistry}
          >
            {t('regionalImaging.queryRegistry')}
          </button>
          <button
            style={{
              padding: "8px 20px",
              background: "var(--bg-primary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
            }}
            onClick={handlePixQuery}
          >
            {t('regionalImaging.pixPq')}
          </button>
        </div>
        {pixResult && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: "var(--bg-card)",
              borderRadius: 6,
              border: "1px solid var(--color-primary)",
            }}
          >
            <div style={{ fontSize: 12, color: "var(--color-primary)", marginBottom: 8 }}>
              {t('regionalImaging.pixResultTitle')}
            </div>
            <div style={{ fontSize: 12 }}>
              本地ID: {pixResult.local} → 远程ID:{" "}
              <strong style={{ color: "var(--color-success)" }}>{pixResult.remote}</strong>
            </div>
          </div>
        )}
      </div>
      {queried && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
            文档条目: {docs.length} 条
          </div>
          <DataTable
            dataSource={docs}
            rowKey={(d) => d.id}
            pagination={false}
            showExport={false}
            showDensity={false}
            emptyText={t('regionalImaging.noSharingData')}
            columns={[
              { title: t('regionalImaging.patientId'), dataIndex: 'patientId', key: 'patientId' },
              { title: t('regionalImaging.name'), dataIndex: 'patientName', key: 'patientName' },
              { title: t('regionalImaging.studyDescription'), dataIndex: 'studyDescription', key: 'studyDescription' },
              { title: t('regionalImaging.device'), dataIndex: 'modality', key: 'modality' },
              { title: t('regionalImaging.sourceInstitution'), dataIndex: 'institution', key: 'institution' },
              { title: t('regionalImaging.date'), dataIndex: 'date', key: 'date' },
              {
                title: t('regionalImaging.actions'), key: 'actions',
                render: (_v, d) => (
                  <button
                    style={{ padding: "4px 12px", background: "var(--color-success)", color: "var(--text-inverse)", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                    onClick={() => handleRetrieveDoc(d)}
                  >
                    {t('regionalImaging.retrieveDoc')}
                  </button>
                ),
              },
            ]}
          />
        </div>
      )}
      <div
        style={{
          background: "var(--bg-primary)",
          borderRadius: 8,
          border: "1px solid var(--border-default)",
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 12,
          }}
        >
            {t('regionalImaging.auditLog')}
        </div>
        <DataTable
          dataSource={auditTrail}
          rowKey={(a) => a.id}
          pagination={false}
          showExport={false}
          showDensity={false}
          emptyText={t('regionalImaging.noSharingData')}
          columns={[
            { title: t('regionalImaging.patientId'), dataIndex: 'patientId', key: 'patientId' },
            { title: t('regionalImaging.actions'), dataIndex: 'action', key: 'action' },
            { title: t('regionalImaging.institution'), dataIndex: 'institution', key: 'institution' },
            { title: t('regionalImaging.user'), dataIndex: 'user', key: 'user' },
            { title: t('regionalImaging.time'), dataIndex: 'time', key: 'time' },
            { title: t('regionalImaging.detail'), dataIndex: 'details', key: 'details' },
          ]}
        />
      </div>

      {/* [G005 W1-Controls P0-2] 文档调阅预览 Modal (XDS-I Retrieve) */}
      {retrieveOpen && (
        <div
          onClick={() => setRetrieveOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border-default)", borderRadius: 10, width: "100%", maxWidth: 720, maxHeight: "85vh", overflow: "auto", padding: 20, color: "var(--text-primary)" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{t('w1Controls.regional.retrieveTitle')}</div>
              <button onClick={() => setRetrieveOpen(false)} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border-default)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>{t('w1Controls.regional.close')}</button>
            </div>
            {retrieving ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{t('w1Controls.regional.retrieving')}</div>
            ) : retrievedDoc ? (
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: "var(--color-primary-300)" }}>{retrievedDoc.title}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, fontSize: 12, marginBottom: 14 }}>
                  <div><span style={{ color: "var(--text-muted)" }}>{t('w1Controls.regional.patient')}: </span>{retrievedDoc.patientName} ({retrievedDoc.patientId})</div>
                  <div><span style={{ color: "var(--text-muted)" }}>{t('w1Controls.regional.institution')}: </span>{retrievedDoc.institution}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>{t('w1Controls.regional.reportDate')}: </span>{retrievedDoc.reportDate}</div>
                  <div><span style={{ color: "var(--text-muted)" }}>{t('w1Controls.regional.size')}: </span>{retrievedDoc.sizeBytes} B</div>
                  <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "var(--text-muted)" }}>{t('w1Controls.regional.studyUid')}: </span><code style={{ fontSize: 11 }}>{retrievedDoc.studyUid}</code></div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>{t('w1Controls.regional.content')}</div>
                <pre style={{ whiteSpace: "pre-wrap", background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 8, padding: 14, fontSize: 12, lineHeight: 1.7, margin: 0 }}>{retrievedDoc.content}</pre>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <button onClick={handleDownloadDoc} style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "var(--color-success)", color: "var(--text-inverse)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{t('w1Controls.regional.download')}</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>{t('w1Controls.regional.retrieveFailed')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ [W2-C] 响应归一化 (MSW { success, data: [...] } / Nest { data: [...] }) ============
const listFrom = <T,>(res: { data: unknown }): T[] => {
  const d = res?.data as T[] | { data?: T[] } | null | undefined;
  if (Array.isArray(d)) return d as T[];
  if (d && Array.isArray((d as { data?: unknown }).data)) return (d as { data: T[] }).data;
  return [];
};

// ============ [W2-C] 区域影像共享 (浏览 + 详情/调阅) ============
const RegionalSharing: React.FC = () => {
  const [items, setItems] = useState<RegionalImagingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<RegionalImagingDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await regionalApi.listRegionalImaging();
        if (res.success) setItems(listFrom<RegionalImagingDto>(res));
      } catch {
        message.error(t('regionalImaging.loadSharingFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleView = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await regionalApi.getRegionalImaging(id);
      if (res.success) {
        const d = res.data as unknown;
        const item = Array.isArray(d)
          ? d[0]
          : d && typeof d === "object" && Array.isArray((d as { data?: unknown }).data)
            ? (d as { data: RegionalImagingDto[] }).data[0]
            : (d as RegionalImagingDto | undefined);
        setDetail(item ?? null);
      } else {
        message.error(res.error?.message ?? t('regionalImaging.loadDetailFailed'));
      }
    } catch {
      message.error(t('regionalImaging.loadDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{t('regionalImaging.sharing')}</h3>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          医联体成员机构影像工作量与质量统计{loading ? " (加载中...)" : ` (${items.length} 条)`}
        </span>
      </div>
      {loading ? (
        <div style={{ color: "var(--text-secondary)", padding: "24px 0", textAlign: "center" }}>{t('regionalImaging.loading')}</div>
      ) : (
        <DataTable
          dataSource={items}
          rowKey={(it) => it.id}
          pagination={false}
          showExport={false}
          showDensity={false}
          emptyText={t('regionalImaging.noSharingData')}
          columns={[
            { title: t('regionalImaging.institutionName'), dataIndex: 'institutionName', key: 'institutionName' },
            { title: t('regionalImaging.modalityType'), dataIndex: 'modality', key: 'modality' },
            { title: t('regionalImaging.examCount'), key: 'examCount', align: 'right' as const, render: (_v, it) => it.examCount.toLocaleString() },
            { title: t('regionalImaging.positiveCount'), key: 'positiveCount', align: 'right' as const, render: (_v, it) => it.positiveCount.toLocaleString() },
            { title: t('regionalImaging.positiveRate'), key: 'positiveRate', align: 'right' as const, render: (_v, it) => `${it.positiveRate.toFixed(1)}%` },
            { title: t('regionalImaging.avgReportTime'), key: 'avgReportTime', align: 'right' as const, render: (_v, it) => it.avgReportTime.toFixed(1) },
            {
              title: t('regionalImaging.qualifiedRate'), key: 'qualifiedRate', align: 'right' as const,
              render: (_v, it) => (
                <StatusTag status={it.qualifiedRate >= 95 ? 'success' : it.qualifiedRate >= 90 ? 'warning' : 'critical'}>
                  {it.qualifiedRate.toFixed(1)}%
                </StatusTag>
              ),
            },
            { title: t('regionalImaging.period'), dataIndex: 'period', key: 'period' },
            {
              title: t('regionalImaging.actions'), key: 'actions',
              render: (_v, it) => (
                <button style={styles.approveBtn} onClick={() => handleView(it.id)}>
                  {detailLoading ? t('regionalImaging.loading') : t('regionalImaging.detailRetrieve')}
                </button>
              ),
            },
          ]}
        />
      )}
      {detail && (
        <div style={styles.modalOverlay} onClick={() => setDetail(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4 style={styles.modalTitle}>区域影像详情 — {detail.institutionName}</h4>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.institutionId')}</label>
              <div style={styles.td}>{detail.institutionId}</div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.modalityType')}</label>
              <div style={styles.td}>{detail.modality}</div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.examPositive')}</label>
              <div style={styles.td}>
                {detail.examCount.toLocaleString()} 例 / {detail.positiveCount.toLocaleString()} 例 (阳性率 {detail.positiveRate.toFixed(1)}%)
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.avgReportTime')}</label>
              <div style={styles.td}>{detail.avgReportTime.toFixed(1)} 小时</div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.qualifiedRate')}</label>
              <div style={styles.td}>{detail.qualifiedRate.toFixed(1)}%</div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.period')}</label>
              <div style={styles.td}>{detail.period}</div>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.primaryBtn} onClick={() => setDetail(null)}>{t('regionalImaging.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ [W2-C] 科室排班 (排班表 + 编辑) ============
const DepartmentSchedule: React.FC = () => {
  const [schedule, setSchedule] = useState<DepartmentScheduleDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [deptFilter, setDeptFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DepartmentScheduleDto | null>(null);
  const [editForm, setEditForm] = useState({ shift: "", doctorName: "", doctorId: "", status: "" });

  useEffect(() => {
    (async () => {
      try {
        const [sRes, dRes] = await Promise.all([
          regionalApi.getDepartmentSchedule(),
          regionalApi.listDepartments(),
        ]);
        if (sRes.success) setSchedule(listFrom<DepartmentScheduleDto>(sRes));
        if (dRes.success) setDepartments(listFrom<DepartmentDto>(dRes));
      } catch {
        message.error(t('regionalImaging.loadScheduleFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openEdit = (row: DepartmentScheduleDto) => {
    setEditing(row);
    setEditForm({ shift: row.shift, doctorName: row.doctorName, doctorId: row.doctorId, status: row.status });
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const res = await regionalApi.updateSchedule(editing.id, editForm);
      if (res.success) {
        const updated = Array.isArray(res.data) ? res.data[0] : res.data;
        setSchedule((prev) =>
          prev.map((s) => (s.id === editing.id ? (updated ?? { ...editing, ...editForm }) : s)),
        );
        message.success(t('regionalImaging.scheduleUpdated'));
      } else {
        message.error(res.error?.message ?? t('regionalImaging.updateScheduleFailed'));
      }
    } catch {
      message.error(t('regionalImaging.updateScheduleFailed'));
    }
    setEditing(null);
  };

  const visible = deptFilter === "all" ? schedule : schedule.filter((s) => s.departmentId === deptFilter);

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{t('regionalImaging.schedule')}</h3>
        <select
          style={styles.select}
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="all">全部科室 ({departments.length})</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <div style={{ color: "var(--text-secondary)", padding: "24px 0", textAlign: "center" }}>{t('regionalImaging.loading')}</div>
      ) : (
        <DataTable
          dataSource={visible}
          rowKey={(s) => s.id}
          pagination={false}
          showExport={false}
          showDensity={false}
          emptyText={t('regionalImaging.noScheduleData')}
          columns={[
            { title: t('regionalImaging.date'), dataIndex: 'date', key: 'date' },
            { title: t('regionalImaging.department'), dataIndex: 'departmentName', key: 'departmentName' },
            { title: t('regionalImaging.shift'), dataIndex: 'shift', key: 'shift' },
            { title: t('regionalImaging.doctor'), key: 'doctor', render: (_v, s) => `${s.doctorName} (${s.doctorId})` },
            {
              title: t('regionalImaging.status'), key: 'status',
              render: (_v, s) => (
                <StatusTag status={s.status === "已排班" ? 'success' : s.status === "待确认" ? 'warning' : 'critical'}>
                  {s.status}
                </StatusTag>
              ),
            },
            {
              title: t('regionalImaging.actions'), key: 'actions',
              render: (_v, s) => <button style={styles.approveBtn} onClick={() => openEdit(s)}>{t('regionalImaging.edit')}</button>,
            },
          ]}
        />
      )}
      {editing && (
        <div style={styles.modalOverlay} onClick={() => setEditing(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4 style={styles.modalTitle}>编辑排班 — {editing.departmentName} {editing.date}</h4>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.shift')}</label>
              <select
                style={styles.select}
                value={editForm.shift}
                onChange={(e) => setEditForm({ ...editForm, shift: e.target.value })}
              >
                <option>{t('regionalImaging.shiftDay')}</option>
                <option>{t('regionalImaging.shiftNight')}</option>
                <option>{t('regionalImaging.shiftMid')}</option>
                <option>{t('regionalImaging.shiftOnDuty')}</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.doctorName')}</label>
              <input
                style={styles.input}
                value={editForm.doctorName}
                onChange={(e) => setEditForm({ ...editForm, doctorName: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.doctorId')}</label>
              <input
                style={styles.input}
                value={editForm.doctorId}
                onChange={(e) => setEditForm({ ...editForm, doctorId: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>{t('regionalImaging.status')}</label>
              <select
                style={styles.select}
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option>{t('regionalImaging.statusScheduled')}</option>
                <option>{t('regionalImaging.statusConfirming')}</option>
                <option>{t('regionalImaging.statusClosed')}</option>
              </select>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setEditing(null)}>{t('regionalImaging.cancel')}</button>
              <button style={styles.primaryBtn} onClick={handleSave}><Save size={14} />{t('regionalImaging.save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ [W2-C] 集成状态 (FHIR / IHE / MLLP) ============
const IntegrationStatus: React.FC = () => {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatusDto>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [fhir, ihe, mllp] = await Promise.all([
          regionalApi.getFhirStatus(),
          regionalApi.getIheStatus(),
          regionalApi.getMllpStatus(),
        ]);
        const next: Record<string, IntegrationStatusDto> = {};
        if (fhir.success && fhir.data) next.fhir = fhir.data as IntegrationStatusDto;
        if (ihe.success && ihe.data) next.ihe = ihe.data as IntegrationStatusDto;
        if (mllp.success && mllp.data) next.mllp = mllp.data as IntegrationStatusDto;
        setStatuses(next);
      } catch {
        message.error(t('regionalImaging.loadIntegrationFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const defs = [
    { key: "fhir", name: t('regionalImaging.integFhir'), desc: t('regionalImaging.integFhirDesc') },
    { key: "ihe", name: t('regionalImaging.integIhe'), desc: t('regionalImaging.integIheDesc') },
    { key: "mllp", name: t('regionalImaging.integMllp'), desc: t('regionalImaging.integMllpDesc') },
  ];

  // [UI] integration health → canonical statusTokens tone
  const statusColor = (st: string | undefined): string => {
    const s = (st ?? "").toUpperCase();
    if (s === "CONNECTED" || s === "ACTIVE" || s === "ONLINE") return "var(--color-success)";
    if (s === "DEGRADED" || s === "RETRY") return "var(--color-warning)";
    return "var(--color-error)";
  };
  const statusToneKey = (st: string | undefined): string => {
    const s = (st ?? "").toUpperCase();
    if (s === "CONNECTED" || s === "ACTIVE" || s === "ONLINE") return "success";
    if (s === "DEGRADED" || s === "RETRY") return "warning";
    return "critical";
  };
  const statusLabel = (st: string | undefined): string => {
    const s = (st ?? "").toUpperCase();
    if (s === "CONNECTED" || s === "ACTIVE" || s === "ONLINE") return t('regionalImaging.statusNormal');
    if (s === "DEGRADED" || s === "RETRY") return t('regionalImaging.statusDegraded');
    return st || t('regionalImaging.statusUnknown');
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{t('regionalImaging.integrationStatus')}</h3>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          FHIR / IHE XDS-I / HL7 MLLP 通道健康检查{loading ? " (加载中...)" : ""}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {defs.map((d) => {
          const st = statuses[d.key];
          return (
            <div
              key={d.key}
              style={{
                background: "var(--bg-primary)",
                border: `1px solid ${statusColor(st?.status)}`,
                borderRadius: 10,
                padding: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{d.desc}</div>
                </div>
                <StatusTag status={statusToneKey(st?.status)}>
                  {statusLabel(st?.status)}
                </StatusTag>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                上次同步: {st?.lastSync ? new Date(st.lastSync).toLocaleString("zh-CN") : "—"}
              </div>
              {st?.error && <div style={{ fontSize: 12, color: "var(--color-error)", marginTop: 6 }}>{st.error}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Main Component
const RegionalImagingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("applications");

  const tabs = [
    { id: "applications", label: t('regionalImaging.tabApplications') },
    { id: "received", label: t('regionalImaging.tabReceived') },
    { id: "consultations", label: t('regionalImaging.tabConsultations') },
    { id: "viewer", label: t('regionalImaging.tabViewer') },
    { id: "records", label: t('regionalImaging.tabRecords') },
    { id: "crossQuery", label: t('regionalImaging.tabCrossQuery') },
    { id: "xdsi", label: t('regionalImaging.tabXdsi') },
    { id: "sharing", label: t('regionalImaging.tabSharing') },
    { id: "schedule", label: t('regionalImaging.tabSchedule') },
    { id: "integration", label: t('regionalImaging.tabIntegration') },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "applications":
        return <ApplicationList />;
      case "received":
        return <ReceiveList />;
      case "consultations":
        return <ConsultationRequests />;
      case "viewer":
        return <DicomViewer />;
      case "records":
        return <AccessRecords />;
      case "crossQuery":
        return <CrossInstitutionQuery />;
      case "xdsi":
        return <XDSIntegration />;
      case "sharing":
        return <RegionalSharing />;
      case "schedule":
        return <DepartmentSchedule />;
      case "integration":
        return <IntegrationStatus />;
      default:
        return <ApplicationList />;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.pageTitle}>{t('regionalImaging.pageTitle')}</h2>
        <p style={styles.subtitle}>
          东华区第一医院 · 国家医学中心直属医院 · 青浦区分院 · 跨机构查询 · IHE
          XDS-I
        </p>
      </div>
      <div style={styles.tabContainer}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.content}>{renderContent()}</div>
    </div>
  );
};

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  container: { background: "var(--bg-primary)",
    color: "var(--text-primary)",
    padding: "24px",
  },
  header: { marginBottom: "24px" },
  pageTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "var(--color-primary)",
    margin: "0 0 8px 0",
  },
  subtitle: { fontSize: "14px", color: "var(--text-secondary)", margin: 0 },
  tabContainer: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
    borderBottom: "1px solid var(--bg-card)",
    paddingBottom: "8px",
    flexWrap: "wrap" as const,
  },
  tab: {
    padding: "12px 24px",
    background: "transparent",
    border: "none",
    color: "var(--text-secondary)",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    borderRadius: "8px 8px 0 0",
    transition: "all 0.2s",
  },
  tabActive: { background: "var(--color-primary)", color: "var(--text-inverse)" },
  content: { background: "var(--bg-card)", borderRadius: "12px", padding: "24px" },
  section: { width: "100%" },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "var(--text-primary)",
    margin: 0,
  },
  primaryBtn: {
    padding: "10px 20px",
    background: "var(--color-primary)",
    color: "var(--text-inverse)",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
  tableHeaderRow: { background: "var(--bg-primary)" },
  th: {
    padding: "12px 16px",
    textAlign: "left",
    fontWeight: "600",
    color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-default)",
    whiteSpace: "nowrap" as const,
  },
  tableRow: { borderBottom: "1px solid var(--border-default)" },
  td: { padding: "12px 16px", color: "var(--text-primary)" },
  badge: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "16px",
    fontSize: "12px",
    fontWeight: "500",
    color: "var(--text-inverse)",
  },
  approveBtn: {
    padding: "6px 16px",
    background: "var(--color-success)",
    color: "var(--text-inverse)",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
    marginRight: "8px",
  },
  rejectBtn: {
    padding: "6px 16px",
    background: "var(--color-error)",
    color: "var(--text-inverse)",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modal: {
    background: "var(--bg-card)",
    borderRadius: "12px",
    padding: "24px",
    width: "480px",
    maxWidth: "90%",
  },
  modalTitle: {
    fontSize: "20px",
    fontWeight: "600",
    color: "var(--text-primary)",
    margin: "0 0 20px 0",
  },
  formGroup: { marginBottom: "16px" },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: "500",
    color: "var(--text-secondary)",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border-default)",
    borderRadius: "8px",
    color: "var(--text-primary)",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border-default)",
    borderRadius: "8px",
    color: "var(--text-primary)",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 14px",
    background: "var(--bg-primary)",
    border: "1px solid var(--border-default)",
    borderRadius: "8px",
    color: "var(--text-primary)",
    fontSize: "14px",
    minHeight: "80px",
    resize: "vertical" as const,
    boxSizing: "border-box",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginTop: "24px",
  },
  cancelBtn: {
    padding: "10px 20px",
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-default)",
    borderRadius: "8px",
    fontSize: "14px",
    cursor: "pointer",
  },
  toolbar: { display: "flex", gap: "8px" },
  toolBtn: {
    padding: "8px 16px",
    background: "var(--bg-primary)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border-default)",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
  },
  toolBtnActive: {
    background: "var(--color-primary)",
    color: "var(--text-inverse)",
    border: "1px solid var(--color-primary)",
  },
  dicomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
    marginBottom: "16px",
  },
  dicomImage: {
    aspectRatio: "4/3",
    background: "var(--bg-primary)",
    borderRadius: "8px",
    border: "2px solid var(--border-default)",
    cursor: "pointer",
    overflow: "hidden",
    transition: "border-color 0.2s",
  },
  dicomImageActive: { border: "2px solid var(--color-primary)" },
  dicomPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-primary) 100%)",
  },
  dicomImageContent: { textAlign: "center" },
  dicomLabel: {
    display: "block",
    fontSize: "14px",
    fontWeight: "600",
    color: "var(--color-primary)",
    marginBottom: "8px",
  },
  dicomMeasurements: {
    display: "flex",
    gap: "16px",
    justifyContent: "center",
    fontSize: "11px",
    color: "var(--text-secondary)",
  },
  viewerInfo: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
};

export default RegionalImagingPage;
