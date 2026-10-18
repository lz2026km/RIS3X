/**
 * G005 RIS v3.0.6.16-6 — 报告分发模块 (Dist)
 *
 * 背景: 前端 `ReportDeliveryPage` 用裸 `fetch('/api/v1/dist/tasks')` 调 3 个端点,
 * 后端从未实现, 仅靠 MSW 兜底 —— 裸 fetch 绕过统一 client, 因此 api-contract-guard
 * 看不见这批死端点。这里补上真实实现 (Prisma DistTask 表 + 状态机 + 重试计数)。
 */
import { Module } from "@nestjs/common";
import { DistController } from "./dist.controller";
import { DistService } from "./dist.service";

@Module({
  controllers: [DistController],
  providers: [DistService],
  exports: [DistService],
})
export class DistModule {}
