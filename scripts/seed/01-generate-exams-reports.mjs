// G005-RIS v3.0 检查+报告生成器
// 生成 14,000 条检查 + 9,000 份报告
// 输出到 src/data/generatedExamData.ts

// ============ 可确定性随机 ============
function createRng(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeighted(items, weights, rng) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randInt(min, max, rng) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pad(n, len) {
  return String(n).padStart(len, '0');
}

function randomDate(start, end, rng) {
  const d = new Date(start.getTime() + rng() * (end.getTime() - start.getTime()));
  return d;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1, 2);
  const day = pad(d.getDate(), 2);
  return `${y}-${m}-${day}`;
}

function formatDateTime(d) {
  return formatDate(d) + ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2);
}

function formatTime(d) {
  return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2);
}

// ============ 常量池 ============

const SURNAMES = ['张', '王', '李', '刘', '陈', '杨', '黄', '赵', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '林', '何', '高', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '萧', '田', '董', '袁', '潘', '于', '蒋', '蔡', '余', '杜', '叶', '程', '苏', '魏', '吕', '丁', '任', '沈', '姚', '卢', '姜', '崔', '钟', '谭', '陆', '汪', '范', '金', '石', '廖', '贾', '夏', '韦', '付', '方', '白', '邹', '孟', '熊', '秦', '邱', '江', '尹', '薛', '闫', '段', '雷', '侯', '龙', '史', '陶', '黎', '贺', '顾', '毛', '郝', '龚', '邵', '万', '钱', '严', '覃', '武', '戴', '莫', '孔', '向', '汤'];
const GIVEN_NAMES = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平', '刚', '桂英', '文', '华', '建国', '红', '辉', '亮', '颖', '浩然', '梓涵', '欣怡', '宇轩', '紫萱', '俊豪', '思远', '婉儿', '梓琪', '雨欣', '晨曦', '嘉怡', '可馨', '雅婷', '俊熙', '一鸣', '诗涵', '子轩', '雨涵', '子涵', '志远'];

const GENDERS = ['男', '女'];
const PATIENT_TYPES = ['门诊', '住院', '体检', '急诊'];
const PRIORITIES = ['普通', '紧急', '危重'];
const PRIORITY_WEIGHTS = [0.7, 0.25, 0.05];

const TECHNOLOGIST_NAMES = ['刘建国', '陈小红', '王磊', '张明', '李强', '杨芳', '赵敏', '周涛', '吴刚', '郑华'];
const RADIOLOGIST_NAMES = ['李明辉', '王秀峰', '张海涛', '陈志远', '刘文博', '杨丽华', '赵建国', '黄晓明', '周丽华', '吴文博'];

const CLINICAL_DIAGNOSES = [
  '脑梗死后复查', '腰痛待查', '肺炎', '外伤后检查', '乳腺结节随访',
  '头痛待查', '腹部不适', '咳嗽待查', '骨折复查', '术前检查',
  '高血压', '糖尿病', '冠心病', '脑出血', '肿瘤术后复查',
  '肝占位性质待定', '肾囊肿', '胆囊结石', '前列腺增生', '子宫肌瘤',
  '甲状腺结节', '鼻窦炎', '中耳炎', '青光眼', '白内障',
  '体检发现', '胸痛', '腹痛', '关节痛', '水肿待查',
  '发热待查', '体重减轻', '贫血', '吐血', '便血',
  '泌尿系感染', '肾功能不全', '慢阻肺', '哮喘', '肺结节随访',
  '淋巴结肿大', '骨质疏松', '退行性骨关节病', '椎间盘突出', '坐骨神经痛',
  '肩周炎', '膝关节炎', '类风湿', '痛风', '脊柱侧弯',
];

