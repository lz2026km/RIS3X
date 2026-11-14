/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3B (contrast-safety) - 服务层 spec
 * 覆盖:
 *   1. 注射前核查阻断规则矩阵 (单独/组合)
 *   2. 过敏试验 overlay + seed 回退
 *   3. 留观门禁 (满时长 / 医生放行 / 未满拒绝)
 *   4. 孤儿模式 (无 Prisma) 审计静默跳过, 功能可用
 */
import { BadRequestException } from "@nestjs/common";
import { ContrastSafetyService } from "./contrast-safety.service";

describe("ContrastSafetyService (Wave 3B 对比剂安全闭环)", () => {
  let svc: ContrastSafetyService;

  beforeEach(() => {
    svc = new ContrastSafetyService(undefined);
  });

  describe("注射前核查阻断规则", () => {
    it("全部满足 → passed=true, blockers 空", () => {
      const r = svc.preInjectionCheck({
        patientId: "P1",
        consentSigned: true,
        egfr: 60,
        pregnant: false,
      });
      expect(r.passed).toBe(true);
      expect(r.blockers).toEqual([]);
      expect(r.checks.map((c) => c.key)).toEqual([
        "consent",
        "allergy",
        "egfr",
        "pregnancy",
      ]);
    });

    it("无同意书 → NO_CONSENT", () => {
      const r = svc.preInjectionCheck({ patientId: "P1", egfr: 60 });
      expect(r.passed).toBe(false);
      expect(r.blockers).toContain("NO_CONSENT");
    });

    it("eGFR 低于阈值 (默认 30) → EGFR_BELOW_THRESHOLD; 可覆盖阈值", () => {
      const r1 = svc.preInjectionCheck({
        patientId: "P1",
        consentSigned: true,
        egfr: 29.9,
      });
      expect(r1.blockers).toContain("EGFR_BELOW_THRESHOLD");
      const r2 = svc.preInjectionCheck({
        patientId: "P1",
        consentSigned: true,
        egfr: 45,
        threshold: 50,
      });
      expect(r2.blockers).toContain("EGFR_BELOW_THRESHOLD");
      expect(r2.threshold).toBe(50);
    });

    it("妊娠 → PREGNANCY", () => {
      const r = svc.preInjectionCheck({
        patientId: "P1",
        consentSigned: true,
        egfr: 90,
        pregnant: true,
      });
      expect(r.blockers).toEqual(["PREGNANCY"]);
    });

    it("多项命中 → blockers 含 4 项", () => {
      svc.recordAllergyTest({
        patientId: "P2",
        contrastType: "碘海醇",
        result: "positive",
        testedBy: "张技师",
      });
      const r = svc.preInjectionCheck({
        patientId: "P2",
        consentSigned: false,
        egfr: 10,
        pregnant: true,
      });
      expect(r.passed).toBe(false);
      expect(r.blockers).toEqual(
        expect.arrayContaining([
          "NO_CONSENT",
          "ALLERGY_POSITIVE",
          "EGFR_BELOW_THRESHOLD",
          "PREGNANCY",
        ]),
      );
    });
  });

  describe("过敏试验 overlay + seed 回退", () => {
    it("记录后患者历史只含真实记录 (时间倒序)", () => {
      svc.recordAllergyTest({
        patientId: "P3",
        contrastType: "碘海醇",
        result: "negative",
        testedAt: "2026-08-01T00:00:00.000Z",
        testedBy: "张技师",
      });
      svc.recordAllergyTest({
        patientId: "P3",
        contrastType: "碘克沙醇",
        result: "unknown",
        testedAt: "2026-08-02T00:00:00.000Z",
        testedBy: "李护士",
      });
      const res = svc.listAllergyTests("P3");
      expect(res.source).toBe("memory");
      expect(res.total).toBe(2);
      expect(res.latest?.result).toBe("unknown");
    });

    it("无记录患者 → seed 回退 (确定性)", () => {
      const res = svc.listAllergyTests("P-DEMO-002");
      expect(res.source).toBe("seed");
      expect(res.latest?.result).toBe("positive");
    });

    it("latestAllergyResult: 显式优先, 无记录回退 unknown", () => {
      expect(svc.latestAllergyResult("P4", "negative")).toBe("negative");
      expect(svc.latestAllergyResult("P4")).toBe("unknown");
    });
  });

  describe("增强注射门禁", () => {
    it("未通过核查 → BadRequestException(code=PRE_INJECTION_CHECK_FAILED)", async () => {
      await expect(
        svc.runInjection({ patientId: "P5", contrastType: "碘海醇" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      try {
        await svc.runInjection({ patientId: "P5", contrastType: "碘海醇" });
      } catch (e) {
        const body = (e as BadRequestException).getResponse() as {
          code: string;
          blockers: string[];
        };
        expect(body.code).toBe("PRE_INJECTION_CHECK_FAILED");
        expect(body.blockers).toContain("NO_CONSENT");
      }
    });

    it("通过核查 → 返回 injection-command 指令", async () => {
      const res = await svc.runInjection({
        patientId: "P6",
        contrastType: "碘海醇",
        consentSigned: true,
        eGFR: 80,
      });
      expect(res.passed).toBe(true);
      expect(res.resource).toBe("injection-command");
      expect(res.preCheck.passed).toBe(true);
      expect(res.id).toBeTruthy();
    });
  });

  describe("留观时长门禁", () => {
    it("默认 30 分钟, 未满不可离院, 医生放行可离院", async () => {
      const obs = await svc.startObservation({ patientId: "P7" });
      expect(obs.durationMinutes).toBe(30);
      expect(obs.canDischarge).toBe(false);
      await expect(svc.dischargeObservation(obs.id, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      const released = await svc.dischargeObservation(obs.id, {
        doctorRelease: true,
        dischargedBy: "李医生",
      });
      expect(released.status).toBe("discharged");
      expect(released.doctorRelease).toBe(true);
    });

    it("满时长可离院", async () => {
      const startedAt = new Date(Date.now() - 31 * 60_000).toISOString();
      const obs = await svc.startObservation({
        patientId: "P8",
        durationMinutes: 30,
        startedAt,
      });
      expect(obs.canDischarge).toBe(true);
      const done = await svc.dischargeObservation(obs.id, {});
      expect(done.status).toBe("discharged");
      expect(done.remainingSeconds).toBe(0);
    });

    it("留观记录追加 + 重复离院幂等", async () => {
      const obs = await svc.startObservation({
        patientId: "P9",
        durationMinutes: 1,
        startedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      });
      const withRecord = await svc.addObservationRecord(obs.id, {
        symptoms: "轻微恶心",
        action: "观察",
        recordedBy: "张技师",
      });
      expect(withRecord.records).toHaveLength(1);
      const first = await svc.dischargeObservation(obs.id, {});
      const second = await svc.dischargeObservation(obs.id, {});
      expect(first.status).toBe("discharged");
      expect(second.status).toBe("discharged");
    });
  });
});

interface FakeObservationRow {
  id: string;
  tenantId: string;
  injectionId: string | null;
  patientId: string;
  patientName: string;
  startedAt: Date;
  observationMins: number;
  status: string;
  symptoms: string;
  actions: string;
  recordedBy: string | null;
  dischargedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeObservationRow(
  overrides: Partial<FakeObservationRow> = {},
): FakeObservationRow {
  const now = new Date();
  return {
    id: "row-1",
    tenantId: "default",
    injectionId: null,
    patientId: "P-1",
    patientName: "张三",
    startedAt: new Date(now.getTime() - 5 * 60_000),
    observationMins: 30,
    status: "observing",
    symptoms: "",
    actions: "",
    recordedBy: "tester",
    dischargedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function fakeObservationPrisma(
  initial: FakeObservationRow[] = [makeObservationRow()],
) {
  const rows = new Map<string, FakeObservationRow>(
    initial.map((row) => [row.id, { ...row }]),
  );
  let seq = rows.size;
  const contrastObservation = {
    create: jest.fn(async ({ data }: { data: Partial<FakeObservationRow> }) => {
      seq += 1;
      const row = makeObservationRow({ id: `row-${seq}`, ...data });
      rows.set(row.id, row);
      return row;
    }),
    findMany: jest.fn(async (args: any) => {
      const where = args?.where as { tenantId: string; patientId?: string };
      return [...rows.values()].filter(
        (row) =>
          row.tenantId === where.tenantId &&
          (!where.patientId || row.patientId === where.patientId),
      );
    }),
    findFirst: jest.fn(
      async (args: any) => rows.get((args?.where as { id: string }).id) ?? null,
    ),
    update: jest.fn(async (args: any) => {
      const where = args.where as { id: string };
      const current = rows.get(where.id);
      if (!current) throw new Error(`row ${where.id} not found`);
      const next = {
        ...current,
        ...(args.data as Partial<FakeObservationRow>),
        updatedAt: new Date(),
      };
      rows.set(next.id, next);
      return next;
    }),
  };
  return {
    rows,
    prisma: {
      patient: { findFirst: jest.fn(async () => ({ name: "李四" })) },
      contrastObservation,
    },
  };
}

describe("ContrastSafetyService observation persistence", () => {
  it("startObservation persists tenantId + resolved patientName and returns source db", async () => {
    const { prisma } = fakeObservationPrisma();
    const service = new ContrastSafetyService(prisma as never);

    const dto = await service.startObservation({ patientId: "P-1" });

    expect(prisma.contrastObservation.create).toHaveBeenCalledTimes(1);
    const payload = prisma.contrastObservation.create.mock.calls[0]![0].data;
    expect(payload.tenantId).toBe("default");
    expect(payload.patientId).toBe("P-1");
    expect(payload.patientName).toBe("李四");
    expect(payload.status).toBe("observing");
    expect(dto.source).toBe("db");
    expect(dto.patientName).toBe("李四");
  });

  it("listObservations reads DB rows ordered by startedAt", async () => {
    const older = makeObservationRow({
      id: "row-old",
      startedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const newer = makeObservationRow({
      id: "row-new",
      startedAt: new Date("2026-02-01T00:00:00Z"),
    });
    const { prisma } = fakeObservationPrisma([older, newer]);
    const service = new ContrastSafetyService(prisma as never);

    const result = await service.listObservations();

    expect(result.source).toBe("db");
    expect(result.total).toBe(2);
    expect(
      prisma.contrastObservation.findMany.mock.calls[0]![0].orderBy,
    ).toEqual({ startedAt: "desc" });
    expect(result.items.map((item) => item.id).sort()).toEqual([
      "row-new",
      "row-old",
    ]);
  });

  it("listObservations filters by patientId", async () => {
    const { prisma } = fakeObservationPrisma([
      makeObservationRow({ id: "row-1", patientId: "P-1" }),
    ]);
    const service = new ContrastSafetyService(prisma as never);

    await service.listObservations("P-9");

    expect(prisma.contrastObservation.findMany.mock.calls[0]![0].where).toEqual(
      {
        tenantId: "default",
        patientId: "P-9",
      },
    );
  });

  it("addObservationRecord appends symptoms/actions into DB columns", async () => {
    const { prisma, rows } = fakeObservationPrisma();
    const service = new ContrastSafetyService(prisma as never);

    const dto = await service.addObservationRecord("row-1", {
      symptoms: "轻度恶心",
      action: "继续观察",
      recordedBy: "nurse-1",
    });

    const row = rows.get("row-1")!;
    expect(row.symptoms).toContain("轻度恶心");
    expect(row.actions).toContain("继续观察");
    expect(row.recordedBy).toBe("nurse-1");
    expect(dto.source).toBe("db");
    expect(dto.records.some((entry) => entry.symptoms === "轻度恶心")).toBe(
      true,
    );
  });

  it("addObservationRecord marks reaction when reactionId supplied", async () => {
    const { prisma, rows } = fakeObservationPrisma();
    const service = new ContrastSafetyService(prisma as never);

    const dto = await service.addObservationRecord("row-1", {
      symptoms: "皮疹",
      reactionId: "reaction-1",
    });

    expect(rows.get("row-1")!.status).toBe("reaction");
    expect(dto.status).toBe("reaction");
  });

  it("dischargeObservation sets status discharged + dischargedAt", async () => {
    const { prisma, rows } = fakeObservationPrisma();
    const service = new ContrastSafetyService(prisma as never);

    const dto = await service.dischargeObservation("row-1", {
      doctorRelease: true,
      dischargedBy: "doctor-1",
      notes: "离室正常",
    });

    const row = rows.get("row-1")!;
    expect(row.status).toBe("discharged");
    expect(row.dischargedAt).toBeInstanceOf(Date);
    expect(dto.status).toBe("discharged");
    expect(dto.dischargedAt).toBeTruthy();
  });
});

describe("ContrastSafetyService observation fallback", () => {
  const failingPrisma = {
    patient: { findFirst: jest.fn(async () => null) },
    contrastObservation: {
      create: jest.fn(async () => {
        throw new Error("db down");
      }),
      findMany: jest.fn(async () => {
        throw new Error("db down");
      }),
      findFirst: jest.fn(async () => {
        throw new Error("db down");
      }),
      update: jest.fn(async () => {
        throw new Error("db down");
      }),
    },
  };

  it("startObservation falls back to memory and reports source seed", async () => {
    const service = new ContrastSafetyService(failingPrisma as never);

    const dto = await service.startObservation({ patientId: "P-9" });

    expect(dto.source).toBe("seed");
    expect(dto.id).toMatch(/^obs-/);
  });

  it("listObservations falls back to memory records when DB throws", async () => {
    const service = new ContrastSafetyService(failingPrisma as never);

    const created = await service.startObservation({ patientId: "P-9" });
    const result = await service.listObservations();

    expect(result.source).toBe("seed");
    expect(result.items.some((item) => item.id === created.id)).toBe(true);
  });

  it("works in orphan mode without Prisma", async () => {
    const service = new ContrastSafetyService();

    const dto = await service.startObservation({ patientId: "P-ORPHAN" });

    expect(dto.source).toBe("seed");
  });
});
