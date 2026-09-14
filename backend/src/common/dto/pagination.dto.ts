/**
 * [v3.0.6.11-104 Wave 1C] 统一列表查询 DTO
 *
 * 供各模块列表端点复用的分页 + 常用筛选参数定义:
 *  - 分页: page/pageSize (统一模式) 或 skip/take (兼容既有 offset/limit 调用)
 *  - 筛选: keyword/status/dateFrom/dateTo
 *
 * 所有字段可选, 未传时保持各 service 既有默认行为, 向后兼容。
 */
import { z } from 'zod'

/** 分页参数上限 (与 worklist 保持一致) */
export const MAX_PAGE_SIZE = 200

/** 分页查询参数 (page/pageSize 与 skip/take 两种形态兼容) */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
})

/** 统一列表查询: 分页 + 常用筛选 */
export const ListQuerySchema = PaginationQuerySchema.extend({
  keyword: z.string().max(128).optional(),
  status: z.string().max(512).optional(),
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
})

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
export type ListQuery = z.infer<typeof ListQuerySchema>

/**
 * 将统一分页参数解析为 Prisma 的 skip/take。
 * 优先 page/pageSize; 未提供 page/pageSize 时回退 skip/take;
 * 两者均未提供时返回空对象 (交由 service 默认值处理, 保持向后兼容)。
 */
export function resolvePagination(
  query: PaginationQuery,
  defaultPageSize = 20,
): { skip?: number; take?: number } {
  if (query.page === undefined && query.pageSize === undefined) {
    return { skip: query.skip, take: query.take }
  }
  const pageSize = query.pageSize ?? defaultPageSize
  const page = query.page ?? 1
  return { skip: (page - 1) * pageSize, take: pageSize }
}
