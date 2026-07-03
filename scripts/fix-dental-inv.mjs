import fs from 'node:fs';
const path = 'src/pages/dental/DentalAllPages.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "{ title: '单位', dataIndex: 'unit' },";
const after = "{ title: '单位', dataIndex: 'unit', render: (u: string) => ({ pcs: '件', tube: '支', set: '套', box: '盒', ml: '毫升', g: '克' } as any)[u] || u },";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
