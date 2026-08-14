// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10C - 解剖部位数据库
// 供检查登记 / 报告定位 / 协议选择
// ============================================================

export type AnatomySystem =
  | '神经' | '胸部' | '腹部' | '盆部' | '骨骼' | '乳腺' | '心血管';

export interface AnatomyPart {
  id: string;
  name: string;
  englishName: string;
  /** 所属系统 */
  system: AnatomySystem;
  /** 可用检查设备 */
  modality: Array<'CT' | 'MR' | 'DR' | 'US' | 'MG' | 'PET-CT' | 'DSA'>;
  /** 大部位（用于排班/登记分类） */
  bodyPart: string;
  /** 是否区分左右 */
  laterality: boolean;
  /** 标准投照/扫描方位 */
  standardViews: string[];
  /** 备注 */
  note?: string;
}

export const ANATOMY_SYSTEMS: AnatomySystem[] = [
  '神经', '胸部', '腹部', '盆部', '骨骼', '乳腺', '心血管',
];

// ============================================================
// 神经
// ============================================================

const NEURO_PARTS: AnatomyPart[] = [
  { id: 'NA-01', name: '颅脑', englishName: 'Brain (Cranium)', system: '神经', modality: ['CT', 'MR', 'PET-CT'], bodyPart: '头', laterality: false, standardViews: ['横轴位', '矢状位', '冠状位'], note: '常规头颅检查标准部位' },
  { id: 'NA-02', name: '鞍区（垂体）', englishName: 'Sella Turcica / Pituitary', system: '神经', modality: ['CT', 'MR'], bodyPart: '头', laterality: false, standardViews: ['矢状位薄层', '冠状位薄层', '动态增强'], note: '垂体病变需薄层动态增强' },
  { id: 'NA-03', name: '眼眶', englishName: 'Orbit', system: '神经', modality: ['CT', 'MR'], bodyPart: '头', laterality: true, standardViews: ['横轴位', '冠状位（视神经）', '斜矢状位（视神经管）'], note: '眼眶外伤注意双侧对比' },
  { id: 'NA-04', name: '鼻窦', englishName: 'Paranasal Sinuses', system: '神经', modality: ['CT', 'MR'], bodyPart: '头', laterality: false, standardViews: ['冠状位', '横轴位'], note: '鼻窦HRCT冠状位为主要观察方位' },
  { id: 'NA-05', name: '颞骨/内耳', englishName: 'Temporal Bone / Inner Ear', system: '神经', modality: ['CT', 'MR'], bodyPart: '头', laterality: true, standardViews: ['横轴位薄层（0.6-0.75mm）', '冠状位重建'], note: '中耳乳突、内耳畸形评估' },
  { id: 'NA-06', name: '颞下颌关节', englishName: 'TMJ', system: '神经', modality: ['CT', 'MR'], bodyPart: '头', laterality: true, standardViews: ['斜矢状位（闭口位）', '斜矢状位（开口位）', '冠状位'], note: '关节盘前移评估需开口闭口序列' },
  { id: 'NA-07', name: '颅底', englishName: 'Skull Base', system: '神经', modality: ['CT', 'MR'], bodyPart: '头', laterality: false, standardViews: ['横轴位', '冠状位'], note: '颅底骨折、肿瘤侵犯评估' },
  { id: 'NA-08', name: '面颅骨（颌面）', englishName: 'Facial Bones', system: '神经', modality: ['CT', 'DR'], bodyPart: '头', laterality: false, standardViews: ['横轴位', '三维重建'], note: '面中部骨折（Le Fort分型）' },
  { id: 'NA-09', name: '脑动脉（脑血管成像）', englishName: 'Cerebral Arteries (CTA/MRA)', system: '神经', modality: ['CT', 'MR', 'DSA'], bodyPart: '头', laterality: false, standardViews: ['CTA/MRA三维重建', 'MIP', 'DSA正侧位'], note: '动脉瘤、动脉狭窄评估' },
  { id: 'NA-10', name: '脑静脉系统（MRV）', englishName: 'Cerebral Veins (MRV)', system: '神经', modality: ['MR', 'CT'], bodyPart: '头', laterality: false, standardViews: ['MRV三维重建', '横轴位'], note: '静脉窦血栓（急症）' },
  { id: 'NA-11', name: '颈动脉', englishName: 'Carotid Arteries', system: '神经', modality: ['US', 'CT', 'MR'], bodyPart: '颈部', laterality: true, standardViews: ['超声纵切/横切', 'CTA重建'], note: '颈动脉斑块、狭窄评估' },
  { id: 'NA-12', name: '颈椎', englishName: 'Cervical Spine', system: '神经', modality: ['MR', 'CT', 'DR'], bodyPart: '脊柱', laterality: false, standardViews: ['矢状位T1/T2', '横轴位各间盘', '正侧位X线'], note: '颈椎病首选MR' },
  { id: 'NA-13', name: '胸椎', englishName: 'Thoracic Spine', system: '神经', modality: ['MR', 'CT', 'DR'], bodyPart: '脊柱', laterality: false, standardViews: ['矢状位', '横轴位（病变水平）'], note: '胸椎骨折、占位' },
  { id: 'NA-14', name: '腰椎', englishName: 'Lumbar Spine', system: '神经', modality: ['MR', 'CT', 'DR'], bodyPart: '脊柱', laterality: false, standardViews: ['矢状位T1/T2', '横轴位各间盘', '正侧位X线'], note: '椎间盘突出评估标准序列' },
  { id: 'NA-15', name: '骶尾椎', englishName: 'Sacrum/Coccyx', system: '神经', modality: ['MR', 'CT', 'DR'], bodyPart: '脊柱', laterality: false, standardViews: ['矢状位', '横轴位'], note: '骶骨骨折、脊索瘤' },
  { id: 'NA-16', name: '脊髓', englishName: 'Spinal Cord', system: '神经', modality: ['MR'], bodyPart: '脊柱', laterality: false, standardViews: ['矢状位T1/T2', '横轴位', 'DWI'], note: '脊髓病变需全脊髓成像' },
  { id: 'NA-17', name: '臂丛神经', englishName: 'Brachial Plexus', system: '神经', modality: ['MR', 'CT'], bodyPart: '颈部/肩', laterality: true, standardViews: ['冠状位3D-STIR', '横轴位'], note: '臂丛损伤、肿瘤侵犯' },
  { id: 'NA-18', name: '腰骶丛神经', englishName: 'Lumbosacral Plexus', system: '神经', modality: ['MR'], bodyPart: '盆部', laterality: true, standardViews: ['冠状位3D-STIR', '斜轴位'], note: '盆腔肿瘤神经侵犯评估' },
  { id: 'NA-19', name: '面神经', englishName: 'Facial Nerve', system: '神经', modality: ['MR', 'CT'], bodyPart: '头', laterality: true, standardViews: ['薄层T2（3D-CISS）', '颞骨HRCT'], note: '面瘫病因评估' },
  { id: 'NA-20', name: '三叉神经', englishName: 'Trigeminal Nerve', system: '神经', modality: ['MR'], bodyPart: '头', laterality: true, standardViews: ['3D-T2薄层', '神经血管关系评估'], note: '三叉神经痛-血管压迫评估' },
];

