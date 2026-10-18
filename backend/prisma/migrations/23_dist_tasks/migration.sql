-- [v3.0.6.16-6] 报告分发任务表 (此前 /dist/tasks 仅 MSW 兜底)
CREATE TABLE "dist_tasks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "recipient" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dist_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dist_tasks_report_id_idx" ON "dist_tasks"("report_id");
CREATE INDEX "dist_tasks_status_idx" ON "dist_tasks"("status");
CREATE INDEX "dist_tasks_channel_idx" ON "dist_tasks"("channel");
CREATE INDEX "dist_tasks_tenant_id_idx" ON "dist_tasks"("tenant_id");