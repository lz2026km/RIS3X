/**
 * G005 RIS v3.0.6.11-101 Wave 7A — AI 报告助理 V2 (F1): 内存 seed 数据
 * 孤儿模块回退: DB 不可用时草稿历史从内存 seed 返回 (对齐 ai-diagnosis 的 seed 模式)。
 */
import type { GenerateDraftV2Result } from './ai-draft-v2.service'

export const SEED_DRAFTS: GenerateDraftV2Result[] = [
  {
    id: 'draft-v2-seed-ct-chest',
    segments: [
      {
        id: 'seg-v2-seed-1',
        paragraphType: 'technique',
        heading: '检查技术',
        content: '胸部CT平扫+增强扫描',
        confidence: 0.96,
        sources: [{ kind: 'seed', refId: 'seed:ct-chest', description: 'seed 模板: 胸部CT', confidence: 0.96 }],
      },
      {
        id: 'seg-v2-seed-2',
        paragraphType: 'findings',
        heading: '影像所见',
        content: '双肺纹理清晰，走行自然；右肺上叶可见大小约18mm×15mm结节影，边缘毛刺，与既往检查相比无明显变化。',
        confidence: 0.91,
        sources: [{ kind: 'seed', refId: 'seed:ct-chest', description: 'seed 示例所见 (含测量/对比字段)', confidence: 0.91 }],
      },
      {
        id: 'seg-v2-seed-3',
        paragraphType: 'conclusion',
        heading: '诊断意见',
        content: '右肺上叶结节，考虑周围型肺癌可能，建议结合临床随访。',
        confidence: 0.87,
        sources: [{ kind: 'seed', refId: 'seed:ct-chest', description: 'seed 示例结论', confidence: 0.87 }],
      },
    ],
    overallConfidence: 0.91,
    modelVersion: 'ai-assistant-v2.0.0',
    generatedAt: new Date('2026-08-01T08:00:00.000Z'),
    simulated: true,
  },
  {
    id: 'draft-v2-seed-mr-head',
    segments: [
      {
        id: 'seg-v2-seed-m1',
        paragraphType: 'technique',
        heading: '检查技术',
        content: '头颅MRI平扫 (T1WI/T2WI/FLAIR/DWI)',
        confidence: 0.96,
        sources: [{ kind: 'seed', refId: 'seed:mr-head', description: 'seed 模板: 头颅MRI', confidence: 0.96 }],
      },
      {
        id: 'seg-v2-seed-m2',
        paragraphType: 'findings',
        heading: '影像所见',
        content: '双侧大脑半球对称，脑灰白质信号正常，未见明显异常信号影；DWI未见明显弥散受限。',
        confidence: 0.93,
        sources: [{ kind: 'seed', refId: 'seed:mr-head', description: 'seed 示例所见 (阴性)', confidence: 0.93 }],
      },
      {
        id: 'seg-v2-seed-m3',
        paragraphType: 'conclusion',
        heading: '诊断意见',
        content: '头颅MRI平扫未见明显异常。',
        confidence: 0.94,
        sources: [{ kind: 'seed', refId: 'seed:mr-head', description: 'seed 示例结论 (阴性)', confidence: 0.94 }],
      },
    ],
    overallConfidence: 0.94,
    modelVersion: 'ai-assistant-v2.0.0',
    generatedAt: new Date('2026-08-02T09:30:00.000Z'),
    simulated: true,
  },
]
