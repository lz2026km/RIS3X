// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10C - 放射术语词典
// 影像征象 150 条 + 病变描述术语 100 条 + 报告常用短语 100 条
// 供报告书写辅助 / 术语检索
// ============================================================

// ============================================================
// 1. 影像征象术语（150 条）
// ============================================================

export type SignCategory =
  | '肺' | '纵隔' | '肝脏' | '胆系' | '胰腺' | '胃肠道' | '肾脏/泌尿'
  | '颅脑' | '脊柱' | '骨关节' | '乳腺' | '心脏大血管' | '其他';

export interface RadiologySign {
  name: string;
  english: string;
  definition: string;
  commonSites: string;
  category: SignCategory;
  /** 提示的临床意义 */
  significance: string;
}

export const IMAGING_SIGNS: RadiologySign[] = [
  // ---------- 肺 ----------
  { name: '毛刺征', english: 'Spiculation', definition: '病灶边缘呈放射状细条索状突起，长短不一，为肿瘤向外浸润生长所致', commonSites: '肺、乳腺', category: '肺', significance: '高度提示恶性（肺癌、乳腺癌）' },
  { name: '分叶征', english: 'Lobulation', definition: '病灶边缘呈分叶状轮廓，为肿瘤生长速度不均所致', commonSites: '肺、肝', category: '肺', significance: '提示恶性肿瘤，亦见于良性炎性假瘤' },
  { name: '晕征', english: 'Halo Sign', definition: '结节或实变周围环以磨玻璃密度晕环', commonSites: '肺', category: '肺', significance: '提示出血、侵袭性真菌感染（毛霉、曲霉）、嗜酸性肺炎' },
  { name: '反晕征', english: 'Reversed Halo Sign', definition: '中心磨玻璃密度、周围环状实变带（环礁征）', commonSites: '肺', category: '肺', significance: '隐源性机化性肺炎（COP）、毛霉病、肺梗死' },
  { name: '轨道征', english: 'Tram Track Sign', definition: '增厚支气管壁平行双线影', commonSites: '肺', category: '肺', significance: '支气管壁增厚（慢性支气管炎、支气管扩张）' },
  { name: '指套征', english: 'Gloved Finger Sign', definition: '扩张的粘液嵌塞支气管呈指套样分支状致密影', commonSites: '肺', category: '肺', significance: '支气管粘液嵌塞（哮喘、囊性纤维化、类癌）' },
  { name: '树芽征', english: 'Tree-in-Bud Sign', definition: '终末细支气管扩张并填充呈簇状分支点状影，如发芽树枝', commonSites: '肺', category: '肺', significance: '细支气管炎（结核播散、支原体、吸入）' },
  { name: '空气支气管征', english: 'Air Bronchogram Sign', definition: '实变肺内可见透亮的含气支气管分支影', commonSites: '肺', category: '肺', significance: '肺泡实变（肺炎、肺水肿、淋巴瘤）' },
  { name: '含气新月征', english: 'Air Crescent Sign', definition: '曲霉菌球与空洞壁之间形成的新月形透亮区', commonSites: '肺', category: '肺', significance: '曲霉球、肺脓肿内气体' },
  { name: '浮球征', english: 'Ball Valve Sign', definition: '肺空洞内可移动的球状真菌球随体位变化', commonSites: '肺', category: '肺', significance: '曲霉球（曲菌瘤）' },
  { name: '肺门角征', english: 'Hilum Overlay Sign', definition: '纵隔肿块后方仍可见肺门血管影', commonSites: '纵隔', category: '肺', significance: '鉴别纵隔肿块与肺门增大' },
  { name: '兔耳征', english: 'Rabbit Ear Sign', definition: '肺不张邻近的肿瘤牵拉血管支气管形成V形影', commonSites: '肺', category: '肺', significance: '肺不张合并肿瘤（常见于支气管癌）' },
  { name: '轮廓征', english: 'Silhouette Sign', definition: '病灶与邻近结构（心缘、膈面）正常边界消失', commonSites: '肺、纵隔', category: '肺', significance: '局部定位与定性（中叶实变致心缘模糊）' },
  { name: '深沟征', english: 'Deep Sulcus Sign', definition: '气胸时肋膈角异常加深呈透亮沟状', commonSites: '肺', category: '肺', significance: '仰卧位气胸的提示征象' },
  { name: '双壁征', english: 'Double Wall Sign', definition: '气胸时肺脏壁与胸壁双重线影', commonSites: '肺', category: '肺', significance: '气胸' },
  { name: '连续膈征', english: 'Continuous Diaphragm Sign', definition: '膈肌连续性中断，其下可见气体影', commonSites: '肺', category: '肺', significance: '气胸（心包积气鉴别）' },
  { name: '蜂窝影', english: 'Honeycombing', definition: '大小一致的厚壁囊腔成簇排列，呈蜂窝状', commonSites: '肺（下叶胸膜下）', category: '肺', significance: '寻常型间质性肺炎（UIP）/肺纤维化' },
  { name: '铺路石征', english: 'Crazy Paving Sign', definition: '磨玻璃密度背景下叠加小叶间隔增厚网状影', commonSites: '肺', category: '肺', significance: '肺泡蛋白沉积症、肺孢子菌肺炎、粘液性腺癌' },
  { name: '磨玻璃密度影', english: 'Ground-Glass Opacity (GGO)', definition: '肺密度轻度增高但支气管血管束仍可见', commonSites: '肺', category: '肺', significance: '炎症、水肿、出血、早期肿瘤' },
  { name: '马赛克灌注', english: 'Mosaic Attenuation', definition: '肺密度呈补丁样高低不均，为区域性灌注差异', commonSites: '肺', category: '肺', significance: '小气道病变（空气潴留）、血管病变（慢性肺栓塞）' },
  { name: '爆米花样钙化', english: 'Popcorn Calcification', definition: '结节内粗大团块状钙化，如爆米花样', commonSites: '肺', category: '肺', significance: '肺错构瘤（良性）' },
  { name: '蛋壳样钙化', english: 'Eggshell Calcification', definition: '肺门/纵隔淋巴结周边环形钙化', commonSites: '肺门淋巴结', category: '肺', significance: '矽肺（硅肺）、结节病、放疗后' },
  { name: '膈上彗星尾征', english: 'Comet Tail Sign', definition: '圆形肺不张时弯曲血管支气管束拖尾指向肺门', commonSites: '肺（下叶后基底段）', category: '肺', significance: '圆形肺不张（石棉相关）' },
  { name: '双叶征', english: 'Two-Layered Pleura Sign', definition: '胸膜腔积液内见气体影分层的液气界面', commonSites: '胸腔', category: '肺', significance: '脓胸、血气胸、支气管胸膜瘘' },
  { name: '水上浮莲征', english: 'Water Lily Sign', definition: '包虫囊肿内层塌陷漂浮于囊液表面', commonSites: '肺、肝', category: '肺', significance: '棘球蚴病（包虫病）' },
  { name: '肺飘带征', english: 'Fleischner Sign', definition: '肺动脉中央增粗远端突然变细呈飘带样', commonSites: '肺动脉', category: '肺', significance: '肺栓塞（血管断端增粗）' },
  { name: '肠气进入肺门征', english: 'Atelectatic Segmental Lung', definition: '肺不张并支气管内占位时肺门旁肿块伴远端不张', commonSites: '肺', category: '肺', significance: '中央型肺癌（S征）' },
  { name: 'S征（倒S征）', english: 'Golden S Sign', definition: '右肺上叶不张伴肺门肿块，水平裂呈S形上抬', commonSites: '右肺上叶', category: '肺', significance: '中央型肺癌（上叶支气管阻塞）' },
  // ---------- 纵隔 ----------
  { name: '纵隔摆征', english: 'Mediastinal Shift', definition: '一侧胸腔病变（大量气胸/胸腔积液/巨大占位）推移纵隔向对侧移位', commonSites: '纵隔', category: '纵隔', significance: '压力性病变（张力性气胸为急症）' },
  { name: '前纵隔三角征', english: 'Sail Sign', definition: '前纵隔增大的胸腺影呈三角形帆状（儿童胸腺）', commonSites: '前纵隔（儿童）', category: '纵隔', significance: '正常胸腺影，勿误为肿块' },
  { name: '主动脉瓣下征', english: 'Aortic Pulmonic Window Mass', definition: '主肺动脉窗内软组织肿块推压主动脉弓下缘', commonSites: '主肺动脉窗', category: '纵隔', significance: '淋巴结肿大（肺癌转移、淋巴瘤）' },
  // ---------- 肝脏 ----------
  { name: '靶征', english: 'Target Sign', definition: '病灶中心高密度/低密度核心伴环状边缘（同心环）', commonSites: '肝、肠、脑', category: '肝脏', significance: '肝脓肿（双靶征）、转移瘤环形强化、肠套叠' },
  { name: '牛眼征', english: 'Bull\'s Eye Sign', definition: '肝转移灶中央低密度伴环形强化（靶样强化）', commonSites: '肝', category: '肝脏', significance: '转移瘤（结肠癌、胃癌常见）' },
  { name: '亮环征', english: 'Bright Rim Sign', definition: '肝脏病灶边缘见环形短T1信号（脂肪抑制后消失）', commonSites: '肝', category: '肝脏', significance: '肝脏血管瘤、T1时间缩短（铜沉积）' },
  { name: '快进快出', english: 'Wash-in / Wash-out', definition: '动脉期明显强化、门脉期/延迟期强化减退（廓清）', commonSites: '肝', category: '肝脏', significance: '肝细胞癌（HCC）典型血流动力学' },
  { name: '中心瘢痕征', english: 'Central Scar', definition: '病灶中心星芒状瘢痕，T2高信号或动脉期不强化', commonSites: '肝、乳腺', category: '肝脏', significance: '局灶性结节增生（FNH）、肝腺瘤、肝癌纤维板层型' },
  { name: '结节中结节', english: 'Nodule-in-Nodule', definition: '再生结节内出现新的小病灶（T1相对高信号/T2低信号中的高信号灶）', commonSites: '肝', category: '肝脏', significance: '肝硬化结节恶变（HCC早期）' },
  { name: '假包膜征', english: 'Pseudocapsule', definition: 'HCC周围受压肝组织形成的环形包膜样强化（延迟期明显）', commonSites: '肝', category: '肝脏', significance: '肝细胞癌（LI-RADS包膜）' },
  { name: '光环征', english: 'Peripheral Enhancement', definition: '肝脓肿周边充血带环形强化', commonSites: '肝', category: '肝脏', significance: '肝脓肿（单靶征）' },
  { name: '双靶征', english: 'Double Target Sign', definition: '肝脓肿内层坏死低密度、外层纤维环强化', commonSites: '肝', category: '肝脏', significance: '肝脓肿' },
  { name: '扇形灌注异常', english: 'Transient Hepatic Attenuation', definition: '动脉期肝段一过性强化减低/增高（斑片状）', commonSites: '肝', category: '肝脏', significance: '门静脉栓塞、肿瘤挤压门脉、炎症' },
  // ---------- 胆系 ----------
  { name: '双管征', english: 'Double Duct Sign', definition: '胆总管与胰管同时扩张（双管征），呈平行双管', commonSites: '胰头、胆道', category: '胆系', significance: '胰头癌、壶腹癌（恶性梗阻）' },
  { name: '软木塞征', english: 'Stoppage Sign', definition: '胆管扩张远端突然截断（软组织影呈软木塞状）', commonSites: '胆总管下端', category: '胆系', significance: '胆总管结石、胆管癌、胰头癌' },
  { name: '柠檬征', english: 'Lemon Sign', definition: '胎儿头颅呈柠檬形（前额扁平、枕骨扁）', commonSites: '胎儿头颅', category: '其他', significance: '开放性脊柱裂（胎儿超声/MRI）' },
  // ---------- 胰腺 ----------
  { name: '结肠截断征', english: 'Colon Cutoff Sign', definition: '横结肠于胰腺前方截断，气体终止于脾曲', commonSites: '胰腺', category: '胰腺', significance: '急性胰腺炎（炎症波及横结肠）' },
  { name: '肾筋膜增厚', english: 'Renal Fascia Thickening', definition: '肾前筋膜增厚线状影', commonSites: '腹膜后', category: '胰腺', significance: '急性胰腺炎早期征象' },
  { name: '胰腺周围条纹', english: 'Peripancreatic Stranding', definition: '胰腺周围脂肪间隙毛糙条索影', commonSites: '胰腺', category: '胰腺', significance: '急性胰腺炎、胰腺肿瘤侵犯' },
  // ---------- 胃肠道 ----------
  { name: '气液平面（阶梯状）', english: 'Air-Fluid Levels', definition: '肠梗阻时肠管内多个阶梯状气液平面', commonSites: '小肠、结肠', category: '胃肠道', significance: '肠梗阻（机械性）' },
  { name: '咖啡豆征', english: 'Coffee Bean Sign', definition: '闭袢性肠梗阻扩张肠袢呈咖啡豆形', commonSites: '乙状结肠、小肠', category: '胃肠道', significance: '肠扭转（绞窄需急症处理）' },
  { name: '假肿瘤征', english: 'Pseudotumor Sign', definition: '闭袢肠管内充满液体形成假肿块影', commonSites: '腹部', category: '胃肠道', significance: '肠扭转、闭袢性肠梗阻' },
  { name: '鸟嘴征', english: 'Bird\'s Beak Sign', definition: '扭转肠管近端逐渐变细呈鸟嘴状', commonSites: '乙状结肠、食管', category: '胃肠道', significance: '肠扭转、贲门失弛缓症（食管下段）' },
  { name: '双泡征', english: 'Double Bubble Sign', definition: '胃与十二指肠近端各见气液平面（双泡）', commonSites: '新生儿腹部', category: '胃肠道', significance: '十二指肠闭锁/狭窄' },
  { name: '阶梯样小肠气液平面', english: 'Stepladder Pattern', definition: '小肠梗阻时扩张肠管气液平面呈阶梯排列', commonSites: '小肠', category: '胃肠道', significance: '机械性小肠梗阻' },
  { name: '串珠征', english: 'String of Beads', definition: '环状皱襞增厚的小肠呈串珠样', commonSites: '小肠', category: '胃肠道', significance: '小肠皱襞增厚（淋巴瘤、Whipple病）' },
  { name: '靶环征（肠套叠）', english: 'Target Sign (Intussusception)', definition: '肠套叠横断面呈多层靶环状同心圆', commonSites: '回盲部', category: '胃肠道', significance: '肠套叠（儿童急腹症）' },
  { name: '肾形征', english: 'Reniform Sign', definition: '肠套叠纵断面呈肾形肿块', commonSites: '回盲部', category: '胃肠道', significance: '肠套叠' },
  { name: '游离气体', english: 'Free Air', definition: '膈下/肝周新月形透亮气体影', commonSites: '膈下', category: '胃肠道', significance: '消化道穿孔（急症）' },
  { name: 'Rigler征（双壁征）', english: 'Rigler Sign', definition: '肠壁内外两侧均可见气体影（肠壁双层显示）', commonSites: '腹部', category: '胃肠道', significance: '消化道穿孔（立位片或CT）' },
  { name: '气性坏疽气泡征', english: 'Pneumatosis Intestinalis', definition: '肠壁内线样/气泡样气体影', commonSites: '小肠、结肠', category: '胃肠道', significance: '肠壁积气（缺血、坏死需急症评估）' },
  { name: '门静脉积气', english: 'Portal Venous Gas', definition: '门静脉分支内树枝状气体影', commonSites: '肝脏（门脉系统）', category: '胃肠道', significance: '肠缺血坏死、化脓性胆管炎' },
  { name: '吞气征', english: 'Air Swallowing', definition: '上消化道大量气体（胃泡巨大），小肠气体减少', commonSites: '胃', category: '胃肠道', significance: '幽门梗阻、呕吐' },
  // ---------- 肾脏/泌尿 ----------
  { name: '鹿角样结石', english: 'Staghorn Calculus', definition: '肾盂肾盏铸型结石呈鹿角状', commonSites: '肾盂', category: '肾脏/泌尿', significance: '感染性结石（鸟粪石），需治疗避免肾衰竭' },
  { name: '肾盏杯口消失', english: 'Clubbing of Calyx', definition: '梗阻时肾盏杯口变钝扩张', commonSites: '肾盏', category: '肾脏/泌尿', significance: '肾盂积水（梗阻）' },
  { name: '白肾征', english: 'White Kidney Sign', definition: '急性肾静脉血栓时增强CT全肾不强化（白肾）', commonSites: '肾', category: '肾脏/泌尿', significance: '肾静脉血栓/急性肾梗死' },
  { name: '肾周脂肪条索', english: 'Perinephric Stranding', definition: '肾周脂肪间隙条索状影', commonSites: '肾周', category: '肾脏/泌尿', significance: '肾盂肾炎、脓肿、肿瘤浸润' },
  { name: '肾盂旁假瘤', english: 'Pseudomass of Renal Pelvis', definition: '肾窦脂肪过多或静脉曲张呈假性肿块', commonSites: '肾窦', category: '肾脏/泌尿', significance: '与真性肿瘤鉴别（增强无实性强化）' },
  { name: '输尿管截断征', english: 'Ureteral Cutoff', definition: '输尿管充盈缺损远端突然截断', commonSites: '输尿管', category: '肾脏/泌尿', significance: '结石、肿瘤' },
  { name: '膀胱内充盈缺损', english: 'Filling Defect in Bladder', definition: '膀胱造影见腔内充盈缺损', commonSites: '膀胱', category: '肾脏/泌尿', significance: '血块、结石、肿瘤、前列腺肥大突入' },
  // ---------- 颅脑 ----------
  { name: '大脑镰征（Fisher）', english: 'Sylvian Fissure Sign', definition: '大脑外侧裂内蛛网膜下腔高密度影', commonSites: '大脑外侧裂', category: '颅脑', significance: '蛛网膜下腔出血' },
  { name: '基底池消失', english: 'Effaced Basal Cisterns', definition: '脑肿胀致基底池变窄消失', commonSites: '基底池', category: '颅脑', significance: '弥漫性脑肿胀（颅内压增高）' },
  { name: '脑回增强', english: 'Gyriform Enhancement', definition: '脑回皮质沿脑回轮廓强化', commonSites: '脑皮质', category: '颅脑', significance: '脑梗死亚急性期、脑膜炎、肿瘤沿软脑膜播散' },
  { name: '靶征（脓肿）', english: 'Ring Enhancing Target', definition: '脑脓肿环形强化伴中心坏死（可呈双环）', commonSites: '脑', category: '颅脑', significance: '脑脓肿（与肿瘤性环强化鉴别）' },
  { name: '胡椒盐征', english: 'Salt and Pepper Sign', definition: '垂体病灶内斑点状出血/钙化与流空血管混杂', commonSites: '鞍区', category: '颅脑', significance: '垂体腺瘤（出血性）、颅咽管瘤钙化' },
  { name: '空蝶鞍征', english: 'Empty Sella Sign', definition: '蝶鞍内脑脊液信号充填，垂体受压变薄', commonSites: '鞍区', category: '颅脑', significance: '空蝶鞍综合征' },
  { name: '脑疝征（钩回疝）', english: 'Transtentorial Herniation', definition: '钩回/海马旁回向幕下移位、中脑受压变形', commonSites: '幕上', category: '颅脑', significance: '颅内占位危象（急症）' },
  { name: 'DWI亮灶', english: 'Bright DWI', definition: '弥散受限呈明显高信号伴ADC低值', commonSites: '脑', category: '颅脑', significance: '急性脑梗死、脓肿、细胞毒性水肿' },
  { name: '血管周围间隙扩张（Virchow-Robin）', english: 'Enlarged Virchow-Robin Spaces', definition: '基底节区小孔洞状脑脊液信号，无强化', commonSites: '基底节、脑白质', category: '颅脑', significance: '正常变异、老年性改变' },
  { name: '开花效应', english: 'Blooming Artifact', definition: 'SWI/T2*上出血灶放大呈黑晕', commonSites: '脑', category: '颅脑', significance: '微出血、铁沉积、钙化' },
  { name: '皮质下白质扇形征', english: 'U-fiber Pattern', definition: '皮质下U形纤维受累呈扇形分布高信号', commonSites: '脑白质', category: '颅脑', significance: '多发性硬化、进行性多灶性白质脑病' },
  { name: 'Dawson手指征', english: 'Dawson\'s Fingers', definition: '侧脑室旁白质长轴垂直的卵圆形脱髓鞘病灶', commonSites: '脑室周围白质', category: '颅脑', significance: '多发性硬化（典型表现）' },
  { name: '脑膜强化', english: 'Leptomeningeal Enhancement', definition: '脑沟内软脑膜沿脑回走行强化', commonSites: '软脑膜', category: '颅脑', significance: '脑膜炎、癌性脑膜炎（转移）' },
  { name: '静脉窦充盈缺损', english: 'Dural Sinus Filling Defect', definition: 'MRV上静脉窦内充盈缺损', commonSites: '静脉窦', category: '颅脑', significance: '静脉窦血栓（急症）' },
  // ---------- 脊柱 ----------
  { name: '椎间盘退变（黑盘）', english: 'Dark Disc', definition: '椎间盘T2信号减低（水分丢失）', commonSites: '椎间盘', category: '脊柱', significance: '椎间盘退行性变' },
  { name: 'Modic改变', english: 'Modic Changes', definition: '终板骨髓信号异常：I型（T1低T2高，炎症水肿）、II型（T1高，脂肪）、III型（T1低，硬化）', commonSites: '椎体终板', category: '脊柱', significance: '终板炎，I型疼痛相关性高' },
  { name: '椎管内充盈缺损', english: 'Intradural Filling Defect', definition: '脊髓造影/MRI示椎管内占位性充盈缺损', commonSites: '椎管', category: '脊柱', significance: '髓外硬膜内肿瘤（脊膜瘤、神经鞘瘤）' },
  { name: '硬膜尾征', english: 'Dural Tail Sign', definition: '肿瘤沿硬膜向两侧延伸呈尾状强化', commonSites: '硬膜', category: '脊柱', significance: '脑膜瘤（硬膜尾）' },
  { name: '椎体压缩骨折', english: 'Vertebral Compression Fracture', definition: '椎体高度减低楔形变', commonSites: '椎体', category: '脊柱', significance: '骨质疏松、外伤、肿瘤（需MRI鉴别恶性）' },
  { name: '蝴蝶椎', english: 'Butterfly Vertebra', definition: '椎体中央矢状裂呈蝴蝶形', commonSites: '椎体', category: '脊柱', significance: '先天性发育畸形' },
  // ---------- 骨关节 ----------
  { name: 'Codman三角', english: 'Codman Triangle', definition: '骨肿瘤突破皮质形成的三角形骨膜反应', commonSites: '长骨', category: '骨关节', significance: '恶性骨肿瘤（骨肉瘤）' },
  { name: '日光放射征', english: 'Sunburst Pattern', definition: '肿瘤性骨膜反应呈日光放射状', commonSites: '长骨', category: '骨关节', significance: '骨肉瘤（特征性）' },
  { name: '葱皮样骨膜反应', english: 'Onion Skin', definition: '多层平行骨膜新生骨呈洋葱皮样', commonSites: '长骨', category: '骨关节', significance: '尤文肉瘤、慢性骨髓炎' },
  { name: '溶冰征（骨溶解）', english: 'Moth-Eaten/Lytic Lesion', definition: '骨内虫蚀样溶骨破坏', commonSites: '骨', category: '骨关节', significance: '恶性肿瘤、骨髓炎、骨髓瘤' },
  { name: '骨内气体', english: 'Intraosseous Gas', definition: '骨内/关节内气体影（真空现象）', commonSites: '关节、椎间盘', category: '骨关节', significance: '椎间盘真空征（退变）、骨坏死感染' },
  { name: '许莫结节', english: 'Schmorl\'s Node', definition: '髓核经终板突入椎体内形成的结节状压迹', commonSites: '椎体', category: '骨关节', significance: '椎间盘退变（良性）' },
  { name: '半月板桶柄状撕裂', english: 'Bucket-Handle Tear', definition: '半月板纵行撕裂内移呈桶柄样，可出现双后交叉韧带征', commonSites: '膝关节', category: '骨关节', significance: '膝关节半月板撕裂（常伴ACL损伤）' },
  { name: '双后交叉韧带征', english: 'Double PCL Sign', definition: '矢状位PCL前方见移位的半月板碎片影（双PCL）', commonSites: '膝关节', category: '骨关节', significance: '半月板桶柄状撕裂' },
  { name: '赛艇征（髌骨脱位骨软骨）', english: 'Patellar Sleeve', definition: '髌骨下极撕脱骨折碎片', commonSites: '髌骨', category: '骨关节', significance: '髌腱撕脱（青少年）' },
  { name: 'Hill-Sachs损伤', english: 'Hill-Sachs Lesion', definition: '肱骨头后外侧压缩骨折', commonSites: '肩关节', category: '骨关节', significance: '前肩关节脱位并发症' },
  { name: 'Bankart损伤', english: 'Bankart Lesion', definition: '肩胛盂前下缘盂唇-骨性撕脱', commonSites: '肩关节', category: '骨关节', significance: '前肩关节不稳（复发性脱位）' },
  { name: '八字征', english: 'Figure of 8 / Skeleton Key', definition: '颅缝分离增宽呈锯齿状（婴儿）', commonSites: '颅骨', category: '骨关节', significance: '颅缝早闭/颅内压增高' },
  { name: '发夹征（骨髓炎死骨）', english: 'Sequestrum', definition: '骨髓炎中孤立的高密度死骨片', commonSites: '长骨', category: '骨关节', significance: '慢性骨髓炎（死骨形成）' },
  { name: '骨膜洋葱皮征', english: 'Periosteal Reaction', definition: '骨膜新生骨多层平行排列', commonSites: '骨', category: '骨关节', significance: '尤文肉瘤、骨髓炎、骨折愈合' },
  // ---------- 乳腺 ----------
  { name: '彗星尾征（乳腺）', english: 'Comet Tail (Breast)', definition: '病灶后方条索状纤维带伸展', commonSites: '乳腺', category: '乳腺', significance: '瘢痕、纤维腺病、肿瘤周围纤维化' },
  { name: '蟹足样毛刺', english: 'Spiculated Mass', definition: '肿块边缘放射状毛刺（蟹足样）', commonSites: '乳腺', category: '乳腺', significance: '浸润性导管癌（典型恶性征象）' },
  { name: '沙粒样钙化', english: 'Punctate Microcalcifications', definition: '细小点状钙化成簇/线样分布', commonSites: '乳腺', category: '乳腺', significance: '导管原位癌（DCIS）、钙化性腺病' },
  { name: '分支状钙化', english: 'Branching Calcifications', definition: '线样分支状钙化（沿导管分布）', commonSites: '乳腺', category: '乳腺', significance: '导管原位癌（恶性征象）' },
  { name: '甜甜圈征（乳腺脓肿）', english: 'Doughnut Sign', definition: '环形强化脓腔周围炎性强化带', commonSites: '乳腺', category: '乳腺', significance: '乳腺脓肿、炎性肿块' },
  { name: '皮肤增厚伴乳头凹陷', english: 'Skin Thickening & Nipple Retraction', definition: '皮肤弥漫增厚合并乳头内陷', commonSites: '乳腺', category: '乳腺', significance: '炎性乳腺癌、乳腺炎' },
  // ---------- 心脏大血管 ----------
  { name: '主动脉夹层内膜片', english: 'Intimal Flap', definition: '主动脉腔内线样分隔真假腔的内膜片', commonSites: '主动脉', category: '心脏大血管', significance: '主动脉夹层（Stanford A/B分型）' },
  { name: '双腔主动脉', english: 'Double Barrel Aorta', definition: '夹层假腔完全环绕真腔（真假双腔）', commonSites: '主动脉', category: '心脏大血管', significance: '主动脉夹层（B型慢性期）' },
  { name: '钙化移位征', english: 'Displaced Calcification', definition: '动脉瘤壁钙化向腔外移位', commonSites: '主动脉', category: '心脏大血管', significance: '主动脉夹层、动脉瘤' },
  { name: '瓶状心（心包积液）', english: 'Water Bottle Heart', definition: '心包积液致心影向两侧扩大呈烧瓶状', commonSites: '心脏', category: '心脏大血管', significance: '大量心包积液（心包填塞风险）' },
  { name: '蛋壳样心包钙化', english: 'Pericardial Calcification', definition: '心包弧形钙化影', commonSites: '心包', category: '心脏大血管', significance: '缩窄性心包炎' },
  { name: '肺门舞蹈征', english: 'Hilar Dance', definition: '肺动脉高压致肺门血管搏动增强', commonSites: '肺门', category: '心脏大血管', significance: '左向右分流（房缺、室缺）、肺动脉高压' },
  { name: '右心室扩大（靴型心）', english: 'Boot-Shaped Heart', definition: '心尖上翘呈靴形', commonSites: '心脏', category: '心脏大血管', significance: '法洛四联症（TOF）' },
  { name: '雪人征（8字心）', english: 'Snowman Sign', definition: '新生儿上纵隔宽+心影呈雪人形', commonSites: '心脏', category: '心脏大血管', significance: '完全性肺静脉异位引流（TAPVC）' },
  { name: '心包脂肪垫征', english: 'Epicardial Fat Pad', definition: '心缘外弧形脂肪密度影（心包积液鉴别）', commonSites: '心包', category: '心脏大血管', significance: '正常变异与心包积液鉴别' },
  { name: '肺静脉高压征', english: 'Pulmonary Venous Hypertension', definition: '肺血再分布（上肺静脉增宽）、间隔线（Kerley B线）', commonSites: '肺', category: '心脏大血管', significance: '左心衰、二尖瓣病变' },
  { name: 'Kerley B线', english: 'Kerley B Lines', definition: '肋膈角区短小水平间隔线（小叶间隔增厚）', commonSites: '肺（下叶）', category: '心脏大血管', significance: '肺间质水肿（左心衰）、癌性淋巴管炎' },
  { name: '肺门淋巴结肿大', english: 'Hilar Lymphadenopathy', definition: '肺门区淋巴结增大（>10mm短径）', commonSites: '肺门', category: '心脏大血管', significance: '结节病、结核、淋巴瘤、肺癌转移' },
  { name: '纵隔淋巴结钙化', english: 'Calcified Mediastinal Lymph Nodes', definition: '纵隔淋巴结内钙化', commonSites: '纵隔', category: '心脏大血管', significance: '结核（蛋壳样）、矽肺、结节病' },
  // ---------- 其他/腹膜后 ----------
  { name: '腹主动脉瘤', english: 'Abdominal Aortic Aneurysm (AAA)', definition: '腹主动脉局部扩张 >30mm（或超过邻近正常段1.5倍）', commonSites: '腹主动脉', category: '其他', significance: 'AAA破裂风险与直径相关（>50mm 手术指征）' },
  { name: '肠系膜漩涡征', english: 'Whirl Sign', definition: '肠系膜血管/脂肪呈漩涡状聚拢（旋转）', commonSites: '肠系膜', category: '胃肠道', significance: '肠扭转（急症）' },
  { name: '腹膜后血肿', english: 'Retroperitoneal Hematoma', definition: '腹膜后间隙高密度血肿（急性期CT值50-70HU）', commonSites: '腹膜后', category: '其他', significance: '外伤、主动脉破裂、抗凝出血' },
  { name: '腹腔积气', english: 'Pneumoperitoneum', definition: '腹腔内游离气体', commonSites: '腹腔', category: '胃肠道', significance: '消化道穿孔' },
  { name: '脂膜炎样改变', english: 'Fat Stranding', definition: '肠系膜/网膜脂肪密度增高条索', commonSites: '腹部', category: '其他', significance: '炎症（憩室炎、阑尾炎、胰腺炎）' },
  { name: '齿轮征（肠壁水肿）', english: 'Target/Water Wheel Sign', definition: '肠壁增厚呈分层靶环（水肿+强化）', commonSites: '肠道', category: '胃肠道', significance: '缺血性肠病、IBD、放射损伤' },
  { name: '气腹新月征', english: 'Crescent Sign (Pneumoperitoneum)', definition: '肝前缘半月形游离气体', commonSites: '腹腔', category: '胃肠道', significance: '消化道穿孔' },
  { name: '脓肿壁强化', english: 'Abscess Wall Enhancement', definition: '脓腔周围纤维壁环形强化', commonSites: '腹腔、肝、肺', category: '其他', significance: '脓肿（与肿瘤环强化鉴别）' },
  { name: '胆结石（胆囊）', english: 'Gallstones', definition: '胆囊内高密度/等密度结石影', commonSites: '胆囊', category: '胆系', significance: '胆囊结石（合并胆绞痛）' },
  { name: '门脉积气（树枝状）', english: 'Portal Venous Gas (Branching)', definition: '门静脉分支树枝状低密度气体影', commonSites: '肝', category: '其他', significance: '肠缺血坏死（急症）、脓毒性胆管炎' },
  { name: '双叶肺门', english: 'Bilateral Hilar Enlargement', definition: '双肺门对称性增大', commonSites: '肺门', category: '其他', significance: '结节病（1期）、淋巴瘤、矽肺' },
  { name: '钙化性淋巴结', english: 'Calcified Lymph Nodes', definition: '淋巴结内钙化', commonSites: '腹部、纵隔', category: '其他', significance: '结核、组织胞浆菌病、转移（粘液性肿瘤）' },
  { name: '腹水征', english: 'Ascites', definition: '腹腔游离液体（CT值<20HU水样/出血>50HU）', commonSites: '腹腔', category: '其他', significance: '肝硬化、肿瘤、心衰、炎症' },
  { name: '大网膜饼', english: 'Omental Cake', definition: '大网膜弥漫增厚呈饼状软组织影', commonSites: '大网膜', category: '其他', significance: '卵巢癌/胃肠道癌腹膜种植转移' },
  { name: '腹膜假性粘液瘤', english: 'Pseudomyxoma Peritonei', definition: '腹腔大量胶冻样液体伴分隔（典型为粘液性肿瘤破裂）', commonSites: '腹腔', category: '其他', significance: '粘液性囊腺瘤/癌破裂（阑尾/卵巢）' },
  { name: '漩涡征（肠扭转）', english: 'Whirl Sign', definition: '肠系膜血管与脂肪围绕固定点呈漩涡状排列', commonSites: '肠系膜根部', category: '胃肠道', significance: '肠扭转（闭袢性梗阻，急症）' },
  { name: '充盈缺损', english: 'Filling Defect', definition: '造影或增强管腔内对比剂未充盈区域', commonSites: '血管、胆道、输尿管', category: '其他', significance: '血栓、肿瘤、结石、息肉' },
  { name: '沙漏状狭窄', english: 'Hourglass Stricture', definition: '管腔呈沙漏样对称/不对称狭窄', commonSites: '食管、肠道、胆道', category: '胃肠道', significance: '炎性狭窄、肿瘤性狭窄鉴别' },
  { name: '憩室', english: 'Diverticulum', definition: '管壁局限性囊袋状外凸', commonSites: '结肠、十二指肠', category: '胃肠道', significance: '结肠憩室（憩室炎时急症）' },
  { name: '胆囊壁增厚伴周围积液', english: 'Pericholecystic Fluid', definition: '胆囊壁增厚合并胆囊周围液体潴留', commonSites: '胆囊', category: '胆系', significance: '急性胆囊炎（Murphy征阳性）' },
  { name: '胰周脂肪坏死', english: 'Peripancreatic Fat Necrosis', definition: '胰腺周围脂肪密度增高伴坏死液化灶', commonSites: '胰腺', category: '胰腺', significance: '急性坏死性胰腺炎（复查评估）' },
  { name: '肾盂积水（重度）', english: 'Severe Hydronephrosis', definition: '肾盂肾盏显著扩张呈花瓣样，肾实质变薄', commonSites: '肾', category: '肾脏/泌尿', significance: '慢性梗阻（结石、肿瘤、前列腺增生）' },
  { name: '输尿管串珠样扩张', english: 'Beaded Ureter', definition: '输尿管节段性扩张与狭窄交替', commonSites: '输尿管', category: '肾脏/泌尿', significance: '输尿管结核、恶性肿瘤种植' },
  { name: '骨膜抬高', english: 'Periosteal Elevation', definition: '骨膜下新生骨将骨膜抬高呈线样高密度', commonSites: '长骨', category: '骨关节', significance: '恶性骨肿瘤、骨髓炎' },
  { name: '关节腔积液', english: 'Joint Effusion', definition: '关节囊内液体积聚（MR滑液信号/CT液性密度）', commonSites: '关节', category: '骨关节', significance: '创伤、感染、炎症性关节病' },
  { name: '骨髓水肿', english: 'Bone Marrow Edema', definition: 'MR压脂序列骨髓弥漫性高信号（T2-FS/STIR）', commonSites: '骨', category: '骨关节', significance: '应力骨折、骨髓炎、骨挫伤' },
  { name: '椎体真空征', english: 'Intravertebral Vacuum', definition: '椎体内线样气体影（真空现象）', commonSites: '椎体', category: '脊柱', significance: '椎体缺血性坏死（Kümmell病）' },
  { name: '硬膜囊受压', english: 'Thecal Sac Compression', definition: '椎管内占位/椎间盘使硬膜囊变形受压', commonSites: '椎管', category: '脊柱', significance: '椎间盘突出、椎管狭窄（评估手术）' },
  { name: '椎管狭窄', english: 'Spinal Canal Stenosis', definition: '椎管径线减小致马尾/神经根受压（Schizas分级）', commonSites: '腰椎、颈椎', category: '脊柱', significance: '椎管狭窄症（间歇性跛行）' },
];

