import { Injectable } from '@nestjs/common'

export interface SnomedCode {
  conceptId: string
  fsn: string
  pt: string
  semanticTag: string
  matchType: 'exact' | 'partial' | 'suggested'
  confidence: number
}

const RADIOLOGY_SNOMED_MAP: Record<string, SnomedCode[]> = {
  '结节': [
    { conceptId: '30092000', fsn: 'Nodule (morphologic abnormality)', pt: 'Nodule', semanticTag: 'morphologic abnormality', matchType: 'exact', confidence: 0.98 },
    { conceptId: '406122000', fsn: 'Nodular lesion (morphologic abnormality)', pt: 'Nodular lesion', semanticTag: 'morphologic abnormality', matchType: 'partial', confidence: 0.85 },
  ],
  '钙化': [
    { conceptId: '473840003', fsn: 'Calcification (morphologic abnormality)', pt: 'Calcification', semanticTag: 'morphologic abnormality', matchType: 'exact', confidence: 0.97 },
  ],
  '磨玻璃': [
    { conceptId: '427283000', fsn: 'Ground glass opacity (morphologic abnormality)', pt: 'Ground glass opacity', semanticTag: 'morphologic abnormality', matchType: 'exact', confidence: 0.95 },
  ],
  '胸腔积液': [
    { conceptId: '79619009', fsn: 'Pleural effusion (disorder)', pt: 'Pleural effusion', semanticTag: 'disorder', matchType: 'exact', confidence: 0.99 },
  ],
  '肺气肿': [
    { conceptId: '87433001', fsn: 'Pulmonary emphysema (disorder)', pt: 'Pulmonary emphysema', semanticTag: 'disorder', matchType: 'exact', confidence: 0.98 },
  ],
  '肝囊肿': [
    { conceptId: '40845000', fsn: 'Cyst of liver (disorder)', pt: 'Cyst of liver', semanticTag: 'disorder', matchType: 'exact', confidence: 0.98 },
  ],
  '肝硬化': [
    { conceptId: '19943007', fsn: 'Cirrhosis of liver (disorder)', pt: 'Cirrhosis of liver', semanticTag: 'disorder', matchType: 'exact', confidence: 0.99 },
  ],
  '骨折': [
    { conceptId: '125605004', fsn: 'Fracture of bone (disorder)', pt: 'Fracture of bone', semanticTag: 'disorder', matchType: 'exact', confidence: 0.99 },
    { conceptId: '71638005', fsn: 'Closed fracture (disorder)', pt: 'Closed fracture', semanticTag: 'disorder', matchType: 'partial', confidence: 0.82 },
  ],
  '水肿': [
    { conceptId: '79654002', fsn: 'Edema (finding)', pt: 'Edema', semanticTag: 'finding', matchType: 'exact', confidence: 0.97 },
  ],
  '肿瘤': [
    { conceptId: '363346000', fsn: 'Malignant neoplastic disease (disorder)', pt: 'Malignant neoplasm', semanticTag: 'disorder', matchType: 'partial', confidence: 0.80 },
    { conceptId: '126952004', fsn: 'Benign neoplasm of lung (disorder)', pt: 'Benign neoplasm', semanticTag: 'disorder', matchType: 'partial', confidence: 0.75 },
  ],
  '肺炎': [
    { conceptId: '233604007', fsn: 'Pneumonia (disorder)', pt: 'Pneumonia', semanticTag: 'disorder', matchType: 'exact', confidence: 0.99 },
  ],
}

@Injectable()
export class SnomedService {
  async encode(text: string, modality?: string): Promise<{ text: string; codes: SnomedCode[] }> {
    const codes: SnomedCode[] = []
    for (const [keyword, mappings] of Object.entries(RADIOLOGY_SNOMED_MAP)) {
      if (text.includes(keyword)) {
        for (const m of mappings) {
          if (!codes.some(c => c.conceptId === m.conceptId)) {
            codes.push(m)
          }
        }
      }
    }
    return { text, codes }
  }

  async search(q: string): Promise<SnomedCode[]> {
    if (!q) return []
    const results: SnomedCode[] = []
    for (const [, mappings] of Object.entries(RADIOLOGY_SNOMED_MAP)) {
      for (const m of mappings) {
        if (m.pt.toLowerCase().includes(q.toLowerCase()) || m.fsn.toLowerCase().includes(q.toLowerCase())) {
          if (!results.some(c => c.conceptId === m.conceptId)) {
            results.push(m)
          }
        }
      }
    }
    return results
  }
}
