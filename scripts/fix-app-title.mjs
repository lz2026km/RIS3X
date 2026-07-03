import fs from 'node:fs';
const path = 'src/i18n/appI18n.ts';
let text = fs.readFileSync(path, 'utf8');
const before = text;
text = text.replace('"app.title": "005放射信息系统"', '"app.title": "G005放射信息系统"');
text = text.replace('"app.title": "005 Radiology Information System"', '"app.title": "G005 Radiology Information System"');
fs.writeFileSync(path, text, 'utf8');
console.log('changed:', before !== text);
