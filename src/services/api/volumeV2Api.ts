/**
 * G005 RIS - [v3.0.6.11-101 Wave 3A] 多平面重建 V2 API 客户端
 *
 * 端点 (POST /volume-v2/*, 200):
 *   - mpr-linked: 三平面联动切片 + 相交线参数 (十字线联动)
 *   - cpr       : 曲面重建拉直图 + 三平面路径投影
 *   - vr        : 光线投射体绘制 (yaw/pitch + 传输函数预设: 骨骼/软组织/血管)
 *   - cut       : 任意切面 (法向量 + 偏移) 截面图像 + 裁剪统计
 */
import { api } from "./client";

export interface Vec3Dto {
  x: number;
  y: number;
  z: number;
}

export interface V2PixelPayload {
  dataBase64: string;
  bitsAllocated: number;
  signed: boolean;
  width: number;
  height: number;
}

export interface V2PlaneSliceDto {
  plane: "axial" | "coronal" | "sagittal";
  sliceIndex: number;
  totalSlices: number;
  width: number;
  height: number;
  windowWidth: number;
  windowLevel: number;
  crosshair: { h: number; v: number };
  pixelData: V2PixelPayload;
}

export interface MprLinkedResultDto {
  jobId: string;
  source: "real" | "synthetic";
  dims: Vec3Dto;
  position: Vec3Dto;
  lines: {
    axial: { h: number; v: number };
    coronal: { h: number; v: number };
    sagittal: { h: number; v: number };
  };
  planes: V2PlaneSliceDto[];
}

export interface CprProjectionDto {
  axial: Array<{ x: number; y: number }>;
  coronal: Array<{ x: number; z: number }>;
  sagittal: Array<{ y: number; z: number }>;
}

export interface CprResultDto {
  jobId: string;
  source: "real" | "synthetic";
  points: Vec3Dto[];
  spacing: number;
  crossWidth: number;
  totalLengthVoxels: number;
  totalLengthMm: number;
  sampleCount: number;
  straightened: {
    width: number;
    height: number;
    windowWidth: number;
    windowLevel: number;
    pixelData: V2PixelPayload;
  };
  projections: CprProjectionDto;
  dims: Vec3Dto;
}

export type VrPresetDto = "bone" | "softTissue" | "vessel";

export interface TransferFunctionEntryDto {
  hu: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface VrResultDto {
  jobId: string;
  source: "real" | "synthetic";
  width: number;
  height: number;
  yaw: number;
  pitch: number;
  preset: VrPresetDto;
  sampleStep: number;
  stepCount: number;
  transferFunction: { lutSize: number; entries: TransferFunctionEntryDto[] };
  pixelData: { dataBase64: string; channels: number };
}

export interface CutResultDto {
  jobId: string;
  source: "real" | "synthetic";
  normal: Vec3Dto;
  offset: number;
  width: number;
  height: number;
  sectionImage: V2PixelPayload;
  stats: {
    voxelsKept: number;
    voxelsTotal: number;
    keptRatio: number;
    clippedRatio: number;
  };
  planeInfo: { center: Vec3Dto; basisU: Vec3Dto; basisV: Vec3Dto };
}

export interface VolumeV2Request {
  jobId?: string;
  seriesUID?: string;
}

export const volumeV2Api = {
  /** 三平面联动切片 + 相交线参数 */
  mprLinked: (data: VolumeV2Request & { position: Vec3Dto }) =>
    api.post<MprLinkedResultDto>("/volume-v2/mpr-linked", data),

  /** 曲面重建拉直图 + 路径投影 */
  cpr: (data: VolumeV2Request & { points: Vec3Dto[]; spacing?: number; crossWidth?: number }) =>
    api.post<CprResultDto>("/volume-v2/cpr", data),

  /** 光线投射体绘制 (确定性输出) */
  vr: (data: VolumeV2Request & { yaw?: number; pitch?: number; preset?: VrPresetDto; step?: number; size?: number }) =>
    api.post<VrResultDto>("/volume-v2/vr", data),

  /** 任意切面裁剪 → 截面图像 + 统计 */
  cut: (data: VolumeV2Request & { normal: Vec3Dto; offset?: number }) =>
    api.post<CutResultDto>("/volume-v2/cut", data),
};