// ============================================================
// 胸部
// ============================================================

const CHEST_PARTS: AnatomyPart[] = [
  { id: 'CH-01', name: '肺（全肺）', englishName: 'Lungs', system: '胸部', modality: ['CT', 'DR', 'MR', 'PET-CT'], bodyPart: '胸部', laterality: true, standardViews: ['胸部正侧位', 'CT薄层', 'HRCT'], note: '肺结节需薄层重建' },
  { id: 'CH-02', name: '右肺上叶', englishName: 'RUL', system: '胸部', modality: ['CT', 'DR'], bodyPart: '胸部', laterality: true, standardViews: ['CT薄层', '肺窗'], note: '肺癌好发部位' },
  { id: 'CH-03', name: '右肺中叶', englishName: 'RML', system: '胸部', modality: ['CT', 'DR'], bodyPart: '胸部', laterality: true, standardViews: ['CT薄层', '肺窗'], note: '中叶综合征评估' },
  { id: 'CH-04', name: '右肺下叶', englishName: 'RLL', system: '胸部', modality: ['CT', 'DR'], bodyPart: '胸部', laterality: true, standardViews: ['CT薄层', '肺窗'], note: '坠积性病变好发' },
  { id: 'CH-05', name: '左肺上叶', englishName: 'LUL', system: '胸部', modality: ['CT', 'DR'], bodyPart: '胸部', laterality: true, standardViews: ['CT薄层', '肺窗'], note: '含舌段' },
  { id: 'CH-06', name: '左肺下叶', englishName: 'LLL', system: '胸部', modality: ['CT', 'DR'], bodyPart: '胸部', laterality: true, standardViews: ['CT薄层', '肺窗'], note: '' },
  { id: 'CH-07', name: '气管及主支气管', englishName: 'Trachea & Main Bronchi', system: '胸部', modality: ['CT', 'MR'], bodyPart: '胸部', laterality: false, standardViews: ['CT冠状位重建', '虚拟支气管镜'], note: '气道异物、狭窄评估' },
  { id: 'CH-08', name: '胸膜', englishName: 'Pleura', system: '胸部', modality: ['CT', 'US', 'DR'], bodyPart: '胸部', laterality: true, standardViews: ['CT增强', '超声定位'], note: '胸腔积液、胸膜增厚、间皮瘤' },
  { id: 'CH-09', name: '纵隔', englishName: 'Mediastinum', system: '胸部', modality: ['CT', 'MR'], bodyPart: '胸部', laterality: false, standardViews: ['CT增强', 'MR T1/T2'], note: '纵隔分区（前/中/后纵隔）' },
  { id: 'CH-10', name: '胸腺', englishName: 'Thymus', system: '胸部', modality: ['CT', 'MR'], bodyPart: '胸部', laterality: false, standardViews: ['CT增强', 'MR'], note: '胸腺瘤、重症肌无力评估' },
  { id: 'CH-11', name: '心脏（结构）', englishName: 'Heart (Structure)', system: '胸部', modality: ['CT', 'MR', 'US'], bodyPart: '胸部', laterality: false, standardViews: ['CMR电影序列', '心脏CT', '超声切面'], note: 'CMR为金标准' },
  { id: 'CH-12', name: '冠状动脉', englishName: 'Coronary Arteries', system: '胸部', modality: ['CT', 'DSA', 'MR'], bodyPart: '胸部', laterality: false, standardViews: ['冠脉CTA（门控）', 'VR重建'], note: '心率控制<65bpm' },
  { id: 'CH-13', name: '主动脉（胸部）', englishName: 'Thoracic Aorta', system: '胸部', modality: ['CT', 'MR', 'US'], bodyPart: '胸部', laterality: false, standardViews: ['CTA', 'MRA'], note: '夹层、动脉瘤（急症）' },
  { id: 'CH-14', name: '肺动脉', englishName: 'Pulmonary Arteries', system: '胸部', modality: ['CT', 'MR'], bodyPart: '胸部', laterality: false, standardViews: ['CTPA', 'MRA'], note: '肺栓塞评估（急症）' },
  { id: 'CH-15', name: '肺门', englishName: 'Pulmonary Hila', system: '胸部', modality: ['CT', 'MR'], bodyPart: '胸部', laterality: true, standardViews: ['CT增强', '冠状位重建'], note: '淋巴结肿大评估' },
  { id: 'CH-16', name: '横膈', englishName: 'Diaphragm', system: '胸部', modality: ['CT', 'DR', 'US'], bodyPart: '胸部', laterality: false, standardViews: ['胸片正位', 'CT', '超声动态'], note: '膈麻痹、膈疝' },
  { id: 'CH-17', name: '食管', englishName: 'Esophagus', system: '胸部', modality: ['CT', 'MR', 'DR'], bodyPart: '胸部', laterality: false, standardViews: ['CT增强', '上消化道造影'], note: '食管癌分期' },
  { id: 'CH-18', name: '胸壁（肋骨/胸骨）', englishName: 'Chest Wall (Ribs/Sternum)', system: '胸部', modality: ['CT', 'DR'], bodyPart: '胸部', laterality: true, standardViews: ['CT骨窗', '肋骨三维重建'], note: '肋骨骨折、胸壁肿瘤' },
  { id: 'CH-19', name: '锁骨上淋巴结', englishName: 'Supraclavicular Nodes', system: '胸部', modality: ['US', 'CT'], bodyPart: '颈部/胸部', laterality: true, standardViews: ['超声', 'CT增强'], note: '肿瘤分期重要站点' },
  { id: 'CH-20', name: '胸导管', englishName: 'Thoracic Duct', system: '胸部', modality: ['MR'], bodyPart: '胸部', laterality: false, standardViews: ['3D重T2（MR淋巴成像）'], note: '乳糜胸评估' },
];

