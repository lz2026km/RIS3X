import fs from 'node:fs';
const path = 'src/components/eye/MeasurementPanel.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "{r.interpretation}";
const after = "{({ normal: '正常', borderline: '临界', abnormal: '异常', critical: '危急' } as any)[r.interpretation] || r.interpretation}";
if (text.includes(before)) {
  text = text.replace(before, after, 1);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