// ============================================================
// 2. 病变描述术语（100 条）
// ============================================================

export type DescriptorCategory =
  | '形态' | '边缘' | '密度/信号' | '增强模式' | '结构/分布' | '生长/变化';

export interface LesionDescriptor {
  term: string;
  english: string;
  category: DescriptorCategory;
  definition: string;
  /** 应用示例 */
  example: string;
}

export const LESION_DESCRIPTORS: LesionDescriptor[] = [
  // ---------- 形态 ----------
  { term: '圆形', english: 'Round', category: '形态', definition: '病灶各径线近似相等的球形轮廓', example: '圆形低密度灶，边界清晰' },
  { term: '卵圆形', english: 'Oval', category: '形态', definition: '长轴与短轴比≤2:1的椭圆形态', example: '卵圆形实性结节' },
  { term: '分叶状', english: 'Lobulated', category: '形态', definition: '轮廓呈多个弧形突起（分叶）', example: '分叶状肿块，最大径约35mm' },
  { term: '不规则形', english: 'Irregular', category: '形态', definition: '形态不规则，无对称轴', example: '不规则形占位累及邻近结构' },
  { term: '哑铃状', english: 'Dumbbell', category: '形态', definition: '中部狭窄两端膨大呈哑铃形', example: '哑铃状椎管内-外沟通占位（神经鞘瘤）' },
  { term: '结节状', english: 'Nodular', category: '形态', definition: '局限性隆起的小圆形病灶（≤30mm）', example: '右肺上叶结节状密度增高影' },
  { term: '肿块', english: 'Mass', category: '形态', definition: '局限性实性占位（≥30mm）', example: '肝左叶肿块伴动脉期强化' },
  { term: '团块状', english: 'Lobular Mass', category: '形态', definition: '多个结节融合成团', example: '纵隔团块状软组织影' },
  { term: '线状', english: 'Linear', category: '形态', definition: '长条状形态（长径≥4倍宽径）', example: '线状肺不张影' },
  { term: '条片状', english: 'Patchy', category: '形态', definition: '形态不规则的条片样病变', example: '右下肺条片状高密度影' },
  { term: '片状', english: 'Patchy/Flocculent', category: '形态', definition: '不规则片状分布', example: '双肺散在片状磨玻璃影' },
  { term: '扇形', english: 'Wedge-shaped', category: '形态', definition: '三角形/楔形（尖指向肺门或中心）', example: '肺内楔形影（肺梗死）' },
  { term: '锥形', english: 'Conical', category: '形态', definition: '锥状形态', example: '锥形实质低密度区' },
  { term: '星芒状', english: 'Stellate', category: '形态', definition: '中心致密伴星状伸展（瘢痕样）', example: '星芒状FNH中心瘢痕' },
  { term: '乳头状', english: 'Papillary', category: '形态', definition: '多个小突起呈乳头样', example: '乳头状强化结节（肾盂）' },
  { term: '息肉状', english: 'Polypoid', category: '形态', definition: '带蒂或宽基底腔内突起', example: '胆囊壁息肉状突起' },
  { term: '宽基底', english: 'Broad-based', category: '形态', definition: '病灶附着面宽大（与窄蒂相对）', example: '宽基底脑膜瘤' },
  { term: '带蒂', english: 'Pedunculated', category: '形态', definition: '病灶经细蒂与主体相连', example: '带蒂结肠息肉' },
  { term: '半球形', english: 'Hemispherical', category: '形态', definition: '半球状隆起（如椎间盘突出类型）', example: '椎间盘半球形膨出' },
  { term: '贝壳样', english: 'Scalloped', category: '形态', definition: '边缘多个弧形压迹呈贝壳样（如脊索瘤）', example: '骶骨贝壳样溶骨区' },
  // ---------- 边缘 ----------
  { term: '光整/清晰', english: 'Well-defined', category: '边缘', definition: '病灶边界锐利、明确', example: '边界光整的囊性灶' },
  { term: '模糊', english: 'Ill-defined', category: '边缘', definition: '病灶与周围分界不清', example: '边缘模糊的实变影' },
  { term: '毛糙', english: 'Coarse', category: '边缘', definition: '边缘不锐利、欠光滑', example: '边缘毛糙的结节' },
  { term: '毛刺状', english: 'Spiculated', category: '边缘', definition: '边缘放射状细刺突（恶性特征）', example: '边缘毛刺样肿块，高度怀疑恶性' },
  { term: '锯齿状', english: 'Serrated', category: '边缘', definition: '边缘呈锯齿样不规则', example: '锯齿状边缘的溶骨性破坏' },
  { term: '凹凸不平', english: 'Lobulated irregular', category: '边缘', definition: '边缘波浪状起伏', example: '凹凸不平的肿块轮廓' },
  { term: '分叶缘', english: 'Lobular margin', category: '边缘', definition: '边缘弧形突起形成分叶', example: '分叶缘结节' },
  { term: '地图样', english: 'Geographic', category: '边缘', definition: '边界清楚如地图轮廓', example: '地图样低密度区' },
  { term: '晕环样', english: 'Halo', category: '边缘', definition: '病变周缘环形结构（晕）', example: '磨玻璃晕环包绕实性结节' },
  { term: '环状', english: 'Rim', category: '边缘', definition: '边缘呈环形（环形强化/环形钙化）', example: '环形强化伴中央坏死' },
  { term: '扇贝缘', english: 'Scalloped margin', category: '边缘', definition: '多弧压迹状边缘', example: '扇贝缘病灶（脊索瘤/神经鞘瘤）' },
  { term: '光滑隆突', english: 'Smooth convexity', category: '边缘', definition: '向外隆突的光滑边缘', example: '光滑隆突的腔外生长占位' },
  { term: '浸润性边缘', english: 'Infiltrative margin', category: '边缘', definition: '边缘呈浸润生长、与周围融合', example: '浸润性边缘提示恶性或炎症' },
  { term: '虫蚀样边缘', english: 'Moth-eaten', category: '边缘', definition: '多发小孔样不规则破坏（恶性骨病变）', example: '虫蚀样溶骨破坏（骨髓炎/恶性）' },
  // ---------- 密度/信号 ----------
  { term: '高密度', english: 'Hyperdense', category: '密度/信号', definition: 'CT上密度高于正常组织（>40HU提示出血/钙化）', example: '脑内高密度灶（出血）' },
  { term: '等密度', english: 'Isodense', category: '密度/信号', definition: '密度与邻近正常组织相近', example: '等密度硬膜下血肿（亚急性）' },
  { term: '低密度', english: 'Hypodense', category: '密度/信号', definition: '密度低于邻近组织', example: '肝脏低密度占位' },
  { term: '囊性密度（水样）', english: 'Cystic (fluid density)', category: '密度/信号', definition: 'CT值0-20HU，均匀水样密度', example: '均匀水样密度囊性灶' },
  { term: '脂肪密度', english: 'Fat density', category: '密度/信号', definition: 'CT值-20~-120HU，脂肪样密度', example: '含脂肪密度的错构瘤' },
  { term: '钙化密度', english: 'Calcified', category: '密度/信号', definition: 'CT值>100HU，钙化样高密度', example: '团块状钙化影' },
  { term: '磨玻璃密度', english: 'Ground-glass', category: '密度/信号', definition: '密度轻度增高但不掩盖血管纹理', example: '磨玻璃密度结节' },
  { term: '混杂密度', english: 'Mixed density', category: '密度/信号', definition: '病灶内含多种密度成分', example: '混杂密度肿块（出血坏死）' },
  { term: 'T1高信号', english: 'T1 hyperintensity', category: '密度/信号', definition: 'MRI T1WI上信号高于邻近组织（脂肪/出血/蛋白）', example: 'T1高信号提示出血或脂肪' },
  { term: 'T1低信号', english: 'T1 hypointensity', category: '密度/信号', definition: 'MRI T1WI信号减低（液体、纤维）', example: 'T1低信号纤维化灶' },
  { term: 'T2高信号', english: 'T2 hyperintensity', category: '密度/信号', definition: 'T2WI信号增高（液体、水肿、囊变）', example: 'T2高信号囊性病灶' },
  { term: 'T2低信号', english: 'T2 hypointensity', category: '密度/信号', definition: 'T2WI信号减低（纤维、钙化、含铁血黄素）', example: 'T2低信号含铁血黄素沉积' },
  { term: 'FLAIR高信号', english: 'FLAIR hyperintensity', category: '密度/信号', definition: '液体衰减反转恢复序列上高信号（不能为纯水抑制）', example: 'FLAIR高信号白质病灶' },
  { term: '弥散受限', english: 'Restricted diffusion', category: '密度/信号', definition: 'DWI高信号伴ADC低信号（细胞密度增高）', example: 'DWI弥散受限（急性梗死）' },
  { term: '弥散不受限', english: 'No restricted diffusion', category: '密度/信号', definition: 'DWI/ADC信号与正常组织一致', example: '弥散不受限的囊变灶' },
  { term: '含脂信号', english: 'Fat-containing', category: '密度/信号', definition: 'MRI压脂序列信号明显减低', example: '压脂后信号减低（脂肪成分）' },
  { term: '信号均匀', english: 'Homogeneous signal', category: '密度/信号', definition: '病灶内信号/密度一致', example: '信号均匀的实性结节' },
  { term: '信号不均', english: 'Heterogeneous signal', category: '密度/信号', definition: '病灶内信号/密度混杂', example: '信号不均提示坏死、出血、囊变' },
  // ---------- 增强模式 ----------
  { term: '轻度强化', english: 'Mild enhancement', category: '增强模式', definition: '增强后CT值/信号轻度升高（<20HU）', example: '轻度强化的结节' },
  { term: '中度强化', english: 'Moderate enhancement', category: '增强模式', definition: '增强后明显升高但低于血管', example: '中度强化占位' },
  { term: '明显强化', english: 'Marked enhancement', category: '增强模式', definition: '增强后接近血管密度（>40HU）', example: '明显强化的富血供肿瘤' },
  { term: '无强化', english: 'No enhancement', category: '增强模式', definition: '增强前后密度/信号无变化', example: '囊性灶无强化' },
  { term: '动脉期强化', english: 'Arterial enhancement', category: '增强模式', definition: '动脉期出现强化（富血供肿瘤特征）', example: '动脉期明显强化伴门脉期廓清' },
  { term: '门脉期强化', english: 'Portal venous enhancement', category: '增强模式', definition: '强化峰值在门脉期（乏血供）', example: '门脉期强化占位' },
  { term: '延迟强化', english: 'Delayed enhancement', category: '增强模式', definition: '延迟期持续或进行性强化', example: '延迟强化纤维化灶/血管瘤' },
  { term: '廓清（快出）', english: 'Washout', category: '增强模式', definition: '强化峰值后信号密度减退', example: '动脉期强化+廓清（HCC）' },
  { term: '环形强化', english: 'Rim enhancement', category: '增强模式', definition: '病灶周边环形强化中央不强', example: '环形强化伴中心坏死（脓肿）' },
  { term: '结节样强化', english: 'Nodular enhancement', category: '增强模式', definition: '病灶内结节状强化', example: '外周结节样强化（血管瘤）' },
  { term: '向心性填充', english: 'Centripetal fill-in', category: '增强模式', definition: '强化从边缘向中心逐渐填充', example: '向心性填充符合血管瘤' },
  { term: '脑回样强化', english: 'Gyriform enhancement', category: '增强模式', definition: '强化沿脑回轮廓走行', example: '脑回样强化（亚急性梗死）' },
  { term: '硬膜尾征强化', english: 'Dural tail enhancement', category: '增强模式', definition: '肿瘤旁硬膜尾状强化', example: '硬膜尾征强化（脑膜瘤）' },
  { term: '周边晕环强化', english: 'Halo enhancement', category: '增强模式', definition: '病灶周围晕状强化带', example: '晕环强化（炎症充血）' },
  { term: '不均匀强化', english: 'Heterogeneous enhancement', category: '增强模式', definition: '强化分布不均匀（坏死/分隔）', example: '不均匀强化提示坏死' },
  { term: '均匀强化', english: 'Homogeneous enhancement', category: '增强模式', definition: '强化分布均匀', example: '均匀强化（典型血管瘤、平滑肌瘤）' },
  // ---------- 结构/分布 ----------
  { term: '单发', english: 'Solitary', category: '结构/分布', definition: '仅一个病灶', example: '单发肺结节' },
  { term: '多发', english: 'Multiple', category: '结构/分布', definition: '两个及以上病灶', example: '双肺多发结节（转移待排）' },
  { term: '散在', english: 'Scattered', category: '结构/分布', definition: '病灶分散分布', example: '双肺散在小结节' },
  { term: '弥漫性', english: 'Diffuse', category: '结构/分布', definition: '病变广泛累及', example: '肝实质弥漫性病变（肝硬化）' },
  { term: '局灶性', english: 'Focal', category: '结构/分布', definition: '局限性病灶', example: '局灶性低密度灶' },
  { term: '簇状分布', english: 'Clustered', category: '结构/分布', definition: '病灶成群聚集', example: '簇状钙化（乳腺）' },
  { term: '沿淋巴管分布', english: 'Lymphangitic distribution', category: '结构/分布', definition: '病灶沿淋巴管走行分布', example: '沿淋巴管分布的肺结节（癌性淋巴管炎）' },
  { term: '沿血管束分布', english: 'Peribronchovascular', category: '结构/分布', definition: '病灶沿支气管血管束分布', example: '沿血管束分布的磨玻璃影' },
  { term: '胸膜下分布', english: 'Subpleural', category: '结构/分布', definition: '病变分布于胸膜下', example: '胸膜下网状影（UIP）' },
  { term: '重力依赖分布', english: 'Gravitational distribution', category: '结构/分布', definition: '病灶分布于低垂部位（坠积）', example: '重力依赖区磨玻璃影（肺水肿）' },
  { term: '中心型', english: 'Central', category: '结构/分布', definition: '病灶位于器官中心区', example: '中心型肺癌' },
  { term: '周围型', english: 'Peripheral', category: '结构/分布', definition: '病灶位于器官周边', example: '周围型肺腺癌' },
  { term: '髓内/髓外', english: 'Intramedullary/Extramedullary', category: '结构/分布', definition: '脊髓内/外定位', example: '髓外硬膜下肿瘤' },
  { term: '腔内生长', english: 'Intraluminal', category: '结构/分布', definition: '病灶向管腔内生长', example: '腔内生长的胆管癌' },
  { term: '腔外生长', english: 'Extraluminal/Exophytic', category: '结构/分布', definition: '病灶向外突出生长', example: '腔外生长型肿块（间质瘤）' },
  { term: '跨壁生长', english: 'Transmural', category: '结构/分布', definition: '病灶贯穿管壁全层', example: '跨壁生长的直肠癌（T3）' },
  // ---------- 生长/变化 ----------
  { term: '稳定', english: 'Stable', category: '生长/变化', definition: '与既往对比病灶大小/特征无变化', example: '与前片对比病灶稳定' },
  { term: '增大', english: 'Enlarged', category: '生长/变化', definition: '病灶径线增加（通常≥2mm或≥20%）', example: '结节较前增大，建议干预' },
  { term: '缩小', english: 'Decreased', category: '生长/变化', definition: '病灶径线减小', example: '治疗后病灶缩小' },
  { term: '新发', english: 'Newly appeared', category: '生长/变化', definition: '既往未见、本次新出现', example: '新发结节，需短期随访' },
  { term: '消失', english: 'Resolved', category: '生长/变化', definition: '病灶完全消退', example: '斑片影较前吸收消失' },
  { term: '体积倍增', english: 'Doubling', category: '生长/变化', definition: '肿瘤体积翻倍的时间间隔', example: '倍增时间缩短提示恶性' },
  { term: '缓慢生长', english: 'Slow growth', category: '生长/变化', definition: '生长速度缓慢（≥400天倍增）', example: '缓慢生长的GGO（随访）' },
  { term: '快速增长', english: 'Rapid growth', category: '生长/变化', definition: '倍增时间<400天（Lung-RADS 4X）', example: '快速增长提示侵袭性' },
  { term: '钙化出现', english: 'New calcification', category: '生长/变化', definition: '随访中出现钙化（良性倾向）', example: '新发钙化（良性疾病）' },
  { term: '坏死/空洞形成', english: 'Necrosis/Cavitation', category: '生长/变化', definition: '病灶内出现坏死液化或空洞', example: '实变内空洞形成（结核）' },
  { term: '壁增厚', english: 'Wall thickening', category: '生长/变化', definition: '腔壁/囊壁增厚', example: '空洞壁增厚（恶性倾向）' },
  { term: '边缘变化', english: 'Margin change', category: '生长/变化', definition: '随访边缘从光整变毛刺', example: '边缘出现毛刺，性质可疑' },
  { term: '强化模式变化', english: 'Enhancement change', category: '生长/变化', definition: '随访中强化程度/模式改变（由弱变强提示活性）', example: '治疗后强化减弱，提示肿瘤坏死' },
  { term: '囊变趋势', english: 'Cystic degeneration', category: '生长/变化', definition: '病灶内部逐渐液化囊变', example: '肿瘤囊变（神经鞘瘤）' },
  { term: '纤维化趋势', english: 'Fibrotic evolution', category: '生长/变化', definition: '病灶逐渐纤维化（信号/密度减低、范围缩小）', example: '炎性病灶纤维化机化' },
  { term: '钙化趋势', english: 'Calcific evolution', category: '生长/变化', definition: '病灶随访中出现钙化，提示良性倾向', example: '淋巴结钙化（结核治愈后）' },
];

