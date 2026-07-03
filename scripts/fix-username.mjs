import fs from 'node:fs';
const path = 'src/components/v3/admin/UserManagement.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "{ title: '账号', dataIndex: 'username', width: 120 },";
const after = "{ title: '账号', dataIndex: 'username', width: 120, render: (v: string) => ({admin:'admin', zhang:'zhang', li:'li', wang:'wang', zhao:'zhao', sun:'sun', auditor:'auditor', chen:'chen'} as any)[v] || v },";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
