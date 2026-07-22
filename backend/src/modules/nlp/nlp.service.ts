import { Injectable } from '@nestjs/common'

export interface SpellCheckResult {
  original: string
  suggestions: SpellCheckItem[]
}

export interface SpellCheckItem {
  offset: number
  length: number
  word: string
  candidates: string[]
}

export interface TerminologyResult {
  original: string
  normalized: TerminologyItem[]
}

export interface TerminologyItem {
  offset: number
  length: number
  term: string
  preferred: string
}

const COMMON_ERRORS: Record<string, string[]> = {
  '肝囊肿': ['肝囊肿'],
  '肝硬化': ['肝硬化'],
  '结节': ['结节'],
  '磨玻璃': ['磨玻璃', '磨玻璃影'],
  '斑片': ['斑片'],
  '钙化': ['钙化'],
  '纤维化': ['纤维化'],
  '肺气肿': ['肺气肿'],
  '胸腔积液': ['胸腔积液'],
  '纵隔': ['纵隔'],
}

const TERMINOLOGY_MAP: Record<string, string> = {
  '肝占位': '肝脏占位性病变',
  '肺占位': '肺部占位性病变',
  'CA': '癌',
  'MT': '恶性肿瘤',
  '淋巴结肿大': '淋巴结增大',
  '胸水': '胸腔积液',
  '腹水': '腹腔积液',
  '支扩': '支气管扩张',
  '慢支': '慢性支气管炎',
  '肺Ca': '肺癌',
  '肝Ca': '肝癌',
}

const CHINESE_CHARS = /[\u4e00-\u9fff]/g

@Injectable()
export class NlpService {
  async spellcheck(text: string): Promise<SpellCheckResult> {
    const suggestions: SpellCheckItem[] = []
    for (const [word] of Object.entries(COMMON_ERRORS)) {
      let idx = 0
      while (true) {
        const pos = text.indexOf(word, idx)
        if (pos === -1) break
        suggestions.push({ offset: pos, length: word.length, word, candidates: COMMON_ERRORS[word] })
        idx = pos + 1
      }
    }
    const words = text.match(CHINESE_CHARS)
    if (words) {
      for (let i = 0; i < words.length; i++) {
        if (words[i] === ' ' || words[i].length > 1) continue
      }
    }
    return { original: text, suggestions }
  }

  async terminology(text: string): Promise<TerminologyResult> {
    const normalized: TerminologyItem[] = []
    for (const [term, preferred] of Object.entries(TERMINOLOGY_MAP)) {
      let idx = 0
      while (true) {
        const pos = text.indexOf(term, idx)
        if (pos === -1) break
        const exists = normalized.some(n => n.offset === pos)
        if (!exists) {
          normalized.push({ offset: pos, length: term.length, term, preferred })
        }
        idx = pos + 1
      }
    }
    return { original: text, normalized }
  }
}
