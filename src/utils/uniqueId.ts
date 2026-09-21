let seq = 0

/**
 * 生成进程内单调递增、同毫秒不冲突的 ID。
 * 格式: `<prefix>-<base36(ts)>-<base36(seq)>-<random>`
 * 修复历史缺陷: 仅用 Date.now() 生成 ID 时, 同一毫秒内多次调用会得到相同 ID
 * (演示数据/Mock/前端业务服务中大量存在), 导致列表 key 重复、查找错乱。
 */
export function uniqueId(prefix = 'id'): string {
  seq = (seq + 1) % Number.MAX_SAFE_INTEGER
  const stamp = Date.now().toString(36)
  const counter = seq.toString(36)
  const rand = Math.random().toString(36).slice(2, 7)
  return `${prefix}-${stamp}-${counter}-${rand}`
}

/** 仅返回时间戳+自增段 (不含随机段), 适用于需要确定性可读的编号。 */
export function uniqueStamp(): string {
  seq = (seq + 1) % Number.MAX_SAFE_INTEGER
  return `${Date.now().toString(36)}${seq.toString(36)}`
}

/** 导出计数器快照, 便于测试断言唯一性。 */
export function __uniqueIdSeq(): number {
  return seq
}
