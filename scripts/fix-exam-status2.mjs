import fs from 'node:fs';
const path = 'src/pages/ExamPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const target = '已预约: { color: "#64748b", bg: "#f1f5f9", label: "已预约" },';
const idx = text.indexOf(target);
if (idx < 0) { console.log('not found'); process.exit(1); }
const after = target + "\n  // [audit-fix-2026-07-02] 报告状态 (mock backend 错误写入 exam.status)\n  draft: { color: \"#94a3b8\", bg: \"#f1f5f9\", label: \"草稿\" },\n  submitted: { color: \"#d1fae5\", bg: \"#059669\", label: \"已提交\" },\n  reviewed: { color: \"#ecfdf5\", bg: \"#047857\", label: \"已审核\" },\n  cosigned: { color: \"#dbeafe\", bg: \"#2563eb\", label: \"已会签\" },\n  published: { color: \"#ecfdf5\", bg: \"#047857\", label: \"已发布\" },\n  rejected: { color: \"#fee2e2\", bg: \"#dc2626\", label: \"已驳回\" },\n  revised: { color: \"#fef3c7\", bg: \"#f59e0b\", label: \"已修订\" },";
text = text.replace(target, after);
fs.writeFileSync(path, text, 'utf8');
console.log('fixed');
