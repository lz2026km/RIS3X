// [v3.0.6.8-27] 设备主数据池
// 三甲医院放射科设备: CT 10 / MR 8 / DR 12 / US 8 / MG 3 / DSA 2 / PET-CT 2 = 45 台

export type DeviceModality = "CT" | "MR" | "DR" | "US" | "MG" | "DSA" | "PET-CT";
export type DeviceBrand =
  | "Siemens"
  | "GE Healthcare"
  | "Philips"
  | "Canon (Toshiba)"
  | "Hitachi"
  | "Mindray"
  | "United Imaging (联影)"
  | "Neusoft (东软)"
  | "Sonoscape (开立)"
  | "EDAN (理邦)"
  | "GE"
  | "Hologic"
  | "Fujifilm"
  | "Carestream";

export type DeviceStatus = "运行中" | "待机" | "维护中" | "故障" | "停用" | "校准中";
export type DeviceGrade = "A" | "B" | "C" | "D";

export interface DeviceMaster {
  id: string; // DEV-CT-001
  modality: DeviceModality;
  brand: DeviceBrand;
  model: string; // 具体型号
  serialNumber: string;
  assetCode: string; // 院内资产编号
  room: string; // 检查室
  floor: string; // 楼层
  building: string; // 楼栋
  // 采购
  purchaseDate: string;
  purchasePrice: number; // 万元
  warrantyExpiry: string;
  vendorContact: string; // 厂商联系电话
  // 配置
  tubeCount: number; // 球管数
  sliceCount: number; // 排数 (CT)
  fieldStrength: number; // 场强 T (MR)
  detectorType: string; // DR 探测器类型
  // 使用
  status: DeviceStatus;
  totalScans: number; // 累计扫描次数
  monthlyScans: number; // 月扫描
  avgScanDurationMin: number;
  // 维护
  lastMaintenanceAt: string;
  nextMaintenanceAt: string;
  maintenanceCycle: "季度" | "半年" | "年度" | "按需";
  totalDowntime: number; // 累计停机小时
  monthlyDowntime: number;
  // 质控
  imageQualityGrade: DeviceGrade; // 影像质控等级 (ACR 评估)
  doseComplianceRate: number; // 剂量合规率
  defectRate: number; // 故障率 (季度)
  // 元
  installedAt: string; // 安装日期
  responsibleEngineer: string; // 负责工程师
  responsibleDoctor: string; // 负责医师 (id)
  notes: string;
}

