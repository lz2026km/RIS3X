import fs from 'node:fs';
const path = 'src/components/eye/MeasurementPanel.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "        {\r\n          title: \"方法\",\r\n          dataIndex: \"method\",\r\n          key: \"method\",\r\n          width: 80,\r\n          ellipsis: true,\r\n        },";
const after = "        {\r\n          title: \"类型\",\r\n          dataIndex: \"type\",\r\n          key: \"type\",\r\n          width: 100,\r\n        },";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('done');
} else { console.log('not found'); }
