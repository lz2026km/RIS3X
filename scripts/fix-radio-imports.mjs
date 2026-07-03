import fs from 'node:fs';
const files = [
  'src/pages/eye/tele/TeleConsultPage.tsx',
  'src/pages/eye/edu/CaseLibraryPage.tsx',
];
for (const path of files) {
  let text = fs.readFileSync(path, 'utf8');
  // 在 lucide-react import 块里把 Radio 改为 RadioIcon
  // 找 "} from 'lucide-react';" 之前那一行
  const re = /(import\s*\{[^}]*\bRadio\b[^}]*\}\s*from\s*['"]lucide-react['"];?)/g;
  text = text.replace(re, (match) => {
    return match.replace(/\bRadio\b/g, 'RadioIcon');
  });
  fs.writeFileSync(path, text, 'utf8');
  console.log(path, 'patched');
}
