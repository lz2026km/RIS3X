import * as net from 'node:net'
import { Hl7Service } from '../src/hl7/hl7.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('Hl7Service - MLLP / ACK', () => {
  let svc: Hl7Service

  const mockPrisma = {
    hl7MessageArchive: { create: jest.fn() },
    patient: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    exam: { findUnique: jest.fn(), create: jest.fn() },
    appointment: { create: jest.fn() },
    $connect: jest.fn(),
  } as any

  beforeAll(() => {
    process.env['HL7_MLLP_RETRY_MAX'] = '2'
    process.env['HL7_MLLP_RETRY_INTERVAL'] = '50'
    process.env['HL7_MLLP_TIMEOUT'] = '500'
    svc = new Hl7Service(mockPrisma as PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('MLLP frame format', () => {
    it('sendMllpMessage sends framed message (0x0b ... 0x1c 0x0d)', async () => {
      // Start a local TCP echo server
      const server = net.createServer((socket) => {
        socket.on('data', (data) => {
          // Echo back with ACK
          const ack = 'MSH|^~\\&|G005|RAD|EXT|HIS|20260712120000||ACK|ACK001|P|2.5.1\rMSA|AA|CTL001\r'
          const framed = Buffer.concat([Buffer.from([0x0b]), Buffer.from(ack, 'utf8'), Buffer.from([0x1c, 0x0d])])
          socket.write(framed)
          socket.end()
        })
      })

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      const port = (server.address() as net.AddressInfo).port

      mockPrisma.hl7MessageArchive.create.mockResolvedValue({ id: 'a1' })
      const result = await svc.sendMllpMessage('127.0.0.1', port, 'MSH|^~\\&|G005|RAD|EXT|HIS|20260712120000||ORU^R01|CTL001|P|2.5.1\rPID|||P001\r')

      expect(result).toContain('MSA|AA')
      server.close()
    })

    it('sendMllpMessage throws after max retries on timeout', async () => {
      // Connect to a host that will not respond (unused port)
      const server = net.createServer((socket) => {
        // never respond
      })
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
      const port = (server.address() as net.AddressInfo).port
      server.close()

      mockPrisma.hl7MessageArchive.create.mockResolvedValue({ id: 'a1' })
      await expect(
        svc.sendMllpMessage('127.0.0.1', port, 'MSH|^~\\&|G005|RAD|EXT|HIS|20260712120000||ORU^R01|CTL001|P|2.5.1\r'),
      ).rejects.toThrow('MLLP send failed')
    })
  })

  describe('sendAck', () => {
    it('sends AA ack over socket', (done) => {
      const server = net.createServer((socket) => {
        socket.on('data', () => {
          svc['sendAck'](socket, 'MSH|^~\\&|G005|RAD|EXT|HIS|20260712120000||ADT^A01|CTL001|P|2.5.1\rPID|||P001\r', 'AA', 'ADT^A01')
        })
      })

      server.listen(0, '127.0.0.1', async () => {
        const port = (server.address() as net.AddressInfo).port
        const client = new net.Socket()
        client.connect(port, '127.0.0.1', () => {
          client.write(Buffer.from([0x0b, ...Buffer.from('test', 'utf8'), 0x1c, 0x0d]))
        })
        client.on('data', (data) => {
          const msg = data.toString('utf8')
          expect(msg).toContain('MSA|AA')
          expect(msg).toContain('ACK')
          client.destroy()
          server.close()
          done()
        })
      })
    })
  })

  describe('pushOruOnExamCompletion', () => {
    it('skips when push disabled', async () => {
      process.env['HL7_PUSH_ENABLED'] = 'false'
      // Recreate service with new config
      const svc2 = new Hl7Service(mockPrisma as PrismaService)
      await svc2.pushOruOnExamCompletion({}, {})
      // No error means skip
    })

    it('attempts push when enabled and throws on connection failure', async () => {
      process.env['HL7_PUSH_ENABLED'] = 'true'
      process.env['HL7_PUSH_HOST'] = '127.0.0.1'
      process.env['HL7_PUSH_PORT'] = '9999'
      const svc2 = new Hl7Service(mockPrisma as PrismaService)
      mockPrisma.hl7MessageArchive.create.mockResolvedValue({ id: 'a1' })
      await expect(
        svc2.pushOruOnExamCompletion(
          { accessionNumber: 'ACC001', modality: 'CT', startedAt: new Date() },
          { id: 'r1', patientId: 'p1', findings: '正常', conclusion: '正常', patient: { name: '张三', gender: 'MALE', birthDate: new Date('1990-01-01') } },
        ),
      ).rejects.toThrow('HL7 ORU push failed')
      expect(mockPrisma.hl7MessageArchive.create).toHaveBeenCalled()
    })
  })

  afterAll(() => {
    svc.stopMllpListener()
  })
})
