import fs from 'node:fs';
const path = 'src/pages/ExamPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "  已预约: { color: \"#64748b\", bg: \"#f1f5f9\", label: \"已预约\" },\n};\n\n// 设备类型";
const after = "  已预约: { color: \"#64748b\", bg: \"#f1f5f9\", label: \"已预约\" },\n  // [audit-fix-2026-07-02] 报告状态 (mock backend 错误写入 exam.status)\n  draft: { color: \"#94a3b8\", bg: \"#f1f5f9\", label: \"草稿\" },\n  submitted: { color: \"#d1fae5\", bg: \"#059669\", label: \"已提交\" },\n  reviewed: { color: \"#ecfdf5\", bg: \"#047857\", label: \"已审核\" },\n  cosigned: { color: \"#dbeafe\", bg: \"#2563eb\", label: \"已会签\" },\n  published: { color: \"#ecfdf5\", bg: \"#047857\", label: \"已发布\" },\n  rejected: { color: \"#fee2e2\", bg: \"#dc2626\", label: \"已驳回\" },\n  revised: { color: \"#fef3c7\", bg: \"#f59e0b\", label: \"已修订\" },\n};\n\n// 设备类型";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('fixed');
} else { console.log('not found, look for 已预约'); for (const l of text.split('\n').slice(40, 60)) console.log(' |', l); }
