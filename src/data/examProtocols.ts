// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10C - 检查协议模板库
// 供技师执行参考与排班排程使用（CT/MR/DR/MG）
// ============================================================

export type Modality = 'CT' | 'MR' | 'DR' | 'MG' | 'DSA' | 'US' | 'PET-CT';

export interface ScanParameters {
  /** 定位/扫描范围 */
  scanRange: string;
  /** 层厚/层距 */
  thickness: string;
  /** 螺距或扫描方式 */
  pitch?: string;
  /** kV */
  kv: string;
  /** mA 或 mAs */
  mA: string;
  /** 旋转时间或采集时间 */
  rotationTime?: string;
  /** 重建算法/核 */
  reconstruction: string;
  /** FOV */
  fov: string;
  /** 矩阵 */
  matrix: string;
}

export interface ExamSeries {
  name: string;
  sequence: string;
  description: string;
  duration?: string;
}

export interface ExamProtocol {
  id: string;
  name: string;
  modality: Modality;
  bodyPart: string;
  /** 临床应用场景 */
  indication: string;
  parameters: ScanParameters;
  /** 序列清单（MR/MG 重点） */
  series: ExamSeries[];
  /** 增强方案说明 */
  contrast?: string;
  /** 剂量参考 */
  doseReference?: string;
  /** 备注 */
  notes: string;
  /** 是否含增强 */
  enhanced: boolean;
}

// ============================================================
// CT 协议（15 项）
// ============================================================

