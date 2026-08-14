/**
 * G005 放射RIS系统 v3.0.6.11-98 Wave2B (报告 P1) - 征象库后端化
 * GET  /finding-library            分组列表 (category/items{name,description,keywords})
 * GET  /finding-library/search?q=  关键词检索 (name/description/keywords 命中)
 * 进程内存 + seed (从 FindingLibraryPage 前端硬编码 200 条派生), 失败/空时前端回退内置知识库
 */
import { Injectable, Logger } from '@nestjs/common'

export interface FindingLibraryItem {
  id: string
  name: string
  description: string
  keywords: string[]
}

export interface FindingLibraryCategory {
  category: string
  items: FindingLibraryItem[]
}

const SEED: FindingLibraryCategory[] = [
  {
    category: '头部',
    items: [
      { id: 'H001', name: '脑出血', description: 'CT平扫示脑内高密度影，CT值约45-65Hu，边界清楚，周围可见水肿带。', keywords: ['出血', '高密度', '急症', '高血压', '基底节'] },
      { id: 'H002', name: '脑梗死', description: 'CT早期可见脑回模糊，稍低密度；MR DWI呈高信号，ADC低信号。', keywords: ['梗死', 'DWI高信号', '缺血', '脑血栓', '栓塞'] },
      { id: 'H003', name: '脑肿瘤', description: 'MR示脑内占位性病变，T1WI低信号，T2WI高信号，增强扫描不均匀强化。', keywords: ['肿瘤', '占位', '强化', '胶质瘤', '脑膜瘤', '转移瘤'] },
      { id: 'H004', name: '脑萎缩', description: '脑室扩大，脑池增宽，脑沟加深，对称性或非对称性。', keywords: ['萎缩', '脑室扩大', '脑沟增宽', '老年性'] },
      { id: 'H005', name: '硬膜下血肿', description: 'CT示颅骨内板下方新月形高密度影，范围广泛，可跨颅缝。', keywords: ['血肿', '新月形', '外伤', '硬膜下'] },
      { id: 'H006', name: '硬膜外血肿', description: 'CT示颅骨内板与硬膜之间梭形或双凸透镜形高密度影，常伴颅骨骨折。', keywords: ['血肿', '梭形', '外伤', '脑膜中动脉'] },
      { id: 'H007', name: '蛛网膜下腔出血', description: 'CT示脑池、脑沟内高密度影，以脚间池、环池最明显。', keywords: ['出血', '脑池高密度', '急症', '动脉瘤'] },
      { id: 'H008', name: '脑膜尾征', description: 'MR增强扫描示肿瘤附着处硬脑膜增厚强化，呈"脑膜尾"状。', keywords: ['脑膜尾征', '强化', '脑膜瘤', '硬脑膜'] },
      { id: 'H009', name: '环形强化', description: 'MR增强示环形强化病灶，壁光滑均匀，中心坏死区无强化。', keywords: ['环形强化', '脓肿', '感染', '转移瘤'] },
      { id: 'H010', name: '烟雾病', description: 'MR/TCD示双侧颈内动脉末端狭窄或闭塞，基底节区异常血管网，呈"烟雾状"。', keywords: ['烟雾病', '侧支循环', '血管网', '闭塞'] },
    ],
  },
  {
    category: '胸部',
    items: [
      { id: 'C001', name: '分叶征', description: '肺结节或肿块边缘可见深分叶或浅分叶，提示恶性可能。', keywords: ['分叶征', '恶性', '结节', '肺癌'] },
      { id: 'C002', name: '毛刺征', description: '肺结节边缘可见细短毛刺影，是恶性肿瘤特征之一。', keywords: ['毛刺征', '恶性', '结节', '肺癌', '结核球'] },
      { id: 'C003', name: '胸腔积液', description: 'CT示胸膜腔内液体密度影，外侧肋胸膜下单弧形液性密度。', keywords: ['胸腔积液', '液体', '胸水', '胸膜炎', '心衰'] },
      { id: 'C004', name: '空洞', description: 'CT示肺内空洞性病变，洞壁可厚可薄，内壁可光滑或毛糙。', keywords: ['空洞', '坏死', '感染', '肺结核', '肺脓肿'] },
      { id: 'C005', name: '磨玻璃影', description: 'CT示肺内淡薄云雾状密度增高影，密度介于正常肺与实变之间。', keywords: ['磨玻璃', 'GGO', '感染', '肺炎', '肺癌'] },
      { id: 'C006', name: '空气支气管征', description: 'CT示实变区内可见含气支气管影，提示肺泡充填病变。', keywords: ['空气支气管征', '支气管', '实变', '肺炎'] },
      { id: 'C007', name: '铺路石征', description: 'CT示磨玻璃影内可见增厚的小叶间隔，呈铺路石样改变。', keywords: ['铺路石征', '小叶间隔', '肺泡蛋白沉积症', '肺炎'] },
      { id: 'C008', name: '树芽征', description: 'CT示终末细支气管和肺泡充填，呈树枝发芽状。', keywords: ['树芽征', '小气道', '支气管扩张', '结核'] },
      { id: 'C009', name: '肺动脉栓塞', description: 'CTPA示肺动脉内充盈缺损，血流中断。', keywords: ['肺栓塞', '血栓', '急症', '充盈缺损', 'CTPA'] },
      { id: 'C010', name: '主动脉夹层', description: 'CTA/MRA示主动脉内膜片剥离，形成真假腔。', keywords: ['夹层', '内膜片', '急症', '高血压', '马凡综合征'] },
    ],
  },
  {
    category: '腹部',
    items: [
      { id: 'A001', name: '肝囊肿', description: 'CT/MR示肝内圆形水样密度/信号灶，边缘清楚，无强化。', keywords: ['囊肿', '囊性', '良性', '肝脏'] },
      { id: 'A002', name: '肝硬化', description: 'CT/MR示肝脏体积缩小，肝叶比例失调，表面呈波浪状，脾大。', keywords: ['肝硬化', '缩小', '脾大', '肝裂增宽'] },
      { id: 'A003', name: '腹水', description: 'CT示腹腔内液性密度影，可游离或包裹性。', keywords: ['腹水', '液体', '腹腔', '肝硬化'] },
      { id: 'A004', name: '肠梗阻', description: 'X线/CT示肠管扩张积气积液，气液平面。', keywords: ['肠梗阻', '气液平面', '急症', '扩张'] },
      { id: 'A005', name: '胰腺炎', description: 'CT示胰腺体积增大，密度减低，胰周渗出，肾前筋膜增厚。', keywords: ['胰腺炎', '渗出', '急症', '胰周'] },
      { id: 'A006', name: '肝血管瘤', description: 'CT/MR增强扫描示边缘结节样强化，逐渐向内填充，"快进慢出"。', keywords: ['血管瘤', '强化模式', '良性', '快进慢出'] },
      { id: 'A007', name: '肝癌', description: 'CT/MR示肝内肿块，"快进快出"强化模式，可有门脉癌栓。', keywords: ['肝癌', '快进快出', '恶性', '门脉癌栓'] },
      { id: 'A008', name: '牛眼征', description: 'CT/MR示肝内多发大小不等肿块，中心低密度，边缘环形强化。', keywords: ['牛眼征', '转移瘤', '多发', '肝脏'] },
      { id: 'A009', name: '胆结石', description: 'CT示胆囊内高密度或混杂密度结石影，MRI T2WI黑石头征。', keywords: ['结石', '胆囊', '高密度', '胆总管'] },
      { id: 'A010', name: '消化道穿孔', description: 'CT/X线示膈下游离气体，腹腔积液积脓。', keywords: ['穿孔', '游离气体', '急症', '膈下'] },
    ],
  },
  {
    category: '脊柱',
    items: [
      { id: 'S001', name: '椎体压缩性骨折', description: 'X线/CT/MR示椎体前缘或整个椎体变扁，楔形变。', keywords: ['压缩骨折', '楔形变', '外伤', '骨质疏松'] },
      { id: 'S002', name: '椎间盘突出', description: 'MR/CT示椎间盘向后方或侧方突出，压迫硬膜囊或神经根。', keywords: ['椎间盘突出', '压迫', '退变', '腰椎'] },
      { id: 'S003', name: '脊柱侧弯', description: 'X线/Cobb角测量示脊柱侧方弯曲，Cobb角>10°。', keywords: ['侧弯', 'Cobb角', '先天', '脊柱'] },
      { id: 'S004', name: '椎管狭窄', description: 'MR/CT示椎管前后径减小，<10mm为重度狭窄。', keywords: ['椎管狭窄', '狭窄', '退变', '硬膜囊'] },
      { id: 'S005', name: '椎体滑脱', description: 'X线/MR示上位椎体相对下位椎体向前或向后移位。', keywords: ['滑脱', '移位', '退变', '椎弓峡部裂'] },
      { id: 'S006', name: '许莫尔结节', description: 'X线/CT示椎体上下缘局限性凹陷，MR示液体信号充填。', keywords: ['许莫尔结节', '软骨结节', '椎体', '先天'] },
      { id: 'S007', name: '韧带骨化', description: 'CT/MR示后纵韧带或黄韧带增厚、骨化。', keywords: ['韧带骨化', 'OPLL', '狭窄', '后纵韧带'] },
      { id: 'S008', name: '脊柱结核', description: 'CT/MR示多椎体骨质破坏、椎间隙狭窄、寒性脓肿。', keywords: ['结核', '骨质破坏', '脓肿', '椎间隙狭窄'] },
    ],
  },
  {
    category: '四肢',
    items: [
      { id: 'E001', name: '骨折', description: 'X线/CT示骨皮质的连续性中断，可有移位、成角。', keywords: ['骨折', '外伤', '移位', '骨皮质中断'] },
      { id: 'E002', name: '骨肿瘤', description: 'X线/CT/MR示骨的肿瘤性病变，有溶骨性或成骨性改变。', keywords: ['骨肿瘤', '破坏', '恶性', '骨肉瘤', '转移瘤'] },
      { id: 'E003', name: '关节炎', description: 'X线/CT示关节面硬化、骨赘形成、关节间隙狭窄。', keywords: ['关节炎', '骨赘', '退变', '关节间隙狭窄'] },
      { id: 'E004', name: '半月板损伤', description: 'MR示半月板内异常信号，达关节面或游离缘。', keywords: ['半月板损伤', '撕裂', '外伤', 'III度'] },
      { id: 'E005', name: '肩袖撕裂', description: 'MR示肩袖肌腱信号中断或连续性消失。', keywords: ['肩袖撕裂', '肌腱', '外伤', '冈上肌'] },
      { id: 'E006', name: '股骨头坏死', description: 'MR/CT示股骨头信号异常，形态改变，塌陷，"双线征"。', keywords: ['股骨头坏死', '双线征', '缺血', '塌陷'] },
      { id: 'E007', name: '骨髓水肿', description: 'MR T2WI/STIR示骨髓内高信号，提示水肿或充血。', keywords: ['骨髓水肿', 'STIR高信号', '外伤', '应力'] },
      { id: 'E008', name: '关节积液', description: 'MR/超声示关节囊内液体信号/无回声区。', keywords: ['关节积液', '液体', '滑膜', '髌上囊'] },
    ],
  },
  {
    category: '血管',
    items: [
      { id: 'V001', name: '动脉粥样硬化', description: 'CTA/MRA示动脉壁增厚、钙化斑块形成，管腔狭窄。', keywords: ['动脉粥样硬化', '斑块', '狭窄', '钙化'] },
      { id: 'V002', name: '动脉瘤', description: 'CTA/MRA/DSA示动脉壁局限性扩张，呈囊状或梭形。', keywords: ['动脉瘤', '囊状', '急症', '扩张'] },
      { id: 'V003', name: '深静脉血栓', description: 'CTV/MR示深静脉内充盈缺损或血栓形成。', keywords: ['深静脉血栓', '血栓', '急症', '充盈缺损'] },
      { id: 'V004', name: '肺栓塞', description: 'CTPA示肺动脉内充盈缺损，可有"截断征"。', keywords: ['肺栓塞', '截断征', '急症', '充盈缺损'] },
      { id: 'V005', name: '夹层', description: 'CTA/MRA示主动脉内膜片剥离，形成真假两腔。', keywords: ['夹层', '内膜片', '急症', '假腔'] },
      { id: 'V006', name: '血管狭窄', description: 'CTA/MRA/DSA示血管局限性或弥漫性狭窄。', keywords: ['狭窄', '动脉粥样硬化', '闭塞'] },
      { id: 'V007', name: '血管畸形', description: 'CTA/MRA/DSA示血管走形异常，可有AVF或发育异常。', keywords: ['血管畸形', 'AVM', '动静脉瘘', '先天'] },
      { id: 'V008', name: '肾动脉狭窄', description: 'CTA/MRA/DSA示肾动脉管腔狭窄，可有"串珠征"。', keywords: ['肾动脉狭窄', '狭窄', '高血压', '串珠征'] },
    ],
  },
  {
    category: '骨骼肌肉',
    items: [
      { id: 'M001', name: '肩周炎', description: 'MR/X线示肩关节囊增厚、肩袖间隙模糊、三角肌滑囊积液。', keywords: ['肩周炎', '关节囊', '粘连', '冻结肩'] },
      { id: 'M002', name: '钙化性肌腱炎', description: 'X线/CT示肌腱内钙化灶，呈斑块状或线状高密度。', keywords: ['钙化', '肌腱', '退变', '冈上肌'] },
      { id: 'M003', name: 'Bankart损伤', description: 'MR示盂唇前下撕裂，关节盂前缘骨质缺损。', keywords: ['Bankart', '盂唇', '外伤', '脱位'] },
      { id: 'M004', name: '网球肘', description: 'MR/超声示肱骨外上髁伸肌总腱增厚、水肿。', keywords: ['网球肘', '肌腱', '炎症', '外上髁'] },
      { id: 'M005', name: '腕管综合征', description: 'MR示正中神经在腕管内水肿、肿胀，远端增粗。', keywords: ['腕管', '正中神经', '卡压', '肿胀'] },
      { id: 'M006', name: '贝克囊肿', description: 'MR/超声示腘窝囊性肿块，与膝关节腔相通。', keywords: ['贝克囊肿', '囊肿', '腘窝', '良性'] },
      { id: 'M007', name: '跟腱断裂', description: 'MR示跟腱连续性完全中断，断端回缩。', keywords: ['跟腱断裂', '肌腱', '外伤', '急症'] },
      { id: 'M008', name: '跖筋膜炎', description: 'MR/超声示跖筋膜跟骨附着处增厚、水肿。', keywords: ['跖筋膜炎', '筋膜', '炎症', '跟骨'] },
    ],
  },
  {
    category: '心血管',
    items: [
      { id: 'CV001', name: '冠心病', description: 'CTA示冠状动脉多发斑块形成，管腔不同程度狭窄。', keywords: ['冠心病', '冠状动脉', '狭窄', '斑块'] },
      { id: 'CV002', name: '急性心肌梗死', description: 'CT/MR示心肌局部变薄、强化减低或延迟强化。', keywords: ['心肌梗死', '心梗', '急症', '延迟强化'] },
      { id: 'CV003', name: '扩张型心肌病', description: 'CT/MR示心室腔扩大，室壁运动弥漫性减低。', keywords: ['扩张型心肌病', '心室扩大', '心功能减低', '射血分数'] },
      { id: 'CV004', name: '心包积液', description: 'CT/MR示心包腔内液性密度/信号影。', keywords: ['心包积液', '液体', '心脏', '心衰'] },
      { id: 'CV005', name: '房间隔缺损', description: 'CTA/MR示房间隔局部缺损，左向右分流。', keywords: ['ASD', '房间隔缺损', '先天', '分流'] },
      { id: 'CV006', name: '法洛四联症', description: 'CTA/MR示肺动脉狭窄、室间隔缺损、主动脉骑跨、右室肥厚。', keywords: ['法洛四联症', '复杂先心', '先天', '骑跨'] },
      { id: 'CV007', name: '主动脉瓣狭窄', description: 'CTA/MR示主动脉瓣增厚、开放受限，瓣环缩小。', keywords: ['主动脉瓣狭窄', '瓣膜', '退变', '瓣口面积'] },
      { id: 'CV008', name: '上腔静脉综合征', description: 'CTA/MR示上腔静脉受压或闭塞，侧支循环开放。', keywords: ['上腔静脉综合征', '狭窄', '恶性肿瘤', '侧支循环'] },
    ],
  },
  {
    category: '五官科',
    items: [
      { id: 'ENT01', name: '鼻窦炎', description: 'CT/MR示鼻窦黏膜增厚，窦腔积液或密度增高。', keywords: ['鼻窦炎', '黏膜增厚', '炎症', '窦腔积液'] },
      { id: 'ENT02', name: '鼻咽癌', description: 'CT/MR示鼻咽部肿块，咽隐窝变浅或消失。', keywords: ['鼻咽癌', '恶性', '咽隐窝', '肿块'] },
      { id: 'ENT03', name: '胆脂瘤型中耳炎', description: 'CT/MR示中耳内软组织肿块，听小骨破坏，骨质侵蚀。', keywords: ['胆脂瘤', '中耳炎', '骨质破坏', '听小骨'] },
      { id: 'ENT04', name: '听神经瘤', description: 'MR/CT示桥小脑角区肿块，内听道扩大。', keywords: ['听神经瘤', '桥小脑角', '良性', '内听道'] },
      { id: 'ENT05', name: '喉癌', description: 'CT/MR示喉部肿块，声带固定，会厌受累。', keywords: ['喉癌', '恶性', '喉部', '声带'] },
      { id: 'ENT06', name: '甲状腺结节', description: 'CT/超声示甲状腺内结节，可为实性或囊性。', keywords: ['甲状腺结节', '结节', '肿瘤', '甲状腺'] },
      { id: 'ENT07', name: '颈淋巴结转移', description: 'CT/MR示颈部多发肿大淋巴结，可有坏死。', keywords: ['淋巴结转移', '转移', '恶性', '颈部'] },
      { id: 'ENT08', name: '视网膜脱离', description: 'MR/CT示视网膜V形脱离，T2WI高信号。', keywords: ['视网膜脱离', '眼底', '急症', 'V形'] },
    ],
  },
]

@Injectable()
export class FindingLibraryService {
  private readonly logger = new Logger(FindingLibraryService.name)

  list(): FindingLibraryCategory[] {
    return SEED.map((c) => ({ category: c.category, items: c.items.map((i) => ({ ...i })) }))
  }

  search(q?: string): FindingLibraryCategory[] {
    const kw = String(q ?? '').trim().toLowerCase()
    if (!kw) return this.list()
    const hits: FindingLibraryItem[] = []
    for (const cat of SEED) {
      for (const item of cat.items) {
        const haystack = [item.name, item.description, ...item.keywords].join(' ').toLowerCase()
        if (haystack.includes(kw)) hits.push({ ...item })
      }
    }
    if (hits.length === 0) return []
    const byCategory = new Map<string, FindingLibraryItem[]>()
    for (const cat of SEED) {
      const matched = cat.items.filter((i) => hits.some((h) => h.id === i.id))
      if (matched.length > 0) byCategory.set(cat.category, matched)
    }
    return Array.from(byCategory.entries()).map(([category, items]) => ({ category, items }))
  }
}