const EXAM_ITEMS_BY_MODALITY = {
  CT: [
    { id: 'EI-CT-001', name: '头颅CT平扫' },
    { id: 'EI-CT-002', name: '头颅CT增强' },
    { id: 'EI-CT-003', name: '胸部CT平扫' },
    { id: 'EI-CT-004', name: '胸部CT增强' },
    { id: 'EI-CT-005', name: '腹部CT平扫' },
    { id: 'EI-CT-006', name: '腹部CT增强' },
    { id: 'EI-CT-007', name: '盆腔CT平扫' },
    { id: 'EI-CT-008', name: '盆腔CT增强' },
    { id: 'EI-CT-009', name: '颈椎CT平扫' },
    { id: 'EI-CT-010', name: '腰椎CT平扫' },
    { id: 'EI-CT-011', name: '脊柱CT三维重建' },
    { id: 'EI-CT-012', name: '冠脉CTA' },
    { id: 'EI-CT-013', name: '主动脉CTA' },
    { id: 'EI-CT-014', name: '肺动脉CTA' },
    { id: 'EI-CT-015', name: '颅脑CTA' },
    { id: 'EI-CT-016', name: '颈部CT平扫' },
    { id: 'EI-CT-017', name: '鼻窦CT平扫' },
    { id: 'EI-CT-018', name: '颞骨CT平扫' },
    { id: 'EI-CT-019', name: '眼眶CT平扫' },
    { id: 'EI-CT-020', name: '四肢CT平扫' },
    { id: 'EI-CT-021', name: '泌尿系CTU' },
    { id: 'EI-CT-022', name: '胸部CT低剂量筛查' },
  ],
  MR: [
    { id: 'EI-MR-001', name: '头颅MR平扫' },
    { id: 'EI-MR-002', name: '头颅MR增强' },
    { id: 'EI-MR-003', name: '头颅MRA' },
    { id: 'EI-MR-004', name: '头颅MRV' },
    { id: 'EI-MR-005', name: '颈椎MR平扫' },
    { id: 'EI-MR-006', name: '胸椎MR平扫' },
    { id: 'EI-MR-007', name: '腰椎MR平扫' },
    { id: 'EI-MR-008', name: '腰椎MR增强' },
    { id: 'EI-MR-009', name: '膝关节MR平扫' },
    { id: 'EI-MR-010', name: '肩关节MR平扫' },
    { id: 'EI-MR-011', name: '髋关节MR平扫' },
    { id: 'EI-MR-012', name: '腹部MR平扫' },
    { id: 'EI-MR-013', name: '腹部MR增强' },
    { id: 'EI-MR-014', name: '盆腔MR平扫' },
    { id: 'EI-MR-015', name: '盆腔MR增强' },
    { id: 'EI-MR-016', name: '心脏MR平扫' },
    { id: 'EI-MR-017', name: '乳腺MR增强' },
    { id: 'EI-MR-018', name: '前列腺MR平扫' },
    { id: 'EI-MR-019', name: '前列腺MR增强' },
    { id: 'EI-MR-020', name: 'MRCP' },
    { id: 'EI-MR-021', name: '内耳MR平扫' },
    { id: 'EI-MR-022', name: '臂丛神经MR' },
  ],
  DR: [
    { id: 'EI-DR-001', name: '胸部正位片' },
    { id: 'EI-DR-002', name: '胸部正侧位片' },
    { id: 'EI-DR-003', name: '腹部立位平片' },
    { id: 'EI-DR-004', name: '腹部卧位平片' },
    { id: 'EI-DR-005', name: '颈椎正侧位片' },
    { id: 'EI-DR-006', name: '胸椎正侧位片' },
    { id: 'EI-DR-007', name: '腰椎正侧位片' },
    { id: 'EI-DR-008', name: '腰椎双斜位片' },
    { id: 'EI-DR-009', name: '骨盆平片' },
    { id: 'EI-DR-010', name: '髋关节正位片' },
    { id: 'EI-DR-011', name: '膝关节正侧位片' },
    { id: 'EI-DR-012', name: '踝关节正侧位片' },
    { id: 'EI-DR-013', name: '肩关节正位片' },
    { id: 'EI-DR-014', name: '肘关节正侧位片' },
    { id: 'EI-DR-015', name: '腕关节正侧位片' },
    { id: 'EI-DR-016', name: '手正斜位片' },
    { id: 'EI-DR-017', name: '足正斜位片' },
    { id: 'EI-DR-018', name: '鼻骨侧位片' },
    { id: 'EI-DR-019', name: '头颅正侧位片' },
    { id: 'EI-DR-020', name: '副鼻窦华氏位' },
    { id: 'EI-DR-021', name: '肋骨正斜位片' },
    { id: 'EI-DR-022', name: '全脊柱全长片' },
  ],
  DSA: [
    { id: 'EI-DS-001', name: '冠脉造影' },
    { id: 'EI-DS-002', name: '冠脉支架植入' },
    { id: 'EI-DS-003', name: '全脑血管造影' },
    { id: 'EI-DS-004', name: '颈动脉支架植入' },
    { id: 'EI-DS-005', name: '主动脉造影' },
    { id: 'EI-DS-006', name: '肾动脉造影' },
    { id: 'EI-DS-007', name: '下肢动脉造影' },
    { id: 'EI-DS-008', name: '下肢静脉造影' },
    { id: 'EI-DS-009', name: '肝动脉化疗栓塞(TACE)' },
    { id: 'EI-DS-010', name: '射频消融术' },
    { id: 'EI-DS-011', name: '经皮肝穿刺胆管引流(PTCD)' },
    { id: 'EI-DS-012', name: '下腔静脉滤器植入' },
    { id: 'EI-DS-013', name: '食管支架植入' },
    { id: 'EI-DS-014', name: '经皮穿刺活检' },
    { id: 'EI-DS-015', name: '经皮肾造瘘' },
    { id: 'EI-DS-016', name: '腹腔脓肿穿刺引流' },
    { id: 'EI-DS-017', name: '经颈静脉肝内门体分流(TIPS)' },
    { id: 'EI-DS-018', name: '支气管动脉栓塞' },
    { id: 'EI-DS-019', name: '子宫动脉栓塞' },
    { id: 'EI-DS-020', name: '经皮椎体成形(PVP)' },
  ],
  MG: [
    { id: 'EI-MG-001', name: '双侧乳腺钼靶' },
    { id: 'EI-MG-002', name: '左侧乳腺钼靶' },
    { id: 'EI-MG-003', name: '右侧乳腺钼靶' },
    { id: 'EI-MG-004', name: '双侧乳腺钼靶+断层' },
    { id: 'EI-MG-005', name: '左侧乳腺钼靶+断层' },
    { id: 'EI-MG-006', name: '右侧乳腺钼靶+断层' },
    { id: 'EI-MG-007', name: '乳腺钼靶定位穿刺' },
    { id: 'EI-MG-008', name: '乳腺钼靶随访' },
  ],
  'PET-CT': [
    { id: 'EI-PT-001', name: '全身PET-CT(18F-FDG)' },
    { id: 'EI-PT-002', name: '全身PET-CT(PSMA)' },
    { id: 'EI-PT-003', name: '全身PET-CT(68Ga-DOTA)' },
    { id: 'EI-PT-004', name: '胸部PET-CT' },
    { id: 'EI-PT-005', name: '腹部PET-CT' },
    { id: 'EI-PT-006', name: '头颈部PET-CT' },
    { id: 'EI-PT-007', name: '盆腔PET-CT' },
    { id: 'EI-PT-008', name: 'PET-CT延迟显像' },
    { id: 'EI-PT-009', name: '全身PET-CT随访' },
  ],
  US: [
    { id: 'EI-US-001', name: '腹部超声(肝胆胰脾)' },
    { id: 'EI-US-002', name: '泌尿系超声' },
    { id: 'EI-US-003', name: '妇科超声' },
    { id: 'EI-US-004', name: '产科超声' },
    { id: 'EI-US-005', name: '甲状腺超声' },
    { id: 'EI-US-006', name: '乳腺超声' },
    { id: 'EI-US-007', name: '心脏彩超' },
    { id: 'EI-US-008', name: '颈动脉超声' },
    { id: 'EI-US-009', name: '下肢血管超声' },
    { id: 'EI-US-010', name: '上肢血管超声' },
    { id: 'EI-US-011', name: '浅表器官超声' },
    { id: 'EI-US-012', name: '经直肠超声' },
    { id: 'EI-US-013', name: '经阴道超声' },
    { id: 'EI-US-014', name: '超声引导穿刺' },
    { id: 'EI-US-015', name: '新生儿颅脑超声' },
    { id: 'EI-US-016', name: '关节超声' },
    { id: 'EI-US-017', name: '超声弹性成像' },
    { id: 'EI-US-018', name: '超声造影' },
  ],
};

const EXAM_BODY_PARTS = {
  CT: ['头颅', '胸部', '腹部', '盆腔', '颈椎', '腰椎', '脊柱', '心脏', '血管', '颈部', '鼻窦', '颞骨', '眼眶', '四肢', '泌尿系', '肺'],
  MR: ['头颅', '颈椎', '胸椎', '腰椎', '脊柱', '膝关节', '肩关节', '髋关节', '腹部', '盆腔', '心脏', '乳腺', '前列腺', '胆道', '内耳', '臂丛神经'],
  DR: ['胸部', '腹部', '颈椎', '胸椎', '腰椎', '脊柱', '骨盆', '髋关节', '膝关节', '踝关节', '肩关节', '肘关节', '腕关节', '手', '足', '鼻骨', '头颅', '鼻窦', '肋骨'],
  DSA: ['心脏', '脑血管', '颈动脉', '主动脉', '肾动脉', '下肢动脉', '下肢静脉', '肝脏', '胆道', '食管', '椎体', '腹腔'],
  MG: ['乳腺'],
  'PET-CT': ['全身', '胸部', '腹部', '头颈', '盆腔'],
  US: ['腹部', '泌尿系', '妇科', '产科', '甲状腺', '乳腺', '心脏', '颈动脉', '下肢血管', '上肢血管', '浅表', '前列腺', '关节'],
};

const BODY_PARTS_20 = {
  CT: ['头颅', '胸部', '腹部', '盆腔', '颈椎', '腰椎', '脊柱', '心脏', '血管', '颈部', '鼻窦', '颞骨', '眼眶', '四肢', '泌尿系', '肺', '纵隔', '肾上腺', '胰腺', '胆囊', '脾脏', '肾脏'],
  MR: ['头颅', '颈椎', '胸椎', '腰椎', '脊柱', '膝关节', '肩关节', '髋关节', '腹部', '盆腔', '心脏', '乳腺', '前列腺', '胆道', '内耳', '臂丛神经', '腕关节', '踝关节', '肘关节', '腮腺', '眼眶', '鼻咽'],
  DR: ['胸部', '腹部', '颈椎', '胸椎', '腰椎', '脊柱', '骨盆', '髋关节', '膝关节', '踝关节', '肩关节', '肘关节', '腕关节', '手', '足', '鼻骨', '头颅', '鼻窦', '肋骨', '锁骨', '跟骨', '骶髂关节'],
  DSA: ['心脏', '脑血管', '颈动脉', '主动脉', '肾动脉', '下肢动脉', '下肢静脉', '肝脏', '胆道', '食管', '椎体', '腹腔', '支气管动脉', '子宫动脉', '髂动脉', '锁骨下动脉', '脾动脉', '肠系膜动脉', '门静脉', '肺血管'],
  MG: ['乳腺(双侧)', '乳腺(左侧)', '乳腺(右侧)', '腋窝', '胸壁', '锁骨上区', '乳腺(外上象限)', '乳腺(内上象限)', '乳腺(外下象限)', '乳腺(内下象限)', '乳晕区', '乳腺尾叶', '乳腺(中央区)', '乳腺(术后)'],
  'PET-CT': ['全身', '胸部', '腹部', '头颈', '盆腔', '肺', '肝脏', '骨骼', '淋巴结', '脑', '乳腺', '胰腺', '结直肠', '胃', '食管', '甲状腺', '前列腺', '卵巢', '子宫', '皮肤'],
  US: ['腹部', '泌尿系', '妇科', '产科', '甲状腺', '乳腺', '心脏', '颈动脉', '下肢血管', '上肢血管', '浅表', '前列腺', '关节', '腮腺', '颌下腺', '阴囊', '睾丸', '精囊', '阑尾', '肌骨', '软组织', '神经'],
};

