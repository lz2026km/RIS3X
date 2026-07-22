import { Injectable } from '@nestjs/common'

export interface CrossModalResult {
  id: string
  patientName: string
  patientId: string
  modality: string
  studyDate: string
  description: string
  similarity: number
  thumbnail?: string
}

const mockImages: CrossModalResult[] = [
  { id: 'img-001', patientName: 'Zhang San', patientId: 'P001', modality: 'CT', studyDate: '2026-07-10', description: 'Chest CT with nodule', similarity: 0.95, thumbnail: '/mock-images/ct-001.png' },
  { id: 'img-002', patientName: 'Li Si', patientId: 'P002', modality: 'MR', studyDate: '2026-07-11', description: 'Brain MRI tumor', similarity: 0.88, thumbnail: '/mock-images/mr-001.png' },
  { id: 'img-003', patientName: 'Wang Wu', patientId: 'P003', modality: 'CT', studyDate: '2026-07-12', description: 'Chest CT follow-up', similarity: 0.82, thumbnail: '/mock-images/ct-002.png' },
  { id: 'img-004', patientName: 'Zhao Liu', patientId: 'P004', modality: 'DX', studyDate: '2026-07-09', description: 'Chest X-ray pneumonia', similarity: 0.79 },
  { id: 'img-005', patientName: 'Chen Qi', patientId: 'P005', modality: 'MR', studyDate: '2026-07-08', description: 'Knee MRI meniscus tear', similarity: 0.91, thumbnail: '/mock-images/mr-001.png' },
]

@Injectable()
export class CrossModalService {
  search(query: string): CrossModalResult[] {
    if (!query) return mockImages.slice(0, 3)
    const q = query.toLowerCase()
    return mockImages.filter(i =>
      i.patientName.toLowerCase().includes(q) ||
      i.patientId.toLowerCase().includes(q) ||
      i.modality.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q)
    )
  }

  findSimilar(imageId: string): CrossModalResult[] {
    const source = mockImages.find(i => i.id === imageId)
    if (!source) return mockImages.slice(0, 3)
    return mockImages
      .filter(i => i.id !== imageId)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
  }
}
