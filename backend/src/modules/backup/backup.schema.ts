import { z } from "zod";

export const BackupCreateQuerySchema = z.object({
  type: z.enum(["FULL", "CONFIG", "AUDIT", "COMPLIANCE"]).optional(),
});

export const BackupRestoreParamSchema = z.string().min(1);
