import fs from 'node:fs';
const path = 'src/pages/integration/FhirServerPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "<Tag color=\"green\">{capability.status}</Tag>";
const after = "<Tag color=\"green\">{({active:'活跃', draft:'草稿', retired:'已停用'} as any)[capability.status] ?? capability.status}</Tag>";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
