// RED08: Consolidated mock data extracted from inline definitions in handler files

export const MOCK_ADVERSE_EVENTS = [
  { id: 'ae-001', eventType: 'contrast-reaction', severity: 'moderate', status: 'investigating', description: '患者注射碘海醇后出现皮疹', department: 'CT室', reportedBy: '张技师', reportedAt: '2026-06-10T09:00:00Z', patientId: 'P001', patientName: '张三', location: 'CT室1', contributingFactors: ['空腹时间不足'], actionsTaken: ['停止注射', '给予抗过敏药物'], rootCauseIds: [], version: 0 },
  { id: 'ae-002', eventType: 'patient-identification', severity: 'minor', status: 'resolved', description: '扫描前发现患者信息错误', department: '登记处', reportedBy: '李护士', reportedAt: '2026-06-12T10:30:00Z', patientId: 'P002', patientName: '李四', location: '登记窗口', contributingFactors: ['腕带缺失'], actionsTaken: ['核对证件', '重新打印腕带'], rootCauseIds: [], resolvedAt: '2026-06-12T11:00:00Z', resolvedBy: '王主任', version: 0 },
  { id: 'ae-003', eventType: 'fall', severity: 'minor', status: 'reported', description: '患者在检查床旁跌倒', department: 'MRI室', reportedBy: '赵技师', reportedAt: '2026-06-15T14:20:00Z', patientId: 'P003', patientName: '王五', location: 'MRI检查室', contributingFactors: ['地面湿滑'], actionsTaken: ['搀扶', '评估伤情'], rootCauseIds: [], version: 0 },
];

export const MOCK_RCA_INVESTIGATIONS = [
  { id: 'rca-001', adverseEventId: 'ae-001', eventTitle: '对比剂反应调查', description: '针对ae-001事件进行根因分析', dateOccurred: '2026-06-10T09:00:00Z', dateInvestigationStarted: '2026-06-10T11:00:00Z', status: 'open', teamMembers: ['王主任', '张技师', '李护士'], fishboneData: [], fiveWhys: [], rootCauses: [], capaPlans: [], capaStatus: 'analyzing', version: 0 },
  { id: 'rca-002', adverseEventId: 'ae-002', eventTitle: '患者身份识别错误', description: '针对ae-002事件进行根因分析', dateOccurred: '2026-06-12T10:30:00Z', dateInvestigationStarted: '2026-06-12T13:00:00Z', status: 'closed', teamMembers: ['王主任', '李护士'], fishboneData: [], fiveWhys: [], rootCauses: ['腕带打印流程不规范'], capaPlans: [], capaStatus: 'closed', conclusion: '加强腕带核对流程', lessonsLearned: '推行双人核对制度', closedAt: '2026-06-13T17:00:00Z', closedBy: '王主任', version: 0 },
];

export const MOCK_RISK_ITEMS = [
  { id: 'risk-001', riskType: 'clinical', title: '高场强MRI患者铁磁筛查', category: 'clinical', description: '未充分筛查可能导致铁磁物品进入扫描室', likelihood: 3, severity: 5, rpn: 15, riskLevel: 'very-high', status: 'mitigating', identifiedBy: '王主任', identifiedAt: '2026-05-01T08:00:00Z', mitigationPlan: '增设MRI专用筛查门', mitigationOwner: '设备科', mitigationDeadline: '2026-07-31', residualRpn: 6, version: 0 },
  { id: 'risk-002', riskType: 'operational', title: '夜班技师人手不足', category: 'operational', description: '夜班仅一名技师,急危值无法及时处理', likelihood: 4, severity: 4, rpn: 16, riskLevel: 'very-high', status: 'identified', identifiedBy: '李主任', identifiedAt: '2026-06-01T08:00:00Z', version: 0 },
  { id: 'risk-003', riskType: 'it-security', title: 'PACS外部接口安全', category: 'it-security', description: '外部系统接入PACS可能存在数据泄露风险', likelihood: 2, severity: 5, rpn: 10, riskLevel: 'high', status: 'monitoring', identifiedBy: '信息安全员', identifiedAt: '2026-04-15T08:00:00Z', mitigationPlan: '部署API网关', mitigationOwner: '信息科', mitigationDeadline: '2026-08-31', residualRpn: 4, version: 0 },
];

export const MOCK_OPENID_PREFIX = "mock_open_";

export const MOCK_PATIENT_REPORTS = [
  { id: "RPT-2026-0001", studyId: "STD-001", modality: "CT", bodyPart: "胸部", examDescription: "胸部 CT 平扫", status: "published", reportDate: "2026-07-01T10:30:00+08:00", radiologist: "张三主任医师", hasCriticalFinding: false, pdfAvailable: true },
  { id: "RPT-2026-0002", studyId: "STD-002", modality: "MR", bodyPart: "头部", examDescription: "头部 MR 平扫+DWI", status: "published", reportDate: "2026-07-02T14:20:00+08:00", radiologist: "李四副主任医师", hasCriticalFinding: true, pdfAvailable: true },
  { id: "RPT-2026-0003", studyId: "STD-003", modality: "DR", bodyPart: "胸部正侧位", examDescription: "胸部正侧位 DR", status: "preliminary", reportDate: "2026-07-03T08:15:00+08:00", radiologist: "王五主治医师", hasCriticalFinding: false, pdfAvailable: false },
];

export const MOCK_EXAM_STATUS: Record<string, any> = {
  "EXM-001": {
    examId: "EXM-001", patientId: "P100001",
    status: "in_progress", scheduledAt: "2026-07-04T09:00:00+08:00",
    startedAt: "2026-07-04T09:15:00+08:00", modality: "CT", room: "CT-1",
    queuePosition: 1, estimatedWaitMinutes: 10, hasCriticalFinding: false,
    timeline: [
      { step: "scheduled", at: "2026-07-03T10:00:00+08:00" },
      { step: "arrived", at: "2026-07-04T08:50:00+08:00" },
      { step: "in_progress", at: "2026-07-04T09:15:00+08:00", operator: "技师小赵" },
    ],
  },
};
