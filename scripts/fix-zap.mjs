import fs from 'node:fs';
const path = 'src/pages/NotificationCenter.tsx';
let text = fs.readFileSync(path, 'utf8');
// 用更稳的 anchor: ", Zap\n}" -> "}\n"  (匹配第二行末尾的 Zap)
const before = 'BarChart3, Zap\n}';
const after = 'BarChart3\n}';
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('fixed');
} else {
  console.log('anchor not found, try BarChart3, Zap');
  const re = /BarChart3, Zap/;
  if (re.test(text)) {
    text = text.replace(re, 'BarChart3');
    fs.writeFileSync(path, text, 'utf8');
    console.log('replaced via regex');
  }
}
