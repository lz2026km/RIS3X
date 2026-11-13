-- [v3.0.6.16-9] 设备报废审批 + 修复报废写入必然 500
-- 1) DeviceState 增加 RETIRED
-- 2) 报废审批轨迹字段 (申请/批准/驳回 + 原因/时间)
ALTER TYPE "DeviceState" ADD VALUE IF NOT EXISTS 'RETIRED';

ALTER TABLE "devices" ADD COLUMN "retirement_status" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "devices" ADD COLUMN "retirement_requested_by" TEXT;
ALTER TABLE "devices" ADD COLUMN "retirement_approved_by" TEXT;
ALTER TABLE "devices" ADD COLUMN "retired_reason" TEXT;
ALTER TABLE "devices" ADD COLUMN "retired_at" TIMESTAMP(3);
