import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { NotFoundException } from '@nestjs/common'
import { TeachService } from '../src/modules/teach/teach.service'

describe('TeachService', () => {
  let svc: TeachService
  let mockPrisma: any
  let blobDir: string

  beforeEach(() => {
    blobDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teach-'))
    process.env.TEACH_BLOB_DIR = blobDir
    mockPrisma = {
      teachLecture: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      teachLectureBlob: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
    }
    svc = new TeachService(mockPrisma)
  })

  afterEach(() => {
    delete process.env.TEACH_BLOB_DIR
    fs.rmSync(blobDir, { recursive: true, force: true })
  })

  it('create stores lecture with tenant', async () => {
    mockPrisma.teachLecture.create.mockResolvedValue({ id: 'lecture-1', title: '疑难病例' })
    const result = await svc.create({ title: '疑难病例', patientId: 'p1', examId: 'e1', reportId: 'r1', userId: 'u1' })
    expect(result.id).toBe('lecture-1')
    expect(mockPrisma.teachLecture.create).toHaveBeenCalled()
  })

  it('uploadBlob writes file and creates blob record', async () => {
    mockPrisma.teachLecture.findUnique.mockResolvedValue({ id: 'lecture-1' })
    mockPrisma.teachLectureBlob.create.mockResolvedValue({ id: 'b1' })
    const result = await svc.uploadBlob('lecture-1', Buffer.from([1, 2, 3]), 7)
    expect(result.filename).toBe('lecture-1-00007.webm')
    expect(result.sizeBytes).toBe(3)
    const filePath = path.join(blobDir, 'lecture-1-00007.webm')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('uploadBlob throws when lecture missing', async () => {
    mockPrisma.teachLecture.findUnique.mockResolvedValue(null)
    await expect(svc.uploadBlob('nope', Buffer.alloc(2), 1)).rejects.toThrow(NotFoundException)
  })

  it('findById returns lecture with blobs or throws', async () => {
    mockPrisma.teachLecture.findUnique.mockResolvedValue({ id: 'l1', blobs: [] })
    await expect(svc.findById('l1')).resolves.toMatchObject({ id: 'l1' })
    mockPrisma.teachLecture.findUnique.mockResolvedValue(null)
    await expect(svc.findById('missing')).rejects.toThrow(NotFoundException)
  })

  it('findAll supports pagination and search', async () => {
    mockPrisma.teachLecture.findMany.mockResolvedValue([{ id: 'l1' }])
    mockPrisma.teachLecture.count.mockResolvedValue(1)
    const result = await svc.findAll({ page: 2, pageSize: 10, search: '肺' })
    expect(result).toMatchObject({ total: 1, page: 2, pageSize: 10 })
    expect(result.items).toHaveLength(1)
  })

  it('delete removes blobs and records', async () => {
    const blob = path.join(blobDir, 'l1-00001.webm')
    fs.writeFileSync(blob, 'x')
    mockPrisma.teachLecture.findUnique.mockResolvedValue({ id: 'l1' })
    mockPrisma.teachLectureBlob.findMany.mockResolvedValue([{ filename: 'l1-00001.webm' }])
    const result = await svc.delete('l1')
    expect(result).toEqual({ deleted: 'l1' })
    expect(mockPrisma.teachLectureBlob.deleteMany).toHaveBeenCalled()
  })

  it('delete throws when lecture missing', async () => {
    mockPrisma.teachLecture.findUnique.mockResolvedValue(null)
    await expect(svc.delete('missing')).rejects.toThrow(NotFoundException)
  })
})
