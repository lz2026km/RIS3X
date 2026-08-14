/**
 * [G005 Wave 10A] DICOM SR 测量模板 seed (TID 1500/2000)
 *
 * 20 个完整测量模板 (DICOM PS3.3 TID 1500 Measurement Report / TID 2000 CAD SR),
 * 覆盖: CT 胸腹 / MR 脑脊柱 / DR 骨折 / MG 乳腺, 每模板含 5-8 个测量项
 * (SNOMED 编码 + 单位 + 正常参考范围 + 测量说明)。
 */
export interface SrMeasurementItem {
  code: string
  scheme: 'SCT' | 'DCM' | 'UMLS'
  meaning: string
  unit: string
  normalRange?: { min?: number; max?: number; label?: string }
  description: string
}

export interface SrMeasurementTemplate {
  id: string
  templateId: 'tid1500' | 'tid2000'
  templateName: string
  modality: string
  bodyPart: string
  category: string
  purpose: string
  measurements: SrMeasurementItem[]
  snomedFindings: string[]
}

// ── CT 胸部 (5) ──────────────────────────────────────────────────────────────

export const SEED_SR_TEMPLATES: SrMeasurementTemplate[] = [
  {
    id: 'SR-CT-CHEST-LUNG-NODULE',
    templateId: 'tid1500',
    templateName: '肺结节测量报告 (TID 1500)',
    modality: 'CT',
    bodyPart: 'Chest',
    category: '肿瘤随访',
    purpose: '肺结节直径/体积/密度测量, 用于 Fleischner 指南随访',
    measurements: [
      { code: '42724005', scheme: 'SCT', meaning: '最大径', unit: 'mm', description: '轴位最大层面最长径测量' },
      { code: '42610009', scheme: 'SCT', meaning: '垂直径', unit: 'mm', description: '与最大径垂直方向测量' },
      { code: '118565006', scheme: 'SCT', meaning: '结节体积', unit: 'mm3', description: '三维分割体积 (自动)' },
      { code: '371858001', scheme: 'SCT', meaning: '平均密度 (HU)', unit: 'HU', description: '结节内平均 CT 值' },
      { code: '103320005', scheme: 'SCT', meaning: '实性成分比例', unit: '%', description: '部分实性结节实性成分占比' },
      { code: '42724009', scheme: 'SCT', meaning: '边缘特征', unit: '', description: '分叶/毛刺/光滑描述' },
    ],
    snomedFindings: ['269412005', '427124008'],
  },
  {
    id: 'SR-CT-CHEST-LUNG-EMPHYSEMA',
    templateId: 'tid1500',
    templateName: '肺气肿定量测量 (TID 1500)',
    modality: 'CT',
    bodyPart: 'Chest',
    category: '功能定量',
    purpose: '肺密度直方图与气肿指数评估',
    measurements: [
      { code: '371859001', scheme: 'SCT', meaning: '低衰减区百分比 (LAA%)', unit: '%', normalRange: { max: 10, label: '正常 <10%' }, description: 'HU<-950 体素占比' },
      { code: '371859002', scheme: 'SCT', meaning: '肺总容积', unit: 'L', normalRange: { min: 3.5, max: 6.5 }, description: '双肺总容积' },
      { code: '371859003', scheme: 'SCT', meaning: '肺平均密度', unit: 'HU', normalRange: { min: -850, max: -750 }, description: '全肺平均密度' },
      { code: '371859004', scheme: 'SCT', meaning: '第 15 百分位密度 (P15)', unit: 'HU', normalRange: { min: -960, max: -900 }, description: '密度直方图 P15' },
    ],
    snomedFindings: ['87433001', '428040002'],
  },
  {
    id: 'SR-CT-CHEST-CORONARY-CAC',
    templateId: 'tid2000',
    templateName: '冠脉钙化积分 (CAD SR TID 2000)',
    modality: 'CT',
    bodyPart: 'Chest',
    category: '心血管',
    purpose: 'Agatston 钙化积分自动计算 (非增强 CT)',
    measurements: [
      { code: '118565010', scheme: 'SCT', meaning: 'Agatston 积分', unit: 'AU', normalRange: { max: 100, label: '0-100 低危' }, description: '冠脉钙化总积分' },
      { code: '118565011', scheme: 'SCT', meaning: '左前降支钙化积分', unit: 'AU', description: 'LAD 分支钙化积分' },
      { code: '118565012', scheme: 'SCT', meaning: '左回旋支钙化积分', unit: 'AU', description: 'LCX 分支钙化积分' },
      { code: '118565013', scheme: 'SCT', meaning: '右冠状动脉钙化积分', unit: 'AU', description: 'RCA 分支钙化积分' },
      { code: '118565014', scheme: 'SCT', meaning: '钙化体积', unit: 'mm3', description: '总钙化体积' },
    ],
    snomedFindings: ['399731000119109', '82846003'],
  },
  {
    id: 'SR-CT-CHEST-PLEURAL',
    templateId: 'tid1500',
    templateName: '胸腔积液测量 (TID 1500)',
    modality: 'CT',
    bodyPart: 'Chest',
    category: '急诊',
    purpose: '胸腔积液量与厚度评估',
    measurements: [
      { code: '118565021', scheme: 'SCT', meaning: '最大积液厚度', unit: 'mm', description: '肋膈角区最大垂直厚度' },
      { code: '118565022', scheme: 'SCT', meaning: '积液量 (估算)', unit: 'mL', normalRange: { max: 200 }, description: '单侧估算量' },
      { code: '118565023', scheme: 'SCT', meaning: '肺压缩比', unit: '%', normalRange: { max: 25 }, description: '受压肺体积占比' },
    ],
    snomedFindings: ['129715009', '33935002'],
  },
  {
    id: 'SR-CT-CHEST-MEDIASTINAL',
    templateId: 'tid1500',
    templateName: '纵隔淋巴结测量 (TID 1500)',
    modality: 'CT',
    bodyPart: 'Chest',
    category: '肿瘤分期',
    purpose: '纵隔淋巴结短径测量 (RECIST 1.1)',
    measurements: [
      { code: '118565031', scheme: 'SCT', meaning: '淋巴结短径', unit: 'mm', normalRange: { max: 10, label: '纵隔正常 <10mm' }, description: '短轴最大径' },
      { code: '118565032', scheme: 'SCT', meaning: '淋巴结长径', unit: 'mm', description: '长轴最大径' },
      { code: '118565033', scheme: 'SCT', meaning: '站别', unit: '', description: 'ATS 淋巴结分区' },
    ],
    snomedFindings: ['16571005', '309489007'],
  },

  // ── CT 腹部 (4) ────────────────────────────────────────────────────────────

  {
    id: 'SR-CT-ABDOMEN-LIVER',
    templateId: 'tid1500',
    templateName: '肝占位测量 (TID 1500)',
    modality: 'CT',
    bodyPart: 'Abdomen',
    category: '肿瘤随访',
    purpose: '肝脏病灶 RECIST 1.1 测量与增强特征',
    measurements: [
      { code: '118565041', scheme: 'SCT', meaning: '病灶长径', unit: 'mm', description: '最长层面最大径' },
      { code: '118565042', scheme: 'SCT', meaning: '病灶短径', unit: 'mm', description: '垂直最大径' },
      { code: '118565043', scheme: 'SCT', meaning: '动脉期强化', unit: 'HU', description: '动脉期 CT 值' },
      { code: '118565044', scheme: 'SCT', meaning: '门脉期强化', unit: 'HU', description: '门脉期 CT 值' },
      { code: '118565045', scheme: 'SCT', meaning: '延迟期强化', unit: 'HU', description: '延迟期 CT 值' },
      { code: '118565046', scheme: 'SCT', meaning: '病灶数量', unit: '个', description: '肝脏病灶总数' },
    ],
    snomedFindings: ['93863000', '300891008'],
  },
  {
    id: 'SR-CT-ABDOMEN-KIDNEY',
    templateId: 'tid1500',
    templateName: '肾结石测量 (TID 1500)',
    modality: 'CT',
    bodyPart: 'Abdomen',
    category: '泌尿',
    purpose: '结石大小/位置/密度评估',
    measurements: [
      { code: '118565051', scheme: 'SCT', meaning: '结石最大径', unit: 'mm', normalRange: { max: 5, label: '<5mm 可自行排出' }, description: '轴位最大径' },
      { code: '118565052', scheme: 'SCT', meaning: '结石密度', unit: 'HU', description: '平均 CT 值' },
      { code: '118565053', scheme: 'SCT', meaning: '肾积水程度', unit: '级', normalRange: { max: 1 }, description: '0-3 级肾积水' },
      { code: '118565054', scheme: 'SCT', meaning: '结石数量', unit: '个', description: '同侧结石总数' },
    ],
    snomedFindings: ['45134003', '9555002'],
  },
  {
    id: 'SR-CT-ABDOMEN-PANCREAS',
    templateId: 'tid2000',
    templateName: '胰腺病灶评估 (TID 2000)',
    modality: 'CT',
    bodyPart: 'Abdomen',
    category: '肿瘤',
    purpose: '胰腺肿瘤测量与血管侵犯评估',
    measurements: [
      { code: '118565061', scheme: 'SCT', meaning: '病灶最大径', unit: 'mm', description: '轴位最大径' },
      { code: '118565062', scheme: 'SCT', meaning: '胰头最大径', unit: 'mm', normalRange: { max: 30 }, description: '胰头部前后径' },
      { code: '118565063', scheme: 'SCT', meaning: '胰管扩张', unit: 'mm', normalRange: { max: 4 }, description: '主胰管直径' },
      { code: '118565064', scheme: 'SCT', meaning: '血管侵犯评分', unit: '分', normalRange: { max: 2 }, description: 'SMV/腹腔干受侵程度' },
    ],
    snomedFindings: ['363337005', '126725002'],
  },
  {
    id: 'SR-CT-ABDOMEN-AORTA',
    templateId: 'tid1500',
    templateName: '腹主动脉瘤测量 (TID 1500)',
    modality: 'CT',
    bodyPart: 'Abdomen',
    category: '血管',
    purpose: '腹主动脉瘤径线测量 (US 筛查阳性随访)',
    measurements: [
      { code: '118565071', scheme: 'SCT', meaning: '最大前后径', unit: 'mm', normalRange: { max: 30, label: '正常 <30mm' }, description: '垂直主动脉长轴' },
      { code: '118565072', scheme: 'SCT', meaning: '最大横径', unit: 'mm', normalRange: { max: 30 }, description: '轴位最大横径' },
      { code: '118565073', scheme: 'SCT', meaning: '瘤颈长度', unit: 'mm', description: '肾动脉开口至瘤顶' },
      { code: '118565074', scheme: 'SCT', meaning: '附壁血栓厚度', unit: 'mm', description: '最大附壁血栓厚度' },
    ],
    snomedFindings: ['18781003', '90934009'],
  },

  // ── MR 脑 (3) ──────────────────────────────────────────────────────────────

  {
    id: 'SR-MR-BRAIN-TUMOR',
    templateId: 'tid1500',
    templateName: '脑肿瘤测量 (TID 1500)',
    modality: 'MR',
    bodyPart: 'Brain',
    category: '肿瘤随访',
    purpose: '增强脑肿瘤三径测量与水肿评估 (RANO 标准)',
    measurements: [
      { code: '118565081', scheme: 'SCT', meaning: '增强病灶最大径', unit: 'mm', description: 'T1 增强最大径' },
      { code: '118565082', scheme: 'SCT', meaning: '增强病灶垂直径', unit: 'mm', description: '垂直径' },
      { code: '118565083', scheme: 'SCT', meaning: '肿瘤体积', unit: 'cm3', description: '三维分割体积' },
      { code: '118565084', scheme: 'SCT', meaning: '瘤周水肿最大径', unit: 'mm', description: 'FLAIR 水肿范围' },
      { code: '118565085', scheme: 'SCT', meaning: '中线移位', unit: 'mm', normalRange: { max: 5 }, description: '透明隔移位距离' },
    ],
    snomedFindings: ['126725002', '254660007'],
  },
  {
    id: 'SR-MR-BRAIN-MCA-INFARCT',
    templateId: 'tid2000',
    templateName: '急性脑梗 ASPECTS 评分 (TID 2000)',
    modality: 'MR',
    bodyPart: 'Brain',
    category: '急诊卒中',
    purpose: 'MCA 供血区早期缺血改变 ASPECTS 评分 (DWI)',
    measurements: [
      { code: '118565091', scheme: 'SCT', meaning: 'ASPECTS 评分', unit: '分', normalRange: { min: 8, max: 10, label: '≥8 溶栓获益大' }, description: '10 分区减分制' },
      { code: '118565092', scheme: 'SCT', meaning: '梗死体积 (DWI)', unit: 'mL', normalRange: { max: 70 }, description: 'DWI 高信号体积' },
      { code: '118565093', scheme: 'SCT', meaning: 'MRA 大血管闭塞', unit: '', description: 'ICA/M1/M2 是否闭塞' },
      { code: '118565094', scheme: 'SCT', meaning: '灌注失配比', unit: '', description: 'Tmax>6s 与核心梗死比' },
    ],
    snomedFindings: ['230690007', '429233002'],
  },
  {
    id: 'SR-MR-BRAIN-VENTRICLE',
    templateId: 'tid1500',
    templateName: '脑室/脑萎缩测量 (TID 1500)',
    modality: 'MR',
    bodyPart: 'Brain',
    category: '退行性疾病',
    purpose: '脑室宽度与海马萎缩评估 (AD 随访)',
    measurements: [
      { code: '118565101', scheme: 'SCT', meaning: '第三脑室宽度', unit: 'mm', normalRange: { min: 2, max: 8 }, description: '轴位第三脑室最大宽度' },
      { code: '118565102', scheme: 'SCT', meaning: '侧脑室颞角宽度', unit: 'mm', normalRange: { max: 3 }, description: '海马水平颞角宽' },
      { code: '118565103', scheme: 'SCT', meaning: '海马体积', unit: 'cm3', normalRange: { min: 2.5, max: 4.0 }, description: '双侧海马总体积' },
      { code: '118565104', scheme: 'SCT', meaning: '全脑体积', unit: 'cm3', description: '脑实质总体积' },
    ],
    snomedFindings: ['65570003', '102941001'],
  },

  // ── MR 脊柱 (3) ────────────────────────────────────────────────────────────

  {
    id: 'SR-MR-SPINE-DISC',
    templateId: 'tid1500',
    templateName: '腰椎间盘突出测量 (TID 1500)',
    modality: 'MR',
    bodyPart: 'Spine',
    category: '脊柱退变',
    purpose: '椎间盘突出程度与神经根压迫评估 (Pfirrmann)',
    measurements: [
      { code: '118565111', scheme: 'SCT', meaning: '突出最大前后径', unit: 'mm', normalRange: { max: 3 }, description: '轴位突出距离' },
      { code: '118565112', scheme: 'SCT', meaning: '突出层面', unit: '', description: 'L3/4-L5/S1 定位' },
      { code: '118565113', scheme: 'SCT', meaning: 'Pfirrmann 分级', unit: '级', normalRange: { max: 2 }, description: '1-5 级椎间盘退变' },
      { code: '118565114', scheme: 'SCT', meaning: '椎管面积', unit: 'mm2', normalRange: { min: 100 }, description: '硬膜囊面积' },
      { code: '118565115', scheme: 'SCT', meaning: '神经根压迫', unit: '', description: '有/无压迫描述' },
    ],
    snomedFindings: ['44172000', '110369009'],
  },
  {
    id: 'SR-MR-SPINE-CORD',
    templateId: 'tid1500',
    templateName: '脊髓病灶测量 (TID 1500)',
    modality: 'MR',
    bodyPart: 'Spine',
    category: '脱髓鞘',
    purpose: '颈髓脱髓鞘病灶测量 (MS 随访)',
    measurements: [
      { code: '118565121', scheme: 'SCT', meaning: '病灶纵径', unit: 'mm', description: '矢状位纵径' },
      { code: '118565122', scheme: 'SCT', meaning: '病灶横径', unit: 'mm', description: '轴位横径' },
      { code: '118565123', scheme: 'SCT', meaning: '病灶数量', unit: '个', description: '颈髓 T2 高信号灶总数' },
      { code: '118565124', scheme: 'SCT', meaning: '增强强化', unit: '', description: 'T1 增强是否强化' },
    ],
    snomedFindings: ['422962005', '247445005'],
  },
  {
    id: 'SR-MR-SPINE-COMPRESSION',
    templateId: 'tid2000',
    templateName: '椎体压缩骨折 (TID 2000)',
    modality: 'MR',
    bodyPart: 'Spine',
    category: '创伤',
    purpose: '椎体压缩程度与新鲜度评估',
    measurements: [
      { code: '118565131', scheme: 'SCT', meaning: '椎体前缘压缩比', unit: '%', normalRange: { max: 25 }, description: '(后-前)/后×100%' },
      { code: '118565132', scheme: 'SCT', meaning: '椎体高度丢失', unit: 'mm', description: '与邻椎对比' },
      { code: '118565133', scheme: 'SCT', meaning: '新鲜骨折信号', unit: '', description: 'STIR 高信号判定' },
      { code: '118565134', scheme: 'SCT', meaning: '后凸角', unit: '°', normalRange: { max: 10 }, description: '局部后凸 Cobb 角' },
    ],
    snomedFindings: ['127330003', '204532008'],
  },

  // ── DR 骨折 (3) ────────────────────────────────────────────────────────────

  {
    id: 'SR-DR-FRACTURE-WRIST',
    templateId: 'tid1500',
    templateName: '腕部骨折测量 (TID 1500)',
    modality: 'DR',
    bodyPart: 'Wrist',
    category: '创伤',
    purpose: '桡骨远端骨折移位与成角评估',
    measurements: [
      { code: '118565141', scheme: 'SCT', meaning: '桡骨缩短', unit: 'mm', normalRange: { max: 2 }, description: '桡骨茎突相对尺骨' },
      { code: '118565142', scheme: 'SCT', meaning: '掌倾角', unit: '°', normalRange: { min: 8, max: 14 }, description: '侧位掌倾角' },
      { code: '118565143', scheme: 'SCT', meaning: '尺偏角', unit: '°', normalRange: { min: 18, max: 24 }, description: '正位尺偏角' },
      { code: '118565144', scheme: 'SCT', meaning: '关节内累及', unit: '', description: '是否累及关节面' },
    ],
    snomedFindings: ['31642003', '439337005'],
  },
  {
    id: 'SR-DR-FRACTURE-ANKLE',
    templateId: 'tid2000',
    templateName: '踝部骨折分型 (TID 2000)',
    modality: 'DR',
    bodyPart: 'Ankle',
    category: '创伤',
    purpose: 'Weber/Lauge-Hansen 分型测量',
    measurements: [
      { code: '118565151', scheme: 'SCT', meaning: '腓骨骨折位置', unit: '', description: 'Weber A/B/C 分型' },
      { code: '118565152', scheme: 'SCT', meaning: '踝穴增宽', unit: 'mm', normalRange: { max: 2 }, description: '内踝间隙增宽' },
      { code: '118565153', scheme: 'SCT', meaning: '距骨移位', unit: 'mm', normalRange: { max: 1 }, description: '距骨相对胫骨移位' },
      { code: '118565154', scheme: 'SCT', meaning: '下胫腓间隙', unit: 'mm', normalRange: { max: 6 }, description: '下胫腓联合间隙' },
    ],
    snomedFindings: ['439337005', '125605004'],
  },
  {
    id: 'SR-DR-FRACTURE-HIP',
    templateId: 'tid1500',
    templateName: '股骨颈骨折测量 (TID 1500)',
    modality: 'DR',
    bodyPart: 'Hip',
    category: '创伤',
    purpose: '股骨颈骨折 Garden 分型测量',
    measurements: [
      { code: '118565161', scheme: 'SCT', meaning: 'Garden 分型', unit: '', description: 'I-IV 型' },
      { code: '118565162', scheme: 'SCT', meaning: '股骨颈缩短', unit: 'mm', normalRange: { max: 5 }, description: '颈干角丢失' },
      { code: '118565163', scheme: 'SCT', meaning: '颈干角', unit: '°', normalRange: { min: 120, max: 140 }, description: '标准颈干角' },
    ],
    snomedFindings: ['60633009', '124074004'],
  },

  // ── MG 乳腺 (2) ────────────────────────────────────────────────────────────

  {
    id: 'SR-MG-BREAST-MASS',
    templateId: 'tid1500',
    templateName: '乳腺肿块测量 (TID 1500)',
    modality: 'MG',
    bodyPart: 'Breast',
    category: '肿瘤筛查',
    purpose: '乳腺肿块测量与 BI-RADS 特征记录',
    measurements: [
      { code: '118565171', scheme: 'SCT', meaning: '肿块最大径', unit: 'mm', description: 'CC/MLO 双体位最大径' },
      { code: '118565172', scheme: 'SCT', meaning: '肿块形态', unit: '', description: '圆形/卵圆/不规则' },
      { code: '118565173', scheme: 'SCT', meaning: '边缘特征', unit: '', description: '清楚/模糊/毛刺' },
      { code: '118565174', scheme: 'SCT', meaning: '密度', unit: '', description: '高/等/低密度' },
      { code: '118565175', scheme: 'SCT', meaning: 'BI-RADS 分级', unit: '级', normalRange: { max: 2, label: '0-2 良性' }, description: '0-6 级' },
    ],
    snomedFindings: ['269531006', '170947004'],
  },
  {
    id: 'SR-MG-BREAST-CALC',
    templateId: 'tid2000',
    templateName: '乳腺钙化分析 (TID 2000)',
    modality: 'MG',
    bodyPart: 'Breast',
    category: '肿瘤筛查',
    purpose: '簇状钙化形态分布分析 (CAD SR)',
    measurements: [
      { code: '118565181', scheme: 'SCT', meaning: '钙化簇最大径', unit: 'mm', normalRange: { max: 10 }, description: '簇状分布范围' },
      { code: '118565182', scheme: 'SCT', meaning: '钙化形态', unit: '', description: '点状/线样/分支状/多形性' },
      { code: '118565183', scheme: 'SCT', meaning: '钙化数量', unit: '个', description: '簇内钙化个数' },
      { code: '118565184', scheme: 'SCT', meaning: '分布方式', unit: '', description: '成簇/线样/节段/区域性' },
      { code: '118565185', scheme: 'SCT', meaning: 'BI-RADS 分级', unit: '级', description: '0-6 级' },
    ],
    snomedFindings: ['269531006', '170947004'],
  },
  {
    id: 'SR-CT-CHEST-STENT',
    templateId: 'tid1500',
    templateName: '冠脉支架术后测量 (TID 1500)',
    modality: 'CT',
    bodyPart: 'Chest',
    category: '心血管随访',
    purpose: '支架通畅性与再狭窄评估 (冠脉 CTA 随访)',
    measurements: [
      { code: '118565191', scheme: 'SCT', meaning: '支架近段最小管腔径', unit: 'mm', description: '支架内再狭窄评估' },
      { code: '118565192', scheme: 'SCT', meaning: '支架内再狭窄', unit: '%', normalRange: { max: 50, label: '≥50% 为显著再狭窄' }, description: '支架段直径狭窄率' },
      { code: '118565193', scheme: 'SCT', meaning: '支架内平均密度', unit: 'HU', description: '支架内对比剂充盈密度' },
      { code: '118565194', scheme: 'SCT', meaning: '支架节段', unit: '', description: 'LAD/LCX/RCA 分段定位' },
      { code: '118565195', scheme: 'SCT', meaning: '支架外新生粥样硬化', unit: '', description: '支架两端边缘病变' },
    ],
    snomedFindings: ['399731000119109', '415070008'],
  },
  {
    id: 'SR-MR-PROSTATE',
    templateId: 'tid1500',
    templateName: '前列腺病灶测量 (TID 1500)',
    modality: 'MR',
    bodyPart: 'Pelvis',
    category: '肿瘤',
    purpose: '前列腺 PI-RADS 病灶测量与评分 (mpMRI)',
    measurements: [
      { code: '118565201', scheme: 'SCT', meaning: '病灶最大径', unit: 'mm', description: '轴位最大径' },
      { code: '118565202', scheme: 'SCT', meaning: '病灶体积', unit: 'cm3', description: '三维体积测量' },
      { code: '118565203', scheme: 'SCT', meaning: 'ADC 值', unit: '×10-6 mm2/s', normalRange: { min: 700, max: 1400 }, description: '弥散受限评估' },
      { code: '118565204', scheme: 'SCT', meaning: 'DCE 曲线类型', unit: '', description: 'I/II/III 型动态增强' },
      { code: '118565205', scheme: 'SCT', meaning: 'PI-RADS 评分', unit: '分', normalRange: { max: 2 }, description: '1-5 分' },
      { code: '118565206', scheme: 'SCT', meaning: '前列腺总体积', unit: 'cm3', normalRange: { min: 20, max: 40 }, description: 'PSA 密度计算用' },
    ],
    snomedFindings: ['126725002', '254650003'],
  },
]
