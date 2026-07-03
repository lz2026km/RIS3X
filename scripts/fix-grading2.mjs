import fs from 'node:fs';
const path = 'src/components/eye/GradingScalePicker.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "        options={scale.options.map((o) => ({\n          value: o.grade,\n          label: `${o.label} — ${o.description.substring(0, 30)}`,\n        }))}";
const after = "        labelInValue\n        options={scale.options.map((o) => ({\n          value: { value: o.grade, label: `${o.label} — ${o.description.substring(0, 30)}` },\n          label: `${o.label} — ${o.description.substring(0, 30)}`,\n        }))}";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
