import { Injectable } from '@nestjs/common'
import * as fs from 'node:fs'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'
import {
  type ImageFeatures,
  parseDicomPart10,
  extractFeatures,
  buildDemoFeatures,
  imageSimilarity,
  inferBodyPart,
} from './image-features'

export interface SimilarCaseCandidate {
  id: string
  reportId: string
  patientId: string
  gender: string
  age: number
  modality: string
  bodyPart: string
  studyDate: string
  findings: string
  impression: string
  conclusion: string
  snomedCodes: string[]
  keywords: string[]
  source: 'db' | 'demo'
  similarity: number
  textScore: number
  featureScore: number
  snomedScore: number
}

export interface SimilarCaseSearchInput {
  reportId?: string
  reportText?: string
  modality?: string
  bodyPart?: string
  limit?: number
}

export interface SimilarCaseFeedbackInput {
  reportId: string
  targetReportId: string
  useful: boolean
  comment?: string
}

export interface ImageSearchInput {
  seriesUID?: string
  studyUid?: string
  limit?: number
}

export interface ImageFeatureSummary {
  mean: number
  std: number
  skew: number
  kurtosis: number
  min: number
  max: number
  percentiles: number[]
  textureEnergy: number
  highDensityRatio: number
  lowDensityRatio: number
  histogram: number[]
}

export interface ImageSearchResult {
  seriesUid: string
  studyUid: string
  modality: string
  bodyPart: string
  instanceCount: number
  similarity: number
  featureScore: number
  matchScore: number
  featureSummary: ImageFeatureSummary
  source: 'real' | 'demo'
}

export interface ImageSeriesItem {
  seriesUid: string
  studyUid: string
  modality: string
  bodyPart: string
  instanceCount: number
  description: string
  source: 'real' | 'demo'
}

export interface HybridSearchInput {
  reportId?: string
  reportText?: string
  seriesUID?: string
  studyUid?: string
  limit?: number
}

export interface HybridSearchResult {
  id: string
  reportId: string
  seriesUid?: string
  studyUid: string
  modality: string
  bodyPart: string
  similarity: number
  textScore: number | null
  imageScore: number | null
  featureSummary: ImageFeatureSummary | null
  source: 'db' | 'demo' | 'real'
  impression?: string
  findings?: string
  keywords?: string[]
}

/**
 * 相似病例检索服务 — 对标 Siemens Similar Patient Search / Infinitt Enterprise Search
 * 确定性算法,无需外部向量库:
 *  a. 关键词/Jaccard 文本相似度 (临床发现词表 40+ 词)
 *  b. 检查特征匹配 (模态/部位/年龄区间/性别加权)
 *  c. SNOMED 编码匹配
 *  综合评分 = 0.5×文本 + 0.3×特征 + 0.2×SNOMED
 */
@Injectable()
export class SimilarCaseService {
  /** 临床发现关键词表 (中英双语,覆盖 常见放射征象/疾病) */
  private readonly keywordDict: ReadonlyArray<readonly [string, string]> = [
    ['结节', 'nodule'], ['钙化', 'calcification'], ['骨折', 'fracture'],
    ['梗死', 'infarct'], ['占位', 'mass'], ['肿块', 'mass'], ['肿瘤', 'tumor'],
    ['癌', 'cancer'], ['转移', 'metastasis'], ['出血', 'hemorrhage'],
    ['血肿', 'hematoma'], ['积液', 'effusion'], ['胸腔积液', 'pleural effusion'],
    ['腹水', 'ascites'], ['肺炎', 'pneumonia'], ['感染', 'infection'],
    ['炎症', 'inflammation'], ['增生', 'hyperplasia'], ['囊肿', 'cyst'],
    ['空洞', 'cavity'], ['肺气肿', 'emphysema'], ['纤维化', 'fibrosis'],
    ['磨玻璃', 'ground-glass'], ['浸润', 'infiltrate'], ['栓塞', 'embolism'],
    ['动脉瘤', 'aneurysm'], ['夹层', 'dissection'], ['狭窄', 'stenosis'],
    ['硬化', 'sclerosis'], ['水肿', 'edema'], ['缺血', 'ischemia'],
    ['脑萎缩', 'atrophy'], ['椎间盘突出', 'herniation'], ['椎管狭窄', 'spinal stenosis'],
    ['半月板撕裂', 'meniscus tear'], ['韧带损伤', 'ligament injury'],
    ['关节积液', 'joint effusion'], ['骨质疏松', 'osteoporosis'],
    ['结石', 'calculus'], ['肾积水', 'hydronephrosis'], ['胆结石', 'cholelithiasis'],
    ['子宫肌瘤', 'fibroid'], ['前列腺增生', 'prostatic hyperplasia'],
    ['淋巴结肿大', 'lymphadenopathy'], ['斑块', 'plaque'], ['肝硬化', 'cirrhosis'],
    ['脂肪肝', 'steatosis'], ['占位病变', 'space-occupying lesion'],
    ['胰腺炎', 'pancreatitis'], ['阑尾炎', 'appendicitis'], ['肠梗阻', 'bowel obstruction'],
    ['气胸', 'pneumothorax'], ['纵隔', 'mediastinal'], ['脑膜瘤', 'meningioma'],
    ['胶质瘤', 'glioma'], ['垂体瘤', 'pituitary adenoma'], ['听神经瘤', 'acoustic neuroma'],
    ['鼻窦炎', 'sinusitis'], ['中耳炎', 'otitis media'], ['白内障', 'cataract'],
    ['视网膜', 'retinal'], ['玻璃体', 'vitreous'], ['主动脉', 'aorta'],
    ['冠状动脉', 'coronary artery'], ['肾囊肿', 'renal cyst'],
    ['甲状腺结节', 'thyroid nodule'], ['乳腺结节', 'breast nodule'],
    ['肝占位', 'hepatic mass'], ['脑出血', 'cerebral hemorrhage'],
    ['骨转移', 'bone metastasis'], ['肺结节', 'pulmonary nodule'],
    ['肾结石', 'renal calculus'], ['输尿管结石', 'ureteral calculus'],
    ['胆囊结石', 'gallstone'], ['胆总管结石', 'choledocholithiasis'],
    ['炎性假瘤', 'inflammatory pseudotumor'], ['错构瘤', 'hamartoma'],
    ['血管瘤', 'hemangioma'], ['息肉', 'polyp'], ['溃疡', 'ulcer'],
    ['穿孔', 'perforation'], ['瘘', 'fistula'], ['脓肿', 'abscess'],
    ['囊性变', 'cystic degeneration'], ['强化', 'enhancement'],
    ['低密度', 'hypodensity'], ['高密度', 'hyperdensity'],
  ]

