import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Card, Space, Button, Slider, Tag, Row, Col, Tooltip, Segmented } from 'antd'
import { RotateCcw, Crosshair, Sun, Layers, Eye } from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { t } from '../../../i18n/appI18n'

export type RenderMode = 'MIP' | 'MPR' | 'VR'

export interface VolumeRendererProps {
  imageIds?: string[]
  seriesUid?: string
  volumeData?: { x: number; y: number; z: number }
  onCoordinateChange?: (pos: { x: number; y: number; z: number }) => void
}

const AXIAL_COLOR = 0x3b82f6
const SAGITTAL_COLOR = 0x16a34a
const CORONAL_COLOR = 0x7c3aed

function createSyntheticVolume(size: number): Uint8Array {
  const data = new Uint8Array(size * size * size)
  const cx = size / 2, cy = size / 2, cz = size / 2
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - cx) / cx, dy = (y - cy) / cy, dz = (z - cz) / cz
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        let val = 0
        if (dist < 0.9) {
          val = Math.max(0, 255 * (1 - dist / 0.9))
          const ripple = Math.sin(x * 0.3) * Math.cos(y * 0.3) * Math.sin(z * 0.3) * 30
          val = Math.min(255, Math.max(0, val + ripple))
        }
        const ring = Math.abs(Math.sqrt(dx * dx + dy * dy) - 0.5)
        if (ring < 0.05 && Math.abs(dz) < 0.3) val = 200
        data[z * size * size + y * size + x] = val
      }
    }
  }
  return data
}

function createVolumeTexture(data: Uint8Array, size: number): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(data, size, size, size)
  texture.format = THREE.RedFormat
  texture.type = THREE.UnsignedByteType
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.unpackAlignment = 1
  texture.needsUpdate = true
  return texture
}

const VOLUME_SIZE = 64

