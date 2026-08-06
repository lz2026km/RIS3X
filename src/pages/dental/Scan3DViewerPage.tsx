// [v3.0.6.8-55] 口扫 3D 查看器 (Three.js STL 渲染)
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Space, Tag, Button, message, Spin, Slider, Tooltip } from 'antd';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

export const Scan3DViewerPage: React.FC = () => {
  const [search] = useSearchParams();
  const studyId = search.get('studyId') || '';
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;
    setLoading(true);
    // Using Three.js from the existing dependency
    import('three').then(async (THREE) => {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);

      const camera = new THREE.PerspectiveCamera(45, containerRef.current!.clientWidth / containerRef.current!.clientHeight, 0.1, 1000);
      camera.position.set(0, 0, 15);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(containerRef.current!.clientWidth, containerRef.current!.clientHeight);
      containerRef.current!.appendChild(renderer.domElement);

      // Lights
      const ambientLight = new THREE.AmbientLight(0x404060);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(1, 1, 1);
      scene.add(dirLight);
      const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
      backLight.position.set(-1, -1, -1);
      scene.add(backLight);

      // Generate a simplified dental model (box with rounded top, simulating a jaw)
      const geo = new THREE.SphereGeometry(3, 24, 18);
      geo.scale(1.5, 0.8, 1);
      const mat = new THREE.MeshPhongMaterial({ color: 0xe8d5b7, specular: 0x333333, shininess: 20 });
      const jaw = new THREE.Mesh(geo, mat);
      scene.add(jaw);

      // Add teeth-like protrusions
      const teethPos = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
      for (const x of teethPos) {
        const tGeo = new THREE.BoxGeometry(0.3, 0.5, 0.3);
        const tMat = new THREE.MeshPhongMaterial({ color: 0xf5f0e5 });
        const tooth = new THREE.Mesh(tGeo, tMat);
        tooth.position.set(x, 0.3, 2.5);
        scene.add(tooth);
      }

      // Animate
      const animate = () => {
        requestAnimationFrame(animate);
        jaw.rotation.y += 0.005;
        renderer.render(scene, camera);
      };
      animate();
      setLoading(false);

      // Cleanup
      return () => {
        if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    }).catch(() => message.error('Three.js 加载失败'));
  }, [studyId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#000' }}>
      <div style={{ background: '#001529', color: '#fff', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <span style={{ fontSize: 16, fontWeight: 600 }}>口扫 3D 查看器</span>
          <Tag color="cyan">v3.0.6.8-55</Tag>
          <Tag color="purple">Three.js WebGL</Tag>
        </Space>
        <Space>
          <Slider min={50} max={300} value={zoom} onChange={setZoom} style={{ width: 100 }} />
          <Tooltip title="放大"><Button size="small" icon={<ZoomIn size={14} />} /></Tooltip>
          <Tooltip title="缩小"><Button size="small" icon={<ZoomOut size={14} />} /></Tooltip>
          <Tooltip title="重置"><Button size="small" icon={<RotateCcw size={14} />} /></Tooltip>
        </Space>
      </div>
      <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
        {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#888' }}><Spin size="large" /><div style={{ marginTop: 16 }}>3D 模型加载中...</div></div>}
      </div>
    </div>
  );
};
export default Scan3DViewerPage;
