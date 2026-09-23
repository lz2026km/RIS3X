import { useMemo } from 'react'
import { pinyin } from 'pinyin-pro'
import type { Patient } from '../../types'
import type { RadiologyExam } from '../../types'
import type { PMISearchResult, DuplicateMatch } from './types'

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return dateStr
}

export const getAgeFromIdCard = (idCard: string): number => {
  if (!idCard || idCard.length < 6) return 0
  const birthYear = parseInt(idCard.substring(0, 4))
  const currentYear = new Date().getFullYear()
  return currentYear - birthYear
}

export const getBirthDateFromIdCard = (idCard: string): string => {
  if (!idCard || idCard.length < 14) return '-'
  return `${idCard.substring(0, 4)}-${idCard.substring(4, 6)}-${idCard.substring(6, 8)}`
}

export const getPatientExams = (patientId: string, exams: RadiologyExam[]) => {
  return exams.filter(e => e.patientId === patientId)
}

export const getPatientStats = (patientId: string, exams: RadiologyExam[]) => {
  const patientExams = getPatientExams(patientId, exams)
  const completedExams = patientExams.filter(e => String(e.status) === '已完成' || e.status === '待报告' || e.status === '检查中')
  const positiveCount = completedExams.filter(e => e.criticalFinding === true || e.priority === '紧急' || e.priority === '危重').length
  const negativeCount = completedExams.length - positiveCount
  const firstExam = patientExams.length > 0 ? patientExams[patientExams.length - 1] : null
  return {
    totalExams: patientExams.length,
    completedExams: completedExams.length,
    positiveCount,
    negativeCount,
    firstExamDate: firstExam ? firstExam.examDate : '-'
  }
}

export const findDuplicatePatients = (patients: Patient[]): DuplicateMatch[] => {
  const duplicates: DuplicateMatch[] = []
  for (let i = 0; i < patients.length; i++) {
    for (let j = i + 1; j < patients.length; j++) {
      const a = patients[i]!
      const b = patients[j]!
      const matchedFields: string[] = []
      let score = 0
      if (a.name === b.name) { score += 40; matchedFields.push('姓名精确') }
      else if (a.name.slice(0, 2) === b.name.slice(0, 2)) { score += 20; matchedFields.push('姓名模糊') }
      if (a.idCard && b.idCard && a.idCard === b.idCard) { score += 30; matchedFields.push('身份证') }
      else if (a.idCard && b.idCard && a.idCard.slice(0, 6) === b.idCard.slice(0, 6)) { score += 10; matchedFields.push('身份证前缀') }
      if (a.phone && b.phone && a.phone === b.phone) { score += 20; matchedFields.push('手机号') }
      if (a.gender === b.gender) { score += 5; matchedFields.push('性别一致') }
      if (Math.abs(a.age - b.age) <= 3) { score += 5; matchedFields.push('年龄相近') }
      if (score >= 50) {
        duplicates.push({ patients: [a, b], score, matchedFields })
      }
    }
  }
  return duplicates.sort((a, b) => b.score - a.score)
}