// ============================================================
// 腹部
// ============================================================

const ABDOMEN_PARTS: AnatomyPart[] = [
  { id: 'AB-01', name: '肝脏', englishName: 'Liver', system: '腹部', modality: ['CT', 'MR', 'US', 'PET-CT'], bodyPart: '腹部', laterality: false, standardViews: ['平扫+多期增强', 'MR T1同反相位', 'DWI'], note: 'LI-RADS评估需四期增强' },
  { id: 'AB-02', name: '肝右叶', englishName: 'Right Lobe of Liver', system: '腹部', modality: ['CT', 'MR', 'US'], bodyPart: '腹部', laterality: false, standardViews: ['多期增强', '超声'], note: '' },
  { id: 'AB-03', name: '肝左叶', englishName: 'Left Lobe of Liver', system: '腹部', modality: ['CT', 'MR', 'US'], bodyPart: '腹部', laterality: false, standardViews: ['多期增强', '超声'], note: '' },
  { id: 'AB-04', name: '胆囊', englishName: 'Gallbladder', system: '腹部', modality: ['US', 'CT', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['超声（空腹）', 'CT平扫', 'MRCP'], note: '超声首选' },
  { id: 'AB-05', name: '胆管系统', englishName: 'Biliary System', system: '腹部', modality: ['MR', 'CT', 'US'], bodyPart: '腹部', laterality: false, standardViews: ['MRCP', 'CT增强（胆道排泄期）', '超声'], note: '梗阻性黄疸评估' },
  { id: 'AB-06', name: '胰腺', englishName: 'Pancreas', system: '腹部', modality: ['CT', 'MR', 'US'], bodyPart: '腹部', laterality: false, standardViews: ['胰腺双期增强（动脉+门脉）', 'MRCP', 'DWI'], note: '胰腺癌需薄层双期' },
  { id: 'AB-07', name: '脾脏', englishName: 'Spleen', system: '腹部', modality: ['CT', 'MR', 'US'], bodyPart: '腹部', laterality: false, standardViews: ['CT增强', '超声'], note: '脾破裂（外伤急症）' },
  { id: 'AB-08', name: '左肾', englishName: 'Left Kidney', system: '腹部', modality: ['CT', 'MR', 'US'], bodyPart: '腹部', laterality: true, standardViews: ['CT平扫+增强（皮质/髓质/排泄期）', '超声'], note: '' },
  { id: 'AB-09', name: '右肾', englishName: 'Right Kidney', system: '腹部', modality: ['CT', 'MR', 'US'], bodyPart: '腹部', laterality: true, standardViews: ['CT平扫+增强', '超声'], note: '' },
  { id: 'AB-10', name: '肾上腺', englishName: 'Adrenal Glands', system: '腹部', modality: ['CT', 'MR'], bodyPart: '腹部', laterality: true, standardViews: ['CT薄层平扫', '化学位移成像'], note: '腺瘤（含脂）诊断用化学位移' },
  { id: 'AB-11', name: '输尿管', englishName: 'Ureters', system: '腹部', modality: ['CT', 'MR'], bodyPart: '腹部', laterality: true, standardViews: ['CTU排泄期', '冠状位重建'], note: '结石、肿瘤' },
  { id: 'AB-12', name: '胃', englishName: 'Stomach', system: '腹部', modality: ['CT', 'DR', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['CT增强（水充盈）', '上消化道造影'], note: '胃癌分期需充盈后增强' },
  { id: 'AB-13', name: '十二指肠', englishName: 'Duodenum', system: '腹部', modality: ['CT', 'DR', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['CT增强', '上消化道造影'], note: '' },
  { id: 'AB-14', name: '空肠', englishName: 'Jejunum', system: '腹部', modality: ['CT', 'MR', 'DR'], bodyPart: '腹部', laterality: false, standardViews: ['CT小肠造影', '小肠钡餐'], note: '' },
  { id: 'AB-15', name: '回肠', englishName: 'Ileum', system: '腹部', modality: ['CT', 'MR', 'DR'], bodyPart: '腹部', laterality: false, standardViews: ['CT小肠造影', '小肠钡餐'], note: '克罗恩病好发' },
  { id: 'AB-16', name: '结肠（升/横/降/乙状）', englishName: 'Colon', system: '腹部', modality: ['CT', 'DR', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['CT结肠成像（灌气）', '钡剂灌肠', 'CT增强'], note: '结肠癌筛查' },
  { id: 'AB-17', name: '直肠', englishName: 'Rectum', system: '腹部', modality: ['MR', 'CT'], bodyPart: '盆部', laterality: false, standardViews: ['直肠高分辨T2（斜轴位）', 'DWI', 'CT增强'], note: '直肠癌T分期（EMVI评估）' },
  { id: 'AB-18', name: '阑尾', englishName: 'Appendix', system: '腹部', modality: ['CT', 'US', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['CT增强（右下腹）', '超声加压'], note: '急性阑尾炎（急症）' },
  { id: 'AB-19', name: '肠系膜', englishName: 'Mesentery', system: '腹部', modality: ['CT', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['CT增强', 'CTA'], note: '肠系膜缺血、扭转' },
  { id: 'AB-20', name: '腹膜', englishName: 'Peritoneum', system: '腹部', modality: ['CT', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['CT增强', 'MR'], note: '腹膜转移、腹水' },
  { id: 'AB-21', name: '腹膜后间隙', englishName: 'Retroperitoneum', system: '腹部', modality: ['CT', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['CT增强', 'MR'], note: '腹膜后肿瘤（脂肪肉瘤）' },
  { id: 'AB-22', name: '腹主动脉', englishName: 'Abdominal Aorta', system: '腹部', modality: ['CT', 'MR', 'US'], bodyPart: '腹部', laterality: false, standardViews: ['CTA', '超声'], note: 'AAA>50mm手术指征' },
  { id: 'AB-23', name: '门静脉', englishName: 'Portal Vein', system: '腹部', modality: ['CT', 'MR', 'US'], bodyPart: '腹部', laterality: false, standardViews: ['CT门脉期', '门静脉超声'], note: '门脉高压、癌栓' },
  { id: 'AB-24', name: '腹腔动脉', englishName: 'Celiac Trunk', system: '腹部', modality: ['CT', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['CTA'], note: '' },
  { id: 'AB-25', name: '腹壁', englishName: 'Abdominal Wall', system: '腹部', modality: ['CT', 'US', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['CT增强', '超声'], note: '切口疝、腹壁脓肿' },
];

// ============================================================
// 盆部
// ============================================================

const PELVIS_PARTS: AnatomyPart[] = [
  { id: 'PV-01', name: '膀胱', englishName: 'Bladder', system: '盆部', modality: ['CT', 'MR', 'US'], bodyPart: '盆部', laterality: false, standardViews: ['CT增强（充盈）', 'MR T2高分辨', '超声'], note: '膀胱肿瘤分期（MR）' },
  { id: 'PV-02', name: '前列腺', englishName: 'Prostate', system: '盆部', modality: ['MR', 'CT', 'US'], bodyPart: '盆部', laterality: false, standardViews: ['mpMRI（T2/DWI/DCE）', 'TRUS'], note: 'PI-RADS v2.1标准序列' },
  { id: 'PV-03', name: '精囊腺', englishName: 'Seminal Vesicles', system: '盆部', modality: ['MR', 'CT'], bodyPart: '盆部', laterality: true, standardViews: ['MR T2矢状位', 'CT增强'], note: '前列腺癌侵犯评估' },
  { id: 'PV-04', name: '睾丸', englishName: 'Testes', system: '盆部', modality: ['US', 'MR'], bodyPart: '盆部', laterality: true, standardViews: ['高频超声', 'MR'], note: '超声首选；隐睾需MR' },
  { id: 'PV-05', name: '子宫', englishName: 'Uterus', system: '盆部', modality: ['MR', 'US', 'CT'], bodyPart: '盆部', laterality: false, standardViews: ['MR T2高分辨（矢状位）', 'DWI', '腔内超声'], note: '子宫内膜癌分期（MR）' },
  { id: 'PV-06', name: '宫颈', englishName: 'Cervix', system: '盆部', modality: ['MR', 'CT'], bodyPart: '盆部', laterality: false, standardViews: ['MR T2矢状位', 'DWI'], note: '宫颈癌FIGO分期' },
  { id: 'PV-07', name: '卵巢', englishName: 'Ovaries', system: '盆部', modality: ['US', 'MR', 'CT'], bodyPart: '盆部', laterality: true, standardViews: ['腔内超声', 'MR T2', 'DWI'], note: '附件包块定性' },
  { id: 'PV-08', name: '阴道', englishName: 'Vagina', system: '盆部', modality: ['MR', 'CT'], bodyPart: '盆部', laterality: false, standardViews: ['MR T2'], note: '' },
  { id: 'PV-09', name: '盆腔淋巴结', englishName: 'Pelvic Lymph Nodes', system: '盆部', modality: ['CT', 'MR'], bodyPart: '盆部', laterality: false, standardViews: ['CT增强', 'MR DWI'], note: '盆腔肿瘤转移评估' },
  { id: 'PV-10', name: '盆腔（直肠）', englishName: 'Pelvic Rectum', system: '盆部', modality: ['MR', 'CT'], bodyPart: '盆部', laterality: false, standardViews: ['直肠MR高分辨', 'CT增强'], note: '直肠癌CRM评估' },
  { id: 'PV-11', name: '骨盆骨', englishName: 'Pelvic Bones', system: '盆部', modality: ['CT', 'DR', 'MR'], bodyPart: '盆部', laterality: false, standardViews: ['骨盆正位X线', 'CT骨窗', 'MR'], note: '骨盆骨折（Tile分型）' },
  { id: 'PV-12', name: '髋关节', englishName: 'Hip Joint', system: '盆部', modality: ['DR', 'CT', 'MR'], bodyPart: '盆部', laterality: true, standardViews: ['正位X线', 'CT', 'MR'], note: '股骨头坏死MR首选' },
  { id: 'PV-13', name: '骶髂关节', englishName: 'Sacroiliac Joint', system: '盆部', modality: ['MR', 'CT', 'DR'], bodyPart: '盆部', laterality: true, standardViews: ['斜冠状位MR', 'CT斜轴位'], note: '强直性脊柱炎评估' },
  { id: 'PV-14', name: '会阴部', englishName: 'Perineum', system: '盆部', modality: ['MR', 'CT'], bodyPart: '盆部', laterality: false, standardViews: ['MR T2', 'CT增强'], note: '会阴瘘管、脓肿' },
  { id: 'PV-15', name: '盆底肌', englishName: 'Pelvic Floor', system: '盆部', modality: ['MR', 'US'], bodyPart: '盆部', laterality: false, standardViews: ['动态MR（静息/用力/排空）', '盆底超声'], note: '盆底功能障碍评估' },
  { id: 'PV-16', name: '尿道', englishName: 'Urethra', system: '盆部', modality: ['MR', 'DR'], bodyPart: '盆部', laterality: false, standardViews: ['尿道造影', 'MR'], note: '尿道损伤、瘘' },
  { id: 'PV-17', name: '肛管', englishName: 'Anal Canal', system: '盆部', modality: ['MR', 'US'], bodyPart: '盆部', laterality: false, standardViews: ['MR高分辨（轴位）', '肛内超声'], note: '肛瘘Park分型' },
];

// ============================================================
// 骨骼
// ============================================================

const BONE_PARTS: AnatomyPart[] = [
  { id: 'BO-01', name: '颅骨', englishName: 'Skull', system: '骨骼', modality: ['CT', 'DR'], bodyPart: '头', laterality: false, standardViews: ['正侧位X线', 'CT骨窗'], note: '' },
  { id: 'BO-02', name: '肩关节', englishName: 'Shoulder Joint', system: '骨骼', modality: ['MR', 'DR', 'CT'], bodyPart: '肩', laterality: true, standardViews: ['正位X线', 'MR肩袖序列', 'CT'], note: '肩袖损伤MR首选' },
  { id: 'BO-03', name: '肱骨', englishName: 'Humerus', system: '骨骼', modality: ['DR', 'CT'], bodyPart: '上肢', laterality: true, standardViews: ['正侧位X线'], note: '' },
  { id: 'BO-04', name: '肘关节', englishName: 'Elbow Joint', system: '骨骼', modality: ['DR', 'CT', 'MR'], bodyPart: '上肢', laterality: true, standardViews: ['正侧位X线', 'MR'], note: '儿童肱骨小头骨骺（投照需双侧）' },
  { id: 'BO-05', name: '前臂（桡尺骨）', englishName: 'Forearm (Radius/Ulna)', system: '骨骼', modality: ['DR', 'CT'], bodyPart: '上肢', laterality: true, standardViews: ['正侧位X线'], note: '' },
  { id: 'BO-06', name: '腕关节', englishName: 'Wrist Joint', system: '骨骼', modality: ['DR', 'CT', 'MR'], bodyPart: '上肢', laterality: true, standardViews: ['正侧位X线', '舟骨位', 'MR（三角纤维软骨）'], note: '腕舟骨骨折需舟骨位' },
  { id: 'BO-07', name: '手', englishName: 'Hand', system: '骨骼', modality: ['DR', 'CT'], bodyPart: '上肢', laterality: true, standardViews: ['正斜位X线'], note: '类风湿早期病变评估' },
  { id: 'BO-08', name: '股骨', englishName: 'Femur', system: '骨骼', modality: ['DR', 'CT'], bodyPart: '下肢', laterality: true, standardViews: ['正侧位X线'], note: '' },
  { id: 'BO-09', name: '膝关节', englishName: 'Knee Joint', system: '骨骼', modality: ['MR', 'DR', 'CT'], bodyPart: '下肢', laterality: true, standardViews: ['正侧位X线（负重）', 'MR（半月板/韧带）', '髌骨轴位'], note: '半月板损伤MR首选' },
  { id: 'BO-10', name: '胫腓骨', englishName: 'Tibia/Fibula', system: '骨骼', modality: ['DR', 'CT'], bodyPart: '下肢', laterality: true, standardViews: ['正侧位X线'], note: '' },
  { id: 'BO-11', name: '踝关节', englishName: 'Ankle Joint', system: '骨骼', modality: ['DR', 'CT', 'MR'], bodyPart: '下肢', laterality: true, standardViews: ['正侧位X线', 'MR（韧带）'], note: '踝扭伤韧带评估' },
  { id: 'BO-12', name: '足', englishName: 'Foot', system: '骨骼', modality: ['DR', 'CT', 'MR'], bodyPart: '下肢', laterality: true, standardViews: ['正斜位X线', '侧位'], note: 'Lisfranc损伤' },
  { id: 'BO-13', name: '锁骨', englishName: 'Clavicle', system: '骨骼', modality: ['DR', 'CT'], bodyPart: '肩', laterality: true, standardViews: ['正位X线'], note: '' },
  { id: 'BO-14', name: '肋骨', englishName: 'Ribs', system: '骨骼', modality: ['CT', 'DR'], bodyPart: '胸部', laterality: true, standardViews: ['CT三维重建', 'X线（肋骨切线位）'], note: '肋骨骨折CT灵敏度高' },
  { id: 'BO-15', name: '胸骨', englishName: 'Sternum', system: '骨骼', modality: ['CT', 'DR'], bodyPart: '胸部', laterality: false, standardViews: ['CT矢状位重建', '胸骨斜位X线'], note: '' },
  { id: 'BO-16', name: '肩胛骨', englishName: 'Scapula', system: '骨骼', modality: ['CT', 'DR'], bodyPart: '肩', laterality: true, standardViews: ['正位X线', 'CT三维重建'], note: '肩胛骨骨折' },
  { id: 'BO-17', name: '骨盆（骨）', englishName: 'Pelvis (Bony)', system: '骨骼', modality: ['CT', 'DR'], bodyPart: '盆部', laterality: false, standardViews: ['骨盆正位', 'CT骨窗'], note: '' },
  { id: 'BO-18', name: '下颌骨', englishName: 'Mandible', system: '骨骼', modality: ['CT', 'DR'], bodyPart: '头', laterality: false, standardViews: ['曲面断层', 'CT三维'], note: '下颌骨折、肿瘤' },
  { id: 'BO-19', name: '颧骨弓', englishName: 'Zygomatic Arch', system: '骨骼', modality: ['CT', 'DR'], bodyPart: '头', laterality: true, standardViews: ['CT三维', '颅骨切线位'], note: '面中部骨折' },
  { id: 'BO-20', name: '髌骨', englishName: 'Patella', system: '骨骼', modality: ['DR', 'CT', 'MR'], bodyPart: '下肢', laterality: true, standardViews: ['轴位（髌股关节）', '正侧位'], note: '复发性髌骨脱位评估' },
];

// ============================================================
// 乳腺
// ============================================================

const BREAST_PARTS: AnatomyPart[] = [
  { id: 'BR-01', name: '右乳', englishName: 'Right Breast', system: '乳腺', modality: ['MG', 'US', 'MR'], bodyPart: '乳腺', laterality: true, standardViews: ['CC位', 'MLO位', '超声'], note: 'BI-RADS系统评估' },
  { id: 'BR-02', name: '左乳', englishName: 'Left Breast', system: '乳腺', modality: ['MG', 'US', 'MR'], bodyPart: '乳腺', laterality: true, standardViews: ['CC位', 'MLO位', '超声'], note: '' },
  { id: 'BR-03', name: '双乳（对比）', englishName: 'Bilateral Breasts', system: '乳腺', modality: ['MG', 'MR'], bodyPart: '乳腺', laterality: false, standardViews: ['双侧CC+MLO', 'MR动态增强'], note: '筛查及对比评估' },
  { id: 'BR-04', name: '乳腺外上象限', englishName: 'UOQ', system: '乳腺', modality: ['US', 'MG'], bodyPart: '乳腺', laterality: true, standardViews: ['超声', '加压放大投照'], note: '肿块好发部位' },
  { id: 'BR-05', name: '乳腺内上象限', englishName: 'UIQ', system: '乳腺', modality: ['US', 'MG'], bodyPart: '乳腺', laterality: true, standardViews: ['超声', 'MG'], note: '' },
  { id: 'BR-06', name: '乳腺外下象限', englishName: 'LOQ', system: '乳腺', modality: ['US', 'MG'], bodyPart: '乳腺', laterality: true, standardViews: ['超声', 'MG'], note: '' },
  { id: 'BR-07', name: '乳腺内下象限', englishName: 'LIQ', system: '乳腺', modality: ['US', 'MG'], bodyPart: '乳腺', laterality: true, standardViews: ['超声', 'MG'], note: '' },
  { id: 'BR-08', name: '乳晕区', englishName: 'Areolar Region', system: '乳腺', modality: ['US', 'MG', 'MR'], bodyPart: '乳腺', laterality: true, standardViews: ['超声', 'MG', 'MR'], note: '乳头溢液评估' },
  { id: 'BR-09', name: '腋尾部（腋窝）', englishName: 'Axillary Tail / Axilla', system: '乳腺', modality: ['US', 'MG', 'MR'], bodyPart: '乳腺', laterality: true, standardViews: ['MLO位（含腋尾）', '腋窝超声'], note: '淋巴结评估' },
  { id: 'BR-10', name: '乳腺假体', englishName: 'Breast Implants', system: '乳腺', modality: ['MR', 'US'], bodyPart: '乳腺', laterality: true, standardViews: ['MR（硅胶特异性序列）', '超声'], note: '假体破裂评估' },
];

// ============================================================
// 心血管
// ============================================================

const CARDIO_PARTS: AnatomyPart[] = [
  { id: 'CV-01', name: '心脏（整体）', englishName: 'Heart (Whole)', system: '心血管', modality: ['CT', 'MR', 'US'], bodyPart: '胸部', laterality: false, standardViews: ['CMR电影', '心脏CT', '超声切面'], note: 'CMR心功能金标准' },
  { id: 'CV-02', name: '左心室', englishName: 'Left Ventricle', system: '心血管', modality: ['CT', 'MR', 'US'], bodyPart: '胸部', laterality: false, standardViews: ['短轴电影序列', 'M型超声'], note: 'EF评估' },
  { id: 'CV-03', name: '右心室', englishName: 'Right Ventricle', system: '心血管', modality: ['MR', 'CT', 'US'], bodyPart: '胸部', laterality: false, standardViews: ['短轴电影', '四腔心'], note: '致心律失常性心肌病' },
  { id: 'CV-04', name: '左心房', englishName: 'Left Atrium', system: '心血管', modality: ['CT', 'MR', 'US'], bodyPart: '胸部', laterality: false, standardViews: ['CT（肺静脉）', 'MR'], note: '房颤消融术前CT' },
  { id: 'CV-05', name: '右心房', englishName: 'Right Atrium', system: '心血管', modality: ['CT', 'MR', 'US'], bodyPart: '胸部', laterality: false, standardViews: ['CT', 'MR'], note: '' },
  { id: 'CV-06', name: '心包', englishName: 'Pericardium', system: '心血管', modality: ['CT', 'MR', 'US'], bodyPart: '胸部', laterality: false, standardViews: ['CT增强', 'MR（黑血序列）'], note: '缩窄性心包炎' },
  { id: 'CV-07', name: '升主动脉', englishName: 'Ascending Aorta', system: '心血管', modality: ['CT', 'MR', 'US'], bodyPart: '胸部', laterality: false, standardViews: ['CTA', '超声'], note: '>50mm手术指征' },
  { id: 'CV-08', name: '主动脉弓', englishName: 'Aortic Arch', system: '心血管', modality: ['CT', 'MR'], bodyPart: '胸部', laterality: false, standardViews: ['CTA', 'MRA'], note: '变异（迷走锁骨下动脉）' },
  { id: 'CV-09', name: '降主动脉', englishName: 'Descending Aorta', system: '心血管', modality: ['CT', 'MR'], bodyPart: '胸部', laterality: false, standardViews: ['CTA'], note: '' },
  { id: 'CV-10', name: '髂动脉', englishName: 'Iliac Arteries', system: '心血管', modality: ['CT', 'MR', 'DSA'], bodyPart: '盆部', laterality: true, standardViews: ['CTA', 'DSA'], note: '下肢缺血评估' },
  { id: 'CV-11', name: '股动脉', englishName: 'Femoral Arteries', system: '心血管', modality: ['CT', 'US', 'DSA'], bodyPart: '下肢', laterality: true, standardViews: ['CTA', '超声'], note: '' },
  { id: 'CV-12', name: '腘动脉', englishName: 'Popliteal Artery', system: '心血管', modality: ['CT', 'US', 'DSA'], bodyPart: '下肢', laterality: true, standardViews: ['CTA', '超声'], note: '腘动脉瘤' },
  { id: 'CV-13', name: '腔静脉（上/下）', englishName: 'Vena Cava', system: '心血管', modality: ['CT', 'MR'], bodyPart: '腹部/胸部', laterality: false, standardViews: ['CT增强', 'MR'], note: 'IVC血栓、肿瘤侵犯' },
  { id: 'CV-14', name: '肺静脉', englishName: 'Pulmonary Veins', system: '心血管', modality: ['CT', 'MR'], bodyPart: '胸部', laterality: false, standardViews: ['CT三维重建'], note: '房颤消融术前' },
  { id: 'CV-15', name: '锁骨下/头臂动脉', englishName: 'Subclavian/Brachiocephalic', system: '心血管', modality: ['CT', 'US'], bodyPart: '颈部/胸部', laterality: true, standardViews: ['CTA', '超声'], note: '锁骨下动脉盗血' },
  { id: 'CV-16', name: '肾动脉', englishName: 'Renal Arteries', system: '心血管', modality: ['CT', 'MR', 'US'], bodyPart: '腹部', laterality: true, standardViews: ['CTA', '超声（肾动脉）'], note: '肾动脉狭窄（高血压）' },
  { id: 'CV-17', name: '肠系膜上动脉', englishName: 'SMA', system: '心血管', modality: ['CT', 'MR'], bodyPart: '腹部', laterality: false, standardViews: ['CTA'], note: '肠系膜缺血' },
  { id: 'CV-18', name: '外周静脉（下肢深静脉）', englishName: 'Lower Extremity Veins', system: '心血管', modality: ['US', 'CT', 'MR'], bodyPart: '下肢', laterality: true, standardViews: ['加压超声', 'MRV'], note: 'DVT评估（急症）' },
];

// ============================================================
// 汇总导出
// ============================================================

export const ANATOMY_ATLAS: AnatomyPart[] = [
  ...NEURO_PARTS,
  ...CHEST_PARTS,
  ...ABDOMEN_PARTS,
  ...PELVIS_PARTS,
  ...BONE_PARTS,
  ...BREAST_PARTS,
  ...CARDIO_PARTS,
];

/** 按系统获取解剖部位 */
export function getPartsBySystem(system: AnatomySystem): AnatomyPart[] {
  return ANATOMY_ATLAS.filter((p) => p.system === system);
}

/** 按名称/英文名检索 */
export function searchAnatomy(query: string): AnatomyPart[] {
  const q = query.trim().toLowerCase();
  if (!q) return ANATOMY_ATLAS;
  return ANATOMY_ATLAS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.englishName.toLowerCase().includes(q) ||
      p.bodyPart.toLowerCase().includes(q) ||
      p.system.toLowerCase().includes(q),
  );
}

/** 按ID获取 */
export function findAnatomyById(id: string): AnatomyPart | undefined {
  return ANATOMY_ATLAS.find((p) => p.id === id);
}

/** 按设备类型筛选（支持某部位的检查设备） */
export function filterByModality(modality: 'CT' | 'MR' | 'DR' | 'US' | 'MG'): AnatomyPart[] {
  return ANATOMY_ATLAS.filter((p) => p.modality.includes(modality));
}
