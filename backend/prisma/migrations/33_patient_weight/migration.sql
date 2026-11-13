-- [v3.0.6.16-9] 注射前核查必须使用患者真实体重 (此前前端硬编码 70kg / eGFR 90)
ALTER TABLE "patients" ADD COLUMN "weight" DOUBLE PRECISION;
