/**
 * NProgress Bar - E7: 路由切换时顶部进度条
 * 模拟NProgress效果，使用纯CSS动画
 * G005 Radiology RIS System
 */
import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * 路由切换时自动显示顶部进度条
 * 集成到App.tsx的header位置
 */
export function NProgressBar({ children }: { children?: React.ReactNode }) {
  const location = useLocation()

  useEffect(() => {
    const bar = document.getElementById('nprogress-bar')
    if (bar) {
      bar.style.transform = 'scaleX(0.3)'
      
      const timer = setTimeout(() => {
        if (bar) bar.style.transform = 'scaleX(0.7)'
      }, 100)

      const complete = setTimeout(() => {
        if (bar) bar.style.transform = 'scaleX(1)'
      }, 300)

      const hide = setTimeout(() => {
        if (bar) {
          bar.style.opacity = '0'
          setTimeout(() => {
            if (bar) {
              bar.style.transform = 'scaleX(0)'
              bar.style.opacity = '1'
            }
          }, 200)
        }
      }, 400)

      return () => {
        clearTimeout(timer)
        clearTimeout(complete)
        clearTimeout(hide)
      }
    }
    return undefined
  }, [location.pathname])

  return (
    <>
      <div
        id="nprogress-bar"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)',
          transform: 'scaleX(0)',
          transformOrigin: 'left center',
          transition: 'transform 0.3s ease-out, opacity 0.2s ease-in',
          zIndex: 'var(--z-overlay)' as unknown as number,
          backgroundSize: '200% 100%',
          animation: 'nprogressStripes 1s linear infinite',
        }}
      />
      <style>{`
        @keyframes nprogressStripes {
          0% { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }
      `}</style>
      {children}
    </>
  )
}

/**
 * 手动控制进度条（用于长操作）
 */
export const nprogress = {
  start: () => {
    const bar = document.getElementById('nprogress-bar')
    if (bar) bar.style.transform = 'scaleX(0.1)'
  },
  setProgress: (pct: number) => {
    const bar = document.getElementById('nprogress-bar')
    if (bar) bar.style.transform = `scaleX(${pct})`
  },
  done: () => {
    const bar = document.getElementById('nprogress-bar')
    if (bar) {
      bar.style.transform = 'scaleX(1)'
      setTimeout(() => {
        if (bar) {
          bar.style.opacity = '0'
          setTimeout(() => {
            if (bar) {
              bar.style.transform = 'scaleX(0)'
              bar.style.opacity = '1'
            }
          }, 200)
        }
      }, 300)
    }
  },
}

export default NProgressBar