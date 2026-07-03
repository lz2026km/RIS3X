import fs from 'node:fs';
import path from 'node:path';

const REPO_STATUS_MAP = {
  draft: '草稿',
  submitted: '已提交',
  reviewed: '已审核',
  cosigned: '已会签',
  published: '已发布',
  rejected: '已驳回',
  revised: '已修订',
  active: '活跃',
  inactive: '停用',
  routine: '常规',
  stat: '加急',
  moderate: '中度',
  minor: '轻度',
  severe: '严重',
  major: '重大',
  critical: '危急',
  pending: '待处理',
  inProgress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  // eye
  oct_a: 'OCTA',
  oct: 'OCT',
  ffa: 'FFA',
  fundus_photo: '眼底照相',
  corneal_endothelium: '角膜内皮',
  borderline: '临界',
  productivity: '生产力',
  v3_0_6_0: 'v3.0.6.0',
  v6: 'v6',
  cup_to_disc_ratio: '杯盘比',
  rim_width: '视盘缘宽度',
  text: '文本',
  findings_multi: '多发发现',
  pcs: '件',
  tube: '支',
  set: '套',
  box: '盒',
  // eye cases
  critical_value: '危急值',
  // user
  admin: '管理员',
  zhang: '张',
  li: '李',
  wang: '王',
  zhao: '赵',
  // dictionary
  lwnctps: '颅脑CT平扫',
  lwnctzq: '颅脑CT增强',
  xbctps: '胸部CT平扫',
  xbctzq: '胸部CT增强',
  tlcta: '头颅CTA',
  description: '描述',
  terminology: '术语',
};

// 找所有 *.tsx 里包含 STATUS_CONFIG 的文件
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk('src').filter(f => /STATUS_CONFIG|status.*config|STATUS_COLORS|StatusStyle|statusConfig/i.test(fs.readFileSync(f, 'utf8')));
console.log('files:', files.length);
for (const f of files.slice(0, 5)) console.log(' -', f);
