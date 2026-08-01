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

// Map of broken partial strings to their correct forms
const fixes = [
  // Dental pages
  ["'已创建外科手);", "'已创建外科手术');"],
  ["'已创建修复治);", "'已创建修复治疗');"],
  ["'加载?..", "'加载中.."],
  ["'患?,", "'患者',"],
  ["'状?,", "'状态',"],
  ["'患?ID", "'患者ID"],
  ["label=\"? name=", "label=\"面\" name="],
  ["label=\"患?ID", "label=\"患者ID"],
  ["'已保?);", "'已保存');"],
  ["'加载中..", "'加载中..'"],
  ["title='患?,", "title='患者',"],
  ["title='状?,", "title='状态',"],
  ["title='牙?,", "title='牙位',"],
  ["title='?,", "title='面',"],
  ["'已创建正畸计);", "'已创建正畸计划');"],
  ["'已提交会诊意);", "'已提交会诊意见');"],
  ["'已提交会诊意);", "'已提交会诊意见');"],
  ["'已发送');", "'已发送');"],
  ["'会诊意见已发);", "'会诊意见已发送');"],
  ["'已保?);", "'已保存');"],
  ["'已识别 ", "'已识别 "],
  ["'请先选择 AI 文本并输入改写指);", "'请先选择 AI 文本并输入改写指令');"],
];

let totalFixed = 0;
for (const file of walkDir(ROOT)) {
  let content = readFileSync(file, 'utf-8');
  const original = content;
  
  // Apply specific fixes
  for (const [pattern, replacement] of fixes) {
    content = content.split(pattern).join(replacement);
  }
  
  // Generic fix: Chinese char followed by ) or ; with missing closing quote
  // Pattern: 已创建外科手) -> 已创建外科手术)
  content = content.replace(/([\u4e00-\u9fff])\)([;,])/g, '$1"$2');
  content = content.replace(/([\u4e00-\u9fff])\)/g, '$1"');
  
  // Fix: '已提?, -> '已提交',
  content = content.replace(/([\u4e00-\u9fff])\?,/g, '$1交\',');
  content = content.replace(/([\u4e00-\u9fff])\?'/g, '$1\'');
  
  if (content !== original) {
    writeFileSync(file, content, 'utf-8');
    console.log(`Fixed: ${file}`);
    totalFixed++;
  }
}
console.log(`\nTotal files fixed: ${totalFixed}`);
