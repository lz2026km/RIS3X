type SetFn<S> = (partial: S | Partial<S> | ((state: S) => Partial<S>), replace?: boolean) => void
type GetFn<S> = () => S

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export interface CrudStoreConfig<Dto> {
  field: string
  label: string
  api: {
    list: () => Promise<Dto[] | { success: boolean; data?: Dto[]; error?: { message?: string } }>
    create?: (data: unknown) => Promise<unknown>
    update?: (id: string, data: Partial<Dto>) => Promise<unknown>
    delete?: (id: string) => Promise<unknown>
  }
  methodName?: string
  loadErrorMsg?: string
}

export function createCrudStore<Dto>(config: CrudStoreConfig<Dto>) {
  const loadName = config.methodName ?? `load${capitalize(config.field)}`
  const itemName = config.field.replace(/s$/, '')
  const itemCap = capitalize(itemName)
  const createName = `create${itemCap}`
  const updateName = `update${itemCap}`
  const deleteName = `delete${itemCap}`
  const loadError = config.loadErrorMsg ?? `加载${config.label}失败`

  return (set: SetFn<any>, get: GetFn<any>) => {
    const load = async () => {
      set({ loading: true, error: null })
      try {
        const res = await config.api.list()
        if (Array.isArray(res)) {
          set({ [config.field]: res, loading: false, error: null })
        } else if (res && typeof res === 'object' && 'success' in res) {
          const r = res as { success: boolean; data?: Dto[]; error?: { message?: string } }
          if (r.success && Array.isArray(r.data)) {
            set({ [config.field]: r.data, loading: false, error: null })
          } else {
            set({ loading: false, error: r.error?.message ?? loadError })
          }
        }
      } catch (err) {
        set({ loading: false, error: err instanceof Error ? err.message : loadError })
      }
    }

    const actions: Record<string, (...args: any[]) => Promise<void>> = {
      [loadName]: load,
    }

    if (config.api.create) {
      actions[createName] = async (data: unknown) => {
        set({ loading: true, error: null })
        try {
          await (config.api.create as (data: unknown) => Promise<unknown>)(data)
          await load()
        } catch {
          set({ error: `创建${config.label}失败`, loading: false })
        }
      }
    }

    if (config.api.update) {
      actions[updateName] = async (id: string, data: Partial<Dto>) => {
        set({ loading: true, error: null })
        try {
          await (config.api.update as (id: string, data: Partial<Dto>) => Promise<unknown>)(id, data)
          await load()
        } catch {
          set({ error: `更新${config.label}失败`, loading: false })
        }
      }
    }

    if (config.api.delete) {
      actions[deleteName] = async (id: string) => {
        set({ loading: true, error: null })
        try {
          await (config.api.delete as (id: string) => Promise<unknown>)(id)
          await load()
        } catch {
          set({ error: `删除${config.label}失败`, loading: false })
        }
      }
    }

    return actions
  }
}