const mockPMIPatients: PMISearchResult[] = [
  {
    patientId: 'P001', pmiId: 'PMI-420100-00001', name: '张三', gender: '男', age: 58,
    idCard: '420106197506120315', phone: '13800138001', patientType: '住院',
    insuranceType: '城镇职工基本医疗保险', confidence: 100,
    matchFields: ['姓名', '身份证', '手机号'],
    examStats: { totalExams: 12, positiveRate: 25.0, lastExamDate: '2026-05-20' },
    hasMergeHistory: true,
    mergeHistory: [{ mergedToId: 'P001', mergedFromId: 'OLD-2018-001', mergedDate: '2023-06-15', reason: '重复建档归并' }]
  },
  {
    patientId: 'P002', pmiId: 'PMI-420100-00002', name: '李四', gender: '女', age: 45,
    idCard: '420106198512250326', phone: '13900139002', patientType: '门诊',
    insuranceType: '城乡居民基本医疗保险', confidence: 95,
    matchFields: ['姓名', '手机号'],
    examStats: { totalExams: 5, positiveRate: 20.0, lastExamDate: '2026-05-18' },
    hasMergeHistory: false, mergeHistory: []
  },
  {
    patientId: 'P003', pmiId: 'PMI-420100-00003', name: '王五', gender: '男', age: 72,
    idCard: '420106195408030712', phone: '13700137003', patientType: '急诊',
    insuranceType: '自费', confidence: 88,
    matchFields: ['身份证'],
    examStats: { totalExams: 23, positiveRate: 43.5, lastExamDate: '2026-05-22' },
    hasMergeHistory: true,
    mergeHistory: [
      { mergedToId: 'P003', mergedFromId: 'HOSP-2015-888', mergedDate: '2022-03-10', reason: '历史数据整合' },
      { mergedToId: 'OLD-2016-123', mergedFromId: 'P003', mergedDate: '2021-11-20', reason: '主索引修正' }
    ]
  },
  {
    patientId: 'P004', pmiId: 'PMI-420100-00004', name: '赵六', gender: '女', age: 33,
    idCard: '420123199308150429', phone: '13600136004', patientType: '体检',
    insuranceType: '商业医疗保险', confidence: 92,
    matchFields: ['姓名', '身份证'],
    examStats: { totalExams: 2, positiveRate: 0, lastExamDate: '2026-04-10' },
    hasMergeHistory: false, mergeHistory: []
  },
  {
    patientId: 'P005', pmiId: 'PMI-420100-00005', name: '钱七', gender: '男', age: 67,
    idCard: '420124196809050831', phone: '13500135005', patientType: '住院',
    insuranceType: '城镇职工基本医疗保险', confidence: 78,
    matchFields: ['姓名'],
    examStats: { totalExams: 18, positiveRate: 33.3, lastExamDate: '2026-05-21' },
    hasMergeHistory: true,
    mergeHistory: [{ mergedToId: 'P005', mergedFromId: 'LOCAL-2019-056', mergedDate: '2024-01-08', reason: '患者信息补全归并' }]
  }
]

export const searchPMIPatients = (query: string): PMISearchResult[] => {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return mockPMIPatients.filter(p => {
    return (
      p.name.toLowerCase().includes(q) ||
      p.patientId.toLowerCase().includes(q) ||
      p.pmiId.toLowerCase().includes(q) ||
      p.idCard.includes(query) ||
      p.phone.includes(query)
    )
  }).map(p => {
    let confidence = p.confidence
    const matchFields: string[] = []
    if (p.name.toLowerCase().includes(q)) { matchFields.push('姓名'); confidence = Math.max(confidence, 90) }
    if (p.idCard.includes(query)) { matchFields.push('身份证'); confidence = Math.max(confidence, 95) }
    if (p.phone.includes(query)) { matchFields.push('手机号'); confidence = Math.max(confidence, 98) }
    if (p.pmiId.toLowerCase().includes(q)) { matchFields.push('主索引ID'); confidence = Math.max(confidence, 100) }
    return { ...p, confidence, matchFields }
  }).sort((a, b) => b.confidence - a.confidence)
}

export const usePinyinSearch = (patients: Patient[], query: string) => {
  return useMemo(() => {
    if (!query.trim()) return patients
    const q = query.toLowerCase().trim()
    return patients.filter(p => {
      if (p.name.toLowerCase().includes(q)) return true
      if (p.id.toLowerCase().includes(q)) return true
      if (p.idCard.includes(q)) return true
      if (p.phone.includes(q)) return true
      try {
        const namePinyin = pinyin(p.name, { toneType: 'none', separator: '' }).toLowerCase()
        const namePinyinWithSpace = pinyin(p.name, { toneType: 'none', separator: ' ' }).toLowerCase()
        if (namePinyin.includes(q) || namePinyinWithSpace.includes(q)) return true
        const initials = pinyin(p.name, { pattern: 'first', toneType: 'none' }).toLowerCase()
        if (initials.includes(q)) return true
      } catch { /* ignore pinyin errors */ }
      return false
    })
  }, [patients, query])
}