// ============================================================
// 3. 报告常用短语（100 条）
// ============================================================

export type PhraseSection = '所见段' | '印象段' | '技术参数' | '结构套语';

export interface ReportPhrase {
  phrase: string;
  section: PhraseSection;
  /** 用法提示 */
  usage: string;
  /** 使用频率标注 */
  frequency: '高频' | '常用' | '低频';
}

export const REPORT_PHRASES: ReportPhrase[] = [
  // ---------- 技术参数段 ----------
  { phrase: '行X线平片/CT/MR平扫及增强检查，图像质量满意，可满足诊断需要。', section: '技术参数', usage: '报告开头技术段模板', frequency: '高频' },
  { phrase: '扫描参数：层厚（间距）按标准协议执行，重建层厚1.0mm。', section: '技术参数', usage: 'CT报告参数说明', frequency: '常用' },
  { phrase: '增强扫描：经肘静脉注射碘对比剂80ml，流速3.0ml/s，行动脉期、门脉期及延迟期扫描。', section: '技术参数', usage: 'CT增强扫描参数', frequency: '常用' },
  { phrase: '对比剂注射顺利，未见明显不良反应。', section: '技术参数', usage: '增强检查后记录', frequency: '常用' },
  { phrase: '受检者体位：仰卧位（俯卧位），头先进（足先进）。', section: '技术参数', usage: 'MR/CT体位说明', frequency: '常用' },
  { phrase: '检查前签署知情同意书，无对比剂过敏史及肾功异常。', section: '技术参数', usage: '增强检查前核查记录', frequency: '常用' },
  { phrase: '与既往（YYYY年MM月）检查对比。', section: '技术参数', usage: '对比既往检查说明', frequency: '常用' },
  // ---------- 所见段 ----------
  { phrase: '胸廓对称，气管居中，纵隔未见移位。', section: '所见段', usage: '胸部阴性描述', frequency: '高频' },
  { phrase: '双肺纹理清晰，未见明显实变、结节及肿块影。', section: '所见段', usage: '胸部阴性描述', frequency: '高频' },
  { phrase: '双肺门不大，纵隔内未见明显肿大淋巴结。', section: '所见段', usage: '肺门纵隔阴性', frequency: '高频' },
  { phrase: '心脏大小形态未见明显异常，主动脉壁未见明显钙化。', section: '所见段', usage: '心脏阴性描述', frequency: '高频' },
  { phrase: '双侧胸膜未见增厚，胸腔未见积液。', section: '所见段', usage: '胸膜阴性', frequency: '高频' },
  { phrase: '肝脏大小形态正常，肝实质内未见明显异常密度（信号）灶。', section: '所见段', usage: '腹部阴性描述', frequency: '高频' },
  { phrase: '胆囊大小正常，壁无增厚，腔内未见结石影。', section: '所见段', usage: '胆囊阴性', frequency: '高频' },
  { phrase: '胰腺形态及密度未见异常，胰管未见扩张。', section: '所见段', usage: '胰腺阴性', frequency: '高频' },
  { phrase: '脾脏大小正常，实质信号（密度）均匀。', section: '所见段', usage: '脾脏阴性', frequency: '高频' },
  { phrase: '双肾大小形态正常，肾实质未见异常强化，肾盂肾盏未见扩张积水。', section: '所见段', usage: '肾脏阴性', frequency: '高频' },
  { phrase: '腹膜后及腹主动脉旁未见明显肿大淋巴结。', section: '所见段', usage: '腹膜后阴性', frequency: '高频' },
  { phrase: '腹腔及盆腔未见积液（游离气体）。', section: '所见段', usage: '腹盆腔阴性', frequency: '高频' },
  { phrase: '膀胱充盈良好，壁光滑，腔内未见充盈缺损。', section: '所见段', usage: '膀胱阴性', frequency: '常用' },
  { phrase: '前列腺大小正常，T2信号均匀，未见异常信号灶。', section: '所见段', usage: '前列腺阴性', frequency: '常用' },
  { phrase: '子宫及双侧附件区未见明显异常。', section: '所见段', usage: '盆腔阴性', frequency: '常用' },
  { phrase: '颅骨结构完整，脑实质内未见明显异常密度（信号）灶。', section: '所见段', usage: '头颅阴性', frequency: '高频' },
  { phrase: '脑室系统大小形态正常，中线结构居中，脑沟脑裂未见明显增宽。', section: '所见段', usage: '头颅阴性', frequency: '高频' },
  { phrase: '基底节区未见异常，DWI未见明显弥散受限灶。', section: '所见段', usage: '卒中排除描述', frequency: '高频' },
  { phrase: '脑内未见出血、梗死及占位性病变。', section: '所见段', usage: '头颅阴性总结', frequency: '高频' },
  { phrase: '颈椎生理曲度存在，椎体骨质结构完整，未见骨质破坏及压缩性骨折。', section: '所见段', usage: '颈椎阴性', frequency: '常用' },
  { phrase: '腰椎生理曲度存在，椎间隙无明显狭窄，椎管无狭窄，马尾信号正常。', section: '所见段', usage: '腰椎阴性', frequency: '常用' },
  { phrase: '肩关节诸组成骨骨质结构完整，关节间隙未见狭窄，肩袖未见明显撕裂。', section: '所见段', usage: '肩关节阴性', frequency: '常用' },
  { phrase: '右肺上叶见一实性结节影，大小约5mm×4mm，边界清晰，无毛刺。', section: '所见段', usage: '小结节描述', frequency: '高频' },
  { phrase: '左肺下叶见磨玻璃密度结节，最大径约8mm，内部未见实性成分。', section: '所见段', usage: 'GGO描述', frequency: '高频' },
  { phrase: '右肺中叶见斑片状实变影，内见空气支气管征，边缘模糊。', section: '所见段', usage: '肺炎描述', frequency: '高频' },
  { phrase: '双肺弥漫性磨玻璃样密度增高影，以双下肺为著。', section: '所见段', usage: '弥漫性GGO', frequency: '常用' },
  { phrase: '双侧胸腔见少量积液，右侧为著。', section: '所见段', usage: '胸腔积液', frequency: '高频' },
  { phrase: '右肺压缩约30%，见气胸线，肺组织向肺门方向压缩。', section: '所见段', usage: '气胸描述', frequency: '高频' },
  { phrase: '左肺上叶舌段见支气管扩张影，呈柱状，伴管壁增厚。', section: '所见段', usage: '支扩描述', frequency: '常用' },
  { phrase: '纵隔内见多发肿大淋巴结，较大者位于气管隆突下，短径约15mm。', section: '所见段', usage: '纵隔淋巴结', frequency: '常用' },
  { phrase: '肝右叶见类圆形低密度灶，边界清晰，增强后无强化，考虑囊肿。', section: '所见段', usage: '肝囊肿描述', frequency: '高频' },
  { phrase: '肝右叶见动脉期明显强化的富血供结节，门脉期及延迟期强化减退（快进快出），符合肝细胞癌影像表现。', section: '所见段', usage: 'HCC典型描述', frequency: '高频' },
  { phrase: '肝左叶见血管瘤样病灶：动脉期外周结节样强化，延迟期向心性填充，符合肝血管瘤。', section: '所见段', usage: '血管瘤描述', frequency: '高频' },
  { phrase: '胆囊壁增厚约5mm，周围见液性暗区，提示急性胆囊炎可能。', section: '所见段', usage: '胆囊炎描述', frequency: '常用' },
  { phrase: '胰头区见软组织肿块，伴胆总管及胰管扩张（双管征），考虑胰头癌。', section: '所见段', usage: '胰头癌描述', frequency: '常用' },
  { phrase: '双肾见多发类圆形水样密度灶，边界清晰，无强化，考虑囊肿。', section: '所见段', usage: '肾囊肿描述', frequency: '高频' },
  { phrase: '右肾盂内见鹿角样高密度结石影，伴右肾积水。', section: '所见段', usage: '鹿角结石描述', frequency: '常用' },
  { phrase: '膀胱充盈欠佳，腔内未见明显异常。', section: '所见段', usage: '膀胱充盈不良说明', frequency: '常用' },
  { phrase: '右额叶见类圆形占位，T1等信号、T2稍高信号，增强后明显均匀强化，邻近脑膜强化（硬膜尾征），考虑脑膜瘤。', section: '所见段', usage: '脑膜瘤描述', frequency: '常用' },
  { phrase: '左侧基底节区见新发梗死灶，DWI明显高信号，ADC低信号，大小约20mm×15mm。', section: '所见段', usage: '急性脑梗死描述', frequency: '高频' },
  { phrase: '右侧丘脑区见斑片状高密度影，CT值约65HU，考虑出血。', section: '所见段', usage: '脑出血描述', frequency: '高频' },
  { phrase: '大脑纵裂池、双侧外侧裂池见高密度影，符合蛛网膜下腔出血。', section: '所见段', usage: 'SAH描述', frequency: '常用' },
  { phrase: '双侧半卵圆中心及侧脑室旁见多发斑片状T2/FLAIR高信号灶，符合缺血性白质改变。', section: '所见段', usage: '白质高信号描述', frequency: '高频' },
  { phrase: 'L4/5椎间盘向后突出，硬膜囊前缘受压，双侧神经根未见明显受压。', section: '所见段', usage: '椎间盘突出描述', frequency: '高频' },
  { phrase: 'L5椎体压缩性骨折，椎体高度减低约40%，局部后突，椎管未见明显狭窄。', section: '所见段', usage: '椎体压缩骨折', frequency: '常用' },
  { phrase: '左膝关节内侧半月板后角见线样高信号达关节面，提示撕裂。', section: '所见段', usage: '半月板撕裂描述', frequency: '常用' },
  { phrase: '前交叉韧带形态欠规则，信号增高，连续性尚可，考虑部分撕裂。', section: '所见段', usage: 'ACL撕裂描述', frequency: '常用' },
  { phrase: '右乳腺内上象限见分叶状肿块，边缘毛刺，大小约25mm×18mm，BI-RADS 4C类。', section: '所见段', usage: '乳腺恶性描述', frequency: '常用' },
  { phrase: '左乳腺外上象限见簇状多形性微钙化，范围约10mm，BI-RADS 4B类。', section: '所见段', usage: '乳腺钙化描述', frequency: '常用' },
  { phrase: '甲状腺右叶见低回声结节，大小约12mm×10mm，边缘不整，内见点状强回声，TI-RADS TR4。', section: '所见段', usage: '甲状腺结节描述', frequency: '常用' },
  { phrase: '右股骨中段见溶骨性破坏，骨皮质不连续，周围软组织肿块形成，骨膜反应呈日光放射状。', section: '所见段', usage: '骨肉瘤描述', frequency: '低频' },
  { phrase: '双肺多发小结节影，大小不等，较大者位于右下肺，考虑转移瘤可能。', section: '所见段', usage: '转移瘤描述', frequency: '常用' },
  { phrase: '左肺下叶外基底段见空洞性病变，内壁光滑，洞内见球状物（真菌球），符合曲霉球。', section: '所见段', usage: '曲霉球描述', frequency: '低频' },
  { phrase: '腹部可见气液平面阶梯状排列，考虑小肠梗阻。', section: '所见段', usage: '肠梗阻描述', frequency: '常用' },
  { phrase: '膈下见新月形游离气体影，提示消化道穿孔。', section: '所见段', usage: '游离气体描述', frequency: '高频' },
  { phrase: '肠系膜血管呈漩涡状排列，考虑肠扭转可能。', section: '所见段', usage: '肠扭转描述', frequency: '常用' },
  { phrase: '升主动脉内径约38mm，未见夹层及动脉瘤征象。', section: '所见段', usage: '主动脉描述', frequency: '常用' },
  { phrase: '冠状动脉走行区见钙化影，前降支近段钙化积分明显。', section: '所见段', usage: '冠脉钙化描述', frequency: '常用' },
  { phrase: '心包积液，最厚处约12mm，未见心包钙化。', section: '所见段', usage: '心包积液描述', frequency: '常用' },
  // ---------- 印象段 ----------
  { phrase: '胸部CT未见明显异常。', section: '印象段', usage: '胸部阴性印象', frequency: '高频' },
  { phrase: '双肺多发小结节，性质待定，建议随访复查。', section: '印象段', usage: '小结节印象', frequency: '高频' },
  { phrase: '右肺上叶实性结节，Lung-RADS 3类，建议6个月后复查。', section: '印象段', usage: 'Lung-RADS分级印象', frequency: '高频' },
  { phrase: '考虑细菌性肺炎，建议抗感染治疗后复查。', section: '印象段', usage: '肺炎印象', frequency: '高频' },
  { phrase: '右侧气胸（压缩约30%），请临床结合处理。', section: '印象段', usage: '气胸印象', frequency: '高频' },
  { phrase: '双侧胸腔积液，性质待查，建议结合临床及实验室检查。', section: '印象段', usage: '胸腔积液印象', frequency: '常用' },
  { phrase: '考虑肝血管瘤，建议定期随访。', section: '印象段', usage: '血管瘤印象', frequency: '高频' },
  { phrase: '肝右叶占位，影像表现符合肝细胞癌（LI-RADS 5），建议临床多学科诊治。', section: '印象段', usage: 'HCC印象', frequency: '高频' },
  { phrase: '考虑肝囊肿，良性病变，无需特殊处理。', section: '印象段', usage: '囊肿印象', frequency: '高频' },
  { phrase: '考虑急性胆囊炎，请结合临床。', section: '印象段', usage: '胆囊炎印象', frequency: '常用' },
  { phrase: '考虑胰头癌可能（伴双管征），建议临床进一步检查。', section: '印象段', usage: '胰头癌印象', frequency: '常用' },
  { phrase: '双肾囊肿（Bosniak I类），良性，建议随访。', section: '所见段', usage: '肾囊肿印象', frequency: '常用' },
  { phrase: '右肾鹿角样结石伴肾积水，建议泌尿外科处理。', section: '印象段', usage: '鹿角结石印象', frequency: '常用' },
  { phrase: '急性左侧基底节区脑梗死，建议急诊神经科处理。', section: '印象段', usage: '急性梗死印象', frequency: '高频' },
  { phrase: '右侧丘脑出血，建议密切监测生命体征及复查CT。', section: '印象段', usage: '脑出血印象', frequency: '高频' },
  { phrase: '蛛网膜下腔出血，建议行CTA排除动脉瘤。', section: '印象段', usage: 'SAH印象', frequency: '常用' },
  { phrase: '考虑脑膜瘤可能，建议神经外科会诊。', section: '印象段', usage: '脑膜瘤印象', frequency: '常用' },
  { phrase: '脑内缺血性白质改变（Fazekas 2级），建议控制血管危险因素。', section: '印象段', usage: '白质改变印象', frequency: '常用' },
  { phrase: 'L4/5椎间盘突出，建议保守治疗随访；如症状加重复查MRI。', section: '印象段', usage: '椎间盘突出印象', frequency: '高频' },
  { phrase: 'L5椎体压缩性骨折（骨质疏松性可能大），建议骨密度检查及专科治疗。', section: '印象段', usage: '压缩骨折印象', frequency: '常用' },
  { phrase: '左膝内侧半月板撕裂，建议关节外科评估。', section: '印象段', usage: '半月板撕裂印象', frequency: '常用' },
  { phrase: '右乳腺肿块，BI-RADS 4C类，建议穿刺活检。', section: '印象段', usage: '乳腺印象', frequency: '常用' },
  { phrase: '甲状腺右叶结节，TI-RADS TR4类，建议FNA（大小达指征）。', section: '印象段', usage: '甲状腺印象', frequency: '常用' },
  { phrase: '考虑骨肉瘤可能，建议活检明确病理。', section: '印象段', usage: '骨肉瘤印象', frequency: '低频' },
  { phrase: '双肺多发结节，结合病史考虑转移瘤，建议进一步检查原发灶。', section: '印象段', usage: '转移瘤印象', frequency: '常用' },
  { phrase: '小肠机械性梗阻，建议胃肠外科评估。', section: '印象段', usage: '肠梗阻印象', frequency: '常用' },
  { phrase: '消化道穿孔可能，建议急诊外科处理。', section: '印象段', usage: '穿孔印象', frequency: '高频' },
  { phrase: '肠扭转征象，急症，建议立即外科会诊。', section: '印象段', usage: '肠扭转印象', frequency: '常用' },
  { phrase: '升主动脉增宽，建议心血管内科随访评估。', section: '印象段', usage: '主动脉印象', frequency: '常用' },
  { phrase: '冠状动脉钙化，提示动脉粥样硬化，建议结合临床评估。', section: '印象段', usage: '冠脉钙化印象', frequency: '常用' },
  { phrase: '心包积液（中等量），建议心内科评估病因。', section: '印象段', usage: '心包积液印象', frequency: '常用' },
  { phrase: '所见为正常变异，未见异常。', section: '印象段', usage: '正常变异说明', frequency: '常用' },
  { phrase: '上述表现无特异性，建议结合临床及实验室检查。', section: '印象段', usage: '无特异性结尾', frequency: '高频' },
  { phrase: '建议短期（3-6个月）随访复查。', section: '印象段', usage: '随访建议结尾', frequency: '高频' },
  { phrase: '建议进一步增强检查（CT/MR增强）明确诊断。', section: '印象段', usage: '进一步检查建议', frequency: '高频' },
  { phrase: '建议PET-CT评估全身情况。', section: '印象段', usage: 'PET-CT建议', frequency: '常用' },
  { phrase: '建议穿刺活检明确病理性质。', section: '印象段', usage: '活检建议', frequency: '常用' },
  { phrase: '请结合临床随访观察。', section: '印象段', usage: '常规结尾', frequency: '高频' },
  { phrase: '随诊复查，必要时进一步影像学检查。', section: '印象段', usage: '常规结尾', frequency: '常用' },
  { phrase: '未发现明确危急征象。', section: '印象段', usage: '危急值排除说明', frequency: '常用' },
  { phrase: '已电话告知临床医师（危急值）。', section: '印象段', usage: '危急值记录', frequency: '常用' },
];