// 科室分布
const DEPARTMENTS = ['放射科', '心内科', '神经内科', '骨科', '急诊科'];
const DEPT_WEIGHTS = [0.6, 0.1, 0.1, 0.1, 0.1];

// 模态分布
const MODALITIES = ['CT', 'MR', 'DR', 'DSA', '乳腺钼靶', 'PET-CT', 'US'];
const MODALITY_WEIGHTS = [0.25, 0.20, 0.25, 0.10, 0.05, 0.05, 0.10];
// Note: DSA 10% = DSA 5% + 介入 5%

// 状态分布
const EXAM_STATUSES = ['已发布', '已签发', '审核中', '书写中', '退回/修订'];
const EXAM_STATUS_WEIGHTS = [0.60, 0.15, 0.10, 0.10, 0.05];

// 设备列表 (from deviceMasterMock.ts)
const DEVICES = {
  CT: [
    { id: 'DEV-CT-001', name: 'CT-1（西门子SOMATOM Force）', roomId: 'ROOM-CT1', roomName: 'CT1室' },
    { id: 'DEV-CT-002', name: 'CT-2（西门子SOMATOM Definition AS+）', roomId: 'ROOM-CT2', roomName: 'CT2室' },
    { id: 'DEV-CT-003', name: 'CT-3（GE Revolution CT）', roomId: 'ROOM-CT3', roomName: 'CT3室' },
    { id: 'DEV-CT-004', name: 'CT-4（飞利浦iCT Elite）', roomId: 'ROOM-CT4', roomName: 'CT4室' },
    { id: 'DEV-CT-005', name: 'CT-5（佳能Aquilion ONE）', roomId: 'ROOM-CT5', roomName: 'CT5室' },
    { id: 'DEV-CT-006', name: 'CT-6（联影uCT 960+）', roomId: 'ROOM-CT6', roomName: 'CT6室' },
    { id: 'DEV-CT-007', name: 'CT-7（联影uCT 860）', roomId: 'ROOM-CT7', roomName: 'CT7室' },
    { id: 'DEV-CT-008', name: 'CT-8（佳能Aquilion Precision）', roomId: 'ROOM-CT8', roomName: 'CT8室' },
    { id: 'DEV-CT-009', name: 'CT-9（GE Revolution Apex）', roomId: 'ROOM-CT9', roomName: 'CT9室' },
    { id: 'DEV-CT-010', name: 'CT-10（西门子SOMATOM go.Top）', roomId: 'ROOM-CT10', roomName: 'CT10室' },
  ],
  MR: [
    { id: 'DEV-MR-001', name: 'MR-1（西门子MAGNETOM Vida 3.0T）', roomId: 'ROOM-MR1', roomName: 'MR1室' },
    { id: 'DEV-MR-002', name: 'MR-2（西门子MAGNETOM Aera 1.5T）', roomId: 'ROOM-MR2', roomName: 'MR2室' },
    { id: 'DEV-MR-003', name: 'MR-3（GE SIGNA Architect 3.0T）', roomId: 'ROOM-MR3', roomName: 'MR3室' },
    { id: 'DEV-MR-004', name: 'MR-4（飞利浦Ingenia Ambition 1.5T）', roomId: 'ROOM-MR4', roomName: 'MR4室' },
    { id: 'DEV-MR-005', name: 'MR-5（联影uMR 890 3.0T）', roomId: 'ROOM-MR5', roomName: 'MR5室' },
    { id: 'DEV-MR-006', name: 'MR-6（佳能Vantage Galan 3T）', roomId: 'ROOM-MR6', roomName: 'MR6室' },
    { id: 'DEV-MR-007', name: 'MR-7（GE SIGNA Premier 3.0T）', roomId: 'ROOM-MR7', roomName: 'MR7室' },
    { id: 'DEV-MR-008', name: 'MR-8（西门子MAGNETOM Lumina 3.0T）', roomId: 'ROOM-MR8', roomName: 'MR8室' },
  ],
  DR: [
    { id: 'DEV-DR-001', name: 'DR-1（飞利浦DigitalDiagnost C90）', roomId: 'ROOM-DR1', roomName: 'DR1室' },
    { id: 'DEV-DR-002', name: 'DR-2（飞利浦DigitalDiagnost C50）', roomId: 'ROOM-DR2', roomName: 'DR2室' },
    { id: 'DEV-DR-003', name: 'DR-3（西门子MULTIX Impact）', roomId: 'ROOM-DR3', roomName: 'DR3室' },
    { id: 'DEV-DR-004', name: 'DR-4（西门子Ysio Max）', roomId: 'ROOM-DR4', roomName: 'DR4室' },
    { id: 'DEV-DR-005', name: 'DR-5（GE Optima XR240amx）', roomId: 'ROOM-DR5', roomName: 'DR5室' },
    { id: 'DEV-DR-006', name: 'DR-6（GE Definium 6000）', roomId: 'ROOM-DR6', roomName: 'DR6室' },
    { id: 'DEV-DR-007', name: 'DR-7（佳能RADREX-i）', roomId: 'ROOM-DR7', roomName: 'DR7室' },
    { id: 'DEV-DR-008', name: 'DR-8（Carestream DRX-Evolve）', roomId: 'ROOM-DR8', roomName: 'DR8室' },
    { id: 'DEV-DR-009', name: 'DR-9（富士FDR Visionary）', roomId: 'ROOM-DR9', roomName: 'DR9室' },
    { id: 'DEV-DR-010', name: 'DR-10（Hologic Affirm PRISM）', roomId: 'ROOM-DR10', roomName: 'DR10室' },
    { id: 'DEV-DR-011', name: 'DR-11（迈瑞DigiEye 680）', roomId: 'ROOM-DR11', roomName: '急诊DR室' },
    { id: 'DEV-DR-012', name: 'DR-12（联影uDR 780i）', roomId: 'ROOM-DR12', roomName: '体检DR室' },
  ],
  US: [
    { id: 'DEV-US-001', name: 'US-1（飞利浦EPIQ Elite）', roomId: 'ROOM-US1', roomName: '超声1诊室' },
    { id: 'DEV-US-002', name: 'US-2（飞利浦iE33）', roomId: 'ROOM-US2', roomName: '超声2诊室' },
    { id: 'DEV-US-003', name: 'US-3（GE Voluson E10）', roomId: 'ROOM-US3', roomName: '超声3诊室' },
    { id: 'DEV-US-004', name: 'US-4（GE Vivid E95）', roomId: 'ROOM-US4', roomName: '超声4诊室' },
    { id: 'DEV-US-005', name: 'US-5（西门子ACUSON Sequoia）', roomId: 'ROOM-US5', roomName: '超声5诊室' },
    { id: 'DEV-US-006', name: 'US-6（西门子ACUSON S3000）', roomId: 'ROOM-US6', roomName: '超声6诊室' },
    { id: 'DEV-US-007', name: 'US-7（迈瑞Resona 7）', roomId: 'ROOM-US7', roomName: '心脏超声室' },
    { id: 'DEV-US-008', name: 'US-8（开立P50）', roomId: 'ROOM-US8', roomName: '急诊超声室' },
  ],
  MG: [
    { id: 'DEV-MG-001', name: '乳腺钼靶-1（Hologic 3Dimensions）', roomId: 'ROOM-MG1', roomName: '钼靶1室' },
    { id: 'DEV-MG-002', name: '乳腺钼靶-2（GE Senographe Pristina）', roomId: 'ROOM-MG2', roomName: '钼靶2室' },
    { id: 'DEV-MG-003', name: '乳腺钼靶-3（富士AMULET Innovality）', roomId: 'ROOM-MG3', roomName: '钼靶3室' },
  ],
  'PET-CT': [
    { id: 'DEV-PET-001', name: 'PET-CT-1（西门子Biograph Vision 600）', roomId: 'ROOM-PET1', roomName: 'PET-CT1室' },
    { id: 'DEV-PET-002', name: 'PET-CT-2（联影uMI Panorama）', roomId: 'ROOM-PET2', roomName: 'PET-CT2室' },
  ],
};

