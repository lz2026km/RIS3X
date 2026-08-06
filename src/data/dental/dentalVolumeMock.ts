// [v3.0.6.8-93] Phase 3: CBCT 体绘制 mock 数据
// 对标: Planmeca Romexis + Sirona Galileos

export const MOCK_VOLUME_STUDIES = [
  { id: 'VOL-001', patientId: 'P100001', patientName: '张伟', modality: 'CBCT', acquisitionDate: '2026-06-28', device: 'Sirona Orthophos SL 3D', fov: '8x8cm', voxelSize: 0.125, slices: 512, resolution: '512x512', status: 'processed' },
  { id: 'VOL-002', patientId: 'P100002', patientName: '李娜', modality: 'CBCT', acquisitionDate: '2026-06-25', device: 'Planmeca ProMax 3D Mid', fov: '10x10cm', voxelSize: 0.15, slices: 480, resolution: '512x512', status: 'processed' },
  { id: 'VOL-003', patientId: 'P100003', patientName: '王芳', modality: 'CBCT', acquisitionDate: '2026-06-20', device: 'Carestream CS 9600', fov: '16x10cm', voxelSize: 0.2, slices: 400, resolution: '512x512', status: 'processing' },
];

export const MOCK_VOLUME_RENDER_PRESETS = [
  { id: 'bone', name: '骨组织', opacity: [0, 0, 0.8, 1], color: [[-1000,0,0,0],[200,0.9,0.8,0.6],[800,0.95,0.85,0.7],[2000,1,1,1]], ww: 1500, wc: 500 },
  { id: 'soft', name: '软组织', opacity: [0, 0.2, 0, 0], color: [[-1000,0,0,0],[-500,0.5,0.3,0.2],[100,0.8,0.6,0.5],[300,0.9,0.7,0.6]], ww: 400, wc: 40 },
  { id: 'airway', name: '气道', opacity: [0.8, 0, 0, 0], color: [[-1000,0.2,0.5,1],[-800,0.3,0.6,1],[-500,0,0,0],[2000,0,0,0]], ww: 800, wc: -600 },
  { id: 'nerve', name: '神经管增强', opacity: [0, 0, 0.3, 0.9], color: [[-1000,0,0,0],[150,0.4,0.2,0.1],[400,1,0.2,0.1],[2000,1,1,0.9]], ww: 600, wc: 250 },
];

// Mock CBCT slice data (simulated as pixel values)
export function generateMockVolumeSlices(count: number): number[][] {
  const slices: number[][] = [];
  for (let z = 0; z < count; z++) {
    const slice: number[] = [];
    const size = 64; // Reduced for mock - 64x64 pixels
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const cx = size / 2, cy = size / 2;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);Math.atan2(y - cy, x - cx);
        // Simulated mandible shape
        const bone = 1 - Math.abs(dist - 18) / 8;
        const nerve = dist > 10 && dist < 14 ? 1 - Math.abs(dist - 12) / 2 : 0;
        const noise = Math.sin(x * 0.3 + z * 0.2) * 0.1;
        const val = (Math.max(0, bone) * 0.7 + nerve * 0.9 + noise) * 2000 - 500;
        // Z axis variation
        const zFactor = 1 - Math.abs(z - count / 2) / (count / 2);
        slice.push(Math.round(val * (0.5 + zFactor * 0.5)));
      }
    }
    slices.push(slice);
  }
  return slices;
}

// Curve MPR path (dental arch spline points)
export const MOCK_ARCH_SPLINE = [
  { x: 60, y: 30, z: 40 }, { x: 55, y: 28, z: 38 }, { x: 50, y: 25, z: 36 },
  { x: 45, y: 22, z: 34 }, { x: 40, y: 18, z: 32 }, { x: 35, y: 15, z: 30 },
  { x: 30, y: 12, z: 28 }, { x: 25, y: 10, z: 26 }, { x: 20, y: 8, z: 25 },
  { x: 15, y: 7, z: 24 }, { x: 10, y: 6, z: 23 }, { x: 5, y: 5, z: 22 },
  { x: 0, y: 5, z: 22 }, { x: -5, y: 5, z: 22 }, { x: -10, y: 6, z: 23 },
  { x: -15, y: 7, z: 24 }, { x: -20, y: 8, z: 25 }, { x: -25, y: 10, z: 26 },
  { x: -30, y: 12, z: 28 }, { x: -35, y: 15, z: 30 }, { x: -40, y: 18, z: 32 },
  { x: -45, y: 22, z: 34 }, { x: -50, y: 25, z: 36 }, { x: -55, y: 28, z: 38 },
  { x: -60, y: 30, z: 40 },
];

// 3D mesh mock for volume rendering
export const MOCK_3D_MESH_META = {
  vertexCount: 185000,
  faceCount: 92000,
  bounds: { minX: -80, maxX: 80, minY: -60, maxY: 60, minZ: -40, maxZ: 40 },
  quality: 'high',
  format: 'glb',
};
