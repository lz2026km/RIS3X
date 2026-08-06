import * as path from 'node:path'
import { UnsafePathError, assertSafeRelativePath, assertSafeBasename, resolveWithinRoot, safeJoin } from './safe-path'

describe('safe-path', () => {
  const root = path.resolve('test-storage-root')

  describe('assertSafeRelativePath', () => {
    it('accepts valid relative path and normalizes to forward slashes', () => {
      expect(assertSafeRelativePath(root, 'study/1.2.3/series/1.2.3.4/sop.dcm')).toBe('study/1.2.3/series/1.2.3.4/sop.dcm')
      expect(assertSafeRelativePath(root, 'plain-name.dcm')).toBe('plain-name.dcm')
    })

    it('rejects ../ traversal', () => {
      for (const bad of ['../secret.txt', 'a/../../secret.txt', '..', 'a/b/../../../etc/passwd']) {
        expect(() => assertSafeRelativePath(root, bad)).toThrow(UnsafePathError)
      }
    })

    it('handles backslash inputs without escaping root', () => {
      if (process.platform === 'win32') {
        expect(() => assertSafeRelativePath(root, '..\\..\\windows\\evil.dcm')).toThrow(UnsafePathError)
        expect(() => assertSafeRelativePath(root, 'a\\..\\..\\evil.dcm')).toThrow(UnsafePathError)
      } else {
        const rel = assertSafeRelativePath(root, '..\\..\\windows\\evil.dcm')
        expect(path.resolve(root, rel).startsWith(path.resolve(root))).toBe(true)
      }
    })

    it('rejects absolute paths', () => {
      const abs = path.resolve(root, '..', 'outside.dcm')
      expect(path.isAbsolute(abs)).toBe(true)
      expect(() => assertSafeRelativePath(root, abs)).toThrow(UnsafePathError)
      if (process.platform === 'win32') {
        expect(() => assertSafeRelativePath(root, 'C:\\Windows\\evil.dcm')).toThrow(UnsafePathError)
      } else {
        expect(() => assertSafeRelativePath(root, '/etc/passwd')).toThrow(UnsafePathError)
      }
    })

    it('does not decode URL-encoded separators (encoded bypass stays inside root)', () => {
      const encoded = '..%2f..%2fetc%2fpasswd'
      const rel = assertSafeRelativePath(root, encoded)
      const resolved = path.resolve(root, rel)
      expect(resolved.startsWith(path.resolve(root))).toBe(true)
    })

    it('rejects NUL bytes and empty input', () => {
      expect(() => assertSafeRelativePath(root, 'a\0b.dcm')).toThrow(UnsafePathError)
      expect(() => assertSafeRelativePath(root, '')).toThrow(UnsafePathError)
      expect(() => assertSafeRelativePath(root, undefined as unknown as string)).toThrow(UnsafePathError)
    })
  })

  describe('safeJoin', () => {
    it('joins name inside root only', () => {
      const joined = safeJoin(root, 'sub/file.dcm')
      expect(joined.startsWith(path.resolve(root))).toBe(true)
      expect(() => safeJoin(root, '../escape.dcm')).toThrow(UnsafePathError)
    })
  })

  describe('resolveWithinRoot', () => {
    it('accepts relative keys and legacy absolute paths inside root', () => {
      const rel = resolveWithinRoot(root, 'study/x.dcm')
      expect(rel).toBe(path.resolve(root, 'study', 'x.dcm'))
      const absInside = path.resolve(root, 'legacy', 'y.dcm')
      expect(resolveWithinRoot(root, absInside)).toBe(absInside)
    })

    it('rejects absolute paths outside root', () => {
      const absOutside = path.resolve(root, '..', 'outside.dcm')
      expect(() => resolveWithinRoot(root, absOutside)).toThrow(UnsafePathError)
      expect(() => resolveWithinRoot(root, '../../etc/passwd')).toThrow(UnsafePathError)
    })
  })

  describe('assertSafeBasename', () => {
    it('accepts plain names', () => {
      expect(assertSafeBasename('task-42')).toBe('task-42')
      expect(assertSafeBasename('1.2.3.4.5')).toBe('1.2.3.4.5')
    })

    it('rejects separators, dots and NUL', () => {
      for (const bad of ['a/b', 'a\\b', '..', '.', 'a\0b']) {
        expect(() => assertSafeBasename(bad)).toThrow(UnsafePathError)
      }
    })
  })
})