// ============ 报告模板 ============

// 放射科所见模板
const RADIOLOGY_FINDINGS = [
  '双肺纹理清晰，未见明显实质性病变，纵隔未见增宽，心脏大小形态正常。',
  '双肺纹理增多、紊乱，双肺野未见明显实质性病变。',
  '右肺下叶见一类圆形结节影，大小约12mm×10mm，边缘可见毛刺征及分叶征。',
  '左肺上叶尖后段见斑片状高密度影，边界欠清，内部密度不均匀。',
  '双肺散在多发微小结节，直径约3-5mm，边界清晰，部分钙化。',
  '右肺中叶见磨玻璃密度结节，约8mm×7mm，边界欠清。',
  '纵隔内见多发肿大淋巴结，最大者短径约14mm，密度均匀。',
  '肝脏大小形态正常，实质内见一类圆形低密度灶，直径约25mm，增强扫描动脉期明显强化。',
  '肝脏内见多发低密度灶，最大者位于右叶，约35mm×30mm，边界欠清。',
  '胆囊大小正常，壁不厚，腔内未见结石影，胆总管未见扩张。',
  '胰腺形态正常，实质密度均匀，胰管未见扩张。',
  '双肾形态对称，右肾见一囊性低密度灶，约18mm×16mm，壁薄光滑。',
  '脾脏不大，实质密度均匀，未见明确占位性病变。',
  '胃壁未见明显增厚，胃腔内未见异常密度影。',
  '脑实质未见明显异常密度灶，脑室系统未见扩张，中线结构居中。',
  '右侧基底节区见片状低密度影，边界欠清，范围约20mm×15mm。',
  '左侧颞叶见一类圆形稍高密度影，周围伴水肿带，占位效应明显。',
  '颅骨骨质连续，未见明确骨折线，颅内未见异常积气。',
  '鼻窦黏膜增厚，以上颌窦为著，窦腔内见液平。',
  '关节面光滑，关节间隙未见明显变窄，关节腔内未见积液。',
  'L4/5椎间盘向后突出约4mm，硬膜囊受压，双侧侧隐窝变窄。',
  '椎体边缘见骨质增生，椎间隙未见明显变窄。',
  '骨折线清晰可见，对位对线尚可，骨痂形成未见明确异常。',
  '半月板形态、信号未见明显异常，前后交叉韧带走行连续。',
  '乳腺内未见明确肿块及钙化，腺体呈致密型。',
  '左乳外上象限见一不规则高密度肿块，约15mm×12mm，边界欠清，伴毛刺征。',
  '右乳见多发簇状细小多形性钙化，分布范围约20mm×15mm。',
  '甲状腺左叶见低回声结节，约8mm×6mm，边界清晰，内部回声均匀。',
  '胆囊内见多发强回声团，后伴声影，最大约12mm，可随体位移动。',
  '肝内见多个囊性无回声区，最大约15mm×12mm，壁薄光滑，后方回声增强。',
  '前列腺体积增大，约48mm×36mm×32mm，突向膀胱约8mm。',
  '子宫肌层内见低回声结节，约35mm×28mm，边界清晰，内膜线居中。',
  '心脏各房室大小正常范围，室壁运动尚好，各瓣膜回声及运动未见明显异常。',
  '腹腔未见游离气体及积液征象，肠管未见明显扩张及液平。',
  '双侧胸腔未见明显积液征象，胸膜未见增厚。',
  'C4/5、C5/6椎间盘向后突出，硬膜囊受压，椎管未见狭窄。',
  '股骨头形态尚可，关节间隙未见明显狭窄，髋臼未见明显骨质破坏。',
  '肩袖见连续性中断，肱骨大结节见囊变，肩峰下间隙变窄。',
  '胰头区见一低密度占位，大小约28mm×22mm，边界欠清，增强后强化不明显。',
  '肾脏大小形态正常，实质内未见明显异常密度灶，肾盂肾盏未见扩张。',
  '膀胱充盈尚可，壁未见明显增厚，腔内未见异常密度影。',
  '头颅MRA显示右侧大脑中动脉M1段局限性狭窄，远端分支减少。',
  'DWI序列显示左侧基底节区见明显高信号影，ADC图呈低信号。',
  '全身FDG代谢显像显示右肺下叶结节呈异常放射性浓聚，SUVmax约4.8。',
  '多发骨骼部位见异常放射性浓聚，SUVmax约3.2-6.5。',
  '肝右叶动脉期明显强化灶，门脉期及延迟期呈"快进快出"表现。',
  '冠脉CTA显示左前降支近段混合性斑块形成，管腔狭窄约60%。',
  '肾动脉造影显示右肾动脉起始部局限性狭窄约75%。',
  '下腔静脉滤器位置良好，未见明显血栓形成。',
  '肝右叶肿块经皮穿刺活检，组织条满意，送病理检查。',
];

const RADIOLOGY_IMPRESSIONS = [
  '未见明显异常。',
  '双肺多发微小结节，考虑良性，建议年度随访。',
  '右肺下叶占位性病变，考虑周围型肺癌可能，建议穿刺活检。',
  '左肺上叶炎症，建议抗炎治疗后复查。',
  '右肺磨玻璃结节（Lung-RADS 3类），建议6个月随访。',
  '双肺转移瘤可能，建议寻找原发灶。',
  '纵隔淋巴结肿大，性质待定，建议增强扫描或PET-CT进一步检查。',
  '肝右叶占位性病变，考虑肝细胞癌可能（LI-RADS 5类），建议多学科会诊。',
  '肝脏多发转移瘤可能，建议寻找原发灶。',
  '肝囊肿（单纯性），无需特殊处理。',
  '胆囊结石，建议普外科门诊。',
  '右肾囊肿（Bosniak 1类），良性，建议定期随访。',
  '右侧基底节区脑梗死（亚急性期）。',
  '左侧颞叶占位性病变，周围水肿明显，建议增强MRI进一步检查。',
  '鼻窦炎。',
  'L4/5椎间盘突出，建议保守治疗。',
  '腰椎退行性变。',
  '骨折愈合中，建议定期复查。',
  '膝关节退行性变。',
  '膝关节半月板损伤（II级），建议关节镜进一步评估。',
  'BI-RADS 1类：阴性，建议常规年度筛查。',
  'BI-RADS 2类：良性发现（良性钙化/淋巴结），建议常规年度筛查。',
  'BI-RADS 3类：可能良性，建议6个月随访。',
  'BI-RADS 4A类：低度可疑恶性，建议穿刺活检。',
  'BI-RADS 4B类：中度可疑恶性，建议穿刺活检。',
  'BI-RADS 4C类：高度可疑恶性，建议穿刺活检。',
  'BI-RADS 5类：高度提示恶性，建议穿刺活检及多学科会诊。',
  '甲状腺左叶结节（TI-RADS 3类），建议定期随访。',
  '甲状腺左叶结节（TI-RADS 4A类），建议穿刺活检。',
  '前列腺增生，建议泌尿外科门诊。',
  '子宫肌瘤，建议定期随访。',
  '心包少量积液，建议临床随访。',
  '腹部未见明确急腹症征象。',
  '右侧大脑中动脉M1段狭窄，建议神经内科综合评估。',
  '急性脑梗死（左侧基底节区）。',
  '左前降支中度狭窄，建议进一步评估（FFR/负荷心肌灌注）。',
  '右肾动脉狭窄（>70%），建议肾动脉支架成形术。',
  '肝内"快进快出"典型表现，LI-RADS 5类，建议MDT会诊。',
  '胰腺头部占位，考虑胰腺癌可能，建议CA19-9及增强CT进一步检查。',
  '下腔静脉滤器位置良好，建议定期复查。',
  '全身多发转移性病变，建议寻找原发灶。',
  '右肺下叶结节代谢增高（SUVmax 4.8），考虑为恶性病变可能。',
  '前列腺癌TNM分期（PET-CT）：T3N1M0。',
  '椎体压缩性骨折（陈旧性）。',
  '肩袖撕裂（全层），建议骨科门诊。',
  '髋关节退行性变（骨关节炎）。',
  '肝硬化伴门脉高压，脾功能亢进。',
  '股骨头缺血坏死（ARCO 2期），建议避免负重。',
  '心功能评估：左室射血分数（LVEF）约55%，节段性室壁运动异常。',
];

