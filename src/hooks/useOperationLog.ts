import { useAuth } from './useAuth';

export function useOperationLog(resourceType: string) {
  const { user } = useAuth();

  const log = (action: string, resourceId: string, detail?: any) => {
    const entry = {
      actor: user?.name,
      action,
      resourceType,
      resourceId,
      detail,
      timestamp: new Date().toISOString(),
    };
    const existing = (() => { try { return JSON.parse(localStorage.getItem('operation_logs') || '[]') } catch { return [] } })();
    existing.push(entry);
    localStorage.setItem('operation_logs', JSON.stringify(existing.slice(-1000)));
  };

  return { log };
}
