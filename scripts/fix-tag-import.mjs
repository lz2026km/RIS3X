import fs from 'node:fs';
const path = 'src/pages/eye/edu/CaseLibraryPage.tsx';
let text = fs.readFileSync(path, 'utf8');
// 把 lucide 的 Tag 改名 (因为 antd Tag 在用)
const re = /(import\s*\{[^}]*\bTag\b[^}]*\}\s*from\s*['"]lucide-react['"];?)/g;
text = text.replace(re, (match) => match.replace(/\bTag\b/g, 'TagIcon'));
fs.writeFileSync(path, text, 'utf8');
console.log('patched');