// 心内科所见模板
const CARDIOLOGY_FINDINGS = [
  '心脏各房室大小正常，室壁厚度正常，室壁运动未见明显异常。',
  '左心室增大，左心室射血分数（LVEF）约50%，轻度减低。',
  '左心室壁增厚，室间隔厚度约13mm，考虑高血压心脏病。',
  '左前降支近段见混合性斑块，管腔狭窄约65%。',
  '右冠状动脉中段见钙化性斑块，管腔狭窄约50%。',
  '回旋支远段见非钙化性斑块，管腔狭窄约40%。',
  '冠脉CTA显示三支血管弥漫性病变，前降支最重约80%狭窄。',
  '主动脉瓣增厚钙化，瓣口面积约1.2cm²，轻度狭窄。',
  '二尖瓣见脱垂征象，后叶P2区脱垂，瓣口少量反流。',
  '心包见增厚，约6mm，伴少量心包积液。',
  '左心房增大，房颤心律，左心耳见血栓形成，约15mm×10mm。',
  '肺动脉主干增宽，约28mm，右心室前后径增大。',
  '升主动脉增宽，最大径约42mm，主动脉壁未见夹层征象。',
  '冠脉支架术后：LAD支架近端管腔通畅，未见明显内膜增生及狭窄。',
  '左心室心肌灌注显像显示下壁、后壁心肌灌注减低。',
  '心肌延迟增强显示下壁心肌透壁性梗死。',
  '右心室心尖部见调节束增粗，未见明确占位。',
  '主动脉瓣二叶畸形伴中度狭窄，瓣口面积约1.0cm²。',
  '左室心尖部见室壁瘤形成，约25mm×20mm，附壁血栓形成。',
  '房间隔缺损（继发孔型），大小约18mm×15mm，右房右室增大。',
];

const CARDIOLOGY_IMPRESSIONS = [
  '冠脉CTA未见明显异常。',
  '左前降支中度狭窄，建议行FFR检查进一步评估。',
  '三支血管弥漫性病变，建议行冠脉造影进一步评估。',
  '冠脉支架术后，LAD支架通畅。',
  '高血压心脏病，左心室肥厚。',
  '主动脉瓣轻度狭窄，建议定期随访。',
  '二尖瓣脱垂伴轻度关闭不全，建议定期随访。',
  '心包增厚伴少量积液，建议临床随访。',
  '左心耳血栓形成，建议抗凝治疗。',
  '肺栓塞（中危），建议抗凝治疗。',
  '升主动脉增宽，建议定期随访。',
  '心肌梗死（陈旧性，下壁）。',
  '房间隔缺损（继发孔型），建议介入封堵治疗。',
  '主动脉瓣二叶畸形伴中度狭窄，建议超声多学科评估。',
  '左室心尖部室壁瘤伴附壁血栓，建议抗凝治疗。',
];

// 神经内科所见模板
const NEUROLOGY_FINDINGS = [
  '脑实质未见明显异常密度灶，脑室系统未见扩张。',
  '双侧基底节区见多发腔隙性梗死灶，最大约8mm×6mm。',
  '右侧侧脑室旁见片状白质高信号，Fazekas 2级。',
  '左侧大脑中动脉M1段见局限性狭窄约70%，远端分支减少。',
  '右侧颈内动脉起始部见混合性斑块，管腔狭窄约85%。',
  'Willis环完整，前交通动脉开放，后交通动脉未显示。',
  '左侧椎动脉V4段见动脉瘤，大小约8mm×6mm，瘤颈约4mm。',
  'DWI序列显示右侧基底节区见明显高信号影，ADC图呈低信号。',
  'SWI序列显示双侧基底节区多发微出血灶。',
  '大脑皮质萎缩，以额颞叶为著，脑沟脑池增宽。',
  '头颅MRA显示左侧大脑中动脉M1段闭塞，远端通过软脑膜侧支代偿。',
  '右侧丘脑见新发梗死灶，DWI高信号，大小约15mm×12mm。',
  '脑干形态正常，未见明确梗死及占位病变。',
  '双侧额叶皮质下白质见多发斑点状缺血灶。',
  '脑白质弥漫性损伤，Fazekas 3级，符合脑小血管病改变。',
  '颈动脉超声显示右侧颈总动脉IMT增厚约1.2mm。',
  '经颅多普勒显示左侧大脑中动脉血流速度增快。',
  '颅内未见明确动脉瘤及动静脉畸形征象。',
  '垂体大小形态正常，鞍区未见明确占位性病变。',
  '筛窦及蝶窦黏膜增厚，左侧上颌窦见囊肿。',
];

const NEUROLOGY_IMPRESSIONS = [
  '头颅CT平扫未见明显异常。',
  '双侧基底节区多发腔隙性梗死，建议控制脑血管病危险因素。',
  '脑白质疏松症（Fazekas 2级），建议完善脑血管评估。',
  '左侧大脑中动脉M1段狭窄，建议规范化药物治疗。',
  '右侧颈内动脉重度狭窄，建议介入治疗评估。',
  '左侧椎动脉动脉瘤，建议DSA进一步评估及治疗。',
  '急性脑梗死（右侧基底节区）。',
  '脑小血管病（CSVD）影像改变，建议综合管理。',
  '急性脑梗死（右侧丘脑），建议溶栓或介入治疗评估。',
  '大脑中动脉闭塞（左侧），侧支代偿尚可。',
  '阿尔茨海默病影像改变（MTL评分3分），建议神经心理评估。',
  '脑萎缩（额颞叶为主），鉴别额颞叶痴呆可能。',
  '颈动脉粥样硬化（右侧IMT增厚），建议他汀治疗。',
  '颅内动脉粥样硬化性狭窄，建议综合管理。',
];

