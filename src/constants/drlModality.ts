/**
 * [G005 v3.0.6.16-0] 诊断参考水平 (DRL) 可录入的检查模态
 *
 * 审查发现: `DRLManagement` 的核对流程原本只有 CT / MR 两个选项, 而诊断参考
 * 水平 (Diagnostic Reference Level) 本身就是为控制 X 线辐射剂量而建立的 ——
 * DR / MG / US / DSA 患者完全无法录入核对, 属功能缺失。
 */
export const DRL_MODALITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'CT', label: 'CT' },
  { value: 'MR', label: 'MR' },
  { value: 'DR', label: 'DR' },
  { value: 'MG', label: '乳腺钼靶' },
  { value: 'US', label: '超声' },
  { value: 'DSA', label: 'DSA' },
  { value: 'CBCT', label: 'CBCT' },
  { value: 'CR', label: 'CR' },
];
