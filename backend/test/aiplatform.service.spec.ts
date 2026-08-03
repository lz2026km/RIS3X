import { AiPlatformService } from '../src/aiplatform/aiplatform.service'

describe('AiPlatformService', () => {
  let svc: AiPlatformService
  let mockPrisma: any

  beforeEach(() => {
    jest.useFakeTimers()
    mockPrisma = {
      auditLog: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      device: { findMany: jest.fn() },
      aiModel: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      aiJob: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      aiWorkflowIntegration: { findMany: jest.fn(), create: jest.fn() },
    }
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit1' })
    svc = new AiPlatformService(mockPrisma)
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('模型注册表', () => {
    it('listAiModels 返回模型并附加部署/集成计数', async () => {
      mockPrisma.aiModel.findMany.mockResolvedValue([
        { id: 'm1', name: 'LungNet', version: '2.3', status: 'DEPLOYED' },
        { id: 'm2', name: 'FracNet', version: '1.0', status: 'REGISTERED' },
      ])
      mockPrisma.aiJob.findMany.mockResolvedValue([{ modelId: 'm1' }, { modelId: 'm1' }])
      mockPrisma.aiWorkflowIntegration.findMany.mockResolvedValue([{ modelId: 'm1' }])
      const r = await svc.listAiModels()
      expect(r.data).toHaveLength(2)
      expect(r.data[0]).toMatchObject({ deploymentCount: 2, integrationCount: 1 })
      expect(r.data[1]).toMatchObject({ deploymentCount: 0, integrationCount: 0 })
    })

    it('getAiModel 返回模型, 不存在抛 NotFound', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue({ id: 'm1' })
      await expect(svc.getAiModel('m1')).resolves.toMatchObject({ data: [{ id: 'm1' }] })
      mockPrisma.aiModel.findUnique.mockResolvedValue(null)
      await expect(svc.getAiModel('x')).rejects.toThrow()
    })

    it('createAiModel 注册模型并写审计', async () => {
      mockPrisma.aiModel.create.mockResolvedValue({ id: 'm1', status: 'REGISTERED' })
      const r = await svc.createAiModel({ name: 'LungNet', version: '1.0', vendor: 'DeepHealth', endpoint: 'https://ai.local/lung' })
      expect(mockPrisma.aiModel.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ name: 'LungNet', status: 'REGISTERED' }),
      }))
      expect(r.data).toHaveLength(1)
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'REGISTER' }),
      }))
    })
  })

  describe('部署管理', () => {
    it('deployAiModel 状态变更 + 审计记录', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue({ id: 'm1', name: 'LungNet' })
      mockPrisma.aiModel.update.mockResolvedValue({ id: 'm1', status: 'DEPLOYED', deployedAt: new Date() })
      const r = await svc.deployAiModel('m1', { endpoint: 'https://ai.local/lung' })
      expect(mockPrisma.aiModel.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'DEPLOYED' }),
      }))
      expect(r.data[0].status).toBe('DEPLOYED')
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'DEPLOY' }),
      }))
    })

    it('deployAiModel 模型不存在抛 NotFound', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue(null)
      await expect(svc.deployAiModel('x', {})).rejects.toThrow()
    })

    it('undeployAiModel 状态回退并清空部署时间', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue({ id: 'm1' })
      mockPrisma.aiModel.update.mockResolvedValue({ id: 'm1', status: 'UNDEPLOYED', deployedAt: null })
      const r = await svc.undeployAiModel('m1')
      expect(mockPrisma.aiModel.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'UNDEPLOYED', deployedAt: null }),
      }))
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'UNDEPLOY' }),
      }))
    })

    it('testAiModel 返回连通性结果', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue({ id: 'm1', name: 'LungNet', version: '2.3', endpoint: 'https://ai.local/lung' })
      const r = await svc.testAiModel('m1')
      expect(r.data[0]).toMatchObject({ id: 'm1', reachable: expect.any(Boolean), latencyMs: expect.any(Number) })
    })
  })

  describe('工作流集成', () => {
    it('listWorkflowIntegrations 查询集成表', async () => {
      mockPrisma.aiWorkflowIntegration.findMany.mockResolvedValue([{ id: 'w1', modelId: 'm1' }])
      const r = await svc.listWorkflowIntegrations()
      expect(mockPrisma.aiWorkflowIntegration.findMany).toHaveBeenCalled()
      expect(r.data).toHaveLength(1)
    })

    it('createWorkflowIntegration 校验模型存在后创建', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue({ id: 'm1', name: 'LungNet' })
      mockPrisma.aiWorkflowIntegration.create.mockResolvedValue({ id: 'w1' })
      const r = await svc.createWorkflowIntegration({ modelId: 'm1', triggerConditions: { trigger: 'ON_STUDY_COMPLETE', modality: 'CT' }, targetWorkflow: 'lung-report' })
      expect(r.data).toHaveLength(1)
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'LINK' }),
      }))
    })

    it('createWorkflowIntegration 模型不存在抛 BadRequest', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue(null)
      await expect(svc.createWorkflowIntegration({ modelId: 'x', triggerConditions: {}, targetWorkflow: 'w' })).rejects.toThrow()
    })
  })

  describe('触发匹配 + 推理任务', () => {
    it('matchWorkflowTriggers 按条件匹配并创建任务', async () => {
      mockPrisma.aiWorkflowIntegration.findMany.mockResolvedValue([
        { id: 'w1', modelId: 'm1', targetWorkflow: 'wf-a', triggerConditions: { trigger: 'ON_STUDY_COMPLETE', modality: 'CT' } },
        { id: 'w2', modelId: 'm2', targetWorkflow: 'wf-b', triggerConditions: { trigger: 'ON_STUDY_COMPLETE', modality: 'MR' } },
      ])
      mockPrisma.aiJob.create.mockResolvedValue({ id: 'j1' })
      const r = await svc.matchWorkflowTriggers({ trigger: 'ON_STUDY_COMPLETE', examId: 'e1', modality: 'CT' })
      expect(mockPrisma.aiJob.create).toHaveBeenCalledTimes(1)
      expect(r.data.matchedCount).toBe(1)
      expect(r.data.jobs).toEqual([{ id: 'j1' }])
    })

    it('listAiJobs 支持状态/模型过滤', async () => {
      mockPrisma.aiJob.findMany.mockResolvedValue([{ id: 'j1', status: 'COMPLETED' }])
      const r = await svc.listAiJobs({ status: 'COMPLETED', modelId: 'm1' })
      expect(mockPrisma.aiJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'COMPLETED', modelId: 'm1' }),
      }))
      expect(r.data).toHaveLength(1)
    })

    it('getAiJob 返回任务, 不存在抛 NotFound', async () => {
      mockPrisma.aiJob.findUnique.mockResolvedValue({ id: 'j1' })
      await expect(svc.getAiJob('j1')).resolves.toMatchObject({ data: [{ id: 'j1' }] })
      mockPrisma.aiJob.findUnique.mockResolvedValue(null)
      await expect(svc.getAiJob('x')).rejects.toThrow()
    })

    it('triggerAiJob 仅允许已部署模型', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue({ id: 'm1', name: 'LungNet', status: 'REGISTERED' })
      await expect(svc.triggerAiJob({ modelId: 'm1', examId: 'e1' })).rejects.toThrow()
      mockPrisma.aiModel.findUnique.mockResolvedValue({ id: 'm1', name: 'LungNet', status: 'DEPLOYED' })
      mockPrisma.aiJob.create.mockResolvedValue({ id: 'j1', status: 'QUEUED' })
      const r = await svc.triggerAiJob({ modelId: 'm1', examId: 'e1' })
      expect(r.data[0]).toMatchObject({ id: 'j1', status: 'QUEUED' })
    })

    it('buildMockResult 生成带坐标的异常区域', () => {
      const result = (svc as any).buildMockResult('m1')
      expect(result.findings).toBeInstanceOf(Array)
      expect(result.findings[0]).toMatchObject({
        label: expect.any(String),
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
        confidence: expect.any(Number),
      })
    })
  })

  describe('既有端点', () => {
    it('qc / structured-reports / orchestration 保留审计日志语义', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      await svc.listAiQcResults()
      expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { resource: 'ai-qc' } }))
      mockPrisma.auditLog.findUnique.mockResolvedValue({ id: 'a1' })
      await expect(svc.getAiQcResult('a1')).resolves.toMatchObject({ data: [{ id: 'a1' }] })
      await svc.listAiStructuredReports()
      expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { resource: 'ai-structured-report' } }))
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })
      await svc.generateStructuredReport({ findings: 'x' })
      await svc.getAiOrchestration()
      expect(mockPrisma.auditLog.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { resource: 'ai-orchestration' } }))
      await svc.createAiOrchestration({ steps: [] })
      expect(mockPrisma.auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'CREATE' }) }))
    })

    it('medical-devices / workspace / assist / marketplace', async () => {
      mockPrisma.device.findMany.mockResolvedValue([{ id: 'd1' }])
      await expect(svc.listAiMedicalDevices()).resolves.toMatchObject({ data: [{ id: 'd1' }] })
      mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }])
      await expect(svc.getAiFusionWorkspace()).resolves.toMatchObject({ data: [{ id: 'a1' }] })
      await expect(svc.getAiAssist()).resolves.toMatchObject({ data: [{ id: 'a1' }] })
      await expect(svc.getAiMarketplace()).resolves.toMatchObject({ data: [{ id: 'a1' }] })
    })
  })
})