export const CT_PROTOCOLS: ExamProtocol[] = [
  {
    id: 'CT-001',
    name: '头颅CT平扫（脑卒中快速筛查）',
    modality: 'CT',
    bodyPart: '颅脑',
    indication: '急性脑卒中、头痛、外伤、颅内出血排除',
    parameters: {
      scanRange: '颅底至颅顶',
      thickness: '5mm / 重建1-1.25mm',
      pitch: '1.0（螺旋）',
      kv: '120kV',
      mA: '250-320mA（自动管电流）',
      rotationTime: '1.0s',
      reconstruction: '骨算法+软组织算法，横轴位+MPR',
      fov: '250mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX', sequence: '横轴位平扫', description: '颅底至颅顶连续扫描' },
      { name: 'AX-BONE', sequence: '骨窗重建', description: '骨算法薄层重建，外伤评估' },
    ],
    doseReference: 'CTDIvol 约 45-65 mGy；DLP 约 800-1000 mGy·cm',
    notes: '外伤加扫骨窗薄层；疑似卒中患者需评估CT灌注或CTA。',
    enhanced: false,
  },
  {
    id: 'CT-002',
    name: '头颅CT增强',
    modality: 'CT',
    bodyPart: '颅脑',
    indication: '颅内占位、肿瘤、脓肿、血管畸形评估',
    parameters: {
      scanRange: '颅底至颅顶',
      thickness: '5mm / 重建1-1.25mm',
      pitch: '1.0',
      kv: '120kV',
      mA: '250-320mA',
      rotationTime: '1.0s',
      reconstruction: '软组织算法，横轴位+冠状位MPR',
      fov: '250mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX', sequence: '平扫', description: '平扫全颅' },
      { name: 'AX-CE', sequence: '增强扫描', description: '注药后 2-3 分钟延迟扫描' },
    ],
    contrast: '碘对比剂（300-370mgI/mL）60-80mL，流速 2.5-3.0mL/s',
    doseReference: 'CTDIvol 约 45-65 mGy（每期）',
    notes: '观察脑膜强化需延迟 5-8 分钟补充扫描。',
    enhanced: true,
  },
  {
    id: 'CT-003',
    name: '胸部CT平扫（高分辨）',
    modality: 'CT',
    bodyPart: '胸部',
    indication: '肺结节、间质性肺病、肺炎、肺癌筛查',
    parameters: {
      scanRange: '肺尖至膈肌下缘',
      thickness: '1.0-1.25mm / 重建5mm',
      pitch: '1.2',
      kv: '120kV',
      mA: '自动管电流（50-120mA 低剂量）',
      rotationTime: '0.5s',
      reconstruction: '肺算法+软组织算法，HRCT重建',
      fov: '350mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'HRCT', sequence: '高分辨薄层', description: '1mm 薄层+高分辨算法' },
      { name: 'AX-5', sequence: '5mm 纵隔窗', description: '纵隔窗软组织算法' },
    ],
    doseReference: '低剂量筛查 CTDIvol 约 1.0-2.0 mGy；常规平扫 4-8 mGy',
    notes: '深吸气后屏气扫描；间质病变加扫呼气相。',
    enhanced: false,
  },
  {
    id: 'CT-004',
    name: '胸部CT增强',
    modality: 'CT',
    bodyPart: '胸部',
    indication: '纵隔肿瘤、肺实变鉴别、胸壁病变、分期',
    parameters: {
      scanRange: '肺尖至膈肌下缘',
      thickness: '1.0-1.25mm / 重建5mm',
      pitch: '1.2',
      kv: '120kV',
      mA: '自动管电流',
      rotationTime: '0.5s',
      reconstruction: '肺算法+软组织算法+MPR',
      fov: '350mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX-NC', sequence: '平扫', description: '必要时平扫' },
      { name: 'AX-ART', sequence: '动脉期', description: '注药后 25-30s，肺动脉/主动脉显影' },
      { name: 'AX-VEN', sequence: '静脉期', description: '注药后 55-70s' },
    ],
    contrast: '碘对比剂 80-100mL（350-370mgI/mL），流速 3.0-3.5mL/s',
    doseReference: 'CTDIvol 约 8-15 mGy（每期）',
    notes: '疑肺栓塞改用肺栓塞CTA协议（见 CT-006）。',
    enhanced: true,
  },
  {
    id: 'CT-005',
    name: '腹部CT平扫+增强（三期）',
    modality: 'CT',
    bodyPart: '上腹部',
    indication: '肝癌、胰腺病变、肝胆胰脾肾评估、腹痛待查',
    parameters: {
      scanRange: '膈顶至髂嵴（依临床扩展至盆腔）',
      thickness: '1.0-1.25mm / 重建5mm',
      pitch: '1.0-1.2',
      kv: '120kV（BMI>30 用 140kV）',
      mA: '自动管电流',
      rotationTime: '0.5s',
      reconstruction: '软组织算法+MPR+MIP',
      fov: '400mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX-NC', sequence: '平扫', description: '平扫全腹（基线密度评估）' },
      { name: 'AX-ART', sequence: '动脉期', description: '注药后 25-30s（智能触发主动脉）' },
      { name: 'AX-PV', sequence: '门脉期', description: '注药后 60-70s（肝脏强化峰）' },
      { name: 'AX-DEL', sequence: '延迟期', description: '注药后 180s（肝肿瘤廓清）' },
    ],
    contrast: '碘对比剂 1.2-1.5mL/kg（≤100-120mL，350-370mgI/mL），流速 3.0-4.0mL/s',
    doseReference: 'CTDIvol 约 10-16 mGy（每期）；三期合计 DLP 约 1500-2500 mGy·cm',
    notes: '扫描前饮水 800-1000mL；疑肝癌必须平扫+三期增强。',
    enhanced: true,
  },
  {
    id: 'CT-006',
    name: 'CT肺动脉成像（CTPA）',
    modality: 'CT',
    bodyPart: '肺动脉',
    indication: '急性肺栓塞、慢性血栓栓塞性肺动脉高压',
    parameters: {
      scanRange: '肺尖至膈肌（含全部肺野）',
      thickness: '1.0mm / 重建0.6-0.8mm',
      pitch: '1.5（快速扫描）',
      kv: '120kV',
      mA: '自动管电流',
      rotationTime: '0.4s',
      reconstruction: '软组织算法+血管重建MIP/VR',
      fov: '350mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX-PA', sequence: '肺动脉期', description: '智能触发（肺动脉干触发）' },
      { name: 'MIP', sequence: '血管重建', description: 'MIP/VR 冠状位重建' },
    ],
    contrast: '碘对比剂 60-80mL（350-370mgI/mL），流速 4.0-5.0mL/s，生理盐水冲刷 20-30mL',
    doseReference: 'CTDIvol 约 5-10 mGy',
    notes: '触发点置于肺动脉主干；要求屏气 ≥8s。',
    enhanced: true,
  },
  {
    id: 'CT-007',
    name: '冠状动脉CTA',
    modality: 'CT',
    bodyPart: '冠状动脉',
    indication: '冠心病诊断、冠脉支架/桥血管评估、斑块分析',
    parameters: {
      scanRange: '气管隆突下至心底（含冠脉全行程）',
      thickness: '0.5-0.6mm',
      pitch: '前瞻性/回顾性心电门控',
      kv: '100-120kV（心率<65 优选前瞻性低剂量）',
      mA: '自动管电流（心电门控调制）',
      rotationTime: '0.28s',
      reconstruction: '软组织算法，心动周期最佳时相（30%-45% R-R）重建',
      fov: '250mm',
      matrix: '512×512',
    },
    series: [
      { name: 'CAL', sequence: '钙化积分扫描', description: '非增强前瞻性扫描' },
      { name: 'CTA', sequence: '冠脉CTA', description: '碘对比剂+心电门控' },
      { name: 'VR', sequence: '三维重建', description: 'VR/CPR/MIP 冠脉树重建' },
    ],
    contrast: '碘对比剂 60-80mL（370-400mgI/mL），流速 4.5-5.5mL/s + 生理盐水 40mL',
    doseReference: '钙化积分约 1-3 mGy；CTA 约 3-10 mGy（前瞻性低剂量）',
    notes: '心率控制 ≤65bpm（β受体阻滞剂）；硝酸甘油舌下 0.4mg 扩张冠脉。',
    enhanced: true,
  },
  {
    id: 'CT-008',
    name: '腹部盆腔CT平扫',
    modality: 'CT',
    bodyPart: '腹盆腔',
    indication: '急腹症、泌尿系结石、炎症性肠病、体检',
    parameters: {
      scanRange: '膈顶至耻骨联合下缘',
      thickness: '1.0-1.25mm / 重建5mm',
      pitch: '1.2',
      kv: '120kV',
      mA: '自动管电流',
      rotationTime: '0.5s',
      reconstruction: '软组织算法+MPR（冠状位）',
      fov: '400mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX', sequence: '横轴位', description: '全腹盆腔平扫' },
      { name: 'COR', sequence: '冠状位MPR', description: '输尿管/结肠走行重建' },
    ],
    doseReference: 'CTDIvol 约 8-12 mGy',
    notes: '疑结石行尿路CT（CTKUB）可低剂量扫描（CTDIvol 3-5 mGy）。',
    enhanced: false,
  },
  {
    id: 'CT-009',
    name: '腹主动脉CTA',
    modality: 'CT',
    bodyPart: '腹主动脉',
    indication: '腹主动脉瘤、夹层、支架术前评估',
    parameters: {
      scanRange: '膈肌水平至股动脉分叉',
      thickness: '1.0mm / 重建0.8mm',
      pitch: '1.0-1.2',
      kv: '120kV',
      mA: '自动管电流',
      rotationTime: '0.5s',
      reconstruction: '软组织算法+血管MIP/VR+MPR',
      fov: '400mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX-ART', sequence: '动脉期', description: '智能触发（腹主动脉）' },
      { name: 'VR', sequence: '血管重建', description: 'VR/MIP 全程血管树' },
    ],
    contrast: '碘对比剂 90-110mL（350-370mgI/mL），流速 3.5-4.5mL/s',
    doseReference: 'CTDIvol 约 8-14 mGy',
    notes: '疑夹层需加做延迟期（60-70s）评估内膜片真假腔。',
    enhanced: true,
  },
  {
    id: 'CT-010',
    name: '脊柱CT（颈椎/胸椎/腰椎）',
    modality: 'CT',
    bodyPart: '脊柱',
    indication: '椎体骨折、椎管狭窄、椎间盘钙化、脊柱畸形',
    parameters: {
      scanRange: '颈C1-T1 / 胸T1-T12 / 腰T12-S1（依部位）',
      thickness: '1.0mm / 重建1-2mm',
      pitch: '1.0',
      kv: '120kV',
      mA: '自动管电流',
      rotationTime: '1.0s',
      reconstruction: '骨算法（骨窗）+软组织算法（椎间盘窗）',
      fov: '180-250mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX', sequence: '横轴位', description: '椎体+椎间盘层面' },
      { name: 'SAG', sequence: '矢状位MPR', description: '矢状位重建（骨+软组织）' },
    ],
    doseReference: '颈椎 CTDIvol 约 20-30 mGy；腰椎约 15-25 mGy',
    notes: '外伤患者加矢状位骨窗重建评估椎体压缩。',
    enhanced: false,
  },
  {
    id: 'CT-011',
    name: '泌尿系CTU（CT尿路成像）',
    modality: 'CT',
    bodyPart: '泌尿系统',
    indication: '血尿、肾盂肿瘤、输尿管病变、结石定位',
    parameters: {
      scanRange: '肾上极至膀胱底部',
      thickness: '1.0-1.25mm',
      pitch: '1.0-1.2',
      kv: '120kV',
      mA: '自动管电流',
      rotationTime: '0.5s',
      reconstruction: '软组织算法+MPR/CPR（输尿管全程）',
      fov: '350-400mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX-NC', sequence: '平扫', description: '平扫（结石定位）' },
      { name: 'AX-CM', sequence: '皮质期', description: '注药后 35-40s' },
      { name: 'AX-PY', sequence: '排泄期', description: '注药后 8-12 分钟（充盈输尿管）' },
    ],
    contrast: '碘对比剂 100-120mL（350mgI/mL），流速 3.0mL/s',
    doseReference: 'CTDIvol 约 10-15 mGy（每期）',
    notes: '排泄期扫描前嘱患者翻身转动以充盈输尿管。',
    enhanced: true,
  },
  {
    id: 'CT-012',
    name: '髋关节/四肢骨关节CT',
    modality: 'CT',
    bodyPart: '四肢骨关节',
    indication: '关节骨折分型、隐匿性骨折、骨肿瘤评估',
    parameters: {
      scanRange: '关节近端至远端（含双侧对比）',
      thickness: '1.0-2.0mm / 重建0.8-1mm',
      pitch: '1.0',
      kv: '120kV',
      mA: '自动管电流',
      rotationTime: '1.0s',
      reconstruction: '骨算法+软组织算法，多平面重建',
      fov: '150-250mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX', sequence: '横轴位', description: '关节层面连续扫描' },
      { name: 'MPR', sequence: '多平面重建', description: '冠状位+矢状位（骨折分型）' },
    ],
    doseReference: '髋关节 CTDIvol 约 12-20 mGy',
    notes: '双侧对比扫描时保持体位对称。',
    enhanced: false,
  },
  {
    id: 'CT-013',
    name: '胸部低剂量CT（肺癌筛查）',
    modality: 'CT',
    bodyPart: '胸部',
    indication: '高危人群肺癌筛查（Lung-RADS 随访）',
    parameters: {
      scanRange: '肺尖至膈肌下缘',
      thickness: '1.0mm / 重建1-3mm',
      pitch: '1.5',
      kv: '100-120kV（体质量小者100kV）',
      mA: '固定低mA（20-50mA）',
      rotationTime: '0.5s',
      reconstruction: '肺算法薄层，不推荐迭代过度平滑',
      fov: '350mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX', sequence: '薄层扫描', description: '低剂量薄层，单次屏气' },
    ],
    doseReference: 'CTDIvol ≤ 3 mGy（标准：≤1.5mGy 可达）',
    notes: '用于Lung-RADS筛查；不注射对比剂。',
    enhanced: false,
  },
  {
    id: 'CT-014',
    name: '鼻窦/颞骨HRCT',
    modality: 'CT',
    bodyPart: '头颈部',
    indication: '鼻窦炎、颞骨外伤、中耳乳突炎、内耳畸形',
    parameters: {
      scanRange: '鼻窦：眉弓至硬腭；颞骨：岩骨上下',
      thickness: '0.6-0.75mm（颞骨）/1.0mm（鼻窦）',
      pitch: '0.8-1.0',
      kv: '120kV',
      mA: '100-180mA',
      rotationTime: '1.0s',
      reconstruction: '骨算法高分辨重建，冠状位MPR（鼻窦）',
      fov: '120-150mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '侧位定位像' },
      { name: 'AX', sequence: '横轴位', description: '骨算法薄层' },
      { name: 'COR', sequence: '冠状位重建', description: '鼻窦开窗评估' },
    ],
    doseReference: '颞骨 CTDIvol 约 40-60 mGy；鼻窦约 10-15 mGy',
    notes: '颞骨扫描基线平行于上眶耳线。',
    enhanced: false,
  },
  {
    id: 'CT-015',
    name: '颈部CT增强',
    modality: 'CT',
    bodyPart: '颈部',
    indication: '甲状腺占位、颈部淋巴结、喉癌分期、颈部脓肿',
    parameters: {
      scanRange: '颅底至主动脉弓上缘',
      thickness: '1.0-1.25mm / 重建3mm',
      pitch: '1.0',
      kv: '120kV',
      mA: '自动管电流',
      rotationTime: '0.5s',
      reconstruction: '软组织算法+MPR',
      fov: '250mm',
      matrix: '512×512',
    },
    series: [
      { name: 'LOC', sequence: '定位像', description: '正侧位定位像' },
      { name: 'AX-CE', sequence: '增强动脉-静脉期', description: '注药后 30s 起扫（单次）' },
    ],
    contrast: '碘对比剂 60-80mL（350mgI/mL），流速 2.5-3.0mL/s',
    doseReference: 'CTDIvol 约 10-15 mGy',
    notes: '嘱患者平静呼吸不吞咽；咽部病变加做发音动作。',
    enhanced: true,
  },
];

