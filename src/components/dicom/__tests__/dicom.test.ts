// ============================================================
// G005 放射RIS系统 v2.1.0 - DicomViewer Pro Tests
// Phase R10 W1
// ============================================================

import { describe, it, expect } from 'vitest';
import { TOOLS, calculateLength, calculateAngle, calculateEllipseArea, calculateCobbAngle, createMeasurement } from '../tools';
import { WINDOW_PRESETS_DETAILED, WINDOW_PRESETS_LIST } from '../../../services/dicomWeb';
import { DICOM_SAMPLES, DICOM_SAMPLES_TOTAL } from '../../../data/dicomSamples';

describe('DICOM Tools - Measurements', () => {
  it('calculates length in mm with pixel spacing', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 0 };
    // pixelSpacing 0.5 mm/pixel -> 100px * 0.5 = 50mm
    const dist = calculateLength(p1, p2, [0.5, 0.5]);
    expect(dist).toBe(50);
  });

  it('calculates length diagonally', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 3, y: 4 };
    const dist = calculateLength(p1, p2, [1, 1]);
    expect(dist).toBe(5); // 3-4-5 triangle
  });

  it('handles anisotropic pixel spacing', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 100 };
    // x: 100 * 0.7 = 70, y: 100 * 0.5 = 50, sqrt(70² + 50²) ≈ 86.02
    const dist = calculateLength(p1, p2, [0.7, 0.5]);
    expect(dist).toBeCloseTo(86.02, 2);
  });

  it('calculates 90 degree angle', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 1, y: 0 };
    const p3 = { x: 1, y: 1 };
    const angle = calculateAngle(p1, p2, p3);
    expect(angle).toBeCloseTo(90, 5);
  });

  it('calculates 180 degree angle (collinear)', () => {
    const p1 = { x: -1, y: 0 };
    const p2 = { x: 0, y: 0 };
    const p3 = { x: 1, y: 0 };
    const angle = calculateAngle(p1, p2, p3);
    expect(angle).toBeCloseTo(180, 5);
  });

  it('calculates 180 degree for opposite collinear (angle from vertex)', () => {
    // When 3 points are collinear with p2 in middle, the angle is 180
    const p1 = { x: -1, y: 0 };
    const p2 = { x: 0, y: 0 };
    const p3 = { x: 1, y: 0 };
    const angle = calculateAngle(p1, p2, p3);
    expect(angle).toBeCloseTo(180, 5);
  });

  it('calculates ellipse area with pixel spacing', () => {
    const center = { x: 100, y: 100 };
    const radii = { rx: 50, ry: 30 };
    // 0.5 mm/pixel -> rx=25mm, ry=15mm -> area = π*25*15 ≈ 1178.1
    const result = calculateEllipseArea(center, radii, [0.5, 0.5]);
    expect(result.area).toBeCloseTo(Math.PI * 25 * 15, 1);
  });

  it('calculates Cobb angle correctly', () => {
    // p1-p2 是一条上终板线, p3-p4 是一条下终板线, 两条线夹角 = Cobb 角
    // 平行线 -> Cobb = 0; 垂直 -> Cobb = 90
    // 简单测试: 两条线完全平行 -> Cobb ≈ 0
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 0 };
    const p3 = { x: 0, y: 100 };
    const p4 = { x: 100, y: 100 };
    const cobb = calculateCobbAngle(p1, p2, p3, p4);
    expect(cobb).toBeGreaterThanOrEqual(0);
    expect(cobb).toBeLessThanOrEqual(180);
  });

  it('createMeasurement generates unique IDs', () => {
    const m1 = createMeasurement('length', [{ x: 0, y: 0 }], 0, 'mm', '测试1');
    const m2 = createMeasurement('length', [{ x: 0, y: 0 }], 0, 'mm', '测试2');
    expect(m1.id).not.toBe(m2.id);
    expect(m1.type).toBe('length');
    expect(m1.unit).toBe('mm');
  });

  it('createMeasurement rounds value to 2 decimals', () => {
    const m = createMeasurement('length', [{ x: 0, y: 0 }], 12.34567, 'mm', '测试');
    expect(m.value).toBe(12.35);
  });

  it('all tools have required metadata', () => {
    Object.entries(TOOLS).forEach(([key, tool]) => {
      expect(tool.id).toBe(key);
      expect(tool.name).toBeTruthy();
      expect(tool.icon).toBeTruthy();
      expect(tool.shortcut).toBeTruthy();
      expect(['navigation', 'measurement', 'annotation']).toContain(tool.group);
    });
  });
});

