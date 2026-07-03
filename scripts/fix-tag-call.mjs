import fs from 'node:fs';
const path = 'src/pages/dental/DentalBillingPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "render:(t:string)=>Tag({color:t==='甲类'?'green':t==='乙类'?'blue':'red'},t)";
const after = "render:(t:string)=><Tag color={t==='甲类'?'green':t==='乙类'?'blue':'red'}>{t}</Tag>";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('fixed');
} else {
  console.log('not found');
}