// ============================================================
// MR 协议（12 项）
// ============================================================

export const MR_PROTOCOLS: ExamProtocol[] = [
  {
    id: 'MR-001',
    name: '头颅MRI平扫',
    modality: 'MR',
    bodyPart: '颅脑',
    indication: '头痛、癫痫、卒中评估、多发性硬化随访',
    parameters: {
      scanRange: '全颅（含小脑扁桃体）',
      thickness: '5mm（层间距1mm）',
      kv: '—',
      mA: '—',
      reconstruction: '矢状/横轴/冠状多平面',
      fov: '230mm',
      matrix: '256×256 以上',
    },
    series: [
      { name: 'SAG-T1', sequence: '矢状位T1WI', description: '中线结构、垂体评估', duration: '1:30' },
      { name: 'AX-T1', sequence: '横轴位T1WI', description: '解剖定位' },
      { name: 'AX-T2', sequence: '横轴位T2WI', description: '常规病变显示' },
      { name: 'AX-FLAIR', sequence: 'FLAIR', description: '白质病变、梗死显示最佳', duration: '2:00' },
      { name: 'DWI', sequence: '弥散加权', description: '急性梗死/脓肿/肿瘤鉴别', duration: '1:00' },
      { name: 'SWI', sequence: '磁敏感加权', description: '微出血、钙化、铁沉积', duration: '2:30' },
    ],
    doseReference: '无电离辐射',
    notes: '不合作患者使用镇静；疑垂体/内耳加薄层序列。',
    enhanced: false,
  },
  {
    id: 'MR-002',
    name: '头颅MRI增强',
    modality: 'MR',
    bodyPart: '颅脑',
    indication: '脑肿瘤、转移瘤、脑膜炎、脱髓鞘活动性评估',
    parameters: {
      scanRange: '全颅',
      thickness: '5mm / 薄层3mm（鞍区）',
      kv: '—',
      mA: '—',
      reconstruction: '三平面扫描',
      fov: '230mm',
      matrix: '256×256 以上',
    },
    series: [
      { name: 'SAG-T1', sequence: '矢状位T1WI', description: '平扫基线' },
      { name: 'AX-T1', sequence: '横轴位T1WI平扫', description: '增强前基线' },
      { name: 'AX-T1-CE', sequence: '横轴位T1WI增强', description: '注药后立即扫描', duration: '2:30' },
      { name: 'AX-T1-CE2', sequence: '延迟增强T1', description: '注药后5分钟，脑膜/病灶强化' },
      { name: 'COR-T1-CE', sequence: '冠状位增强', description: '占位定位' },
    ],
    contrast: '钆对比剂 0.1mmol/kg（标准剂量），静脉团注',
    notes: '脑转移评估加注后10分钟延迟；不合作者镇静后扫描。',
    enhanced: true,
  },
  {
    id: 'MR-003',
    name: '颈椎MRI',
    modality: 'MR',
    bodyPart: '颈椎',
    indication: '颈椎病、椎间盘突出、脊髓压迫、脊髓病变',
    parameters: {
      scanRange: 'C1-T1',
      thickness: '3mm（椎间盘）/4mm（矢状）',
      kv: '—',
      mA: '—',
      reconstruction: '矢状+横轴+冠状',
      fov: '220-240mm',
      matrix: '320×256',
    },
    series: [
      { name: 'SAG-T1', sequence: '矢状位T1WI', description: '椎体与椎管整体观' },
      { name: 'SAG-T2', sequence: '矢状位T2WI', description: '椎间盘、脊髓信号', duration: '2:30' },
      { name: 'AX-T2', sequence: '横轴位T2WI', description: '各椎间盘水平' },
      { name: 'SAG-STIR', sequence: 'STIR', description: '骨髓水肿、韧带损伤', duration: '2:00' },
    ],
    notes: '外伤患者全序列加 STIR；椎管狭窄加轴位T2脂肪抑制。',
    enhanced: false,
  },
  {
    id: 'MR-004',
    name: '腰椎MRI',
    modality: 'MR',
    bodyPart: '腰椎',
    indication: '腰椎间盘突出、椎管狭窄、腰腿痛',
    parameters: {
      scanRange: 'T12-S1',
      thickness: '3mm（轴位）/4mm（矢状）',
      kv: '—',
      mA: '—',
      reconstruction: '矢状+横轴',
      fov: '280-300mm',
      matrix: '320×256',
    },
    series: [
      { name: 'SAG-T1', sequence: '矢状位T1WI', description: '椎体形态' },
      { name: 'SAG-T2', sequence: '矢状位T2WI', description: '椎间盘信号（Pfirrmann分级）', duration: '2:30' },
      { name: 'AX-T2', sequence: '轴位T2WI', description: '神经根受压评估', duration: '3:00' },
      { name: 'SAG-T2-FS', sequence: '脂肪抑制T2', description: '终板炎Modic改变' },
    ],
    notes: 'Modic 改变需脂肪抑制序列鉴别。',
    enhanced: false,
  },
  {
    id: 'MR-005',
    name: '膝关节MRI',
    modality: 'MR',
    bodyPart: '膝关节',
    indication: '半月板损伤、交叉韧带损伤、软骨损伤',
    parameters: {
      scanRange: '髌骨上缘至胫骨近端',
      thickness: '3mm',
      kv: '—',
      mA: '—',
      reconstruction: '矢状+冠状+横轴+斜矢状',
      fov: '160-180mm',
      matrix: '320×256',
    },
    series: [
      { name: 'SAG-PD', sequence: '矢状位PD（质子密度）', description: '半月板（非脂肪抑制）', duration: '3:00' },
      { name: 'SAG-PD-FS', sequence: 'PD脂肪抑制', description: '骨髓水肿、软骨' },
      { name: 'COR-PD-FS', sequence: '冠状位PD-FS', description: '侧副韧带、半月板体部' },
      { name: 'AX-PD-FS', sequence: '横轴位PD-FS', description: '髌股关节' },
      { name: 'OBL', sequence: '斜矢状ACL束', description: '前交叉韧带走行' },
    ],
    notes: '疑ACL重建术后加斜矢状；对比剂膝关节造影（钆关节内注射）按需。',
    enhanced: false,
  },
  {
    id: 'MR-006',
    name: '肩关节MRI',
    modality: 'MR',
    bodyPart: '肩关节',
    indication: '肩袖损伤、盂唇撕裂、肩峰撞击综合征',
    parameters: {
      scanRange: '肩锁关节至肱骨干',
      thickness: '3mm',
      kv: '—',
      mA: '—',
      reconstruction: '斜矢状+斜冠状+横轴',
      fov: '160-180mm',
      matrix: '256×256',
    },
    series: [
      { name: 'AX-T2-FS', sequence: '横轴位T2-FS', description: '盂唇、关节囊' },
      { name: 'OBL-COR-PD', sequence: '斜冠状位PD-FS', description: '肩袖全貌（冈上肌）', duration: '3:00' },
      { name: 'OBL-SAG-T2', sequence: '斜矢状位T2', description: '肩袖切面评估' },
      { name: 'ABER', sequence: '外展外旋位', description: '盂唇撕裂检出（按需）' },
    ],
    notes: '疑盂唇损伤可行直接关节造影（钆稀释液关节内注射）。',
    enhanced: false,
  },
  {
    id: 'MR-007',
    name: '乳腺MRI增强（动态）',
    modality: 'MR',
    bodyPart: '乳腺',
    indication: '乳腺癌分期、新辅助化疗评估、高危筛查、假体评估',
    parameters: {
      scanRange: '双乳（俯卧位）',
      thickness: '1.5mm 无间距',
      kv: '—',
      mA: '—',
      reconstruction: '横轴位，动态多期',
      fov: '300-340mm（双侧）',
      matrix: '448×448',
    },
    series: [
      { name: 'AX-T2-FS', sequence: '横轴位T2-FS', description: '囊肿/水肿评估', duration: '3:00' },
      { name: 'DWI', sequence: '弥散加权', description: 'ADC 值（恶性<1.0×10⁻³mm²/s）', duration: '2:00' },
      { name: 'DCE-1', sequence: '增强前T1', description: '基线' },
      { name: 'DCE-2..6', sequence: '动态增强5期', description: '注药后每90s一期（早期强化率）', duration: '7:30' },
    ],
    contrast: '钆对比剂 0.1mmol/kg，流速 2.0mL/s，团注后连续动态采集',
    notes: '需在月经周期第 7-14 天扫描以降低背景实质强化。',
    enhanced: true,
  },
  {
    id: 'MR-008',
    name: '心脏MRI（CMR，含电影+灌注+LGE）',
    modality: 'MR',
    bodyPart: '心脏',
    indication: '心肌病、心肌炎、缺血性心脏病、心脏肿瘤',
    parameters: {
      scanRange: '全心（心电门控+呼吸导航）',
      thickness: '8mm（电影）',
      kv: '—',
      mA: '—',
      reconstruction: '长轴（2腔/3腔/4腔）+短轴连续',
      fov: '320-360mm',
      matrix: '256×192',
    },
    series: [
      { name: 'CINE-LAX', sequence: '电影长轴', description: '2/3/4腔心动电影', duration: '4:00' },
      { name: 'CINE-SAX', sequence: '电影短轴', description: '心功能（EF计算）', duration: '6:00' },
      { name: 'FLOW', sequence: '相位对比血流', description: '主动脉/瓣膜血流速度' },
      { name: 'PERF', sequence: '首过灌注', description: '腺苷负荷/静息灌注' },
      { name: 'LGE', sequence: '延迟强化', description: '注药后10分钟，心肌坏死/纤维化', duration: '5:00' },
    ],
    contrast: '钆对比剂 0.1-0.2mmol/kg（LGE 标准剂量）',
    notes: '负荷灌注需心血管医生在场监护。',
    enhanced: true,
  },
  {
    id: 'MR-009',
    name: '腹部MRI（肝脏，含多期增强）',
    modality: 'MR',
    bodyPart: '上腹部（肝脏）',
    indication: '肝脏占位鉴别（HCC/血管瘤/FNH）、肝硬化结节监测',
    parameters: {
      scanRange: '膈顶至肾下极',
      thickness: '4-5mm',
      kv: '—',
      mA: '—',
      reconstruction: '横轴+冠状',
      fov: '380mm',
      matrix: '320×224',
    },
    series: [
      { name: 'AX-T1-IN', sequence: '同反相位T1', description: '脂肪肝、含脂病变', duration: '0:20' },
      { name: 'AX-T2-FS', sequence: 'T2脂肪抑制', description: '血管瘤/囊变' },
      { name: 'DWI', sequence: '弥散加权', description: 'b=50/400/800，肿瘤限制扩散', duration: '2:30' },
      { name: 'AX-T1-CE-A', sequence: '动脉期', description: '智能触发（注药后15-20s）', duration: '0:20' },
      { name: 'AX-T1-CE-P', sequence: '门脉期', description: '60-70s' },
      { name: 'AX-T1-CE-D', sequence: '延迟期', description: '180s（LI-RADS廓清）' },
      { name: 'COR-T1-CE', sequence: '冠状位增强', description: '肝脏全貌' },
    ],
    contrast: '钆对比剂 0.025-0.1mmol/kg（肝特异性剂如普美显按厂家方案）',
    notes: '肝特异性对比剂加 20 分钟肝胆期扫描。',
    enhanced: true,
  },
  {
    id: 'MR-010',
    name: '前列腺MRI（mpMRI，PI-RADS）',
    modality: 'MR',
    bodyPart: '前列腺',
    indication: '前列腺癌诊断与定位（PI-RADS v2.1）',
    parameters: {
      scanRange: '前列腺及精囊（3T 推荐）',
      thickness: '3mm 无间距',
      kv: '—',
      mA: '—',
      reconstruction: '横轴+矢状+冠状',
      fov: '160-200mm',
      matrix: '≥320×320（DWI高b值）',
    },
    series: [
      { name: 'AX-T2', sequence: '高分辨T2WI', description: '移行带主导序列', duration: '4:00' },
      { name: 'DWI', sequence: 'DWI（b=0/50/800/1400-2000）', description: '外周带主导序列+ADC图', duration: '3:30' },
      { name: 'DCE', sequence: '动态增强', description: '早期强化（<2分钟）' },
      { name: 'SAG-T2', sequence: '矢状位T2', description: '精囊腺评估' },
    ],
    contrast: '钆对比剂 0.1mmol/kg（DCE序列）',
    notes: '检查前禁食4小时+直肠排气；3T+相控阵线圈为标准配置。',
    enhanced: true,
  },
  {
    id: 'MR-011',
    name: 'MR胰胆管成像（MRCP）',
    modality: 'MR',
    bodyPart: '胆道系统',
    indication: '胆道梗阻、胆管结石、胰胆管异常、术前评估',
    parameters: {
      scanRange: '上腹部（胆道区域）',
      thickness: '厚层块40-60mm / 薄层2-4mm',
      kv: '—',
      mA: '—',
      reconstruction: '冠状斜位+横轴',
      fov: '300mm',
      matrix: '320×256',
    },
    series: [
      { name: 'THICK-COR', sequence: '厚层块重T2', description: '胆道全景（无脂肪抑制）', duration: '0:20' },
      { name: 'THIN-COR', sequence: '薄层重T2', description: '胆管细节', duration: '3:00' },
      { name: 'AX-T2-FS', sequence: '横轴T2-FS', description: '胰胆管周围结构' },
      { name: 'DWI', sequence: '弥散加权', description: '鉴别炎性与肿瘤' },
    ],
    notes: '检查前禁食4-6小时；必要时注射胰泌素评估胰管。',
    enhanced: false,
  },
  {
    id: 'MR-012',
    name: '垂体MRI薄层动态增强',
    modality: 'MR',
    bodyPart: '鞍区（垂体）',
    indication: '垂体腺瘤、垂体功能异常、视交叉受压',
    parameters: {
      scanRange: '鞍区（3mm薄层）',
      thickness: '2-3mm 无间距',
      kv: '—',
      mA: '—',
      reconstruction: '矢状+冠状+横轴',
      fov: '180-200mm',
      matrix: '256×256',
    },
    series: [
      { name: 'SAG-T1', sequence: '矢状位T1 3mm', description: '鞍区解剖' },
      { name: 'COR-T1', sequence: '冠状位T1 2mm', description: '垂体左右对称评估' },
      { name: 'COR-T2', sequence: '冠状位T2', description: '囊变/出血信号' },
      { name: 'COR-T1-DYN', sequence: '动态增强6期', description: '注药后30s内连续采集（微腺瘤检出）', duration: '3:00' },
      { name: 'COR-T1-DEL', sequence: '冠状位延迟增强', description: '注药后5分钟' },
    ],
    contrast: '钆对比剂 0.1mmol/kg（动态团注）',
    notes: '动态期覆盖整段神经垂体-腺垂体强化过程。',
    enhanced: true,
  },
];

