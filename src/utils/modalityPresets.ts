import { WINDOW_PRESETS_LIST, WINDOW_PRESETS_DETAILED } from '../services/dicomWeb';

export interface SimpleWindowPreset {
  name: string;
  ww: number;
  wl: number;
}

export function getPresetsForModality(modality: string): SimpleWindowPreset[] {
  const list = WINDOW_PRESETS_LIST.filter(p => p.modality.includes(modality));
  if (list.length > 0) {
    return list.map(p => ({ name: p.description, ww: p.ww, wl: p.wc }));
  }
  if (modality === 'CT') {
    return [
      { name: '肺窗', ww: 1500, wl: -600 },
      { name: '纵隔窗', ww: 400, wl: 40 },
      { name: '骨窗', ww: 2000, wl: 400 },
    ];
  }
  if (modality === 'MR') {
    return [
      { name: 'T1', ww: WINDOW_PRESETS_DETAILED.MR_T1.ww, wl: WINDOW_PRESETS_DETAILED.MR_T1.wc },
      { name: 'T2', ww: WINDOW_PRESETS_DETAILED.MR_T2.ww, wl: WINDOW_PRESETS_DETAILED.MR_T2.wc },
      { name: 'FLAIR', ww: WINDOW_PRESETS_DETAILED.MR_FLAIR.ww, wl: WINDOW_PRESETS_DETAILED.MR_FLAIR.wc },
    ];
  }
  if (modality === 'DR') {
    return [
      { name: 'DR 胸片', ww: WINDOW_PRESETS_DETAILED.DR_CHEST.ww, wl: WINDOW_PRESETS_DETAILED.DR_CHEST.wc },
      { name: 'DR 骨窗', ww: WINDOW_PRESETS_DETAILED.DR_BONE.ww, wl: WINDOW_PRESETS_DETAILED.DR_BONE.wc },
    ];
  }
  if (modality === 'MG') {
    return [
      { name: 'MG 乳腺', ww: WINDOW_PRESETS_DETAILED.MG_DEFAULT.ww, wl: WINDOW_PRESETS_DETAILED.MG_DEFAULT.wc },
    ];
  }
  if (modality === 'US') {
    return [
      { name: 'US 腹部', ww: WINDOW_PRESETS_DETAILED.US_DEFAULT.ww, wl: WINDOW_PRESETS_DETAILED.US_DEFAULT.wc },
    ];
  }
  if (modality === 'PT') {
    return [
      { name: 'PET 默认', ww: WINDOW_PRESETS_DETAILED.PT_DEFAULT.ww, wl: WINDOW_PRESETS_DETAILED.PT_DEFAULT.wc },
    ];
  }
  return [
    { name: '骨窗', ww: 2000, wl: 400 },
    { name: '软组织', ww: 400, wl: 40 },
  ];
}
