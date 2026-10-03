// [fix] W4-C 全面点击回归修复新增 i18n 键。
// 由 appI18n.ts 通过 import.meta.glob('./namespaces/*.ts', { eager: true }) 自动合并。
export default {
  zh: {
    'w4cFixes.offline.refreshed': '离线报告已刷新',
    'w4cFixes.offline.refreshing': '刷新中...',
  },
  en: {
    'w4cFixes.offline.refreshed': 'Offline reports refreshed',
    'w4cFixes.offline.refreshing': 'Refreshing...',
  },
}
