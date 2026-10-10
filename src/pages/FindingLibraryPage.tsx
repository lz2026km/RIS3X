import { Card } from 'antd'
// [v3.0.6.11-98 Wave2B (报告 P1)] 征象库后端化: 优先 GET /finding-library + /finding-library/search,
//   失败回退内置 200 条硬编码并显示「内置知识库回退」徽标 (保留下方硬编码结构不动)
import { findingLibraryApi } from '../services/api/findingLibraryApi'
// NOTE: 未解决 - 替换此文件中所有硬编码中文文本为 i18n t() 调用 (约 6,765 字符)
// ============================================================
// G005 放射科RIS系统 - 典型征象图文库 v1.0.0
// 汉东省人民医院放射科
// ============================================================
import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search, X, ChevronDown, BookOpen,
  Image as ImageIcon, Star, StarOff, Check,
  Scan, Brain, Bone, Activity,
  FileText, Tag, TrendingUp,
  RefreshCw, ChevronRight, Info, Zap,
} from 'lucide-react'
import { t } from '../i18n/appI18n';

// ============================================================
// 样式常量 - 蓝色主题
// ============================================================
const COLORS = {
  primary: 'var(--color-primary-800)',
  primaryLight: 'var(--color-primary-600)',
  primaryDark: '#172554',
  primaryBlue: 'var(--color-primary-500)',
  primaryBlueLight: '#60a5fa',
  primaryBlueBg: 'var(--color-pending-bg)',
  white: 'var(--bg-card)',
  background: 'var(--bg-card)',
  backgroundLight: 'var(--content-bg)',
  text: 'var(--text-primary)',
  textMuted: 'var(--text-muted)',
  textLight: 'var(--text-muted)',
  border: 'var(--border-color)',
  success: '#059669',
  successBg: 'var(--color-success-bg)',
  warning: 'var(--color-warning-600)',
  warningBg: 'var(--color-warning-bg)',
  danger: 'var(--color-error-600)',
  dangerBg: 'var(--color-error-bg)',
  info: 'var(--color-primary-600)',
  infoBg: 'var(--color-info-bg)',
  purple: '#7c3aed',
  purpleBg: 'rgba(124, 58, 237, 0.12)',
}

// ============================================================
// 类型定义
// ============================================================
interface TypicalFinding {
  id: string
  bodyPart: string       // 部位
  disease: string        // 典型疾病
  findingName: string    // 征象名称
  description: string     // 详细描述
  imageUrl: string       // 图片（用占位图）
  insertText: string     // 可直接插入报告的文本
  typicalIn: string[]    // 典型于哪些疾病
  tags: string[]
  usageCount: number     // 使用次数
  modality: string[]     // 检查类型
  diseaseType: string    // 疾病类型
}

