// ============================================================
// 解剖本体 - 8 大区域（regions）
// ============================================================

export type AnatomyRegion =
  | 'head' | 'neck' | 'chest' | 'abdomen'
  | 'pelvis' | 'spine' | 'limbs' | 'wholeBody';

export interface AnatomyRegionDef {
  code: AnatomyRegion;
  name: string;
  english: string;
  pinyin: string;
  description: string;
  modalities: string[];
  commonExamTypes: string[];
  subOrgans: string[];
  bodyParts: string[];
}

export const ANATOMY_REGIONS: Record<AnatomyRegion, AnatomyRegionDef> = {
  head: {
    code: 'head', name: '头颅', english: 'Head', pinyin: 'tl',
    description: '头部，包含颅骨、脑、眼眶、鼻窦、颞骨、唾液腺等',
    modalities: ['CT', 'MR', 'DR', 'DSA'],
    commonExamTypes: ['CT头颅平扫', 'CT头颅增强', 'MR头颅平扫', 'MR头颅增强', 'MR-DWI', 'MRA头颅', 'CTA头颅', 'CT灌注'],
    subOrgans: ['脑', '小脑', '脑干', '眼眶', '眼球', '视神经', '鼻窦', '颞骨', '内耳', '中耳', '颅骨', '垂体', '松果体', '唾液腺'],
    bodyParts: ['头颅', '脑', '眼眶', '鼻窦', '颞骨', '颈部'],
  },
  neck: {
    code: 'neck', name: '颈部', english: 'Neck', pinyin: 'jb',
    description: '颈部软组织、甲状腺、甲状旁腺、淋巴结、血管',
    modalities: ['CT', 'MR', 'US'],
    commonExamTypes: ['CT颈部平扫+增强', 'MR颈部平扫+增强', '甲状腺超声', '颈动脉超声', 'CTA颈部', 'MRA颈部', 'CT灌注'],
    subOrgans: ['甲状腺', '甲状旁腺', '喉', '咽', '食管颈段', '唾液腺', '颈动脉', '颈静脉', '颈椎', '颈部淋巴结'],
    bodyParts: ['颈部', '甲状腺', '唾液腺'],
  },
  chest: {
    code: 'chest', name: '胸部', english: 'Chest', pinyin: 'xb',
    description: '肺、心脏、纵隔、胸膜、胸壁、乳腺、膈肌',
    modalities: ['CT', 'MR', 'DR', 'MG'],
    commonExamTypes: ['CT胸部平扫', 'CT胸部高分辨', 'CT胸部增强', 'CTPA', 'CTA冠脉', 'MR心脏', 'DR胸片正侧位', 'MG', '乳腺MR', '肺结节LDCT'],
    subOrgans: ['左肺', '右肺', '上叶', '中叶', '下叶', '气管', '主支气管', '纵隔', '心脏', '左心室', '右心室', '左心房', '右心房', '心包', '胸膜', '胸壁', '肋骨', '胸骨', '膈肌', '乳腺', '腋窝淋巴结'],
    bodyParts: ['胸部', '心脏', '乳腺', '纵隔'],
  },
  abdomen: {
    code: 'abdomen', name: '腹部', english: 'Abdomen', pinyin: 'fb',
    description: '肝、胆、胰、脾、胃肠道、肾、肾上腺、腹膜后',
    modalities: ['CT', 'MR', 'US'],
    commonExamTypes: ['CT上腹部平扫+增强', 'CT全腹平扫+增强', 'MRCP', 'MR上腹部平扫+增强', 'MR-DWI', '腹部超声', '肝胆胰脾超声', '肾输尿管膀胱超声'],
    subOrgans: ['肝脏', '左肝', '右肝', '尾状叶', '胆囊', '胆总管', '肝内胆管', '胰腺', '胰头', '胰体', '胰尾', '脾', '胃', '十二指肠', '空肠', '回肠', '结肠', '直肠', '阑尾', '肾脏', '左肾', '右肾', '肾上腺', '腹膜后', '腹主动脉', '下腔静脉', '门静脉'],
    bodyParts: ['腹部', '肝脏', '胆胰', '脾', '肾'],
  },
  pelvis: {
    code: 'pelvis', name: '盆腔', english: 'Pelvis', pinyin: 'pq',
    description: '膀胱、前列腺、精囊、子宫、卵巢、直肠、髂血管',
    modalities: ['CT', 'MR', 'US'],
    commonExamTypes: ['CT盆腔增强', 'MR盆腔平扫+增强', 'MR直肠', 'MR前列腺', 'MR子宫附件', '经直肠超声', '经阴道超声', '膀胱超声', '子宫附件超声'],
    subOrgans: ['膀胱', '前列腺', '精囊', '子宫', '宫颈', '宫体', '卵巢', '输卵管', '直肠', '乙状结肠', '髂血管', '盆腔淋巴结'],
    bodyParts: ['盆腔', '前列腺', '子宫', '卵巢', '膀胱'],
  },
  spine: {
    code: 'spine', name: '脊柱', english: 'Spine', pinyin: 'jz',
    description: '颈椎、胸椎、腰椎、骶椎、椎间盘、脊髓',
    modalities: ['MR', 'CT', 'DR'],
    commonExamTypes: ['MR颈椎', 'MR胸椎', 'MR腰椎', 'CT颈椎', 'CT腰椎', 'DR脊柱正侧位', 'MR全脊柱'],
    subOrgans: ['颈椎', '胸椎', '腰椎', '骶椎', '尾椎', '椎间盘', '脊髓', '马尾', '神经根', '椎体', '椎弓根', '棘突'],
    bodyParts: ['脊柱', '颈椎', '胸椎', '腰椎'],
  },
  limbs: {
    code: 'limbs', name: '四肢', english: 'Limbs', pinyin: 'sz',
    description: '肩、上臂、肘、前臂、腕、手、髋、大腿、膝、小腿、踝、足',
    modalities: ['DR', 'CT', 'MR'],
    commonExamTypes: ['DR肩关节', 'DR肘关节', 'DR腕关节', 'DR髋关节', 'DR膝关节', 'DR踝关节', 'MR肩关节', 'MR肘关节', 'MR膝关节', 'MR踝关节', 'MR髋关节', 'CT骨三维重建'],
    subOrgans: ['肩关节', '肱骨', '肘关节', '尺骨', '桡骨', '腕关节', '手', '髋关节', '股骨', '股骨头', '膝关节', '髌骨', '胫骨', '腓骨', '踝关节', '足', '跟骨'],
    bodyParts: ['四肢', '上肢', '下肢', '关节'],
  },
  wholeBody: {
    code: 'wholeBody', name: '全身', english: 'Whole Body', pinyin: 'qs',
    description: '全身 PET-CT、MR 全身成像',
    modalities: ['PET-CT', 'MR', 'CT'],
    commonExamTypes: ['PET-CT 全身', 'MR全身DWI', 'CT全身'],
    subOrgans: ['全身', '骨', '淋巴结', '软组织'],
    bodyParts: ['全身', '骨', '淋巴结'],
  },
};

export const REGION_TOTAL = Object.keys(ANATOMY_REGIONS).length;
