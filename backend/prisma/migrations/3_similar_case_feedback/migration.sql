-- G005 v3.0.6.11-60: 相似病例检索反馈表 (SimilarCaseFeedback)
-- 对应 prisma/schema.prisma 的 SimilarCaseFeedback model
CREATE TABLE "similar_case_feedbacks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "target_report_id" TEXT NOT NULL,
    "useful" BOOLEAN NOT NULL,
    "comment" TEXT DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "similar_case_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "similar_case_feedbacks_report_id_target_report_id_idx" ON "similar_case_feedbacks"("report_id", "target_report_id");
CREATE INDEX "similar_case_feedbacks_tenant_id_idx" ON "similar_case_feedbacks"("tenant_id");
CREATE INDEX "similar_case_feedbacks_useful_idx" ON "similar_case_feedbacks"("useful");
