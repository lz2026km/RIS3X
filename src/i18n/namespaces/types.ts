// 分命名空间翻译字典聚合 (每命名空间一个文件, 避免并发整文件覆写导致的丢失)
// 文件格式: export default { zh: { 'key': '中文' }, en: { 'key': 'English' } }
// appI18n.ts 通过 import.meta.glob 自动合并; 新增命名空间只需新增文件, 无需改动本文件。
export interface NamespaceDict {
  zh: Record<string, string>
  en: Record<string, string>
}

export const NAMESPACE_DIR = './namespaces'