// 骨科所见模板
const ORTHOPEDICS_FINDINGS = [
  'L4/5椎间盘向后突出约4mm，硬膜囊受压，双侧侧隐窝变窄。',
  'L5/S1椎间盘向后突出，右侧侧隐窝可见髓核游离。',
  'C5/6椎间盘向后突出，伴椎间盘真空征，硬膜囊受压。',
  'L3椎体压缩性骨折，高度丢失约1/3，椎体后缘完整。',
  '左股骨颈见骨折线，头颈型，无明显移位。',
  '右桡骨远端骨折，骨折线累及关节面，轻度背侧移位。',
  '腰椎退行性骨关节病，L2-S1椎体边缘骨质增生，椎间隙轻度变窄。',
  '左膝关节内侧半月板后角见III级信号，达关节面。',
  '前交叉韧带见连续性中断，信号增高。',
  '右肩冈上肌腱见部分撕裂，肌腱增厚，信号增高。',
  '左股骨头见地图样异常信号影，软骨下骨折。',
  '髋关节间隙变窄，髋臼边缘骨质增生，股骨头囊变。',
  '右踝关节距腓前韧带见连续性中断，周围软组织肿胀。',
  'L4椎体向前滑脱（I度），双侧椎弓崩裂。',
  '胸12椎体骨质疏松性压缩骨折。',
  '左肱骨外科颈骨折，大结节撕脱骨折，无明显移位。',
  '脊柱侧弯（Cobb角约25°），胸腰段右凸。',
  '右腕舟骨见骨折线，无明显移位。',
  '膝关节关节腔及髌上囊见少量积液。',
  '左跟骨见骨刺形成，约8mm，跟腱增厚。',
];

const ORTHOPEDICS_IMPRESSIONS = [
  'L4/5椎间盘突出，建议保守治疗。',
  'L5/S1椎间盘突出伴髓核游离，建议微创手术治疗。',
  'C5/6椎间盘突出，建议颈椎牵引及理疗。',
  'L3椎体压缩性骨折（骨质疏松性），建议骨科门诊。',
  '左股骨颈骨折，建议人工髋关节置换。',
  '右桡骨远端骨折，建议手法复位+石膏固定。',
  '腰椎退行性变。',
  '左膝内侧半月板撕裂，建议关节镜手术治疗。',
  '前交叉韧带断裂，建议重建手术。',
  '右肩冈上肌腱部分撕裂，建议保守治疗。',
  '左股骨头缺血坏死（ARCO 3期），建议人工髋关节置换。',
  '髋关节骨关节炎（重度），建议关节置换评估。',
  '右踝距腓前韧带断裂，建议保守治疗。',
  'L4椎体滑脱（I度）伴椎弓崩裂，建议后路融合手术。',
  '骨质疏松性椎体压缩骨折，建议PVP或保守治疗。',
  '左肱骨外科颈骨折，建议保守治疗。',
  '脊柱侧弯（Cobb角25°），建议支具治疗。',
  '右腕舟骨骨折，建议石膏固定6周后复查。',
  '膝关节少量积液，建议休息及理疗。',
  '左跟骨骨刺，建议保守治疗。',
];

// 急诊科所见模板
const EMERGENCY_FINDINGS = [
  '右肺中叶见实变影，密度不均匀，可见空气支气管征。',
  '膈下游离气体，呈新月形，双侧膈肌清晰可见。',
  '双侧胸腔见大量积液，右下肺组织受压不张。',
  '左肺上叶舌段见楔形高密度影，尖端指向肺门，提示肺栓塞可能。',
  '主动脉增宽，内膜见撕脱的内膜片，形成真假腔。',
  '右侧基底节区及丘脑见片状高密度影，血肿约35ml，破入脑室。',
  '颅骨见多发骨折线，累及额骨、顶骨，颅内积气。',
  '硬膜外见梭形高密度影，中线上移位约8mm。',
  '双侧多发肋骨骨折（第3-7肋），伴血胸，肺挫伤。',
  '肝右叶见不规则低密度区，包膜下血肿，腹腔积血。',
  '脾脏增大，实质内见不规则低密度区，脾周血肿。',
  '小肠肠壁增厚，肠系膜水肿，腹腔少量游离气体。',
  '右肾见多发结石，最大约12mm，伴肾盂积水扩张。',
  '腹主动脉增宽约55mm，附壁血栓形成。',
  '肠管扩张积气，见多发液平，结肠直径约8cm。',
  '右上肺见球形高密度影，空洞形成，壁厚。',
  '胆囊增大，约12cm×5cm，壁增厚约5mm，周围渗出。',
  '胰腺弥漫性增大，胰腺周围脂肪间隙模糊，见大量渗出。',
  '右下腹阑尾增粗约9mm，壁增厚，周围渗出伴粪石。',
  '左侧基底节区见片状低密度灶，范围约25mm×20mm，ASPECTS 7分。',
];

const EMERGENCY_IMPRESSIONS = [
  '右肺中叶肺炎，建议抗感染治疗。',
  '消化道穿孔，建议急诊手术治疗。',
  '双侧胸腔积液，建议行胸腔穿刺引流。',
  '肺栓塞（高危），建议急诊溶栓或介入取栓。',
  '主动脉夹层（Stanford A型），建议急诊外科手术。',
  '基底节区脑出血，建议神经内科会诊。',
  '开放性颅脑损伤，建议神经外科急诊手术。',
  '急性硬膜外血肿，建议急诊开颅血肿清除。',
  '多发肋骨骨折伴血胸，建议胸外科会诊。',
  '肝破裂，建议急诊手术探查。',
  '脾破裂，建议急诊手术切除。',
  '肠穿孔/肠坏死可能，建议急诊手术探查。',
  '右肾多发结石伴积水，建议泌尿外科会诊。',
  '腹主动脉瘤（55mm），建议急诊血管外科手术。',
  '肠梗阻，建议胃肠减压及复查。',
  '肺脓肿，建议抗感染+引流。',
  '急性胆囊炎，建议普外科会诊。',
  '急性重症胰腺炎，建议ICU综合治疗。',
  '急性阑尾炎，建议急诊手术。',
  '急性脑梗死（左侧基底节区），建议溶栓治疗评估。',
];

// ============ 主生成函数 ============

