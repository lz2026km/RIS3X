// [ClinicalConfig] imagingDevices 模块
import { z } from "zod";
import { dentalModalitySchema } from "../primitives";

/** 单个设备（按 modality 分组） */
export const imagingDeviceSchema = z.object({
  name: z.string().min(1).max(64),
  manufacturer: z.string().min(1).max(64),
  country: z.string().max(64).optional(),
  modality: dentalModalitySchema,
  /** 0-1 */
  fov: z.string().max(64).optional(),
  voxelSize: z.number().min(0.05).max(1).optional(),
  notes: z.string().max(256).optional(),
});

export const imagingDevicesModuleSchema = z.object({
  $schema: z.literal("imagingDevices.v1").optional(),
  version: z.number().int().min(1).max(999).default(1),
  devices: z.array(imagingDeviceSchema).min(1).max(256),
});

export type ImagingDevice = z.infer<typeof imagingDeviceSchema>;
export type ImagingDevicesModule = z.infer<typeof imagingDevicesModuleSchema>;