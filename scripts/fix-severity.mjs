import fs from 'node:fs';
const path = 'src/pages/safety/AdverseEventPage.tsx';
let text = fs.readFileSync(path, 'utf8');
// 1. 加 SEVERITY_LABELS
const labels = "\nconst SEVERITY_LABELS: Record<EventSeverity, string> = {\n  'near-miss': '险情',\n  minor: '轻微',\n  moderate: '中度',\n  severe: '严重',\n  catastrophic: '灾难性',\n};\n";
const anchor = "const CATEGORY_LABELS: Record<EventCategory, string> = {";
if (text.includes(anchor) && !text.includes('SEVERITY_LABELS')) {
  text = text.replace(anchor, labels + anchor);
}
// 2. 改下拉
text = text.replace("{Object.entries(SEVERITY_COLORS).map(([k]) => <option key={k} value={k}>{k}</option>)}", "{Object.entries(SEVERITY_COLORS).map(([k]) => <option key={k} value={k}>{SEVERITY_LABELS[k as EventSeverity] ?? k}</option>)}");
// 3. 改 badge
text = text.replace("background: `${SEVERITY_COLORS[e.severity]}20`, color: SEVERITY_COLORS[e.severity] }}>{e.severity}</span>", "background: `${SEVERITY_COLORS[e.severity]}20`, color: SEVERITY_COLORS[e.severity] }}>{SEVERITY_LABELS[e.severity] ?? e.severity}</span>");
fs.writeFileSync(path, text, 'utf8');
console.log('done');