  /** 演示病例库 (真实放射术语,24 例) */
  private readonly demoCases: Array<Omit<SimilarCaseCandidate, 'similarity' | 'textScore' | 'featureScore' | 'snomedScore'>> = [
    {
      id: 'sc-demo-001', reportId: 'rpt-1001', patientId: 'P1001', gender: '女', age: 58,
      modality: 'CT', bodyPart: '胸部', studyDate: '2026-06-12',
      findings: '右肺上叶尖段见一不规则形软组织密度结节,大小约 18mm×15mm,边缘毛糙,可见分叶及短毛刺征,CT 值约 32HU。双肺纹理清晰,未见磨玻璃影。纵隔内未见肿大淋巴结。',
      impression: '右肺上叶占位性病变,考虑周围型肺癌可能,建议增强扫描及穿刺活检。',
      conclusion: '右肺上叶占位性病变 (肺癌待排)',
      snomedCodes: ['SNOMED:79678001'], keywords: ['结节', '占位', '肺癌'],
      source: 'demo',
    },
    {
      id: 'sc-demo-002', reportId: 'rpt-1002', patientId: 'P1002', gender: '女', age: 62,
      modality: 'CT', bodyPart: '胸部', studyDate: '2026-05-28',
      findings: '右肺上叶磨玻璃密度结节,大小约 8mm×6mm,边界清晰,内可见血管穿行。双肺散在钙化灶。',
      impression: '右肺上叶磨玻璃结节 (GGO),考虑早期肺腺癌可能,建议定期随访或手术切除。',
      conclusion: '右肺上叶磨玻璃结节 (早期肺癌待排)',
      snomedCodes: ['SNOMED:424132000'], keywords: ['结节', '磨玻璃'],
      source: 'demo',
    },
    {
      id: 'sc-demo-003', reportId: 'rpt-1003', patientId: 'P1003', gender: '男', age: 45,
      modality: 'CT', bodyPart: '胸部', studyDate: '2026-04-19',
      findings: '右肺下叶见圆形低密度影,壁薄光滑,大小约 25mm×22mm,内无分隔。双肺纹理增粗,右上肺见条索状高密度影。',
      impression: '右肺下叶肺大疱;右上肺陈旧性纤维化条索影。',
      conclusion: '肺大疱 (良性)',
      snomedCodes: ['SNOMED:361182007'], keywords: ['囊肿', '纤维化'],
      source: 'demo',
    },
    {
      id: 'sc-demo-004', reportId: 'rpt-1004', patientId: 'P1004', gender: '男', age: 71,
      modality: 'CT', bodyPart: '胸部', studyDate: '2026-03-02',
      findings: '右肺上叶纵隔旁见类圆形软组织肿块,大小约 4.5cm×3.8cm,边缘光整,增强后轻度强化。胸廓入口处气管轻度受压。',
      impression: '纵隔占位性病变,考虑胸腺瘤可能,建议手术切除并病理检查。',
      conclusion: '纵隔占位 (胸腺瘤可能)',
      snomedCodes: ['SNOMED:415550006'], keywords: ['占位', '肿块', '纵隔'],
      source: 'demo',
    },
    {
      id: 'sc-demo-005', reportId: 'rpt-1005', patientId: 'P1005', gender: '女', age: 33,
      modality: 'DX', bodyPart: '胸部', studyDate: '2026-05-10',
      findings: '双肺纹理增多,右下肺野见片状高密度影,边缘模糊,肋膈角变钝。心影大小正常。',
      impression: '右下肺炎症,右侧少量胸腔积液,建议抗感染治疗后复查。',
      conclusion: '右下肺炎症伴少量胸腔积液',
      snomedCodes: ['SNOMED:233604007'], keywords: ['肺炎', '积液', '胸腔积液'],
      source: 'demo',
    },
    {
      id: 'sc-demo-006', reportId: 'rpt-1006', patientId: 'P1006', gender: '男', age: 29,
      modality: 'DX', bodyPart: '胸部', studyDate: '2026-06-01',
      findings: '右肺野外带见条状无肺纹理透亮区,肺组织压缩约 30%,右侧肋膈角变钝。',
      impression: '右侧自发性气胸 (压缩约 30%),建议胸腔闭式引流。',
      conclusion: '右侧自发性气胸',
      snomedCodes: ['SNOMED:361181000'], keywords: ['气胸'],
      source: 'demo',
    },
    {
      id: 'sc-demo-007', reportId: 'rpt-1007', patientId: 'P1007', gender: '女', age: 50,
      modality: 'CT', bodyPart: '颅脑', studyDate: '2026-04-25',
      findings: '左侧基底节区见低密度梗死灶,大小约 2.5cm×2.0cm,边界清楚。双侧侧脑室对称,中线结构居中。',
      impression: '左侧基底节区腔隙性脑梗死,建议控制血压及抗血小板治疗。',
      conclusion: '左侧基底节区脑梗死',
      snomedCodes: ['SNOMED:230690007'], keywords: ['梗死', '缺血'],
      source: 'demo',
    },
    {
      id: 'sc-demo-008', reportId: 'rpt-1008', patientId: 'P1008', gender: '男', age: 67,
      modality: 'CT', bodyPart: '颅脑', studyDate: '2026-05-16',
      findings: '右侧丘脑及基底节区见大片高密度影,大小约 5cm×4cm,周围可见低密度水肿带,侧脑室受压变窄,中线结构左移约 8mm。',
      impression: '右侧基底节区脑出血 (血肿形成),伴脑水肿及占位效应,建议神经外科会诊。',
      conclusion: '右侧基底节区脑出血',
      snomedCodes: ['SNOMED:274100004'], keywords: ['出血', '血肿', '水肿', '占位'],
      source: 'demo',
    },
    {
      id: 'sc-demo-009', reportId: 'rpt-1009', patientId: 'P1009', gender: '女', age: 55,
      modality: 'MR', bodyPart: '颅脑', studyDate: '2026-03-30',
      findings: '右额叶见类圆形囊实性占位,大小约 3.2cm×2.8cm,T1WI 低信号,T2WI 高信号,增强后实性部分明显强化,周围可见轻度水肿。',
      impression: '右额叶占位性病变,考虑胶质瘤可能,建议手术活检明确病理。',
      conclusion: '右额叶占位 (胶质瘤可能)',
      snomedCodes: ['SNOMED:115655009'], keywords: ['占位', '肿块', '水肿', '胶质瘤'],
      source: 'demo',
    },
    {
      id: 'sc-demo-010', reportId: 'rpt-1010', patientId: 'P1010', gender: '男', age: 48,
      modality: 'CT', bodyPart: '腹部', studyDate: '2026-04-08',
      findings: '肝右叶见类圆形低密度占位,大小约 6cm×5cm,边界不清,增强后动脉期明显强化,门脉期及延迟期强化减退 (快进快出)。',
      impression: '肝右叶占位性病变,考虑肝细胞癌可能,建议进一步 AFP 检测及增强 MRI。',
      conclusion: '肝右叶占位 (肝细胞癌可能)',
      snomedCodes: ['SNOMED:93870000'], keywords: ['占位', '肝占位', '癌'],
      source: 'demo',
    },
    {
      id: 'sc-demo-011', reportId: 'rpt-1011', patientId: 'P1011', gender: '男', age: 52,
      modality: 'CT', bodyPart: '腹部', studyDate: '2026-05-22',
      findings: '胆囊内见多发圆形高密度影,最大约 1.2cm,壁不厚,胆总管未见扩张。肝实质密度均匀。',
      impression: '胆囊结石 (多发),建议随访观察,如反复发作可行胆囊切除术。',
      conclusion: '胆囊结石 (多发)',
      snomedCodes: ['SNOMED:51027005'], keywords: ['结石', '胆囊结石', '胆结石'],
      source: 'demo',
    },
    {
      id: 'sc-demo-012', reportId: 'rpt-1012', patientId: 'P1012', gender: '女', age: 38,
      modality: 'DX', bodyPart: '腹部', studyDate: '2026-06-09',
      findings: '左侧输尿管中段见约 0.9cm 高密度结石影,其上输尿管扩张,左肾盂积水。右肾区未见结石。',
      impression: '左输尿管结石伴左肾积水,建议碎石治疗。',
      conclusion: '左侧输尿管结石伴肾积水',
      snomedCodes: ['SNOMED:95570007'], keywords: ['结石', '肾积水', '输尿管结石'],
      source: 'demo',
    },
    {
      id: 'sc-demo-013', reportId: 'rpt-1013', patientId: 'P1013', gender: '男', age: 60,
      modality: 'CT', bodyPart: '脊柱', studyDate: '2026-03-15',
      findings: '腰4/5椎间盘向后突出,硬膜囊受压,腰5/骶1椎间盘膨出,相应椎管狭窄。腰2椎体前缘见骨赘形成。',
      impression: '腰椎间盘突出伴椎管狭窄,建议保守治疗,如症状加重可考虑手术。',
      conclusion: '腰4/5椎间盘突出,腰椎管狭窄',
      snomedCodes: ['SNOMED:23077000'], keywords: ['椎间盘突出', '椎管狭窄', '增生'],
      source: 'demo',
    },
    {
      id: 'sc-demo-014', reportId: 'rpt-1014', patientId: 'P1014', gender: '男', age: 35,
      modality: 'MR', bodyPart: '膝关节', studyDate: '2026-05-03',
      findings: '右膝内侧半月板后角见线状高信号影,达关节面,呈桶柄状撕裂。前交叉韧带信号未见异常,关节腔内可见少量积液。',
      impression: '右膝内侧半月板桶柄状撕裂伴少量关节积液,建议关节镜治疗。',
      conclusion: '右膝内侧半月板撕裂',
      snomedCodes: ['SNOMED:294596001'], keywords: ['半月板撕裂', '关节积液', '积液', '韧带损伤'],
      source: 'demo',
    },
    {
      id: 'sc-demo-015', reportId: 'rpt-1015', patientId: 'P1015', gender: '女', age: 63,
      modality: 'DX', bodyPart: '上肢', studyDate: '2026-04-11',
      findings: '右桡骨远端见骨质连续性中断,断端轻度移位,未见明显粉碎。余诸骨未见明确骨折征象。',
      impression: '右桡骨远端骨折 (Colles 骨折),建议石膏固定后复查。',
      conclusion: '右桡骨远端骨折',
      snomedCodes: ['SNOMED:125605004'], keywords: ['骨折'],
      source: 'demo',
    },
    {
      id: 'sc-demo-016', reportId: 'rpt-1016', patientId: 'P1016', gender: '女', age: 68,
      modality: 'DX', bodyPart: '脊柱', studyDate: '2026-05-30',
      findings: '胸12椎体呈楔形变扁,骨密度普遍减低,多个椎体边缘见骨赘形成。',
      impression: '胸12椎体压缩性骨折 (骨质疏松性),建议卧床休息及抗骨质疏松治疗。',
      conclusion: '胸12椎体压缩性骨折 (骨质疏松)',
      snomedCodes: ['SNOMED:64840009'], keywords: ['骨折', '骨质疏松'],
      source: 'demo',
    },
    {
      id: 'sc-demo-017', reportId: 'rpt-1017', patientId: 'P1017', gender: '女', age: 47,
      modality: 'MG', bodyPart: '乳腺', studyDate: '2026-04-02',
      findings: '右乳外上象限见一高密度结节影,大小约 1.5cm×1.2cm,边界欠清,可见细小钙化灶。左乳未见明确肿块。',
      impression: '右乳占位性病变伴钙化 (BI-RADS 4B),建议穿刺活检。',
      conclusion: '右乳腺结节 (BI-RADS 4B,需活检)',
      snomedCodes: ['SNOMED:254837009'], keywords: ['结节', '乳腺结节', '占位', '钙化'],
      source: 'demo',
    },
    {
      id: 'sc-demo-018', reportId: 'rpt-1018', patientId: 'P1018', gender: '男', age: 56,
      modality: 'CT', bodyPart: '胸部', studyDate: '2026-03-20',
      findings: '主动脉弓降部内膜撕裂,真假双腔,真腔受压变窄,假腔累及至降主动脉中段,左侧胸腔见少量积液。',
      impression: 'Stanford B 型主动脉夹层,建议急诊介入腔内修复术。',
      conclusion: '主动脉夹层 (Stanford B 型)',
      snomedCodes: ['SNOMED:52767005'], keywords: ['夹层', '主动脉', '积液'],
      source: 'demo',
    },
    {
      id: 'sc-demo-019', reportId: 'rpt-1019', patientId: 'P1019', gender: '男', age: 54,
      modality: 'CT', bodyPart: '胸部', studyDate: '2026-05-07',
      findings: '左前降支近段见混合性斑块,管腔狭窄约 50%;右冠状动脉中段见钙化性斑块,管腔狭窄约 30%。',
      impression: '冠状动脉粥样硬化伴多支斑块形成,建议控制危险因素并药物干预。',
      conclusion: '冠状动脉粥样硬化斑块',
      snomedCodes: ['SNOMED:53741008'], keywords: ['斑块', '钙化', '狭窄', '冠状动脉'],
      source: 'demo',
    },
    {
      id: 'sc-demo-020', reportId: 'rpt-1020', patientId: 'P1020', gender: '男', age: 26,
      modality: 'US', bodyPart: '腹部', studyDate: '2026-04-15',
      findings: '右下腹见一扩张的阑尾,直径约 11mm,壁增厚水肿,周围见少量积液,可见粪石影。',
      impression: '急性阑尾炎伴周围炎性渗出,建议手术治疗。',
      conclusion: '急性阑尾炎',
      snomedCodes: ['SNOMED:74400008'], keywords: ['阑尾炎', '炎症', '水肿', '积液'],
      source: 'demo',
    },
    {
      id: 'sc-demo-021', reportId: 'rpt-1021', patientId: 'P1021', gender: '女', age: 42,
      modality: 'US', bodyPart: '甲状腺', studyDate: '2026-06-06',
      findings: '甲状腺右叶见低回声结节,大小约 1.2cm×0.9cm,边界尚清,内见多发细小强回声 (微钙化),TI-RADS 4A 类。',
      impression: '甲状腺右叶结节伴微钙化 (TI-RADS 4A),建议细针穿刺活检。',
      conclusion: '甲状腺结节 (TI-RADS 4A)',
      snomedCodes: ['SNOMED:450894009'], keywords: ['结节', '甲状腺结节', '钙化'],
      source: 'demo',
    },
    {
      id: 'sc-demo-022', reportId: 'rpt-1022', patientId: 'P1022', gender: '男', age: 65,
      modality: 'MR', bodyPart: '盆腔', studyDate: '2026-03-27',
      findings: '前列腺体积增大,大小约 5.2cm×4.6cm×4.0cm,突入膀胱,外周带信号正常,未见明确结节。',
      impression: '前列腺增生,建议 PSA 检测随访。',
      conclusion: '前列腺增生',
      snomedCodes: ['SNOMED:266569009'], keywords: ['增生', '前列腺增生'],
      source: 'demo',
    },
    {
      id: 'sc-demo-023', reportId: 'rpt-1023', patientId: 'P1023', gender: '男', age: 59,
      modality: 'CT', bodyPart: '胸部', studyDate: '2026-02-18',
      findings: '右肺上叶见分叶状肿块伴空洞形成,大小约 5cm×4cm,洞壁厚薄不均,右肺门及纵隔见多发肿大淋巴结。',
      impression: '右肺上叶肿块伴空洞,考虑肺癌伴肺门纵隔淋巴结转移,建议活检分期。',
      conclusion: '右肺上叶占位 (肺癌伴淋巴结转移)',
      snomedCodes: ['SNOMED:93880001'], keywords: ['肿块', '占位', '空洞', '转移', '淋巴结肿大', '癌'],
      source: 'demo',
    },
    {
      id: 'sc-demo-024', reportId: 'rpt-1024', patientId: 'P1024', gender: '女', age: 70,
      modality: 'DX', bodyPart: '脊柱', studyDate: '2026-05-19',
      findings: '胸椎及腰椎多发椎体见混杂密度灶,腰3椎体压缩性变扁,骨盆诸骨见多发类圆形低密度灶。',
      impression: '多发椎体及骨盆骨质破坏,考虑骨转移瘤可能,建议进一步检查明确原发灶。',
      conclusion: '多发骨转移瘤 (可疑)',
      snomedCodes: ['SNOMED:286911005'], keywords: ['转移', '骨转移', '骨折', '骨质疏松'],
      source: 'demo',
    },
  ]

