import React, { useState, useCallback, useRef, useEffect } from "react";
import { Save, Printer } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { t } from "../i18n/appI18n";
// [G005 Wave2A P1] 真实保存: aiPlatformApi.createStructuredReport (POST /ai-platform/structured-reports, 后端 GenerateStructuredReportSchema)
import { aiPlatformApi } from "../services/api/aiPlatformApi";
import { uniqueId } from "../utils/uniqueId";

// ============================================================================
// Types
// ============================================================================

type SpecialtyTab = "ct" | "mr" | "dxr" | "breast";

interface DiagnosisItem {
  id: string;
  conclusion: string;
  basis: string;
}

interface FindingData {
  examMethod: string;
  examPart: string;
  description: string;
  imageCount: string;
  reconstructionSequence: string;
}

interface ImpressionData {
  diagnoses: DiagnosisItem[];
  differentialDiagnosis: string;
}

interface RecommendationData {
  furtherExamSuggestion: string;
  followupSuggestion: string;
  treatmentSuggestion: string;
}

interface CTData {
  contrastAgent: string;
  scanPhase: string;
  reconstructionSequence: string;
  windowSettings: string;
}

interface MRData {
  sequenceName: string;
  scanOrientation: string;
  t1t2Signal: string;
  diffusionDWI: string;
  contrastEnhanced: string;
}

interface DXRData {
  projectionPosition: string;
  exposureParams: string;
  imageQualityRating: string;
}

interface BreastData {
  biradsClassification: string;
  bilateralComparison: string;
  calcificationDescription: string;
  massFeatures: string;
}

interface TemplateItem {
  id: string;
  name: string;
  category: string;
}

interface HistoryReport {
  id: string;
  patientName: string;
  patientId: string;
  examType: string;
  template: string;
  date: string;
  finding: FindingData;
  impression: ImpressionData;
  recommendation: RecommendationData;
}

// ============================================================================
// Mock Data - Templates
// ============================================================================

const CT_TEMPLATES: TemplateItem[] = [
  { id: "ct-brain", name: "CT头部平扫", category: "CT" },
  { id: "ct-chest", name: "CT胸部增强", category: "CT" },
  { id: "ct-abdomen", name: "CT腹部", category: "CT" },
];

const MR_TEMPLATES: TemplateItem[] = [
  { id: "mr-brain", name: "MR颅脑", category: "MR" },
  { id: "mr-spine", name: "MR脊柱", category: "MR" },
  { id: "mr-joint", name: "MR关节", category: "MR" },
];

const DXR_TEMPLATES: TemplateItem[] = [
  { id: "dxr-chest", name: "X线胸部正侧位", category: "DXR" },
  { id: "dxr-spine", name: "X线脊柱", category: "DXR" },
  { id: "dxr-limb", name: "X线四肢", category: "DXR" },
];

const BREAST_TEMPLATES: TemplateItem[] = [
  { id: "breast-mmg", name: "乳腺钼靶", category: "乳腺" },
  { id: "breast-us", name: "乳腺超声", category: "乳腺" },
  { id: "breast-mri", name: "乳腺MRI", category: "乳腺" },
];

const HISTORY_REPORTS: HistoryReport[] = [
  {
    id: "RPT001",
    patientName: "张三",
    patientId: "P20240001",
    examType: "CT",
    template: "CT头部平扫",
    date: "2024-03-15",
    finding: {
      examMethod: "CT平扫",
      examPart: "颅脑",
      description:
        "左侧额叶见类圆形低密度影，边界清晰，大小约12mm×10mm，周围无水肿。余脑实质未见异常密度影。",
      imageCount: "24",
      reconstructionSequence: "横断面1mm薄层+冠状位重建",
    },
    impression: {
      diagnoses: [
        {
          id: "1",
          conclusion: "左侧额叶良性病灶",
          basis: "低密度影，边界清晰，无水肿",
        },
      ],
      differentialDiagnosis: "需与脑梗死早期、胆脂瘤鉴别。",
    },
    recommendation: {
      furtherExamSuggestion: "建议MRI增强进一步评估",
      followupSuggestion: "6个月后复查CT",
      treatmentSuggestion: "门诊随诊观察",
    },
  },
  {
    id: "RPT002",
    patientName: "李四",
    patientId: "P20240002",
    examType: "CT",
    template: "CT胸部增强",
    date: "2024-03-12",
    finding: {
      examMethod: "CT增强扫描",
      examPart: "胸部",
      description:
        "双肺纹理清晰，右肺上叶见磨玻璃结节，直径约6mm，边界模糊。余未见异常。",
      imageCount: "128",
      reconstructionSequence: "肺窗1mm薄层+纵隔窗+三维重建",
    },
    impression: {
      diagnoses: [
        {
          id: "1",
          conclusion: "右肺上叶磨玻璃结节",
          basis: "CT显示磨玻璃密度，边界模糊",
        },
      ],
      differentialDiagnosis: "不典型腺瘤样增生或早期肺癌待排除",
    },
    recommendation: {
      furtherExamSuggestion: "建议PET-CT检查",
      followupSuggestion: "6个月后复查胸部CT",
      treatmentSuggestion: "胸外科门诊随诊",
    },
  },
  {
    id: "RPT003",
    patientName: "王五",
    patientId: "P20240003",
    examType: "MR",
    template: "MR颅脑",
    date: "2024-03-10",
    finding: {
      examMethod: "MRI平扫",
      examPart: "颅脑",
      description: "颅内未见明显异常信号，脑室系统未见扩大，中线结构居中。",
      imageCount: "42",
      reconstructionSequence: "T1WI/T2WI/FLAIR/DWI序列",
    },
    impression: {
      diagnoses: [
        {
          id: "1",
          conclusion: "颅脑MRI未见明显异常",
          basis: "各序列扫描未见异常信号",
        },
      ],
      differentialDiagnosis: "无",
    },
    recommendation: {
      furtherExamSuggestion: "无需进一步检查",
      followupSuggestion: "有症状时复查",
      treatmentSuggestion: "对症处理即可",
    },
  },
];

// ============================================================================
// Mock Template Data Generator
// ============================================================================

