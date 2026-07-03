import fs from 'node:fs';
const path = 'src/pages/DefectManagementPage.tsx';
let text = fs.readFileSync(path, 'utf8');
// 加 CATEGORY_LABELS lookup
const labels = "const CATEGORY_LABELS: Record<string, string> = { description: '描述缺陷', terminology: '术语缺陷', format: '格式缺陷', logic: '逻辑缺陷', critical: '严重缺陷', completeness: '完整性缺陷' };\n\n";
const before2 = "const [severity, setSeverity] = useState<SeverityFilter>('all')";
if (text.includes(before2)) {
  text = text.replace(before2, labels + before2);
}
// 替换两处 (d as ...).category 用 lookup
text = text.replace("(d as { category: DefectCategory }).category", "CATEGORY_LABELS[(d as { category: DefectCategory }).category] ?? (d as { category: DefectCategory }).category");
text = text.replace("stats.byCategory).map(([cat, count]) =>", "stats.byCategory).map(([cat, count]) =>");
text = text.replace("{cat}", "{CATEGORY_LABELS[cat] ?? cat}");
fs.writeFileSync(path, text, 'utf8');
console.log('done');
