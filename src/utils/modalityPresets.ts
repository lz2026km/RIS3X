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
      { name: '脑窗', ww: 80, wl: 40 },
      { name: '软组织', ww: 400, wl: 40 },
      { name: '心脏窗', ww: 350, wl: 50 },
      { name: '肝脏增强窗', ww: 200, wl: 60 },
      { name: '眼眶窗', ww: 300, wl: 50 },
      { name: '血管窗', ww: 600, wl: 200 },
    ];
  }
  if (modality === 'MR') {
    return [
      { name: 'T1', ww: 800, wl: 400 },
      { name: 'T2', ww: 1500, wl: 750 },
      { name: 'FLAIR', ww: 1500, wl: 750 },
      { name: 'DWI', ww: 1500, wl: 750 },
    ];
  }
  if (modality === 'DR' || modality === 'XR') {
    return [
      { name: 'DR 胸片', ww: 2500, wl: 1250 },
      { name: 'DR 骨窗', ww: 2000, wl: 500 },
      { name: 'DR 腹部', ww: 1800, wl: 900 },
    ];
  }
  if (modality === 'MG') {
    return [
      { name: 'MG 乳腺', ww: 2500, wl: 1250 },
    ];
  }
  if (modality === 'US') {
    return [
      { name: 'US 腹部', ww: 255, wl: 128 },
    ];
  }
  if (modality === 'PT') {
    return [
      { name: 'PET 默认', ww: 5000, wl: 2500 },
    ];
  }
  if (modality === 'CBCT') {
    return [
      { name: 'CBCT 骨窗', ww: 2500, wl: 1200 },
      { name: 'CBCT 软组织', ww: 800, wl: 400 },
    ];
  }
  if (modality === 'XA' || modality === 'DSA') {
    return [
      { name: '血管窗', ww: 600, wl: 200 },
    ];
  }
  return [
    { name: '骨窗', ww: 2000, wl: 400 },
    { name: '软组织', ww: 400, wl: 40 },
    { name: '肺窗', ww: 1500, wl: -600 },
  ];
}

export const CT_DEFAULT_WW = 400;
export const CT_DEFAULT_WL = 40;
export const FUSION_CT_WW = 1200;
export const FUSION_CT_WL = 400;
export const FUSION_PET_WW = 800;
export const FUSION_PET_WL = 200;
export const MR_DEFAULT_WW = 800;
export const MR_DEFAULT_WL = 400;
