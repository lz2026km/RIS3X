import React, { useState, useEffect } from "react";
import { Save, Send } from "lucide-react";
import { message } from "antd";
import {
  regionalApi,
  type AccessApplicationDto,
  type ConsultationRequestDto,
  type AccessRecordDto,
  type InstitutionDto,
  type CrossInstitutionStudyDto,
  type DocumentRegistryEntryDto,
  type AuditTrailEntryDto,
  type RegionalImagingDto,
  type DepartmentScheduleDto,
  type DepartmentDto,
  type IntegrationStatusDto,
} from "../services/api/regionalApi";

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
      } catch { message.error('加载申请列表失败'); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSubmit = async () => {
    try {
      const res = await regionalApi.createApplication(newApp);
      if (res.success) {
        setApps(prev => [...prev, res.data as AccessApplication]);
        message.success('申请已提交');
      }
    } catch { message.error('提交申请失败'); }
    setShowModal(false);
    setNewApp({ patientName: "", patientId: "", hospital: "东华区第一医院", modality: "CT", reason: "" });
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>调阅申请列表</h3>
        <button style={styles.primaryBtn} onClick={() => setShowModal(true)}>
          + 发起调阅申请
        </button>
      </div>
      <div style={{ overflowX: "auto" }}><table style={styles.table}>
        <thead>
          <tr style={styles.tableHeaderRow}>
            <th style={styles.th}>申请ID</th>
            <th style={styles.th}>患者姓名</th>
            <th style={styles.th}>患者ID</th>
            <th style={styles.th}>来源医院</th>
            <th style={styles.th}>检查类型</th>
            <th style={styles.th}>申请日期</th>
            <th style={styles.th}>状态</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((app) => (
            <tr key={app.id} style={styles.tableRow}>
              <td style={styles.td}>{app.id}</td>
              <td style={styles.td}>{app.patientName}</td>
              <td style={styles.td}>{app.patientId}</td>
              <td style={styles.td}>{app.hospital}</td>
              <td style={styles.td}>{app.modality}</td>
              <td style={styles.td}>{app.applyDate}</td>
              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    background:
                      app.status === "pending"
                        ? "#f59e0b"
                        : app.status === "approved"
                          ? "#10b981"
                          : "#ef4444",
                  }}
                >
                  {app.status === "pending"
                    ? "待审批"
                    : app.status === "approved"
                      ? "已通过"
                      : "已拒绝"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h4 style={styles.modalTitle}>发起调阅申请</h4>
            <div style={styles.formGroup}>
              <label style={styles.label}>患者姓名</label>
              <input
                style={styles.input}
                value={newApp.patientName}
                onChange={(e) =>
                  setNewApp({ ...newApp, patientName: e.target.value })
                }
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>身份证号</label>
              <input
                style={styles.input}
                value={newApp.patientId}
                onChange={(e) =>
                  setNewApp({ ...newApp, patientId: e.target.value })
                }
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>来源医院</label>
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
              <label style={styles.label}>检查类型</label>
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
              <label style={styles.label}>申请理由</label>
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
                取消
              </button>
              <button style={{ ...styles.primaryBtn, display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleSubmit}>
                <Send size={14} />提交申请
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
      } catch { message.error('加载接收列表失败'); }
      finally { setLoading(false); }
    })();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await regionalApi.approveApplication(id);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: "approved" as const } : a));
      message.success('已批准');
    } catch { message.error('批准失败'); }
  };
  const handleReject = async (id: string) => {
    try {
      await regionalApi.rejectApplication(id);
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: "rejected" as const } : a));
      message.success('已拒绝');
    } catch { message.error('拒绝失败'); }
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>接收列表 - 待审批</h3>
      </div>
      <div style={{ overflowX: "auto" }}><table style={styles.table}>
        <thead>
          <tr style={styles.tableHeaderRow}>
            <th style={styles.th}>申请ID</th>
            <th style={styles.th}>患者姓名</th>
            <th style={styles.th}>来源医院</th>
            <th style={styles.th}>检查类型</th>
            <th style={styles.th}>申请理由</th>
            <th style={styles.th}>操作</th>
          </tr>
        </thead>
        <tbody>
          {apps
            .filter((a) => a.status === "pending")
            .map((app) => (
              <tr key={app.id} style={styles.tableRow}>
                <td style={styles.td}>{app.id}</td>
                <td style={styles.td}>{app.patientName}</td>
                <td style={styles.td}>{app.hospital}</td>
                <td style={styles.td}>{app.modality}</td>
                <td style={styles.td}>{app.reason || "复诊对比"}</td>
                <td style={styles.td}>
                  <button
                    style={styles.approveBtn}
                    onClick={() => handleApprove(app.id)}
                  >
                    批准
                  </button>
                  <button
                    style={styles.rejectBtn}
                    onClick={() => handleReject(app.id)}
                  >
                    拒绝
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table></div>
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
      } catch { message.error('加载会诊请求失败'); }
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
        message.success('会诊请求已提交');
      }
    } catch { message.error('提交会诊请求失败'); }
    setShowModal(false);
    setNewCon({ patientName: "", hospital: "东华区第一医院", diagnosis: "", priority: "normal" });
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>会诊请求</h3>
        <button style={styles.primaryBtn} onClick={() => setShowModal(true)}>
          + 发起会诊
        </button>
      </div>
      <div style={{ overflowX: "auto" }}><table style={styles.table}>
        <thead>
          <tr style={styles.tableHeaderRow}>
            <th style={styles.th}>会诊ID</th>
            <th style={styles.th}>患者姓名</th>
            <th style={styles.th}>发起医院</th>
            <th style={styles.th}>诊断</th>
            <th style={styles.th}>优先级</th>
            <th style={styles.th}>状态</th>
            <th style={styles.th}>专家</th>
          </tr>
        </thead>
        <tbody>
          {consultations.map((con) => (
            <tr key={con.id} style={styles.tableRow}>
              <td style={styles.td}>{con.id}</td>
              <td style={styles.td}>{con.patientName}</td>
              <td style={styles.td}>{con.hospital}</td>
              <td style={styles.td}>{con.diagnosis}</td>
              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    background:
                      con.priority === "critical"
                        ? "#dc2626"
                        : con.priority === "urgent"
                          ? "#f59e0b"
                          : "#6b7280",
                  }}
                >
                  {con.priority === "critical"
                    ? "危急"
                    : con.priority === "urgent"
                      ? "紧急"
                      : "普通"}
                </span>
              </td>
              <td style={styles.td}>
                <span
                  style={{
                    ...styles.badge,
                    background:
                      con.status === "completed"
                        ? "#10b981"
                        : con.status === "in-progress"
                          ? "#3b82f6"
                          : "#6b7280",
                  }}
                >
                  {con.status === "completed"
                    ? "已完成"
                    : con.status === "in-progress"
                      ? "进行中"
                      : "待接诊"}
                </span>
              </td>
              <td style={styles.td}>{con.expert || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h4 style={styles.modalTitle}>发起会诊请求</h4>
            <div style={styles.formGroup}>
              <label style={styles.label}>患者姓名</label>
              <input
                style={styles.input}
                value={newCon.patientName}
                onChange={(e) =>
                  setNewCon({ ...newCon, patientName: e.target.value })
                }
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>发起医院</label>
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
              <label style={styles.label}>初步诊断</label>
              <input
                style={styles.input}
                value={newCon.diagnosis}
                onChange={(e) =>
                  setNewCon({ ...newCon, diagnosis: e.target.value })
                }
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>优先级</label>
              <select
                style={styles.select}
                value={newCon.priority}
                onChange={(e) =>
                  setNewCon({ ...newCon, priority: e.target.value as any })
                }
              >
                <option value="normal">普通</option>
                <option value="urgent">紧急</option>
                <option value="critical">危急</option>
              </select>
            </div>
            <div style={styles.modalActions}>
              <button
                style={styles.cancelBtn}
                onClick={() => setShowModal(false)}
              >
                取消
              </button>
              <button style={{ ...styles.primaryBtn, display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleSubmit}>
                <Send size={14} />提交
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
    { id: "pan", label: "平移" },
    { id: "zoom", label: "缩放" },
    { id: "window", label: "窗宽窗位" },
    { id: "measure", label: "测量" },
    { id: "annotate", label: "标注" },
  ];

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>DICOM图像查看器</h3>
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
            style={{
              ...styles.dicomImage,
              ...(activeImage === idx ? styles.dicomImageActive : {}),
            }}
            onClick={() => setActiveImage(idx)}
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
      } catch { message.error('加载调阅记录失败'); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>调阅记录历史</h3>
      </div>
      <div style={{ overflowX: "auto" }}><table style={styles.table}>
        <thead>
          <tr style={styles.tableHeaderRow}>
            <th style={styles.th}>记录ID</th>
            <th style={styles.th}>患者姓名</th>
            <th style={styles.th}>身份证号</th>
            <th style={styles.th}>检查类型</th>
            <th style={styles.th}>来源医院</th>
            <th style={styles.th}>调阅时间</th>
            <th style={styles.th}>调阅人</th>
            <th style={styles.th}>调阅目的</th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec) => (
            <tr key={rec.id} style={styles.tableRow}>
              <td style={styles.td}>{rec.id}</td>
              <td style={styles.td}>{rec.patientName}</td>
              <td style={styles.td}>{rec.patientId}</td>
              <td style={styles.td}>{rec.studyType}</td>
              <td style={styles.td}>{rec.hospital}</td>
              <td style={styles.td}>{rec.accessTime}</td>
              <td style={styles.td}>{rec.accessor}</td>
              <td style={styles.td}>{rec.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
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
      } catch { message.error('加载机构列表失败'); }
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
    } catch { message.error('跨院查询失败'); }
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
        <h3 style={styles.sectionTitle}>跨机构影像查询</h3>
      </div>
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          background: "#0f172a",
          borderRadius: 8,
          border: "1px solid #334155",
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
              目标PACS
            </label>
            <select
              style={{
                padding: "8px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: 13,
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
              查询条件
            </label>
            <select
              style={{
                padding: "8px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: 13,
              }}
              value={queryType}
              onChange={(e) => setQueryType(e.target.value)}
            >
              <option value="patientId">患者ID</option>
              <option value="patientName">患者姓名</option>
              <option value="accession">检查号</option>
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
              查询值
            </label>
            <input
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: 13,
                boxSizing: "border-box",
              }}
              placeholder="输入查询值"
              value={queryValue}
              onChange={(e) => setQueryValue(e.target.value)}
            />
          </div>
          <div style={{ alignSelf: "flex-end" }}>
            <button
              style={{
                padding: "8px 20px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
              }}
              onClick={handleQuery}
            >
              查询 (C-FIND)
            </button>
          </div>
        </div>
      </div>
      {queried && (
        <div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
            查询结果: {results.length} 条检查记录 (来自{" "}
            {institutions.find((i) => i.id === selectedInstitution)?.name})
          </div>
          <div style={{ overflowX: "auto" }}><table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>患者ID</th>
                <th style={styles.th}>姓名</th>
                <th style={styles.th}>检查描述</th>
                <th style={styles.th}>设备</th>
                <th style={styles.th}>日期</th>
                <th style={styles.th}>状态</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} style={styles.tableRow}>
                  <td style={styles.td}>{r.patientId}</td>
                  <td style={styles.td}>{r.patientName}</td>
                  <td style={styles.td}>{r.studyDescription}</td>
                  <td style={styles.td}>{r.modality}</td>
                  <td style={styles.td}>{r.date}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.badge,
                        background:
                          r.status === "available" ? "#10b981" : "#6b7280",
                      }}
                    >
                      {r.status === "available" ? "可检索" : "不可用"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {retrieving ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 80,
                            height: 6,
                            background: "#1e293b",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${retrieveProgress}%`,
                              background: "#3b82f6",
                              borderRadius: 3,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {retrieveProgress}%
                        </span>
                      </div>
                    ) : (
                      <button
                        style={{
                          padding: "4px 12px",
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                        onClick={() => handleRetrieve(r)}
                      >
                        C-MOVE 检索
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
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

  useEffect(() => {
    (async () => {
      try {
        const res = await regionalApi.listAuditTrail();
        if (res.success && Array.isArray(res.data)) setAuditTrail(res.data);
      } catch { message.error('加载审计日志失败'); }
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
    } catch { message.error('查询文档注册库失败'); }
  };

  const handlePixQuery = async () => {
    try {
      const res = await regionalApi.pixQuery(patientId);
      if (res.success && res.data) {
        setPixResult(res.data as { local: string; remote: string });
      }
    } catch { message.error('PIX查询失败'); }
  };

  const handleRetrieveDoc = (_doc: DocumentEntry) => {
    // Wire to xdsService.retrieve(doc.id) in v3.0.6
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>IHE XDS-I 跨文档共享</h3>
      </div>
      <div
        style={{
          marginBottom: 20,
          padding: 16,
          background: "#0f172a",
          borderRadius: 8,
          border: "1px solid #334155",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#e2e8f0",
            marginBottom: 12,
          }}
        >
          文档注册库查询
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
              患者ID
            </label>
            <input
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: 6,
                color: "#e2e8f0",
                fontSize: 13,
                boxSizing: "border-box",
              }}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="输入患者ID"
            />
          </div>
          <button
            style={{
              padding: "8px 20px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
            onClick={handleQueryRegistry}
          >
            查询注册库
          </button>
          <button
            style={{
              padding: "8px 20px",
              background: "#0f172a",
              color: "var(--text-secondary)",
              border: "1px solid #334155",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
            onClick={handlePixQuery}
          >
            PIX/PDQ 交叉索引
          </button>
        </div>
        {pixResult && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: "#1e293b",
              borderRadius: 6,
              border: "1px solid #3b82f6",
            }}
          >
            <div style={{ fontSize: 12, color: "#3b82f6", marginBottom: 8 }}>
              Patient Identity Cross-Reference (PIX) 结果
            </div>
            <div style={{ fontSize: 13 }}>
              本地ID: {pixResult.local} → 远程ID:{" "}
              <strong style={{ color: "#10b981" }}>{pixResult.remote}</strong>
            </div>
          </div>
        )}
      </div>
      {queried && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
            文档条目: {docs.length} 条
          </div>
          <div style={{ overflowX: "auto" }}><table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.th}>患者ID</th>
                <th style={styles.th}>姓名</th>
                <th style={styles.th}>检查描述</th>
                <th style={styles.th}>设备</th>
                <th style={styles.th}>来源机构</th>
                <th style={styles.th}>日期</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} style={styles.tableRow}>
                  <td style={styles.td}>{d.patientId}</td>
                  <td style={styles.td}>{d.patientName}</td>
                  <td style={styles.td}>{d.studyDescription}</td>
                  <td style={styles.td}>{d.modality}</td>
                  <td style={styles.td}>{d.institution}</td>
                  <td style={styles.td}>{d.date}</td>
                  <td style={styles.td}>
                    <button
                      style={{
                        padding: "4px 12px",
                        background: "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                      onClick={() => handleRetrieveDoc(d)}
                    >
                      检索文档
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
      <div
        style={{
          background: "#0f172a",
          borderRadius: 8,
          border: "1px solid #334155",
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#e2e8f0",
            marginBottom: 12,
          }}
        >
          跨机构访问审计日志
        </div>
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.th}>患者ID</th>
              <th style={styles.th}>操作</th>
              <th style={styles.th}>机构</th>
              <th style={styles.th}>用户</th>
              <th style={styles.th}>时间</th>
              <th style={styles.th}>详情</th>
            </tr>
          </thead>
          <tbody>
            {auditTrail.map((a) => (
              <tr key={a.id} style={styles.tableRow}>
                <td style={styles.td}>{a.patientId}</td>
                <td style={styles.td}>{a.action}</td>
                <td style={styles.td}>{a.institution}</td>
                <td style={styles.td}>{a.user}</td>
                <td style={styles.td}>{a.time}</td>
                <td style={styles.td}>{a.details}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
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
        message.error("加载区域影像失败");
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
        message.error(res.error?.message ?? "加载详情失败");
      }
    } catch {
      message.error("加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>区域影像共享</h3>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          医联体成员机构影像工作量与质量统计{loading ? " (加载中...)" : ` (${items.length} 条)`}
        </span>
      </div>
      {loading ? (
        <div style={{ color: "var(--text-secondary)", padding: "24px 0", textAlign: "center" }}>加载中...</div>
      ) : (
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.th}>机构名称</th>
              <th style={styles.th}>设备类型</th>
              <th style={styles.th}>检查量</th>
              <th style={styles.th}>阳性数</th>
              <th style={styles.th}>阳性率</th>
              <th style={styles.th}>平均报告时长(h)</th>
              <th style={styles.th}>报告合格率</th>
              <th style={styles.th}>统计周期</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} style={styles.tableRow}>
                <td style={styles.td}>{it.institutionName}</td>
                <td style={styles.td}>{it.modality}</td>
                <td style={styles.td}>{it.examCount.toLocaleString()}</td>
                <td style={styles.td}>{it.positiveCount.toLocaleString()}</td>
                <td style={styles.td}>{it.positiveRate.toFixed(1)}%</td>
                <td style={styles.td}>{it.avgReportTime.toFixed(1)}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background: it.qualifiedRate >= 95 ? "#10b981" : it.qualifiedRate >= 90 ? "#f59e0b" : "#ef4444",
                    }}
                  >
                    {it.qualifiedRate.toFixed(1)}%
                  </span>
                </td>
                <td style={styles.td}>{it.period}</td>
                <td style={styles.td}>
                  <button style={styles.approveBtn} onClick={() => handleView(it.id)}>
                    {detailLoading ? "加载中..." : "详情/调阅"}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td style={{ ...styles.td, textAlign: "center" }} colSpan={9}>
                  暂无区域影像数据
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      )}
      {detail && (
        <div style={styles.modalOverlay} onClick={() => setDetail(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4 style={styles.modalTitle}>区域影像详情 — {detail.institutionName}</h4>
            <div style={styles.formGroup}>
              <label style={styles.label}>机构ID</label>
              <div style={styles.td}>{detail.institutionId}</div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>设备类型</label>
              <div style={styles.td}>{detail.modality}</div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>检查量 / 阳性数</label>
              <div style={styles.td}>
                {detail.examCount.toLocaleString()} 例 / {detail.positiveCount.toLocaleString()} 例 (阳性率 {detail.positiveRate.toFixed(1)}%)
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>平均报告时长</label>
              <div style={styles.td}>{detail.avgReportTime.toFixed(1)} 小时</div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>报告合格率</label>
              <div style={styles.td}>{detail.qualifiedRate.toFixed(1)}%</div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>统计周期</label>
              <div style={styles.td}>{detail.period}</div>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.primaryBtn} onClick={() => setDetail(null)}>关闭</button>
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
        message.error("加载排班失败");
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
        message.success("排班已更新");
      } else {
        message.error(res.error?.message ?? "更新排班失败");
      }
    } catch {
      message.error("更新排班失败");
    }
    setEditing(null);
  };

  const visible = deptFilter === "all" ? schedule : schedule.filter((s) => s.departmentId === deptFilter);

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>科室排班</h3>
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
        <div style={{ color: "var(--text-secondary)", padding: "24px 0", textAlign: "center" }}>加载中...</div>
      ) : (
        <div style={{ overflowX: "auto" }}><table style={styles.table}>
          <thead>
            <tr style={styles.tableHeaderRow}>
              <th style={styles.th}>日期</th>
              <th style={styles.th}>科室</th>
              <th style={styles.th}>班次</th>
              <th style={styles.th}>医生</th>
              <th style={styles.th}>状态</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} style={styles.tableRow}>
                <td style={styles.td}>{s.date}</td>
                <td style={styles.td}>{s.departmentName}</td>
                <td style={styles.td}>{s.shift}</td>
                <td style={styles.td}>{s.doctorName} ({s.doctorId})</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background: s.status === "已排班" ? "#10b981" : s.status === "待确认" ? "#f59e0b" : "#ef4444",
                    }}
                  >
                    {s.status}
                  </span>
                </td>
                <td style={styles.td}>
                  <button style={styles.approveBtn} onClick={() => openEdit(s)}>编辑</button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td style={{ ...styles.td, textAlign: "center" }} colSpan={6}>
                  暂无排班数据
                </td>
              </tr>
            )}
          </tbody>
        </table></div>
      )}
      {editing && (
        <div style={styles.modalOverlay} onClick={() => setEditing(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h4 style={styles.modalTitle}>编辑排班 — {editing.departmentName} {editing.date}</h4>
            <div style={styles.formGroup}>
              <label style={styles.label}>班次</label>
              <select
                style={styles.select}
                value={editForm.shift}
                onChange={(e) => setEditForm({ ...editForm, shift: e.target.value })}
              >
                <option>白班</option>
                <option>夜班</option>
                <option>中班</option>
                <option>值班</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>医生姓名</label>
              <input
                style={styles.input}
                value={editForm.doctorName}
                onChange={(e) => setEditForm({ ...editForm, doctorName: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>医生ID</label>
              <input
                style={styles.input}
                value={editForm.doctorId}
                onChange={(e) => setEditForm({ ...editForm, doctorId: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>状态</label>
              <select
                style={styles.select}
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option>已排班</option>
                <option>待确认</option>
                <option>停诊</option>
              </select>
            </div>
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setEditing(null)}>取消</button>
              <button style={styles.primaryBtn} onClick={handleSave}><Save size={14} />保存</button>
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
        message.error("加载集成状态失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const defs = [
    { key: "fhir", name: "FHIR 集成", desc: "HL7 FHIR R4 资源互操作" },
    { key: "ihe", name: "IHE XDS-I", desc: "跨机构文档共享注册 (XDS-I)" },
    { key: "mllp", name: "HL7 MLLP", desc: "HL7 v2 消息网关" },
  ];

  const statusColor = (st: string | undefined): string => {
    const s = (st ?? "").toUpperCase();
    if (s === "CONNECTED" || s === "ACTIVE" || s === "ONLINE") return "#10b981";
    if (s === "DEGRADED" || s === "RETRY") return "#f59e0b";
    return "#ef4444";
  };
  const statusLabel = (st: string | undefined): string => {
    const s = (st ?? "").toUpperCase();
    if (s === "CONNECTED" || s === "ACTIVE" || s === "ONLINE") return "正常";
    if (s === "DEGRADED" || s === "RETRY") return "降级";
    return st || "未知";
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>区域集成状态</h3>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
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
                background: "#0f172a",
                border: `1px solid ${statusColor(st?.status)}`,
                borderRadius: 10,
                padding: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{d.desc}</div>
                </div>
                <span
                  style={{
                    ...styles.badge,
                    background: statusColor(st?.status),
                    color: "var(--text-primary)",
                  }}
                >
                  {statusLabel(st?.status)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                上次同步: {st?.lastSync ? new Date(st.lastSync).toLocaleString("zh-CN") : "—"}
              </div>
              {st?.error && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>{st.error}</div>}
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
    { id: "applications", label: "申请列表" },
    { id: "received", label: "接收列表" },
    { id: "consultations", label: "会诊请求" },
    { id: "viewer", label: "图像查看" },
    { id: "records", label: "调阅记录" },
    { id: "crossQuery", label: "跨院查询" },
    { id: "xdsi", label: "XDS-I集成" },
    { id: "sharing", label: "影像共享" },
    { id: "schedule", label: "科室排班" },
    { id: "integration", label: "集成状态" },
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
        <h2 style={styles.pageTitle}>区域影像协同平台</h2>
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
  container: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#e2e8f0",
    padding: "24px",
  },
  header: { marginBottom: "24px" },
  pageTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#3b82f6",
    margin: "0 0 8px 0",
  },
  subtitle: { fontSize: "14px", color: "var(--text-secondary)", margin: 0 },
  tabContainer: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
    borderBottom: "1px solid #1e293b",
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
  tabActive: { background: "#3b82f6", color: "#ffffff" },
  content: { background: "#1e293b", borderRadius: "12px", padding: "24px" },
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
    color: "#f1f5f9",
    margin: 0,
  },
  primaryBtn: {
    padding: "10px 20px",
    background: "#3b82f6",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
  tableHeaderRow: { background: "#0f172a" },
  th: {
    padding: "12px 16px",
    textAlign: "left",
    fontWeight: "600",
    color: "var(--text-secondary)",
    borderBottom: "1px solid #334155",
    whiteSpace: "nowrap" as const,
  },
  tableRow: { borderBottom: "1px solid #334155" },
  td: { padding: "12px 16px", color: "#e2e8f0" },
  badge: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "16px",
    fontSize: "12px",
    fontWeight: "500",
    color: "#ffffff",
  },
  approveBtn: {
    padding: "6px 16px",
    background: "#10b981",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    cursor: "pointer",
    marginRight: "8px",
  },
  rejectBtn: {
    padding: "6px 16px",
    background: "#ef4444",
    color: "#ffffff",
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
    background: "#1e293b",
    borderRadius: "12px",
    padding: "24px",
    width: "480px",
    maxWidth: "90%",
  },
  modalTitle: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#f1f5f9",
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
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#e2e8f0",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#e2e8f0",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 14px",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#e2e8f0",
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
    border: "1px solid #334155",
    borderRadius: "8px",
    fontSize: "14px",
    cursor: "pointer",
  },
  toolbar: { display: "flex", gap: "8px" },
  toolBtn: {
    padding: "8px 16px",
    background: "#0f172a",
    color: "var(--text-secondary)",
    border: "1px solid #334155",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
  },
  toolBtnActive: {
    background: "#3b82f6",
    color: "#ffffff",
    border: "1px solid #3b82f6",
  },
  dicomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
    marginBottom: "16px",
  },
  dicomImage: {
    aspectRatio: "4/3",
    background: "#0f172a",
    borderRadius: "8px",
    border: "2px solid #334155",
    cursor: "pointer",
    overflow: "hidden",
    transition: "border-color 0.2s",
  },
  dicomImageActive: { border: "2px solid #3b82f6" },
  dicomPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
  },
  dicomImageContent: { textAlign: "center" },
  dicomLabel: {
    display: "block",
    fontSize: "14px",
    fontWeight: "600",
    color: "#3b82f6",
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
    fontSize: "13px",
    color: "var(--text-secondary)",
  },
};

export default RegionalImagingPage;