function generateExams(count, rng) {
  const exams = [];
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2026-07-10');

  for (let i = 0; i < count; i++) {
    const idx = i + 1;

    // 科室
    const department = pickWeighted(DEPARTMENTS, DEPT_WEIGHTS, rng);

    // 模态 (accounting for 介入 as DSA)
    let modalityKey;
    const modRoll = rng();
    const interventionalMods = ['DSA', 'DSA']; // 介入 shares DSA modality
    if (modRoll < 0.25) modalityKey = 'CT';
    else if (modRoll < 0.45) modalityKey = 'MR';
    else if (modRoll < 0.70) modalityKey = 'DR';
    else if (modRoll < 0.80) modalityKey = 'DSA'; // DSA 5% + 介入 5% = 10%
    else if (modRoll < 0.90) modalityKey = 'US';
    else if (modRoll < 0.95) modalityKey = '乳腺钼靶';
    else modalityKey = 'PET-CT';

    // Map to device modality
    const devModality = modalityKey === '乳腺钼靶' ? 'MG' : modalityKey;

    // 患者信息
    const gender = pick(GENDERS, rng);
    const age = randInt(18, 85, rng);
    const firstName = pick(SURNAMES, rng);
    const lastName = pick(GIVEN_NAMES, rng);
    const patientName = firstName + lastName;
    const patientId = 'GEN-P-' + pad(randInt(1, 99999, rng), 6);

    // 检查项目
    const items = EXAM_ITEMS_BY_MODALITY[modalityKey] || EXAM_ITEMS_BY_MODALITY.CT;
    const examItem = pick(items, rng);

    // 部位
    const parts = BODY_PARTS_20[modalityKey] || BODY_PARTS_20.CT;
    const bodyPart = pick(parts, rng);

    // 临床诊断
    const clinicalDiagnosis = pick(CLINICAL_DIAGNOSES, rng);

    // 日期时间
    const examDate = randomDate(startDate, endDate, rng);
    const examHour = randInt(7, 18, rng);
    const examMin = randInt(0, 11, rng) * 5;
    examDate.setHours(examHour, examMin, 0, 0);
    const examDateStr = formatDate(examDate);
    const examTimeStr = formatTime(examDate);

    // 创建/更新时间
    const createdDate = new Date(examDate);
    createdDate.setMinutes(createdDate.getMinutes() - randInt(30, 180, rng));
    const createdTime = formatDateTime(createdDate);
    const updatedTime = formatDateTime(examDate);

    // 状态
    const status = pickWeighted(EXAM_STATUSES, EXAM_STATUS_WEIGHTS, rng);

    // 设备
    const devices = DEVICES[devModality] || DEVICES.CT;
    const device = pick(devices, rng);

    // 技师
    const technologistName = pick(TECHNOLOGIST_NAMES, rng);
    const technologistId = 'R' + pad(randInt(1, 50, rng), 3);

    // 图像数
    let imagesAcquired;
    if (modalityKey === 'CT') imagesAcquired = randInt(40, 300, rng);
    else if (modalityKey === 'MR') imagesAcquired = randInt(80, 500, rng);
    else if (modalityKey === 'DR') imagesAcquired = randInt(1, 6, rng);
    else if (modalityKey === 'DSA') imagesAcquired = randInt(50, 400, rng);
    else if (modalityKey === '乳腺钼靶') imagesAcquired = randInt(4, 20, rng);
    else if (modalityKey === 'PET-CT') imagesAcquired = randInt(200, 800, rng);
    else if (modalityKey === 'US') imagesAcquired = randInt(10, 80, rng);
    else imagesAcquired = randInt(10, 100, rng);

    // Accession number
    const accSeq = pad(randInt(1, 99999, rng), 5);
    const accessionNumber = examDateStr.replace(/-/g, '') + accSeq;

    // Priority
    const priority = pickWeighted(PRIORITIES, PRIORITY_WEIGHTS, rng);

    // 患者类型 based on department
    let patientType;
    if (department === '急诊科') patientType = '急诊';
    else patientType = pickWeighted(PATIENT_TYPES, [0.35, 0.30, 0.25, 0.10], rng);

    // 临床病史
    const clinicalHistory = '症状持续' + randInt(1, 24, rng) + (rng() > 0.5 ? '月' : '天');

    const exam = {
      id: 'GEN-EX-' + pad(idx, 6),
      patientId,
      patientName,
      gender,
      age,
      patientType,
      department,
      examItemId: examItem.id,
      examItemName: examItem.name,
      modality: modalityKey,
      bodyPart,
      examDate: examDateStr,
      examTime: examTimeStr,
      priority,
      clinicalDiagnosis,
      clinicalHistory,
      examIndications: clinicalDiagnosis + '评估',
      relevantLabResults: '',
      technologistId,
      technologistName,
      deviceId: device.id,
      deviceName: device.name,
      roomId: device.roomId,
      roomName: device.roomName,
      status,
      accessionNumber,
      imagesAcquired,
      createdTime,
      updatedTime,
    };

    // 已完成/非书写中 的报告关联字段
    if (status !== '书写中') {
      if (rng() < 0.6) exam.radiologistId = 'D' + pad(randInt(1, 75, rng), 3);
      exam.radiologistName = pick(RADIOLOGIST_NAMES, rng);
      if (status === '已发布' || status === '已签发') {
        exam.publishedTime = formatDateTime(new Date(examDate.getTime() + randInt(1, 48, rng) * 3600000));
        exam.reportId = 'GEN-RP-' + pad(randInt(1, 99999, rng), 6);
      }
    }

    exams.push(exam);
  }

  return exams;
}

function getFindingsByDept(department, rng) {
  let pool;
  switch (department) {
    case '心内科': pool = CARDIOLOGY_FINDINGS; break;
    case '神经内科': pool = NEUROLOGY_FINDINGS; break;
    case '骨科': pool = ORTHOPEDICS_FINDINGS; break;
    case '急诊科': pool = EMERGENCY_FINDINGS; break;
    default: pool = RADIOLOGY_FINDINGS; break;
  }
  // Pick 1-2 findings
  let f = pick(pool, rng);
  if (rng() < 0.3) {
    f += ' ' + pick(pool, rng);
  }
  return f;
}

function getImpressionByDept(department, modality, bodyPart, rng) {
  let pool;
  switch (department) {
    case '心内科': pool = CARDIOLOGY_IMPRESSIONS; break;
    case '神经内科': pool = NEUROLOGY_IMPRESSIONS; break;
    case '骨科': pool = ORTHOPEDICS_IMPRESSIONS; break;
    case '急诊科': pool = EMERGENCY_IMPRESSIONS; break;
    default: pool = RADIOLOGY_IMPRESSIONS; break;
  }

  let impression = pick(pool, rng);

  // RADS scoring for relevant modalities
  const isPositive = rng() < 0.65; // 65% positive rate
  if (isPositive) {
    if ((modality === '乳腺钼靶' || modality === 'MG') && bodyPart.includes('乳腺')) {
      const birads = ['BI-RADS 3类：可能良性', 'BI-RADS 4A类：低度可疑恶性', 'BI-RADS 4B类：中度可疑恶性', 'BI-RADS 4C类：高度可疑恶性', 'BI-RADS 5类：高度提示恶性'];
      impression = pick(birads, rng) + '，建议穿刺活检或手术。';
    } else if (modality === 'MR' && (bodyPart.includes('肝脏') || bodyPart.includes('肝'))) {
      impression = '肝内占位（LI-RADS 5类），考虑肝细胞癌，建议MDT会诊。';
    } else if (modality === 'MR' && (bodyPart.includes('前列腺') || bodyPart.includes('盆腔'))) {
      impression = '前列腺外周带异常信号（PI-RADS 4类），建议超声引导下穿刺活检。';
    } else if (modality === 'CT' && (bodyPart.includes('肝') || bodyPart === '腹部')) {
      impression = pick([
        '肝内占位（LI-RADS 4类），考虑HCC可能，建议增强MRI。',
        '肝内占位（LI-RADS 5类），典型HCC表现，建议MDT。',
        '肝内多发转移瘤，建议寻找原发灶。',
      ], rng);
    } else if (modality === 'CT' && (bodyPart.includes('肺') || bodyPart.includes('胸部'))) {
      impression = pick([
        '肺结节（Lung-RADS 3类），建议6个月随访CT。',
        '肺结节（Lung-RADS 4A类），建议3个月随访或PET-CT。',
        '肺结节（Lung-RADS 4B类），建议活检。',
      ], rng);
    } else {
      // Use department impression directly
    }
  } else {
    // Negative findings
    if (modality === '乳腺钼靶' || bodyPart.includes('乳腺')) {
      impression = pick(['BI-RADS 1类：阴性，建议常规年度筛查。', 'BI-RADS 2类：良性发现，建议常规年度筛查。'], rng);
    } else {
      impression = pick([
        '未见明显异常。',
        '所见未见明确器质性病变。',
        '未见明确阳性发现，建议临床随访。',
      ], rng);
    }
  }

  return impression;
}

function getRecommendations(impression, rng) {
  const hasRec = impression.includes('建议');
  if (hasRec) return '';
  const recs = [
    '建议临床随访，必要时进一步检查。',
    '建议3个月后复查。',
    '建议6个月后复查。',
    '建议专科门诊随访。',
    '建议结合临床，综合评估。',
    '建议增强扫描进一步明确。',
    '建议多学科会诊。',
  ];
  return pick(recs, rng);
}