const DEVICE_MODELS_BY_MODALITY: Record<DeviceModality, { count: number; models: { brand: DeviceBrand; model: string; slices?: number; tesla?: number; }[] }> = {
  CT: {
    count: 10,
    models: [
      { brand: "Siemens", model: "SOMATOM Force", slices: 192 },
      { brand: "Siemens", model: "SOMATOM Definition AS+", slices: 128 },
      { brand: "GE Healthcare", model: "Revolution CT", slices: 256 },
      { brand: "Philips", model: "iCT Elite", slices: 128 },
      { brand: "Canon (Toshiba)", model: "Aquilion ONE", slices: 320 },
      { brand: "United Imaging (联影)", model: "uCT 960+", slices: 320 },
      { brand: "United Imaging (联影)", model: "uCT 860", slices: 160 },
      { brand: "Canon (Toshiba)", model: "Aquilion Precision", slices: 320 },
      { brand: "GE Healthcare", model: "Revolution Apex", slices: 256 },
      { brand: "Siemens", model: "SOMATOM go.Top", slices: 128 },
    ],
  },
  MR: {
    count: 8,
    models: [
      { brand: "Siemens", model: "MAGNETOM Vida 3.0T", tesla: 3.0 },
      { brand: "Siemens", model: "MAGNETOM Aera 1.5T", tesla: 1.5 },
      { brand: "GE Healthcare", model: "SIGNA Architect 3.0T", tesla: 3.0 },
      { brand: "Philips", model: "Ingenia Ambition 1.5T", tesla: 1.5 },
      { brand: "United Imaging (联影)", model: "uMR 890", tesla: 3.0 },
      { brand: "Canon (Toshiba)", model: "Vantage Galan 3T", tesla: 3.0 },
      { brand: "GE Healthcare", model: "SIGNA Premier", tesla: 3.0 },
      { brand: "Siemens", model: "MAGNETOM Lumina", tesla: 3.0 },
    ],
  },
  DR: {
    count: 12,
    models: [
      { brand: "Philips", model: "DigitalDiagnost C90" },
      { brand: "Philips", model: "DigitalDiagnost C50" },
      { brand: "Siemens", model: "MULTIX Impact" },
      { brand: "Siemens", model: "Ysio Max" },
      { brand: "GE Healthcare", model: "Optima XR240amx" },
      { brand: "GE Healthcare", model: "Definium 6000" },
      { brand: "Canon (Toshiba)", model: "RADREX-i" },
      { brand: "Carestream", model: "DRX-Evolve" },
      { brand: "Fujifilm", model: "FDR Visionary" },
      { brand: "Hologic", model: "Affirm PRISM" },
      { brand: "Mindray", model: "DigiEye 680" },
      { brand: "United Imaging (联影)", model: "uDR 780i" },
    ],
  },
  US: {
    count: 8,
    models: [
      { brand: "Philips", model: "EPIQ Elite" },
      { brand: "Philips", model: "iE33" },
      { brand: "GE Healthcare", model: "Voluson E10" },
      { brand: "GE Healthcare", model: "Vivid E95" },
      { brand: "Siemens", model: "ACUSON Sequoia" },
      { brand: "Siemens", model: "ACUSON S3000" },
      { brand: "Mindray", model: "Resona 7" },
      { brand: "Sonoscape (开立)", model: "P50" },
    ],
  },
  MG: {
    count: 3,
    models: [
      { brand: "Hologic", model: "3Dimensions" },
      { brand: "GE Healthcare", model: "Senographe Pristina" },
      { brand: "Fujifilm", model: "AMULET Innovality" },
    ],
  },
  DSA: {
    count: 2,
    models: [
      { brand: "Siemens", model: "Artis Q" },
      { brand: "Philips", model: "Azurion 7 M20" },
    ],
  },
  "PET-CT": {
    count: 2,
    models: [
      { brand: "Siemens", model: "Biograph Vision 600", slices: 128 },
      { brand: "United Imaging (联影)", model: "uMI Panorama", slices: 128 },
    ],
  },
};

const ROOMS: Record<DeviceModality, string[]> = {
  CT: ["CT1室", "CT2室", "CT3室", "CT4室", "CT5室", "CT6室", "CT7室", "CT8室", "CT9室", "CT10室"],
  MR: ["MR1室", "MR2室", "MR3室", "MR4室", "MR5室", "MR6室", "MR7室", "MR8室"],
  DR: ["DR1室", "DR2室", "DR3室", "DR4室", "DR5室", "DR6室", "DR7室", "DR8室", "DR9室", "DR10室", "急诊DR室", "体检DR室"],
  US: ["超声1诊室", "超声2诊室", "超声3诊室", "超声4诊室", "超声5诊室", "超声6诊室", "心脏超声室", "急诊超声室"],
  MG: ["钼靶1室", "钼靶2室", "钼靶3室"],
  DSA: ["DSA1室(介入)", "DSA2室(复合)"],
  "PET-CT": ["PET-CT1室", "PET-CT2室"],
};

const BUILDINGS = ["医技楼", "门诊楼", "急诊楼", "住院部", "体检中心", "肿瘤中心", "心脏中心", "神经中心"];
const FLOORS = ["1F", "2F", "3F", "4F", "5F", "B1", "B2"];

function rng(seed?: number): number {
  if (seed !== undefined) {
    return ((seed * 9301 + 49297) % 233280) / 233280;
  }
  return Math.random();
}

let _deviceSeed = 12345;
function dseed(): number {
  return rng(++_deviceSeed);
}

const VENDOR_CONTACTS = [
  "400-810-0001 (Siemens)", "400-810-0002 (GE)", "400-810-0003 (Philips)",
  "400-810-0004 (Canon)", "400-810-0005 (联影)", "400-810-0006 (迈瑞)",
  "400-810-0007 (东软)", "400-810-0008 (开立)",
];

