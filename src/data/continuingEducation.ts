// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10E-2 - 继续教育题库
// 60 道放射技师/医师培训题：影像技术 / 辐射防护 / 解剖 / 病理 / 报告规范
// 题型：单选 / 判断（每题 4 选项，答案以 A/B/C/D 表示，附解析）
// ============================================================

export type EducationCategory = '影像技术' | '辐射防护' | '解剖' | '病理' | '报告规范';
export type EducationQuestionType = '单选' | '判断';

export interface EducationQuestion {
  /** 题目分类 */
  category: EducationCategory;
  /** 题型（单选/判断） */
  type: EducationQuestionType;
  /** 题干 */
  question: string;
  /** 4 个选项 */
  options: [string, string, string, string];
  /** 正确答案（A/B/C/D） */
  answer: string;
  /** 解析 */
  explanation: string;
}

export const EDUCATION_QUESTIONS: EducationQuestion[] = [
  // ============================================================
  // 一、影像技术（14 道）
  // ============================================================
  {
    category: '影像技术',
    type: '单选',
    question: 'CT 扫描中，提高空间分辨率最直接的措施是？',
    options: ['增加层厚', '减小层厚/采用薄层重建', '降低 kV', '增加螺距'],
    answer: 'B',
    explanation: '薄层采集及薄层重建可减小部分容积效应、提高空间分辨率，但噪声会相应增加，需权衡剂量。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: 'X 线穿透力主要取决于下列哪一参数？',
    options: ['管电流 mA', '曝光时间 s', '管电压 kVp', '焦片距'],
    answer: 'C',
    explanation: '管电压决定 X 线最大能量与穿透力；管电流与时间决定辐射量（mAs），不改变穿透力。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: 'MRI 中 T1 加权像（T1WI）的主要特点是？',
    options: ['脂肪呈低信号', '水呈高信号', '脂肪呈高信号、水呈低信号', '所有组织信号相同'],
    answer: 'C',
    explanation: 'T1WI 中脂肪因 T1 短而呈高信号，水因 T1 长呈低信号，与 T2WI 相反。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: '乳腺 X 线摄影常规投照体位包括？',
    options: ['正位+侧位', '头尾位（CC）+内外斜位（MLO）', '轴位+矢状位', '仅内外斜位'],
    answer: 'B',
    explanation: '乳腺摄影常规行 CC 位与 MLO 位双体位投照，两体位互补以提高病灶检出率。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: '超声检查中提高图像分辨率并保持穿透力的常用方法是？',
    options: ['始终使用最高频探头', '选用合适频率：浅表高频、深部低频', '增大增益', '增大功率'],
    answer: 'B',
    explanation: '频率越高分辨率越高但穿透力越差，应根据目标深度选择探头频率，兼顾两者。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: 'DSA（数字减影血管造影）减影的基础是？',
    options: ['同一部位两次曝光相减', '不同体位图像叠加', '增强前后图像平均', '旋转采集'],
    answer: 'A',
    explanation: 'DSA 将造影前后的同一部位图像相减，去除骨骼软组织影，仅保留含造影剂的血管。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: 'CT 值单位为 HU，水的 CT 值规定为？',
    options: ['-1000', '0', '+1000', '+2000'],
    answer: 'B',
    explanation: '水的 CT 值为 0HU，空气为 -1000HU，骨约为 +1000HU，为 CT 定量标准。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: '增强 CT 扫描"动脉期"的主要观察目的是？',
    options: ['评估脂肪浸润', '观察富血供病变强化（如 HCC、动脉瘤）', '显示胆道', '评估骨质'],
    answer: 'B',
    explanation: '动脉期造影剂位于动脉系统内，富血供病灶（HCC、血管瘤、动脉瘤）在此时明显强化。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: 'MRCP 检查主要利用何种序列原理？',
    options: ['重度 T2 加权水成像', 'T1 加权脂肪抑制', 'DWI', 'SWI'],
    answer: 'A',
    explanation: 'MRCP 为静态水成像，利用重 T2 序列使含水静止液体（胆汁、胰液）呈高信号，不注射对比剂。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: 'DWI（弥散加权成像）中急性脑梗死灶通常表现为？',
    options: ['DWI 低信号、ADC 高信号', 'DWI 高信号、ADC 低信号', '两者均低信号', '两者均高信号'],
    answer: 'B',
    explanation: '梗死区细胞毒性水肿致弥散受限，DWI 高信号、ADC 低信号为急性梗死的核心征象。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: '胸部 CT 扫描常规要求患者？',
    options: ['呼气末屏气', '吸气末屏气', '自由呼吸', '连续咳嗽后屏气'],
    answer: 'B',
    explanation: '吸气末肺充气充分、膈肌下降，可避免呼吸运动伪影并良好显示肺野。',
  },
  {
    category: '影像技术',
    type: '单选',
    question: '铅当量防护的意义：常规 X 线机房墙体防护铅当量要求一般为？',
    options: ['0.5mmPb', '1mmPb', '2mmPb', '5mmPb'],
    answer: 'C',
    explanation: '按 GBZ 130 标准，X 线机房墙体通常要求 2mmPb 铅当量防护，具体视管电压而定。',
  },
  {
    category: '影像技术',
    type: '判断',
    question: 'CT 螺旋扫描中螺距增大，图像质量（空间分辨率）随之升高。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'B',
    explanation: '螺距增大导致同一层面数据减少，纵向分辨率下降、噪声增加，图像质量降低。',
  },
  {
    category: '影像技术',
    type: '判断',
    question: 'DR 与 CR 相比，成像速度更快、空间分辨率更高。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'A',
    explanation: 'DR 采用平板探测器直接数字化成像，无需 IP 板读取，成像速度与分辨力均优于 CR。',
  },
  // ============================================================
  // 二、辐射防护（12 道）
  // ============================================================
  {
    category: '辐射防护',
    type: '单选',
    question: '辐射防护三原则不包括下列哪项？',
    options: ['实践的正当性', '防护的最优化', '剂量限值', '辐射剂量最大化'],
    answer: 'D',
    explanation: 'ICRP 辐射防护三原则为：正当性、最优化（ALARA）、剂量限值，绝无"剂量最大化"。',
  },
  {
    category: '辐射防护',
    type: '单选',
    question: '我国公众年有效剂量限值为？',
    options: ['1mSv', '5mSv', '10mSv', '20mSv'],
    answer: 'A',
    explanation: 'GB 18871 规定公众年有效剂量限值 1mSv；职业人员连续 5 年平均 20mSv/年。',
  },
  {
    category: '辐射防护',
    type: '单选',
    question: 'X 线防护的三要素为？',
    options: ['时间、距离、屏蔽', '电压、电流、时间', '铅衣、铅帽、铅围脖', '照射野、距离、体位'],
    answer: 'A',
    explanation: '防护三要素：缩短照射时间、增大与源的距离、采用屏蔽（防护材料），即时间-距离-屏蔽。',
  },
  {
    category: '辐射防护',
    type: '单选',
    question: '对孕妇行 X 线检查的正确做法是？',
    options: ['一律拒绝检查', '严格正当性判断，优先替代检查，腹部屏蔽', '正常检查即可', '仅用高 kV 检查'],
    answer: 'B',
    explanation: '孕妇检查应严格把握适应证，优先考虑超声/MR 替代，必须行 X 线时对腹部进行屏蔽。',
  },
  {
    category: '辐射防护',
    type: '单选',
    question: 'DR 胸部摄影时，患者与技师之间的有效防护距离通常为？',
    options: ['0.5m', '1m', '2m 以上', '无需距离'],
    answer: 'C',
    explanation: '距离防护遵循平方反比定律，操作人员应位于屏蔽区且距 X 线管 2m 以外（或屏蔽后）。',
  },
  {
    category: '辐射防护',
    type: '单选',
    question: '介入手术中操作者个人剂量监测应佩戴的位置是？',
    options: ['铅衣外胸前（胸外）与铅衣内腰部（体内）双剂量计', '仅铅衣内', '仅铅衣外', '手腕'],
    answer: 'A',
    explanation: '介入人员应双剂量计监测：铅衣外估算眼晶状体/头面部剂量，铅衣内估算有效剂量。',
  },
  {
    category: '辐射防护',
    type: '单选',
    question: '确定性效应（组织反应）的特点不包括？',
    options: ['存在剂量阈值', '剂量越大效应越重', '无剂量阈值', '如皮肤红斑、白内障'],
    answer: 'C',
    explanation: '确定性效应有阈值，超过阈值后严重度随剂量增加；随机效应（癌变）才无阈值。',
  },
  {
    category: '辐射防护',
    type: '单选',
    question: '儿童 CT 检查相对成人的剂量调整原则是？',
    options: ['与成人相同', '按体重/年龄降低 mAs 与 kV', '增加 mAs 保证质量', '延长曝光时间'],
    answer: 'B',
    explanation: '儿童体型小、组织敏感性高，应按体重/年龄优化参数（降低 mAs、合理 kV），遵循 ALARA。',
  },
  {
    category: '辐射防护',
    type: '单选',
    question: '放射工作人员职业健康检查（上岗前/在岗期间）频次要求为？',
    options: ['上岗前必查，在岗每 1-2 年一次', '仅在离职时检查', '每 5 年一次', '无需检查'],
    answer: 'A',
    explanation: '按法规要求，上岗前必须体检，在岗期间职业健康检查每 1-2 年一次（特殊工种更频）。',
  },
  {
    category: '辐射防护',
    type: '单选',
    question: 'CT 检查中降低患者剂量最有效且不影响诊断的方法组合是？',
    options: ['降低 kV 而不调 mAs', '自动管电流调制+合理 kV 选择+迭代重建', '仅降低螺距', '增加层厚'],
    answer: 'B',
    explanation: '自动 mAs 调制、kV 优化与迭代重建（IR）结合可在保持图像质量前提下显著降低剂量。',
  },
  {
    category: '辐射防护',
    type: '判断',
    question: '外照射防护中，屏蔽 X 射线使用铅、硫酸钡等原子序数高的材料效果更好。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'A',
    explanation: '光电效应概率与原子序数 Z 的 3-4 次方成正比，高 Z 材料（铅等）屏蔽低能 X 线效率高。',
  },
  {
    category: '辐射防护',
    type: '判断',
    question: '个人剂量计读数超过年剂量限值时，说明发生了放射事故。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'B',
    explanation: '剂量计超标需调查原因（佩戴不当、实际照射等），但不一定构成放射事故，需按调查结果定性。',
  },
  // ============================================================
  // 三、解剖（10 道）
  // ============================================================
  {
    category: '解剖',
    type: '单选',
    question: '肺门区最主要的解剖结构组合是？',
    options: ['肺动脉、肺静脉、主支气管', '食管与主动脉', '肋间血管', '膈神经'],
    answer: 'A',
    explanation: '肺门由肺动脉、肺静脉、主支气管及淋巴组织构成，左右形态略有差异。',
  },
  {
    category: '解剖',
    type: '单选',
    question: '心脏 CT 解剖中，右冠状动脉起源于？',
    options: ['左主动脉窦', '右主动脉窦（冠状窦）', '无冠状动脉窦', '肺动脉'],
    answer: 'B',
    explanation: '右冠状动脉起源于右主动脉窦，左冠状动脉起源于左主动脉窦，对应左右冠状窦。',
  },
  {
    category: '解剖',
    type: '单选',
    question: '肝叶分界：左叶与右叶在肝表面的主要分界标志是？',
    options: ['镰状韧带', '圆韧带', '胆囊窝与下腔静脉连线（Cantlie 线）', '肝门静脉'],
    answer: 'C',
    explanation: 'Cantlie 线（胆囊窝-下腔静脉连线）为左右半肝的表面分界，肝中静脉为其深部分界。',
  },
  {
    category: '解剖',
    type: '单选',
    question: '成人肾门内从前到后的排列顺序为？',
    options: ['肾动脉-肾静脉-肾盂', '肾静脉-肾动脉-肾盂', '肾盂-肾静脉-肾动脉', '肾动脉-肾盂-肾静脉'],
    answer: 'B',
    explanation: '肾门结构排列为"前静脉、中动脉、后肾盂"，即肾静脉在前、肾动脉居中、肾盂在后。',
  },
  {
    category: '解剖',
    type: '单选',
    question: '脑 MRI 轴位中，位于鞍上池两侧的结构是？',
    options: ['侧脑室', '颞叶钩回', '小脑扁桃体', '基底动脉'],
    answer: 'B',
    explanation: '鞍上池呈五角星形，周围毗邻颞叶钩回、额叶直回及桥脑，中脑走行于其后方。',
  },
  {
    category: '解剖',
    type: '单选',
    question: '脊柱 MRI 中，硬膜囊内的主要结构是？',
    options: ['脊髓与马尾神经', '椎间盘', '黄韧带', '椎动脉'],
    answer: 'A',
    explanation: '硬膜囊包绕脊髓（颈胸段）及马尾神经（腰段），内含脑脊液，位于硬膜外结构之内。',
  },
  {
    category: '解剖',
    type: '单选',
    question: '膝关节 MR 中，前交叉韧带（ACL）的主要作用及典型信号是？',
    options: ['防止胫骨前移，PD/T2 呈连续低信号带', '防止胫骨后移', '维持髌骨稳定', '增加关节摩擦'],
    answer: 'A',
    explanation: 'ACL 阻止胫骨前移，正常韧带在 PD/T2 像上呈连续低信号条带，撕裂时可见中断与高信号。',
  },
  {
    category: '解剖',
    type: '单选',
    question: '腹部 CT 中，胰腺位于？',
    options: ['腹膜腔前', '腹膜后（肾前间隙）', '盆腔', '胸腔'],
    answer: 'B',
    explanation: '胰腺为腹膜后器官，位于肾前间隙，前方为腹膜腔，周围毗邻十二指肠、胆管及血管。',
  },
  {
    category: '解剖',
    type: '判断',
    question: '正常成人甲状腺位于颈前部，紧贴气管前方及两侧，由峡部连接左右两叶。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'A',
    explanation: '甲状腺由左右叶与峡部组成，位于颈前区，紧邻气管前方，超声可清晰显示其结构。',
  },
  {
    category: '解剖',
    type: '判断',
    question: '肺段支气管分支中，右肺上叶支气管分出尖、后、前三个肺段支气管。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'A',
    explanation: '右肺上叶支气管分出尖段（B1）、后段（B2）、前段（B3）三支，与左肺上叶（多舌叶）不同。',
  },
  // ============================================================
  // 四、病理（13 道）
  // ============================================================
  {
    category: '病理',
    type: '单选',
    question: 'CT 上"磨玻璃结节"的病理基础最常见为？',
    options: ['肺泡腔内空气增多', '肺泡壁增厚/部分充填（炎症、异型增生、腺癌早期）', '肺组织坏死', '肺纤维化终末期'],
    answer: 'B',
    explanation: '磨玻璃密度为肺泡间隔增厚或肺泡腔部分填充使密度轻度增高，肺结构仍可辨认，见于炎症及早期腺癌。',
  },
  {
    category: '病理',
    type: '单选',
    question: '周围型肺癌最常见的病理类型是？',
    options: ['鳞状细胞癌', '小细胞癌', '肺腺癌', '类癌'],
    answer: 'C',
    explanation: '近年来肺腺癌超过鳞癌成为最常见肺癌类型，多表现为周围型结节/肿块。',
  },
  {
    category: '病理',
    type: '单选',
    question: 'CT 上"快进快出"强化的肝占位，最可能病理类型为？',
    options: ['肝血管瘤', '肝细胞癌（HCC）', '肝囊肿', '局灶性结节增生'],
    answer: 'B',
    explanation: 'HCC 由肝动脉供血，动脉期明显强化、门脉期廓清（快进快出）；血管瘤呈"填充式"强化。',
  },
  {
    category: '病理',
    type: '单选',
    question: '多发骨髓瘤最常见的影像表现是？',
    options: ['溶骨性穿凿样骨质破坏', '成骨性硬化', '骨膜三角', '象牙椎'],
    answer: 'A',
    explanation: '多发骨髓瘤典型为多发"穿凿样"溶骨性破坏，可伴病理性骨折，PET-CT 及骨扫描用于分期。',
  },
  {
    category: '病理',
    type: '单选',
    question: '颅内"环形强化+中心坏死"病灶，脑脓肿与高级别胶质瘤的关键鉴别点是？',
    options: ['强化环光滑度、DWI 弥散受限、多房分隔', '病灶大小', '患者性别', '病灶部位'],
    answer: 'A',
    explanation: '脓肿壁光滑、DWI 高信号（脓液弥散受限）且可多房；胶质瘤强化环不规则、壁结节明显。',
  },
  {
    category: '病理',
    type: '单选',
    question: '乳腺 X 线上"多形性成簇微钙化"最常对应的病变是？',
    options: ['纤维腺瘤', '导管原位癌（DCIS）', '单纯囊肿', '脂肪坏死'],
    answer: 'B',
    explanation: '形态多形、成簇/线样分布的钙化典型见于 DCIS 腔内坏死钙化，为恶性肿瘤重要标志。',
  },
  {
    category: '病理',
    type: '单选',
    question: '肾囊肿 Bosniak 分类中，出现增厚强化分隔或壁结节提示？',
    options: ['Bosniak 1 类，肯定良性', 'Bosniak 2F 类，随访', 'Bosniak 3/4 类，恶性可能，建议手术', '无临床意义'],
    answer: 'C',
    explanation: 'Bosniak 3 类（不规则强化分隔/壁）恶性概率高，4 类（强化壁结节）明确提示恶性，均建议手术。',
  },
  {
    category: '病理',
    type: '单选',
    question: '肺栓塞在 CTPA 上的直接征象是？',
    options: ['肺动脉内充盈缺损（附壁/中心性）', '肺纹理增多', '胸腔积液', '肺门淋巴结肿大'],
    answer: 'A',
    explanation: 'CTPA 显示肺动脉内造影剂充盈缺损为肺栓塞直接征象，可伴"轨道征"及右心增大等间接征象。',
  },
  {
    category: '病理',
    type: '单选',
    question: '椎体压缩骨折中，提示恶性（转移/骨髓瘤）的 MR 征象是？',
    options: ['椎弓根受累、椎旁软组织肿块、信号异常范围超出骨折线', 'T1 椎体内脂肪信号保留', '终板模形变', '椎间盘完整'],
    answer: 'A',
    explanation: '恶性压缩骨折多累及椎弓根、伴椎旁肿块且 T1 低信号（骨髓被肿瘤替代）；良性骨折保留骨髓脂肪信号。',
  },
  {
    category: '病理',
    type: '单选',
    question: '肾上腺意外瘤，CT 平扫密度 ≤10HU 最可能为？',
    options: ['嗜铬细胞瘤', '肾上腺皮质腺瘤（富脂）', '转移瘤', '神经母细胞瘤'],
    answer: 'B',
    explanation: '平扫 ≤10HU 提示富含脂质的腺瘤（良性），诊断特异性高；大于 10HU 需增强廓清率评估。',
  },
  {
    category: '病理',
    type: '判断',
    question: '机化性肺炎与肺癌均可表现为实变伴空气支气管征，增强与随访有助于鉴别。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'A',
    explanation: '两者影像可重叠，机化性肺炎呈游走性、激素有效，必要时增强/随访/活检鉴别。',
  },
  {
    category: '病理',
    type: '判断',
    question: '肝血管瘤在 MRI 上典型表现为 T2 明显高信号伴"灯泡征"，增强呈动脉期周边结节样强化并逐步充填。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'A',
    explanation: '血管瘤 T2 显著高信号（灯泡征），增强自周边向中心渐进性充填（延长至 3 分钟以上）为特征。',
  },
  {
    category: '病理',
    type: '判断',
    question: '小肠梗阻时出现"咖啡豆征"提示闭袢性梗阻，但无需紧急外科评估。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'B',
    explanation: '咖啡豆征提示闭袢/绞窄性肠梗阻，有肠坏死风险，必须急诊外科评估处理。',
  },
  // ============================================================
  // 五、报告规范（11 道）
  // ============================================================
  {
    category: '报告规范',
    type: '单选',
    question: '危急值报告中，X 线检查"气胸（大量）"的处置时限要求一般为？',
    options: ['24 小时内', '发现后立即电话通知并记录，按医院制度限时（通常 15-30 分钟）', '次日晨会通报', '无需电话，随报告发送'],
    answer: 'B',
    explanation: '危急值须即时电话通知临床并规范记录（时间、接听人、处置），按院内制度通常限 15-30 分钟。',
  },
  {
    category: '报告规范',
    type: '单选',
    question: '影像报告中"印象/诊断意见"部分应当？',
    options: ['只列阴性结果', '归纳主要阳性发现并给出诊断建议，分级表述', '重复影像所见全文', '省略'],
    answer: 'B',
    explanation: '印象部分应简明归纳关键发现、给出倾向性诊断与建议，如 BI-RADS/LI-RADS 分级，供临床决策。',
  },
  {
    category: '报告规范',
    type: '单选',
    question: '报告中发现"双签名"中审核医师的责任是？',
    options: ['仅签字无需核对', '核对影像与报告一致性、关键发现准确性后签名', '只审格式', '代替书写医师'],
    answer: 'B',
    explanation: '审核医师须复核图像与报告内容一致、危急值已处理，确认无误后签名，承担相应责任。',
  },
  {
    category: '报告规范',
    type: '单选',
    question: '既往影像资料对比在报告中的正确表述是？',
    options: ['可省略', '注明对比日期、变化趋势（增大/缩小/稳定）及测量数据', '仅写"与前相仿"', '禁止引用既往'],
    answer: 'B',
    explanation: '规范报告应注明对比的既往检查日期，量化描述病灶大小、密度的变化，并给出随访建议。',
  },
  {
    category: '报告规范',
    type: '单选',
    question: '结构化报告中，测量数据应遵循的原则是？',
    options: ['估读即可', '标注测量层面/径线（最大径）与单位，可重复', '只报一个径', '用文字描述'],
    answer: 'B',
    explanation: '关键病灶应按 RECIST 等标准测量最大径、标注单位与测量层面，保证随访可重复性。',
  },
  {
    category: '报告规范',
    type: '单选',
    question: '发现报告内容与影像不符时，正确的处理流程是？',
    options: ['直接覆盖修改', '按制度发"报告修改/更正"流程并记录原因', '不处理', '口头告知即可'],
    answer: 'B',
    explanation: '报告更正需走规范流程（修改申请、记录修改前后内容与原因、双签名），保证可追溯性。',
  },
  {
    category: '报告规范',
    type: '单选',
    question: '报告书写中禁用或慎用的表述是？',
    options: ['"未见明确异常"', '"可能"、"考虑"等规范限定语', '"肯定不是肿瘤"等绝对化论断', '描述病变位置'],
    answer: 'C',
    explanation: '影像诊断应避免绝对化结论（如"肯定""绝非"），采用分级与概率性表述，保留随访空间。',
  },
  {
    category: '报告规范',
    type: '单选',
    question: '急诊 CT 发现"脑出血"是否属于危急值？',
    options: ['不属于', '属于，须立即电话通知并记录', '仅大面积出血属于', '仅外伤出血属于'],
    answer: 'B',
    explanation: '急性脑出血属危急值范围，须即时通知临床并规范记录处置过程，防范医疗风险。',
  },
  {
    category: '报告规范',
    type: '判断',
    question: '报告中的"技术参数"部分应记录扫描范围、层厚、增强与否及对比剂信息，便于质控与复查对比。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'A',
    explanation: '技术信息是报告规范化与质控追溯的基础，增强检查须注明对比剂名称、剂量及过敏情况。',
  },
  {
    category: '报告规范',
    type: '判断',
    question: '肺结节报告中引入 Lung-RADS 分级后，可以不再给出随访建议。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'B',
    explanation: 'Lung-RADS 分级本身包含对应随访策略，报告仍应明确写出随访时限与方式，指导临床执行。',
  },
  {
    category: '报告规范',
    type: '判断',
    question: '报告完成后发现扫描部位有遗漏但患者已离开，应直接作废报告等待重新检查。',
    options: ['正确', '错误', '部分正确', '无法确定'],
    answer: 'B',
    explanation: '应通过系统缺陷/补扫流程及时与患者及临床沟通补扫或追加序列，而非简单作废，保证诊断完整性。',
  },
];