const VolumeRenderer: React.FC<VolumeRendererProps> = ({ seriesUid }) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const volumeRef = useRef<THREE.Mesh | null>(null)
  const animRef = useRef<number>(0)
  useRef<THREE.Mesh[]>([]);

  const [mode, setMode] = useState<RenderMode>('VR')
  const [ww, setWw] = useState(1500)
  const [wc, setWc] = useState(500)
  const [opacity, setOpacity] = useState(1.0)
  const [brightness, setBrightness] = useState(0)
  const [_zoom, setZoom] = useState(1)
  const [coordInfo, _setCoordInfo] = useState({ x: 0, y: 0, z: 0 })
  const [axialIdx, setAxialIdx] = useState(32)
  const [sagittalIdx, setSagittalIdx] = useState(32)
  const [coronalIdx, setCoronalIdx] = useState(32)

  const volumeTexRef = useRef<THREE.Data3DTexture | null>(null)
  const [webglError, setWebglError] = useState<string | null>(null)
  const [webgl2Ok, setWebgl2Ok] = useState(true)

  useEffect(() => {
    const data = createSyntheticVolume(VOLUME_SIZE)
    volumeTexRef.current = createVolumeTexture(data, VOLUME_SIZE)
  }, [])

  useEffect(() => {
    if (!mountRef.current) return
    const w = mountRef.current.clientWidth
    const h = mountRef.current.clientHeight || 500

    let renderer: THREE.WebGLRenderer | null = null
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch (err) {
      console.warn('[VolumeRenderer] WebGL init failed, degrade to 2D view:', err)
      setWebglError(err instanceof Error ? err.message : t('w9e.volumeRenderer.webglUnavailable'))
      return
    }
    try {
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x0f172a, 1)
      mountRef.current.appendChild(renderer.domElement)
    } catch (err) {
      console.warn('[VolumeRenderer] WebGL setup failed, degrade to 2D view:', err)
      try { if (mountRef.current?.contains(renderer.domElement)) mountRef.current.removeChild(renderer.domElement) } catch { /* noop */ }
      renderer.dispose()
      setWebglError(err instanceof Error ? err.message : t('w9e.volumeRenderer.webglInitFailed'))
      return
    }
    rendererRef.current = renderer
    try {
      setWebgl2Ok(renderer.capabilities.isWebGL2)
    } catch { setWebgl2Ok(false) }

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.set(3, 2, 3)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controlsRef.current = controls

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(5, 10, 7)
    scene.add(dirLight)

    const geo = new THREE.BoxGeometry(2, 2, 2)
    const mat = new THREE.MeshPhongMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.15, wireframe: false })
    const box = new THREE.Mesh(geo, mat)
    scene.add(box)

    const wireGeo = new THREE.BoxGeometry(2, 2, 2)
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.3 })
    const wireBox = new THREE.Mesh(wireGeo, wireMat)
    scene.add(wireBox)

    const gridHelper = new THREE.GridHelper(4, 8, 0x3b82f6, 0x1e3a5f)
    gridHelper.position.y = -1.05
    scene.add(gridHelper)

    const animate = () => {
      controls.update()
      renderer.render(scene, camera)
      animRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animRef.current)
      controls.dispose()
      renderer.dispose()
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    if (!sceneRef.current) return
    const scene = sceneRef.current
    sceneRef.current.children.forEach((child) => {
      if (child.userData.isVolumeSlice) {
        scene.remove(child)
        const mesh = child as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose())
          else mesh.material.dispose()
        }
      }
    })

    if (mode === 'MPR') {
      const createSlice = (pos: number, color: number, normal: THREE.Vector3, _label: string) => {
        const size = 2
        const geo = new THREE.PlaneGeometry(size, size)
        const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.5 * opacity, depthWrite: false })
        const mesh = new THREE.Mesh(geo, mat)
        const p = (pos / VOLUME_SIZE - 0.5) * 2
        if (normal.x === 1) { mesh.position.set(p, 0, 0); mesh.rotation.y = Math.PI / 2 }
        else if (normal.y === 1) { mesh.position.set(0, p, 0); mesh.rotation.x = -Math.PI / 2 }
        else { mesh.position.set(0, 0, p) }
        mesh.userData.isVolumeSlice = true
        scene.add(mesh)
      }
      createSlice(axialIdx, AXIAL_COLOR, new THREE.Vector3(0, 1, 0), 'Axial')
      createSlice(sagittalIdx, SAGITTAL_COLOR, new THREE.Vector3(1, 0, 0), 'Sagittal')
      createSlice(coronalIdx, CORONAL_COLOR, new THREE.Vector3(0, 0, 1), 'Coronal')
    }

    if (mode === 'VR' || mode === 'MIP') {
      // texture3D/sampler3D 需要 WebGL2; 同步读取 renderer 能力避免首次渲染用 stale state,
      // WebGL1 下跳过体积着色器, 仅保留线框盒子降级视图
      let isWebGL2 = false
      try { isWebGL2 = rendererRef.current?.capabilities.isWebGL2 === true } catch { isWebGL2 = false }
      if (!isWebGL2) {
        setWebgl2Ok(false)
        return
      }
      if (volumeTexRef.current) {
        const geo = new THREE.BoxGeometry(2, 2, 2)
        // WebGL2 下 THREE 按 GLSL ES 3.00 编译: texture3D 已移除, 必须用 texture(sampler3D, vec3)
        const mat = new THREE.ShaderMaterial({
          glslVersion: THREE.GLSL3,
          uniforms: {
            uVolume: { value: volumeTexRef.current },
            uWw: { value: ww },
            uWc: { value: wc },
            uOpacity: { value: opacity },
            uBrightness: { value: brightness },
            uMode: { value: mode === 'MIP' ? 0.0 : 1.0 },
            uCameraPos: { value: cameraRef.current ? cameraRef.current.position : new THREE.Vector3(0, 0, 3) },
          },
          vertexShader: `
            out vec3 vPosition;
            void main() {
              vPosition = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            precision highp float;
            uniform sampler3D uVolume;
            uniform float uWw;
            uniform float uWc;
            uniform float uOpacity;
            uniform float uBrightness;
            uniform float uMode;
            uniform vec3 uCameraPos;
            in vec3 vPosition;
            out vec4 fragColor;

            void main() {
              vec3 dir = normalize(uCameraPos - vPosition);
              vec3 start = vPosition;
              int steps = 128;
              float stepSize = 1.0 / float(steps);
              vec4 accum = vec4(0.0);
              float maxVal = 0.0;

              for (int i = 0; i < steps; i++) {
                float t = float(i) * stepSize;
                vec3 pos = start + dir * t * 1.732;
                if (pos.x < -1.0 || pos.x > 1.0 || pos.y < -1.0 || pos.y > 1.0 || pos.z < -1.0 || pos.z > 1.0) break;
                vec3 uvw = pos * 0.5 + 0.5;
                float v = texture(uVolume, uvw).r;
                float normalized = (v - (uWc - uWw * 0.5)) / uWw;
                normalized = clamp(normalized + uBrightness, 0.0, 1.0);

                if (uMode < 0.5) {
                  if (normalized > maxVal) maxVal = normalized;
                } else {
                  if (normalized > 0.02) {
                    vec4 color = vec4(normalized * 0.3, normalized * 0.5, normalized * 0.8, normalized * uOpacity);
                    color.rgb *= color.a;
                    accum += color * (1.0 - accum.a);
                  }
                }
              }

              if (uMode < 0.5) {
                fragColor = vec4(vec3(maxVal * 0.3, maxVal * 0.5, maxVal * 0.8), 1.0);
              } else {
                fragColor = accum;
              }
            }
          `,
          transparent: mode === 'VR',
          side: THREE.DoubleSide,
          depthWrite: mode === 'MIP',
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.userData.isVolumeSlice = true
        scene.add(mesh)
        volumeRef.current = mesh
      }
    }
  }, [mode, ww, wc, opacity, brightness, axialIdx, sagittalIdx, coronalIdx, webgl2Ok])

  const handleReset = useCallback(() => {
    setWw(1500); setWc(500); setOpacity(1); setBrightness(0); setZoom(1)
    setAxialIdx(32); setSagittalIdx(32); setCoronalIdx(32)
    if (controlsRef.current) {
      controlsRef.current.reset()
    }
    if (cameraRef.current) {
      cameraRef.current.position.set(3, 2, 3)
      cameraRef.current.lookAt(0, 0, 0)
    }
  }, [])

  const coordStr = `X: ${coordInfo.x.toFixed(0)}  Y: ${coordInfo.y.toFixed(0)}  Z: ${coordInfo.z.toFixed(0)}`

  return (
    <Card
      size="small"
      title={
        <Space>
          <Eye size={14} />
          <span>{t('w9e.volumeRenderer.title')}</span>
          <Tag color={mode === 'VR' ? 'purple' : mode === 'MIP' ? 'cyan' : 'blue'}>{mode}</Tag>
          {webglError && <Tag color="orange">{t('w9e.volumeRenderer.webglDegraded')}</Tag>}
          {!webgl2Ok && !webglError && <Tag color="orange">{t('w9e.volumeRenderer.webgl2Degraded')}</Tag>}
          {seriesUid && <Tag color="geekblue">{seriesUid.slice(0, 16)}...</Tag>}
        </Space>
      }
      extra={<Space><span style={{ fontSize: 11, color: '#94a3b8' }}>{coordStr}</span></Space>}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { flex: 1, padding: 8, display: 'flex', flexDirection: 'column' } }}
    >
      <Segmented
        value={mode}
        onChange={(v) => setMode(v as RenderMode)}
        options={[
          { value: 'MIP', label: <Space size={4}><Layers size={14} />MIP</Space> },
          { value: 'MPR', label: <Space size={4}><Crosshair size={14} />MPR</Space> },
          { value: 'VR', label: <Space size={4}><Sun size={14} />VR</Space> },
        ]}
        style={{ marginBottom: 8 }}
        block
      />
      <div ref={mountRef} style={{ flex: 1, minHeight: 360, borderRadius: 6, overflow: 'hidden', position: 'relative', background: '#0f172a' }}>
        {webglError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
            {t('w9e.volumeRenderer.webgl2dFallback', { msg: webglError })}
          </div>
        )}
      </div>
      <Row gutter={8} style={{ marginTop: 8 }}>
        <Col span={6}>
          <Tooltip title={t('w9e.volumeRenderer.windowWidth')}><Space style={{ width: '100%' }}><small>WW</small><Slider value={ww} min={100} max={4000} step={10} onChange={setWw} /></Space></Tooltip>
        </Col>
        <Col span={6}>
          <Tooltip title={t('w9e.volumeRenderer.windowLevel')}><Space style={{ width: '100%' }}><small>WC</small><Slider value={wc} min={-1000} max={2000} step={10} onChange={setWc} /></Space></Tooltip>
        </Col>
        <Col span={6}>
          <Tooltip title={t('w9e.volumeRenderer.opacity')}><Space style={{ width: '100%' }}><small>Op</small><Slider value={opacity} min={0} max={1} step={0.01} onChange={setOpacity} /></Space></Tooltip>
        </Col>
        <Col span={6}>
          <Tooltip title={t('w9e.volumeRenderer.brightness')}><Space style={{ width: '100%' }}><small>Br</small><Slider value={brightness} min={-0.5} max={0.5} step={0.01} onChange={setBrightness} /></Space></Tooltip>
        </Col>
      </Row>
      {mode === 'MPR' && (
        <Row gutter={8} style={{ marginTop: 4 }}>
          <Col span={8}><Space style={{ width: '100%' }}><Tag color="blue">A</Tag><Slider value={axialIdx} min={0} max={VOLUME_SIZE - 1} onChange={setAxialIdx} /></Space></Col>
          <Col span={8}><Space style={{ width: '100%' }}><Tag color="green">S</Tag><Slider value={sagittalIdx} min={0} max={VOLUME_SIZE - 1} onChange={setSagittalIdx} /></Space></Col>
          <Col span={8}><Space style={{ width: '100%' }}><Tag color="purple">C</Tag><Slider value={coronalIdx} min={0} max={VOLUME_SIZE - 1} onChange={setCoronalIdx} /></Space></Col>
        </Row>
      )}
      <Space style={{ marginTop: 4 }}>
        <Tooltip title={t('w9e.volumeRenderer.reset')}><Button size="small" icon={<RotateCcw size={12} />} onClick={handleReset} /></Tooltip>
      </Space>
    </Card>
  )
}

export default VolumeRenderer