function makeDevice(modality: DeviceModality, idx: number, info: { brand: DeviceBrand; model: string; slices?: number; tesla?: number; }): DeviceMaster {
  const code = `${modality}-${String(idx + 1).toString().padStart(3, "0")}`;
  const id = `DEV-${modality}-${String(idx + 1).toString().padStart(3, "0")}`;
  const purchaseYear = 2014 + Math.floor(dseed() * 12); // 2014-2025
  const purchaseMonth = Math.floor(dseed() * 12) + 1;
  const purchaseDay = Math.floor(dseed() * 28) + 1;
  const purchaseDate = `${purchaseYear}-${String(purchaseMonth).padStart(2, "0")}-${String(purchaseDay).padStart(2, "0")}`;
  // 价格 (按模态 + 新旧)
  let price = 0;
  if (modality === "CT") price = 800 + Math.floor(dseed() * 1500); // 800-2300 万
  else if (modality === "MR") price = 1200 + Math.floor(dseed() * 1800); // 1200-3000 万
  else if (modality === "DSA") price = 600 + Math.floor(dseed() * 1000); // 600-1600 万
  else if (modality === "DR") price = 80 + Math.floor(dseed() * 250); // 80-330 万
  else if (modality === "US") price = 60 + Math.floor(dseed() * 180); // 60-240 万
  else if (modality === "MG") price = 250 + Math.floor(dseed() * 350); // 250-600 万
  else if (modality === "PET-CT") price = 1500 + Math.floor(dseed() * 2500); // 1500-4000 万
  else price = 100;

  // 使用情况
  const ageYears = 2026 - purchaseYear;
  const totalScans = ageYears * 12 * (modality === "CT" ? 800 : modality === "MR" ? 350 : modality === "DR" ? 1200 : modality === "US" ? 1500 : modality === "MG" ? 400 : modality === "PET-CT" ? 80 : 150) + Math.floor(dseed() * 200);
  const monthlyScans = Math.floor(totalScans / (ageYears * 12 + 1));
  // 状态
  const statusRoll = dseed();
  let status: DeviceStatus;
  if (statusRoll < 0.85) status = "运行中";
  else if (statusRoll < 0.92) status = "待机";
  else if (statusRoll < 0.96) status = "维护中";
  else if (statusRoll < 0.98) status = "故障";
  else status = "校准中";
  // 影像质控等级
  const qcRoll = dseed();
  let qcGrade: DeviceGrade = "A";
  if (qcRoll < 0.6) qcGrade = "A";
  else if (qcRoll < 0.85) qcGrade = "B";
  else if (qcRoll < 0.97) qcGrade = "C";
  else qcGrade = "D";
  // 维护
  const lastMaintMonth = Math.floor(dseed() * 6) + 1;
  const nextMaintMonth = (lastMaintMonth + 3) % 12 + 1;
  const lastMaintAt = `2026-${String(lastMaintMonth).padStart(2, "0")}-${String(Math.floor(dseed() * 28) + 1).padStart(2, "0")}`;
  const nextMaintAt = `2026-${String(nextMaintMonth).padStart(2, "0")}-${String(Math.floor(dseed() * 28) + 1).padStart(2, "0")}`;
  // 故障率
  const defectRate = (dseed() * 1.5).toFixed(2);
  // 停机时间
  const totalDowntime = Math.floor(dseed() * 80) + ageYears * 8;
  const monthlyDowntime = Math.floor(dseed() * 8);
  // 球管数
  const tubeCount = modality === "CT" ? 2 : modality === "MR" ? 0 : 1;
  // 扫描时长
  const avgDur = modality === "CT" ? 5 + dseed() * 15 : modality === "MR" ? 20 + dseed() * 30 : modality === "DR" ? 3 + dseed() * 4 : modality === "US" ? 10 + dseed() * 15 : modality === "MG" ? 8 + dseed() * 10 : modality === "PET-CT" ? 25 + dseed() * 20 : 30;
  // 位置
  const room = ROOMS[modality][idx] || `${modality}${idx + 1}室`;
  const building = BUILDINGS[Math.floor(dseed() * BUILDINGS.length)]!;
  const floor = FLOORS[Math.floor(dseed() * FLOORS.length)]!;
  // 责任医生 (D001-D075)
  const docIdx = Math.floor(dseed() * 75);
  const responsibleDoctor = `D${String(docIdx + 1).padStart(3, "0")}`;

  return {
    id,
    modality,
    brand: info.brand,
    model: info.model,
    serialNumber: `SN${modality}-${purchaseYear}-${String(Math.floor(dseed() * 100000)).padStart(5, "0")}`,
    assetCode: `资产-${purchaseYear}-${code}`,
    room,
    floor,
    building,
    purchaseDate,
    purchasePrice: price,
    warrantyExpiry: `${purchaseYear + 5}-${String(purchaseMonth).padStart(2, "0")}-${String(purchaseDay).padStart(2, "0")}`,
    vendorContact: VENDOR_CONTACTS[Math.floor(dseed() * VENDOR_CONTACTS.length)]!,
    tubeCount,
    sliceCount: info.slices || 0,
    fieldStrength: info.tesla || 0,
    detectorType: modality === "DR" ? ["CsI 无线平板", "非晶硅平板", "CCD"][Math.floor(dseed() * 3)]! : "-",
    status,
    totalScans,
    monthlyScans,
    avgScanDurationMin: Math.round(avgDur * 10) / 10,
    lastMaintenanceAt: lastMaintAt,
    nextMaintenanceAt: nextMaintAt,
    maintenanceCycle: ["季度", "半年", "年度", "按需"][Math.floor(dseed() * 4)]! as DeviceMaster["maintenanceCycle"],
    totalDowntime,
    monthlyDowntime,
    imageQualityGrade: qcGrade,
    doseComplianceRate: Math.round((85 + dseed() * 15) * 10) / 10,
    defectRate: parseFloat(defectRate),
    installedAt: purchaseDate,
    responsibleEngineer: `工程师-${Math.floor(dseed() * 12) + 1}`,
    responsibleDoctor,
    notes: status === "故障" ? "待维修" : status === "维护中" ? "预防性维护中" : "正常运行",
  };
}