// ============================================================
// 导出与工具函数
// ============================================================

export const RADIOLOGY_TERMINOLOGY = {
  signs: IMAGING_SIGNS,
  descriptors: LESION_DESCRIPTORS,
  phrases: REPORT_PHRASES,
};

/** 按类别/部位检索征象 */
export function searchSigns(query: string, category?: SignCategory): RadiologySign[] {
  const q = query.trim().toLowerCase();
  return IMAGING_SIGNS.filter((s) => {
    const hit =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.english.toLowerCase().includes(q) ||
      s.definition.toLowerCase().includes(q) ||
      s.commonSites.toLowerCase().includes(q);
    return hit && (category ? s.category === category : true);
  });
}

/** 按描述类别检索病变描述术语 */
export function searchDescriptors(query: string, category?: DescriptorCategory): LesionDescriptor[] {
  const q = query.trim().toLowerCase();
  return LESION_DESCRIPTORS.filter((d) => {
    const hit =
      !q ||
      d.term.toLowerCase().includes(q) ||
      d.english.toLowerCase().includes(q) ||
      d.definition.toLowerCase().includes(q);
    return hit && (category ? d.category === category : true);
  });
}

/** 按段落获取报告短语 */
export function getPhrasesBySection(section: PhraseSection): ReportPhrase[] {
  return REPORT_PHRASES.filter((p) => p.section === section);
}
