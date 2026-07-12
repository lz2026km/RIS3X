import React, { useState, useEffect } from 'react';
import { DentalPageLayout, DentalTreatmentTable } from './DentalShared';
import type { DentalTreatment } from './DentalShared';

export const DentalTreatmentPage: React.FC = () => {
  const [items, setItems] = useState<DentalTreatment[]>([]);
  useEffect(() => {
    fetch('/api/v1/dental/treatments').then(r => r.json()).then(d => { if (d.success) setItems(d.data); }).catch(() => setItems([]));
  }, []);
  return (
    <DentalPageLayout header={{ title: '口腔治疗中心' }}>
      <DentalTreatmentTable data={items} />
    </DentalPageLayout>
  );
};

export default DentalTreatmentPage;