  /** 内存反馈存储 (DB 不可用时回退) */
  private readonly memoryFeedback: SimilarCaseFeedbackInput[] = []

  /** 影像特征缓存 (seriesUID → features; 内存 Map, 无 DB 回退) */
  private readonly imageFeatureCache = new Map<string, ImageFeatures>()

  /** demo 影像特征库 (确定性生成, source: 'demo') */
  private demoImageFeatures: ImageFeatures[] | null = null

  constructor(private readonly prisma: PrismaService | null = null) {}

  /* ---------------- 关键词提取 ---------------- */

  private normalize(s: string): string {
    return (s ?? '').toLowerCase().trim()
  }

  /** 从报告文本提取临床关键词 (词表匹配,确定性) */
  extractKeywords(text: string): string[] {
    const t = this.normalize(text)
    if (!t) return []
    const found = new Set<string>()
    for (const [zh, en] of this.keywordDict) {
      if (t.includes(zh)) found.add(zh)
      if (t.includes(en)) found.add(zh)
    }
    return [...found]
  }

  /** Jaccard 相似度 (关键词集合) */
  private jaccard(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0
    const sa = new Set(a)
    const sb = new Set(b)
    let inter = 0
    for (const k of sa) if (sb.has(k)) inter++
    const union = sa.size + sb.size - inter
    return union === 0 ? 0 : inter / union
  }

