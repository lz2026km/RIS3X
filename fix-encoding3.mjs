import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'src';

function walkDir(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...walkDir(full));
    else if (/\.(tsx?|json)$/.test(extname(full))) files.push(full);
  }
  return files;
}

// Known broken patterns -> correct Chinese text
const knownFixes = {
  '裂隙�?': '裂隙灯',
  '角膜地形�?': '角膜地形图',
  '角膜内皮�?': '角膜内皮镜',
  '已归�?': '已归档',
  '已发�?': '已发布',
  '待审�?': '待审核',
  '危急�?': '危急值',
  '已添�?': '已添加',
  '已导�?': '已导出',
  '队列筛�?': '队列筛选',
  '已保�?': '已保存',
  '已完�?': '已完成',
  '进行�?': '进行中',
  '患�?': '患者',
  '模�?': '模态',
  '内容�?': '内容数',
  '黄斑变�?': '黄斑变性',
  '青光�?': '青光眼',
  '白内�?': '白内障',
  '已签�?': '已签发',
  '已审�?': '已审核',
  '已提�?': '已提交',
  '已驳�?': '已驳回',
  '已修�?': '已修改',
  '已识�?': '已识别',
  '请先�?': '请先',
  '改写指�?': '改写指令',
  '会诊意': '会诊意见',
  '已发送': '已发送',
  '会诊会话已建�?': '会诊会话已建立',
  '录音�?': '录音中',
  '开始录�?': '开始录音',
  '术语�?': '术语库',
  '状态: ': '状态: ',
  '影像模�?': '影像模态',
  '老年黄斑变�?': '老年黄斑变性',
  '请评估该眼底彩照�?': '请评估该眼底彩照',
  'DR 分级�?': 'DR 分级和',
  '患?ID': '患者ID',
  '加载?..': '加载中..',
  '已创建修复治': '已创建修复治疗',
  '已创建外科手': '已创建外科手术',
  '已创建正畸计': '已创建正畸计划',
  '已提交会诊意': '已提交会诊意见',
};

let totalFixed = 0;
for (const file of walkDir(ROOT)) {
  let content = readFileSync(file, 'utf-8');
  const original = content;
  
  // Apply known fixes
  for (const [broken, correct] of Object.entries(knownFixes)) {
    content = content.split(broken).join(correct);
  }
  
  // Remove remaining U+FFFD characters
  content = content.replace(/\uFFFD/g, '');
  
  if (content !== original) {
    writeFileSync(file, content, 'utf-8');
    totalFixed++;
  }
}
console.log(`Fixed ${totalFixed} files`);
