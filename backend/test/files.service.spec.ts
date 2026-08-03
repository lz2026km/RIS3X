import { BadRequestException } from '@nestjs/common'
import { FilesService } from '../src/files/files.service'

describe('FilesService', () => {
  let svc: FilesService

  beforeEach(() => {
    svc = new FilesService({ get: () => 'uploads' } as any)
  })

  it('getUploadUrl returns presigned URL for allowed mime', () => {
    const r = svc.getUploadUrl('exam.dcm', 'image/dicom')
    expect(r.token).toMatch(/^[0-9a-f]{32}$/)
    expect(r.uploadUrl).toContain('/api/files/upload/')
    expect(r.expiresAt).toBeDefined()
  })

  it('getUploadUrl rejects missing filename', () => {
    expect(() => svc.getUploadUrl('', 'image/jpeg')).toThrow(BadRequestException)
  })

  it('getUploadUrl rejects disallowed mime type', () => {
    expect(() => svc.getUploadUrl('a.exe', 'application/x-msdownload')).toThrow(BadRequestException)
  })

  it('getUploadUrl rejects disallowed extension', () => {
    expect(() => svc.getUploadUrl('a.exe', 'application/octet-stream')).toThrow(BadRequestException)
  })

  it('getUploadUrl sanitizes path and encodes name', () => {
    const r = svc.getUploadUrl('../evil/photo.png', 'image/png')
    expect(r.uploadUrl).toContain('photo.png')
  })

  it('confirmUpload returns download metadata', () => {
    const r = svc.confirmUpload('tok', { size: 1024, checksum: 'abc', filename: '../x/report.pdf' })
    expect(r.id).toMatch(/^[0-9a-f]{24}$/)
    expect(r.url).toContain('/api/files/download/')
    expect(r.size).toBe(1024)
  })

  it('confirmUpload rejects invalid input or oversized file', () => {
    expect(() => svc.confirmUpload('', { size: 1, checksum: 'c', filename: 'a' })).toThrow(BadRequestException)
    expect(() => svc.confirmUpload('t', { size: 101 * 1024 * 1024, checksum: 'c', filename: 'a' })).toThrow(BadRequestException)
  })
})
