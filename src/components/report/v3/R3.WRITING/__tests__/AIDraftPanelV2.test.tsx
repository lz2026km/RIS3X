import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AIDraftPanelV2 } from '../AIDraftPanelV2';

describe('AIDraftPanelV2', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <AIDraftPanelV2 reportId="rep-1" patientId="P001" examId="EXAM-1" modality="CT" bodyPart="胸部" clinicalInfo="咳嗽两周" />
    );
    expect(container).toBeTruthy();
  });

  it('renders the three capability sections', () => {
    render(
      <AIDraftPanelV2 modality="MR" bodyPart="头颅" findingsText="双侧大脑半球对称，未见明显异常。" />
    );
    expect(screen.getByText('AI 报告助理 V2')).toBeInTheDocument();
    expect(screen.getByText('结构化字段提取')).toBeInTheDocument();
    expect(screen.getByText('AI 报告草稿')).toBeInTheDocument();
    expect(screen.getByText('修改建议')).toBeInTheDocument();
  });

  it('renders section action buttons', () => {
    render(<AIDraftPanelV2 modality="DR" bodyPart="胸部" />);
    expect(screen.getByText('自动提取字段')).toBeInTheDocument();
    expect(screen.getByText('一键生成草稿')).toBeInTheDocument();
    expect(screen.getByText('分析修改建议')).toBeInTheDocument();
  });
});