// ============================================================
// 模拟数据 - 200条典型征象
// ============================================================
const generateFindings = (): TypicalFinding[] => {
  const findings: TypicalFinding[] = []
  let id = 1

  // 头部 (30条)
  const headFindings = [
    { name: '脑出血', disease: '高血压性脑出血', desc: 'CT平扫示脑内高密度影，CT值约45-65Hu，边界清楚，周围可见水肿带', insert: '左侧基底节区可见团块状高密度影，大小约XXcm，CT值约55Hu，周围可见低密度水肿环绕。', typical: ['高血压脑出血', '动脉瘤破裂', '脑外伤'], tags: ['出血', '高密度', '急症'], modality: ['CT'], diseaseType: '外伤' },
    { name: '脑梗死', disease: '脑梗死', desc: 'CT早期可见脑回模糊，稍低密度；MR DWI呈高信号，ADC低信号', insert: '右侧大脑中动脉供血区可见片状异常信号，T1WI低信号，T2WI/FLAIR高信号，DWI呈明显高信号。', typical: ['脑血栓形成', '脑栓塞', '腔隙性脑梗死'], tags: ['梗死', 'DWI高信号', '缺血'], modality: ['CT', 'MR'], diseaseType: '血管病变' },
    { name: '脑肿瘤', disease: '脑胶质瘤', desc: 'MR示脑内占位性病变，T1WI低信号，T2WI高信号，增强扫描不均匀强化', insert: '右额叶可见团块状异常信号影，大小约XXcm，T1WI呈低信号，T2WI呈高信号，增强扫描呈不规则环形强化。', typical: ['胶质瘤', '脑膜瘤', '转移瘤'], tags: ['肿瘤', '占位', '强化'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '脑萎缩', disease: '脑萎缩', desc: '脑室扩大，脑池增宽，脑沟加深，对称性或非对称性', insert: '脑室系统扩大，脑沟、脑池增宽，脑实质未见明确异常信号。', typical: ['阿尔茨海默病', '老年性脑改变', '外伤后遗'], tags: ['萎缩', '脑室扩大'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '硬膜下血肿', disease: '硬膜下血肿', desc: 'CT示颅骨内板下方新月形高密度影，范围广泛，可跨颅缝', insert: '左侧额颞顶部颅骨内板下方可见新月形高密度影，厚度约XXmm，密度均匀，CT值约60Hu。', typical: ['外伤', '凝血障碍', '动脉瘤破裂'], tags: ['血肿', '新月形', '外伤'], modality: ['CT'], diseaseType: '外伤' },
    { name: '硬膜外血肿', disease: '硬膜外血肿', desc: 'CT示颅骨内板与硬膜之间梭形或双凸透镜形高密度影，边界清，常伴颅骨骨折', insert: '右侧颞部颅骨内板下方可见梭形高密度影，大小约XXcm，边界清晰，CT值约65Hu，相邻脑组织受压。', typical: ['外伤', '脑膜中动脉断裂'], tags: ['血肿', '梭形', '外伤'], modality: ['CT'], diseaseType: '外伤' },
    { name: '蛛网膜下腔出血', disease: '蛛网膜下腔出血', desc: 'CT示脑池、脑沟内高密度影，以脚间池、环池最明显', insert: '环池、纵裂池内可见高密度影，CT值约55Hu，脑室系统未见明确异常。', typical: ['动脉瘤破裂', '高血压', '外伤'], tags: ['出血', '脑池高密度', '急症'], modality: ['CT'], diseaseType: '血管病变' },
    { name: '脑水肿', disease: '脑水肿', desc: 'CT示脑组织弥漫性低密度，MR T2WI/FLAIR示脑组织弥漫性高信号', insert: '右侧大脑半球可见大片状低密度影，脑回肿胀，脑沟变浅消失。', typical: ['脑梗死', '脑肿瘤', '炎症'], tags: ['水肿', '低密度'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '脑膜尾征', disease: '脑膜瘤', desc: 'MR增强扫描示肿瘤附着处硬脑膜增厚强化，呈"脑膜尾"状', insert: '左侧额部可见脑外占位，基底附着一线样强化带，即"脑膜尾征"。', typical: ['脑膜瘤', '孤立性纤维瘤'], tags: ['脑膜尾征', '强化', '脑膜瘤'], modality: ['MR'], diseaseType: '肿瘤' },
    { name: '环形强化', disease: '脑脓肿', desc: 'MR增强示环形强化病灶，壁光滑均匀，中心坏死区无强化', insert: '右颞叶可见环形强化灶，大小约XXcm，环壁光滑均匀，厚薄一致，中心无强化区。', typical: ['脑脓肿', '转移瘤', '胶质母细胞瘤'], tags: ['环形强化', '脓肿', '感染'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: 'DWI高信号', disease: '急性脑梗死', desc: 'MR扩散加权成像呈高信号，ADC图呈低信号，提示细胞毒性水肿', insert: '左侧基底节区DWI呈高信号，相应ADC图呈低信号，符合急性期脑梗死表现。', typical: ['急性脑梗死', '可逆性缺血'], tags: ['DWI高信号', '急性', '梗死'], modality: ['MR'], diseaseType: '血管病变' },
    { name: ' Hakim Adams综合征', disease: '正常压力脑积水', desc: 'CT/MR示脑室系统扩大，额角变钝，无明显脑萎缩征象', insert: '脑室系统明显扩大，以侧脑室前角为著，脑沟未见明显增宽，考虑正常压力脑积水。', typical: ['正常压力脑积水', '脑积水'], tags: ['脑室扩大', '脑积水'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '豆状核钙化', disease: 'Fahr病', desc: 'CT示双侧豆状核对称性钙化，呈高密度', insert: '双侧豆状核可见对称性钙化灶，CT值约80Hu，边界清楚。', typical: ['Fahr病', '甲状旁腺功能减退', '生理性钙化'], tags: ['钙化', '基底节', '对称'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '颞角扩大', disease: '颞叶癫痫', desc: 'MR示单侧颞角扩大，超过正常宽度9mm', insert: '左侧颞角明显扩大，约为右侧的1.5倍，颞叶内侧结构紊乱，海马硬化待除外。', typical: ['颞叶癫痫', '海马硬化', '脑积水'], tags: ['颞角扩大', '海马'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '腔隙性梗死', disease: '腔隙性脑梗死', desc: 'CT/MR示脑深部 small 梗死灶，直径5-15mm', insert: '双侧基底节区可见多发小片状异常信号，T2WI高信号，直径约5-8mm。', typical: ['高血压', '糖尿病', '小血管病'], tags: ['腔隙', '小梗死', '基底节'], modality: ['CT', 'MR'], diseaseType: '血管病变' },
    { name: '脑室周围白质改变', disease: '脑白质疏松', desc: 'MR T2WI/FLAIR示脑室周围白质对称性高信号', insert: '双侧脑室周围白质可见对称性FLAIR高信号，边界模糊。', typical: ['脑白质疏松', '慢性缺血', '多发性硬化'], tags: ['白质改变', 'FLAIR高信号'], modality: ['MR'], diseaseType: '血管病变' },
    { name: '垂体增大', disease: '垂体瘤', desc: 'MR示垂体增大，向上压迫视交叉，T1WI等信号，T2WI稍高信号', insert: '蝶鞍区可见占位性病变，大小约XXcm，T1WI等信号，增强扫描明显均匀强化，向上压迫视交叉。', typical: ['垂体瘤', '垂体脓肿', 'Rathke囊肿'], tags: ['垂体', '占位', '鞍区'], modality: ['MR'], diseaseType: '肿瘤' },
    { name: '桥脑十字征', disease: '多系统萎缩', desc: 'MR轴位T2WI示桥脑纵行纤维受累形成十字形高信号', insert: '桥脑中部T2WI可见"十字征"，即十字形高信号，为多系统萎缩特征性表现。', typical: ['多系统萎缩', '橄榄体桥脑小脑萎缩'], tags: ['十字征', '桥脑', '变性病'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '小脑萎缩', disease: '小脑性共济失调', desc: 'MR示小脑半球脑回变窄，脑沟增宽加深', insert: '小脑半球脑叶变薄，脑沟增宽，小脑中线结构尚居中。', typical: ['小脑萎缩', '遗传性共济失调', '慢性酒精中毒'], tags: ['萎缩', '小脑'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '颅骨骨折', disease: '颅骨骨折', desc: 'CT骨窗示颅骨线状骨折，可有骨缝分离、凹陷', insert: '左侧颞骨可见线状低密度影，局部骨缝增宽，符合骨折表现。', typical: ['外伤', '颅骨损伤'], tags: ['骨折', '外伤', '骨窗'], modality: ['CT'], diseaseType: '外伤' },
    { name: '中线结构移位', disease: '脑疝', desc: 'CT示大脑廉或小脑幕切迹疝，中线结构向对侧移位', insert: '透明隔及大脑廉明显向右侧移位，移位距离约XXmm，考虑脑疝形成。', typical: ['脑疝', '颅内血肿', '脑肿瘤'], tags: ['中线移位', '脑疝', '急症'], modality: ['CT'], diseaseType: '外伤' },
    { name: '脑实质钙化', disease: '颅内钙化', desc: 'CT示脑实质内异常钙化灶，CT值>100Hu', insert: '右侧大脑半球可见多发点状钙化灶，CT值约120Hu，边界清楚。', typical: ['生理性钙化', '脑膜瘤', '结节性硬化'], tags: ['钙化', '高密度'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '静脉窦血栓', disease: '脑静脉窦血栓', desc: 'CT/MR示静脉窦内血栓形成，充盈缺损', insert: '上矢状窦可见充盈缺损，T1WI等信号，T2WI及 flair 高信号，符合静脉窦血栓。', typical: ['静脉窦血栓', '高凝状态', '感染'], tags: ['血栓', '静脉窦', '急症'], modality: ['CT', 'MR'], diseaseType: '血管病变' },
    { name: '烟雾病', disease: '烟雾病', desc: 'MR/TCD示双侧颈内动脉末端狭窄或闭塞，基底节区异常血管网', insert: '双侧颈内动脉末端可见狭窄闭塞，基底节区可见增多纡曲的侧支血管影，呈"烟雾状"。', typical: ['烟雾病', '脑血管闭塞'], tags: ['烟雾病', '侧支循环', '血管网'], modality: ['MR', 'DSA'], diseaseType: '血管病变' },
    { name: '动脉瘤', disease: '脑动脉瘤', desc: 'CTA/MRA/DSA示颅内动脉局限性扩张或囊状突起', insert: '右侧大脑中动脉M1段可见约XXmm囊状突起，瘤颈约XXmm，考虑动脉瘤。', typical: ['动脉瘤', '蛛网膜下腔出血'], tags: ['动脉瘤', '血管扩张', '急症'], modality: ['CTA', 'MRA', 'DSA'], diseaseType: '血管病变' },
    { name: '脑血管狭窄', disease: '脑血管狭窄', desc: 'CTA/MRA/DSA示脑血管局限性狭窄或闭塞', insert: '左侧大脑中动脉M1段可见局限性狭窄，狭窄率约50%。', typical: ['动脉粥样硬化', '脑梗死'], tags: ['狭窄', '动脉粥样硬化', '血管'], modality: ['CTA', 'MRA', 'DSA'], diseaseType: '血管病变' },
    { name: '皮层下动脉硬化性脑病', disease: 'Binswanger病', desc: 'MR示脑室周围及半卵圆中心对称性白质病变', insert: '双侧脑室周围及半卵圆中心可见对称性FLAIR高信号，符合皮层下动脉硬化性脑病。', typical: ['皮层下动脉硬化性脑病', '高血压'], tags: ['白质病变', '硬化性'], modality: ['MR'], diseaseType: '血管病变' },
    { name: '橄榄桥脑小脑萎缩', disease: 'OPCA', desc: 'MR示桥脑、小脑萎缩，第四脑室扩大', insert: '桥脑及双侧小脑半球萎缩，第四脑室轻度扩大。', typical: ['橄榄桥脑小脑萎缩', '遗传性共济失调'], tags: ['萎缩', '小脑', 'OPCA'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '肝豆状核变性', disease: '肝豆状核变性', desc: 'MR/CT示双侧豆状核对称性异常信号或钙化', insert: '双侧豆状核及丘脑可见对称性T2WI高信号，边界模糊。', typical: ['肝豆状核变性', '铜代谢障碍'], tags: ['铜代谢', '基底节'], modality: ['MR', 'CT'], diseaseType: '先天畸形' },
    { name: '一氧化碳中毒', disease: '一氧化碳中毒', desc: 'CT/MR示苍白球对称性低密度或T2WI高信号', insert: '双侧苍白球可见对称性异常信号，T1WI低信号，T2WI高信号，边界清楚。', typical: ['一氧化碳中毒', '缺血缺氧性脑病'], tags: ['苍白球', '中毒', '对称'], modality: ['CT', 'MR'], diseaseType: '炎症' },
  ]

  headFindings.forEach(f => {
    findings.push({
      id: `H${String(id++).padStart(3, '0')}`,
      bodyPart: '头部',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'brain',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  // 胸部 (40条)
  const chestFindings = [
    { name: '分叶征', disease: '周围型肺癌', desc: '肺结节或肿块边缘可见深分叶或浅分叶，提示恶性可能', insert: '右肺上叶可见约XXcm结节，边缘可见深分叶改变，毛刺征阳性。', typical: ['周围型肺癌', '肺转移瘤'], tags: ['分叶征', '恶性', '结节'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '毛刺征', disease: '周围型肺癌', desc: '肺结节边缘可见细短毛刺影，是恶性肿瘤特征之一', insert: '左肺下叶背段可见约XXcm结节，边缘可见多发细短毛刺。', typical: ['周围型肺癌', '结核球'], tags: ['毛刺征', '恶性', '结节'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '胸腔积液', disease: '胸腔积液', desc: 'CT示胸膜腔内液体密度影，外侧肋胸膜下单弧形液性密度', insert: '右侧胸腔可见弧形液性密度影，范围约XXcm，CT值约10Hu。', typical: ['肺炎', '结核性胸膜炎', '心衰', '恶性肿瘤'], tags: ['胸腔积液', '液体', '胸水'], modality: ['CT', 'DR'], diseaseType: '炎症' },
    { name: '肺不张', disease: '肺不张', desc: 'CT示肺叶或肺段体积缩小，密度增高，纵隔向患侧移位', insert: '左肺上叶体积缩小，呈软组织密度影，斜裂向前移位，纵隔左偏。', typical: ['中央型肺癌', '痰栓', '异物'], tags: ['肺不张', '肺体积缩小'], modality: ['CT', 'DR'], diseaseType: '炎症' },
    { name: '空洞', disease: '肺结核空洞', desc: 'CT示肺内空洞性病变，洞壁可厚可薄，内壁可光滑或毛糙', insert: '右肺上叶尖段可见空洞性病变，大小约XXcm，洞壁厚薄不均，内壁不光整。', typical: ['肺结核', '肺癌空洞', '肺脓肿'], tags: ['空洞', '坏死', '感染'], modality: ['CT'], diseaseType: '炎症' },
    { name: '结节', disease: '肺结节', desc: 'CT示肺内圆形或类圆形小结节灶，直径≤3cm', insert: '右肺中叶可见一枚磨玻璃结节，大小约XXmm，边界清楚。', typical: ['肺癌', '结核', '炎性假瘤'], tags: ['结节', '磨玻璃', '实性'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '磨玻璃影', disease: '新冠肺炎', desc: 'CT示肺内淡薄云雾状密度增高影，密度介于正常肺与实变之间', insert: '双肺可见多发磨玻璃密度影，呈斑片状分布，病变以胸膜下分布为主。', typical: ['新冠肺炎', '过敏性肺炎', '早期肺癌'], tags: ['磨玻璃', 'GGO', '感染'], modality: ['CT'], diseaseType: '炎症' },
    { name: '实变', disease: '肺炎', desc: 'CT示肺内大片状或节段性密度增高影，肺纹理消失', insert: '右肺上叶可见大片状实变影，实变区内肺纹理消失，可见支气管充气征。', typical: ['细菌性肺炎', '大叶性肺炎'], tags: ['实变', '含气支气管征', '感染'], modality: ['CT', 'DR'], diseaseType: '炎症' },
    { name: '空气支气管征', disease: '肺炎', desc: 'CT示实变区内可见含气支气管影，提示肺泡充填病变', insert: '左肺下叶实变区内可见多支支气管充气影，走行自然。', typical: ['肺炎', '肺水肿', '肺癌'], tags: ['空气支气管征', '支气管', '实变'], modality: ['CT'], diseaseType: '炎症' },
    { name: '铺路石征', disease: '肺泡蛋白沉积症', desc: 'CT示磨玻璃影内可见增厚的小叶间隔，呈铺路石样改变', insert: '双肺可见对称性磨玻璃影，其内可见网格状增厚小叶间隔，呈"铺路石征"。', typical: ['肺泡蛋白沉积症', '新冠肺炎', '肺水肿'], tags: ['铺路石征', '小叶间隔'], modality: ['CT'], diseaseType: '炎症' },
    { name: '马赛克灌注', disease: '闭塞性细支气管炎', desc: 'CT示肺内灌注不均匀，呈马赛克样改变', insert: '双肺可见区域性密度差异，灌注不均匀，呈马赛克样改变。', typical: ['闭塞性细支气管炎', '哮喘'], tags: ['马赛克灌注', '灌注不均'], modality: ['CT'], diseaseType: '炎症' },
    { name: '树芽征', disease: '支气管扩张并感染', desc: 'CT示终末细支气管和肺泡充填，呈树枝发芽状', insert: '双肺可见多发树芽征，沿支气管分布，以双下肺为著。', typical: ['支气管扩张', '结核', '支气管炎'], tags: ['树芽征', '小气道'], modality: ['CT'], diseaseType: '炎症' },
    { name: '支气管扩张', disease: '支气管扩张', desc: 'CT示支气管内径大于伴行动脉，形成"印戒征"', insert: '左肺下叶可见支气管呈柱状扩张，支气管内径明显大于邻近肺动脉。', typical: ['支气管扩张', '慢阻肺'], tags: ['支气管扩张', '印戒征'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肺气肿', disease: '肺气肿', desc: 'CT示肺野透亮度增加，肺纹理稀疏，肺大泡形成', insert: '双肺上叶可见多发肺大泡形成，较大者约XXcm，肺气肿改变。', typical: ['慢阻肺', '吸烟'], tags: ['肺气肿', '肺大泡'], modality: ['CT'], diseaseType: '炎症' },
    { name: '间质性改变', disease: '间质性肺炎', desc: 'CT示肺间质增厚、网格影、蜂窝影', insert: '双肺可见网格状阴影，以肺外围及胸膜下分布为主，伴少许磨玻璃密度。', typical: ['间质性肺炎', '结缔组织病'], tags: ['间质改变', '网格影'], modality: ['CT'], diseaseType: '炎症' },
    { name: '粟粒结节', disease: '粟粒性肺结核', desc: 'CT示肺内弥漫分布的粟粒大小结节，直径1-3mm', insert: '双肺可见弥漫分布的粟粒样结节，大小约2-3mm，分布均匀，密度一致。', typical: ['粟粒性肺结核', '转移瘤', '尘肺'], tags: ['粟粒', '小结节', '弥漫'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肿块', disease: '中央型肺癌', desc: 'CT示肺门区肿块影，边缘不规则，可伴远端肺不张', insert: '右肺门可见约XXcm肿块影，边缘毛糙，右肺上叶可见阻塞性不张。', typical: ['中央型肺癌', '肺门转移'], tags: ['肿块', '肺门', '阻塞'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '纵隔淋巴结肿大', disease: '淋巴结转移', desc: 'CT示纵隔淋巴结短径>10mm，形态饱满，均匀或不均匀强化', insert: '纵隔内可见多发肿大淋巴结，较大者位于4R区，约XXmm，短径约XXmm。', typical: ['肺癌淋巴结转移', '淋巴瘤', '结核'], tags: ['淋巴结', '纵隔', '转移'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '心包积液', disease: '心包积液', desc: 'CT/MR示心包腔内液性密度影，CT值可高可低', insert: '心包腔内可见弧形液性密度影，右室前壁前方液层厚约XXmm。', typical: ['心衰', '炎症', '恶性肿瘤'], tags: ['心包积液', '液体', '心脏'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '心脏增大', disease: '心脏扩大', desc: 'X线/CT示心影增大，心胸比>0.5', insert: '心脏呈普大型，心胸比约0.6，肺动脉段突出。', typical: ['心衰', '心肌病', '心包积液'], tags: ['心脏增大', '心胸比'], modality: ['DR', 'CT'], diseaseType: '炎症' },
    { name: '肺动脉栓塞', disease: '肺动脉栓塞', desc: 'CTPA示肺动脉内充盈缺损，血流中断', insert: '右肺下叶肺动脉分支可见充盈缺损，管腔完全阻塞。', typical: ['肺栓塞', '深静脉血栓'], tags: ['肺栓塞', '血栓', '急症'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '主动脉夹层', disease: '主动脉夹层', desc: 'CTA/MRA示主动脉内膜片剥离，形成真假腔', insert: '胸主动脉可见线状内膜片，将管腔分为真假两腔，破口位于主动脉弓。', typical: ['主动脉夹层', '高血压', '马凡综合征'], tags: ['夹层', '内膜片', '急症'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
    { name: '主动脉瘤', disease: '主动脉瘤', desc: 'CTA/MRA示主动脉局限性扩张，直径>正常1.5倍', insert: '腹主动脉肾门水平可见局限性扩张，直径约XXmm，瘤壁可见钙化。', typical: ['主动脉瘤', '动脉粥样硬化'], tags: ['动脉瘤', '扩张', '血管'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
    { name: '胸壁肿块', disease: '胸壁肿瘤', desc: 'CT示胸壁软组织肿块，可侵及肋骨或胸膜', insert: '左侧胸壁可见软组织肿块，大小约XXcm，密度均匀，相邻肋骨未见明确骨质破坏。', typical: ['胸壁肿瘤', '转移瘤'], tags: ['胸壁', '肿块', '软组织'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '气胸', disease: '气胸', desc: 'CT示胸膜腔内无肺纹理区域，肺组织被压缩', insert: '左侧胸膜腔内可见无肺纹理区，左肺组织被压缩约XX%。', typical: ['外伤', '自发性气胸', '肺大泡破裂'], tags: ['气胸', '无肺纹理', '急症'], modality: ['CT', 'DR'], diseaseType: '外伤' },
    { name: '液气胸', disease: '液气胸', desc: 'CT示胸膜腔内同时存在气体和液体', insert: '右侧胸膜腔内可见气液平面，肺组织被压缩约XX%。', typical: ['外伤', '感染', '手术后'], tags: ['液气胸', '气液平面'], modality: ['CT', 'DR'], diseaseType: '外伤' },
    { name: '肺大泡', disease: '肺大泡', desc: 'CT示肺内薄壁无结构的气腔，直径>1cm', insert: '右肺尖可见一薄壁无结构气腔，大小约XXcm，边界清楚。', typical: ['肺气肿', '慢阻肺'], tags: ['肺大泡', '无结构', '气腔'], modality: ['CT'], diseaseType: '炎症' },
    { name: '胸膜增厚', disease: '胸膜增厚', desc: 'CT示胸膜厚度增加，可有线样、结节样或广泛增厚', insert: '左侧肋胸膜呈线样增厚，厚度约3mm，余胸膜未见异常。', typical: ['胸膜炎', '结核', '恶性肿瘤'], tags: ['胸膜增厚', '胸膜'], modality: ['CT'], diseaseType: '炎症' },
    { name: '胸膜钙化', disease: '胸膜钙化', desc: 'CT示胸膜呈高密度钙化影，CT值>100Hu', insert: '左侧胸膜可见斑片状钙化，CT值约200Hu，边界清楚。', typical: ['结核性胸膜炎', '石棉肺'], tags: ['钙化', '胸膜'], modality: ['CT'], diseaseType: '炎症' },
    { name: '膈疝', disease: '膈疝', desc: 'CT示腹腔内容物通过膈肌缺损进入胸腔', insert: '左侧膈肌可见局部缺损，胃底及部分肠管疝入左侧胸腔。', typical: ['先天性膈疝', '外伤性膈疝'], tags: ['膈疝', '缺损', '先天'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '膈下游离气体', disease: '消化道穿孔', desc: 'X线/CT示膈下、新月形气体影', insert: '双侧膈下可见新月形游离气体影，右侧较著。', typical: ['消化道穿孔', '腹部手术后'], tags: ['游离气体', '穿孔', '急症'], modality: ['DR', 'CT'], diseaseType: '外伤' },
    { name: '乳腺肿块', disease: '乳腺癌', desc: '乳腺X线/超声示乳腺内肿块，边缘毛刺，密度不均匀', insert: '左侧乳腺外上象限可见约XXcm肿块，边缘可见毛刺，密度不均匀。', typical: ['乳腺癌', '纤维腺瘤'], tags: ['乳腺肿块', '毛刺', '恶性'], modality: ['MG', '超声'], diseaseType: '肿瘤' },
    { name: '簇状钙化', disease: '乳腺癌', desc: '乳腺X线示多发细小钙化聚集呈簇状，提示恶性', insert: '左乳外上象限可见簇状分布的细小多形性钙化，范围约XXmm。', typical: ['乳腺癌', '导管内癌'], tags: ['钙化', '簇状', '恶性'], modality: ['MG'], diseaseType: '肿瘤' },
    { name: '皮肤增厚', disease: '乳腺癌', desc: '乳腺X线/临床示患侧乳房皮肤局限性或弥漫性增厚', insert: '左侧乳房皮肤局限性增厚，厚度约XXmm，乳晕区为著。', typical: ['乳腺癌', '炎症性乳癌'], tags: ['皮肤增厚', '恶性'], modality: ['MG', '超声'], diseaseType: '肿瘤' },
    { name: '乳头内陷', disease: '乳腺癌', desc: '乳腺X线/临床示乳头向内偏移或固定', insert: '右侧乳头内陷，乳晕区皮肤皱缩。', typical: ['乳腺癌', '先天性'], tags: ['乳头内陷', '恶性'], modality: ['MG', '超声'], diseaseType: '肿瘤' },
    { name: '气管狭窄', disease: '气管肿瘤', desc: 'CT示气管内肿块或气管壁增厚，管腔狭窄', insert: '气管下段可见约XXcm肿块，突向管腔生长，管腔明显狭窄。', typical: ['气管肿瘤', '气管结核'], tags: ['气管狭窄', '肿块'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '支气管异物', disease: '支气管异物', desc: 'CT/MR示支气管内异物影，可伴阻塞性肺炎或肺不张', insert: '右中间段支气管内可见高密度影，大小约XXmm，相应肺组织可见阻塞性炎症。', typical: ['支气管异物', '呛咳'], tags: ['异物', '高密度', '急症'], modality: ['CT'], diseaseType: '外伤' },
    { name: '肺隔离症', disease: '肺隔离症', desc: 'CT示肺内异常供血的肿块，与正常肺隔离', insert: '左肺下叶可见囊性肿块，CT增强扫描可见异常供血动脉来自胸主动脉。', typical: ['肺隔离症', '先天畸形'], tags: ['隔离症', '异常血供', '先天'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '动静脉瘘', disease: '肺动静脉瘘', desc: 'CT/MRA示肺动静脉直接连通，扩张的血管团', insert: '右下肺可见纡曲扩张的血管影，CT增强扫描动脉期即见静脉早显。', typical: ['肺动静脉瘘', '遗传性出血性毛细血管扩张'], tags: ['AVF', '血管畸形', '先天'], modality: ['CTA', 'MRA'], diseaseType: '先天畸形' },
    { name: 'Kerley B线', disease: '肺水肿', desc: 'X线示肺野外侧带可见水平线状影，宽约1mm，长约1-2cm', insert: '双侧肺野可见水平走向的Kerley B线，以右下肺为著。', typical: ['肺水肿', '心衰', '二尖瓣狭窄'], tags: ['B线', '间质性肺水肿'], modality: ['DR'], diseaseType: '炎症' },
  ]

  chestFindings.forEach(f => {
    findings.push({
      id: `C${String(id++ - 30).padStart(3, '0')}`,
      bodyPart: '胸部',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'chest',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  // 腹部 (40条)
  const abdomenFindings = [
    { name: '肝囊肿', disease: '肝囊肿', desc: 'CT/MR示肝内圆形水样密度/信号灶，边缘清楚，无强化', insert: '肝右叶可见一枚无强化囊性灶，大小约XXcm，边界清楚，CT值约5Hu。', typical: ['先天性囊肿', '单纯性囊肿'], tags: ['囊肿', '囊性', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '肝硬化', disease: '肝硬化', desc: 'CT/MR示肝脏体积缩小，肝叶比例失调，表面呈波浪状，脾大', insert: '肝脏体积缩小，肝裂增宽，表面呈波浪状，脾脏增大，符合肝硬化表现。', typical: ['乙肝肝硬化', '酒精性肝硬化'], tags: ['肝硬化', '缩小', '脾大'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '腹水', disease: '腹水', desc: 'CT示腹腔内液性密度影，可游离或包裹性', insert: '肝脾周围可见弧形液性密度影，右侧肝肾陷凹可见约XXcm液性暗区。', typical: ['肝硬化', '恶性肿瘤', '心衰'], tags: ['腹水', '液体', '腹腔'], modality: ['CT', '超声'], diseaseType: '炎症' },
    { name: '肠梗阻', disease: '肠梗阻', desc: 'X线/CT示肠管扩张积气积液，气液平面', insert: '中上腹小肠肠管明显扩张积气，伴多发气液平面，肠袢排列如阶梯状。', typical: ['粘连性肠梗阻', '肿瘤', '粪石'], tags: ['肠梗阻', '气液平面', '急症'], modality: ['DR', 'CT'], diseaseType: '炎症' },
    { name: '胆结石', disease: '胆囊结石', desc: 'CT示胆囊内高密度或混杂密度结石影，MRI T2WI黑石头征', insert: '胆囊内可见多发结石影，较大者约XXcm，CT值约180Hu。', typical: ['胆囊结石', '胆总管结石'], tags: ['结石', '胆囊', '高密度'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '胰腺炎', disease: '急性胰腺炎', desc: 'CT示胰腺体积增大，密度减低，胰周渗出，肾前筋膜增厚', insert: '胰腺体积弥漫性增大，胰周可见片状渗出影，左侧肾前筋膜增厚。', typical: ['急性胰腺炎', '慢性胰腺炎急性发作'], tags: ['胰腺炎', '渗出', '急症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肝血管瘤', disease: '肝血管瘤', desc: 'CT/MR增强扫描示边缘结节样强化，逐渐向内填充，"快进慢出"', insert: '肝右叶可见约XXcm低密度影，增强扫描动脉期边缘呈结节样强化，门脉期及延迟期逐渐向内填充。', typical: ['肝血管瘤', '肝海绵状血管瘤'], tags: ['血管瘤', '强化模式', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '肝癌', disease: '肝细胞癌', desc: 'CT/MR示肝内肿块，"快进快出"强化模式，可有门脉癌栓', insert: '肝右叶可见约XXcm肿块，增强扫描动脉期明显强化，门脉期及延迟期快速廓清。', typical: ['肝细胞癌', '转移性肝癌'], tags: ['肝癌', '快进快出', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '肝转移瘤', disease: '肝转移瘤', desc: 'CT/MR示肝内多发大小不等肿块/结节，典型呈"牛眼征"', insert: '肝内可见多发大小不等肿块，较大者约XXcm，中心呈低密度，边缘环形强化，呈"牛眼征"。', typical: ['转移性肝癌', '多发转移'], tags: ['转移瘤', '牛眼征', '多发'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '脾大', disease: '脾大', desc: 'CT/MR示脾脏体积增大，超过正常大小，下缘超过肝下缘', insert: '脾脏体积增大，下缘超过肝下缘约XXcm，脾门处可见迂曲血管影。', typical: ['门脉高压', '血液病', '感染'], tags: ['脾大', '增大'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '肾囊肿', disease: '肾囊肿', desc: 'CT/MR示肾内圆形水样密度/信号灶，边缘薄壁，无强化', insert: '左肾可见一枚无强化囊性灶，大小约XXcm，边界清楚，CT值约8Hu。', typical: ['单纯性肾囊肿', '多囊肾'], tags: ['囊肿', '囊性', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '肾结石', disease: '泌尿系结石', desc: 'CT示肾内、输尿管内高密度影，CT值>200Hu', insert: '右肾盂可见高密度影，大小约XXmm，CT值约600Hu，符合结石表现。', typical: ['肾结石', '输尿管结石'], tags: ['结石', '高密度', '急症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肾积水', disease: '肾积水', desc: 'CT/MR/超声示肾盂肾盏扩张，呈液性密度/信号', insert: '右肾盂肾盏明显扩张，肾皮质变薄，扩张最宽处约XXmm。', typical: ['结石', '肿瘤', '先天狭窄'], tags: ['肾积水', '扩张', '梗阻'], modality: ['CT', 'MR', '超声'], diseaseType: '炎症' },
    { name: '肾上腺肿块', disease: '肾上腺腺瘤', desc: 'CT/MR示肾上腺区肿块，可有功能性或无功能性', insert: '左侧肾上腺可见约XXcm肿块，密度均匀，CT值约30Hu，增强扫描轻度强化。', typical: ['肾上腺腺瘤', '嗜铬细胞瘤', '转移瘤'], tags: ['肾上腺', '肿块', '腺瘤'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胃壁增厚', disease: '胃癌', desc: 'CT示胃壁局限性或弥漫性增厚，可有溃疡或肿块形成', insert: '胃窦部胃壁局限性增厚，最厚处约XXmm，可见溃疡形成。', typical: ['胃癌', '胃淋巴瘤'], tags: ['胃壁增厚', '恶性'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '肠壁增厚', disease: '肠癌', desc: 'CT示肠壁局限性增厚，可伴管腔狭窄或肿块', insert: '升结肠肠壁局限性增厚，厚度约XXmm，肠腔可见狭窄。', typical: ['结肠癌', '克罗恩病'], tags: ['肠壁增厚', '恶性'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '阑尾炎', disease: '急性阑尾炎', desc: 'CT示阑尾增粗肿大，直径>6mm，阑尾石，周围渗出', insert: '阑尾增粗，直径约XXmm，周围脂肪间隙浑浊，见少许渗出影。', typical: ['急性阑尾炎', '阑尾结石'], tags: ['阑尾炎', '增粗', '急症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '消化道穿孔', disease: '消化道穿孔', desc: 'CT/X线示膈下游离气体，腹腔积液积脓', insert: '双侧膈下可见弧形游离气体影，腹盆腔可见积液。', typical: ['消化道穿孔', '腹部外伤'], tags: ['穿孔', '游离气体', '急症'], modality: ['CT', 'DR'], diseaseType: '外伤' },
    { name: '肠系膜淋巴结肿大', disease: '肠系膜淋巴结炎', desc: 'CT示肠系膜区多发肿大淋巴结，短径>5mm', insert: '肠系膜根部可见多发肿大淋巴结，较大者约XXmm，短径约XXmm。', typical: ['肠系膜淋巴结炎', '转移瘤', '淋巴瘤'], tags: ['淋巴结', '肠系膜'], modality: ['CT'], diseaseType: '炎症' },
    { name: '腹膜后淋巴结肿大', disease: '腹膜后淋巴结转移', desc: 'CT/MR示腹主动脉、下腔静脉旁淋巴结肿大', insert: '腹主动脉旁可见多发肿大淋巴结，较大者约XXcm，融合成团。', typical: ['转移瘤', '淋巴瘤', '结核'], tags: ['淋巴结', '腹膜后', '转移'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胰腺癌', disease: '胰腺癌', desc: 'CT/MR示胰腺内肿块，边界不清，胰管扩张，侵犯血管', insert: '胰腺体部可见约XXcm肿块，边界不清，胰管全程扩张，肠系膜上动脉被包绕。', typical: ['胰腺癌', '胰腺囊腺癌'], tags: ['胰腺癌', '肿块', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胰腺囊肿', disease: '胰腺囊肿', desc: 'CT/MR示胰腺内囊性灶，可单发或多发', insert: '胰腺体部可见一枚无强化囊性灶，大小约XXcm，边界清楚。', typical: ['胰腺囊肿', 'IPMN'], tags: ['囊肿', '囊性', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '胆管扩张', disease: '胆管梗阻', desc: 'CT/MRCP示肝内或肝外胆管扩张', insert: '肝内胆管呈"软藤征"样扩张，左肝管宽约XXmm。', typical: ['胆管结石', '胆管癌', '胰头癌'], tags: ['胆管扩张', '梗阻', '软藤征'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '胆囊炎', disease: '急性胆囊炎', desc: 'CT/超声示胆囊增大，壁增厚>3mm，周围渗出', insert: '胆囊体积增大，壁弥漫性增厚，厚度约XXmm，胆囊窝可见积液。', typical: ['急性胆囊炎', '慢性胆囊炎急性发作'], tags: ['胆囊炎', '壁增厚', '急症'], modality: ['CT', '超声'], diseaseType: '炎症' },
    { name: '胆囊结石', disease: '胆囊结石', desc: 'CT示胆囊内高密度或低密度结石，MRI T2WI低信号', insert: '胆囊内可见多发结石影，较大者约XXcm，胆囊壁增厚。', typical: ['胆囊结石', '胆总管结石'], tags: ['结石', '胆囊'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '肝脏脂肪浸润', disease: '脂肪肝', desc: 'CT示肝脏密度减低，CT值低于脾脏，肝/脾CT比值<1', insert: '肝脏密度弥漫性减低，CT值约30Hu，肝/脾CT比值<1，符合脂肪肝。', typical: ['脂肪肝', '代谢性肝病'], tags: ['脂肪肝', '密度减低'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肝裂增宽', disease: '肝硬化', desc: 'CT/MR示肝裂间隙增宽，是肝硬化的重要征象', insert: '肝裂增宽，肝叶比例失调，表面呈波浪状，符合肝硬化表现。', typical: ['肝硬化', '慢乙肝'], tags: ['肝硬化', '肝裂'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '门脉高压', disease: '门脉高压', desc: 'CT/MR示脾大、腹水、门静脉增宽、侧支循环开放', insert: '门静脉宽约XXmm，脾静脉纡曲扩张，脾大，腹水，食管胃底静脉曲张。', typical: ['肝硬化', '门脉血栓'], tags: ['门脉高压', '侧支循环'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '门静脉血栓', disease: '门静脉血栓', desc: 'CT/MR示门静脉内充盈缺损或血栓形成', insert: '门静脉主干可见充盈缺损，范围约XXcm，管腔狭窄约50%。', typical: ['门静脉血栓', '肝硬化'], tags: ['血栓', '门静脉'], modality: ['CT', 'MR'], diseaseType: '血管病变' },
    { name: '腹主动脉瘤', disease: '腹主动脉瘤', desc: 'CTA示腹主动脉局限性扩张，直径>3cm', insert: '肾动脉水平腹主动脉可见局限性扩张，直径约XXmm，瘤壁可见钙化。', typical: ['腹主动脉瘤', '动脉粥样硬化'], tags: ['动脉瘤', '腹主动脉', '血管'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '下腔静脉血栓', disease: '下腔静脉血栓', desc: 'CT/MR示下腔静脉内充盈缺损或血栓', insert: '下腔静脉肝段可见充盈缺损，范围约XXcm，符合血栓表现。', typical: ['下腔静脉血栓', '下肢深静脉血栓'], tags: ['血栓', '下腔静脉'], modality: ['CT', 'MR'], diseaseType: '血管病变' },
    { name: '胃肠道间质瘤', disease: '胃肠道间质瘤', desc: 'CT示胃肠道来源的肿块，可有坏死囊变', insert: '胃小弯侧可见约XXcm肿块，密度不均匀，中心可见低密度坏死区。', typical: ['胃肠道间质瘤', 'GIST'], tags: ['间质瘤', '肿块', 'GIST'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '肠套叠', disease: '肠套叠', desc: 'CT示靶征/肠管内肿块影，同心圆样结构', insert: '右下腹可见肠管切面呈"靶征"，可见套入部与鞘部。', typical: ['肠套叠', '小儿急腹症'], tags: ['肠套叠', '靶征', '急症'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '结肠梗阻', disease: '结肠梗阻', desc: 'X线/CT示结肠扩张积气，肠管直径>6cm', insert: '横结肠明显扩张积气，肠管直径约XXcm，肠内容物较少。', typical: ['结肠癌', '肠粘连', '粪石'], tags: ['结肠梗阻', '扩张'], modality: ['DR', 'CT'], diseaseType: '炎症' },
    { name: '肝脓肿', disease: '肝脓肿', desc: 'CT/MR示肝内囊性占位，边缘环形强化，内部可见气液平面', insert: '肝右叶可见约XXcm囊性占位，边缘环形强化，内可见气液平面。', typical: ['细菌性肝脓肿', '阿米巴肝脓肿'], tags: ['脓肿', '环形强化', '感染'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '脾破裂', disease: '脾破裂', desc: 'CT示脾脏形态不完整，包膜下血肿，增强扫描脾脏不均匀强化', insert: '脾脏体积增大，脾实质可见线性低密度影，脾周可见弧形液性密度影。', typical: ['外伤性脾破裂', '病理性脾破裂'], tags: ['脾破裂', '外伤', '急症'], modality: ['CT'], diseaseType: '外伤' },
    { name: '肝破裂', disease: '肝破裂', desc: 'CT示肝脏形态不规则，可见线状低密度影或血肿', insert: '肝右叶可见线状低密度影，肝周可见弧形液性密度影。', typical: ['外伤性肝破裂'], tags: ['肝破裂', '外伤', '急症'], modality: ['CT'], diseaseType: '外伤' },
    { name: '腹膜后血肿', disease: '腹膜后血肿', desc: 'CT示腹膜后间隙内高密度影，可有分层现象', insert: '左侧腰大肌前方可见团块状高密度影，CT值约55Hu，边界清楚。', typical: ['外伤', '抗凝治疗', '主动脉瘤破裂'], tags: ['血肿', '腹膜后', '急症'], modality: ['CT'], diseaseType: '外伤' },
    { name: '腹腔脓肿', disease: '腹腔脓肿', desc: 'CT示腹腔内囊性占位，边缘不规则强化，内有气液平面', insert: '右下腹可见约XXcm囊性占位，边缘环形强化，内可见气液平面。', typical: ['阑尾脓肿', '术后感染'], tags: ['脓肿', '环形强化', '感染'], modality: ['CT'], diseaseType: '炎症' },
    { name: '子宫肌瘤', disease: '子宫肌瘤', desc: 'CT/MR示子宫内肿块，可有钙化，边界清楚', insert: '子宫前壁可见约XXcm肿块，边界清楚，增强扫描呈不均匀强化。', typical: ['子宫肌瘤', '子宫腺肌症'], tags: ['肌瘤', '子宫', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '卵巢囊肿', disease: '卵巢囊肿', desc: 'CT/MR/超声示卵巢区囊性灶，单房或多房', insert: '右侧卵巢可见约XXcm无强化囊性灶，边界清楚，CT值约8Hu。', typical: ['卵巢囊肿', '卵巢巧克力囊肿'], tags: ['囊肿', '卵巢', '囊性'], modality: ['CT', 'MR', '超声'], diseaseType: '先天畸形' },
  ]

  abdomenFindings.forEach(f => {
    findings.push({
      id: `A${String(id++ - 70).padStart(3, '0')}`,
      bodyPart: '腹部',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'abdomen',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  // 脊柱 (30条)
  const spineFindings = [
    { name: '椎体压缩性骨折', disease: '椎体压缩性骨折', desc: 'X线/CT/MR示椎体前缘或整个椎体变扁，楔形变', insert: '胸12椎体呈楔形变，前缘高度约为后缘的1/2，椎体边缘可见骨碎片。', typical: ['骨质疏松性骨折', '外伤性骨折', '病理性骨折'], tags: ['压缩骨折', '楔形变', '外伤'], modality: ['DR', 'CT', 'MR'], diseaseType: '外伤' },
    { name: '椎间盘突出', disease: '椎间盘突出症', desc: 'MR/CT示椎间盘向后方或侧方突出，压迫硬膜囊或神经根', insert: 'L4/5椎间盘向后方突出，约XXmm，压迫硬膜囊前缘，神经根未见明显受压。', typical: ['腰椎间盘突出', '颈椎间盘突出'], tags: ['椎间盘突出', '压迫', '退变'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '脊柱侧弯', disease: '脊柱侧弯', desc: 'X线/Cobb角测量示脊柱侧方弯曲，Cobb角>10°', insert: '脊柱胸腰段向右侧弯，Cobb角约XX°，椎体形态未见明显异常。', typical: ['特发性脊柱侧弯', '先天性脊柱侧弯'], tags: ['侧弯', 'Cobb角', '先天'], modality: ['DR'], diseaseType: '先天畸形' },
    { name: '椎管狭窄', disease: '椎管狭窄症', desc: 'MR/CT示椎管前后径减小，<10mm为重度狭窄', insert: 'L3/4、L4/5椎管前后径约8mm，椎管有效面积减小，硬膜囊受压。', typical: ['退变性椎管狭窄', '先天性椎管狭窄'], tags: ['椎管狭窄', '狭窄', '退变'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '椎体滑脱', disease: '椎体滑脱症', desc: 'X线/MR示上位椎体相对下位椎体向前或向后移位', insert: 'L4椎体相对L5椎体向前滑脱，约I度，相应椎弓根完整。', typical: ['椎弓峡部裂', '退变性滑脱'], tags: ['滑脱', '移位', '退变'], modality: ['DR', 'MR'], diseaseType: '炎症' },
    { name: '椎体骨髓水肿', disease: '椎体压缩骨折', desc: 'MR T2WI/STIR示椎体信号增高，提示急性期骨折', insert: '胸12椎体T2WI及STIR呈高信号，符合急性期骨髓水肿表现。', typical: ['急性压缩骨折', '椎体骨挫伤'], tags: ['骨髓水肿', 'STIR高信号', '急性'], modality: ['MR'], diseaseType: '外伤' },
    { name: '椎间盘变性', disease: '椎间盘退变', desc: 'MR T2WI示椎间盘信号减低，椎间隙变窄', insert: 'L3/4、L4/5椎间盘T2WI信号明显减低，椎间隙变窄。', typical: ['椎间盘退变', '老化'], tags: ['椎间盘变性', '信号减低', '退变'], modality: ['MR'], diseaseType: '炎症' },
    { name: '许莫尔结节', disease: '椎体内软骨结节', desc: 'X线/CT示椎体上下缘局限性凹陷，MR示液体信号充填', insert: 'L3椎体上缘可见局限性凹陷，凹陷区内可见液体信号充填。', typical: ['椎体内软骨结节', ' Scheuermann病'], tags: ['许莫尔结节', '软骨结节'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '韧带骨化', disease: '后纵韧带骨化', desc: 'CT/MR示后纵韧带或黄韧带增厚、骨化', insert: 'C3-C6水平后纵韧带可见条状骨化影，骨化率约30%，椎管狭窄。', typical: ['OPLL', 'OLF'], tags: ['韧带骨化', 'OPLL', '狭窄'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '椎体转移瘤', disease: '椎体转移瘤', desc: 'CT/MR示椎体溶骨性或成骨性破坏，可有病理性骨折', insert: '胸9椎体可见溶骨性破坏，CT值约35Hu，椎体后缘可见软组织肿块。', typical: ['椎体转移瘤', '恶性肿瘤'], tags: ['转移', '破坏', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '椎体血管瘤', disease: '椎体血管瘤', desc: 'CT/MR示椎体内粗大骨小梁呈"栅栏状"或"蜂窝状"改变', insert: 'T8椎体内可见"栅栏状"粗大骨小梁，CT/MR信号符合血管瘤特征。', typical: ['椎体血管瘤', '海绵状血管瘤'], tags: ['血管瘤', '栅栏征', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '椎体感染', disease: '椎体结核', desc: 'CT/MR示椎体骨质破坏，椎间隙狭窄，可有冷脓肿', insert: 'L2/3椎体骨质破坏，椎间隙狭窄，椎旁可见冷脓肿形成。', typical: ['脊柱结核', '化脓性脊柱炎'], tags: ['感染', '骨质破坏', '结核'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '硬膜外肿块', disease: '硬膜外肿瘤', desc: 'MR/CT示硬膜囊外肿块，可压迫脊髓或神经根', insert: 'T10水平硬膜囊前方可见约XXcm肿块，T1WI等信号，明显均匀强化。', typical: ['脊膜瘤', '神经鞘瘤', '转移瘤'], tags: ['硬膜外', '肿块', '肿瘤'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '脊髓空洞症', disease: '脊髓空洞症', desc: 'MR示脊髓内纵向走行的条状液体信号', insert: 'C2-T6段脊髓中央管扩张，呈条状T1WI低信号、T2WI高信号。', typical: ['脊髓空洞症', 'Chiari畸形'], tags: ['空洞', '脊髓', '先天'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '脊髓损伤', disease: '脊髓损伤', desc: 'MR T2WI示脊髓内高信号，可有出血、水肿', insert: 'T10水平脊髓内可见T2WI高信号，相应脊髓肿胀，考虑脊髓损伤。', typical: ['外伤性脊髓损伤', '脊髓压迫'], tags: ['脊髓损伤', '水肿', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '椎间盘游离', disease: '椎间盘游离症', desc: 'MR/CT示突出的椎间盘碎片脱离母盘，可向上下游离', insert: 'L4/5椎间盘后方可见游离碎片，向下游离约XXmm。', typical: ['椎间盘突出', '椎间盘脱垂'], tags: ['游离', '碎片', '突出'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '终板变性', disease: '椎间盘退变', desc: 'MR示椎体终板不规则、变薄，可有Modic改变', insert: 'L4/5椎体上缘终板不规则，T2WI信号减低，符合Modic I型改变。', typical: ['椎间盘退变', '终板炎'], tags: ['终板变性', 'Modic改变'], modality: ['MR'], diseaseType: '炎症' },
    { name: '小关节退变', disease: '小关节退变', desc: 'CT/MR示小关节突增生、肥大，关节间隙变窄', insert: 'L4/5双侧小关节突增生肥大，关节间隙变窄，关节囊肥厚。', typical: ['退变性脊椎病', '骨关节炎'], tags: ['小关节退变', '增生', '退变'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '椎旁脓肿', disease: '脊柱结核', desc: 'CT/MR示椎旁软组织肿胀/肿块，可有钙化', insert: 'T9-T11椎体旁可见梭形软组织肿块，边缘强化，内可见钙化。', typical: ['脊柱结核', '化脓性感染'], tags: ['脓肿', '结核', '感染'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '腰椎峡部裂', disease: '腰椎峡部裂', desc: 'CT/MR示椎弓峡部骨质连续性中断', insert: 'L5双侧椎弓峡部可见骨质不连，CT横断面示"双关节征"。', typical: ['椎弓峡部裂', '先天发育异常'], tags: ['峡部裂', '不连', '先天'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '颈椎过伸伤', disease: '颈椎过伸损伤', desc: 'MR/CT示椎前血肿、脊髓信号异常、后方韧带复合体损伤', insert: 'C4-C6椎前可见条状T1WI高信号血肿，相应节段脊髓内可见T2WI高信号。', typical: ['颈椎过伸损伤', '外伤'], tags: ['过伸伤', '血肿', '外伤'], modality: ['CT', 'MR'], diseaseType: '外伤' },
    { name: '椎体爆裂骨折', disease: '椎体爆裂骨折', desc: 'CT示椎体爆裂，骨片向四周移位，椎管狭窄', insert: 'L1椎体爆裂骨折，椎体前缘可见碎骨片向前移位，椎管狭窄约30%。', typical: ['外伤性爆裂骨折', '高处坠落'], tags: ['爆裂骨折', '碎片', '外伤'], modality: ['CT', 'MR'], diseaseType: '外伤' },
    { name: 'Hangman骨折', disease: 'Hangman骨折', desc: 'CT示枢椎椎弓峡部骨折，可伴C2滑脱', insert: 'C2双侧椎弓峡部可见骨质不连，断端无明显移位。', typical: ['Hangman骨折', '外伤'], tags: ['Hangman骨折', '峡部', '外伤'], modality: ['CT'], diseaseType: '外伤' },
    { name: ' Jefferson骨折', disease: 'Jefferson骨折', desc: 'CT示寰椎侧块骨折，爆裂样改变', insert: '寰椎前后弓及左侧块可见骨折线，右侧块向外侧移位。', typical: ['Jefferson骨折', '外伤'], tags: ['Jefferson骨折', '寰椎', '外伤'], modality: ['CT'], diseaseType: '外伤' },
    { name: '齿突骨折', disease: '齿突骨折', desc: 'CT/MR示枢椎齿突根部或尖部骨折线', insert: 'C2齿突基底部可见横行骨折线，断端无明显移位。', typical: ['齿突骨折', '外伤'], tags: ['齿突骨折', '骨折'], modality: ['CT', 'MR'], diseaseType: '外伤' },
    { name: '胸椎骨折', disease: '胸椎骨折', desc: 'X线/CT示胸椎椎体形态异常，可有楔形变或爆裂', insert: 'T7椎体呈楔形变，前缘高度约为后缘的2/3，椎体边缘可见骨片。', typical: ['外伤性骨折', '骨质疏松'], tags: ['胸椎骨折', '楔形变', '外伤'], modality: ['DR', 'CT'], diseaseType: '外伤' },
    { name: '骶髂关节炎', disease: '强直性脊柱炎', desc: 'CT/MR示骶髂关节面侵蚀、硬化，关节间隙狭窄或融合', insert: '双侧骶髂关节面可见骨质侵蚀、硬化，关节间隙狭窄，符合AS表现。', typical: ['强直性脊柱炎', '银屑病关节炎'], tags: ['骶髂关节炎', '侵蚀', 'AS'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '布氏杆菌性脊柱炎', disease: '布氏杆菌性脊柱炎', desc: 'CT/MR示椎体边缘骨质破坏，可有死骨形成', insert: 'L3/4椎体边缘可见多发骨质破坏，破坏区周围骨质硬化，可见死骨。', typical: ['布氏杆菌病', '脊柱感染'], tags: ['布氏杆菌', '骨质破坏', '感染'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '椎体Modic改变', disease: '椎体终板退变', desc: 'MR示椎体终板及临近骨髓信号改变，分I/II/III型', insert: 'L4/5椎体下缘终板及临近骨髓呈T1WI低信号、T2WI高信号，符合Modic I型改变。', typical: ['椎间盘退变', '终板炎'], tags: ['Modic改变', '终板', '退变'], modality: ['MR'], diseaseType: '炎症' },
    { name: '脊柱结核', disease: '脊柱结核', desc: 'CT/MR示多椎体骨质破坏、椎间隙狭窄、寒性脓肿', insert: 'T8-T10椎体骨质破坏，椎间隙狭窄，椎旁可见梭形脓肿，内有钙化。', typical: ['脊柱结核', '骨结核'], tags: ['结核', '骨质破坏', '脓肿'], modality: ['CT', 'MR'], diseaseType: '炎症' },
  ]

  spineFindings.forEach(f => {
    findings.push({
      id: `S${String(id++ - 110).padStart(3, '0')}`,
      bodyPart: '脊柱',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'spine',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  // 四肢 (40条)
  const extremityFindings = [
    { name: '骨折', disease: '骨折', desc: 'X线/CT示骨皮质的连续性中断，可有移位、成角', insert: '右侧尺骨可见斜形骨折线，断端无明显移位。', typical: ['外伤性骨折', '病理性骨折'], tags: ['骨折', '外伤'], modality: ['DR', 'CT'], diseaseType: '外伤' },
    { name: '骨肿瘤', disease: '骨肿瘤', desc: 'X线/CT/MR示骨的肿瘤性病变，有溶骨性或成骨性改变', insert: '右股骨下端可见约XXcm溶骨性骨质破坏，边界不清，骨皮质中断。', typical: ['骨肉瘤', '骨转移瘤', '骨囊肿'], tags: ['骨肿瘤', '破坏', '恶性'], modality: ['DR', 'CT', 'MR'], diseaseType: '肿瘤' },
    { name: '关节炎', disease: '关节炎', desc: 'X线/CT示关节面硬化、骨赘形成、关节间隙狭窄', insert: '双膝关节面骨质硬化，边缘可见骨赘形成，关节间隙狭窄。', typical: ['骨关节炎', '类风湿性关节炎'], tags: ['关节炎', '骨赘', '退变'], modality: ['DR', 'CT'], diseaseType: '炎症' },
    { name: '韧带损伤', disease: '韧带损伤', desc: 'MR示韧带信号异常、连续性中断、周围水肿', insert: '前交叉韧带信号增高，连续性部分中断，周围可见水肿信号。', typical: ['ACL损伤', 'MCL损伤'], tags: ['韧带损伤', 'ACL', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '半月板损伤', disease: '半月板损伤', desc: 'MR示半月板内异常信号，达关节面或游离缘', insert: '内侧半月板后角可见线状异常信号，达关节面边缘，符合III度损伤。', typical: ['半月板撕裂', '退变'], tags: ['半月板损伤', '撕裂', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '骨挫伤', disease: '骨挫伤', desc: 'MR T2WI/STIR示骨内片状高信号，X线/CT常阴性', insert: '股骨外侧踝可见片状STIR高信号，X线片未见明确异常，考虑骨挫伤。', typical: ['外伤性骨挫伤', '隐匿性骨折'], tags: ['骨挫伤', 'STIR高信号', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '软组织肿块', disease: '软组织肿瘤', desc: 'CT/MR示软组织内肿块，可有坏死、钙化', insert: '左大腿中段前外侧肌群内可见约XXcm肿块，边界不清，信号不均。', typical: ['肉瘤', '转移瘤', '良性肿瘤'], tags: ['软组织肿块', '肿瘤'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '腱鞘囊肿', disease: '腱鞘囊肿', desc: 'MR/超声示肌腱旁囊性肿块，与关节腔相通', insert: '右腕背侧可见约XXcm囊性肿块，T1WI低信号，T2WI高信号，与舟月韧带关系密切。', typical: ['腱鞘囊肿', '腕关节囊肿'], tags: ['囊肿', '腱鞘', '良性'], modality: ['MR', '超声'], diseaseType: '先天畸形' },
    { name: '肩袖撕裂', disease: '肩袖损伤', desc: 'MR示肩袖肌腱信号中断或连续性消失', insert: '冈上肌腱远端附着处可见信号连续性中断，断端回缩约XXmm。', typical: ['肩袖撕裂', '外伤', '退变'], tags: ['肩袖撕裂', '肌腱', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '股骨头坏死', disease: '股骨头坏死', desc: 'MR/CT示股骨头信号异常，形态改变，塌陷', insert: '左侧股骨头可见T1WI线性低信号，T2WI"双线征"，股骨头轻度塌陷。', typical: ['股骨头坏死', '股骨头骨折'], tags: ['股骨头坏死', '双线征', '缺血'], modality: ['CT', 'MR'], diseaseType: '血管病变' },
    { name: '骨髓水肿', disease: '骨髓水肿', desc: 'MR T2WI/STIR示骨髓内高信号，提示水肿或充血', insert: '胫骨平台可见片状STIR高信号，符合骨髓水肿表现。', typical: ['外伤', '炎症', '应力性损伤'], tags: ['骨髓水肿', 'STIR高信号'], modality: ['MR'], diseaseType: '炎症' },
    { name: '关节积液', disease: '关节积液', desc: 'MR/超声示关节囊内液体信号/无回声区', insert: '右膝关节髌上囊可见弧形液体信号，厚约XXmm，符合关节积液表现。', typical: ['外伤', '炎症', '退变'], tags: ['关节积液', '液体'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '滑膜炎', disease: '滑膜炎', desc: 'MR示关节滑膜增厚、信号异常，可有强化', insert: '右踝关节滑膜弥漫性增厚，T2WI呈等高信号，增强扫描明显强化。', typical: ['类风湿性关节炎', '感染性滑膜炎'], tags: ['滑膜炎', '增厚', '炎症'], modality: ['MR'], diseaseType: '炎症' },
    { name: '腱鞘炎', disease: '腱鞘炎', desc: 'MR/超声示腱鞘周围水肿、增厚，可有强化', insert: '右手屈肌腱鞘可见T2WI高信号，腱鞘周围软组织肿胀。', typical: ['腱鞘炎', '狭窄性腱鞘炎'], tags: ['腱鞘炎', '水肿', '炎症'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '肌肉撕裂', disease: '肌肉撕裂伤', desc: 'MR示肌肉纤维连续性中断，可有血肿形成', insert: '右腓肠肌内侧头可见肌纤维连续性中断，局部可见T1WI高信号血肿。', typical: ['肌肉拉伤', '外伤'], tags: ['肌肉撕裂', '血肿', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '骨化性肌炎', disease: '骨化性肌炎', desc: 'CT/MR示软组织内异位骨化，可有成熟分层现象', insert: '左大腿软组织内可见约XXcm异常钙化影，CT呈层状骨化表现。', typical: ['骨化性肌炎', '外伤后遗'], tags: ['骨化性肌炎', '钙化', '外伤'], modality: ['CT', 'MR'], diseaseType: '外伤' },
    { name: '骨质破坏', disease: '骨肿瘤或感染', desc: 'CT/MR示骨组织被肿瘤或炎症组织取代', insert: '右胫骨近端可见溶骨性骨质破坏，骨皮质中断，边界不清。', typical: ['骨肉瘤', '骨髓炎', '转移瘤'], tags: ['骨质破坏', '恶性', '感染'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '骨质增生', disease: '骨质增生', desc: 'X线/CT示骨皮质增厚、骨赘形成、骨密度增高', insert: '右膝关节边缘可见唇样骨赘形成，骨质密度增高。', typical: ['骨关节炎', '退变'], tags: ['骨质增生', '骨赘', '退变'], modality: ['DR', 'CT'], diseaseType: '炎症' },
    { name: '骨膜反应', disease: '骨膜反应', desc: 'X线/CT示骨膜呈层状、放射状或Codman三角', insert: '右股骨远端可见层状骨膜反应，骨膜掀起处可见Codman三角。', typical: ['骨肉瘤', '骨髓炎', '外伤'], tags: ['骨膜反应', 'Codman三角', '恶性'], modality: ['DR', 'CT'], diseaseType: '肿瘤' },
    { name: '关节脱位', disease: '关节脱位', desc: 'X线/CT/MR示关节面对应关系失常', insert: '右肩关节盂下脱位，肱骨头位于关节盂下方，伴肱骨大结节骨折。', typical: ['肩关节脱位', '外伤'], tags: ['脱位', '外伤', '急症'], modality: ['DR', 'CT'], diseaseType: '外伤' },
    { name: '先天畸形', disease: '四肢先天畸形', desc: 'X线/CT/MR示骨骼或软组织的先天发育异常', insert: '右手拇指可见多指畸形，可见三指拇指骨骼结构。', typical: ['多指畸形', '并指畸形', '马德隆畸形'], tags: ['先天畸形', '发育异常'], modality: ['DR', 'CT', 'MR'], diseaseType: '先天畸形' },
    { name: '血管瘤', disease: '软组织血管瘤', desc: 'MR示软组织内异常信号，可有流空效应或静脉石', insert: '左小腿肌肉内可见约XXcm异常信号，T2WI明显高信号，内可见流空血管影。', typical: ['海绵状血管瘤', '毛细血管瘤'], tags: ['血管瘤', 'T2WI高信号'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '神经鞘瘤', disease: '神经鞘瘤', desc: 'MR/CT示沿神经走行的肿块，可有"靶征"', insert: '右臀部可见约XXcm肿块，T2WI呈靶征，肿块与坐骨神经关系密切。', typical: ['神经鞘瘤', '神经纤维瘤'], tags: ['神经鞘瘤', '靶征', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '骨梗死', disease: '骨梗死', desc: 'MR示骨髓内地图样不规则病变，边缘呈T1WI低信号、T2WI高信号', insert: '左股骨下端可见地图样病变，边缘呈T1WI低信号、T2WI高信号。', typical: ['骨梗死', 'SLE', '潜水病'], tags: ['骨梗死', '地图样', '缺血'], modality: ['MR'], diseaseType: '血管病变' },
    { name: '痛风结节', disease: '痛风', desc: 'CT/MR示软组织内尿酸盐沉积，可有钙化', insert: '右第一跖趾关节周围可见软组织肿块，内可见多发点状钙化。', typical: ['痛风', '尿酸盐沉积'], tags: ['痛风', '结节', '代谢'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '类风湿结节', disease: '类风湿性关节炎', desc: 'MR/超声示关节周围皮下结节，可有强化', insert: '右肘关节肱桡肌附着处可见约XXcm结节，T1WI等信号，明显均匀强化。', typical: ['类风湿性关节炎'], tags: ['类风湿结节', '皮下结节'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '骨溶解', disease: '大量骨质溶解症', desc: 'CT/MR示骨质进行性溶解消失，无成骨反应', insert: '右侧锁骨可见大片骨质溶解，骨结构消失，边界不清，无骨膜反应。', typical: ['大量骨质溶解症', 'Gorham病'], tags: ['骨溶解', '消失', '先天'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '应力性骨折', disease: '应力性骨折', desc: 'X线/CT示骨皮质不规则增厚，可见不完全骨折线', insert: '右胫骨中段可见斜形骨折线，局部骨皮质增厚，无明显移位。', typical: ['应力性骨折', '疲劳骨折'], tags: ['应力骨折', '疲劳', '外伤'], modality: ['DR', 'CT'], diseaseType: '外伤' },
    { name: '病理性骨折', disease: '病理性骨折', desc: 'X线/CT/MR示在病变基础上发生的骨折', insert: '左股骨粗隆间可见骨折线，骨折端骨质结构异常，见溶骨性破坏。', typical: ['骨转移瘤', '骨囊肿', '骨髓瘤'], tags: ['病理性骨折', '恶性'], modality: ['DR', 'CT', 'MR'], diseaseType: '肿瘤' },
    { name: '骨膜下血肿', disease: '骨膜下血肿', desc: 'CT/MR示紧贴骨皮质的梭形血肿信号', insert: '右股骨外侧可见梭形T1WI高信号，压迫骨皮质，边界清楚。', typical: ['外伤', '血友病'], tags: ['血肿', '骨膜下', '外伤'], modality: ['CT', 'MR'], diseaseType: '外伤' },
    { name: '肌腱断裂', disease: '肌腱断裂', desc: 'MR示肌腱连续性完全中断，断端可回缩', insert: '右侧跟腱连续性完全中断，断端间距约XXmm，跟骨附着处可见残端。', typical: ['跟腱断裂', '外伤'], tags: ['肌腱断裂', '跟腱', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '黏液样囊肿', disease: '腱鞘囊肿', desc: 'MR/超声示紧邻骨的囊性肿块，可有骨侵蚀', insert: '左拇指远节指骨基底旁可见约XXcm囊性肿块，局部骨皮质受压侵蚀。', typical: ['腱鞘囊肿', '黏液样囊肿'], tags: ['囊肿', '黏液', '良性'], modality: ['MR', '超声'], diseaseType: '先天畸形' },
    { name: '色素沉着绒毛结节性滑膜炎', disease: 'PVNS', desc: 'MR示关节滑膜弥漫性增厚，T1WI/T2WI呈低信号', insert: '右膝关节滑膜弥漫性增厚，T1WI/T2WI呈低信号，含铁血黄素沉积。', typical: ['PVNS', '滑膜肿瘤'], tags: ['PVNS', '含铁血黄素', '滑膜'], modality: ['MR'], diseaseType: '肿瘤' },
    { name: '艾唐奈综合征', disease: '艾唐奈综合征', desc: 'MR示三角肌脂肪瘤样浸润，肩袖撕裂', insert: '右肩三角肌可见脂肪浸润样信号，冈上肌腱可见III度撕裂。', typical: ['肩袖撕裂', '三角肌脂肪浸润'], tags: ['艾唐奈综合征', '脂肪浸润'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: 'Pilon骨折', disease: 'Pilon骨折', desc: 'CT示胫骨远端平台骨折，伴关节面压缩', insert: '左胫骨远端可见粉碎性骨折，关节面严重压缩，骨碎片移位。', typical: ['Pilon骨折', '高处坠落'], tags: ['Pilon骨折', '关节面', '外伤'], modality: ['CT'], diseaseType: '外伤' },
    { name: ' Maisonneuve骨折', disease: 'Maisonneuve骨折', desc: 'X线/CT示腓骨近段骨折伴踝关节损伤', insert: '左腓骨近段可见骨折线，同时可见内踝骨折，踝穴增宽。', typical: ['Maisonneuve骨折', '外伤'], tags: ['Maisonneuve骨折', '腓骨', '外伤'], modality: ['DR', 'CT'], diseaseType: '外伤' },
    { name: 'Lisfranc损伤', disease: 'Lisfranc损伤', desc: 'X线/CT示跗跖关节脱位或半脱位', insert: '左足第二跖骨基底部可见向外侧移位，Lisfranc关节不稳。', typical: ['Lisfranc损伤', '外伤'], tags: ['Lisfranc', '脱位', '外伤'], modality: ['DR', 'CT'], diseaseType: '外伤' },
    { name: '三平面骨折', disease: '三平面骨折', desc: 'CT/MR示涉及骨骺、干骺端、关节面的复杂骨折', insert: '右胫骨远端可见三平面骨折，骨骺向后移位，干骺端可见骨折线。', typical: ['三平面骨折', '青少年'], tags: ['三平面骨折', '骨骺', '外伤'], modality: ['CT', 'MR'], diseaseType: '外伤' },
    { name: '距骨坏死', disease: '距骨坏死', desc: 'MR/CT示距骨形态改变，骨密度不均，可见塌陷', insert: '左距骨穹窿部可见T1WI低信号区，形态略扁，软骨下骨板不连续。', typical: ['距骨坏死', '骨折后遗'], tags: ['距骨坏死', '塌陷', '缺血'], modality: ['CT', 'MR'], diseaseType: '血管病变' },
    { name: '月骨坏死', disease: '月骨坏死', desc: 'MR/CT示月骨形态改变，密度增高，可有碎裂', insert: '右腕月骨T1WI信号减低，形态略扁，骨皮质不规则。', typical: ['月骨坏死', 'Kienböck病'], tags: ['月骨坏死', '缺血性坏死'], modality: ['MR', 'CT'], diseaseType: '血管病变' },
  ]

  extremityFindings.forEach(f => {
    findings.push({
      id: `E${String(id++ - 140).padStart(3, '0')}`,
      bodyPart: '四肢',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'bone',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  // 血管 (20条)
  const vascularFindings = [
    { name: '动脉粥样硬化', disease: '动脉粥样硬化', desc: 'CTA/MRA示动脉壁增厚、钙化斑块形成，管腔狭窄', insert: '双侧颈内动脉C4-C6段可见多发非钙化及混合斑块，管腔轻度狭窄约20%。', typical: ['动脉粥样硬化', '脑梗死'], tags: ['动脉粥样硬化', '斑块', '狭窄'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
    { name: '动脉瘤', disease: '动脉瘤', desc: 'CTA/MRA/DSA示动脉壁局限性扩张，呈囊状或梭形', insert: '右侧大脑中动脉M1段可见约XXmm囊状突起，瘤颈约XXmm。', typical: ['动脉瘤', '蛛网膜下腔出血'], tags: ['动脉瘤', '囊状', '急症'], modality: ['CTA', 'MRA', 'DSA'], diseaseType: '血管病变' },
    { name: '深静脉血栓', disease: '深静脉血栓形成', desc: 'CTV/MR示深静脉内充盈缺损或血栓形成', insert: '左下肢深静脉可见充盈缺损，相应管腔狭窄约70%，血栓未强化。', typical: ['深静脉血栓', '肺栓塞'], tags: ['深静脉血栓', '血栓', '急症'], modality: ['CTV', 'MRV'], diseaseType: '血管病变' },
    { name: '肺栓塞', disease: '肺动脉栓塞', desc: 'CTPA示肺动脉内充盈缺损，可有"截断征"', insert: '右肺下叶肺动脉分支可见充盈缺损，管腔完全阻塞，呈"截断征"。', typical: ['肺栓塞', '深静脉血栓'], tags: ['肺栓塞', '截断征', '急症'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '夹层', disease: '主动脉夹层', desc: 'CTA/MRA示主动脉内膜片剥离，形成真假两腔', insert: 'Stanford A型主动脉夹层，破口位于升主动脉根部，真腔小，假腔大。', typical: ['主动脉夹层', '高血压', '马凡综合征'], tags: ['夹层', '内膜片', '急症'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
    { name: '血管狭窄', disease: '血管狭窄', desc: 'CTA/MRA/DSA示血管局限性或弥漫性狭窄', insert: '左侧颈内动脉C4段可见局限性狭窄，狭窄率约65%。', typical: ['动脉粥样硬化', '血管炎'], tags: ['狭窄', '动脉粥样硬化'], modality: ['CTA', 'MRA', 'DSA'], diseaseType: '血管病变' },
    { name: '血管畸形', disease: '血管畸形', desc: 'CTA/MRA/DSA示血管走形异常，可有AVF或发育异常', insert: '左顶叶可见动静脉畸形，供应动脉来自大脑中动脉，引流静脉入上矢状窦。', typical: ['AVM', '动静脉瘘'], tags: ['血管畸形', 'AVM'], modality: ['CTA', 'MRA', 'DSA'], diseaseType: '先天畸形' },
    { name: '静脉曲张', disease: '静脉曲张', desc: 'CT/MR示静脉扩张纡曲，可有瘤样扩张', insert: '左侧阴囊可见纡曲扩张的静脉丛，较宽处约XXmm。', typical: ['精索静脉曲张', '下肢静脉曲张'], tags: ['静脉曲张', '扩张'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '血管瘤', disease: '血管瘤', desc: 'CT/MR示血管来源的良性肿瘤，可有钙化或血栓', insert: '右额叶可见约XXcm异常血管团，CT可见钙化，引流静脉增粗。', typical: ['海绵状血管瘤', '毛细血管瘤'], tags: ['血管瘤', '先天', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '血栓形成', disease: '血栓形成', desc: 'CT/MR示血管内血栓，可有慢性期机化表现', insert: '下腔静脉肝段可见充盈缺损，呈卵圆形，边缘不光整，考虑慢性血栓。', typical: ['下腔静脉血栓', 'Budd-Chiari综合征'], tags: ['血栓', '慢性'], modality: ['CT', 'MR'], diseaseType: '血管病变' },
    { name: '血管炎', disease: '血管炎', desc: 'CTA/MRA示血管壁增厚、强化，可有管腔狭窄或扩张', insert: '双侧肾动脉开口处管壁增厚，强化明显，右侧肾动脉中度狭窄。', typical: ['大动脉炎', '结节性多动脉炎'], tags: ['血管炎', '管壁增厚'], modality: ['CTA', 'MRA'], diseaseType: '炎症' },
    { name: '假性动脉瘤', disease: '假性动脉瘤', desc: 'CTA/MRA示动脉壁破裂形成搏动性血肿，与动脉相通', insert: '右侧股动脉前方可见约XXcm囊性肿块，与股动脉相通，颈部宽约XXmm。', typical: ['外伤', '感染'], tags: ['假性动脉瘤', '外伤'], modality: ['CTA', 'MRA'], diseaseType: '外伤' },
    { name: '动脉闭塞', disease: '动脉闭塞', desc: 'CTA/MRA/DSA示动脉突然中断或完全不见显影', insert: '左侧大脑中动脉M1段以远未见显影，考虑闭塞。', typical: ['急性脑梗死', '动脉血栓'], tags: ['闭塞', '急症', '血栓'], modality: ['CTA', 'MRA', 'DSA'], diseaseType: '血管病变' },
    { name: '侧支循环形成', disease: '缺血性脑血管病', desc: 'CTA/MRA/DSA示狭窄/闭塞远端可见代偿性侧支血管', insert: '左侧颈内动脉闭塞，闭塞远端通过前交通动脉从右侧代偿供血。', typical: ['颈内动脉闭塞', '慢性缺血'], tags: ['侧支循环', '代偿'], modality: ['CTA', 'MRA', 'DSA'], diseaseType: '血管病变' },
    { name: '静脉窦狭窄', disease: '静脉窦狭窄', desc: 'CTV/MRA示静脉窦变窄，可有继发静脉曲张', insert: '左侧乙状窦及横窦可见狭窄，最窄处约XXmm，余静脉窦未见异常。', typical: ['静脉窦狭窄', '特发性颅高压'], tags: ['静脉窦狭窄', '狭窄'], modality: ['CTV', 'MRV'], diseaseType: '先天畸形' },
    { name: '肺动静脉瘘', disease: '肺动静脉瘘', desc: 'CTPA/MRA示肺动脉与肺静脉直接交通，异常血管团', insert: '右下肺可见纡曲扩张的血管团，动脉期即可见静脉早显。', typical: ['PAVF', '遗传性出血性毛细血管扩张'], tags: ['AVF', '肺血管畸形', '先天'], modality: ['CTPA', 'MRA'], diseaseType: '先天畸形' },
    { name: '门静脉血栓', disease: '门静脉血栓', desc: 'CTV/MR示门静脉内充盈缺损，可有门脉海绵样变', insert: '门静脉主干及左右支可见充盈缺损，肝门区可见纡曲侧支血管。', typical: ['门静脉血栓', '肝硬化', '胰腺炎'], tags: ['门静脉血栓', '血栓'], modality: ['CTV', 'MRV'], diseaseType: '血管病变' },
    { name: '脾动脉瘤', disease: '脾动脉瘤', desc: 'CTA/MRA示脾动脉局限性扩张，呈囊状或梭形', insert: '脾门处脾动脉可见约XXmm囊状突起，瘤颈宽约XXmm。', typical: ['脾动脉瘤', '动脉粥样硬化'], tags: ['动脉瘤', '脾动脉'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
    { name: '肾动脉狭窄', disease: '肾动脉狭窄', desc: 'CTA/MRA/DSA示肾动脉管腔狭窄，可有"串珠征"', insert: '右肾动脉开口处可见局限性狭窄，狭窄率约70%，远端肾实质灌注减低。', typical: ['肾动脉狭窄', '肾血管性高血压'], tags: ['肾动脉狭窄', '狭窄', '高血压'], modality: ['CTA', 'MRA', 'DSA'], diseaseType: '血管病变' },
    { name: '下肢动脉硬化闭塞症', disease: '下肢动脉硬化闭塞症', desc: 'CTA/MRA示下肢动脉多处斑块形成，节段性狭窄或闭塞', insert: '双侧股浅动脉可见多处非对称性斑块，左侧股浅动脉中段闭塞。', typical: ['下肢动脉硬化闭塞症', '糖尿病足'], tags: ['下肢动脉硬化', '闭塞', '狭窄'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
  ]

  vascularFindings.forEach(f => {
    findings.push({
      id: `V${String(id++ - 180).padStart(3, '0')}`,
      bodyPart: '血管',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'vessel',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  // 骨骼肌肉 (60条)
  const musculoskeletalFindings = [
    { name: '肩周炎', disease: '肩周炎', desc: 'MR/X线示肩关节囊增厚、肩袖间隙模糊、三角肌滑囊积液', insert: '右肩关节囊轻度增厚，肩胛下肌腱前方可见积液信号，肩袖间隙脂肪间隙模糊。', typical: ['肩周炎', '冻结肩'], tags: ['肩周炎', '关节囊', '粘连'], modality: ['MR', 'DR'], diseaseType: '炎症' },
    { name: '钙化性肌腱炎', disease: '钙化性肌腱炎', desc: 'X线/CT示肌腱内钙化灶，呈斑块状或线状高密度', insert: '右肩冈上肌腱附着处可见约XXcm钙化影，密度不均，边界清楚。', typical: ['钙化性肌腱炎', '肩袖退变'], tags: ['钙化', '肌腱', '退变'], modality: ['DR', 'CT'], diseaseType: '炎症' },
    { name: '肩峰下撞击综合征', disease: '肩峰下撞击综合征', desc: 'MR/X线示肩峰前缘骨赘形成，冈上肌腱信号异常', insert: '肩峰前缘可见骨赘形成，冈上肌腱T2WI信号增高，肩峰下滑囊积液。', typical: ['肩峰下撞击综合征', '肩袖损伤'], tags: ['撞击', '骨赘', '肩袖'], modality: ['MR', 'DR'], diseaseType: '炎症' },
    { name: 'Bankart损伤', disease: 'Bankart损伤', desc: 'MR示盂唇前下撕裂，关节盂前缘骨质缺损', insert: '右肩关节盂前下唇可见T2WI高信号，关节盂前缘可见骨皮质缺损。', typical: ['Bankart损伤', '肩关节前脱位'], tags: ['Bankart', '盂唇', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: 'Hill-Sachs损伤', disease: 'Hill-Sachs损伤', desc: 'MR/CT示肱骨头后外侧凹陷性骨折', insert: '左肱骨头后外侧可见约XXcm凹陷性缺损，骨皮质不连续。', typical: ['Hill-Sachs损伤', '肩关节脱位'], tags: ['Hill-Sachs', '肱骨头', '骨折'], modality: ['MR', 'CT'], diseaseType: '外伤' },
    { name: '肩锁关节脱位', disease: '肩锁关节脱位', desc: 'X线/CT示肩锁关节间隙增宽，喙锁间距增大', insert: '右肩锁关节间隙增宽，约XXmm，喙锁间距约XXmm，符合III度损伤。', typical: ['肩锁关节脱位', '外伤'], tags: ['肩锁关节', '脱位', '外伤'], modality: ['DR', 'CT'], diseaseType: '外伤' },
    { name: '网球肘', disease: '肱骨外上髁炎', desc: 'MR/超声示肱骨外上髁伸肌总腱增厚、水肿', insert: '右肱骨外上髁伸肌总腱附着处T2WI信号增高，腱纤维增厚。', typical: ['肱骨外上髁炎', '肌腱退变'], tags: ['网球肘', '肌腱', '炎症'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '高尔夫球肘', disease: '肱骨内上髁炎', desc: 'MR/超声示肱骨内上髁屈肌总腱增厚、水肿', insert: '左肱骨内上髁屈肌总腱附着处信号增高，腱膜轻度增厚。', typical: ['肱骨内上髁炎', '肌腱退变'], tags: ['高尔夫球肘', '肌腱', '炎症'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '肘管综合征', disease: '肘管综合征', desc: 'MR示尺神经肿胀，在肘管内卡压水肿', insert: '右肘关节后方尺神经明显肿胀，T2WI信号增高，肘管内可见卡压征象。', typical: ['肘管综合征', '尺神经卡压'], tags: ['肘管', '尺神经', '卡压'], modality: ['MR'], diseaseType: '炎症' },
    { name: '桡骨茎突狭窄性腱鞘炎', disease: '桡骨茎突狭窄性腱鞘炎', desc: 'MR/超声示桡骨茎突部腱鞘增厚，肌腱滑动受阻', insert: '右腕桡骨茎突处腱鞘T2WI高信号，拇长展肌腱及拇短伸肌腱周围积液。', typical: ['桡骨茎突狭窄性腱鞘炎', '腱鞘炎'], tags: ['腱鞘炎', '狭窄', '腕关节'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '腕管综合征', disease: '腕管综合征', desc: 'MR示正中神经在腕管内水肿、肿胀，远端增粗', insert: '右腕管内正中神经T2WI信号增高，局部肿胀，腕横韧带未见明确卡压。', typical: ['腕管综合征', '正中神经卡压'], tags: ['腕管', '正中神经', '卡压'], modality: ['MR'], diseaseType: '炎症' },
    { name: '德奎尔万腱鞘炎', disease: '德奎尔万腱鞘炎', desc: 'MR/超声示第一背侧间室腱鞘增厚，拇长展肌腱和拇短伸肌腱受累', insert: '右腕第一背侧间室腱鞘明显增厚，T2WI高信号，拇长展肌腱可见水肿。', typical: ['德奎尔万腱鞘炎', '狭窄性腱鞘炎'], tags: ['腱鞘炎', '狭窄', '腕关节'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '三角纤维软骨复合体损伤', disease: 'TFCC损伤', desc: 'MR示三角纤维软骨复合体连续性中断，尺侧副韧带损伤', insert: '右腕TFCC中央凹可见T2WI高信号，尺侧副韧带连续性部分中断。', typical: ['TFCC损伤', '腕关节扭伤'], tags: ['TFCC', '三角纤维软骨', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '月骨无菌性坏死', disease: 'Kienböck病', desc: 'MR/CT示月骨密度增高、形态改变、塌陷', insert: '右腕月骨T1WI信号减低，形态略扁，骨皮质不规则，符合Kienböck病。', typical: ['Kienböck病', '月骨坏死'], tags: ['月骨坏死', 'Kienböck', '缺血'], modality: ['MR', 'CT'], diseaseType: '血管病变' },
    { name: '舟骨坏死', disease: '舟骨坏死', desc: 'MR/CT示舟骨形态改变，密度不均，可见囊性变', insert: '右腕舟骨T1WI信号不均匀减低，可见囊性变区，骨皮质不规则。', typical: ['舟骨坏死', '骨折后遗'], tags: ['舟骨坏死', '缺血'], modality: ['MR', 'CT'], diseaseType: '血管病变' },
    { name: '股骨头骨骺滑脱', disease: '股骨头骨骺滑脱', desc: 'X线/MR示股骨头骨骺向外后移位，骺线增宽', insert: '左股骨头骨骺向后外侧移位，约XXmm，骺板增宽，不规则。', typical: ['股骨头骨骺滑脱', '青少年'], tags: ['骨骺滑脱', '股骨头', '先天'], modality: ['DR', 'MR'], diseaseType: '先天畸形' },
    { name: '髋关节撞击综合征', disease: '髋关节撞击综合征', desc: 'MR/X线示股骨头颈交界处骨赘，盂唇损伤', insert: '右髋股骨头颈交界处可见异常骨赘形成，盂唇前上象限T2WI高信号。', typical: ['髋关节撞击综合征', 'FAI'], tags: ['撞击', '骨赘', '盂唇'], modality: ['MR', 'DR'], diseaseType: '炎症' },
    { name: '髋关节盂唇撕裂', disease: '髋关节盂唇撕裂', desc: 'MR示髋臼盂唇T2WI高信号，可达关节面', insert: '右髋臼盂唇前上象限可见T2WI高信号，达关节面缘，符合盂唇撕裂。', typical: ['髋关节盂唇撕裂', '髋关节撞击'], tags: ['盂唇撕裂', '髋关节'], modality: ['MR'], diseaseType: '外伤' },
    { name: '股外侧皮神经卡压综合征', disease: '股外侧皮神经卡压综合征', desc: 'MR示缝匠肌上方神经肿胀、走形区筋膜水肿', insert: '右髋部缝匠肌上方可见T2WI高信号，股外侧皮神经走行区软组织水肿。', typical: ['股外侧皮神经卡压', '神经卡压'], tags: ['神经卡压', '股外侧皮神经'], modality: ['MR'], diseaseType: '炎症' },
    { name: '臀中肌综合征', disease: '臀中肌综合征', desc: 'MR示臀中肌附着处水肿或撕裂', insert: '左髋臀中肌附着处T2WI可见高信号，腱纤维连续性尚可。', typical: ['臀中肌综合征', '髋关节外侧疼痛'], tags: ['臀中肌', '肌腱', '炎症'], modality: ['MR'], diseaseType: '炎症' },
    { name: '髂胫束综合征', disease: '髂胫束综合征', desc: 'MR示髂胫束在股骨外侧髁水平增厚、水肿', insert: '右膝股骨外侧髁水平髂胫束明显增厚，T2WI信号增高，脂肪垫水肿。', typical: ['髂胫束综合征', '跑步膝'], tags: ['髂胫束', '综合征', '过劳'], modality: ['MR'], diseaseType: '炎症' },
    { name: '鹅足腱滑囊炎', disease: '鹅足腱滑囊炎', desc: 'MR/超声示鹅足腱附着处滑囊积液、水肿', insert: '左膝鹅足腱附着处可见弧形液体信号，厚约XXmm，胫骨平台骨髓水肿。', typical: ['鹅足腱滑囊炎', '退行性改变'], tags: ['滑囊炎', '鹅足腱', '炎症'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '贝克囊肿', disease: '贝克囊肿', desc: 'MR/超声示腘窝囊性肿块，与膝关节腔相通', insert: '右膝腘窝可见约XXcm囊性肿块，T1WI低信号，T2WI高信号，与关节腔相通。', typical: ['贝克囊肿', '滑囊囊肿'], tags: ['囊肿', '腘窝', '良性'], modality: ['MR', '超声'], diseaseType: '先天畸形' },
    { name: '交叉韧带囊肿', disease: '交叉韧带囊肿', desc: 'MR示交叉韧带旁囊性肿块，T2WI高信号', insert: '右膝前交叉韧带前方可见约XXcm囊性灶，T2WI高信号，边界清楚。', typical: ['韧带囊肿', '腱鞘囊肿'], tags: ['囊肿', '交叉韧带', '良性'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '髌腱炎', disease: '髌腱炎', desc: 'MR/超声示髌腱增厚、T2WI信号增高', insert: '左膝髌腱近端附着处增厚，厚度约XXmm，T2WI信号增高。', typical: ['髌腱炎', '跳跃膝'], tags: ['髌腱炎', '肌腱', '炎症'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '髌股关节疼痛综合征', disease: '髌股关节疼痛综合征', desc: 'MR示髌骨倾斜、轨迹异常，软骨信号改变', insert: '右膝髌骨外侧倾斜，髌股关节面软骨信号不均匀减低，股骨滑车骨髓水肿。', typical: ['髌股关节疼痛综合征', '膝前痛'], tags: ['髌股关节', '软骨', '疼痛'], modality: ['MR'], diseaseType: '炎症' },
    { name: '剥脱性骨软骨炎', disease: '剥脱性骨软骨炎', desc: 'MR/CT示关节面软骨下骨片分离、脱落', insert: '右膝股骨内踝关节面可见软骨下骨片分离，约XXcm，相应部位可见缺损区。', typical: ['剥脱性骨软骨炎', '软骨损伤'], tags: ['剥脱性骨软骨炎', '软骨', '骨片'], modality: ['MR', 'CT'], diseaseType: '炎症' },
    { name: ' Osteochondritis Dissecans', disease: 'Osteochondritis Dissecans', desc: 'MR/CT示关节内游离体，可有软骨下骨塌陷', insert: '左膝关节内可见游离体，约XXcm，股骨内踝关节面可见缺损区。', typical: ['OCD', '软骨骨折'], tags: ['OCD', '游离体', '软骨'], modality: ['MR', 'CT'], diseaseType: '外伤' },
    { name: '半月板囊肿', disease: '半月板囊肿', desc: 'MR/超声示半月板旁囊性肿块，常与半月板撕裂并存', insert: '右膝内侧半月板旁可见约XXcm囊性肿块，与半月板撕裂区相通。', typical: ['半月板囊肿', '半月板撕裂'], tags: ['囊肿', '半月板', '良性'], modality: ['MR', '超声'], diseaseType: '先天畸形' },
    { name: '盘状半月板', disease: '盘状半月板', desc: 'MR/X线示半月板体部增厚呈盘状，覆蓋胫骨平台', insert: '左膝外侧半月板呈盘状，增厚约XXmm，横径增宽，覆蓋胫骨平台约60%。', typical: ['盘状半月板', '先天畸形'], tags: ['盘状半月板', '先天', '畸形'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '半月板桶柄样撕裂', disease: '半月板桶柄样撕裂', desc: 'MR示半月板体部纵裂，内侧片段移位至髁间窝', insert: '右膝内侧半月板可见桶柄样撕裂，内侧片段移位至髁间窝，呈双后交叉韧带征。', typical: ['半月板桶柄样撕裂', '外伤'], tags: ['桶柄样撕裂', '半月板', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '前交叉韧带重建术后', disease: '前交叉韧带重建', desc: 'MR示 ACL 走形区内移植物信号，股骨及胫骨隧道', insert: '右膝前交叉韧带走形区可见移植肌腱信号，股骨及胫骨隧道位置满意。', typical: ['ACL重建', '术后评价'], tags: ['ACL', '重建', '术后'], modality: ['MR'], diseaseType: '外伤' },
    { name: '后交叉韧带损伤', disease: '后交叉韧带损伤', desc: 'MR示PCL信号异常、连续性中断', insert: '右膝后交叉韧带中下段T2WI高信号，连续性部分中断。', typical: ['PCL损伤', '外伤'], tags: ['PCL', '交叉韧带', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '内侧副韧带损伤', disease: '内侧副韧带损伤', desc: 'MR示MCL信号异常、增厚或连续性中断', insert: '左膝内侧副韧带中上段T2WI信号增高，纤维连续性尚存。', typical: ['MCL损伤', '外伤'], tags: ['MCL', '副韧带', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '外侧副韧带损伤', disease: '外侧副韧带损伤', desc: 'MR示LCL信号异常、连续性中断', insert: '右膝外侧副韧带上止点处T2WI高信号，连续性部分中断。', typical: ['LCL损伤', '外伤'], tags: ['LCL', '副韧带', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '后外侧角损伤', disease: '后外侧角损伤', desc: 'MR示腘肌腱、股二头肌腱、LCL复合体损伤', insert: '右膝后外侧角结构紊乱，腘肌腱T2WI高信号，股二头肌腱附着处水肿。', typical: ['后外侧角损伤', '膝关节多韧带损伤'], tags: ['后外侧角', '复合损伤', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '髌骨脱位', disease: '髌骨脱位', desc: 'CT/MR示髌骨向外侧移位，可伴内侧髌股韧带损伤', insert: '左膝髌骨向外侧脱位，内侧髌股韧带T2WI高信号，连续性中断。', typical: ['髌骨脱位', '外伤'], tags: ['髌骨脱位', '外伤', '急症'], modality: ['CT', 'MR'], diseaseType: '外伤' },
    { name: '髌骨高度异常', disease: '高位髌骨', desc: 'X线/MR示髌骨在屈膝位高度异常，Insall-Scott比值增大', insert: '右膝髌骨高度增加，Insall-Scott比值约1.4，符合高位髌骨。', typical: ['高位髌骨', '髌骨不稳定'], tags: ['髌骨高度', '高位', '先天'], modality: ['DR', 'MR'], diseaseType: '先天畸形' },
    { name: '扁平足', disease: '扁平足', desc: 'X线/MR示足纵弓塌陷，距骨跖屈位', insert: '双足负重位X线示足纵弓消失，距骨相对跖屈，跟骨外翻。', typical: ['扁平足', '足弓塌陷'], tags: ['扁平足', '足弓', '先天'], modality: ['DR'], diseaseType: '先天畸形' },
    { name: '高弓足', disease: '高弓足', desc: 'X线/MR示足纵弓高度增加，跟骨内翻', insert: '双足负重位X线示足纵弓高度增加，跟骨内翻角约35度。', typical: ['高弓足', '神经肌肉疾病'], tags: ['高弓足', '足弓', '先天'], modality: ['DR'], diseaseType: '先天畸形' },
    { name: '跟腱炎', disease: '跟腱炎', desc: 'MR/超声示跟腱增厚、T2WI信号不均匀增高', insert: '左踝跟腱中上段增厚，厚度约XXmm，T2WI信号不均匀增高。', typical: ['跟腱炎', '肌腱退变'], tags: ['跟腱炎', '肌腱', '炎症'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '跟腱断裂', disease: '跟腱断裂', desc: 'MR示跟腱连续性完全中断，断端回缩', insert: '右踝跟腱连续性完全中断，断端间距约XXmm，跟骨附着处可见残端。', typical: ['跟腱断裂', '外伤', '急症'], tags: ['跟腱断裂', '肌腱', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '跖筋膜炎', disease: '跖筋膜炎', desc: 'MR/超声示跖筋膜跟骨附着处增厚、水肿', insert: '右足跟底部跖筋膜附着处增厚，厚度约XXmm，T2WI信号增高。', typical: ['跖筋膜炎', '足底筋膜炎'], tags: ['跖筋膜炎', '筋膜', '炎症'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '跟骨骨刺', disease: '跟骨骨刺', desc: 'X线/CT示跟骨结节上方骨刺形成', insert: '右跟骨结节上方可见骨刺形成，长约XXmm，指向跖侧。', typical: ['跟骨骨刺', '跖筋膜炎'], tags: ['骨刺', '跟骨', '退变'], modality: ['DR', 'CT'], diseaseType: '炎症' },
    { name: '距骨软骨损伤', disease: '距骨软骨损伤', desc: 'MR/CT示距骨顶负重区软骨缺损或软骨下骨损伤', insert: '左踝距骨穹窿中央负重区软骨缺损，深约XXmm，软骨下骨可见骨髓水肿。', typical: ['距骨软骨损伤', 'OCD'], tags: ['软骨损伤', '距骨', '外伤'], modality: ['MR', 'CT'], diseaseType: '外伤' },
    { name: '踝关节外侧副韧带损伤', disease: '踝关节外侧副韧带损伤', desc: 'MR示踝关节外侧副韧带信号异常、连续性中断', insert: '右踝距腓前韧带T2WI高信号，连续性部分中断，周围软组织水肿。', typical: ['踝关节扭伤', 'ATFL损伤'], tags: ['韧带损伤', '踝关节', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '三角韧带损伤', disease: '三角韧带损伤', desc: 'MR示三角韧带深层或浅层信号异常、连续性中断', insert: '左踝三角韧带深层T2WI高信号，纤维连续性尚存，内踝处软组织水肿。', typical: ['三角韧带损伤', '踝关节扭伤'], tags: ['三角韧带', '韧带', '外伤'], modality: ['MR'], diseaseType: '外伤' },
    { name: '跗骨窦综合征', disease: '跗骨窦综合征', desc: 'MR示跗骨窦内脂肪被纤维组织取代，T2WI高信号', insert: '右足跗骨窦内可见T2WI高信号，脂肪信号被取代，伸肌下支持带撕裂。', typical: ['跗骨窦综合征', '踝关节慢性疼痛'], tags: ['跗骨窦', '综合征', '炎症'], modality: ['MR'], diseaseType: '炎症' },
    { name: 'Morton神经瘤', disease: 'Morton神经瘤', desc: 'MR/超声示跖骨间神经肿块，T1WI/T2WI低信号', insert: '右足第三跖骨头间可见约XXcm肿块，T1WI等信号，T2WI低信号。', typical: ['Morton神经瘤', '跖骨间神经瘤'], tags: ['神经瘤', '跖骨', '良性'], modality: ['MR', '超声'], diseaseType: '炎症' },
    { name: '跖骨头坏死', disease: 'Freiberg病', desc: 'MR/CT示跖骨头变形、密度不均、塌陷', insert: '左足第二跖骨头略扁，密度不均，可见囊性变区，符合Freiberg病。', typical: ['Freiberg病', '跖骨头坏死'], tags: ['跖骨头坏死', '坏死', '缺血'], modality: ['MR', 'CT'], diseaseType: '血管病变' },
    { name: '爪形趾', disease: '爪形趾', desc: 'X线/MR示跖趾关节过伸、近远侧趾间关节屈曲', insert: '右足第二趾呈爪形趾改变，跖趾关节过伸约30度，近节趾间关节屈曲。', typical: ['爪形趾', '神经肌肉疾病'], tags: ['爪形趾', '畸形', '先天'], modality: ['DR'], diseaseType: '先天畸形' },
    { name: '锤状趾', disease: '锤状趾', desc: 'X线/MR示远侧趾间关节屈曲、跖趾关节过伸', insert: '左足第三趾呈锤状趾，远侧趾间关节屈曲约45度。', typical: ['锤状趾', '后天性畸形'], tags: ['锤状趾', '畸形', '退变'], modality: ['DR'], diseaseType: '先天畸形' },
    { name: '拇外翻', disease: '拇外翻', desc: 'X线/MR示第一跖趾关节外翻，拇囊炎，第一跖骨内翻', insert: '双足第一跖趾关节外翻角约XX度，第一跖骨内翻，伴拇囊炎。', typical: ['拇外翻', '足部畸形'], tags: ['拇外翻', '畸形', '先天'], modality: ['DR'], diseaseType: '先天畸形' },
    { name: '骨筋膜室综合征', disease: '骨筋膜室综合征', desc: 'MR示相应筋膜室肌肉肿胀、T2WI信号弥漫性增高', insert: '右小腿前筋膜室肌肉明显肿胀，T2WI信号弥漫性增高，筋膜室筋膜显示不清。', typical: ['骨筋膜室综合征', '外伤', '挤压伤'], tags: ['骨筋膜室综合征', '肌肉', '急症'], modality: ['MR'], diseaseType: '外伤' },
    { name: '横纹肌溶解症', disease: '横纹肌溶解症', desc: 'MR示肌肉大片水肿，T2WI高信号，可有肌腱断裂', insert: '右大腿股四头肌大片T2WI高信号，肌肉肿胀，肌间隙模糊。', typical: ['横纹肌溶解症', '挤压伤', '过劳'], tags: ['横纹肌溶解', '肌肉', '急症'], modality: ['MR'], diseaseType: '炎症' },
    { name: '肌疝', disease: '肌疝', desc: 'MR示肌肉通过筋膜缺损处突出', insert: '右小腿外侧肌群通过筋膜缺损处向外突出，缺损约XXmm。', typical: ['肌疝', '筋膜缺损'], tags: ['肌疝', '筋膜', '先天'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '滑膜肉瘤', disease: '滑膜肉瘤', desc: 'CT/MR示关节旁软组织肿块，可有钙化，信号不均', insert: '右膝关节后方可见约XXcm软组织肿块，内可见点状钙化，T2WI信号不均匀。', typical: ['滑膜肉瘤', '软组织肉瘤'], tags: ['滑膜肉瘤', '恶性肿瘤', '肿块'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '恶性纤维组织细胞瘤', disease: '恶性纤维组织细胞瘤', desc: 'CT/MR示深部软组织肿块，信号不均，可有出血坏死', insert: '左大腿深部肌间隙内可见约XXcm肿块，信号不均匀，中心可见坏死区。', typical: ['MFH', '软组织肉瘤'], tags: ['MFH', '肉瘤', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '脂肪肉瘤', disease: '脂肪肉瘤', desc: 'CT/MR示含脂肪成分的恶性肿块，可有分隔或实性成分', insert: '右腹股沟区可见约XXcm肿块，内含脂肪成分及软组织分隔，增强扫描实性成分强化。', typical: ['脂肪肉瘤', '软组织肉瘤'], tags: ['脂肪肉瘤', '脂肪', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '硬纤维瘤', disease: '硬纤维瘤', desc: 'CT/MR示侵袭性生长的纤维性肿块，无包膜', insert: '左臀部可见约XXcm纤维性肿块，边界不清，侵犯臀大肌，增强扫描轻度强化。', typical: ['硬纤维瘤', '侵袭性纤维瘤'], tags: ['硬纤维瘤', '纤维', '侵袭性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '血管球瘤', disease: '血管球瘤', desc: 'MR/超声示甲床下或指端软组织肿块，明显强化', insert: '左手拇指甲床下可见约XXmm肿块，明显均匀强化，T2WI高信号。', typical: ['血管球瘤', '血管性肿瘤'], tags: ['血管球瘤', '甲床', '良性'], modality: ['MR', '超声'], diseaseType: '先天畸形' },
  ]

  musculoskeletalFindings.forEach(f => {
    findings.push({
      id: `M${String(id++ - 200).padStart(3, '0')}`,
      bodyPart: '骨骼肌肉',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'bone',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  // 心血管 (50条)
  const cardiovascularFindings = [
    { name: '冠心病', disease: '冠状动脉粥样硬化性心脏病', desc: 'CTA示冠状动脉多发斑块形成，管腔不同程度狭窄', insert: '左前降支近段可见非钙化斑块，管腔狭窄约50-70%，右冠状动脉中段可见混合斑块。', typical: ['冠心病', '心肌缺血'], tags: ['冠心病', '冠状动脉', '狭窄'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '急性心肌梗死', disease: '急性心肌梗死', desc: 'CT/MR示心肌局部变薄、强化减低或延迟强化', insert: '左心室前壁及前间壁心肌变薄，局部运动减低，增强扫描可见延迟强化。', typical: ['急性心肌梗死', '冠心病'], tags: ['心肌梗死', '心梗', '急症'], modality: ['CTA', 'MR'], diseaseType: '血管病变' },
    { name: '陈旧性心肌梗死', disease: '陈旧性心肌梗死', desc: 'CT/MR示心肌局部变薄、纤维化，室壁瘤形成', insert: '左心室心尖部室壁变薄，约XXmm，局部呈瘤样扩张，符合室壁瘤形成。', typical: ['陈旧性心肌梗死', '冠心病'], tags: ['心肌梗死', '室壁瘤', '陈旧'], modality: ['CTA', 'MR'], diseaseType: '血管病变' },
    { name: '扩张型心肌病', disease: '扩张型心肌病', desc: 'CT/MR示心室腔扩大，室壁运动弥漫性减低', insert: '双侧心室腔明显扩大，以左心室为著，室壁运动弥漫性减低，射血分数约30%。', typical: ['扩张型心肌病', '心衰'], tags: ['扩张型心肌病', '心室扩大', '心功能减低'], modality: ['CTA', 'MR'], diseaseType: '先天畸形' },
    { name: '肥厚型心肌病', disease: '肥厚型心肌病', desc: 'CT/MR示室间隔或心壁局限性增厚，厚度>15mm', insert: '室间隔局限性增厚，最厚处约XXmm，厚度与左室后壁比值>1.3。', typical: ['肥厚型心肌病', '遗传性心肌病'], tags: ['肥厚型心肌病', '室间隔', '增厚'], modality: ['CTA', 'MR'], diseaseType: '先天畸形' },
    { name: '限制型心肌病', disease: '限制型心肌病', desc: 'CT/MR示心室壁弥漫性增厚，舒张功能受限', insert: '双侧心室壁弥漫性增厚，心室腔不大，心房扩大，舒张功能明显受限。', typical: ['限制型心肌病', '心肌淀粉样变'], tags: ['限制型心肌病', '舒张受限', '心功能减低'], modality: ['CTA', 'MR'], diseaseType: '先天畸形' },
    { name: '左室室壁瘤', disease: '左室室壁瘤', desc: 'CT/MR示左室局部向外扩张，壁薄，运动消失或矛盾运动', insert: '左心室心尖部可见约XXcm瘤样扩张，局部室壁变薄约XXmm，呈矛盾运动。', typical: ['左室室壁瘤', '心肌梗死'], tags: ['室壁瘤', '心尖', '矛盾运动'], modality: ['CTA', 'MR'], diseaseType: '血管病变' },
    { name: '左室血栓', disease: '左室血栓', desc: 'CT/MR示左室内附壁血栓，T1WI等信号，增强扫描无强化', insert: '左心室心尖部可见约XXcm附壁血栓，T1WI呈等信号，增强扫描无强化。', typical: ['左室血栓', '心肌梗死', '心衰'], tags: ['血栓', '左室', '附壁血栓'], modality: ['CTA', 'MR'], diseaseType: '血管病变' },
    { name: '心肌致密化不全', disease: '心肌致密化不全', desc: 'MR示左室壁分层，外层致密化不全，内层非致密化', insert: '左室侧壁可见双层结构，外层致密心肌变薄，内层非致密心肌增厚，呈网格状。', typical: ['心肌致密化不全', '先天性心肌病'], tags: ['心肌致密化不全', '先天', '心肌病'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '心肌淀粉样变', disease: '心肌淀粉样变', desc: 'MR示左室壁弥漫性增厚，T1WI/T2WI信号减低，延迟强化', insert: '双室壁弥漫性增厚，T1WI及T2WI信号普遍减低，心肌延迟强化呈全球性内膜下强化。', typical: ['心肌淀粉样变', '限制型心肌病'], tags: ['淀粉样变', '心肌', '浸润'], modality: ['MR'], diseaseType: '先天畸形' },
    { name: '心包积液', disease: '心包积液', desc: 'CT/MR示心包腔内液性密度/信号影', insert: '心包腔内可见弧形液性信号影，右室前壁前方液层厚约XXmm。', typical: ['心包积液', '心衰', '炎症'], tags: ['心包积液', '液体', '心脏'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '缩窄性心包炎', disease: '缩窄性心包炎', desc: 'CT/MR示心包弥漫性增厚、钙化，舒张受限', insert: '心包弥漫性增厚，厚度约XXmm，可见线状钙化，双房扩大，舒张受限。', typical: ['缩窄性心包炎', '结核性心包炎'], tags: ['缩窄性心包炎', '心包增厚', '钙化'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '心包填塞', disease: '心包填塞', desc: 'CT/MR示心包内大量积液，心脏受压变形', insert: '心包腔内可见大量液性信号，右心房及右心室受压塌陷，下腔静脉扩张。', typical: ['心包填塞', '恶性肿瘤', '外伤'], tags: ['心包填塞', '急症', '积液'], modality: ['CT', 'MR'], diseaseType: '外伤' },
    { name: '心脏肿瘤', disease: '心脏粘液瘤', desc: 'CT/MR示心腔内带蒂肿块，可随心动周期移动', insert: '左心房内可见约XXcm带蒂肿块，蒂附着于房间隔卵圆窝旁，随心动周期移动。', typical: ['心脏粘液瘤', '心脏肿瘤'], tags: ['粘液瘤', '心房', '肿瘤'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '房间隔缺损', disease: '房间隔缺损', desc: 'CTA/MR示房间隔局部缺损，左向右分流', insert: '房间隔中部可见约XXmm缺损区，对比剂从左房进入右房，符合ASD。', typical: ['房间隔缺损', '先天性心脏病'], tags: ['ASD', '房间隔缺损', '先天'], modality: ['CTA', 'MR'], diseaseType: '先天畸形' },
    { name: '室间隔缺损', disease: '室间隔缺损', desc: 'CTA/MR示室间隔局部缺损，左向右分流', insert: '室间隔膜部可见约XXmm缺损区，左室可见对比剂进入右室。', typical: ['室间隔缺损', '先天性心脏病'], tags: ['VSD', '室间隔缺损', '先天'], modality: ['CTA', 'MR'], diseaseType: '先天畸形' },
    { name: '动脉导管未闭', disease: '动脉导管未闭', desc: 'CTA/MR示主动脉弓与肺动脉间管道未闭', insert: '主动脉弓降部与主肺动脉间可见未闭导管相通，宽约XXmm。', typical: ['动脉导管未闭', '先天性心脏病'], tags: ['PDA', '动脉导管', '先天'], modality: ['CTA', 'MR'], diseaseType: '先天畸形' },
    { name: '法洛四联症', disease: '法洛四联症', desc: 'CTA/MR示肺动脉狭窄、室间隔缺损、主动脉骑跨、右室肥厚', insert: '肺动脉瓣及右室流出道狭窄，室间隔缺损约XXmm，主动脉轻度骑跨，右心室肥厚。', typical: ['法洛四联症', '先天性心脏病'], tags: ['法洛四联症', '复杂先心', '先天'], modality: ['CTA', 'MR'], diseaseType: '先天畸形' },
    { name: '肺动脉瓣狭窄', disease: '肺动脉瓣狭窄', desc: 'CTA/MR示肺动脉瓣增厚、开放受限，瓣环狭窄', insert: '肺动脉瓣增厚，开放受限，瓣环直径约XXmm，主肺动脉呈狭窄后扩张。', typical: ['肺动脉瓣狭窄', '先天性心脏病'], tags: ['肺动脉瓣狭窄', '瓣膜', '先天'], modality: ['CTA', 'MR'], diseaseType: '先天畸形' },
    { name: '主动脉瓣狭窄', disease: '主动脉瓣狭窄', desc: 'CTA/MR示主动脉瓣增厚、开放受限，瓣环缩小', insert: '主动脉瓣三叶增厚，开放受限，瓣口面积约XXcm²，瓣环直径约XXmm。', typical: ['主动脉瓣狭窄', '老年性瓣膜病'], tags: ['主动脉瓣狭窄', '瓣膜', '退变'], modality: ['CTA', 'MR'], diseaseType: '炎症' },
    { name: '二尖瓣狭窄', disease: '二尖瓣狭窄', desc: 'CTA/MR示二尖瓣增厚开放受限，左房扩大', insert: '二尖瓣增厚，开放受限，左心房明显扩大，肺静脉增粗。', typical: ['二尖瓣狭窄', '风湿性心脏病'], tags: ['二尖瓣狭窄', '瓣膜', '风湿'], modality: ['CTA', 'MR'], diseaseType: '炎症' },
    { name: '二尖瓣关闭不全', disease: '二尖瓣关闭不全', desc: 'CTA/MR示二尖瓣对合不良，左房左室扩大', insert: '二尖瓣前叶轻度脱垂，对合不良，左心房左心室扩大。', typical: ['二尖瓣关闭不全', '退行性瓣膜病'], tags: ['二尖瓣关闭不全', '瓣膜', '返流'], modality: ['CTA', 'MR'], diseaseType: '炎症' },
    { name: '主动脉夹层Stanford A型', disease: 'Stanford A型主动脉夹层', desc: 'CTA/MRA示升主动脉内膜片剥离，破口在升主动脉', insert: '升主动脉根部可见内膜片剥离，可见两个破口，主动脉窦轻度扩张。', typical: ['Stanford A型主动脉夹层', '高血压', '马凡综合征'], tags: ['主动脉夹层', 'A型', '急症'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
    { name: '主动脉夹层Stanford B型', disease: 'Stanford B型主动脉夹层', desc: 'CTA/MRA示主动脉内膜片剥离，破口在左锁骨下动脉以远', insert: '胸降主动脉可见内膜片剥离，真腔受压变窄，假腔可见造影剂充盈。', typical: ['Stanford B型主动脉夹层', '高血压'], tags: ['主动脉夹层', 'B型', '血管'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
    { name: '主动脉壁间血肿', disease: '主动脉壁间血肿', desc: 'CTA/MRA示主动脉壁环形或新月形增厚，无明确内膜片', insert: '胸降主动脉壁呈环形增厚，厚度约XXmm，无明确内膜片显示，考虑壁间血肿。', typical: ['主动脉壁间血肿', '主动脉夹层先兆'], tags: ['壁间血肿', '主动脉', '血管'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
    { name: '穿透性主动脉溃疡', disease: '穿透性主动脉溃疡', desc: 'CTA/MRA示主动脉壁溃疡样龛影形成', insert: '胸降主动脉前壁可见约XXmm溃疡样龛影，局部主动脉壁强化不连续。', typical: ['穿透性主动脉溃疡', '主动脉夹层'], tags: ['溃疡', '主动脉', '血管'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
    { name: '腹主动脉瘤', disease: '腹主动脉瘤', desc: 'CTA示腹主动脉局限性扩张，直径>3cm', insert: '肾动脉水平以下腹主动脉局限性扩张，直径约XXmm，瘤壁可见弧形钙化。', typical: ['腹主动脉瘤', '动脉粥样硬化'], tags: ['腹主动脉瘤', '动脉瘤', '血管'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '胸主动脉瘤', disease: '胸主动脉瘤', desc: 'CTA示胸主动脉局限性扩张，直径>正常1.5倍', insert: '主动脉弓部可见局限性扩张，直径约XXmm，累及左锁骨下动脉开口。', typical: ['胸主动脉瘤', '动脉粥样硬化', '马凡综合征'], tags: ['胸主动脉瘤', '动脉瘤', '血管'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '主动脉缩窄', disease: '主动脉缩窄', desc: 'CTA/MRA示主动脉局限性狭窄，常见于动脉导管韧带处', insert: '主动脉峡部可见局限性狭窄，最窄处约XXmm，远端可见侧支循环建立。', typical: ['主动脉缩窄', '先天性心脏病'], tags: ['主动脉缩窄', '狭窄', '先天'], modality: ['CTA', 'MRA'], diseaseType: '先天畸形' },
    { name: '肺动脉栓塞', disease: '肺动脉栓塞', desc: 'CTPA示肺动脉内充盈缺损，血流阻断', insert: '右肺下叶肺动脉分支可见充盈缺损，管腔完全阻塞，相应肺组织梗死。', typical: ['肺动脉栓塞', '深静脉血栓'], tags: ['肺栓塞', '血栓', '急症'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '肺动脉高压', disease: '肺动脉高压', desc: 'CTA/MR示主肺动脉及左右肺动脉增粗，直径>正常', insert: '主肺动脉干明显增宽，直径约XXmm，左右肺动脉亦增粗，符合肺动脉高压表现。', typical: ['肺动脉高压', '慢阻肺', '心衰'], tags: ['肺动脉高压', '肺动脉增宽', '肺血管'], modality: ['CTA', 'MR'], diseaseType: '血管病变' },
    { name: '肺动脉狭窄', disease: '肺动脉狭窄', desc: 'CTA/MRA示肺动脉分支局限性狭窄', insert: '左肺下叶肺动脉分支可见局限性狭窄，狭窄率约50%，相应肺组织灌注减低。', typical: ['肺动脉狭窄', '先天性心脏病'], tags: ['肺动脉狭窄', '狭窄', '先天'], modality: ['CTA', 'MRA'], diseaseType: '先天畸形' },
    { name: '上腔静脉综合征', disease: '上腔静脉综合征', desc: 'CTA/MR示上腔静脉受压或闭塞，侧支循环开放', insert: '上腔静脉中段管腔狭窄约80%，奇静脉及半奇静脉扩张，侧支循环开放。', typical: ['上腔静脉综合征', '恶性肿瘤', '纵隔肿瘤'], tags: ['上腔静脉综合征', '狭窄', '恶性肿瘤'], modality: ['CTA', 'MR'], diseaseType: '肿瘤' },
    { name: '下腔静脉平滑肌肉瘤', disease: '下腔静脉平滑肌肉瘤', desc: 'CT/MR示下腔静脉内或壁旁肿块，恶性', insert: '下腔静脉肾门水平可见约XXcm肿块，部分位于腔内，密度不均匀，增强扫描不均匀强化。', typical: ['下腔静脉平滑肌肉瘤', '静脉肿瘤'], tags: ['平滑肌肉瘤', '下腔静脉', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '布加综合征', disease: '布加综合征', desc: 'CTA/MR示肝静脉或下腔静脉肝段血栓或狭窄', insert: '肝静脉开口处可见血栓形成，下腔静脉肝段狭窄，肝脾肿大，腹水。', typical: ['布加综合征', '肝静脉血栓'], tags: ['布加综合征', '肝静脉', ' thrombosis'], modality: ['CTA', 'MR'], diseaseType: '血管病变' },
    { name: '门静脉海绵样变', disease: '门静脉海绵样变', desc: 'CTA/MR示门静脉周围纡曲侧支血管形成', insert: '肝门区门静脉主干闭塞，周围可见纡曲扩张的侧支血管网。', typical: ['门静脉海绵样变', '门静脉血栓'], tags: ['门静脉海绵样变', '侧支循环', '血管'], modality: ['CTA', 'MR'], diseaseType: '血管病变' },
    { name: '肠系膜上动脉栓塞', disease: '肠系膜上动脉栓塞', desc: 'CTA示肠系膜上动脉内充盈缺损，肠管扩张积气', insert: '肠系膜上动脉主干可见充盈缺损，空肠及回肠肠管扩张积气，肠壁增厚。', typical: ['肠系膜上动脉栓塞', '肠系膜血管栓塞'], tags: ['肠系膜上动脉栓塞', '急腹症', '血栓'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '肾动脉瘤', disease: '肾动脉瘤', desc: 'CTA/MRA示肾动脉局限性扩张，呈囊状或梭形', insert: '右肾动脉主干可见约XXmm囊状突起，瘤颈宽约XXmm。', typical: ['肾动脉瘤', '动脉粥样硬化'], tags: ['肾动脉瘤', '动脉瘤', '血管'], modality: ['CTA', 'MRA'], diseaseType: '血管病变' },
    { name: '肾动脉纤维肌性发育不良', disease: '肾动脉纤维肌性发育不良', desc: 'CTA/MRA示肾动脉多发狭窄，呈\"串珠征\"', insert: '左肾动脉中远段可见多发局限性狭窄，呈\"串珠样\"改变。', typical: ['肾动脉纤维肌性发育不良', '肾血管性高血压'], tags: ['FMD', '肾动脉狭窄', '串珠征'], modality: ['CTA', 'MRA'], diseaseType: '先天畸形' },
    { name: '髂动脉瘤', disease: '髂动脉瘤', desc: 'CTA示髂动脉局限性扩张，直径>正常1.5倍', insert: '右髂总动脉可见局限性扩张，直径约XXmm，瘤壁可见钙化。', typical: ['髂动脉瘤', '动脉粥样硬化'], tags: ['髂动脉瘤', '动脉瘤', '血管'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '股动脉假性动脉瘤', disease: '股动脉假性动脉瘤', desc: 'CTA示股动脉旁搏动性血肿，与动脉相通', insert: '右股动脉内侧可见约XXcm囊性肿块，颈部与股动脉相通，可见喷射征。', typical: ['股动脉假性动脉瘤', '外伤', '医源性'], tags: ['假性动脉瘤', '股动脉', '外伤'], modality: ['CTA'], diseaseType: '外伤' },
    { name: '下肢深静脉血栓', disease: '下肢深静脉血栓形成', desc: 'CTV/MR示下肢深静脉内充盈缺损或血栓形成', insert: '左股浅静脉及腘静脉可见充盈缺损，血栓形成，管腔闭塞。', typical: ['下肢深静脉血栓', '肺栓塞'], tags: ['深静脉血栓', '血栓', '急症'], modality: ['CTV', 'MRV'], diseaseType: '血管病变' },
    { name: '下肢静脉曲张', disease: '下肢静脉曲张', desc: 'CTA/超声示下肢浅静脉纡曲扩张，瓣膜功能不全', insert: '双侧大隐静脉主干纡曲扩张，直径约XXmm，可见血液返流。', typical: ['下肢静脉曲张', '瓣膜功能不全'], tags: ['静脉曲张', '扩张', '慢性'], modality: ['CTA', '超声'], diseaseType: '先天畸形' },
    { name: '肺动静脉瘘', disease: '肺动静脉瘘', desc: 'CTPA/MRA示肺动静脉直接连通，异常血管团', insert: '右下肺可见约XXcm异常血管团，动脉期即见静脉早显，符合肺动静脉瘘。', typical: ['肺动静脉瘘', 'HHT'], tags: ['AVF', '肺血管畸形', '先天'], modality: ['CTPA', 'MRA'], diseaseType: '先天畸形' },
    { name: '体部大型AVF', disease: '体部大型动静脉瘘', desc: 'CTA/MRA/DSA示动脉与静脉直接相通，静脉早显', insert: '右侧髂内动脉与髂内静脉间可见异常交通，静脉期提前显影，瘘口约XXmm。', typical: ['体部AVF', '先天性AVF'], tags: ['AVF', '动静脉瘘', '血管畸形'], modality: ['CTA', 'MRA', 'DSA'], diseaseType: '先天畸形' },
    { name: '先天性血管发育异常', disease: '先天性血管发育异常', desc: 'CTA/MRA示血管走形、分布或数量异常', insert: '左颈总动脉与无名动脉共干，左椎动脉直接发自主动脉弓，属先天性发育变异。', typical: ['先天性血管发育异常', '血管变异'], tags: ['血管变异', '先天', '发育异常'], modality: ['CTA', 'MRA'], diseaseType: '先天畸形' },
    { name: 'Kawasaki病', disease: 'Kawasaki病', desc: 'CTA/MR示冠状动脉瘤形成，血管壁水肿强化', insert: '左前降支近段可见冠状动脉瘤，直径约XXmm，瘤壁可见强化。', typical: ['Kawasaki病', '冠状动脉瘤'], tags: ['Kawasaki病', '冠状动脉瘤', '儿童'], modality: ['CTA', 'MR'], diseaseType: '血管病变' },
    { name: '大动脉炎', disease: '大动脉炎', desc: 'CTA/MR示大血管壁增厚、强化，管腔狭窄或闭塞', insert: '双侧锁骨下动脉及颈总动脉壁增厚，明显强化，管腔狭窄约60-70%。', typical: ['大动脉炎', '血管炎'], tags: ['大动脉炎', '血管炎', '管壁增厚'], modality: ['CTA', 'MR'], diseaseType: '炎症' },
    { name: '结节性多动脉炎', disease: '结节性多动脉炎', desc: 'CTA/MR示中小动脉多发狭窄或动脉瘤形成', insert: '肾动脉、肠系膜上动脉可见多发小动脉瘤形成，部分伴狭窄。', typical: ['结节性多动脉炎', '血管炎'], tags: ['结节性多动脉炎', '血管炎', '动脉瘤'], modality: ['CTA', 'MR'], diseaseType: '炎症' },
    { name: '白塞病血管病变', disease: '白塞病血管病变', desc: 'CTA/MR示动静脉血栓形成，血管壁炎症', insert: '下腔静脉可见血栓形成，双下肢深静脉血栓，伴血管壁强化。', typical: ['白塞病', '血管炎'], tags: ['白塞病', '血管病变', '血栓'], modality: ['CTA', 'MR'], diseaseType: '炎症' },
  ]

  cardiovascularFindings.forEach(f => {
    findings.push({
      id: `CV${String(id++ - 260).padStart(3, '0')}`,
      bodyPart: '心血管',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'vessel',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  // 胸部 (60条)
  const chestFindingsNew = [
    { name: '大叶性肺炎', disease: '大叶性肺炎', desc: 'CT示肺叶或肺段大片实变影，密度均匀，可见支气管充气征', insert: '右肺上叶可见大片实变影，实变区内密度均匀，可见支气管充气征。', typical: ['大叶性肺炎', '细菌性肺炎'], tags: ['实变', '大叶性', '感染'], modality: ['CT', 'DR'], diseaseType: '炎症' },
    { name: '支气管肺炎', disease: '支气管肺炎', desc: 'CT示两肺多发斑片状影，沿支气管分布，小叶中心结节', insert: '双肺可见多发斑片状阴影，沿支气管分布，边缘模糊。', typical: ['支气管肺炎', '小叶性肺炎'], tags: ['斑片', '支气管分布', '感染'], modality: ['CT', 'DR'], diseaseType: '炎症' },
    { name: '间质性肺炎', disease: '间质性肺炎', desc: 'CT示两肺弥漫性网格影、小结节影，以胸膜下分布为主', insert: '双肺可见弥漫性网格影及小结节影，以胸膜下分布为主，肺结构紊乱。', typical: ['间质性肺炎', '病毒性肺炎'], tags: ['间质改变', '网格', '感染'], modality: ['CT'], diseaseType: '炎症' },
    { name: '社区获得性肺炎', disease: '社区获得性肺炎', desc: 'CT示肺叶或肺段实变、磨玻璃影，可有胸腔积液', insert: '左肺下叶可见片状实变影及磨玻璃影，边缘模糊，可见空气支气管征。', typical: ['社区获得性肺炎', '细菌性肺炎'], tags: ['肺炎', '实变', '感染'], modality: ['CT'], diseaseType: '炎症' },
    { name: '金黄色葡萄球菌肺炎', disease: '金黄色葡萄球菌肺炎', desc: 'CT示两肺多发浸润、结节、空洞，可有液气平面', insert: '双肺可见多发结节及空洞性病变，部分可见液气平面。', typical: ['金黄色葡萄球菌肺炎', '坏死性肺炎'], tags: ['金葡菌', '空洞', '感染'], modality: ['CT'], diseaseType: '炎症' },
    { name: '克雷伯杆菌肺炎', disease: '克雷伯杆菌肺炎', desc: 'CT示肺叶实变，内有坏死空洞，叶间裂下坠', insert: '右肺上叶大叶性实变，内有多个空洞，叶间裂弧形下坠。', typical: ['克雷伯杆菌肺炎', '肺炎克雷伯菌'], tags: ['克雷伯', '叶间裂下坠', '感染'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肺脓肿', disease: '肺脓肿', desc: 'CT示厚壁空洞，内有气液平面，周围有渗出', insert: '右肺上叶可见厚壁空洞，大小约XXcm，内有气液平面，周围肺组织渗出。', typical: ['肺脓肿', '细菌性感染'], tags: ['脓肿', '空洞', '感染'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肺结核', disease: '肺结核', desc: 'CT示上叶尖后段及下叶背段浸润、空洞、卫星灶', insert: '右肺上叶尖段可见斑片状浸润影，内有空洞形成，周围可见卫星灶。', typical: ['肺结核', '继发性肺结核'], tags: ['结核', '空洞', '感染'], modality: ['CT'], diseaseType: '炎症' },
    { name: '血行播散型肺结核', disease: '血行播散型肺结核', desc: 'CT示两肺均匀分布粟粒结节，大小密度一致', insert: '双肺可见弥漫性粟粒样结节，大小约2-3mm，分布均匀，密度一致。', typical: ['血行播散型肺结核', '急性粟粒性肺结核'], tags: ['粟粒', '播散', '结核'], modality: ['CT'], diseaseType: '炎症' },
    { name: '结核性胸膜炎', disease: '结核性胸膜炎', desc: 'CT/MR示胸膜增厚、胸腔积液，可有包裹', insert: '左侧胸膜增厚，可见弧形液性密度影，局部可见包裹。', typical: ['结核性胸膜炎', '胸腔积液'], tags: ['胸膜增厚', '胸水', '结核'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '肺癌', disease: '周围型肺癌', desc: 'CT示肺内结节或肿块，分叶、毛刺、胸膜牵拉', insert: '左肺上叶可见约XXcm结节，边缘可见分叶及毛刺，邻近胸膜可见牵拉。', typical: ['周围型肺癌', '腺癌'], tags: ['肺癌', '结节', '恶性'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '中央型肺癌', disease: '中央型肺癌', desc: 'CT示肺门肿块，远端阻塞性肺炎或肺不张', insert: '右肺门可见约XXcm肿块，右肺上叶可见阻塞性不张。', typical: ['中央型肺癌', '鳞癌'], tags: ['肺癌', '肺门', '恶性'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '细支气管肺泡癌', disease: '细支气管肺泡癌', desc: 'CT示磨玻璃影或实变影，可有蜂窝征', insert: '左肺下叶可见磨玻璃影，边界清楚，内可见蜂窝状气体密度。', typical: ['细支气管肺泡癌', 'BAC'], tags: ['BAC', '磨玻璃', '恶性'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '肺转移瘤', disease: '肺转移瘤', desc: 'CT示两肺多发大小不等结节，典型呈\"炮弹影\"', insert: '双肺可见多发大小不等结节，较大者约XXcm，边缘清楚。', typical: ['肺转移瘤', '转移性肺癌'], tags: ['转移', '多发结节', '恶性'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '肺错构瘤', disease: '肺错构瘤', desc: 'CT示肺内结节，有爆米花样钙化或脂肪密度', insert: '右肺下叶可见约XXcm结节，内有爆米花样钙化。', typical: ['肺错构瘤', '良性肿瘤'], tags: ['错构瘤', '钙化', '良性'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '硬化性血管瘤', disease: '硬化性血管瘤', desc: 'CT/MR示肺内圆形肿块，明显均匀强化', insert: '左肺上叶可见约XXcm肿块，CT增强扫描明显均匀强化。', typical: ['硬化性血管瘤', '肺良性肿瘤'], tags: ['血管瘤', '强化', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胸膜间皮瘤', disease: '胸膜间皮瘤', desc: 'CT/MR示胸膜增厚或肿块，可有结节，常伴胸腔积液', insert: '右侧胸膜可见不规则增厚，可见多发结节，右侧胸腔可见积液。', typical: ['胸膜间皮瘤', '恶性间皮瘤'], tags: ['间皮瘤', '胸膜', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '纵隔畸胎瘤', disease: '纵隔畸胎瘤', desc: 'CT/MR示纵隔内肿块，内有钙化、脂肪或囊性成分', insert: '前上纵隔可见约XXcm肿块，内有脂肪密度及钙化。', typical: ['纵隔畸胎瘤', '生殖细胞肿瘤'], tags: ['畸胎瘤', '纵隔', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '纵隔神经鞘瘤', disease: '纵隔神经鞘瘤', desc: 'CT/MR示后纵隔肿块，密度均匀，明显强化', insert: '后纵隔可见约XXcm肿块，边界清楚，明显均匀强化。', typical: ['纵隔神经鞘瘤', '神经源性肿瘤'], tags: ['神经鞘瘤', '后纵隔', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胸腺瘤', disease: '胸腺瘤', desc: 'CT/MR示前纵隔肿块，可有强化，常伴重症肌无力', insert: '前纵隔可见约XXcm肿块，密度均匀，增强扫描中度强化。', typical: ['胸腺瘤', '前纵隔肿瘤'], tags: ['胸腺瘤', '前纵隔', '肿瘤'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '淋巴瘤', disease: '纵隔淋巴瘤', desc: 'CT/MR示纵隔淋巴结肿大，可融合成团', insert: '纵隔内可见多发肿大淋巴结，融合成团，包绕血管。', typical: ['纵隔淋巴瘤', '霍奇金淋巴瘤'], tags: ['淋巴瘤', '纵隔', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '气胸', disease: '自发性气胸', desc: 'CT示胸膜腔内无肺纹理气体密度，肺组织压缩', insert: '左侧胸膜腔内可见无肺纹理气体影，左肺组织被压缩约30%。', typical: ['自发性气胸', '气胸'], tags: ['气胸', '无肺纹理', '急症'], modality: ['CT', 'DR'], diseaseType: '外伤' },
    { name: '液气胸', disease: '液气胸', desc: 'CT示胸膜腔内气体和液体同时存在', insert: '右侧胸膜腔内可见气液平面，肺组织被压缩约20%。', typical: ['液气胸', '外伤'], tags: ['液气胸', '气液平面', '外伤'], modality: ['CT', 'DR'], diseaseType: '外伤' },
    { name: '肺大泡', disease: '肺大泡', desc: 'CT示肺内薄壁无结构气腔，直径>1cm', insert: '右肺尖可见薄壁无结构气腔，大小约XXcm。', typical: ['肺大泡', '慢阻肺'], tags: ['肺大泡', '无结构', '气腔'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肺气肿', disease: '肺气肿', desc: 'CT示肺野透亮度增加，肺纹理稀疏，间隔旁型肺气肿', insert: '双肺上叶透亮度增加，肺纹理稀疏，符合肺气肿表现。', typical: ['肺气肿', '慢阻肺'], tags: ['肺气肿', '透亮度增加', '退变'], modality: ['CT'], diseaseType: '炎症' },
    { name: '间质性肺气肿', disease: '间质性肺气肿', desc: 'CT示肺间质内气体，血管周围气体套征', insert: '双肺可见血管周围气体密度影，呈\"气体套征\"。', typical: ['间质性肺气肿', '外伤', '机械通气'], tags: ['间质性肺气肿', '气体套征', '外伤'], modality: ['CT'], diseaseType: '外伤' },
    { name: '支气管扩张', disease: '支气管扩张', desc: 'CT示支气管内径大于伴行动脉，印戒征，柱状或囊状扩张', insert: '左肺下叶可见柱状支气管扩张，支气管内径明显大于邻近肺动脉。', typical: ['支气管扩张', '慢阻肺'], tags: ['支气管扩张', '印戒征', '扩张'], modality: ['CT'], diseaseType: '炎症' },
    { name: '支气管闭锁', disease: '支气管闭锁', desc: 'CT示一段支气管缺如，远端肺组织充气过度或实变', insert: '左肺下叶背段支气管缺如，远端肺组织呈充气过度状态。', typical: ['支气管闭锁', '先天发育异常'], tags: ['支气管闭锁', '先天', '发育异常'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '先天性支气管囊肿', disease: '先天性支气管囊肿', desc: 'CT/MR示气管旁或肺内囊性肿块，边界清楚', insert: '右肺门旁可见约XXcm囊性肿块，边界清楚，CT值约15Hu。', typical: ['先天性支气管囊肿', '支气管源性囊肿'], tags: ['囊肿', '支气管', '先天'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '肺隔离症', disease: '肺隔离症', desc: 'CT示肺内异常供血肿块，CTA示异常动脉来自主动脉', insert: '左肺下叶可见囊性肿块，CT增强扫描异常供血动脉来自胸主动脉。', typical: ['肺隔离症', '先天性肺发育异常'], tags: ['肺隔离症', '异常血供', '先天'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '动静脉畸形', disease: '肺动静脉畸形', desc: 'CTPA/MRA示肺动静脉直接连通，异常血管团', insert: '右下肺可见纡曲扩张的血管团，动脉期即可见静脉早显。', typical: ['肺AVM', '遗传性出血性毛细血管扩张'], tags: ['AVM', '肺血管畸形', '先天'], modality: ['CTPA', 'MRA'], diseaseType: '先天畸形' },
    { name: '肺动脉栓塞', disease: '急性肺动脉栓塞', desc: 'CTPA示肺动脉内充盈缺损，急性期可见\"截断征\"', insert: '右肺下叶肺动脉分支可见充盈缺损，管腔完全阻塞，呈\"截断征\"。', typical: ['急性肺栓塞', '深静脉血栓'], tags: ['肺栓塞', '充盈缺损', '急症'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '慢性肺栓塞', disease: '慢性肺动脉栓塞', desc: 'CTPA示肺动脉偏心性狭窄，机化血栓，肺动脉高压', insert: '双侧肺动脉主干可见偏心性狭窄，管壁不规则，符合慢性肺栓塞。', typical: ['慢性肺栓塞', '肺动脉高压'], tags: ['慢性肺栓塞', '偏心性狭窄', '血管'], modality: ['CTA'], diseaseType: '血管病变' },
    { name: '肺动脉高压', disease: '特发性肺动脉高压', desc: 'CT/MR示主肺动脉及左右肺动脉增宽，直径>正常值', insert: '主肺动脉干明显增宽，直径约XXmm，符合肺动脉高压表现。', typical: ['特发性肺动脉高压', '肺血管病'], tags: ['肺动脉高压', '主肺动脉', '血管'], modality: ['CTA', 'MR'], diseaseType: '血管病变' },
    { name: '肺水肿', disease: '心源性肺水肿', desc: 'CT示两肺门周围蝶翼状渗出，Kerley B线，胸腔积液', insert: '双肺可见对称性磨玻璃影及斑片影，以肺门周围分布为主，可见Kerley B线。', typical: ['心源性肺水肿', '心衰'], tags: ['肺水肿', '磨玻璃', '心衰'], modality: ['CT'], diseaseType: '炎症' },
    { name: 'ARDS', disease: '急性呼吸窘迫综合征', desc: 'CT示两肺弥漫性磨玻璃影及实变，呈\"白肺\"', insert: '双肺可见弥漫性磨玻璃影及实变影，呈\"白肺\"改变。', typical: ['ARDS', '急性肺损伤'], tags: ['ARDS', '白肺', '急症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '弥漫性肺泡损伤', disease: '弥漫性肺泡损伤', desc: 'CT示两肺弥漫性渗出、水肿，可有透明膜形成', insert: '双肺可见弥漫性渗出性改变，肺泡壁增厚，符合DAD表现。', typical: ['DAD', '急性肺损伤'], tags: ['DAD', '弥漫性', '肺泡'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肺泡蛋白沉积症', disease: '肺泡蛋白沉积症', desc: 'CT示两肺弥漫性磨玻璃影，内有网格状小叶间隔增厚', insert: '双肺可见弥漫性磨玻璃影，内有网格状增厚小叶间隔，呈\"铺路石征\"。', typical: ['PAP', '肺泡蛋白沉积症'], tags: ['PAP', '铺路石征', '沉积'], modality: ['CT'], diseaseType: '炎症' },
    { name: '外源性过敏性肺泡炎', disease: '外源性过敏性肺泡炎', desc: 'CT示两肺弥漫性磨玻璃影及结节，以中上肺为主', insert: '双肺可见弥漫性磨玻璃影及小结节，以中上肺分布为主。', typical: ['外源性过敏性肺泡炎', '农民肺'], tags: ['过敏性肺泡炎', '磨玻璃', '过敏'], modality: ['CT'], diseaseType: '炎症' },
    { name: '结节病', disease: '肺结节病', desc: 'CT示两肺门及纵隔淋巴结肿大，肺内肉芽肿', insert: '双肺门及纵隔淋巴结肿大，双肺可见多发小结节影，沿淋巴管分布。', typical: ['结节病', '肉芽肿'], tags: ['结节病', '肉芽肿', '淋巴肿大'], modality: ['CT'], diseaseType: '炎症' },
    { name: '矽肺', disease: '矽肺', desc: 'CT示两肺多发小结节，以上叶为主，可有蛋壳样钙化', insert: '双肺可见多发小结节，以上叶为著，双肺门淋巴结可见蛋壳样钙化。', typical: ['矽肺', '尘肺'], tags: ['矽肺', '小结节', '钙化'], modality: ['CT'], diseaseType: '炎症' },
    { name: '石棉肺', disease: '石棉肺', desc: 'CT示两肺间质纤维化，胸膜斑，钙化', insert: '双肺下叶可见间质纤维化改变，双侧胸膜可见多发钙化斑块。', typical: ['石棉肺', '尘肺'], tags: ['石棉肺', '胸膜斑', '纤维化'], modality: ['CT'], diseaseType: '炎症' },
    { name: 'COPD', disease: '慢性阻塞性肺疾病', desc: 'CT示肺气肿、支气管壁增厚，小叶中央型或全小叶型', insert: '双肺透亮度增加，肺纹理稀疏，小叶中央型肺气肿，符合COPD。', typical: ['COPD', '慢阻肺'], tags: ['COPD', '肺气肿', '慢阻肺'], modality: ['CT'], diseaseType: '炎症' },
    { name: '哮喘', disease: '支气管哮喘', desc: 'CT示支气管壁增厚，呼气相空气潴留，的马赛克密度', insert: '双肺透亮度不均匀，呼气相可见空气潴留，呈马赛克样改变。', typical: ['支气管哮喘', '哮喘'], tags: ['哮喘', '空气潴留', '马赛克'], modality: ['CT'], diseaseType: '炎症' },
    { name: '闭塞性细支气管炎', disease: '闭塞性细支气管炎', desc: 'CT示马赛克灌注，呼气相空气潴留，支气管壁增厚', insert: '双肺可见区域性密度差异，灌注不均匀，呈马赛克样改变。', typical: ['闭塞性细支气管炎', 'BO'], tags: ['BO', '马赛克灌注', '闭塞'], modality: ['CT'], diseaseType: '炎症' },
    { name: '弥漫性泛细支气管炎', disease: '弥漫性泛细支气管炎', desc: 'CT示两肺弥漫性小结节，沿支气管分布，树芽征', insert: '双肺可见弥漫性小结节，沿支气管分布，双下肺可见树芽征。', typical: ['DPB', '弥漫性泛细支气管炎'], tags: ['DPB', '树芽征', '小结节'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肺朗格汉斯细胞组织细胞增生症', disease: '肺朗格汉斯细胞组织细胞增生症', desc: 'CT示两肺多发小结节及空洞，以中上肺为主', insert: '双肺可见多发小结节及薄壁空洞，以中上肺分布为主。', typical: ['PLCH', '肺LCH'], tags: ['LCH', '空洞', '结节'], modality: ['CT'], diseaseType: '炎症' },
    { name: '淋巴管平滑肌瘤病', disease: '淋巴管平滑肌瘤病', desc: 'CT示两肺弥漫性薄壁囊肿，女性多见', insert: '双肺可见弥漫性薄壁囊肿，大小约XXmm，分布均匀。', typical: ['LAM', '淋巴管平滑肌瘤病'], tags: ['LAM', '囊肿', '女性'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '肺淀粉样变', disease: '肺淀粉样变性', desc: 'CT示肺内结节或弥漫性浸润，可有钙化', insert: '右肺可见多发结节，部分可见钙化，符合淀粉样变性。', typical: ['肺淀粉样变', '淀粉样沉积'], tags: ['淀粉样变', '结节', '钙化'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肺血管炎', disease: '肉芽肿性多血管炎', desc: 'CT示肺内结节或空洞，伴有肺梗死或出血', insert: '双肺可见多发结节及空洞，伴有肺出血改变。', typical: ['GPA', '肉芽肿性多血管炎'], tags: ['GPA', '血管炎', '空洞'], modality: ['CT'], diseaseType: '炎症' },
    { name: '显微镜下多血管炎', disease: '显微镜下多血管炎', desc: 'CT示两肺磨玻璃影或实变，肺泡出血', insert: '双肺可见弥漫性磨玻璃影及实变，提示肺泡出血。', typical: ['MPA', '显微镜下多血管炎'], tags: ['MPA', '肺泡出血', '血管炎'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肺静脉闭塞性疾病', disease: '肺静脉闭塞性疾病', desc: 'CT示肺水肿改变，小叶间隔增厚，肺动脉高压', insert: '双肺可见小叶间隔增厚，主肺动脉增宽，符合PVOD。', typical: ['PVOD', '肺血管病'], tags: ['PVOD', '肺静脉', '闭塞'], modality: ['CT'], diseaseType: '血管病变' },
    { name: '肺毛细血管瘤病', disease: '肺毛细血管瘤病', desc: 'CT示两肺磨玻璃影，小叶间隔增厚，肺动脉高压', insert: '双肺可见弥漫性磨玻璃影，小叶间隔均匀增厚，肺动脉高压表现。', typical: ['PCH', '肺毛细血管瘤病'], tags: ['PCH', '毛细血管', '增生'], modality: ['CT'], diseaseType: '血管病变' },
    { name: '胸腺增生', disease: '胸腺增生', desc: 'CT/MR示胸腺增大，但形态正常，无肿块', insert: '前纵隔胸腺增大，但形态保持正常，密度/信号均匀。', typical: ['胸腺增生', '重症肌无力'], tags: ['胸腺增生', '前纵隔', '良性'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '心包囊肿', disease: '心包囊肿', desc: 'CT/MR示心膈角处囊性肿块，边界清楚', insert: '右心膈角处可见约XXcm囊性肿块，边界清楚，CT值约15Hu。', typical: ['心包囊肿', '纵隔囊肿'], tags: ['囊肿', '心包', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '纵隔囊肿', disease: '纵隔囊肿', desc: 'CT/MR示纵隔内囊性肿块，边界清楚，无强化', insert: '中纵隔可见约XXcm囊性肿块，边界清楚，无强化。', typical: ['纵隔囊肿', '支气管囊肿'], tags: ['囊肿', '纵隔', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '膈疝', disease: '膈疝', desc: 'CT示腹腔内容物通过膈肌缺损进入胸腔', insert: '左侧膈肌可见局部缺损，胃底及部分肠管疝入左侧胸腔。', typical: ['先天性膈疝', '外伤性膈疝'], tags: ['膈疝', '缺损', '先天'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '膈麻痹', disease: '膈麻痹', desc: 'CT/透视示患侧膈肌抬高，运动减弱或矛盾运动', insert: '左侧膈肌明显抬高，运动消失，透视下可见矛盾运动。', typical: ['膈神经麻痹', '膈肌麻痹'], tags: ['膈麻痹', '膈肌', '抬高'], modality: ['CT', '透视'], diseaseType: '炎症' },
  ]

  chestFindingsNew.forEach(f => {
    findings.push({
      id: `CT${String(id++ - 310).padStart(3, '0')}`,
      bodyPart: '胸部',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'chest',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  // 腹部 (60条)
  const abdomenFindingsNew = [
    { name: '急性胰腺炎', disease: '急性胰腺炎', desc: 'CT示胰腺肿大、密度减低、胰周渗出、肾前筋膜增厚', insert: '胰腺体积弥漫性增大，密度减低，胰周可见片状渗出影，左侧肾前筋膜增厚。', typical: ['急性胰腺炎', '胆源性胰腺炎'], tags: ['胰腺炎', '渗出', '急症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '慢性胰腺炎', disease: '慢性胰腺炎', desc: 'CT/MR示胰腺萎缩、胰管扩张、胰管结石、假性囊肿', insert: '胰腺萎缩，胰管呈串珠状扩张，胰头部可见结石。', typical: ['慢性胰腺炎', '胰腺钙化'], tags: ['慢性胰腺炎', '胰管扩张', '结石'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '胰腺癌', disease: '胰腺癌', desc: 'CT/MR示胰腺内肿块，边界不清，胰管扩张，侵犯血管', insert: '胰腺体部可见约XXcm肿块，边界不清，胰管全程扩张，肠系膜上动脉被包绕。', typical: ['胰腺癌', '胰头癌'], tags: ['胰腺癌', '肿块', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胰腺囊性肿瘤', disease: '胰腺囊腺瘤', desc: 'CT/MR示胰腺内囊性肿块，有分隔或实性成分', insert: '胰腺体部可见多房囊性肿块，大小约XXcm，囊壁可见实性结节。', typical: ['胰腺囊腺瘤', 'IPMN'], tags: ['囊腺瘤', '囊性', '肿瘤'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胰腺神经内分泌肿瘤', disease: '胰腺神经内分泌肿瘤', desc: 'CT/MR示胰腺内富血供肿块，明显强化', insert: '胰腺体部可见约XXcm肿块，CT增强扫描明显均匀强化。', typical: ['胰岛细胞瘤', 'NET'], tags: ['NET', '富血供', '肿瘤'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '急性阑尾炎', disease: '急性阑尾炎', desc: 'CT示阑尾增粗肿大，直径>6mm，阑尾石，周围渗出', insert: '阑尾增粗，直径约XXmm，周围脂肪间隙浑浊，见少许渗出影。', typical: ['急性阑尾炎', '阑尾结石'], tags: ['阑尾炎', '增粗', '急症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '阑尾脓肿', disease: '阑尾脓肿', desc: 'CT示右下腹囊性肿块，边缘环形强化，内有气液平面', insert: '右下腹可见约XXcm囊性肿块，边缘环形强化，中心可见气液平面。', typical: ['阑尾脓肿', '阑尾炎并发症'], tags: ['脓肿', '右下腹', '感染'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肠梗阻', disease: '粘连性肠梗阻', desc: 'X线/CT示肠管扩张积气积液，气液平面，肠袢排列异常', insert: '中上腹小肠肠管明显扩张积气，伴多发气液平面，肠袢排列如阶梯状。', typical: ['粘连性肠梗阻', '机械性肠梗阻'], tags: ['肠梗阻', '气液平面', '急症'], modality: ['DR', 'CT'], diseaseType: '炎症' },
    { name: '绞窄性肠梗阻', disease: '绞窄性肠梗阻', desc: 'CT示肠壁增厚、密度增高、肠系膜血管\"缆绳征\"', insert: '小肠肠壁增厚，密度增高，肠系膜血管呈\"缆绳征\"，腹水。', typical: ['绞窄性肠梗阻', '肠系膜血栓'], tags: ['绞窄性', '缆绳征', '急症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '结肠梗阻', disease: '结肠梗阻', desc: 'X线/CT示结肠扩张积气，直径>6cm，可见气液平面', insert: '横结肠明显扩张积气，肠管直径约XXcm，肠内容物较少。', typical: ['结肠癌', '肠梗阻'], tags: ['结肠梗阻', '扩张'], modality: ['DR', 'CT'], diseaseType: '炎症' },
    { name: '肠套叠', disease: '肠套叠', desc: 'CT示靶征或肾形肿块，同心圆样结构', insert: '右下腹可见肠管切面呈\"靶征\"，可见套入部与鞘部。', typical: ['肠套叠', '小儿急腹症'], tags: ['肠套叠', '靶征', '急症'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '小肠肿瘤', disease: '小肠癌', desc: 'CT示小肠肿块，可有溃疡，肠腔狭窄', insert: '空肠近端可见约XXcm肿块，肠腔狭窄，病变段肠管周围脂肪间隙浑浊。', typical: ['小肠癌', '小肠间质瘤'], tags: ['小肠肿瘤', '肿块', '恶性'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '克罗恩病', disease: '克罗恩病', desc: 'CT示肠壁增厚、肠系膜纤维脂肪增生、瘘管形成', insert: '回肠末端肠壁增厚，肠系膜侧可见纤维脂肪增生，伴瘘管形成。', typical: ['克罗恩病', '炎症性肠病'], tags: ['克罗恩病', '肠壁增厚', '炎症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '溃疡性结肠炎', disease: '溃疡性结肠炎', desc: 'CT示结肠壁增厚、结肠袋消失、肠腔变窄', insert: '直肠及乙状结肠壁增厚，结肠袋消失，肠腔变窄，肠壁分层强化。', typical: ['溃疡性结肠炎', '炎症性肠病'], tags: ['溃疡性结肠炎', '结肠', '炎症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肠结核', disease: '肠结核', desc: 'CT示回盲部肠壁增厚，淋巴结肿大，可有钙化', insert: '回盲部肠壁增厚，肠系膜淋巴结肿大，部分可见钙化。', typical: ['肠结核', '结核'], tags: ['肠结核', '回盲部', '结核'], modality: ['CT'], diseaseType: '炎症' },
    { name: '结肠癌', disease: '结肠癌', desc: 'CT示结肠肿块，肠壁增厚，可有肠腔狭窄', insert: '升结肠可见约XXcm肿块，肠壁局限性增厚，肠腔狭窄。', typical: ['结肠癌', '结肠恶性肿瘤'], tags: ['结肠癌', '肿块', '恶性'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '直肠癌', disease: '直肠癌', desc: 'CT/MR示直肠肿块，肠壁环形增厚，侵犯周围组织', insert: '直肠中段可见约XXcm肿块，肠壁环形增厚，突破浆膜层。', typical: ['直肠癌', '直肠恶性肿瘤'], tags: ['直肠癌', '环形增厚', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胃肠道间质瘤', disease: '胃肠道间质瘤', desc: 'CT示胃肠道来源的肿块，可有坏死囊变', insert: '胃小弯侧可见约XXcm肿块，密度不均匀，中心可见低密度坏死区。', typical: ['GIST', '胃肠道间质瘤'], tags: ['间质瘤', '肿块', 'GIST'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '胃癌', disease: '胃癌', desc: 'CT示胃壁局限性或弥漫性增厚，可有溃疡或肿块', insert: '胃窦部胃壁局限性增厚，最厚处约XXmm，可见溃疡形成。', typical: ['胃癌', '胃恶性肿瘤'], tags: ['胃癌', '胃壁增厚', '恶性'], modality: ['CT'], diseaseType: '肿瘤' },
    { name: '胃溃疡', disease: '胃溃疡', desc: 'CT/胃镜示胃壁溃疡，溃疡底可深达肌层', insert: '胃角切迹处可见溃疡，大小约XXmm，溃疡底可见白苔。', typical: ['胃溃疡', '消化性溃疡'], tags: ['胃溃疡', '溃疡', '良性'], modality: ['CT', '胃镜'], diseaseType: '炎症' },
    { name: '胃穿孔', disease: '胃穿孔', desc: 'CT/X线示膈下游离气体，腹盆腔积液', insert: '双侧膈下可见弧形游离气体影，腹盆腔可见积液。', typical: ['胃穿孔', '消化道穿孔'], tags: ['穿孔', '游离气体', '急症'], modality: ['CT', 'DR'], diseaseType: '外伤' },
    { name: '急性胆囊炎', disease: '急性胆囊炎', desc: 'CT/超声示胆囊增大，壁增厚>3mm，周围渗出', insert: '胆囊体积增大，壁弥漫性增厚，厚度约XXmm，胆囊窝可见积液。', typical: ['急性胆囊炎', '结石性胆囊炎'], tags: ['胆囊炎', '壁增厚', '急症'], modality: ['CT', '超声'], diseaseType: '炎症' },
    { name: '慢性胆囊炎', disease: '慢性胆囊炎', desc: 'CT示胆囊壁增厚、钙化，胆囊萎缩', insert: '胆囊壁增厚，可见弧形钙化，胆囊体积缩小。', typical: ['慢性胆囊炎', '萎缩性胆囊炎'], tags: ['慢性胆囊炎', '壁增厚', '钙化'], modality: ['CT'], diseaseType: '炎症' },
    { name: '胆囊结石', disease: '胆囊结石', desc: 'CT示胆囊内高密度或低密度结石，MRI T2WI低信号', insert: '胆囊内可见多发结石影，较大者约XXcm，CT值约180Hu。', typical: ['胆囊结石', '胆石症'], tags: ['结石', '胆囊', '高密度'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '胆囊癌', disease: '胆囊癌', desc: 'CT/MR示胆囊壁增厚或肿块，侵犯肝门', insert: '胆囊壁可见不规则增厚，胆囊窝可见软组织肿块，侵犯肝门。', typical: ['胆囊癌', '胆囊恶性肿瘤'], tags: ['胆囊癌', '肿块', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胆管癌', disease: '肝门部胆管癌', desc: 'CT/MR示肝门部胆管狭窄或肿块，肝内胆管扩张', insert: '肝门部胆管可见约XXcm肿块，肝内胆管呈\"软藤征\"样扩张。', typical: ['胆管癌', 'Klatskin瘤'], tags: ['胆管癌', '肝门', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胆总管结石', disease: '胆总管结石', desc: 'CT/MR示胆总管内高密度或信号异常结石', insert: '胆总管中段可见高密度影，大小约XXmm，上游胆管扩张。', typical: ['胆总管结石', '胆石症'], tags: ['结石', '胆总管', '梗阻'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '急性化脓性胆管炎', disease: '急性化脓性胆管炎', desc: 'CT示胆管扩张，胆管壁增厚强化，胆管内积气', insert: '肝内外胆管明显扩张，胆管壁增厚强化，胆管内可见气体密度。', typical: ['急性化脓性胆管炎', '胆管炎'], tags: ['胆管炎', '胆管扩张', '急症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肝囊肿', disease: '肝囊肿', desc: 'CT/MR示肝内圆形水样密度/信号灶，边缘清楚，无强化', insert: '肝右叶可见一枚无强化囊性灶，大小约XXcm，边界清楚，CT值约5Hu。', typical: ['肝囊肿', '先天性囊肿'], tags: ['囊肿', '囊性', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '多囊肝', disease: '多囊肝', desc: 'CT/MR示肝脏多发大小不等囊肿，常伴多囊肾', insert: '肝脏可见多发大小不等囊肿，较大者约XXcm，符合多囊肝。', typical: ['多囊肝', '先天性多囊肾'], tags: ['多囊肝', '囊肿', '先天'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '肝血管瘤', disease: '肝血管瘤', desc: 'CT/MR增强扫描示边缘结节样强化，逐渐向内填充', insert: '肝右叶可见约XXcm低密度影，增强扫描动脉期边缘呈结节样强化。', typical: ['肝血管瘤', '海绵状血管瘤'], tags: ['血管瘤', '强化模式', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '肝腺瘤', disease: '肝腺瘤', desc: 'CT/MR示肝内肿块，可有出血，均匀强化', insert: '肝左叶可见约XXcm肿块，密度均匀，增强扫描均匀强化。', typical: ['肝腺瘤', '肝良性肿瘤'], tags: ['腺瘤', '肝肿瘤', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '肝局灶性结节增生', disease: '肝局灶性结节增生', desc: 'CT/MR示肝内肿块，中心疤痕呈放射状，明显强化', insert: '肝右叶可见约XXcm肿块，中心可见放射状疤痕，明显强化。', typical: ['FNH', '肝局灶性结节增生'], tags: ['FNH', '疤痕', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '肝细胞癌', disease: '肝细胞癌', desc: 'CT/MR示肝内肿块，\"快进快出\"强化，可有门脉癌栓', insert: '肝右叶可见约XXcm肿块，增强扫描动脉期明显强化，门脉期快速廓清。', typical: ['HCC', '肝细胞癌'], tags: ['HCC', '快进快出', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '胆管细胞癌', disease: '肝内胆管细胞癌', desc: 'CT/MR示肝内肿块，包绕胆管扩张，强化不均匀', insert: '肝左叶可见约XXcm肿块，胆管扩张呈\"软藤征\"，增强扫描不均匀强化。', typical: ['ICC', '胆管细胞癌'], tags: ['ICC', '胆管扩张', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '肝转移瘤', disease: '肝转移瘤', desc: 'CT/MR示肝内多发大小不等肿块/结节，典型呈\"牛眼征\"', insert: '肝内可见多发大小不等肿块，较大者约XXcm，中心呈低密度，边缘环形强化。', typical: ['转移性肝癌', '多发转移'], tags: ['转移瘤', '牛眼征', '多发'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '肝脓肿', disease: '细菌性肝脓肿', desc: 'CT/MR示肝内囊性占位，边缘环形强化，内部可有气液平面', insert: '肝右叶可见约XXcm囊性占位，边缘环形强化，内可见气液平面。', typical: ['细菌性肝脓肿', '阿米巴肝脓肿'], tags: ['脓肿', '环形强化', '感染'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '肝包虫病', disease: '肝包虫病', desc: 'CT/MR示肝内囊性肿块，可见\"浮莲征\"或\"双层壁\"', insert: '肝右叶可见约XXcm囊性肿块，囊壁可见\"双层壁\"结构。', typical: ['肝包虫病', '棘球蚴病'], tags: ['包虫病', '囊肿', '寄生虫'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '肝硬化', disease: '肝硬化', desc: 'CT/MR示肝脏体积缩小，肝叶比例失调，表面呈波浪状', insert: '肝脏体积缩小，肝裂增宽，表面呈波浪状，脾脏增大。', typical: ['乙肝肝硬化', '酒精性肝硬化'], tags: ['肝硬化', '缩小', '脾大'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '脂肪肝', disease: '脂肪肝', desc: 'CT示肝脏密度减低，CT值低于脾脏，肝/脾CT比值<1', insert: '肝脏密度弥漫性减低，CT值约30Hu，肝/脾CT比值<1。', typical: ['脂肪肝', '代谢性肝病'], tags: ['脂肪肝', '密度减低'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肝血管平滑肌脂肪瘤', disease: '肝血管平滑肌脂肪瘤', desc: 'CT/MR示肝内肿块，内有脂肪密度/信号，强化不均匀', insert: '肝右叶可见约XXcm肿块，内有脂肪密度，增强扫描明显不均匀强化。', typical: ['HAML', '肝血管平滑肌脂肪瘤'], tags: ['HAML', '脂肪', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '脾破裂', disease: '脾破裂', desc: 'CT示脾脏形态不完整，包膜下血肿，增强扫描脾脏不均匀强化', insert: '脾脏体积增大，脾实质可见线性低密度影，脾周可见弧形液性密度影。', typical: ['外伤性脾破裂', '病理性脾破裂'], tags: ['脾破裂', '外伤', '急症'], modality: ['CT'], diseaseType: '外伤' },
    { name: '脾梗死', disease: '脾梗死', desc: 'CT/MR示脾内楔形或圆形低密度区，边界清楚', insert: '脾脏可见楔形低密度区，边界清楚，增强扫描无强化。', typical: ['脾梗死', '血栓栓塞'], tags: ['脾梗死', '楔形', '缺血'], modality: ['CT', 'MR'], diseaseType: '血管病变' },
    { name: '脾囊肿', disease: '脾囊肿', desc: 'CT/MR示脾内圆形水样密度/信号灶，边缘清楚', insert: '脾脏可见一枚无强化囊性灶，大小约XXcm，边界清楚。', typical: ['脾囊肿', '先天性囊肿'], tags: ['囊肿', '脾脏', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '脾血管瘤', disease: '脾血管瘤', desc: 'CT/MR示脾内肿块，边缘结节样强化', insert: '脾脏可见约XXcm肿块，增强扫描边缘呈结节样强化。', typical: ['脾血管瘤', '脾脏良性肿瘤'], tags: ['血管瘤', '脾脏', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '肾囊肿', disease: '肾囊肿', desc: 'CT/MR示肾内圆形水样密度/信号灶，边缘薄壁，无强化', insert: '左肾可见一枚无强化囊性灶，大小约XXcm，边界清楚，CT值约8Hu。', typical: ['单纯性肾囊肿', '多囊肾'], tags: ['囊肿', '囊性', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '多囊肾', disease: '多囊肾', desc: 'CT/MR示双肾布满大小不等囊肿，常伴肝囊肿', insert: '双肾可见弥漫性大小不等囊肿，较大者约XXcm，符合多囊肾。', typical: ['多囊肾', 'ADPKD'], tags: ['多囊肾', '囊肿', '先天'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '肾结石', disease: '泌尿系结石', desc: 'CT示肾内、输尿管内高密度影，CT值>200Hu', insert: '右肾盂可见高密度影，大小约XXmm，CT值约600Hu。', typical: ['肾结石', '输尿管结石'], tags: ['结石', '高密度', '急症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '肾积水', disease: '肾积水', desc: 'CT/MR/超声示肾盂肾盏扩张，呈液性密度/信号', insert: '右肾盂肾盏明显扩张，肾皮质变薄，扩张最宽处约XXmm。', typical: ['结石', '肿瘤', '先天狭窄'], tags: ['肾积水', '扩张', '梗阻'], modality: ['CT', 'MR', '超声'], diseaseType: '炎症' },
    { name: '肾细胞癌', disease: '肾细胞癌', desc: 'CT/MR示肾内肿块，\"快进快出\"强化，可有出血坏死', insert: '右肾可见约XXcm肿块，增强扫描皮髓质期明显强化，排泄期快速廓清。', typical: ['肾癌', '肾细胞癌'], tags: ['肾癌', '快进快出', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '肾血管平滑肌脂肪瘤', disease: '肾血管平滑肌脂肪瘤', desc: 'CT/MR示肾内含脂肪肿块，可有\"劈裂征\"', insert: '右肾可见约XXcm肿块，内有脂肪密度，局部可见\"劈裂征\"。', typical: ['AML', '肾错构瘤'], tags: ['AML', '脂肪', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '肾盂癌', disease: '肾盂癌', desc: 'CT/MR示肾盂内肿块，可有输尿管种植', insert: '右肾盂可见约XXcm肿块，肾盂扩张，输尿管上段可见种植结节。', typical: ['肾盂癌', '尿路上皮癌'], tags: ['肾盂癌', '尿路上皮', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '输尿管癌', disease: '输尿管癌', desc: 'CT/MR示输尿管肿块，上游肾盂积水', insert: '左侧输尿管中段可见约XXcm肿块，左肾盂肾盏扩张积水。', typical: ['输尿管癌', '尿路上皮癌'], tags: ['输尿管癌', '尿路上皮', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '膀胱癌', disease: '膀胱癌', desc: 'CT/MR示膀胱壁肿块或局部增厚，可有钙化', insert: '膀胱左后壁可见约XXcm肿块，局部膀胱壁增厚。', typical: ['膀胱癌', '膀胱恶性肿瘤'], tags: ['膀胱癌', '肿块', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '膀胱结石', disease: '膀胱结石', desc: 'CT示膀胱内高密度影，CT值>200Hu', insert: '膀胱内可见约XXcm高密度影，CT值约400Hu。', typical: ['膀胱结石', '泌尿系结石'], tags: ['结石', '膀胱', '高密度'], modality: ['CT'], diseaseType: '炎症' },
    { name: '前列腺增生', disease: '前列腺增生', desc: 'CT/MR示前列腺增大，密度/信号均匀，可见钙化', insert: '前列腺体积增大，约XXcm，密度均匀，突向膀胱底。', typical: ['前列腺增生', 'BPH'], tags: ['前列腺增生', '增大', '良性'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '前列腺癌', disease: '前列腺癌', desc: 'CT/MR示前列腺肿块，外周带多见，突破包膜', insert: '前列腺外周带可见约XXcm肿块，突破包膜，侵犯精囊腺。', typical: ['前列腺癌', '前列腺恶性肿瘤'], tags: ['前列腺癌', '外周带', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '子宫肌瘤', disease: '子宫肌瘤', desc: 'CT/MR示子宫内肿块，可有钙化，边界清楚', insert: '子宫前壁可见约XXcm肿块，边界清楚，增强扫描呈旋涡状强化。', typical: ['子宫肌瘤', '子宫腺肌症'], tags: ['肌瘤', '子宫', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '子宫腺肌症', disease: '子宫腺肌症', desc: 'MR/CT示子宫增大，肌层内小囊肿或出血，边界不清', insert: '子宫增大，肌层内可见多发小片状T1WI高信号，边界不清。', typical: ['子宫腺肌症', '子宫内膜异位'], tags: ['腺肌症', '子宫', '内异'], modality: ['MR', 'CT'], diseaseType: '炎症' },
    { name: '宫颈癌', disease: '宫颈癌', desc: 'CT/MR示宫颈肿块，可有宫旁侵犯', insert: '宫颈可见约XXcm肿块，宫旁脂肪间隙消失，侵犯直肠前壁。', typical: ['宫颈癌', '宫颈恶性肿瘤'], tags: ['宫颈癌', '肿块', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '卵巢囊肿', disease: '卵巢囊肿', desc: 'CT/MR/超声示卵巢区囊性灶，单房或多房', insert: '右侧卵巢可见约XXcm无强化囊性灶，边界清楚。', typical: ['卵巢囊肿', '卵巢巧克力囊肿'], tags: ['囊肿', '卵巢', '囊性'], modality: ['CT', 'MR', '超声'], diseaseType: '先天畸形' },
    { name: '卵巢肿瘤', disease: '卵巢癌', desc: 'CT/MR示卵巢肿块，囊实性，常有腹水', insert: '双侧卵巢可见约XXcm囊实性肿块，腹膜可见种植结节。', typical: ['卵巢癌', '卵巢恶性肿瘤'], tags: ['卵巢癌', '囊实性', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
  ]

  abdomenFindingsNew.forEach(f => {
    findings.push({
      id: `AB${String(id++ - 370).padStart(3, '0')}`,
      bodyPart: '腹部',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'abdomen',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  // 五官科 (40条)
  const entFindings = [
    { name: '鼻窦炎', disease: '鼻窦炎', desc: 'CT/MR示鼻窦黏膜增厚，窦腔积液或密度增高', insert: '双侧上颌窦、筛窦黏膜增厚，窦腔内可见积液，密度不均。', typical: ['鼻窦炎', '慢性鼻窦炎'], tags: ['鼻窦炎', '黏膜增厚', '炎症'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '鼻息肉', disease: '鼻息肉', desc: 'CT/MR示鼻腔或鼻窦内软组织肿块，边界清楚', insert: '左侧中鼻道可见约XXcm软组织肿块，密度均匀，增强扫描轻度强化。', typical: ['鼻息肉', '慢性鼻窦炎'], tags: ['鼻息肉', '肿块', '良性'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '鼻腔肿瘤', disease: '鼻腔癌', desc: 'CT/MR示鼻腔内肿块，可有骨质破坏', insert: '右侧鼻腔可见约XXcm肿块，侵犯中鼻甲及下鼻甲，局部骨质压迫吸收。', typical: ['鼻腔癌', '鼻腔恶性肿瘤'], tags: ['鼻腔肿瘤', '恶性', '肿块'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '上颌窦癌', disease: '上颌窦癌', desc: 'CT/MR示上颌窦内肿块，窦壁骨质破坏', insert: '右侧上颌窦内可见约XXcm肿块，窦壁各壁骨质破坏，增强扫描不均匀强化。', typical: ['上颌窦癌', '副鼻窦恶性肿瘤'], tags: ['上颌窦癌', '恶性', '骨质破坏'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '鼻咽癌', disease: '鼻咽癌', desc: 'CT/MR示鼻咽部肿块，咽隐窝变浅或消失', insert: '鼻咽顶后壁可见约XXcm肿块，咽隐窝消失，咽旁间隙受累。', typical: ['鼻咽癌', '鼻咽部恶性肿瘤'], tags: ['鼻咽癌', '恶性', '咽隐窝'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '腺样体肥大', disease: '腺样体肥大', desc: 'CT/MR示鼻咽顶后壁软组织增厚', insert: '鼻咽顶后壁软组织明显增厚，最厚处约XXmm，致鼻咽腔气道狭窄。', typical: ['腺样体肥大', '儿童腺样体增生'], tags: ['腺样体肥大', '增生', '先天'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '慢性鼻炎', disease: '慢性鼻炎', desc: 'CT/MR示下鼻甲黏膜增厚，鼻腔气道狭窄', insert: '双侧下鼻甲黏膜增厚，厚度约XXmm，鼻腔气道狭窄。', typical: ['慢性鼻炎', '鼻炎'], tags: ['鼻炎', '黏膜增厚', '慢性'], modality: ['CT'], diseaseType: '炎症' },
    { name: '鼻中隔偏曲', disease: '鼻中隔偏曲', desc: 'CT示鼻中隔向一侧偏曲，骨质或软骨偏曲', insert: '鼻中隔向左侧偏曲，C形偏曲，棘突形成，致左侧鼻腔狭窄。', typical: ['鼻中隔偏曲', '先天性偏曲'], tags: ['鼻中隔偏曲', '偏曲', '先天'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '上颌窦囊肿', disease: '上颌窦囊肿', desc: 'CT/MR示上颌窦内黏膜下囊肿或潴留囊肿', insert: '左侧上颌窦底壁可见约XXcm圆形囊性灶，边界清楚，CT值约15Hu。', typical: ['上颌窦囊肿', '鼻窦囊肿'], tags: ['囊肿', '上颌窦', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '额窦黏液囊肿', disease: '额窦黏液囊肿', desc: 'CT/MR示额窦内囊性肿块，窦壁膨胀性改变', insert: '右侧额窦可见约XXcm囊性肿块，窦腔扩大，骨壁变薄向外膨隆。', typical: ['额窦黏液囊肿', '鼻窦囊肿'], tags: ['黏液囊肿', '额窦', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '中耳炎', disease: '中耳炎', desc: 'CT/MR示中耳腔密度增高，乳突气房浑浊', insert: '右侧中耳腔及乳突气房内可见软组织密度影，听小骨结构尚清。', typical: ['中耳炎', '慢性中耳炎'], tags: ['中耳炎', '中耳', '炎症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '胆脂瘤型中耳炎', disease: '胆脂瘤型中耳炎', desc: 'CT/MR示中耳内软组织肿块，听小骨破坏，骨质侵蚀', insert: '右侧中耳及乳突可见约XXcm软组织肿块，听小骨部分破坏，鼓室盾板骨质吸收。', typical: ['胆脂瘤型中耳炎', '慢性中耳炎'], tags: ['胆脂瘤', '中耳炎', '骨质破坏'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '面神经瘤', disease: '面神经鞘瘤', desc: 'CT/MR示面神经走形区肿块，可有强化', insert: '左侧桥小脑角区及颞骨内面神经走形区可见约XXcm肿块，明显强化。', typical: ['面神经鞘瘤', '面神经肿瘤'], tags: ['面神经瘤', '神经鞘瘤', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '听神经瘤', disease: '听神经瘤', desc: 'MR/CT示桥小脑角区肿块，内听道扩大', insert: '左侧桥小脑角区可见约XXcm肿块，与内听道相连，内听道呈喇叭口样扩大。', typical: ['听神经瘤', '神经鞘瘤'], tags: ['听神经瘤', '桥小脑角', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '颈静脉球瘤', disease: '颈静脉球瘤', desc: 'CT/MR示颈静脉孔区富血供肿块', insert: '右侧颈静脉孔区可见约XXcm肿块，T2WI明显高信号，增强扫描显著强化。', typical: ['颈静脉球瘤', '血管球瘤'], tags: ['颈静脉球瘤', '富血供', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '外耳道骨疣', disease: '外耳道骨疣', desc: 'CT示外耳道骨性肿块，单侧或双侧', insert: '左侧外耳道前壁可见骨性突起，宽基底，致外耳道狭窄。', typical: ['外耳道骨疣', '外耳道良性肿物'], tags: ['骨疣', '外耳道', '良性'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '外耳道胆脂瘤', disease: '外耳道胆脂瘤', desc: 'CT/MR示外耳道内软组织肿块，骨质侵蚀', insert: '右侧外耳道内可见约XXcm软组织影，局部骨质侵蚀破坏。', typical: ['外耳道胆脂瘤', '外耳道疾病'], tags: ['胆脂瘤', '外耳道', '良性'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '先天性小耳畸形', disease: '先天性小耳畸形', desc: 'CT/MR示外耳道狭窄或闭锁，颞骨发育异常', insert: '右侧外耳道闭锁，颞骨鳞部发育较小，符合先天性小耳畸形。', typical: ['先天性小耳畸形', '外耳道闭锁'], tags: ['小耳畸形', '外耳道', '先天'], modality: ['CT'], diseaseType: '先天畸形' },
    { name: '腮腺肿瘤', disease: '腮腺多形性腺瘤', desc: 'CT/MR示腮腺内肿块，边界清楚，可有囊变', insert: '左侧腮腺浅叶可见约XXcm肿块，边界清楚，密度不均，可见囊性变。', typical: ['腮腺多形性腺瘤', '腮腺肿瘤'], tags: ['腮腺肿瘤', '腺瘤', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '腮腺恶性肿瘤', disease: '腮腺粘液表皮样癌', desc: 'CT/MR示腮腺内肿块，边界不清，侵袭性生长', insert: '右侧腮腺深叶可见约XXcm肿块，边界不清，侵犯下颌后静脉。', typical: ['腮腺粘液表皮样癌', '腮腺恶性肿瘤'], tags: ['腮腺癌', '恶性', '侵袭'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '颌下腺肿瘤', disease: '颌下腺腺样囊性癌', desc: 'CT/MR示颌下腺内肿块，可有神经周围侵犯', insert: '左侧颌下腺可见约XXcm肿块，密度不均匀，沿神经侵犯舌下神经。', typical: ['颌下腺腺样囊性癌', '颌下腺肿瘤'], tags: ['颌下腺肿瘤', '腺样囊性癌', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '喉癌', disease: '喉癌', desc: 'CT/MR示喉部肿块，声带固定，会厌受累', insert: '声门上区可见约XXcm肿块，累及会厌根部，双侧声带略增厚。', typical: ['喉癌', '喉部恶性肿瘤'], tags: ['喉癌', '恶性', '喉部'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '声带息肉', disease: '声带息肉', desc: 'CT/MR示声带游离缘小结节', insert: '右侧声带游离缘可见约XXmm结节影，密度均匀，基底较宽。', typical: ['声带息肉', '喉部良性病变'], tags: ['声带息肉', '息肉', '良性'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '声带麻痹', disease: '声带麻痹', desc: 'CT/MR示患侧声带固定于旁正中位，喉室扩大', insert: '左侧声带固定于旁正中位，喉室扩大，左侧环杓关节欠规则。', typical: ['声带麻痹', '喉返神经损伤'], tags: ['声带麻痹', '神经麻痹', '外伤'], modality: ['CT', 'MR'], diseaseType: '外伤' },
    { name: '会厌囊肿', disease: '会厌囊肿', desc: 'CT/MR示会厌区囊性灶，边缘清楚', insert: '会厌谷可见约XXcm囊性灶，CT值约15Hu，边缘清楚，增强扫描无强化。', typical: ['会厌囊肿', '喉部囊肿'], tags: ['囊肿', '会厌', '良性'], modality: ['CT', 'MR'], diseaseType: '先天畸形' },
    { name: '扁桃体肥大', disease: '扁桃体肥大', desc: 'CT/MR示双侧扁桃体增大，突向咽腔', insert: '双侧腭扁桃体明显增大，厚度约XXmm，突向咽腔，气道受压。', typical: ['扁桃体肥大', '慢性扁桃体炎'], tags: ['扁桃体肥大', '增大', '炎症'], modality: ['CT'], diseaseType: '炎症' },
    { name: '咽旁脓肿', disease: '咽旁脓肿', desc: 'CT/MR示咽旁间隙囊性肿块，边缘环形强化', insert: '右侧咽旁间隙可见约XXcm囊性肿块，边缘环形强化，中心可见气液平面。', typical: ['咽旁脓肿', '口底感染'], tags: ['脓肿', '咽旁间隙', '感染'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '甲状腺结节', disease: '甲状腺结节', desc: 'CT/超声示甲状腺内结节，可为实性或囊性', insert: '甲状腺右叶可见约XXcm结节，T1WI等信号，T2WI高信号，增强扫描不均匀强化。', typical: ['甲状腺结节', '甲状腺腺瘤', '甲状腺癌'], tags: ['甲状腺结节', '结节', '肿瘤'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '甲状腺癌', disease: '甲状腺乳头状癌', desc: 'CT/MR示甲状腺内肿块，可有钙化，侵犯包膜', insert: '甲状腺左叶可见约XXcm肿块，边缘毛糙，突破包膜，增强扫描不均匀强化。', typical: ['甲状腺乳头状癌', '甲状腺癌'], tags: ['甲状腺癌', '恶性', '乳头状'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '甲状腺弥漫性病变', disease: 'Graves病', desc: 'CT/MR示甲状腺弥漫性增大，密度/信号减低', insert: '甲状腺弥漫性增大，T2WI信号不均匀增高，增强扫描明显强化。', typical: ['Graves病', '甲亢'], tags: ['Graves病', '甲亢', '弥漫'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '颈淋巴结转移', disease: '颈部淋巴结转移', desc: 'CT/MR示颈部多发肿大淋巴结，可有坏死', insert: '双侧颈动脉鞘周围可见多发肿大淋巴结，较大者约XXcm，中心可见坏死。', typical: ['淋巴结转移', '头颈部肿瘤'], tags: ['淋巴结转移', '转移', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '神经鞘瘤', disease: '颈部神经鞘瘤', desc: 'CT/MR示颈椎旁肿块，沿神经走形，可有\"靶征\"', insert: '左侧椎动脉旁可见约XXcm肿块，T2WI呈靶征，与神经根关系密切。', typical: ['颈部神经鞘瘤', '神经纤维瘤'], tags: ['神经鞘瘤', '颈部', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '眼部外伤', disease: '眼球破裂伤', desc: 'CT/MR示眼球壁连续性中断，眼内容物脱出', insert: '右眼环前壁可见不连续，眼球形态不规则，眶内可见积气。', typical: ['眼球破裂伤', '眼部外伤'], tags: ['眼球破裂', '外伤', '急症'], modality: ['CT', 'MR'], diseaseType: '外伤' },
    { name: '眶内异物', disease: '眶内异物', desc: 'CT示眶内高密度异物影，可有金属伪影', insert: '左眼眶内可见约XXmm高密度影，周围可见放射状金属伪影，异物存留。', typical: ['眶内异物', '眼部外伤'], tags: ['异物', '眶内', '外伤'], modality: ['CT'], diseaseType: '外伤' },
    { name: '眶内肿瘤', disease: '眶内海绵状血管瘤', desc: 'CT/MR示眶内肿块，T2WI高信号，明显强化', insert: '左眼眶肌锥内可见约XXcm肿块，T2WI明显高信号，增强扫描渐进性明显强化。', typical: ['眶内海绵状血管瘤', '眶内肿瘤'], tags: ['海绵状血管瘤', '眶内', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '眶内炎性假瘤', disease: '眶内炎性假瘤', desc: 'CT/MR示眶内软组织肿块，眼外肌增粗，泪腺肿大', insert: '左眼眶内可见软组织肿块，眼外肌增粗，泪腺增大，增强扫描明显强化。', typical: ['眶内炎性假瘤', '眼眶炎症'], tags: ['炎性假瘤', '眶内', '炎症'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: 'Graves眼病', disease: 'Graves眼病', desc: 'CT/MR示眼外肌增粗，眶脂体增多，泪腺脱垂', insert: '双侧眼上静脉增粗，眼外肌增粗，以下斜肌为著，眶脂体增多。', typical: ['Graves眼病', '甲亢相关眼病'], tags: ['Graves眼病', '眼外肌', '内分泌'], modality: ['CT', 'MR'], diseaseType: '炎症' },
    { name: '视网膜脱离', disease: '视网膜脱离', desc: 'MR/CT示视网膜V形脱离，T2WI高信号', insert: '右眼球后壁可见V形T2WI高信号影，视网膜与脉络膜之间积液。', typical: ['视网膜脱离', '眼底病'], tags: ['视网膜脱离', '眼底', '急症'], modality: ['MR'], diseaseType: '炎症' },
    { name: '脉络膜黑色素瘤', disease: '脉络膜黑色素瘤', desc: 'CT/MR示眼球内肿块，T1WI高信号，T2WI低信号', insert: '左眼球鼻侧可见约XXcm肿块，T1WI高信号，T2WI低信号，增强扫描轻度强化。', typical: ['脉络膜黑色素瘤', '眼内肿瘤'], tags: ['黑色素瘤', '脉络膜', '恶性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '视神经胶质瘤', disease: '视神经胶质瘤', desc: 'MR/CT示视神经梭形增粗，可有囊变', insert: '左侧视神经眶内段梭形增粗，厚度约XXmm，T2WI高信号，增强扫描明显强化。', typical: ['视神经胶质瘤', '视神经肿瘤'], tags: ['视神经胶质瘤', '视神经', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
    { name: '视神经鞘脑膜瘤', disease: '视神经鞘脑膜瘤', desc: 'CT/MR示视神经周围肿块，钙化常见', insert: '左侧视神经周围可见约XXcm肿块环绕视神经，CT可见钙化，增强扫描明显强化。', typical: ['视神经鞘脑膜瘤', '脑膜瘤'], tags: ['脑膜瘤', '视神经鞘', '良性'], modality: ['CT', 'MR'], diseaseType: '肿瘤' },
  ]

  entFindings.forEach(f => {
    findings.push({
      id: `ENT${String(id++ - 310).padStart(3, '0')}`,
      bodyPart: '五官科',
      findingName: f.name,
      disease: f.disease,
      description: f.desc,
      imageUrl: 'brain',
      insertText: f.insert,
      typicalIn: f.typical,
      tags: f.tags,
      usageCount: Math.floor(Math.random() * 500) + 50,
      modality: f.modality,
      diseaseType: f.diseaseType,
    })
  })

  return findings
}

const ALL_FINDINGS = generateFindings()

// ============================================================
// 常量配置
// ============================================================
export const BODY_PART_KEYS = ['all', 'head', 'neck', 'chest', 'abdomen', 'pelvis', 'spine', 'extremities', 'nervousSystem', 'vascular'] as const
const MODALITY_LIST = ['全部', 'CT', 'MR', 'DR', 'XR', '超声', 'CTA', 'MRA', 'DSA', 'MG']
export const DISEASE_TYPE_KEYS = ['all', 'tumor', 'inflammation', 'trauma', 'vascularDisease', 'congenital'] as const
const BODY_PART_COLORS: Record<string, string> = {
  '头部': '#8b5cf6',
  '颈部': 'var(--color-info-500)',
  '胸部': 'var(--color-warning-500)',
  '腹部': '#10b981',
  '骨盆': '#ec4899',
  '脊柱': 'var(--color-primary-500)',
  '四肢': '#84cc16',
  '神经系统': '#a855f7',
  '血管': 'var(--color-error-500)',
}
const BODY_PART_BG: Record<string, string> = {
  '头部': 'rgba(168, 85, 247, 0.12)',
  '颈部': 'var(--color-info-bg)',
  '胸部': 'var(--color-warning-bg)',
  '腹部': 'var(--color-success-bg)',
  '骨盆': 'rgba(236, 72, 153, 0.12)',
  '脊柱': 'var(--color-pending-bg)',
  '四肢': 'rgba(132, 204, 22, 0.12)',
  '神经系统': 'rgba(168, 85, 247, 0.12)',
  '血管': 'var(--color-error-bg)',
}
const DISEASE_COLORS: Record<string, string> = {
  '肿瘤': 'var(--color-error-600)',
  '炎症': 'var(--color-warning-600)',
  '外伤': 'var(--color-primary-600)',
  '血管病变': 'var(--color-error-600)',
  '先天畸形': '#7c3aed',
}
const DISEASE_BG: Record<string, string> = {
  '肿瘤': 'var(--color-error-bg)',
  '炎症': 'var(--color-warning-bg)',
  '外伤': 'var(--color-pending-bg)',
  '血管病变': 'var(--color-error-bg)',
  '先天畸形': 'rgba(124, 58, 237, 0.12)',
}
const MODALITY_COLORS: Record<string, string> = {
  'CT': 'var(--color-primary-500)',
  'MR': '#8b5cf6',
  'DR': 'var(--color-success-500)',
  'XR': 'var(--color-success-500)',
  '超声': 'var(--color-warning-500)',
  'CTA': 'var(--color-error-500)',
  'MRA': '#8b5cf6',
  'DSA': 'var(--color-warning-500)',
  'MG': '#ec4899',
}

// ============================================================
// 主组件
// ============================================================
export default function FindingLibraryPage() {
  const { t: tv3 } = useTranslation('v3report')
  const BODY_PARTS = useMemo(() => [
    t('findingLib.filterAll'),
    t('findingLib.filterHead'),
    t('findingLib.filterNeck'),
    t('findingLib.filterChest'),
    t('findingLib.filterAbdomen'),
    t('findingLib.filterPelvis'),
    t('findingLib.filterSpine'),
    t('findingLib.filterExtremities'),
    t('findingLib.filterNervousSystem'),
    t('findingLib.filterVascular'),
  ], [t])
  const DISEASE_TYPES = useMemo(() => [
    t('findingLib.filterAll'),
    t('findingLib.filterTumor'),
    t('findingLib.filterInflammation'),
    t('findingLib.filterTrauma'),
    t('findingLib.filterVascularDisease'),
    t('findingLib.filterCongenital'),
  ], [t])
  // i18n 标签 → 数据值 反向映射 (须先于 stats/filteredFindings 使用, 避免 TDZ)
  const BODY_PART_REVERSE: Record<string, string> = useMemo(() => ({
    [t('findingLib.filterHead')]: '头部',
    [t('findingLib.filterNeck')]: '颈部',
    [t('findingLib.filterChest')]: '胸部',
    [t('findingLib.filterAbdomen')]: '腹部',
    [t('findingLib.filterPelvis')]: '骨盆',
    [t('findingLib.filterSpine')]: '脊柱',
    [t('findingLib.filterExtremities')]: '四肢',
    [t('findingLib.filterNervousSystem')]: '神经系统',
    [t('findingLib.filterVascular')]: '血管',
  }), [t])
  const DISEASE_TYPE_REVERSE: Record<string, string> = useMemo(() => ({
    [t('findingLib.filterTumor')]: '肿瘤',
    [t('findingLib.filterInflammation')]: '炎症',
    [t('findingLib.filterTrauma')]: '外伤',
    [t('findingLib.filterVascularDisease')]: '血管病变',
    [t('findingLib.filterCongenital')]: '先天畸形',
  }), [t])
  // [v3.0.6.11-98 Wave2B (报告 P1)] 征象库双源: api=后端 /finding-library, fallback=内置 200 条
  //   注意: 状态声明须先于下方 effects (避免 TDZ)
  const [searchText, setSearchText] = useState('')
  const [dataSource, setDataSource] = useState<'api' | 'fallback'>('api')
  const [findingsLoading, setFindingsLoading] = useState(true)
  const [findings, setFindings] = useState<TypicalFinding[]>(ALL_FINDINGS)
  const serverFindingsRef = useRef<TypicalFinding[]>(ALL_FINDINGS)
  const searchInFlightRef = useRef(0)

  // 后端征象条目 → 页面 TypicalFinding 形状 (desc→description, keywords→tags)
  const mapServerItems = (groups: Array<{ category: string; items: Array<{ id: string; name: string; description: string; keywords: string[] }> }>): TypicalFinding[] => {
    const out: TypicalFinding[] = []
    groups.forEach((g) => {
      (g.items ?? []).forEach((it, i) => {
        out.push({
          id: it.id || `${g.category}-${i}`,
          bodyPart: g.category,
          findingName: it.name,
          disease: '',
          description: it.description,
          imageUrl: '',
          insertText: it.description,
          typicalIn: [],
          tags: it.keywords ?? [],
          usageCount: 0,
          modality: [],
          diseaseType: '',
        })
      })
    })
    return out
  }

  // 挂载: 拉取后端分组列表; 失败 → 内置 200 条回退 (徽标)
  useEffect(() => {
    let cancelled = false
    setFindingsLoading(true)
    findingLibraryApi.list().then((res) => {
      if (cancelled) return
      const groups = Array.isArray(res.data) ? res.data : []
      if (groups.length > 0) {
        const mapped = mapServerItems(groups)
        serverFindingsRef.current = mapped
        setFindings(mapped)
        setDataSource('api')
      } else {
        setDataSource('fallback')
      }
    }).catch(() => { if (!cancelled) setDataSource('fallback') })
      .finally(() => { if (!cancelled) setFindingsLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 检索: 服务端命中 → /finding-library/search; 失败/空 → 内置库本地过滤 (徽标)
  useEffect(() => {
    const kw = searchText.trim()
    if (dataSource !== 'api' || !kw) return
    const token = ++searchInFlightRef.current
    findingLibraryApi.search(kw).then((res) => {
      if (token !== searchInFlightRef.current) return
      const groups = Array.isArray(res.data) ? res.data : []
      if (groups.length > 0) {
        setFindings(mapServerItems(groups))
      } else {
        setFindings(ALL_FINDINGS.filter((f) => {
          const s = kw.toLowerCase()
          return f.findingName.toLowerCase().includes(s) ||
            f.description.toLowerCase().includes(s) ||
            f.disease.toLowerCase().includes(s) ||
            f.tags.some((tag) => tag.toLowerCase().includes(s))
        }))
      }
    }).catch(() => {
      if (token !== searchInFlightRef.current) return
      const s = kw.toLowerCase()
      setFindings(ALL_FINDINGS.filter((f) =>
        f.findingName.toLowerCase().includes(s) ||
        f.description.toLowerCase().includes(s) ||
        f.disease.toLowerCase().includes(s) ||
        f.tags.some((tag) => tag.toLowerCase().includes(s))))
      setDataSource('fallback')
    })
  }, [searchText, dataSource])

  // 搜索清空: 恢复服务端全量 (若 API 曾成功)
  useEffect(() => {
    if (!searchText.trim() && dataSource === 'api') setFindings(serverFindingsRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])
  // ---------- 状态 ----------
  const [activeBodyPart, setActiveBodyPart] = useState(() => t('findingLib.filterAll'))
  const [activeModality, setActiveModality] = useState('全部')
  const [activeDiseaseType, setActiveDiseaseType] = useState(() => t('findingLib.filterAll'))
  const [gridColumns, setGridColumns] = useState(4)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [selectedFinding, setSelectedFinding] = useState<TypicalFinding | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [showLeftPanel, setShowLeftPanel] = useState(true)

  // ---------- 统计数据 ----------
  const stats = useMemo(() => ({
    total: findings.length,
    byBodyPart: BODY_PARTS.slice(1).map(bp => ({
      name: bp,
      count: findings.filter(f => f.bodyPart === (BODY_PART_REVERSE[bp] || bp)).length
    })),
    byModality: MODALITY_LIST.slice(1).map(m => ({
      name: m,
      count: findings.filter(f => f.modality.includes(m)).length
    })),
    topUsed: [...findings].sort((a, b) => b.usageCount - a.usageCount).slice(0, 10),
  }), [findings])

  // ---------- 过滤 ----------
  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      // 部位
      if (activeBodyPart !== t('findingLib.filterAll')) {
        const dataVal = BODY_PART_REVERSE[activeBodyPart] || activeBodyPart
        if (f.bodyPart !== dataVal) return false
      }
      // 检查类型
      if (activeModality !== '全部' && !f.modality.includes(activeModality)) return false
      // 疾病类型
      if (activeDiseaseType !== t('findingLib.filterAll')) {
        const dataVal = DISEASE_TYPE_REVERSE[activeDiseaseType] || activeDiseaseType
        if (f.diseaseType !== dataVal) return false
      }
      // 搜索
      if (searchText) {
        const s = searchText.toLowerCase()
        if (!f.findingName.toLowerCase().includes(s) &&
            !f.description.toLowerCase().includes(s) &&
            !f.disease.toLowerCase().includes(s) &&
            !f.tags.some(t => t.toLowerCase().includes(s))) return false
      }
      // 收藏
      if (showFavoritesOnly && !favorites.has(f.id)) return false
      return true
    })
  }, [findings, activeBodyPart, activeModality, activeDiseaseType, searchText, favorites, showFavoritesOnly])

  // ---------- 收藏 ----------
  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---------- 复制 ----------
  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    }
  }

  // ---------- 插入报告 ----------
  const handleInsert = (finding: TypicalFinding) => {
    handleCopy(finding.insertText, finding.id)
    setShowDetailModal(false)
  }

  // ---------- 打开详情 ----------
  const openDetail = (finding: TypicalFinding) => {
    setSelectedFinding(finding)
    setShowDetailModal(true)
  }

  // ============================================================
  // 渲染：占位图
  // ============================================================
  const renderPlaceholder = (finding: TypicalFinding) => {
    const iconMap: Record<string, React.ReactNode> = {
      brain: <Brain size={40} color="var(--text-secondary)" />,
      chest: <Activity size={40} color="var(--text-secondary)" />,
      abdomen: <Activity size={40} color="var(--text-secondary)" />,
      spine: <Bone size={40} color="var(--text-secondary)" />,
      bone: <Bone size={40} color="var(--text-secondary)" />,
      vessel: <Activity size={40} color="var(--text-secondary)" />,
    }
    const icon = iconMap[finding.imageUrl] || <ImageIcon size={40} color="var(--text-secondary)" />
    return (
      <div style={{
        width: '100%',
        height: 120,
        background: 'linear-gradient(135deg, var(--content-bg) 0%, var(--border-color) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {icon}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: BODY_PART_COLORS[finding.bodyPart] || '#94a3b8',
        }} />
      </div>
    )
  }

  // ============================================================
  // 渲染：征象卡片
  // ============================================================
  const renderCard = (finding: TypicalFinding) => {
    const isHovered = hoveredId === finding.id
    const isFav = favorites.has(finding.id)
    const isCopied = copiedId === finding.id

    return (
      <Card bordered={false}
        key={finding.id}
        role="button"
        tabIndex={0}
        onClick={() => openDetail(finding)}
        onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(finding) } }}
        onMouseEnter={() => setHoveredId(finding.id)}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          background: COLORS.white,
          borderRadius: 12,
          border: `1px solid ${isHovered ? COLORS.primaryBlue : COLORS.border}`,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.2s',
          transform: isHovered ? 'translateY(-4px)' : 'none',
          boxShadow: isHovered ? '0 12px 24px rgba(30,58,95,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
          position: 'relative',
        }}
       styles={{ body: { padding: 0 } }}>
        {/* 占位图 */}
        {renderPlaceholder(finding)}

        {/* 内容区 */}
        <div style={{ padding: '12px 14px 14px' }}>
          {/* 标题行 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2, 8px)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, lineHeight: 1.3, marginBottom: 2 }}>
                {finding.findingName}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                {finding.disease}
              </div>
            </div>
            <button
              onClick={(e) => toggleFavorite(finding.id, e)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 'var(--space-1, 4px)',
                color: isFav ? 'var(--color-warning-500)' : COLORS.textLight,
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s',
                flexShrink: 0,
              }}
            >
              {isFav ? <Star size={16} fill="var(--color-warning-500)" color="var(--color-warning-500)" /> : <StarOff size={16} />}
            </button>
          </div>

          {/* 描述 */}
          <div style={{
            fontSize: 12,
            color: COLORS.textMuted,
            lineHeight: 1.5,
            marginBottom: 10,
            display: '-webkit-box',
            WebkitLineClamp: isHovered ? 10 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {finding.description}
          </div>

          {/* 标签行 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1, 4px)', marginBottom: 10 }}>
            {/* 部位 */}
            <span style={{
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: BODY_PART_BG[finding.bodyPart] || 'var(--content-bg)',
              color: BODY_PART_COLORS[finding.bodyPart] || COLORS.textMuted,
            }}>
              {finding.bodyPart}
            </span>
            {/* 疾病类型 */}
            <span style={{
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: DISEASE_BG[finding.diseaseType] || 'var(--content-bg)',
              color: DISEASE_COLORS[finding.diseaseType] || COLORS.textMuted,
            }}>
              {finding.diseaseType}
            </span>
          </div>

          {/* 检查类型 */}
          <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', marginBottom: 10, flexWrap: 'wrap' }}>
            {finding.modality.slice(0, 3).map(m => (
              <span key={m} style={{
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--bg-card)',
                color: MODALITY_COLORS[m] || COLORS.textMuted,
                border: `1px solid ${MODALITY_COLORS[m] || COLORS.border}30`,
              }}>
                {m}
              </span>
            ))}
          </div>

          {/* 底部按钮 */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleInsert(finding) }}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 6,
                border: 'none',
                background: isCopied ? COLORS.success : `linear-gradient(135deg, ${COLORS.primaryBlue}, var(--color-primary-700))`,
                color: COLORS.white,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-1, 4px)',
                transition: 'all 0.15s',
              }}
            >
              {isCopied ? <><Check size={12} /> {tv3('findingCopied')}</> : <><Zap size={12} /> {tv3('findingInsertReport')}</>}
            </button>
            <button aria-label="查看详情"
              onClick={(e) => { e.stopPropagation(); openDetail(finding) }}
              style={{
                padding: '7px 10px',
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.white,
                color: COLORS.textMuted,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1, 4px)',
              }}
            >
              <Info size={12} />
            </button>
          </div>
        </div>
      </Card>
    )
  }

  // ============================================================
  // 渲染：详情弹窗
  // ============================================================
  const renderDetailModal = () => {
    if (!selectedFinding) return null

    const isFav = favorites.has(selectedFinding.id)
    const isCopied = copiedId === selectedFinding.id

    return (
      <div
        onClick={() => setShowDetailModal(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--space-5, 20px)',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: COLORS.white,
            borderRadius: 16,
            width: '100%',
            maxWidth: 780,
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          }}
        >
          {/* 头部 */}
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: COLORS.white,
            zIndex: 1,
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 'var(--space-1, 4px)' }}>
                {selectedFinding.findingName}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                {selectedFinding.disease}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
              <button
                onClick={() => toggleFavorite(selectedFinding.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: `1px solid ${isFav ? 'var(--color-warning-500)' : COLORS.border}`,
                  background: isFav ? 'var(--color-warning-bg)' : 'var(--bg-card)',
                  color: isFav ? 'var(--color-warning-500)' : COLORS.textMuted,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1, 4px)',
                }}
              >
                {isFav ? <Star size={14} fill="var(--color-warning-500)" color="var(--color-warning-500)" /> : <StarOff size={14} />}
                {isFav ? tv3('favored') : tv3('favorite')}
              </button>
              <button aria-label="关闭"
                onClick={() => setShowDetailModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.white,
                  color: COLORS.textMuted,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 影像图 */}
          <div style={{ padding: 'var(--space-5, 20px)', background: COLORS.background }}>
            <div style={{
              background: `linear-gradient(135deg, #1e293b 0%, #0f172a 100%)`,
              borderRadius: 12,
              height: 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
                  {selectedFinding.bodyPart === '头部' && <Brain size={64} color="#60a5fa" />}
                  {selectedFinding.bodyPart === '胸部' && <Activity size={64} color="#60a5fa" />}
                  {selectedFinding.bodyPart === '腹部' && <Activity size={64} color="#60a5fa" />}
                  {selectedFinding.bodyPart === '脊柱' && <Bone size={64} color="#60a5fa" />}
                  {selectedFinding.bodyPart === '四肢' && <Bone size={64} color="#60a5fa" />}
                  {selectedFinding.bodyPart === '血管' && <Activity size={64} color="#60a5fa" />}
                  {!['头部', '胸部', '腹部', '脊柱', '四肢', '血管'].includes(selectedFinding.bodyPart) && <ImageIcon size={64} color="#60a5fa" />}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                  {tv3('findingPlaceholderImage')}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 'var(--space-1, 4px)' }}>
                  {selectedFinding.findingName} · {selectedFinding.bodyPart}
                </div>
              </div>
              {/* 标签 */}
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  background: BODY_PART_BG[selectedFinding.bodyPart],
                  color: BODY_PART_COLORS[selectedFinding.bodyPart],
                }}>
                  {selectedFinding.bodyPart}
                </span>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  background: DISEASE_BG[selectedFinding.diseaseType],
                  color: DISEASE_COLORS[selectedFinding.diseaseType],
                }}>
                  {selectedFinding.diseaseType}
                </span>
              </div>
            </div>
          </div>

          {/* 内容 */}
          <div style={{ padding: '20px 24px' }}>
            {/* 描述 */}
            <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} color={COLORS.primaryBlue} />
                {tv3('findingDetailDescription')}
              </div>
              <div style={{
                padding: '12px 14px',
                background: COLORS.background,
                borderRadius: 8,
                fontSize: 12,
                color: COLORS.text,
                lineHeight: 1.7,
                borderLeft: `3px solid ${COLORS.primaryBlue}`,
              }}>
                {selectedFinding.description}
              </div>
            </div>

            {/* 典型疾病 */}
            <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} color={COLORS.primaryBlue} />
                {tv3('findingTypicalFor')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedFinding.typicalIn.map((d, i) => (
                  <span key={i} style={{
                    padding: '5px 12px',
                    borderRadius: 16,
                    fontSize: 12,
                    fontWeight: 500,
                    background: COLORS.infoBg,
                    color: COLORS.info,
                    border: `1px solid ${COLORS.info}30`,
                  }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {/* 检查要点 */}
            <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Scan size={14} color={COLORS.primaryBlue} />
                {tv3('findingExamTips')}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
                {selectedFinding.modality.map(m => (
                  <span key={m} style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    background: 'var(--bg-card)',
                    color: MODALITY_COLORS[m] || COLORS.textMuted,
                    border: `1px solid ${MODALITY_COLORS[m] || COLORS.border}40`,
                  }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* 标签 */}
            <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={14} color={COLORS.primaryBlue} />
                {tv3('findingDetailTags')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedFinding.tags.map((t, i) => (
                  <span key={i} style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    background: 'var(--bg-card)',
                    color: COLORS.textMuted,
                  }}>
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            {/* 可插入文本 */}
            <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} color={COLORS.primaryBlue} />
                {tv3('findingInsertableText')}
              </div>
              <div style={{
                padding: 14,
                background: COLORS.backgroundLight,
                borderRadius: 8,
                fontSize: 12,
                color: COLORS.text,
                lineHeight: 1.7,
                border: `1px solid ${COLORS.border}`,
                position: 'relative',
              }}>
                <div style={{ color: COLORS.textMuted, fontSize: 12, marginBottom: 6 }}>{tv3('findingClickToCopy')}</div>
                {selectedFinding.insertText}
              </div>
            </div>

            {/* 统计信息 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-3, 12px)',
              marginBottom: 'var(--space-5, 20px)',
            }}>
              <div style={{
                padding: 14,
                background: COLORS.infoBg,
                borderRadius: 10,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.info, marginBottom: 2 }}>
                  {selectedFinding.usageCount}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{tv3('findingUsageCount')}</div>
              </div>
              <div style={{
                padding: 14,
                background: COLORS.successBg,
                borderRadius: 10,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.success, marginBottom: 2 }}>
                  {selectedFinding.modality.length}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{tv3('findingApplicableModalities')}</div>
              </div>
              <div style={{
                padding: 14,
                background: 'var(--color-warning-bg)',
                borderRadius: 10,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.warning, marginBottom: 2 }}>
                  {selectedFinding.typicalIn.length}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{tv3('findingTypicalDiseases')}</div>
              </div>
            </div>

            {/* 插入按钮 */}
            <button
              onClick={() => handleInsert(selectedFinding)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 10,
                border: 'none',
                background: isCopied
                  ? COLORS.success
                  : `linear-gradient(135deg, ${COLORS.primaryBlue}, var(--color-primary-700))`,
                color: COLORS.white,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2, 8px)',
                boxShadow: isCopied
                  ? '0 4px 12px rgba(5,150,105,0.3)'
                  : '0 4px 12px rgba(59,130,246,0.3)',
              }}
            >
              {isCopied ? (
                <><Check size={18} /> {tv3('findingCopiedToClipboard')}</>
              ) : (
                <><Zap size={18} /> {tv3('findingInsertToReport')}</>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // 渲染：我的收藏面板
  // ============================================================
  const renderFavoritesPanel = () => {
    const favFindings = ALL_FINDINGS.filter(f => favorites.has(f.id))
    if (favFindings.length === 0) {
      return (
        <div style={{
          padding: 'var(--space-4, 16px)',
          textAlign: 'center',
          color: COLORS.textMuted,
          fontSize: 12,
        }}>
          <StarOff size={32} color={COLORS.textLight} style={{ marginBottom: 'var(--space-2, 8px)' }} />
          <div>{tv3('findingNoFavorites')}</div>
          <div style={{ fontSize: 12, marginTop: 'var(--space-1, 4px)' }}>{tv3('findingFavoritesHint')}</div>
        </div>
      )
    }
    return (
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Star size={13} fill="var(--color-warning-500)" color="var(--color-warning-500)" />
          {tv3('findingMyFavorites')} ({favFindings.length})
        </div>
        {favFindings.slice(0, 5).map(f => (
          <div
            key={f.id}
            role="button"
            tabIndex={0}
            onClick={() => openDetail(f)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(f) } }}
            style={{
              padding: '8px 10px',
              background: COLORS.backgroundLight,
              borderRadius: 8,
              marginBottom: 6,
              cursor: 'pointer',
              border: `1px solid ${COLORS.border}`,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = COLORS.primaryBlue)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = COLORS.border)}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>
              {f.findingName}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>
              {f.bodyPart} · {tv3('findingUsage', { count: f.usageCount })}
            </div>
          </div>
        ))}
        {favFindings.length > 5 && (
          <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: 'var(--space-1, 4px)' }}>
            {tv3('findingMore', { count: favFindings.length - 5 })}
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // 渲染：布局
  // ============================================================
  return (
    <div style={{ display: 'flex', height: '100%', background: COLORS.background }}>
      {/* ===== 左侧面板 ===== */}
      {showLeftPanel && (
        <div style={{
          width: 260,
          minWidth: 260,
          background: COLORS.white,
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* 标题 */}
          <div style={{
            padding: '16px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2, 8px)',
          }}>
            <div style={{
              width: 32,
              height: 32,
              background: `linear-gradient(135deg, ${COLORS.primaryBlue}, var(--color-primary-700))`,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <BookOpen size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{tv3('findingLibraryTitle')}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>{tv3('findingCount', { count: findings.length })}</div>
              {/* [v3.0.6.11-98 Wave2B (报告 P1)] 数据源徽标: api=服务端征象库 / fallback=内置知识库回退 */}
              {findingsLoading ? (
                <span style={{
                  display: 'inline-block',
                  marginTop: 6,
                  padding: '2px 10px',
                  background: 'var(--color-warning-bg)',
                  border: '1px solid #fde68a',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#b45309',
                }}>
                  {t("findingLib.loading")}
                </span>
              ) : dataSource === 'api' ? (
                <span style={{
                  display: 'inline-block',
                  marginTop: 6,
                  padding: '2px 10px',
                  background: 'var(--color-success-bg)',
                  border: '1px solid #bbf7d0',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#15803d',
                }}>
                  {t("findingLib.serverBadge")} {findings.length} {t("findingLib.findingCount")}
                </span>
              ) : (
                <span style={{
                  display: 'inline-block',
                  marginTop: 6,
                  padding: '2px 10px',
                  background: 'var(--color-warning-bg)',
                  border: '1px solid #fde68a',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#b45309',
                }}>
                  {t("findingLib.fallbackBadge")} {ALL_FINDINGS.length} {t("findingLib.findingCount")}
                </span>
              )}
            </div>
          </div>

          {/* 统计卡片 */}
          <div style={{ padding: 'var(--space-3, 12px)', borderBottom: `1px solid ${COLORS.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
            <div style={{ padding: '10px 12px', background: COLORS.infoBg, borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.info }}>{filteredFindings.length}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>{tv3('findingCurrentDisplay')}</div>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--color-warning-bg)', borderRadius: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-warning-500)' }}>{favorites.size}</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>{tv3('findingMyFavorites')}</div>
            </div>
          </div>

          {/* 搜索 */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color={COLORS.textLight} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder={tv3('findingSearchPlaceholder')}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  fontSize: 12, color: COLORS.text,
                  background: COLORS.background,
                  boxSizing: 'border-box',
                }}
              />
              {searchText && (
                <button aria-label="关闭"
                  onClick={() => setSearchText('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: COLORS.textLight,
                    padding: 2,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 收藏切换 */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${showFavoritesOnly ? 'var(--color-warning-500)' : COLORS.border}`,
                background: showFavoritesOnly ? 'var(--color-warning-bg)' : 'var(--bg-card)',
                color: showFavoritesOnly ? 'var(--color-warning-500)' : COLORS.textMuted,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Star size={14} fill={showFavoritesOnly ? 'var(--color-warning-500)' : 'none'} />
              {showFavoritesOnly ? tv3('findingShowAll') : tv3('findingFavoritesOnly')}
            </button>
          </div>

          {/* 筛选：按部位 */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, marginBottom: 'var(--space-2, 8px)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
               {tv3('findingFilterByBodyPart')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {BODY_PARTS.map(bp => {
                const dataVal = BODY_PART_REVERSE[bp] || bp
                const count = bp === t('findingLib.filterAll') ? ALL_FINDINGS.length : ALL_FINDINGS.filter(f => f.bodyPart === dataVal).length
                const isActive = activeBodyPart === bp
                return (
                  <button
                    key={bp}
                    onClick={() => setActiveBodyPart(bp)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: isActive ? (BODY_PART_BG[dataVal] || COLORS.infoBg) : 'transparent',
                      color: isActive ? (BODY_PART_COLORS[dataVal] || COLORS.info) : COLORS.textMuted,
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.1s',
                    }}
                  >
                    <span>{bp}</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 筛选：按检查类型 */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, marginBottom: 'var(--space-2, 8px)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
               {tv3('findingFilterByModality')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1, 4px)' }}>
              {MODALITY_LIST.map(m => {
                const isActive = activeModality === m
                return (
                  <button
                    key={m}
                    onClick={() => setActiveModality(m)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: `1px solid ${isActive ? (MODALITY_COLORS[m] || COLORS.info) : COLORS.border}`,
                      background: isActive ? `${MODALITY_COLORS[m] || COLORS.info}15` : 'transparent',
                      color: isActive ? (MODALITY_COLORS[m] || COLORS.info) : COLORS.textMuted,
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 筛选：按疾病类型 */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, marginBottom: 'var(--space-2, 8px)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
               {tv3('findingFilterByDiseaseType')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {DISEASE_TYPES.map(dt => {
                const dataVal = DISEASE_TYPE_REVERSE[dt] || dt
                const isActive = activeDiseaseType === dt
                return (
                  <button
                    key={dt}
                    onClick={() => setActiveDiseaseType(dt)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: isActive ? (DISEASE_BG[dataVal] || COLORS.infoBg) : 'transparent',
                      color: isActive ? (DISEASE_COLORS[dataVal] || COLORS.info) : COLORS.textMuted,
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.1s',
                    }}
                  >
                    {dt}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 收藏列表 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ padding: '10px 14px 6px', fontSize: 12, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
               {tv3('findingFavoritesList')}
            </div>
            {renderFavoritesPanel()}
          </div>

          {/* 使用统计 */}
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 12, color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <TrendingUp size={10} />
              {tv3('findingMostUsed')}: {stats.topUsed[0]?.findingName || '-'}
            </div>
          </div>
        </div>
      )}

      {/* ===== 主内容区 ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 顶部工具栏 */}
        <div style={{
          padding: '14px 20px',
          background: COLORS.white,
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
            <button
              onClick={() => setShowLeftPanel(!showLeftPanel)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.white,
                color: COLORS.textMuted,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1, 4px)',
              }}
            >
              {showLeftPanel ? <ChevronDown size={14} style={{ transform: 'rotate(90deg)' }} /> : <ChevronRight size={14} />}
              {tv3('findingFilter')}
            </button>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>
              {tv3('findingResultCount', { count: filteredFindings.length })}
              {showFavoritesOnly && <span style={{ color: 'var(--color-warning-500)' }}> · {tv3('findingFavoritesOnlyLabel')}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            {/* 列数切换 */}
            <div style={{ display: 'flex', border: `1px solid ${COLORS.border}`, borderRadius: 6, overflow: 'hidden' }}>
              {[2, 3, 4].map(c => (
                <button
                  key={c}
                  onClick={() => setGridColumns(c)}
                  style={{
                    padding: '6px 10px',
                    border: 'none',
                    background: gridColumns === c ? COLORS.primaryBlue : COLORS.white,
                    color: gridColumns === c ? COLORS.white : COLORS.textMuted,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {tv3('findingColumnCount', { count: c })}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setActiveBodyPart(t('findingLib.filterAll')); setActiveModality('全部'); setActiveDiseaseType(t('findingLib.filterAll')); setSearchText(''); setShowFavoritesOnly(false) }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.white,
                color: COLORS.textMuted,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1, 4px)',
              }}
            >
              <RefreshCw size={12} />
              {tv3('findingReset')}
            </button>
          </div>
        </div>

        {/* 卡片网格 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 'var(--space-5, 20px)',
        }}>
          {filteredFindings.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 400,
              color: COLORS.textMuted,
            }}>
              <Search size={48} color={COLORS.textLight} />
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 'var(--space-4, 16px)' }}>{tv3('findingNoResults')}</div>
              <div style={{ fontSize: 12, marginTop: 'var(--space-1, 4px)' }}>{tv3('findingNoResultsHint')}</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
              gap: 'var(--space-4, 16px)',
            }}>
              {filteredFindings.map(f => renderCard(f))}
            </div>
          )}
        </div>
      </div>

      {/* 详情弹窗 */}
      {showDetailModal && renderDetailModal()}
    </div>
  )
}