function generateReports(exams, count, rng) {
  const reports = [];
  // Only generate reports for non-"书写中" exams
  const reportable = exams.filter(e => e.status !== '书写中');
  const shuffled = [...reportable].sort(() => rng() - 0.5);
  const toReport = shuffled.slice(0, count);

  for (let i = 0; i < toReport.length; i++) {
    const exam = toReport[i];
    const idx = i + 1;
    const reportId = 'GEN-RP-' + pad(idx, 6);

    const department = exam.department || '放射科';
    const findings = getFindingsByDept(department, rng);
    const impressionStr = getImpressionByDept(department, exam.modality, exam.bodyPart, rng);
    const recommendation = getRecommendations(impressionStr, rng);
    const isCritical = rng() < 0.05;

    // Report status based on exam status
    let reportStatus;
    let isPreliminary = false;
    let isAddendum = false;
    switch (exam.status) {
      case '已发布':
        reportStatus = '已发布';
        break;
      case '已签发':
        reportStatus = '已签发';
        break;
      case '审核中':
        reportStatus = pick(['初审中', '终审中'], rng);
        break;
      case '退回/修订':
        reportStatus = '修订中';
        break;
      default:
        reportStatus = '已发布';
    }

    const examDate = new Date(exam.examDate + 'T' + (exam.examTime || '08:00'));
    const reportCreated = new Date(examDate.getTime() + randInt(30, 360, rng) * 60000);

    const reportDoctorName = pick(RADIOLOGIST_NAMES, rng);
    const reportDoctorId = 'D' + pad(randInt(1, 75, rng), 3);

    let signedTime;
    if (reportStatus === '已签发' || reportStatus === '已发布') {
      signedTime = formatDateTime(new Date(reportCreated.getTime() + randInt(10, 120, rng) * 60000));
    }

    const report = {
      id: reportId,
      reportId,
      examId: exam.id,
      accessionNumber: exam.accessionNumber,
      patientId: exam.patientId,
      patientName: exam.patientName,
      gender: exam.gender,
      age: exam.age,
      patientType: exam.patientType,
      examItemName: exam.examItemName,
      modality: exam.modality,
      bodyPart: exam.bodyPart,
      examDate: exam.examDate,
      deviceName: exam.deviceName,
      clinicalHistory: exam.clinicalHistory || '',
      examFindings: findings,
      diagnosis: impressionStr,
      impression: impressionStr,
      recommendations: recommendation,
      criticalFinding: isCritical,
      criticalFindingDetails: isCritical ? '注意：' + impressionStr : '',
      reportDoctorId,
      reportDoctorName,
      signedTime,
      status: reportStatus,
      isPreliminary,
      isAddendum,
      publishedTime: reportStatus === '已发布' ? formatDateTime(new Date(reportCreated.getTime() + randInt(60, 720, rng) * 60000)) : undefined,
      publishedBy: reportStatus === '已发布' ? reportDoctorName : undefined,
      createdTime: formatDateTime(reportCreated),
      updatedTime: formatDateTime(new Date(reportCreated.getTime() + randInt(5, 120, rng) * 60000)),
      // Quality score
      qualityScore: Math.round(60 + rng() * 40),
    };

    // Audit fields for reviewed/published
    if (reportStatus === '已发布' || reportStatus === '已签发') {
      const auditorName = pick(RADIOLOGIST_NAMES.filter(n => n !== reportDoctorName), rng);
      report.auditorId = 'D' + pad(randInt(1, 75, rng), 3);
      report.auditorName = auditorName;
      report.approvedTime = formatDateTime(new Date(reportCreated.getTime() + randInt(120, 1440, rng) * 60000));
    }

    // RADS annotation
    if (exam.modality === '乳腺钼靶' || (exam.bodyPart && exam.bodyPart.includes('乳腺'))) {
      const radsScore = pick(['BI-RADS 1类', 'BI-RADS 2类', 'BI-RADS 3类', 'BI-RADS 4A类', 'BI-RADS 4B类', 'BI-RADS 4C类', 'BI-RADS 5类'], rng);
      report.radsScore = radsScore;
    } else if (exam.modality === 'MR' && exam.bodyPart && (exam.bodyPart.includes('肝') || exam.bodyPart === '腹部')) {
      report.radsScore = pick(['LI-RADS 1类', 'LI-RADS 2类', 'LI-RADS 3类', 'LI-RADS 4类', 'LI-RADS 5类'], rng);
    } else if (exam.modality === 'MR' && exam.bodyPart && (exam.bodyPart.includes('前列腺') || exam.bodyPart.includes('盆腔'))) {
      report.radsScore = pick(['PI-RADS 1分', 'PI-RADS 2分', 'PI-RADS 3分', 'PI-RADS 4分', 'PI-RADS 5分'], rng);
    } else if (exam.modality === 'CT' && exam.bodyPart && (exam.bodyPart.includes('肺') || exam.bodyPart.includes('胸部'))) {
      report.radsScore = pick(['Lung-RADS 1类', 'Lung-RADS 2类', 'Lung-RADS 3类', 'Lung-RADS 4A类', 'Lung-RADS 4B类'], rng);
    }

    reports.push(report);
  }

  return reports;
}

function countBy(arr, key) {
  const counts = {};
  arr.forEach(item => {
    const val = item[key];
    counts[val] = (counts[val] || 0) + 1;
  });
  return counts;
}

// ============ 执行 ============

const startTime = performance.now();
const rng = createRng(20240710);

console.error('\n=== 生成检查记录...');
const exams = generateExams(14000, rng);
console.error(`✓ 生成 ${exams.length} 条检查记录`);

console.error('\n=== 生成报告...');
const reports = generateReports(exams, 9000, rng);
console.error(`✓ 生成 ${reports.length} 份报告`);

const elapsed = ((performance.now() - startTime) / 1000).toFixed(3);

import { fileURLToPath } from 'url';
import path from 'path';
const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);
const outputPath = path.resolve(__dirname2, '../../src/data/generatedExamData.ts');

const output = `// G005-RIS v3.0 批量生成检查+报告数据
// 生成时间: ${new Date().toISOString()}
// 命令: node scripts/seed/01-generate-exams-reports.mjs

// ==================== 类型导入 ====================
import type { RadiologyExam } from '../types/index';
import type { RadiologyReport } from '../types/index';

export const GENERATED_EXAMS: RadiologyExam[] = ${JSON.stringify(exams, null, 2)};

export const GENERATED_REPORTS: RadiologyReport[] = ${JSON.stringify(reports, null, 2)};
`;

import('fs').then(fs => {
  fs.writeFileSync(outputPath, output, 'utf-8');
  const fileSize = (Buffer.byteLength(output, 'utf-8') / (1024 * 1024)).toFixed(2);

  console.error(`\n=== 生成统计 ===`);
  console.error(`生成检查: ${exams.length}`);
  console.error(`生成报告: ${reports.length}`);
  console.error(`输出文件: ${outputPath}`);
  console.error(`文件大小: ${fileSize} MB`);
  console.error(`运行时间: ${elapsed}s`);

  console.error(`\n--- 检查状态分布 ---`);
  const statusCount = countBy(exams, 'status');
  Object.entries(statusCount).sort().forEach(([k, v]) => {
    console.error(`  ${k}: ${v} (${(v/exams.length*100).toFixed(1)}%)`);
  });

  console.error(`\n--- 模态分布 ---`);
  const modCount = countBy(exams, 'modality');
  Object.entries(modCount).sort().forEach(([k, v]) => {
    console.error(`  ${k}: ${v} (${(v/exams.length*100).toFixed(1)}%)`);
  });

  console.error(`\n=== 生成完毕 ===`);
  console.error(`运行时间: ${elapsed}s`);
  console.error(`\n✓ 文件已写入: ${outputPath}`);
  console.log(`\n✓ 生成检查: ${exams.length}`);
  console.log(`✓ 生成报告: ${reports.length}`);
  console.log(`✓ 文件大小: ${fileSize} MB`);
  console.log(`✓ 运行时间: ${elapsed}s`);
});