  /** SNOMED 编码匹配 (集合 Jaccard;无编码时中性 0.5) */
  private snomedScore(a: string[], b: string[]): number {
    const clean = (arr: string[]) => [...new Set((arr ?? []).map((c) => this.normalize(c)).filter(Boolean))]
    const sa = clean(a)
    const sb = clean(b)
    if (sa.length === 0 && sb.length === 0) return 0.5
    if (sa.length === 0 || sb.length === 0) return 0.3
    const sbSet = new Set(sb)
    let inter = 0
    for (const c of sa) if (sbSet.has(c)) inter++
    const union = sa.length + sb.length - inter
    return union === 0 ? 0.5 : inter / union
  }

  /** 年龄区间 (0-17,18-39,40-59,60-79,80+) */
  private ageBand(age: number): number {
    if (age < 18) return 0
    if (age < 40) return 1
    if (age < 60) return 2
    if (age < 80) return 3
    return 4
  }

  /** 检查特征匹配: 模态 0.4 + 部位 0.3 + 年龄区间 0.15 + 性别 0.15 */
  private featureScore(
    q: { modality?: string; bodyPart?: string; age?: number; gender?: string },
    c: { modality: string; bodyPart: string; age: number; gender: string },
  ): number {
    let score = 0
    if (q.modality && this.normalize(q.modality) === this.normalize(c.modality)) score += 0.4
    if (q.bodyPart && this.normalize(q.bodyPart) === this.normalize(c.bodyPart)) score += 0.3
    if (q.age !== undefined && this.ageBand(q.age) === this.ageBand(c.age)) score += 0.15
    if (q.gender && q.gender === c.gender) score += 0.15
    return score
  }

