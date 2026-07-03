import fs from 'node:fs';
import path from 'node:path';

const ALL = {
  oct_a: "OCTA", corneal_endothelium: "角膜内皮", tear_film: "泪膜",
  fundus_autofluorescence: "眼底自发荧光", borderline: "临界",
  cup_to_disc_ratio: "杯盘比", rim_width: "视盘缘宽度",
  arteriovenous_ratio: "动静脉比", abnormal: "异常", v6: "v6",
  text: "文本", findings_multi: "多发发现", images: "图像",
  productivity: "生产力", clinical: "临床", operational: "运营",
  financial: "财务", critical_value: "危急值", pending_review: "待审核",
  reviewing: "审核中", published: "已发布", amended: "已修改",
  printed: "已打印", draft: "草稿",
};

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const files = walk('src/pages/eye');
let totalAdds = 0;
for (const f of files) {
  let text = fs.readFileSync(f, 'utf8');
  // 找任何 "xxxLabels: Record<string, string> = {" 字典
  const re = /(\w+Labels\w*):\s*Record<string,\s*string>\s*=\s*\{/g;
  let m;
  let modified = false;
  while ((m = re.exec(text)) !== null) {
    let depth = 1;
    let j = m.index + m[0].length;
    const start = m.index + m[0].length;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    const end = j;
    const body = text.slice(start, end - 1);
    const existing = new Set();
    const re2 = /\b([a-zA-Z_][a-zA-Z0-9_]*):/g;
    let m2;
    while ((m2 = re2.exec(body)) !== null) existing.add(m2[1]);
    const adds = [];
    for (const [k, v] of Object.entries(ALL)) {
      if (!existing.has(k)) adds.push('  ' + k + ': "' + v + '",');
    }
    if (adds.length > 0) {
      text = text.slice(0, end - 1) + adds.join('\n') + '\n' + text.slice(end - 1);
      totalAdds += adds.length;
      modified = true;
    }
  }
  if (modified) fs.writeFileSync(f, text, 'utf8');
}
console.log('total adds:', totalAdds);