const generateTemplateData = (templateId: string) => {
  const templates: Record<
    string,
    {
      finding: FindingData;
      impression: ImpressionData;
      recommendation: RecommendationData;
      ctData?: CTData;
      mrData?: MRData;
      dxrData?: DXRData;
      breastData?: BreastData;
    }
  > = {
    "ct-brain": {
      finding: {
        examMethod: "CT平扫",
        examPart: "颅脑",
        description:
          "脑实质密度均匀，未见明显异常密度灶。脑室系统形态正常，脑沟脑裂未见增宽。",
        imageCount: "24",
        reconstructionSequence: "横断面1mm薄层重建",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "颅脑CT平扫未见明显异常",
            basis: "脑实质密度均匀，各脑室形态正常",
          },
        ],
        differentialDiagnosis: "无",
      },
      recommendation: {
        furtherExamSuggestion: "无需进一步检查",
        followupSuggestion: "有症状时复查",
        treatmentSuggestion: "对症处理",
      },
      ctData: {
        contrastAgent: "无（平扫）",
        scanPhase: "静脉期",
        reconstructionSequence: "软组织窗+骨窗",
        windowSettings: "窗宽80/窗位40",
      },
    },
    "ct-chest": {
      finding: {
        examMethod: "CT增强扫描",
        examPart: "胸部",
        description:
          "双肺透过度正常，纹理清晰，未见明显结节或浸润灶。纵隔内未见肿大淋巴结。",
        imageCount: "128",
        reconstructionSequence: "肺窗+纵隔窗+冠状位重建",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "胸部CT增强未见明显异常",
            basis: "双肺野清晰，纵隔淋巴结未见肿大",
          },
        ],
        differentialDiagnosis: "无",
      },
      recommendation: {
        furtherExamSuggestion: "无需进一步检查",
        followupSuggestion: "年度体检",
        treatmentSuggestion: "无需治疗",
      },
      ctData: {
        contrastAgent: "碘佛醇100ml",
        scanPhase: "动脉期+静脉期",
        reconstructionSequence: "MIP+VR重建",
        windowSettings: "肺窗窗宽1500/窗位-600",
      },
    },
    "ct-abdomen": {
      finding: {
        examMethod: "CT三期增强",
        examPart: "上腹部",
        description:
          "肝脏密度均匀，未见异常密度影。胆囊形态正常，壁不厚。脾脏、胰腺未见异常。",
        imageCount: "256",
        reconstructionSequence: "轴位+冠状位+矢状位重建",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "上腹部CT未见明显异常",
            basis: "肝脏等实质脏器密度均匀",
          },
        ],
        differentialDiagnosis: "无",
      },
      recommendation: {
        furtherExamSuggestion: "无需进一步检查",
        followupSuggestion: "年度体检",
        treatmentSuggestion: "无需治疗",
      },
      ctData: {
        contrastAgent: "碘佛醇120ml",
        scanPhase: "动脉期+门脉期+延迟期",
        reconstructionSequence: "多平面重建MPR",
        windowSettings: "腹部窗宽400/窗位50",
      },
    },
    "mr-brain": {
      finding: {
        examMethod: "MRI平扫+增强",
        examPart: "颅脑",
        description:
          "颅内未见异常信号，脑室系统未见扩大，中线结构居中。脑沟脑裂未见异常。",
        imageCount: "42",
        reconstructionSequence: "T1WI+T2WI+FLAIR+DWI+增强",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "颅脑MRI未见明显异常",
            basis: "各序列扫描未见异常信号",
          },
        ],
        differentialDiagnosis: "无",
      },
      recommendation: {
        furtherExamSuggestion: "无需进一步检查",
        followupSuggestion: "有症状时复查",
        treatmentSuggestion: "对症处理",
      },
      mrData: {
        sequenceName: "SE/TSE序列",
        scanOrientation: "横轴位+矢状位+冠状位",
        t1t2Signal: "T1WI等信号/T2WI高信号",
        diffusionDWI: "DWI未见受限区",
        contrastEnhanced: "Gd-DTPA增强后未见强化",
      },
    },
    "mr-spine": {
      finding: {
        examMethod: "MRI平扫",
        examPart: "颈椎",
        description:
          "颈椎生理曲度存在。C3-C7椎间盘信号正常，未见突出。脊髓未见异常信号。",
        imageCount: "36",
        reconstructionSequence: "T1WI+T2WI矢状位+横断面",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "颈椎MRI未见明显异常",
            basis: "椎间盘形态正常，脊髓信号均匀",
          },
        ],
        differentialDiagnosis: "无",
      },
      recommendation: {
        furtherExamSuggestion: "无需进一步检查",
        followupSuggestion: "注意颈部保健",
        treatmentSuggestion: "对症治疗",
      },
      mrData: {
        sequenceName: "快速自旋回波序列",
        scanOrientation: "矢状位+横轴位",
        t1t2Signal: "T1WI中等信号/T2WI高信号",
        diffusionDWI: "DWI未见受限区",
        contrastEnhanced: "平扫无需增强",
      },
    },
    "mr-joint": {
      finding: {
        examMethod: "MRI平扫",
        examPart: "左膝关节",
        description:
          "左膝关节半月板未见撕裂信号，十字韧带走行正常，关节腔未见积液。",
        imageCount: "28",
        reconstructionSequence: "PD+FS序列矢状位+冠状位",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "左膝关节MRI未见明显异常",
            basis: "关节结构完整，软骨信号均匀",
          },
        ],
        differentialDiagnosis: "无",
      },
      recommendation: {
        furtherExamSuggestion: "无需进一步检查",
        followupSuggestion: "有症状时复查",
        treatmentSuggestion: "注意保护关节",
      },
      mrData: {
        sequenceName: "质子密度加权",
        scanOrientation: "矢状位+冠状位+横轴位",
        t1t2Signal: "T1WI等信号/T2WI高信号",
        diffusionDWI: "DWI未见受限区",
        contrastEnhanced: "平扫无需增强",
      },
    },
    "dxr-chest": {
      finding: {
        examMethod: "X线数字化摄影",
        examPart: "胸部正侧位",
        description:
          "双肺纹理清晰，肺野透过度正常。心影形态正常。两侧肋骨完整。",
        imageCount: "2",
        reconstructionSequence: "无",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "胸部X线未见明显异常",
            basis: "肺野清晰，心影正常",
          },
        ],
        differentialDiagnosis: "无",
      },
      recommendation: {
        furtherExamSuggestion: "无需进一步检查",
        followupSuggestion: "年度体检",
        treatmentSuggestion: "无需治疗",
      },
      dxrData: {
        projectionPosition: "正位+侧位",
        exposureParams: "120kV/200mAs/0.02s",
        imageQualityRating: "优",
      },
    },
    "dxr-spine": {
      finding: {
        examMethod: "X线数字化摄影",
        examPart: "腰椎正侧位",
        description:
          "腰椎生理曲度存在，椎体形态正常，椎间隙正常。附件未见异常。",
        imageCount: "2",
        reconstructionSequence: "无",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "腰椎X线未见明显异常",
            basis: "椎体形态正常，椎间隙正常",
          },
        ],
        differentialDiagnosis: "无",
      },
      recommendation: {
        furtherExamSuggestion: "无需进一步检查",
        followupSuggestion: "注意腰部保健",
        treatmentSuggestion: "对症治疗",
      },
      dxrData: {
        projectionPosition: "正位+侧位",
        exposureParams: "75kV/400mAs/0.1s",
        imageQualityRating: "优",
      },
    },
    "dxr-limb": {
      finding: {
        examMethod: "X线数字化摄影",
        examPart: "右胫腓骨正侧位",
        description:
          "右胫腓骨形态正常，骨皮质连续完整，未见骨折线影。软组织未见异常。",
        imageCount: "2",
        reconstructionSequence: "无",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "右胫腓骨X线未见明显异常",
            basis: "骨皮质连续，无骨折征象",
          },
        ],
        differentialDiagnosis: "无",
      },
      recommendation: {
        furtherExamSuggestion: "无需进一步检查",
        followupSuggestion: "有症状时复查",
        treatmentSuggestion: "观察随访",
      },
      dxrData: {
        projectionPosition: "正位+侧位",
        exposureParams: "60kV/160mAs/0.05s",
        imageQualityRating: "优",
      },
    },
    "breast-mmg": {
      finding: {
        examMethod: "数字化乳腺钼靶",
        examPart: "双侧乳腺",
        description:
          "双侧乳腺腺体呈致密型，腺体结构未见明显异常。两乳晕区皮肤未见增厚。",
        imageCount: "4",
        reconstructionSequence: "CC位+MLO位",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "双侧乳腺BI-RADS 1类",
            basis: "腺体致密型，未见明确肿块及钙化",
          },
        ],
        differentialDiagnosis: "无",
      },
      recommendation: {
        furtherExamSuggestion: "建议定期复查",
        followupSuggestion: "12个月后复查",
        treatmentSuggestion: "继续观察",
      },
      breastData: {
        biradsClassification: "BI-RADS 1类",
        bilateralComparison: "两侧对称",
        calcificationDescription: "未见恶性钙化",
        massFeatures: "未见明确肿块",
      },
    },
    "breast-us": {
      finding: {
        examMethod: "乳腺超声",
        examPart: "双侧乳腺",
        description:
          "双侧乳腺腺体层增厚，结构紊乱，可见多个低回声结节，边界清晰。",
        imageCount: "8",
        reconstructionSequence: "横切面+纵切面+ CDFI",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "双侧乳腺BI-RADS 3类",
            basis: "多发低回声结节，边界清晰",
          },
        ],
        differentialDiagnosis: "纤维腺瘤待排",
      },
      recommendation: {
        furtherExamSuggestion: "建议MRI增强检查",
        followupSuggestion: "6个月后复查超声",
        treatmentSuggestion: "定期随访",
      },
      breastData: {
        biradsClassification: "BI-RADS 3类",
        bilateralComparison: "两侧均有",
        calcificationDescription: "未见钙化",
        massFeatures: "低回声结节，最大约8mm×6mm",
      },
    },
    "breast-mri": {
      finding: {
        examMethod: "乳腺MRI动态增强",
        examPart: "双侧乳腺",
        description:
          "左乳外上象限见一枚结节，大小约12mm×10mm，边缘不规则，增强后明显强化。",
        imageCount: "156",
        reconstructionSequence: "T1WI+T2WI+DWI+动态增强",
      },
      impression: {
        diagnoses: [
          {
            id: "1",
            conclusion: "左乳占位性病变，BI-RADS 4类",
            basis: "结节边缘不规则，明显强化",
          },
        ],
        differentialDiagnosis: "乳腺癌不能排除",
      },
      recommendation: {
        furtherExamSuggestion: "建议穿刺活检",
        followupSuggestion: "尽快病理学检查",
        treatmentSuggestion: "外科会诊",
      },
      breastData: {
        biradsClassification: "BI-RADS 4类",
        bilateralComparison: "左侧为著",
        calcificationDescription: "DWI受限",
        massFeatures: "不规则结节，明显强化",
      },
    },
  };
  return templates[templateId] ?? templates["ct-brain"]!;
};