// ============================================================
// DR 协议（8 项）
// ============================================================

export const DR_PROTOCOLS: ExamProtocol[] = [
  {
    id: 'DR-001',
    name: '胸部正侧位DR',
    modality: 'DR',
    bodyPart: '胸部',
    indication: '肺炎、结核、胸腔积液、心脏扩大、体检',
    parameters: {
      scanRange: '全肺野（后前位PA+左侧位）',
      thickness: '—',
      kv: '120-130kV（PA）/125kV（侧位）',
      mA: '自动曝光控制',
      reconstruction: '标准滤线栅投照',
      fov: '35×43cm',
      matrix: '2048×2560',
    },
    series: [
      { name: 'PA', sequence: '后前位', description: '标准立位后前位，SID 180cm' },
      { name: 'LAT', sequence: '左侧位', description: '左胸贴片侧位' },
    ],
    doseReference: '入射体表剂量（ESD）约 0.1-0.3 mGy/张',
    notes: '吸气末屏气；SID 180cm；CR 患者评估心影。',
    enhanced: false,
  },
  {
    id: 'DR-002',
    name: '颈椎正侧位DR',
    modality: 'DR',
    bodyPart: '颈椎',
    indication: '颈椎病、外伤、颈痛筛查',
    parameters: {
      scanRange: 'C1-C7',
      thickness: '—',
      kv: '70-80kV',
      mA: '自动曝光',
      reconstruction: '滤线栅',
      fov: '24×30cm',
      matrix: '2048×2500',
    },
    series: [
      { name: 'AP', sequence: '前后位', description: '张口位+正位' },
      { name: 'LAT', sequence: '侧位', description: '椎体序列与生理曲度' },
      { name: 'OBL', sequence: '斜位', description: '椎间孔（按需）' },
    ],
    notes: '外伤患者先侧位；张口位评估齿状突。',
    enhanced: false,
  },
  {
    id: 'DR-003',
    name: '腰椎正侧位DR',
    modality: 'DR',
    bodyPart: '腰椎',
    indication: '腰背痛、腰椎退变、外伤',
    parameters: {
      scanRange: 'T12-S1',
      thickness: '—',
      kv: '80-90kV',
      mA: '自动曝光',
      reconstruction: '滤线栅',
      fov: '35×43cm',
      matrix: '2048×2560',
    },
    series: [
      { name: 'AP', sequence: '前后位', description: '椎体排列' },
      { name: 'LAT', sequence: '侧位', description: '椎间隙、生理曲度' },
      { name: 'OBL', sequence: '斜位', description: '椎弓峡部（按需）' },
    ],
    notes: '斜位用于椎弓峡部裂评估；动力位按需加摄。',
    enhanced: false,
  },
  {
    id: 'DR-004',
    name: '膝关节正侧位DR',
    modality: 'DR',
    bodyPart: '膝关节',
    indication: '膝关节痛、外伤、骨关节炎、关节间隙评估',
    parameters: {
      scanRange: '髌骨上缘至胫骨近端',
      thickness: '—',
      kv: '60-65kV',
      mA: '自动曝光',
      reconstruction: '—',
      fov: '24×30cm',
      matrix: '2048×2500',
    },
    series: [
      { name: 'AP', sequence: '前后位', description: '负重位（评估关节间隙）' },
      { name: 'LAT', sequence: '侧位', description: '髌骨与关节' },
      { name: 'AX', sequence: '髌骨轴位', description: '髌股关节（按需）' },
    ],
    notes: '疑骨关节炎加拍负重位/屈曲30度位。',
    enhanced: false,
  },
  {
    id: 'DR-005',
    name: '腹部立卧位DR',
    modality: 'DR',
    bodyPart: '腹部',
    indication: '急腹症、肠梗阻、消化道穿孔、异物',
    parameters: {
      scanRange: '膈顶至耻骨联合',
      thickness: '—',
      kv: '75-80kV',
      mA: '自动曝光',
      reconstruction: '—',
      fov: '35×43cm',
      matrix: '2048×2560',
    },
    series: [
      { name: 'SUP', sequence: '仰卧位', description: '平片全腹' },
      { name: 'UPR', sequence: '立位', description: '气液平面/膈下游离气体' },
    ],
    notes: '不能站立者摄左侧卧位水平投照。',
    enhanced: false,
  },
  {
    id: 'DR-006',
    name: '手/腕关节正侧位DR',
    modality: 'DR',
    bodyPart: '腕关节',
    indication: '骨折、腕管综合征、关节炎、类风湿评估',
    parameters: {
      scanRange: '腕关节（含桡骨远端）',
      thickness: '—',
      kv: '55-60kV',
      mA: '自动曝光',
      reconstruction: '—',
      fov: '18×24cm',
      matrix: '2048×2500',
    },
    series: [
      { name: 'PA', sequence: '后前位', description: '腕骨排列' },
      { name: 'LAT', sequence: '侧位', description: '桡骨角、月骨位置' },
      { name: 'OBL', sequence: '斜位', description: '腕骨重叠分辨' },
    ],
    notes: '疑舟骨骨折加摄舟骨位。',
    enhanced: false,
  },
  {
    id: 'DR-007',
    name: '髋关节正位DR',
    modality: 'DR',
    bodyPart: '髋关节',
    indication: '股骨颈骨折、髋关节骨关节炎、DDH筛查',
    parameters: {
      scanRange: '双侧髋关节',
      thickness: '—',
      kv: '75-85kV',
      mA: '自动曝光',
      reconstruction: '滤线栅',
      fov: '35×43cm',
      matrix: '2048×2560',
    },
    series: [
      { name: 'AP', sequence: '骨盆前后位', description: '双侧髋关节正位' },
      { name: 'FROG', sequence: '蛙式位', description: '股骨头颈侧位（儿童）' },
    ],
    notes: '股骨颈骨折阴性需加做CT排除隐匿骨折。',
    enhanced: false,
  },
  {
    id: 'DR-008',
    name: '头颅正侧位DR',
    modality: 'DR',
    bodyPart: '颅骨',
    indication: '颅骨骨折、颅内压增高征象、颅骨畸形',
    parameters: {
      scanRange: '全颅骨',
      thickness: '—',
      kv: '70-75kV',
      mA: '自动曝光',
      reconstruction: '滤线栅',
      fov: '24×30cm',
      matrix: '2048×2500',
    },
    series: [
      { name: 'PA', sequence: '后前位', description: '颅骨正位' },
      { name: 'LAT', sequence: '侧位', description: '颅骨侧位' },
      { name: 'TOWNE', sequence: '汤氏位', description: '枕骨/颅底（按需）' },
    ],
    notes: '急性脑外伤首选CT；DR仅用于轻度外伤筛查。',
    enhanced: false,
  },
];