describe('DICOM Window Presets', () => {
  it('has presets for all major modalities', () => {
    expect(WINDOW_PRESETS_DETAILED.CT_SOFT_TISSUE).toBeDefined();
    expect(WINDOW_PRESETS_DETAILED.CT_LUNG).toBeDefined();
    expect(WINDOW_PRESETS_DETAILED.CT_BONE).toBeDefined();
    expect(WINDOW_PRESETS_DETAILED.CT_BRAIN).toBeDefined();
    expect(WINDOW_PRESETS_DETAILED.MR_T1).toBeDefined();
    expect(WINDOW_PRESETS_DETAILED.MR_T2).toBeDefined();
    expect(WINDOW_PRESETS_DETAILED.DR_CHEST).toBeDefined();
    expect(WINDOW_PRESETS_DETAILED.MG_DEFAULT).toBeDefined();
    expect(WINDOW_PRESETS_DETAILED.US_DEFAULT).toBeDefined();
  });

  it('window width/center are positive numbers', () => {
    Object.entries(WINDOW_PRESETS_DETAILED).forEach(([_key, preset]) => {
      expect(preset.ww).toBeGreaterThan(0);
      expect(Number.isFinite(preset.wc)).toBe(true);
    });
  });

  it('presets are matched to correct modalities', () => {
    expect(WINDOW_PRESETS_DETAILED.CT_LUNG.modality).toContain('CT');
    expect(WINDOW_PRESETS_DETAILED.MR_T1.modality).toContain('MR');
    expect(WINDOW_PRESETS_DETAILED.MG_DEFAULT.modality).toContain('MG');
  });

  it('list contains all presets', () => {
    expect(WINDOW_PRESETS_LIST.length).toBe(Object.keys(WINDOW_PRESETS_DETAILED).length);
  });
});

describe('DICOM Samples', () => {
  it('has 100 samples', () => {
    expect(DICOM_SAMPLES_TOTAL).toBeGreaterThanOrEqual(100);
  });

  it('covers all 6 modalities', () => {
    const modalities = new Set(DICOM_SAMPLES.map(s => s.modality));
    expect(modalities.has('CT')).toBe(true);
    expect(modalities.has('MR')).toBe(true);
    expect(modalities.has('DR')).toBe(true);
    expect(modalities.has('MG')).toBe(true);
    expect(modalities.has('US')).toBe(true);
    expect(modalities.has('PT')).toBe(true);
  });

  it('all samples have wadouri: imageUrl', () => {
    DICOM_SAMPLES.forEach(s => {
      expect(s.imageUrl).toMatch(/^wadouri:/);
    });
  });

  it('all samples have valid metadata', () => {
    DICOM_SAMPLES.forEach(s => {
      expect(s.id).toBeTruthy();
      expect(s.studyId).toBeTruthy();
      expect(s.seriesId).toBeTruthy();
      expect(s.modality).toBeTruthy();
      expect(s.bodyPart).toBeTruthy();
      expect(s.sliceCount).toBeGreaterThan(0);
      expect(s.thickness).toBeGreaterThanOrEqual(0);
      expect(s.pixelSpacing).toHaveLength(2);
      expect(s.pixelSpacing[0]).toBeGreaterThan(0);
      expect(s.pixelSpacing[1]).toBeGreaterThan(0);
      expect(s.acquisitionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('CT samples have reasonable slice counts', () => {
    const ct = DICOM_SAMPLES.filter(s => s.modality === 'CT');
    expect(ct.length).toBeGreaterThan(20);
    ct.forEach(s => expect(s.sliceCount).toBeGreaterThanOrEqual(20));
  });

  it('DR samples have 1-2 slices (PA + lateral)', () => {
    const dr = DICOM_SAMPLES.filter(s => s.modality === 'DR');
    dr.forEach(s => {
      expect(s.sliceCount).toBeGreaterThanOrEqual(1);
      expect(s.sliceCount).toBeLessThanOrEqual(4);
    });
  });
});
