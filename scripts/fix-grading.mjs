import fs from 'node:fs';
const path = 'src/components/eye/GradingScalePicker.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "<Select\n        value={value || undefined}\n        onChange={onChange}\n        placeholder=\"选择分级\"\n        style={{ width: 200 }}";
const after = "<Select\n        value={value || undefined}\n        onChange={onChange}\n        placeholder=\"选择分级\"\n        style={{ width: 200 }}\n        optionLabelProp=\"label\"";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
