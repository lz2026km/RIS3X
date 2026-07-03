import fs from 'node:fs';
import path from 'node:path';

const MODALITY_ADDITIONS = {
  oct_a: "OCTA",
  corneal_endothelium: "角膜内皮",
  tear_film: "泪膜",
  fundus_autofluorescence: "眼底自发荧光",
  borderline: "临界",
  cup_to_disc_ratio: "杯盘比",
  rim_width: "视盘缘宽度",
  arteriovenous_ratio: "动静脉比",
  abnormal: "异常",
  v6: "v6",
  text: "文本",
  findings_multi: "多发发现",
  images: "图像",
  productivity: "生产力",
  clinical: "临床",
  operational: "运营",
  financial: "财务",
  critical_value: "危急值",
  pending_review: "待审核",
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
let count = 0;
for (const f of files) {
  let text = fs.readFileSync(f, 'utf8');
  // 找 MODALITY_LABELS / CATEGORY_LABELS / TYPE_LABELS 字典
  for (const key of ['MODALITY_LABELS', 'CATEGORY_LABELS', 'LABELS', 'DICT']) {
    const re = new RegExp('(const ' + key + '[^=]*=\\s*\\{)', 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      // 找这个 dict 的结束 }
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
      // 收集已有 keys
      const existing = new Set();
      const re2 = /\b([a-zA-Z_][a-zA-Z0-9_]*):/g;
      let m2;
      while ((m2 = re2.exec(body)) !== null) existing.add(m2[1]);
      // 追加缺失
      const adds = [];
      for (const [k, v] of Object.entries(MODALITY_ADDITIONS)) {
        if (!existing.has(k)) adds.push('  ' + k + ': "' + v + '",');
      }
      if (adds.length > 0) {
        text = text.slice(0, end - 1) + adds.join('\n') + '\n' + text.slice(end - 1);
        console.log(f, '+' + key, 'adds', adds.length);
        count++;
        break; // 只处理一个 dict
      }
    }
  }
  fs.writeFileSync(f, text, 'utf8');
}
console.log('files modified:', count);