// ============================================================
// MG 协议（4 项）
// ============================================================

export const MG_PROTOCOLS: ExamProtocol[] = [
  {
    id: 'MG-001',
    name: '乳腺X线摄影（双侧双体位，筛查）',
    modality: 'MG',
    bodyPart: '乳腺',
    indication: '40岁以上女性乳腺癌筛查',
    parameters: {
      scanRange: '双乳（CC+MLO）',
      thickness: '压迫后最佳',
      kv: '26-32kV（自动模式，钼/铑靶）',
      mA: '自动曝光（AEC）',
      reconstruction: '—',
      fov: '18×24 / 24×30cm',
      matrix: '全幅数字探测器',
    },
    series: [
      { name: 'RCC', sequence: '右乳头尾位', description: '压迫充分，胸大肌达片缘' },
      { name: 'RMLO', sequence: '右乳内外斜位', description: '含腋尾' },
      { name: 'LCC', sequence: '左乳头尾位', description: '双侧对称投照' },
      { name: 'LMLO', sequence: '左乳内外斜位', description: '双侧对称投照' },
    ],
    doseReference: '平均腺体剂量（AGD）≤3 mGy/张',
    notes: '压迫程度以患者耐受为限；BI-RADS 0类需追加投照。',
    enhanced: false,
  },
  {
    id: 'MG-002',
    name: '乳腺X线摄影（单侧诊断加拍）',
    modality: 'MG',
    bodyPart: '乳腺',
    indication: '筛查可疑病灶进一步定位（加压点片/放大）',
    parameters: {
      scanRange: '病灶局部',
      thickness: '加压点片/1.5-2倍放大',
      kv: '26-32kV',
      mA: '自动曝光',
      reconstruction: '—',
      fov: '18×24cm',
      matrix: '全幅数字探测器',
    },
    series: [
      { name: 'MAG', sequence: '放大投照', description: '钙化形态细节' },
      { name: 'SPOT', sequence: '加压点片', description: '病灶边缘与结构' },
      { name: 'LAT', sequence: '侧位（90°）', description: '三维定位（钙化）' },
    ],
    doseReference: 'AGD ≤3 mGy/张',
    notes: '用于BI-RADS 0类病灶的补充评估。',
    enhanced: false,
  },
  {
    id: 'MG-003',
    name: '数字乳腺断层合成（DBT）',
    modality: 'MG',
    bodyPart: '乳腺',
    indication: '致密型乳腺补充筛查、隐匿病灶检出',
    parameters: {
      scanRange: '双乳',
      thickness: '1mm层厚重建',
      kv: '28-32kV',
      mA: '自动（低剂量多次曝光）',
      reconstruction: '断层重建（约±25°扫描角）',
      fov: '24×30cm',
      matrix: '全幅数字探测器',
    },
    series: [
      { name: 'TOMO-CC', sequence: '断层头尾位', description: '致密乳腺病灶分层显示' },
      { name: 'TOMO-MLO', sequence: '断层内外斜位', description: '含腋尾' },
      { name: 'SYNTH', sequence: '合成2D图像', description: '结合DBT读片' },
    ],
    notes: 'DBT可降低召回率；与2D合成图联合判读。',
    enhanced: false,
  },
  {
    id: 'MG-004',
    name: '乳腺钼靶引导定位活检（立体定向）',
    modality: 'MG',
    bodyPart: '乳腺',
    indication: '仅钙化/微小病灶的病理获取',
    parameters: {
      scanRange: '病灶（定位立体坐标）',
      thickness: '—',
      kv: '26-30kV',
      mA: '自动曝光',
      reconstruction: '—',
      fov: '18×24cm',
      matrix: '全幅数字探测器',
    },
    series: [
      { name: 'SCOUT', sequence: '预定位片', description: '病灶确认' },
      { name: 'STEREO', sequence: '立体定位片', description: '±15°双片计算坐标' },
      { name: 'POST', sequence: '穿刺后验证', description: '标本影像（钙化取出确认）' },
    ],
    notes: '术后常规加压止血；标本送X线检查确认含钙化。',
    enhanced: false,
  },
];

// ============================================================
// 汇总导出
// ============================================================

export const ALL_EXAM_PROTOCOLS: ExamProtocol[] = [
  ...CT_PROTOCOLS,
  ...MR_PROTOCOLS,
  ...DR_PROTOCOLS,
  ...MG_PROTOCOLS,
];

/** 按设备类型筛选协议 */
export function filterByModality(modality: Modality): ExamProtocol[] {
  return ALL_EXAM_PROTOCOLS.filter((p) => p.modality === modality);
}

/** 按名称/部位/适应症检索 */
export function searchProtocols(query: string): ExamProtocol[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_EXAM_PROTOCOLS;
  return ALL_EXAM_PROTOCOLS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.bodyPart.toLowerCase().includes(q) ||
      p.indication.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q),
  );
}

/** 按ID获取协议 */
export function findProtocolById(id: string): ExamProtocol | undefined {
  return ALL_EXAM_PROTOCOLS.find((p) => p.id === id);
}
