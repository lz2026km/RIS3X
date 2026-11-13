-- [v3.0.6.16-9] 设备台账: 型号 / 序列号
-- 此前 devicemgmt.schema 接受 model/serialNumber 但表里没有 -> 写入必然 500
ALTER TABLE "devices" ADD COLUMN "model" TEXT;
ALTER TABLE "devices" ADD COLUMN "serial_number" TEXT;