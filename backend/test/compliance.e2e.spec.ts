import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ComplianceModule } from '../src/modules/compliance/compliance.module'

describe('Compliance (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ComplianceModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /compliance/report returns compliance report', async () => {
    const res = await request(app.getHttpServer()).get('/compliance/report')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('overallScore')
    expect(res.body).toHaveProperty('overallCompliance')
    expect(res.body).toHaveProperty('categories')
    expect(res.body).toHaveProperty('items')
  })

  it('GET /compliance/report categories have correct structure', async () => {
    const res = await request(app.getHttpServer()).get('/compliance/report')
    const cats = res.body.categories
    expect(Array.isArray(cats)).toBe(true)
    expect(cats.length).toBeGreaterThan(0)
    expect(cats[0]).toHaveProperty('category')
    expect(cats[0]).toHaveProperty('name')
    expect(cats[0]).toHaveProperty('itemCount')
    expect(cats[0]).toHaveProperty('implementedCount')
    expect(cats[0]).toHaveProperty('averageScore')
  })

  it('GET /compliance/report items have correct structure', async () => {
    const res = await request(app.getHttpServer()).get('/compliance/report')
    const items = res.body.items
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]).toHaveProperty('id')
    expect(items[0]).toHaveProperty('category')
    expect(items[0]).toHaveProperty('name')
    expect(items[0]).toHaveProperty('implemented')
    expect(items[0]).toHaveProperty('score')
  })
})
