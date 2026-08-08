// [W3-C] 受控分页 hook — 前端全量数据切片 + 受控 pagination (current/total/onChange)
import { useEffect, useMemo, useState } from 'react'

export interface ControlledPagination {
  current: number
  pageSize: number
  total: number
  showSizeChanger?: boolean
  onChange: (page: number, pageSize: number) => void
}

export function usePagination<T>(
  items: T[],
  pageSize = 10,
): { pageData: T[]; pagination: ControlledPagination } {
  const [current, setCurrent] = useState(1)

  // 数据变化时钳制页码, 避免当前页超出总页数
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
    setCurrent((cur) => Math.min(Math.max(1, cur), totalPages))
  }, [items.length, pageSize])

  const pagination = useMemo<ControlledPagination>(
    () => ({
      current,
      pageSize,
      total: items.length,
      showSizeChanger: false,
      onChange: (page: number, size: number) => {
        setCurrent(page)
        if (size !== pageSize) setCurrent(1)
      },
    }),
    [current, pageSize, items.length],
  )

  const pageData = useMemo(() => {
    const start = (current - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, current, pageSize])

  return { pageData, pagination }
}
