import fs from 'node:fs';
const path = 'src/pages/CoSignPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "{it.priority}\n                    </span>";
const after = "{it.priority === 'stat' ? '加急' : it.priority === 'urgent' ? '紧急' : it.priority === 'routine' ? '常规' : it.priority}\n                    </span>";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('fixed');
} else { console.log('not found'); }
