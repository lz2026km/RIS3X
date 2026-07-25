type SetFn<S> = (partial: S | Partial<S> | ((state: S) => Partial<S>), replace?: boolean) => void
type GetFn<S> = () => S

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object') {
    const value = error as { error?: { message?: string }; message?: string }
    return value.error?.message ?? value.message ?? fallback
  }
  return fallback
}

function assertMutationResult(result: unknown, fallback: string): void {
  if (result === false || result === null) throw new Error(fallback)
  if (result && typeof result === 'object' && 'success' in result) {
    const response = result as { success: boolean; error?: { message?: string } }
    if (!response.success) throw new Error(response.error?.message ?? fallback)
  }
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
        } else {
          set({ loading: false, error: loadError })
        }
      } catch (err) {
        set({ loading: false, error: errorMessage(err, loadError) })
      }
    }

    const actions: Record<string, (...args: any[]) => Promise<void>> = {
      [loadName]: load,
    }

    if (config.api.create) {
      actions[createName] = async (data: unknown) => {
        const failure = `创建${config.label}失败`
        set({ loading: true, error: null })
        try {
          const result = await (config.api.create as (data: unknown) => Promise<unknown>)(data)
          assertMutationResult(result, failure)
          await load()
        } catch (err) {
          set({ loading: false, error: errorMessage(err, failure) })
        }
      }
    }

    if (config.api.update) {
      actions[updateName] = async (id: string, data: Partial<Dto>) => {
        const failure = `更新${config.label}失败`
        set({ loading: true, error: null })
        try {
          const result = await (config.api.update as (id: string, data: Partial<Dto>) => Promise<unknown>)(id, data)
          assertMutationResult(result, failure)
          await load()
        } catch (err) {
          set({ loading: false, error: errorMessage(err, failure) })
        }
      }
    }

    if (config.api.delete) {
      actions[deleteName] = async (id: string) => {
        const failure = `删除${config.label}失败`
        set({ loading: true, error: null })
        try {
          const result = await (config.api.delete as (id: string) => Promise<unknown>)(id)
          assertMutationResult(result, failure)
          await load()
        } catch (err) {
          set({ loading: false, error: errorMessage(err, failure) })
        }
      }
    }

    return actions
  }
}
