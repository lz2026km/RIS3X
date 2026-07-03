import fs from 'node:fs';
const path = 'src/pages/dental/DentalSchedulePage.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "<Tag style={{fontSize:10,margin:0}} color={chairColors[c.status]}>{c.status}</Tag>";
const after = "<Tag style={{fontSize:10,margin:0}} color={chairColors[c.status]}>{({online:'在线', offline:'离线', maintenance:'维护中'} as any)[c.status] || c.status}</Tag>";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
