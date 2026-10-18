-- [v3.0.6.16-7] 口腔患者照片
CREATE TABLE "dental_photos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'intraoral',
    "label" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dental_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dental_photos_patient_id_idx" ON "dental_photos"("patient_id");
CREATE INDEX "dental_photos_tenant_id_idx" ON "dental_photos"("tenant_id");