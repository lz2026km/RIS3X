// [G005 W7] 演示/模拟数据徽标 + 页面三态 (loading/empty/error) 通用键
// 由 appI18n.ts 通过 import.meta.glob('./namespaces/*.ts') 自动合并。
export default {
  zh: {
    "w7demo.simulatedBadge": "演示模拟",
    "w7demo.loading": "加载中...",
    "w7demo.loadError": "数据加载失败，请稍后重试",
    "w7demo.retry": "重试",
    "w7demo.refresh": "刷新",
    "w7demo.empty": "暂无数据",
    "w7demo.contrastFallback": "演示数据 · 合规模拟数据",
    "w7demo.kpiEngineSource": "数据源: 本地 KpiEngine（演示）",
    "w7demo.kpiBiSource": "数据源: /bi/kpi（BI 接口）",
    "w7demo.kpiRefreshDone": "KPI 已刷新",
    // [v3.0.6.16-6] 后端已实现规则引擎端点, 如实标注为「规则引擎」而非「演示模拟」
    "w7demo.ruleEngineBadge": "规则引擎",
    "w7demo.ruleEngineTooltip":
      "服务端确定性规则引擎 (非生成式模型), 输出可由输入复现",
    "w7demo.fhirFallback": "演示数据 · 接口不可达回退",
  },
  en: {
    "w7demo.simulatedBadge": "Simulated Demo",
    "w7demo.loading": "Loading...",
    "w7demo.loadError": "Failed to load data. Please retry.",
    "w7demo.retry": "Retry",
    "w7demo.refresh": "Refresh",
    "w7demo.empty": "No data",
    "w7demo.contrastFallback": "Demo data · simulated compliance data",
    "w7demo.kpiEngineSource": "Source: local KpiEngine (demo)",
    "w7demo.kpiBiSource": "Source: /bi/kpi (BI API)",
    "w7demo.kpiRefreshDone": "KPI refreshed",
    "w7demo.ruleEngineBadge": "Rule Engine",
    "w7demo.ruleEngineTooltip":
      "Server-side deterministic rule engine (not a generative model); output is reproducible from input",
    "w7demo.fhirFallback": "Demo data · API unreachable fallback",
  },
};
