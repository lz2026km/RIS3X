-- G005 v3.0.6.11-72: CLOSED_LOOP 终态可写
-- CriticalValue 增加 closed_by / closed_at,闭环(CLOSED_LOOP)时由 service.update 写入
ALTER TABLE "critical_values"
    ADD COLUMN "closed_by" TEXT,
    ADD COLUMN "closed_at" TIMESTAMP(3);
