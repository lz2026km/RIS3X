-- G005 v3.0.6.11-79 W4-A: 数据字典持久化 (DictEntry 模型)
-- 分类 Tab + 条目 CRUD: category/key/value 三级, extra Json 存扩展字段
-- 应用方式: `prisma migrate deploy`; 内置种子数据便于首次部署直接可用

CREATE TABLE "dict_entries" (
  "id" TEXT PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "extra" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "dict_entries_tenant_id_category_key_key" ON "dict_entries"("tenant_id", "category", "key");
CREATE INDEX "dict_entries_tenant_id_idx" ON "dict_entries"("tenant_id");
CREATE INDEX "dict_entries_tenant_id_category_active_idx" ON "dict_entries"("tenant_id", "category", "active");

INSERT INTO "dict_entries" ("id", "tenant_id", "category", "key", "value", "sort", "active", "extra")
VALUES
  ('cl-dict-ct-001', 'default', 'CT检查项目', 'CT-BRAIN-NC', '颅脑CT平扫', 1, true, '{"pinyin":"lwnctps","modality":["CT"],"bodyPart":"头部","notes":"常规颅脑平扫，层厚5mm"}'),
  ('cl-dict-ct-002', 'default', 'CT检查项目', 'CT-CHEST-NC', '胸部CT平扫', 2, true, '{"pinyin":"xbctps","modality":["CT"],"bodyPart":"胸部","notes":"肺窗+纵隔窗"}'),
  ('cl-dict-ct-003', 'default', 'CT检查项目', 'CT-ABD-C', '腹部CT增强', 3, true, '{"pinyin":"fbctzq","modality":["CT"],"bodyPart":"腹部","notes":"三期增强扫描"}'),
  ('cl-dict-mr-001', 'default', 'MRI序列', 'MR-T1WI', 'T1WI成像', 1, true, '{"pinyin":"t1wi","modality":["MR"],"bodyPart":"全身","notes":"SE序列"}'),
  ('cl-dict-mr-002', 'default', 'MRI序列', 'MR-T2WI', 'T2WI成像', 2, true, '{"pinyin":"t2wi","modality":["MR"],"bodyPart":"全身","notes":"FSE序列"}'),
  ('cl-dict-mr-003', 'default', 'MRI序列', 'MR-DWI', 'DWI扩散成像', 3, true, '{"pinyin":"dwkscx","modality":["MR"],"bodyPart":"全身","notes":"b值800-1000"}'),
  ('cl-dict-dr-001', 'default', 'X线检查', 'DR-CHEST-PA', '胸部正侧位片', 1, true, '{"pinyin":"xbzcwp","modality":["DR"],"bodyPart":"胸部","notes":"立位PA+侧位"}'),
  ('cl-dict-dr-002', 'default', 'X线检查', 'DR-SPINE-L', '腰椎正侧位', 2, true, '{"pinyin":"yzzcw","modality":["DR"],"bodyPart":"腰椎","notes":"腰骶部疼痛评估"}'),
  ('cl-dict-eq-001', 'default', '设备类型', 'EQ-CT-128', '128排CT', 1, true, '{"pinyin":"128pct","modality":["CT"],"bodyPart":"全身","notes":"Siemens Definition AS+"}'),
  ('cl-dict-eq-002', 'default', '设备类型', 'EQ-MR-30T', '3.0T MRI', 2, true, '{"pinyin":"30tmri","modality":["MR"],"bodyPart":"全身","notes":"Siemens TrioTim 3.0T"}'),
  ('cl-dict-diag-001', 'default', '诊断术语', 'DIAG-NORMAL', '未见明显异常', 1, true, '{"pinyin":"wjmxyc","modality":["CT","MR","DR"],"bodyPart":"全身","notes":"正常报告模板"}'),
  ('cl-dict-diag-002', 'default', '诊断术语', 'DIAG-STROKE', '脑梗死', 2, true, '{"pinyin":"ngs","modality":["CT","MR"],"bodyPart":"颅脑","notes":"急慢性分期"}'),
  ('cl-dict-diag-003', 'default', '诊断术语', 'DIAG-FRACTURE', '骨折', 3, true, '{"pinyin":"gz","modality":["DR","CT"],"bodyPart":"四肢/脊柱","notes":"请注明部位及类型"}'),
  ('cl-dict-bp-001', 'default', '检查部位', 'BP-HEAD', '头部', 1, true, '{"pinyin":"tb","modality":["CT","MR","DR"],"bodyPart":"头部","notes":"颅脑/副鼻窦/颞骨"}'),
  ('cl-dict-bp-002', 'default', '检查部位', 'BP-CHEST', '胸部', 2, true, '{"pinyin":"xb","modality":["CT","DR","MR"],"bodyPart":"胸部","notes":"肺/纵隔/胸壁"}'),
  ('cl-dict-bp-003', 'default', '检查部位', 'BP-ABD', '腹部', 3, true, '{"pinyin":"fb","modality":["CT","MR","DR"],"bodyPart":"腹部","notes":"肝胆胰脾肾"}'),
  ('cl-dict-cm-001', 'default', '造影剂', 'CM-IOHEXOL', '碘海醇', 1, true, '{"pinyin":"dhc","modality":["CT"],"bodyPart":"全身","notes":"浓度300/350mgI/ml"}'),
  ('cl-dict-cm-002', 'default', '造影剂', 'CM-GD-DTPA', '钆喷酸葡胺', 2, true, '{"pinyin":"gpspa","modality":["MR"],"bodyPart":"全身","notes":"马根维显/莫迪司"}'),
  ('cl-dict-pos-001', 'default', '体位技术', 'POS-AP', '前后位AP', 1, true, '{"pinyin":"qhwap","modality":["DR"],"bodyPart":"全身","notes":"X线束从前往后"}'),
  ('cl-dict-pos-002', 'default', '体位技术', 'POS-LAT', '侧位LAT', 2, true, '{"pinyin":"cwlat","modality":["DR"],"bodyPart":"全身","notes":"左侧/右侧位"}')
ON CONFLICT ("tenant_id", "category", "key") DO NOTHING;
