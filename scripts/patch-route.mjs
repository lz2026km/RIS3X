import fs from 'node:fs';
const path = 'src/routes/routeTable.tsx';
let text = fs.readFileSync(path, 'utf8');
const lines = text.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('wrapped("/workbench"') && lines[i].includes('HomePage')) {
    console.log('line', i+1, JSON.stringify(lines[i].slice(0, 80)));
    // insert after
    lines.splice(i+1, 0, '  wrapped("/worklist", React.createElement(WorklistPage)), // [audit-fix-2026-07-02]');
    console.log('inserted at line', i+2);
    break;
  }
}
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('done');
