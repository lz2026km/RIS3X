import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { WorkflowService } from "../src/workflow/workflow.service";
import { PrismaService } from "../src/prisma/prisma.service";

describe("WorkflowService", () => {
  let svc: WorkflowService;

  const mockDefinition = {
    id: "wf1",
    name: "CT检查流程",
    description: "CT imaging workflow",
    active: true,
    version: 1,
  };

  const mockStep = {
    id: "ws1",
    workflowId: "wf1",
    name: "申请",
    stepType: "ORDER",
    orderIndex: 1,
  };

  const mockSla = {
    id: "sla1",
    name: "急诊CT",
    modality: "CT",
    priority: "HIGH",
    targetMinutes: 60,
    warningMinutes: 45,
  };

  const mockRule = {
    id: "rr1",
    name: "CT转诊",
    modality: "CT",
    targetDept: "放射科",
    priority: 1,
    active: true,
  };

  let prisma: any;

  const mockPrisma = {
    workflowDefinition: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workflowStep: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    slaPolicy: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    routingRule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    svc = module.get(WorkflowService);
    prisma = module.get(PrismaService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe("Workflow Definitions", () => {
    it("listDefinitions returns all", async () => {
      mockPrisma.workflowDefinition.findMany.mockResolvedValue([
        mockDefinition,
      ]);
      const result = await svc.listDefinitions();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("createDefinition creates", async () => {
      mockPrisma.workflowDefinition.create.mockResolvedValue(mockDefinition);
      const result = await svc.createDefinition({ name: "CT检查流程" });
      expect(result.id).toBe("wf1");
    });

    it("getDefinition returns with steps", async () => {
      mockPrisma.workflowDefinition.findUnique.mockResolvedValue(
        mockDefinition,
      );
      const result = await svc.getDefinition("wf1");
      expect(result!.id).toBe("wf1");
    });

    it("getDefinition returns empty when not found", async () => {
      mockPrisma.workflowDefinition.findUnique.mockResolvedValue(null);
      const result = await svc.getDefinition("x");
      expect(result).toBeNull();
    });

    it("updateDefinition updates", async () => {
      mockPrisma.workflowDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrisma.workflowDefinition.update.mockResolvedValue({
        ...mockDefinition,
        name: "updated",
      });
      const result = await svc.updateDefinition("wf1", { name: "updated" });
      expect(result.name).toBe("updated");
      expect(mockPrisma.workflowDefinition.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "wf1", tenantId: "default" } }),
      );
    });

    it("updateDefinition rejects a definition of another tenant", async () => {
      mockPrisma.workflowDefinition.findFirst.mockResolvedValue(null);
      await expect(
        svc.updateDefinition("wf1", { name: "updated" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("deleteDefinition deletes", async () => {
      mockPrisma.workflowDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrisma.workflowDefinition.delete.mockResolvedValue(mockDefinition);
      const result = await svc.deleteDefinition("wf1");
      expect(result).toEqual({ deleted: true });
      expect(mockPrisma.workflowDefinition.delete).toHaveBeenCalledWith({
        where: { id: "wf1", tenantId: "default" },
      });
    });

    it("deleteDefinition rejects a definition of another tenant", async () => {
      mockPrisma.workflowDefinition.findFirst.mockResolvedValue(null);
      await expect(svc.deleteDefinition("wf1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("activateDefinition activates", async () => {
      mockPrisma.workflowDefinition.findFirst.mockResolvedValue(mockDefinition);
      mockPrisma.workflowDefinition.update.mockResolvedValue({
        ...mockDefinition,
        active: true,
      });
      const result = await svc.activateDefinition({ id: "wf1" });
      expect(result.active).toBe(true);
    });
  });

  describe("Workflow Steps", () => {
    it("listSteps returns steps for workflow", async () => {
      mockPrisma.workflowStep.findMany.mockResolvedValue([mockStep]);
      const result = await svc.listSteps("wf1");
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("addStep creates step", async () => {
      mockPrisma.workflowStep.create.mockResolvedValue(mockStep);
      const result = await svc.addStep({
        workflowId: "wf1",
        name: "申请",
        stepType: "ORDER",
        orderIndex: 1,
      });
      expect(result.id).toBe("ws1");
    });
  });

  describe("SLA Policies", () => {
    it("listSlaPolicies returns all", async () => {
      mockPrisma.slaPolicy.findMany.mockResolvedValue([mockSla]);
      const result = await svc.listSlaPolicies();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("createSlaPolicy creates", async () => {
      mockPrisma.slaPolicy.create.mockResolvedValue(mockSla);
      const result = await svc.createSlaPolicy({
        name: "急诊CT",
        modality: "CT",
        targetMinutes: 60,
        warningMinutes: 45,
      });
      expect(result.name).toBe("急诊CT");
    });

    it("updateSlaPolicy updates", async () => {
      mockPrisma.slaPolicy.findFirst.mockResolvedValue(mockSla);
      mockPrisma.slaPolicy.update.mockResolvedValue({
        ...mockSla,
        targetMinutes: 30,
      });
      const result = await svc.updateSlaPolicy("sla1", { targetMinutes: 30 });
      expect(result.targetMinutes).toBe(30);
    });

    it("deleteSlaPolicy deletes", async () => {
      mockPrisma.slaPolicy.findFirst.mockResolvedValue(mockSla);
      mockPrisma.slaPolicy.delete.mockResolvedValue(mockSla);
      const result = await svc.deleteSlaPolicy("sla1");
      expect(result).toEqual({ deleted: true });
    });
  });

  describe("Routing Rules", () => {
    it("listRoutingRules returns all", async () => {
      mockPrisma.routingRule.findMany.mockResolvedValue([mockRule]);
      const result = await svc.listRoutingRules();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("createRoutingRule creates", async () => {
      mockPrisma.routingRule.create.mockResolvedValue(mockRule);
      const result = await svc.createRoutingRule({
        name: "CT转诊",
        modality: "CT",
        targetDept: "放射科",
        priority: 1,
      });
      expect(result.id).toBe("rr1");
    });

    it("updateRoutingRule updates", async () => {
      mockPrisma.routingRule.findFirst.mockResolvedValue(mockRule);
      mockPrisma.routingRule.update.mockResolvedValue({
        ...mockRule,
        priority: 2,
      });
      const result = await svc.updateRoutingRule("rr1", { priority: 2 });
      expect(result.priority).toBe(2);
    });

    it("deleteRoutingRule deletes", async () => {
      mockPrisma.routingRule.findFirst.mockResolvedValue(mockRule);
      mockPrisma.routingRule.delete.mockResolvedValue(mockRule);
      const result = await svc.deleteRoutingRule("rr1");
      expect(result).toEqual({ deleted: true });
    });
  });
});
