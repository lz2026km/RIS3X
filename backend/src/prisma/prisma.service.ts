import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { getEnforcedTenantId } from '../common/interceptors/tenant-context.interceptor'
import { dbConnectionErrorsCounter } from '../observability/metrics.factory'

const TENANT_MODELS = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'tenantId'))
    .map((model) => model.name),
)

function withTenantWhere(args: Record<string, unknown>, tenantId: string): void {
  const where = args['where']
  args['where'] = {
    ...(where && typeof where === 'object' ? where as Record<string, unknown> : {}),
    tenantId,
  }
}

function setTenant(data: unknown, tenantId: string): void {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    ;(data as Record<string, unknown>)['tenantId'] = tenantId
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      log: process.env['NODE_ENV'] === 'production' ? ['error'] : ['query', 'info', 'warn', 'error'],
    })
    this.$on('error' as never, (_event: unknown) => {
      dbConnectionErrorsCounter.inc()
    })
  }

  // [W6] DB 不可用时降级启动: 仅告警不抛错, 各业务服务走内存 seed/回退路径,
  //      避免后端整体 500 (GET /ai-diagnosis/*/results 等纯内存端点也需可用)。
  async onModuleInit() {
    try {
      await this.$connect()
    } catch (error) {
      dbConnectionErrorsCounter.inc()
      this.logger.warn(
        `[W6] Prisma $connect failed (${error instanceof Error ? error.message : 'unknown error'}), ` +
          'starting WITHOUT DB — memory seed/fallback paths will be used.',
      )
    }
  }
}

export const createPrismaWithTenant = (client: PrismaClient) => {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const tenantId = getEnforcedTenantId()
          if (!tenantId || !TENANT_MODELS.has(model)) return query(args)

          const values = args as Record<string, unknown>
          if (operation === 'create') {
            setTenant(values['data'], tenantId)
          } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
            const data = values['data']
            if (Array.isArray(data)) {
              for (const item of data) setTenant(item, tenantId)
            } else {
              setTenant(data, tenantId)
            }
          } else if ([
            'findUnique',
            'findUniqueOrThrow',
            'findFirst',
            'findFirstOrThrow',
            'findMany',
            'count',
            'aggregate',
            'groupBy',
            'delete',
            'deleteMany',
          ].includes(operation)) {
            withTenantWhere(values, tenantId)
          } else if (['update', 'updateMany', 'updateManyAndReturn'].includes(operation)) {
            withTenantWhere(values, tenantId)
            setTenant(values['data'], tenantId)
          } else if (operation === 'upsert') {
            withTenantWhere(values, tenantId)
            setTenant(values['create'], tenantId)
            setTenant(values['update'], tenantId)
          }

          return query(args)
        },
      },
    },
  })
}