  /* ---------------- 候选集 ---------------- */

  /** 从 Prisma Report 表加载候选 (DB 不可用时返回空) */
  private async loadDbReports(): Promise<Array<Omit<SimilarCaseCandidate, 'similarity' | 'textScore' | 'featureScore' | 'snomedScore'>>> {
    if (!this.prisma) return []
    try {
      const reports = await this.prisma.report.findMany({
        take: 500,
        include: { patient: true, exam: true },
      })
      return reports
        .filter((r): r is typeof r & { exam: NonNullable<typeof r.exam> } => !!r.exam)
        .map((r) => ({
          id: `db-${r.id}`,
          reportId: r.id,
          patientId: r.patientId,
          gender: r.patient.gender === 'FEMALE' ? '女' : r.patient.gender === 'MALE' ? '男' : '未知',
          age: r.patient.birthDate
            ? Math.max(0, Math.floor((Date.now() - new Date(r.patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)))
            : 0,
          modality: r.exam.modality ?? '',
          bodyPart: r.exam.bodyPart ?? '',
          studyDate: (r.signedAt ?? r.createdAt ?? new Date()).toISOString().slice(0, 10),
          findings: r.findings,
          impression: r.impression,
          conclusion: r.conclusion || r.impression,
          snomedCodes: [],
          keywords: this.extractKeywords(`${r.findings} ${r.impression} ${r.conclusion}`),
          source: 'db' as const,
        }))
    } catch {
      return []
    }
  }

  /* ---------------- 检索 ---------------- */

  /** 综合评分 = 0.5×文本 + 0.3×特征 + 0.2×SNOMED */
  private score(query: {
    text: string
    keywords: string[]
    modality?: string
    bodyPart?: string
    age?: number
    gender?: string
    snomedCodes: string[]
  }, c: Omit<SimilarCaseCandidate, 'similarity' | 'textScore' | 'featureScore' | 'snomedScore'>): Omit<SimilarCaseCandidate, 'similarity' | 'textScore' | 'featureScore' | 'snomedScore'> & { textScore: number; featureScore: number; snomedScore: number; similarity: number } {
    const textScore = this.jaccard(query.keywords, c.keywords)
    const featScore = this.featureScore(query, c)
    const snomed = this.snomedScore(query.snomedCodes, c.snomedCodes)
    const similarity = Math.round(100 * (0.5 * textScore + 0.3 * featScore + 0.2 * snomed))
    return { ...c, textScore, featureScore: featScore, snomedScore: snomed, similarity }
  }

  async search(input: SimilarCaseSearchInput): Promise<SimilarCaseCandidate[]> {
    const text = input.reportText ?? ''
    const keywords = this.extractKeywords(text)
    const candidates = [...this.demoCases, ...(await this.loadDbReports())]
    const query = {
      text,
      keywords,
      modality: input.modality,
      bodyPart: input.bodyPart,
      snomedCodes: [],
    }
    const limit = Math.min(50, Math.max(1, input.limit ?? 10))
    const results = candidates
      .map((c) => this.score(query, c))
      .filter((r) => r.similarity > 0 || keywords.length === 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
    return results
  }

  /** 按报告 ID 检索 (读报告 → 检索) */
  async findByReport(reportId: string, limit?: number): Promise<SimilarCaseCandidate[]> {
    let reportText = ''
    let modality: string | undefined
    let bodyPart: string | undefined
    let gender: string | undefined
    let age: number | undefined
    let snomedCodes: string[] = []
    if (this.prisma) {
      try {
        const report = await this.prisma.report.findUnique({
          where: { id: reportId },
          include: { patient: true, exam: true },
        })
        if (report) {
          reportText = `${report.findings} ${report.impression} ${report.conclusion}`
          modality = report.exam?.modality
          bodyPart = report.exam?.bodyPart
          gender = report.patient.gender === 'FEMALE' ? '女' : report.patient.gender === 'MALE' ? '男' : undefined
          if (report.patient.birthDate) {
            age = Math.max(0, Math.floor((Date.now() - new Date(report.patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)))
          }
        }
      } catch {
        /* DB 不可用 */
      }
    }
    // DB 不可用或报告不存在时,回退到演示病例库 (按 reportId 规则映射演示病例)
    if (!reportText) {
      const demo = this.demoCases.find((d) => d.reportId === reportId)
      if (demo) {
        reportText = `${demo.findings} ${demo.impression}`
        modality = demo.modality
        bodyPart = demo.bodyPart
        gender = demo.gender
        age = demo.age
        snomedCodes = demo.snomedCodes
      } else {
        return []
      }
    }
    const candidates = [...this.demoCases, ...(await this.loadDbReports())]
    const keywords = this.extractKeywords(reportText)
    return candidates
      .filter((c) => c.reportId !== reportId)
      .map((c) => this.score({ text: reportText, keywords, modality, bodyPart, age, gender, snomedCodes }, c))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, Math.min(50, Math.max(1, limit ?? 10)))
  }

  /** 反馈持久化 (DB 不可用时写入内存) */
  async feedback(input: SimilarCaseFeedbackInput): Promise<{ success: boolean }> {
    this.memoryFeedback.push(input)
    if (this.prisma) {
      try {
        await this.prisma.similarCaseFeedback.create({
          data: { ...input, tenantId: getCurrentTenantId() },
        })
      } catch {
        /* 保留内存记录 */
      }
    }
    return { success: true }
  }

  /** 反馈统计 (调试/审计用) */
  feedbackStats(): { total: number; useful: number; useless: number } {
    const useful = this.memoryFeedback.filter((f) => f.useful).length
    return { total: this.memoryFeedback.length, useful, useless: this.memoryFeedback.length - useful }
  }

  /* ════════════════════════════════════════════════════════════════════════
   * 影像级相似检索 (v3.0.6.11-62)
   * 特征: 强度直方图(32-bin) / 统计(mean·std·skew·kurt·percentiles) /
   *       纹理(相邻差分均值) / 形态(高/低密度占比)
   * 相似度 = 0.6×特征余弦 + 0.4×模态/部位匹配 (跨模态家族特征余弦记 0)
   * ════════════════════════════════════════════════════════════════════════
   */

  /** demo 影像特征库: 由 24 例演示病例确定性生成 (表空/DB 不可用时回退) */
  private demoFeatures(): ImageFeatures[] {
    if (this.demoImageFeatures) return this.demoImageFeatures
    this.demoImageFeatures = this.demoCases.map((c) =>
      buildDemoFeatures({
        seriesUid: `demo-series-${c.reportId}`,
        studyUid: `demo-study-${c.reportId}`,
        modality: c.modality,
        bodyPart: c.bodyPart,
      }),
    )
    return this.demoImageFeatures
  }

  private featureSummaryOf(f: ImageFeatures): ImageFeatureSummary {
    return {
      mean: f.mean,
      std: f.std,
      skew: f.skew,
      kurtosis: f.kurtosis,
      min: f.min,
      max: f.max,
      percentiles: [...f.percentiles],
      textureEnergy: f.textureEnergy,
      highDensityRatio: f.highDensityRatio,
      lowDensityRatio: f.lowDensityRatio,
      histogram: [...f.histogram],
    }
  }

  /** 从真实 DICOM 文件构建 series 特征 (解析 PixelData, 确定性下采样, 缓存) */
  private async buildRealFeature(seriesUid: string, instances: Array<{ storagePath: string | null; modality: string; studyInstanceUid: string; sopInstanceUid: string }>): Promise<ImageFeatures | null> {
    const cached = this.imageFeatureCache.get(seriesUid)
    if (cached) return cached
    const files = instances.filter((i) => i.storagePath && fs.existsSync(i.storagePath)).map((i) => i.storagePath!)
    if (files.length === 0) return null
    try {
      const slices = files.slice(0, 16).map((f) => parseDicomPart10(fs.readFileSync(f)))
      const first = slices[0]!
      const modality = instances[0]?.modality ?? 'OT'
      const bodyPart = inferBodyPart(modality, `${first.seriesDescription} ${first.studyDescription}`, `${seriesUid} ${instances[0]?.studyInstanceUid ?? ''}`)
      const feature = extractFeatures({
        seriesUid,
        studyUid: instances[0]?.studyInstanceUid ?? `study-${seriesUid}`,
        modality,
        bodyPart,
        slices,
        instanceCount: instances.length,
        source: 'real',
      })
      this.imageFeatureCache.set(seriesUid, feature)
      return feature
    } catch {
      return null
    }
  }

  /** 从 dicomInstance 表加载真实 series 特征 (DB 不可用返回空) */
  private async loadRealFeatures(): Promise<ImageFeatures[]> {
    const model = (this.prisma as any)?.dicomInstance
    if (!model?.findMany) return []
    try {
      const instances = await model.findMany({ take: 500, orderBy: { createdAt: 'asc' } })
      const bySeries = new Map<string, any[]>()
      for (const inst of instances) {
        const list = bySeries.get(inst.seriesInstanceUid) ?? []
        list.push(inst)
        bySeries.set(inst.seriesInstanceUid, list)
      }
      const out: ImageFeatures[] = []
      for (const [uid, list] of bySeries) {
        const f = await this.buildRealFeature(uid, list)
        if (f) out.push(f)
      }
      return out
    } catch {
      return []
    }
  }

  /** 全部可用影像特征: 真实样本 + demo 特征库 */
  private async allFeatures(): Promise<ImageFeatures[]> {
    return [...(await this.loadRealFeatures()), ...this.demoFeatures()]
  }

  /** 序列列表 (影像检索前端选择器) */
  async listImageSeries(): Promise<ImageSeriesItem[]> {
    const items: ImageSeriesItem[] = []
    for (const f of await this.allFeatures()) {
      items.push({
        seriesUid: f.seriesUid,
        studyUid: f.studyUid,
        modality: f.modality,
        bodyPart: f.bodyPart,
        instanceCount: f.instanceCount,
        description: f.source === 'real' ? `${f.modality} ${f.bodyPart} 影像 (真实样本)` : `${f.modality} ${f.bodyPart} (演示特征库)`,
        source: f.source,
      })
    }
    return items
  }

  /**
   * 影像级相似检索: 输入 seriesUID 或 studyUid → 提取特征 → 检索 Top N
   * 返回匿名结果 (无患者名/身份信息)
   */
  async imageSearch(input: ImageSearchInput): Promise<ImageSearchResult[]> {
    const limit = Math.min(20, Math.max(1, input.limit ?? 10))
    const features = await this.allFeatures()
    let query = input.seriesUID ? features.find((f) => f.seriesUid === input.seriesUID) : undefined
    if (!query && input.studyUid) query = features.find((f) => f.studyUid === input.studyUid)
    if (!query) {
      const resolved = await this.resolveExternalQuery(input)
      if (resolved) query = resolved
    }
    if (!query) return []

    const results: ImageSearchResult[] = []
    for (const f of features) {
      if (f.seriesUid === query.seriesUid) continue
      const { cos, match, score } = imageSimilarity(query, f)
      results.push({
        seriesUid: f.seriesUid,
        studyUid: f.studyUid,
        modality: f.modality,
        bodyPart: f.bodyPart,
        instanceCount: f.instanceCount,
        similarity: Math.round(score * 100),
        featureScore: Math.round(cos * 10000) / 100,
        matchScore: Math.round(match * 10000) / 100,
        featureSummary: this.featureSummaryOf(f),
        source: f.source,
      })
    }
    return results.sort((a, b) => b.similarity - a.similarity || b.featureScore - a.featureScore).slice(0, limit)
  }

  /** query 不在特征库时, 尝试直接从 dicomInstance 提取 (seriesUID / studyUid) */
  private async resolveExternalQuery(input: ImageSearchInput): Promise<ImageFeatures | null> {
    const model = (this.prisma as any)?.dicomInstance
    if (!model?.findMany) return null
    try {
      const where: any = {}
      if (input.seriesUID) where.seriesInstanceUid = input.seriesUID
      else if (input.studyUid) where.studyInstanceUid = input.studyUid
      else return null
      const instances = await model.findMany({ where, take: 200 })
      if (instances.length === 0) return null
      if (input.seriesUID) return this.buildRealFeature(input.seriesUID, instances)
      const bySeries = new Map<string, any[]>()
      for (const inst of instances) {
        const list = bySeries.get(inst.seriesInstanceUid) ?? []
        list.push(inst)
        bySeries.set(inst.seriesInstanceUid, list)
      }
      const first = [...bySeries.entries()][0]
      return first ? this.buildRealFeature(first[0], first[1]) : null
    } catch {
      return null
    }
  }

  /**
   * 融合检索: 文本相似 (Jaccard+特征+SNOMED) + 影像特征 (余弦+模态/部位)
   * 综合评分 = 0.5×文本分 + 0.5×影像分 (仅有其一则用可用分量)
   */
  async hybridSearch(input: HybridSearchInput): Promise<HybridSearchResult[]> {
    const limit = Math.min(20, Math.max(1, input.limit ?? 10))

    // 文本查询
    let text = input.reportText ?? ''
    let modality: string | undefined
    let bodyPart: string | undefined
    let age: number | undefined
    let gender: string | undefined
    let snomedCodes: string[] = []
    if (input.reportId && !text) {
      const demo = this.demoCases.find((d) => d.reportId === input.reportId)
      if (demo) {
        text = `${demo.findings} ${demo.impression}`
        modality = demo.modality
        bodyPart = demo.bodyPart
        age = demo.age
        gender = demo.gender
        snomedCodes = demo.snomedCodes
      } else if (this.prisma) {
        try {
          const report = await this.prisma.report.findUnique({
            where: { id: input.reportId },
            include: { patient: true, exam: true },
          })
          if (report) {
            text = `${report.findings} ${report.impression} ${report.conclusion}`
            modality = report.exam?.modality
            bodyPart = report.exam?.bodyPart
            if (report.patient.birthDate) {
              age = Math.max(0, Math.floor((Date.now() - new Date(report.patient.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)))
            }
          }
        } catch {
          /* DB 不可用 */
        }
      }
    }
    const keywords = this.extractKeywords(text)

    // 影像查询特征
    const features = await this.allFeatures()
    let imageQuery: ImageFeatures | undefined
    if (input.seriesUID) imageQuery = features.find((f) => f.seriesUid === input.seriesUID)
    if (!imageQuery && input.studyUid) imageQuery = features.find((f) => f.studyUid === input.studyUid)
    if (!imageQuery) imageQuery = (await this.resolveExternalQuery(input)) ?? undefined
    const hasImageQuery = !!imageQuery
    const imageModality = imageQuery?.modality
    const imageBodyPart = imageQuery?.bodyPart

    // 候选集: demo 病例 (文本+影像) + 真实 series (影像; reportId 关联时含文本)
    interface Candidate {
      id: string
      reportId: string
      seriesUid?: string
      studyUid: string
      modality: string
      bodyPart: string
      gender: string
      age: number
      findings: string
      impression: string
      conclusion: string
      keywords: string[]
      snomedCodes: string[]
      feature?: ImageFeatures
      source: 'db' | 'demo' | 'real'
    }
    const candidates: Candidate[] = []
    for (const d of this.demoCases) {
      candidates.push({
        id: d.id,
        reportId: d.reportId,
        studyUid: `demo-study-${d.reportId}`,
        modality: d.modality,
        bodyPart: d.bodyPart,
        gender: d.gender,
        age: d.age,
        findings: d.findings,
        impression: d.impression,
        conclusion: d.conclusion,
        keywords: d.keywords,
        snomedCodes: d.snomedCodes,
        feature: this.demoFeatures().find((f) => f.seriesUid === `demo-series-${d.reportId}`),
        source: 'demo',
      })
    }
    for (const f of features) {
      if (f.source !== 'real') continue
      let reportId = `series-${f.seriesUid.slice(-8)}`
      let findings = ''
      let impression = ''
      let conclusion = ''
      let kws: string[] = []
      let snomed: string[] = []
      if (this.prisma) {
        try {
          const inst = await (this.prisma as any).dicomInstance.findFirst({ where: { seriesInstanceUid: f.seriesUid }, select: { reportId: true } })
          if (inst?.reportId) {
            const report = await this.prisma.report.findUnique({ where: { id: inst.reportId } })
            if (report) {
              reportId = report.id
              findings = report.findings
              impression = report.impression
              conclusion = report.conclusion || report.impression
              kws = this.extractKeywords(`${findings} ${impression} ${conclusion}`)
            }
          }
        } catch {
          /* DB 不可用 */
        }
      }
      candidates.push({
        id: `img-${f.seriesUid}`,
        reportId,
        seriesUid: f.seriesUid,
        studyUid: f.studyUid,
        modality: f.modality,
        bodyPart: f.bodyPart,
        gender: '',
        age: 0,
        findings,
        impression,
        conclusion,
        keywords: kws,
        snomedCodes: snomed,
        feature: f,
        source: 'real',
      })
    }

    const results: HybridSearchResult[] = []
    for (const c of candidates) {
      const hasText = keywords.length > 0
      const textScore = hasText ? this.jaccard(keywords, c.keywords) : null
      const featScore = hasText ? this.featureScore({ modality, bodyPart, age, gender }, c) : 0
      const snomed = hasText ? this.snomedScore(snomedCodes, c.snomedCodes) : 0
      const textComponent = hasText ? 0.5 * (textScore ?? 0) + 0.3 * featScore + 0.2 * snomed : null

      let imageComponent: number | null = null
      if (hasImageQuery && c.feature) {
        const { cos, match, score } = imageSimilarity(
          { modality: imageModality!, bodyPart: imageBodyPart!, vector: imageQuery!.vector },
          c.feature,
        )
        const total = 0.6 * cos + 0.4 * match
        imageComponent = Math.round(total * 100) / 100
      }

      let similarity: number
      if (textComponent !== null && imageComponent !== null) similarity = Math.round(100 * (0.5 * textComponent + 0.5 * imageComponent))
      else if (textComponent !== null) similarity = Math.round(100 * textComponent)
      else if (imageComponent !== null) similarity = Math.round(imageComponent * 100)
      else similarity = 0

      if (similarity <= 0 && !hasImageQuery && !hasText) continue
      results.push({
        id: c.id,
        reportId: c.reportId,
        seriesUid: c.seriesUid,
        studyUid: c.studyUid,
        modality: c.modality,
        bodyPart: c.bodyPart,
        similarity,
        textScore: textComponent !== null ? Math.round(textComponent * 100) / 100 : null,
        imageScore: imageComponent,
        featureSummary: c.feature ? this.featureSummaryOf(c.feature) : null,
        source: c.source,
        impression: c.impression || undefined,
        findings: c.findings || undefined,
        keywords: c.keywords,
      })
    }
    return results.sort((a, b) => b.similarity - a.similarity || (b.imageScore ?? 0) - (a.imageScore ?? 0)).slice(0, limit)
  }
}
