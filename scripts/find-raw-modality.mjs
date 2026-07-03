import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const files = walk('src/pages/eye');
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  // 找 <Tag ...>{v}</Tag> 或 <Tag>{v}</Tag> (modality 渲染)
  if (/<Tag[^>]*>\{v\}<\/Tag>/.test(text) || /<Tag[^>]*>\{e\.modality\}<\/Tag>/.test(text) || /<Tag[^>]*>\{modality\}<\/Tag>/.test(text) || /<Tag[^>]*>\{item\.modality\}<\/Tag>/.test(text)) {
    console.log(f, 'has raw modality <Tag>');
  }
  // 找 .modality 直接显示
  if (/\{[a-z]+\.modality\}/.test(text) && !/MODALITY_LABELS/.test(text.slice(0, text.indexOf('.modality}')))) {
    console.log(f, 'has raw {x.modality}');
  }
}
