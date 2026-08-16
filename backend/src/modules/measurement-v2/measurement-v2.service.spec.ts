/**
 * G005 RIS v3.0.6.11-101 Wave 3B (影像测量 V2) - 服务 spec
 *
 * 数值正确性:
 *   - 直线: 直角三角 3-4-5 (pixelSpacing=1 → 5.00 mm; 0.5 → 2.50 mm)
 *   - 角度: 三点垂直 → 90.00°
 *   - 椭圆面积: π·a·b (a=3, b=2 → π·6)
 *   - 矩形面积: 3×4 → 12 mm²
 *   - 多边形面积: 鞋带公式 3×4 矩形 → 12 mm²
 *   - 折线: (0,0)→(3,0)→(3,4) → 7 mm
 *   - Cobb 角: 10° 与 35° 两条线 → 25°
 *   - 钙化评分: Agatston 简化 (面积×HU 权重)
 *   - 确定性: 同输入恒同输出
 *   - 坐标序列化: 像素 ↔ 世界坐标往返一致
 *   - 历史版本: 更新快照 + 回滚
 */
import { MeasurementV2Service, computeMeasurement, pixelToWorld, worldToPixel } from './measurement-v2.service'

describe('MeasurementV2Service (Wave 3B 数值正确性)', () => {
  let service: MeasurementV2Service

  beforeEach(() => {
    service = new MeasurementV2Service({} as any)
  })

  describe('computeMeasurement 数值', () => {
    it('直线长度: 直角三角 3-4-5 → 5.00 mm (spacing 1)', () => {
      const r = computeMeasurement({ type: 'line', points: [{ x: 0, y: 0 }, { x: 3, y: 4 }], pixelSpacing: [1, 1] })
      expect(r.value).toBe(5)
      expect(r.unit).toBe('mm')
      expect(r.deterministic).toBe(true)
    })

    it('直线长度: 6-8-10 直角三角形 × spacing 0.5 → 5.00 mm', () => {
      const r = computeMeasurement({ type: 'line', points: [{ x: 0, y: 0 }, { x: 6, y: 8 }], pixelSpacing: [0.5, 0.5] })
      expect(r.value).toBe(5)
    })

    it('角度: 垂直三点 → 90°', () => {
      const r = computeMeasurement({ type: 'angle', points: [{ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }] })
      expect(r.value).toBe(90)
      expect(r.unit).toBe('°')
    })

    it('椭圆面积: π·a·b (a=3, b=2, spacing 1) → ≈18.85 mm²', () => {
      const r = computeMeasurement({ type: 'ellipseArea', points: [{ x: 0, y: 0 }, { x: 6, y: 4 }], pixelSpacing: [1, 1] })
      expect(r.value).toBeCloseTo(Math.PI * 3 * 2, 2)
      expect(r.unit).toBe('mm²')
    })

    it('圆面积: 半径 2 (spacing 1) → π·4 ≈12.57 mm²', () => {
      // 圆 = 长轴=短轴 的椭圆: 对角两点 (-2,-2)→(2,2) → rx=ry=2
      const r = computeMeasurement({ type: 'ellipseArea', points: [{ x: -2, y: -2 }, { x: 2, y: 2 }], pixelSpacing: [1, 1] })
      expect(r.value).toBeCloseTo(Math.PI * 4, 2)
    })

    it('矩形面积: 3×4 → 12 mm²', () => {
      const r = computeMeasurement({ type: 'rectangleArea', points: [{ x: 0, y: 0 }, { x: 3, y: 4 }], pixelSpacing: [1, 1] })
      expect(r.value).toBe(12)
    })

    it('多边形面积: 鞋带公式 (0,0)-(3,0)-(3,4)-(0,4) → 12 mm²', () => {
      const r = computeMeasurement({
        type: 'polygonArea',
        points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }],
        pixelSpacing: [1, 1],
      })
      expect(r.value).toBe(12)
    })

    it('折线长度: (0,0)→(3,0)→(3,4) → 7 mm', () => {
      const r = computeMeasurement({ type: 'polyline', points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }], pixelSpacing: [1, 1] })
      expect(r.value).toBe(7)
    })

    it('Cobb 角: 10° 与 35° 两条线 → 25°', () => {
      const r = computeMeasurement({
        type: 'cobb',
        points: [{ x: 0, y: 0 }, { x: 100, y: 17.6327 }, { x: 0, y: 0 }, { x: 100, y: 70.0207 }],
      })
      // atan2(17.6327/100) ≈ 10°, atan2(70.0207/100) ≈ 35°
      expect(r.value).toBeCloseTo(25, 1)
      expect(r.unit).toBe('°')
    })

    it('Cobb 角: 两平行线 → 0°', () => {
      const r = computeMeasurement({ type: 'cobb', points: [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 10 }, { x: 5, y: 15 }] })
      expect(r.value).toBe(0)
    })

    it('钙化评分: Agatston 简化 (spacing 0.5, HU 分段权重)', () => {
      // 单像素面积 = 0.5×0.5 = 0.25 mm²
      // HU: 150(权重1) 250(权重2) 350(权重3) 500(权重4) → 0.25×(1+2+3+4)=2.5
      const r = computeMeasurement({
        type: 'calciumScore',
        points: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
        pixelSpacing: [0.5, 0.5],
        huValues: [150, 250, 350, 500],
      })
      expect(r.value).toBe(2.5)
      expect(r.unit).toBe('AU')
    })

    it('钙化评分: HU 低于阈值不计入', () => {
      const r = computeMeasurement({
        type: 'calciumScore',
        points: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
        pixelSpacing: [1, 1],
        huValues: [50, 129],
      })
      expect(r.value).toBe(0)
    })
  })

  describe('确定性', () => {
    it('同输入恒同输出 (line)', () => {
      const input = { type: 'line' as const, points: [{ x: 1, y: 2 }, { x: 7, y: 9 }], pixelSpacing: [0.7, 0.7] as [number, number] }
      const a = computeMeasurement(input)
      const b = computeMeasurement(input)
      expect(a.value).toBe(b.value)
      expect(a.deterministic).toBe(true)
    })

    it('同输入恒同输出 (calciumScore)', () => {
      const input = {
        type: 'calciumScore' as const,
        points: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
        pixelSpacing: [0.5, 0.5] as [number, number],
        huValues: [180, 320],
      }
      expect(computeMeasurement(input).value).toBe(computeMeasurement(input).value)
    })
  })

  describe('坐标序列化 (像素 ↔ 世界)', () => {
    it('pixelToWorld / worldToPixel 往返一致', () => {
      const spacing: [number, number] = [0.68, 0.68]
      const pixel = [{ x: 100, y: 200 }, { x: 320, y: 480 }]
      const world = pixelToWorld(pixel, spacing)
      expect(world[0]).toEqual({ x: 68, y: 136 })
      const back = worldToPixel(world, spacing)
      expect(back[0]!.x).toBeCloseTo(100, 4)
      expect(back[0]!.y).toBeCloseTo(200, 4)
    })

    it('convertCoordinates 服务端点换算', () => {
      const out = service.convertCoordinates({ points: [{ x: 100, y: 200 }], pixelSpacing: [1, 1], direction: 'pixelToWorld' })
      expect(out.points[0]).toEqual({ x: 100, y: 200 })
      const back = service.convertCoordinates({ points: out.points, pixelSpacing: [1, 1], direction: 'worldToPixel' })
      expect(back.points[0]).toEqual({ x: 100, y: 200 })
    })
  })

  describe('CRUD + 历史版本', () => {
    it('创建测量: 自动计算数值 + 像素/世界坐标', async () => {
      const m = await service.createMeasurement({
        studyUid: 'S1',
        type: 'line',
        points: [{ x: 0, y: 0 }, { x: 3, y: 4 }],
        pixelSpacing: [1, 1],
        label: '测试直线',
      })
      expect(m.value).toBe(5)
      expect(m.unit).toBe('mm')
      expect(m.worldPoints[1]).toEqual({ x: 3, y: 4 })
      expect(m.version).toBe(1)
      expect(m.versions).toHaveLength(1)
    })

    it('列表: 按 studyUid 过滤', async () => {
      await service.createMeasurement({ studyUid: 'S1', type: 'line', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
      await service.createMeasurement({ studyUid: 'S2', type: 'line', points: [{ x: 0, y: 0 }, { x: 2, y: 2 }] })
      const list = await service.listMeasurements('S1')
      expect(list).toHaveLength(1)
      expect(list[0]!.studyUid).toBe('S1')
    })

    it('更新: 版本 +1, 快照入历史; 回滚恢复历史值', async () => {
      const m = await service.createMeasurement({
        studyUid: 'S1',
        type: 'rectangleArea',
        points: [{ x: 0, y: 0 }, { x: 3, y: 4 }],
        pixelSpacing: [1, 1],
      })
      expect(m.value).toBe(12)
      const updated = await service.updateMeasurement(m.id, { label: '改名后' })
      expect(updated.label).toBe('改名后')
      expect(updated.version).toBe(2)
      expect(updated.versions).toHaveLength(2)
      const rolled = await service.rollbackMeasurement(m.id, 1)
      expect(rolled.label).toBe('矩形面积 12 mm²')
      expect(rolled.value).toBe(12)
      expect(rolled.versions).toHaveLength(3)
    })

    it('删除: 不存在时 404', async () => {
      await expect(service.removeMeasurement('nope')).rejects.toThrow('不存在')
    })

    it('标注 CRUD: 像素坐标 → 世界坐标序列化 + 关联测量', async () => {
      const a = await service.createAnnotation({
        studyUid: 'S1',
        type: 'arrow',
        pixelPoints: [{ x: 100, y: 100 }, { x: 150, y: 150 }],
        pixelSpacing: [0.68, 0.68],
        text: '病灶',
      })
      expect(a.worldPoints[0]!.x).toBeCloseTo(68, 4)
      const m = await service.createMeasurement({ studyUid: 'S1', type: 'line', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
      const linked = await service.linkAnnotation(m.id, a.id)
      expect(linked.measurement.annotationId).toBe(a.id)
      expect(linked.annotation.measurementId).toBe(m.id)
      const updated = await service.updateAnnotation(a.id, { text: '更新标注' })
      expect(updated.text).toBe('更新标注')
      expect(updated.version).toBe(2)
      const rolled = await service.rollbackAnnotation(a.id, 1)
      expect(rolled.text).toBe('病灶')
      await service.removeAnnotation(a.id)
      await expect(service.getAnnotationVersions(a.id)).rejects.toThrow('不存在')
    })

    it('seed 回退: 内置种子测量/标注可用 (孤儿模块无 DB 场景)', async () => {
      const list = await service.listMeasurements('1.2.826.0.1.3680043.10.155.3.0.6.11.CT.1')
      expect(list.length).toBeGreaterThan(0)
      const annotations = await service.listAnnotations('1.2.826.0.1.3680043.10.155.3.0.6.11.CT.1')
      expect(annotations.length).toBeGreaterThan(0)
      expect(service.seedStudyUids()).toHaveLength(3)
    })
  })
})
