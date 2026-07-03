import fs from 'node:fs';
const path = 'src/components/eye/GradingScalePicker.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "        options={scale.options.map((o) => ({\r\n          value: o.grade,\r\n          label: `${o.label} — ${o.description.substring(0, 30)}`,\r\n        }))}";
const after = "        labelInValue\r\n        options={scale.options.map((o) => ({\r\n          value: { value: o.grade, label: `${o.label} — ${o.description.substring(0, 30)}` },\r\n          label: `${o.label} — ${o.description.substring(0, 30)}`,\r\n        }))}";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
