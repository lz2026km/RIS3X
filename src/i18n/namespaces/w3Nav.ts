// [G005 W3-Nav] 侧边栏导航键: 统一评分台 + 规范化 nav.* 标签 (appI18n 全局 t)。
// 由 appI18n.ts 通过 import.meta.glob('./namespaces/*.ts') 自动合并, 扁平键。
export default {
  zh: {
    'nav.qcScoringCenter': '统一评分台',
    'nav.costDrg': '运营成本与 DRG',
    'nav.deviceOpsCenter': '设备运维中心',
    'nav.reportArchive': '报告归档',
    'nav.mwlManager': 'MWL 管理',
  },
  en: {
    'nav.qcScoringCenter': 'Scoring Center',
    'nav.costDrg': 'Operations Cost & DRG',
    'nav.deviceOpsCenter': 'Device Operations Center',
    'nav.reportArchive': 'Report Archive',
    'nav.mwlManager': 'MWL Manager',
  },
}