// ============================================================================
// Component
// ============================================================================

const AIStructuredReportPage: React.FC = () => {
  const [activeSpecialtyTab, setActiveSpecialtyTab] =
    useState<SpecialtyTab>("ct");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const recordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      if (recordTimeoutRef.current) clearTimeout(recordTimeoutRef.current);
      toastTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [previewJson, setPreviewJson] = useState<string>("");

  const [formData, setFormData] = useState({
    patientName: "",
    patientId: "",
    age: "",
    gender: "男",
    examDate: new Date().toISOString().split("T")[0],
    finding: {
      examMethod: "",
      examPart: "",
      description: "",
      imageCount: "",
      reconstructionSequence: "",
    } as FindingData,
    impression: {
      diagnoses: [{ id: "1", conclusion: "", basis: "" }],
      differentialDiagnosis: "",
    } as ImpressionData,
    recommendation: {
      furtherExamSuggestion: "",
      followupSuggestion: "",
      treatmentSuggestion: "",
    } as RecommendationData,
    ctData: {
      contrastAgent: "",
      scanPhase: "",
      reconstructionSequence: "",
      windowSettings: "",
    } as CTData,
    mrData: {
      sequenceName: "",
      scanOrientation: "",
      t1t2Signal: "",
      diffusionDWI: "",
      contrastEnhanced: "",
    } as MRData,
    dxrData: {
      projectionPosition: "",
      exposureParams: "",
      imageQualityRating: "",
    } as DXRData,
    breastData: {
      biradsClassification: "",
      bilateralComparison: "",
      calcificationDescription: "",
      massFeatures: "",
    } as BreastData,
  });

  const templates =
    activeSpecialtyTab === "ct"
      ? CT_TEMPLATES
      : activeSpecialtyTab === "mr"
        ? MR_TEMPLATES
        : activeSpecialtyTab === "dxr"
          ? DXR_TEMPLATES
          : BREAST_TEMPLATES;

  const handleTemplateSelect = useCallback((template: TemplateItem) => {
    setSelectedTemplate(template.id);
    const data = generateTemplateData(template.id);
    setFormData((prev) => ({
      ...prev,
      finding: data.finding,
      impression: data.impression,
      recommendation: data.recommendation,
      ctData: data.ctData || prev.ctData,
      mrData: data.mrData || prev.mrData,
      dxrData: data.dxrData || prev.dxrData,
      breastData: data.breastData || prev.breastData,
    }));
  }, []);

  const handleVoiceRecord = useCallback(() => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      if (recordTimeoutRef.current) clearTimeout(recordTimeoutRef.current);
      recordTimeoutRef.current = setTimeout(() => setIsRecording(false), 3000);
    }
  }, [isRecording]);

  const handleInputChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      const { name, value } = e.target;
      const keys = name.split(".");
      if (keys.length === 2) {
        setFormData((prev) => ({
          ...prev,
          [keys[0]!]: { ...(prev as any)[keys[0]!], [keys[1]!]: value },
        }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
    },
    [],
  );

  const handleDiagnosisChange = useCallback(
    (index: number, field: string, value: string) => {
      setFormData((prev) => {
        const newDiagnoses = [...prev.impression.diagnoses];
        newDiagnoses[index] = { ...newDiagnoses[index]!, [field]: value } as DiagnosisItem;
        return {
          ...prev,
          impression: { ...prev.impression, diagnoses: newDiagnoses },
        };
      });
    },
    [],
  );

  const handleAddDiagnosis = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      impression: {
        ...prev.impression,
        diagnoses: [
          ...prev.impression.diagnoses,
          { id: uniqueId('dx'), conclusion: "", basis: "" },
        ],
      },
    }));
  }, []);

  const handleRemoveDiagnosis = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      impression: {
        ...prev.impression,
        diagnoses: prev.impression.diagnoses.filter((_, i) => i !== index),
      },
    }));
  }, []);useCallback((report: HistoryReport) => {
    setFormData((prev) => ({
      ...prev,
      patientName: report.patientName,
      patientId: report.patientId,
      finding: report.finding,
      impression: report.impression,
      recommendation: report.recommendation,
    }));
    setExpandedHistory(null);
  }, []);

  const generateJsonReport = useCallback(() => {
    const report = {
      reportInfo: {
        reportId: uniqueId('RPT'),
        reportDate: new Date().toISOString(),
        examDate: formData.examDate,
      },
      patientInfo: {
        patientName: formData.patientName,
        patientId: formData.patientId,
        age: formData.age,
        gender: formData.gender,
      },
      finding: formData.finding,
      impression: formData.impression,
      recommendation: formData.recommendation,
      specialtyData:
        activeSpecialtyTab === "ct"
          ? { ct: formData.ctData }
          : activeSpecialtyTab === "mr"
            ? { mr: formData.mrData }
            : activeSpecialtyTab === "dxr"
              ? { dxr: formData.dxrData }
              : { breast: formData.breastData },
    };
    return JSON.stringify(report, null, 2);
  }, [formData, activeSpecialtyTab]);

  const handlePreview = useCallback(() => {
    setPreviewJson(generateJsonReport());
    setShowPreview(true);
  }, [generateJsonReport]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingReport, setSavingReport] = useState<boolean>(false);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.patientName.trim()) errs.patientName = t("aiStructured.placeholderPatientName");
    if (!formData.patientId.trim()) errs.patientId = t("aiStructured.placeholderPatientId");
    if (!formData.age.trim()) errs.age = t("aiStructured.placeholderAge");
    if (!formData.finding.examMethod.trim())
      errs["finding.examMethod"] = t("aiStructured.errExamMethod");
    if (!formData.finding.examPart.trim())
      errs["finding.examPart"] = t("aiStructured.errExamPart");
    if (!formData.finding.description.trim())
      errs["finding.description"] = t("aiStructured.errDescription");
    if (!formData.impression.diagnoses[0]?.conclusion.trim())
      errs["impression.conclusion"] = t("aiStructured.errConclusion");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // [G005 Wave2A P1] 保存报告真实化: aiPlatformApi.createStructuredReport → 成功后 toast + 状态刷新; 失败回退本地演示
  const handleSubmit = useCallback(async () => {
    const showToast = (text: string, bg: string) => {
      const toast = document.createElement("div");
      toast.textContent = text;
      toast.style.cssText = `position:fixed;top:24px;left:50%;transform:translateX(-50%);background:${bg};color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15)`;
      document.body.appendChild(toast);
      const t1 = setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s";
        const t2 = setTimeout(() => {
          if (document.body.contains(toast)) document.body.removeChild(toast);
        }, 300);
        toastTimeoutsRef.current.push(t2);
      }, 2000);
      toastTimeoutsRef.current.push(t1);
    };
    if (!validate()) {
      showToast(t("aiStructured.requiredFields"), "#dc2626");
      return;
    }
    if (savingReport) return;
    setSavingReport(true);
    try {
      const res = await aiPlatformApi.createStructuredReport({
        studyId: formData.patientId || "STU-DEMO",
        templateId: selectedTemplate || (activeSpecialtyTab === "ct" ? "ct-brain" : activeSpecialtyTab),
        findings: [formData.finding.description].filter(Boolean),
        additionalContext: {
          patientName: formData.patientName,
          examMethod: formData.finding.examMethod,
          impression: formData.impression.diagnoses.map((d) => d.conclusion),
          specialtyTab: activeSpecialtyTab,
          reportId: uniqueId('RPT'),
        },
      });
      if (res.success && res.data) {
        showToast(t("aiStructured.reportSaved", { id: (res.data as { id?: string })?.id ?? "" }), "#059669");
        setPreviewJson(generateJsonReport());
      } else {
        throw new Error(res.error?.message ?? t("aiStructured.apiError"));
      }
    } catch (e) {
      console.error("[AIStructuredReport] 保存失败, 回退本地演示:", e);
      showToast(t("aiStructured.saveFallback"), "#b45309");
      setPreviewJson(generateJsonReport());
    } finally {
      setSavingReport(false);
    }
  }, [formData, activeSpecialtyTab, selectedTemplate, savingReport, generateJsonReport]);

  // ============================================================================
  // Styles
  // ============================================================================

  const styles = {
    container: {
      display: "flex",
      flexDirection: "column" as const,
      minHeight: "100vh",
      backgroundColor: "var(--bg-card)",
      color: "var(--text-primary)",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px 24px",
      backgroundColor: "#1e40af",
      color: "white",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    },
    title: {
      fontSize: "20px",
      fontWeight: 600,
      margin: 0,
    },
    voiceButton: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "10px 20px",
      backgroundColor: isRecording ? "#dc2626" : "rgba(255,255,255,0.2)",
      color: "white",
      border: "none",
      borderRadius: "8px",
      fontSize: "14px",
      cursor: "pointer",
      transition: "all 0.2s",
    },
    mainContent: {
      display: "flex",
      flex: 1,
      overflow: "hidden",
    },
    leftPanel: {
      width: "300px",
      backgroundColor: "var(--bg-card)",
      borderRight: "1px solid var(--border-color)",
      display: "flex",
      flexDirection: "column" as const,
      overflow: "hidden",
    },
    panelHeader: {
      padding: "16px",
      borderBottom: "1px solid var(--border-color)",
    },
    specialtyTabs: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "8px",
    },
    specialtyTab: {
      padding: "10px 12px",
      backgroundColor: "transparent",
      color: "var(--text-secondary)",
      border: "1px solid var(--border-color)",
      borderRadius: "6px",
      fontSize: "13px",
      cursor: "pointer",
      transition: "all 0.2s",
      fontWeight: 500,
    },
    specialtyTabActive: {
      backgroundColor: "#1e40af",
      color: "white",
      borderColor: "#1e40af",
    },
    templateList: {
      flex: 1,
      overflowY: "auto" as const,
      padding: "12px",
    },
    templateItem: {
      padding: "12px 16px",
      marginBottom: "8px",
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border-color)",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "all 0.2s",
      fontSize: "14px",
    },
    templateName: {
      fontWeight: 500,
    },
    rightPanel: {
      flex: 1,
      display: "flex",
      flexDirection: "column" as const,
      overflow: "hidden",
    },
    formSection: {
      flex: 1,
      overflowY: "auto" as const,
      padding: "24px",
    },
    section: {
      marginBottom: "24px",
      backgroundColor: "var(--bg-card)",
      borderRadius: "12px",
      padding: "20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    },
    sectionTitle: {
      fontSize: "16px",
      fontWeight: 600,
      color: "#1e40af",
      marginBottom: "16px",
      paddingBottom: "8px",
      borderBottom: "2px solid #1e40af",
    },
    sectionSubtitle: {
      fontSize: "14px",
      fontWeight: 600,
      color: "var(--text-primary)",
      marginBottom: "12px",
      marginTop: "16px",
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "12px",
    },
    formGrid2: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "12px",
    },
    formGroup: {
      display: "flex",
      flexDirection: "column" as const,
    },
    label: {
      fontSize: "12px",
      color: "var(--text-secondary)",
      marginBottom: "4px",
      fontWeight: 500,
    },
    input: {
      padding: "10px 12px",
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border-color)",
      borderRadius: "6px",
      color: "var(--text-primary)",
      fontSize: "14px",
      outline: "none",
      transition: "border-color 0.2s",
    },
    select: {
      padding: "10px 12px",
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border-color)",
      borderRadius: "6px",
      color: "var(--text-primary)",
      fontSize: "14px",
      outline: "none",
    },
    textarea: {
      padding: "12px",
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border-color)",
      borderRadius: "6px",
      color: "var(--text-primary)",
      fontSize: "14px",
      outline: "none",
      resize: "vertical" as const,
      minHeight: "80px",
      fontFamily: "inherit",
    },
    diagnosisCard: {
      padding: "12px",
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border-color)",
      borderRadius: "8px",
      marginBottom: "12px",
    },
    diagnosisHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "8px",
    },
    diagnosisNumber: {
      fontSize: "12px",
      fontWeight: 600,
      color: "#1e40af",
    },
    removeButton: {
      padding: "4px 8px",
      backgroundColor: "var(--color-error-bg)",
      color: "#dc2626",
      border: "none",
      borderRadius: "4px",
      fontSize: "12px",
      cursor: "pointer",
    },
    addButton: {
      padding: "10px 16px",
      backgroundColor: "var(--color-info-bg)",
      color: "#1e40af",
      border: "1px dashed #1e40af",
      borderRadius: "6px",
      fontSize: "13px",
      cursor: "pointer",
      width: "100%",
      textAlign: "center" as const,
    },
    bottomBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px 24px",
      backgroundColor: "var(--bg-card)",
      borderTop: "1px solid var(--border-color)",
      boxShadow: "0 -2px 4px rgba(0,0,0,0.05)",
    },
    buttonGroup: {
      display: "flex",
      gap: "12px",
    },
    button: {
      padding: "10px 24px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.2s",
      border: "none",
    },
    buttonPrimary: {
      backgroundColor: "#1e40af",
      color: "white",
    },
    buttonSecondary: {
      backgroundColor: "var(--bg-card)",
      color: "var(--text-primary)",
    },
    buttonOutline: {
      backgroundColor: "transparent",
      color: "#1e40af",
      border: "1px solid #1e40af",
    },
    previewOverlay: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    },
    previewModal: {
      width: "900px",
      maxHeight: "90vh",
      backgroundColor: "var(--bg-card)",
      borderRadius: "12px",
      overflow: "hidden",
    },
    previewHeader: {
      padding: "16px 24px",
      backgroundColor: "#1e40af",
      color: "white",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    previewContent: {
      padding: "24px",
      maxHeight: "70vh",
      overflowY: "auto" as const,
    },
    jsonPreview: {
      backgroundColor: "#1e293b",
      color: "#e2e8f0",
      padding: "16px",
      borderRadius: "8px",
      fontSize: "13px",
      fontFamily: '"Monaco", "Menlo", monospace',
      overflow: "auto",
      maxHeight: "500px",
      whiteSpace: "pre-wrap" as const,
    },
    closeButton: {
      background: "none",
      border: "none",
      color: "white",
      cursor: "pointer",
      fontSize: "24px",
      lineHeight: 1,
    },
    specialtySection: {
      marginTop: "16px",
      padding: "16px",
      backgroundColor: "var(--color-info-bg)",
      borderRadius: "8px",
      border: "1px solid #bfdbfe",
    },
    jsonPreviewButton: {
      marginTop: "12px",
      padding: "12px 16px",
      backgroundColor: "#1e40af",
      color: "white",
      border: "none",
      borderRadius: "6px",
      fontSize: "13px",
      cursor: "pointer",
      width: "100%",
    },
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>
          {t("aiStructured.title")}
          <span style={{ marginLeft: 10, fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fff3cd', color: '#b45309', fontWeight: 600, verticalAlign: 'middle' }}>{t("aiStructured.demoBadge")}</span>
        </h1>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span style={{ fontSize: "13px", opacity: 0.9 }}>
            {t("aiStructured.currentUser")}
          </span>
          <button style={styles.voiceButton} onClick={handleVoiceRecord}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              {isRecording ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              )}
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            {isRecording ? t("aiStructured.stopRecording") : t("aiStructured.voiceInput")}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Left Panel - Template Selection */}
        <aside style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <div style={styles.specialtyTabs}>
              {(["ct", "mr", "dxr", "breast"] as SpecialtyTab[]).map((tab) => (
                <button
                  key={tab}
                  style={{
                    ...styles.specialtyTab,
                    ...(activeSpecialtyTab === tab
                      ? styles.specialtyTabActive
                      : {}),
                  }}
                  onClick={() => setActiveSpecialtyTab(tab)}
                >
                  {tab === "ct"
                    ? t("aiStructured.specCt")
                    : tab === "mr"
                      ? t("aiStructured.specMr")
                      : tab === "dxr"
                        ? t("aiStructured.specDxr")
                        : t("aiStructured.specBreast")}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.templateList}>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: "8px",
              }}
            >
              {t("aiStructured.selectTemplate", { count: templates.length })}
            </div>
            {templates.map((template) => (
              <div
                key={template.id}
                style={{
                  ...styles.templateItem,
                  borderColor:
                    selectedTemplate === template.id ? "#1e40af" : "#e2e8f0",
                  backgroundColor:
                    selectedTemplate === template.id ? "#eff6ff" : "#f8fafc",
                }}
                onClick={() => handleTemplateSelect(template)}
              >
                <span
                  style={{
                    ...styles.templateName,
                    color:
                      selectedTemplate === template.id ? "#1e40af" : "#334155",
                  }}
                >
                  {template.name}
                </span>
              </div>
            ))}
          </div>
        </aside>

        {/* Right Panel - Report Form */}
        <main style={styles.rightPanel}>
          <div style={styles.formSection}>
            {/* Patient Info */}
            <section style={styles.section}>
              <PageHeader variant="inline" title={t("aiStructured.patientInfo")} style={{ marginBottom: 16, paddingBottom: 8, borderBottom: "2px solid #1e40af" }} />
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span style={{ color: "#dc2626" }}>*</span> {t("aiStructured.patientName")}
                  </label>
                  <input
                    type="text"
                    name="patientName"
                    value={formData.patientName}
                    onChange={handleInputChange}
                    style={{
                      ...styles.input,
                      borderColor: errors.patientName ? "#dc2626" : undefined,
                    }}
                    placeholder={t("aiStructured.placeholderPatientName")}
                    maxLength={50}
                    required
                  />
                  {errors.patientName && (
                    <span
                      style={{ color: "#dc2626", fontSize: 12, marginTop: 2 }}
                    >
                      {errors.patientName}
                    </span>
                  )}
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span style={{ color: "#dc2626" }}>*</span> {t("aiStructured.patientId")}
                  </label>
                  <input
                    type="text"
                    name="patientId"
                    value={formData.patientId}
                    onChange={handleInputChange}
                    style={{
                      ...styles.input,
                      borderColor: errors.patientId ? "#dc2626" : undefined,
                    }}
                    placeholder={t("aiStructured.placeholderPatientId")}
                    maxLength={20}
                    required
                  />
                  {errors.patientId && (
                    <span
                      style={{ color: "#dc2626", fontSize: 12, marginTop: 2 }}
                    >
                      {errors.patientId}
                    </span>
                  )}
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span style={{ color: "#dc2626" }}>*</span> {t("aiStructured.age")}
                  </label>
                  <input
                    type="text"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    style={{
                      ...styles.input,
                      borderColor: errors.age ? "#dc2626" : undefined,
                    }}
                    placeholder={t("aiStructured.placeholderAge")}
                    maxLength={3}
                    required
                  />
                  {errors.age && (
                    <span
                      style={{ color: "#dc2626", fontSize: 12, marginTop: 2 }}
                    >
                      {errors.age}
                    </span>
                  )}
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t("aiStructured.gender")}</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    style={styles.select}
                  >
                    <option value="男">{t("aiStructured.male")}</option>
                    <option value="女">{t("aiStructured.female")}</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t("aiStructured.examDate")}</label>
                  <input
                    type="date"
                    name="examDate"
                    value={formData.examDate}
                    onChange={handleInputChange}
                    style={styles.input}
                  />
                </div>
              </div>
            </section>

            {/* WS/T 500-2016 三段式报告 */}
            {/* Finding Section */}
            <section style={styles.section}>
              <PageHeader variant="inline" title={t("aiStructured.findingSection")} style={{ marginBottom: 16, paddingBottom: 8, borderBottom: "2px solid #1e40af" }} />
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span style={{ color: "#dc2626" }}>*</span> {t("aiStructured.examMethod")}
                  </label>
                  <input
                    type="text"
                    name="finding.examMethod"
                    value={formData.finding.examMethod}
                    onChange={handleInputChange}
                    style={{
                      ...styles.input,
                      borderColor: errors["finding.examMethod"]
                        ? "#dc2626"
                        : undefined,
                    }}
                    placeholder={t("aiStructured.placeholderExamMethod")}
                    maxLength={100}
                    required
                  />
                  {errors["finding.examMethod"] && (
                    <span
                      style={{ color: "#dc2626", fontSize: 12, marginTop: 2 }}
                    >
                      {errors["finding.examMethod"]}
                    </span>
                  )}
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    <span style={{ color: "#dc2626" }}>*</span> {t("aiStructured.examPart")}
                  </label>
                  <input
                    type="text"
                    name="finding.examPart"
                    value={formData.finding.examPart}
                    onChange={handleInputChange}
                    style={{
                      ...styles.input,
                      borderColor: errors["finding.examPart"]
                        ? ("#dc2626" as string)
                        : undefined,
                    }}
                    placeholder={t("aiStructured.placeholderExamPart")}
                    maxLength={100}
                    required
                  />
                  {errors["finding.examPart"] && (
                    <span
                      style={{ color: "#dc2626", fontSize: 12, marginTop: 2 }}
                    >
                      {errors["finding.examPart"]}
                    </span>
                  )}
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t("aiStructured.imageCount")}</label>
                  <input
                    type="text"
                    name="finding.imageCount"
                    value={formData.finding.imageCount}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder={t("aiStructured.placeholderImageCount")}
                  />
                </div>
              </div>
              <div style={{ marginTop: "12px" }}>
                <label style={styles.label}>
                  <span style={{ color: "#dc2626" }}>*</span> {t("aiStructured.mainFindings")}
                </label>
                <textarea
                  name="finding.description"
                  value={formData.finding.description}
                  onChange={handleInputChange}
                  style={{
                    ...styles.textarea,
                    minHeight: "100px",
                    borderColor: errors["finding.description"]
                      ? "#dc2626"
                      : undefined,
                  }}
                  placeholder={t("aiStructured.placeholderMainFindings")}
                  maxLength={2000}
                  required
                />
                {errors["finding.description"] && (
                  <span style={{ color: "#dc2626", fontSize: 12 }}>
                    {errors["finding.description"]}
                  </span>
                )}
              </div>
              <div style={{ marginTop: "12px" }}>
                <label style={styles.label}>{t("aiStructured.reconstructionSequence")}</label>
                <input
                  type="text"
                  name="finding.reconstructionSequence"
                  value={formData.finding.reconstructionSequence}
                  onChange={handleInputChange}
                  style={styles.input}
                  placeholder={t("aiStructured.placeholderReconstruction")}
                />
              </div>
            </section>

            {/* Specialty Data */}
            <section style={styles.section}>
              <PageHeader
                variant="inline"
                title={activeSpecialtyTab === "ct" ? t("aiStructured.specCtFields") : activeSpecialtyTab === "mr" ? t("aiStructured.specMrFields") : activeSpecialtyTab === "dxr" ? t("aiStructured.specDxrFields") : t("aiStructured.specBreastFields")}
                style={{ marginBottom: 16, paddingBottom: 8, borderBottom: "2px solid #1e40af" }}
              />

              {activeSpecialtyTab === "ct" && (
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t("aiStructured.contrastAgent")}</label>
                    <input
                      type="text"
                      name="ctData.contrastAgent"
                      value={formData.ctData.contrastAgent}
                      onChange={handleInputChange}
                      style={styles.input}
                      placeholder={t("aiStructured.placeholderContrastAgent")}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t("aiStructured.scanPhase")}</label>
                    <input
                      type="text"
                      name="ctData.scanPhase"
                      value={formData.ctData.scanPhase}
                      onChange={handleInputChange}
                      style={styles.input}
                      placeholder={t("aiStructured.placeholderScanPhase")}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t("aiStructured.reconstructionSequence")}</label>
                    <input
                      type="text"
                      name="ctData.reconstructionSequence"
                      value={formData.ctData.reconstructionSequence}
                      onChange={handleInputChange}
                      style={styles.input}
                      placeholder={t("aiStructured.placeholderMipVr")}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t("aiStructured.windowSettings")}</label>
                    <input
                      type="text"
                      name="ctData.windowSettings"
                      value={formData.ctData.windowSettings}
                      onChange={handleInputChange}
                      style={styles.input}
                      placeholder={t("aiStructured.placeholderWindow")}
                    />
                  </div>
                </div>
              )}

              {activeSpecialtyTab === "mr" && (
                <div>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t("aiStructured.sequenceName")}</label>
                      <input
                        type="text"
                        name="mrData.sequenceName"
                        value={formData.mrData.sequenceName}
                        onChange={handleInputChange}
                        style={styles.input}
                        placeholder={t("aiStructured.placeholderSequenceName")}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t("aiStructured.scanOrientation")}</label>
                      <input
                        type="text"
                        name="mrData.scanOrientation"
                        value={formData.mrData.scanOrientation}
                        onChange={handleInputChange}
                        style={styles.input}
                        placeholder={t("aiStructured.placeholderOrientation")}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t("aiStructured.t1t2Signal")}</label>
                      <input
                        type="text"
                        name="mrData.t1t2Signal"
                        value={formData.mrData.t1t2Signal}
                        onChange={handleInputChange}
                        style={styles.input}
                        placeholder={t("aiStructured.placeholderT1t2")}
                      />
                    </div>
                  </div>
                  <div style={{ ...styles.formGrid, marginTop: "12px" }}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t("aiStructured.diffusionDwi")}</label>
                      <input
                        type="text"
                        name="mrData.diffusionDWI"
                        value={formData.mrData.diffusionDWI}
                        onChange={handleInputChange}
                        style={styles.input}
                        placeholder={t("aiStructured.placeholderDwi")}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t("aiStructured.contrastEnhanced")}</label>
                      <input
                        type="text"
                        name="mrData.contrastEnhanced"
                        value={formData.mrData.contrastEnhanced}
                        onChange={handleInputChange}
                        style={styles.input}
                        placeholder={t("aiStructured.placeholderContrastEnhanced")}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSpecialtyTab === "dxr" && (
                <div style={styles.formGrid}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t("aiStructured.projectionPosition")}</label>
                    <input
                      type="text"
                      name="dxrData.projectionPosition"
                      value={formData.dxrData.projectionPosition}
                      onChange={handleInputChange}
                      style={styles.input}
                      placeholder={t("aiStructured.placeholderProjection")}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t("aiStructured.exposureParams")}</label>
                    <input
                      type="text"
                      name="dxrData.exposureParams"
                      value={formData.dxrData.exposureParams}
                      onChange={handleInputChange}
                      style={styles.input}
                      placeholder={t("aiStructured.placeholderExposure")}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>{t("aiStructured.imageQuality")}</label>
                    <select
                      name="dxrData.imageQualityRating"
                      value={formData.dxrData.imageQualityRating}
                      onChange={handleInputChange}
                      style={styles.select}
                    >
                      <option value="">{t("aiStructured.selectOption")}</option>
                      <option value="优">{t("aiStructured.qualityExcellent")}</option>
                      <option value="良">{t("aiStructured.qualityGood")}</option>
                      <option value="差">{t("aiStructured.qualityPoor")}</option>
                    </select>
                  </div>
                </div>
              )}

              {activeSpecialtyTab === "breast" && (
                <div>
                  <div style={styles.formGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t("aiStructured.biradsClassification")}</label>
                      <select
                        name="breastData.biradsClassification"
                        value={formData.breastData.biradsClassification}
                        onChange={handleInputChange}
                        style={styles.select}
                      >
                        <option value="">{t("aiStructured.selectOption")}</option>
                        <option value="BI-RADS 0类">{t("aiStructured.birads0")}</option>
                        <option value="BI-RADS 1类">{t("aiStructured.birads1")}</option>
                        <option value="BI-RADS 2类">{t("aiStructured.birads2")}</option>
                        <option value="BI-RADS 3类">{t("aiStructured.birads3")}</option>
                        <option value="BI-RADS 4类">{t("aiStructured.birads4")}</option>
                        <option value="BI-RADS 5类">{t("aiStructured.birads5")}</option>
                        <option value="BI-RADS 6类">{t("aiStructured.birads6")}</option>
                      </select>
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>{t("aiStructured.bilateralComparison")}</label>
                      <input
                        type="text"
                        name="breastData.bilateralComparison"
                        value={formData.breastData.bilateralComparison}
                        onChange={handleInputChange}
                        style={styles.input}
                        placeholder={t("aiStructured.placeholderBilateral")}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <label style={styles.label}>{t("aiStructured.calcification")}</label>
                    <input
                      type="text"
                      name="breastData.calcificationDescription"
                      value={formData.breastData.calcificationDescription}
                      onChange={handleInputChange}
                      style={styles.input}
                      placeholder={t("aiStructured.placeholderCalcification")}
                    />
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <label style={styles.label}>{t("aiStructured.massFeatures")}</label>
                    <textarea
                      name="breastData.massFeatures"
                      value={formData.breastData.massFeatures}
                      onChange={handleInputChange}
                      style={styles.textarea}
                      placeholder={t("aiStructured.placeholderMassFeatures")}
                    />
                  </div>
                </div>
              )}

              {/* JSON Preview Button */}
              <button
                style={styles.jsonPreviewButton}
                onClick={() => {
                  setPreviewJson(generateJsonReport());
                  setShowPreview(true);
                }}
              >
                {t("aiStructured.generateJsonPreview")}
              </button>
            </section>

            {/* Impression Section */}
            <section style={styles.section}>
              <PageHeader variant="inline" title={t("aiStructured.impressionSection")} style={{ marginBottom: 16, paddingBottom: 8, borderBottom: "2px solid #1e40af" }} />

              <div style={styles.sectionSubtitle}>{t("aiStructured.impressionSubtitle")}</div>
              {formData.impression.diagnoses.map((diag, index) => (
                <div key={diag.id} style={styles.diagnosisCard}>
                  <div style={styles.diagnosisHeader}>
                    <span style={styles.diagnosisNumber}>{t("aiStructured.diagnosisN", { n: index + 1 })}</span>
                    {formData.impression.diagnoses.length > 1 && (
                      <button
                        style={styles.removeButton}
                        onClick={() => handleRemoveDiagnosis(index)}
                      >
                        {t("aiStructured.delete")}
                      </button>
                    )}
                  </div>
                  <div style={{ marginBottom: "8px" }}>
                    <label style={styles.label}>{t("aiStructured.diagnosis")}</label>
                    <input
                      type="text"
                      value={diag.conclusion}
                      onChange={(e) =>
                        handleDiagnosisChange(
                          index,
                          "conclusion",
                          e.target.value,
                        )
                      }
                      style={styles.input}
                      placeholder={t("aiStructured.placeholderDiagnosis")}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>{t("aiStructured.diagnosisBasis")}</label>
                    <input
                      type="text"
                      value={diag.basis}
                      onChange={(e) =>
                        handleDiagnosisChange(index, "basis", e.target.value)
                      }
                      style={styles.input}
                      placeholder={t("aiStructured.placeholderDiagnosisBasis")}
                    />
                  </div>
                </div>
              ))}
              <button style={styles.addButton} onClick={handleAddDiagnosis}>
                {t("aiStructured.addDiagnosis")}
              </button>

              <div style={{ marginTop: "16px" }}>
                <label style={styles.label}>{t("aiStructured.differentialDiagnosis")}</label>
                <textarea
                  name="impression.differentialDiagnosis"
                  value={formData.impression.differentialDiagnosis}
                  onChange={handleInputChange}
                  style={styles.textarea}
                  placeholder={t("aiStructured.placeholderDifferential")}
                />
              </div>
            </section>

            {/* Recommendation Section */}
            <section style={styles.section}>
              <PageHeader variant="inline" title={t("aiStructured.recommendationSection")} style={{ marginBottom: 16, paddingBottom: 8, borderBottom: "2px solid #1e40af" }} />
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t("aiStructured.furtherExam")}</label>
                  <input
                    type="text"
                    name="recommendation.furtherExamSuggestion"
                    value={formData.recommendation.furtherExamSuggestion}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder={t("aiStructured.placeholderFurtherExam")}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t("aiStructured.followup")}</label>
                  <input
                    type="text"
                    name="recommendation.followupSuggestion"
                    value={formData.recommendation.followupSuggestion}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder={t("aiStructured.placeholderFollowup")}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>{t("aiStructured.treatment")}</label>
                  <input
                    type="text"
                    name="recommendation.treatmentSuggestion"
                    value={formData.recommendation.treatmentSuggestion}
                    onChange={handleInputChange}
                    style={styles.input}
                    placeholder={t("aiStructured.placeholderTreatment")}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Bottom Bar */}
          <div style={styles.bottomBar}>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={() =>
                setExpandedHistory(expandedHistory ? null : "main")
              }
            >
              {t("aiStructured.historyReports", { count: HISTORY_REPORTS.length })}
            </button>
            <div style={styles.buttonGroup}>
              <button
                style={{ ...styles.button, ...styles.buttonOutline }}
                onClick={handlePreview}
              >
                {t("aiStructured.preview")}
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonPrimary, display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => void handleSubmit()}
                disabled={savingReport}
              >
                <Save size={14} /> {savingReport ? t("aiStructured.saving") : t("aiStructured.saveReport")}
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonPrimary, display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={handlePrint}
              >
                <Printer size={14} /> {t("aiStructured.print")}
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* JSON Preview Modal */}
      {showPreview && (
        <div
          style={styles.previewOverlay}
          onClick={() => setShowPreview(false)}
        >
          <div style={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.previewHeader}>
              <span style={{ fontWeight: 600, fontSize: "16px" }}>
                {t("aiStructured.jsonPreviewTitle")}
              </span>
              <button
                style={styles.closeButton}
                onClick={() => setShowPreview(false)}
              >
                ×
              </button>
            </div>
            <div style={styles.previewContent}>
              <div style={styles.jsonPreview}>
                {previewJson || generateJsonReport()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIStructuredReportPage;
