import { useEffect, useState } from 'react'

let initPromise: Promise<boolean> | null = null

export async function initCornerstone(): Promise<boolean> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      const csCore = await import('@cornerstonejs/core')
      const csTools = await import('@cornerstonejs/tools')
      const csDicom = await import('@cornerstonejs/dicom-image-loader')

      const dicomLoader: any = (csDicom as any).default || csDicom
      if (dicomLoader?.init) {
        dicomLoader.init()
      }

      if ((csCore as any).cache?.setMaxCacheSize) {
        (csCore as any).cache.setMaxCacheSize(2 * 1024 * 1024 * 1024)
      }

      if ((csTools as any).init) {
        (csTools as any).init()
      }

      return true
    } catch (e) {
      console.error('[Cornerstone3D] init failed:', e)
      return false
    }
  })()
  return initPromise
}

export function useCornerstoneInit() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    initCornerstone().then(ok => {
      if (mounted) {
        setReady(ok)
        if (!ok) setError('Cornerstone3D initialization failed (WebGL may not be supported)')
      }
    })
    return () => { mounted = false }
  }, [])

  return { ready, error }
}
