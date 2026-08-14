-- G005 v3.0.6.11-96 Wave 2A P0: 队列叫号状态落库 (queue.service 内存 Map → prisma 持久化)
-- 应用方式: `prisma migrate deploy`

CREATE TABLE "queue_states" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL DEFAULT '',
    "entry_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "current_number" TEXT,
    "last_call_at" TIMESTAMP,
    "called_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "queue_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "queue_states_tenant_id_entry_id_key" ON "queue_states"("tenant_id", "entry_id");
CREATE INDEX "queue_states_tenant_id_room_id_idx" ON "queue_states"("tenant_id", "room_id");