export const DEVICE_MASTER: DeviceMaster[] = [];

// 按模态生成
const MODALITY_ORDER: DeviceModality[] = ["CT", "MR", "DR", "US", "MG", "DSA", "PET-CT"];
MODALITY_ORDER.forEach((mod) => {
  const info = DEVICE_MODELS_BY_MODALITY[mod];
  for (let i = 0; i < info.models.length; i++) {
    DEVICE_MASTER.push(makeDevice(mod, i, info.models[i]!));
  }
});

// 工具
export const DEVICE_BY_ID: Record<string, DeviceMaster> = Object.fromEntries(DEVICE_MASTER.map((d) => [d.id, d]));

export const DEVICES_BY_MODALITY: Record<DeviceModality, DeviceMaster[]> = {
  CT: DEVICE_MASTER.filter((d) => d.modality === "CT"),
  MR: DEVICE_MASTER.filter((d) => d.modality === "MR"),
  DR: DEVICE_MASTER.filter((d) => d.modality === "DR"),
  US: DEVICE_MASTER.filter((d) => d.modality === "US"),
  MG: DEVICE_MASTER.filter((d) => d.modality === "MG"),
  DSA: DEVICE_MASTER.filter((d) => d.modality === "DSA"),
  "PET-CT": DEVICE_MASTER.filter((d) => d.modality === "PET-CT"),
};

// 按状态
export const DEVICES_BY_STATUS: Record<DeviceStatus, DeviceMaster[]> = {
  运行中: DEVICE_MASTER.filter((d) => d.status === "运行中"),
  待机: DEVICE_MASTER.filter((d) => d.status === "待机"),
  维护中: DEVICE_MASTER.filter((d) => d.status === "维护中"),
  故障: DEVICE_MASTER.filter((d) => d.status === "故障"),
  停用: DEVICE_MASTER.filter((d) => d.status === "停用"),
  校准中: DEVICE_MASTER.filter((d) => d.status === "校准中"),
};

// 统计
export const DEVICE_STATS = {
  total: DEVICE_MASTER.length,
  byModality: Object.fromEntries(MODALITY_ORDER.map((m) => [m, DEVICES_BY_MODALITY[m].length])),
  byStatus: Object.fromEntries(Object.entries(DEVICES_BY_STATUS).map(([k, v]) => [k, v.length])),
  byGrade: {
    A: DEVICE_MASTER.filter((d) => d.imageQualityGrade === "A").length,
    B: DEVICE_MASTER.filter((d) => d.imageQualityGrade === "B").length,
    C: DEVICE_MASTER.filter((d) => d.imageQualityGrade === "C").length,
    D: DEVICE_MASTER.filter((d) => d.imageQualityGrade === "D").length,
  },
  totalValue: DEVICE_MASTER.reduce((s, d) => s + d.purchasePrice, 0),
  avgUtilization: (DEVICE_MASTER.reduce((s, d) => s + (d.monthlyScans / (d.status === "运行中" ? 1 : 0.3)), 0) / DEVICE_MASTER.length).toFixed(0),
};
