-- [v3.0.6.16-9] 患者临床安全字段: eGFR / 植入物史 (对比剂与 MR 安全筛查必需)
ALTER TABLE "patients" ADD COLUMN "egfr" DOUBLE PRECISION;
ALTER TABLE "patients" ADD COLUMN "implant_history" TEXT;