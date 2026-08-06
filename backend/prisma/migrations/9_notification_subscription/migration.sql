-- G005 v3.0.6.11-75 W4-2: Web Push 订阅持久化
-- push 订阅从内存 Map 迁移至 DB (NotificationSubscription 模型)
-- 由 `prisma migrate deploy` 应用; 运行时若无此表则自动回退内存存储

CREATE TABLE "notification_subscriptions" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "endpoint" TEXT UNIQUE NOT NULL,
  "keys_json" TEXT NOT NULL,
  "topics" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "notification_subscriptions_user_id_idx" ON "notification_subscriptions"("user_id");

CREATE INDEX "notification_subscriptions_tenant_id_idx" ON "notification_subscriptions"("tenant_id");