// ============================================================
// 工具函数
// ============================================================

/** 按分类筛选试题（filter by category: 影像技术/辐射防护/解剖/病理/报告规范） */
export function filterQuestionsByCategory(category: EducationCategory): EducationQuestion[] {
  return EDUCATION_QUESTIONS.filter((q) => q.category === category);
}

/** 按关键词检索试题（题干/选项/解析，search by keyword） */
export function searchEducationQuestions(keyword: string): EducationQuestion[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return EDUCATION_QUESTIONS;
  return EDUCATION_QUESTIONS.filter(
    (q) =>
      q.question.toLowerCase().includes(kw) ||
      q.explanation.toLowerCase().includes(kw) ||
      q.options.some((opt) => opt.toLowerCase().includes(kw)),
  );
}

/** 生成随机抽题（number 道，不重复，for 模拟考试抽题） */
export function drawRandomQuestions(number: number, category?: EducationCategory): EducationQuestion[] {
  const pool = category ? filterQuestionsByCategory(category) : EDUCATION_QUESTIONS;
  const size = Math.min(number, pool.length);
  const picked: EducationQuestion[] = [];
  const indices = new Set<number>();
  while (indices.size < size) {
    indices.add(Math.floor(Math.random() * pool.length));
  }
  for (const i of indices) {
    picked.push(pool[i] as EducationQuestion);
  }
  return picked;
}
