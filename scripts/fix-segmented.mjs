import fs from 'node:fs';
const path = 'src/pages/dental/DentalSchedulePage.tsx';
let text = fs.readFileSync(path, 'utf8');
const before = "import { Card, Space, Tag, Button, Select, Row, Col, Statistic, message, Tabs, Table, Modal, Form, Input, InputNumber, DatePicker, Badge, Empty } from 'antd';";
const after = "import { Card, Space, Tag, Button, Select, Row, Col, Statistic, message, Tabs, Table, Modal, Form, Input, InputNumber, DatePicker, Badge, Empty, Segmented } from 'antd';";
if (text.includes(before)) {
  text = text.replace(before, after);
  fs.writeFileSync(path, text, 'utf8');
  console.log('fixed');
} else { console.log('not found'); }
