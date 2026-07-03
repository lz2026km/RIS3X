// [ClinicalConfig] 共享 zod primitives
// 阶段 1：阶段 1 基础原语。后续阶段逐个模块添加。
import { z } from "zod";

// ---------- 共享原始类型 ----------

/** 0-1 之间的小数（用于 accuracy / sensitivity / specificity） */
export const probabilitySchema = z.number().min(0).max(1);

/** 非负整数 mm 单位（axial length / 眼轴） */
export const mmNumberSchema = z.number().min(0).max(50);

/** 非负百分数 0-100 */
export const percentSchema = z.number().min(0).max(100);

/** 标识符：非空字符串 */
export const idSchema = z.string().min(1).max(64);

/** URL（可选） */
export const urlSchema = z.string().url().optional();

// ---------- 共享枚举 ----------

/** 眼别 (OD/OS/OU) */
export const eyeSideSchema = z.enum(["OD", "OS", "OU"]);

/** AI 模型审批状态：监管标志位组合 */
export const approvalFlagsSchema = z.object({
  fdaApproved: z.boolean(),
  ceMarked: z.boolean(),
  nmpaApproved: z.boolean(),
});

/** 设备 modality 范围（眼科） */
export const eyeModalitySchema = z.enum([
  "fundus_photo",
  "oct",
  "oct_a",
  "ffa",
  "icga",
  "visual_field",
  "topography",
  "pentacam",
  "iol_master",
  "ubm",
  "corvis",
  "wavefront",
  "hrt",
  "gdx",
  "slit_lamp",
  "fundus_autofluorescence",
  "erg",
  "vep",
  "multifocal_erg",
  "corneal_endothelium",
  "tear_film",
  "anterior_segment_photo",
  "stereo_fundus",
  "gonioscopy",
  "specular_microscopy",
]);

/** 设备 modality 范围（牙科） */
export const dentalModalitySchema = z.enum([
  "CBCT",
  "Panoramic",
  "Periapical",
  "Bitewing",
  "Scan",
  "Photo",
]);