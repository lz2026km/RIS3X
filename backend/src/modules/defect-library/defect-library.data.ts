/**
 * [G005 W9-QC] 规范化缺陷库种子数据: 6 类别 / 24 缺陷项
 */
import type { DefectCategory, DefectItem } from './defect-library.types'

export const DEFECT_CATEGORIES: DefectCategory[] = [
  { id: 'dc-01', code: 'STRUCT', name: '结构完整性', nameEn: 'Structural completeness', description: '报告要素/所见/印象/签名等结构性缺陷' },
  { id: 'dc-02', code: 'TERM', name: '术语规范', nameEn: 'Terminology', description: '术语、方位、测量、RADS 分类等规范性缺陷' },
  { id: 'dc-03', code: 'ACCUR', name: '描述准确性', nameEn: 'Accuracy', description: '所见与印象矛盾、漏报、误诊等准确性缺陷' },
  { id: 'dc-04', code: 'TIMELY', name: '时效缺陷', nameEn: 'Timeliness', description: 'TAT 超时、签发延迟等时效性缺陷' },
  { id: 'dc-05', code: 'IMAGE', name: '图像质量', nameEn: 'Image quality', description: '伪影、曝光、剂量、体位等图像缺陷' },
  { id: 'dc-06', code: 'PROC', name: '流程与安全', nameEn: 'Process & safety', description: '危急值、对比剂、知情同意、辐射安全等' },
]

export const DEFECT_ITEMS: DefectItem[] = [
  { id: 'di-01', code: 'ST-01', categoryCode: 'STRUCT', name: '报告五要素缺失', severity: 'high', description: '患者信息/检查项目/技术参数/影像所见/诊断印象不全', standard: 'RQ-01', checkMethod: '结构化校验' },
  { id: 'di-02', code: 'ST-02', categoryCode: 'STRUCT', name: '诊断印象未分层', severity: 'medium', description: '未按主要诊断/次要发现/随访建议分层', standard: 'RQ-02' },
  { id: 'di-03', code: 'ST-03', categoryCode: 'STRUCT', name: '未对比既往', severity: 'medium', description: '有既往影像但未说明变化', standard: 'RQ-03' },
  { id: 'di-04', code: 'ST-04', categoryCode: 'STRUCT', name: '缺审核签名', severity: 'high', description: '报告无双签或审核签名缺失', standard: 'RQ-13' },
  { id: 'di-05', code: 'ST-05', categoryCode: 'STRUCT', name: '模板残留/占位符', severity: 'high', description: 'XXX/待补充/示例等残留文本', standard: 'scoring-v3' },
  { id: 'di-06', code: 'TM-01', categoryCode: 'TERM', name: '模糊表述', severity: 'medium', description: '使用"好像/似乎/可能吧"等非规范表述', standard: 'RQ-04' },
  { id: 'di-07', code: 'TM-02', categoryCode: 'TERM', name: '左右方位错误', severity: 'critical', description: '左右/前后方位与图像不一致', standard: 'RQ-05' },
  { id: 'di-08', code: 'TM-03', categoryCode: 'TERM', name: '测量不规范', severity: 'medium', description: '病灶未测量或未标注单位', standard: 'RQ-06' },
  { id: 'di-09', code: 'TM-04', categoryCode: 'TERM', name: 'RADS 分级缺失', severity: 'medium', description: '肺结节/乳腺/前列腺未用相应 RADS 分级', standard: 'RQ-11' },
  { id: 'di-10', code: 'AC-01', categoryCode: 'ACCUR', name: '所见与印象矛盾', severity: 'critical', description: '印象段结论无征象支持或前后矛盾', standard: 'RQ-07' },
  { id: 'di-11', code: 'AC-02', categoryCode: 'ACCUR', name: '阴性结果漏报', severity: 'medium', description: '常规结构阴性描述缺失', standard: 'RQ-08' },
  { id: 'di-12', code: 'AC-03', categoryCode: 'ACCUR', name: '结论不明确', severity: 'medium', description: '未给出明确诊断或鉴别建议', standard: 'RQ-10' },
  { id: 'di-13', code: 'AC-04', categoryCode: 'ACCUR', name: '漏诊', severity: 'critical', description: '复核发现阳性病灶未报告', standard: 'QI-R03' },
  { id: 'di-14', code: 'AC-05', categoryCode: 'ACCUR', name: '误诊', severity: 'critical', description: '诊断与病理/手术/随访不符', standard: 'QI-R04' },
  { id: 'di-15', code: 'TI-01', categoryCode: 'TIMELY', name: '急诊报告超时', severity: 'high', description: '急诊报告未在 2 小时内出具', standard: 'RQ-12' },
  { id: 'di-16', code: 'TI-02', categoryCode: 'TIMELY', name: '平诊报告超时', severity: 'medium', description: '平诊报告未在 24 小时内出具', standard: 'QI-P10' },
  { id: 'di-17', code: 'TI-03', categoryCode: 'TIMELY', name: '提交/签发延迟', severity: 'low', description: '书写完成到提交或签发的间隔超标', standard: 'scoring-v3' },
  { id: 'di-18', code: 'IM-01', categoryCode: 'IMAGE', name: '运动/呼吸伪影', severity: 'medium', description: '影响诊断的伪影', standard: 'RQI-IIA-01' },
  { id: 'di-19', code: 'IM-02', categoryCode: 'IMAGE', name: '曝光不足/过度', severity: 'medium', description: '图像噪声或过曝影响评估', standard: 'QI-P08' },
  { id: 'di-20', code: 'IM-03', categoryCode: 'IMAGE', name: '扫描范围不足', severity: 'high', description: '目标部位未完整覆盖', standard: 'QI-P04' },
  { id: 'di-21', code: 'IM-04', categoryCode: 'IMAGE', name: '废片/重拍', severity: 'medium', description: '因图像质量需重拍', standard: 'QI-P09' },
  { id: 'di-22', code: 'PR-01', categoryCode: 'PROC', name: '危急值未及时通报', severity: 'critical', description: '危急值未在 10 分钟内通报', standard: 'RQI-RCV-04' },
  { id: 'di-23', code: 'PR-02', categoryCode: 'PROC', name: '对比剂外渗/不良反应', severity: 'high', description: '增强检查对比剂外渗或严重不良反应', standard: 'RQI-ICME-05' },
  { id: 'di-24', code: 'PR-03', categoryCode: 'PROC', name: '知情同意缺失', severity: 'high', description: '增强检查未签署知情同意书', standard: 'QI-P06' },
]
