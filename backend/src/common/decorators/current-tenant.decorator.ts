import { createParamDecorator } from '@nestjs/common'
import { getCurrentTenantId } from '../interceptors/tenant-context.interceptor'

export const CurrentTenant = createParamDecorator(
  (): string => getCurrentTenantId(),
)
