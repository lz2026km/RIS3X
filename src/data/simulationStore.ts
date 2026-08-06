// G005 放射科RIS系统 - localStorage 模拟存储基础设施 v1.0.0
// 提供本地存储封装和API调用模拟

// ==================== 类型定义 ====================
type LoadingState = "idle" | "loading" | "success" | "error";

interface ApiCallOptions {
  delay?: number;
  successRate?: number;
  errorMessage?: string;
}

interface LoadingStateResult {
  state: LoadingState;
  setLoading: () => void;
  setSuccess: () => void;
  setError: (msg?: string) => void;
  reset: () => void;
  getState: () => LoadingState;
}

// ==================== localStorage 封装 ====================
export const storage = {
  getItem: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue ?? null;
      return JSON.parse(item) as T;
    } catch {
      return defaultValue ?? null;
    }
  },

  setItem: <T>(key: string, value: T): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[storage] Failed to set item ${key}:`, e);
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch (e) {
      console.error("[storage] Failed to clear:", e);
    }
  },

  hasItem: (key: string): boolean => {
    return localStorage.getItem(key) !== null;
  },
};

// ==================== ID 生成器 ====================
let idCounter = Date.now();
const PREFIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const generateId = (prefix: string = "ID"): string => {
  idCounter++;
  const timestamp = idCounter.toString(36).toUpperCase();
  const randomPart = Array.from(
    { length: 4 },
    () => PREFIX_CHARS[Math.floor(Math.random() * PREFIX_CHARS.length)],
  ).join("");
  return `${prefix}-${timestamp}-${randomPart}`;
};

// ==================== 日期工具 ====================

export const formatDate = (date: Date = new Date()): string => {
  return date.toISOString().slice(0, 10);
};

export const formatDateTime = (date: Date = new Date()): string => {
  return date.toISOString().slice(0, 19).replace("T", " ");
};

export const addDays = (days: number, fromDate: Date = new Date()): Date => {
  const result = new Date(fromDate);
  result.setDate(result.getDate() + days);
  return result;
};

// ==================== API 调用模拟 ====================
export const simulateApiCall = <T>(
  data: T,
  options: ApiCallOptions = {},
): Promise<T> => {
  const {
    delay = 1500,
    successRate = 0.92,
    errorMessage = "操作失败，请稍后重试",
  } = options;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < successRate) {
        resolve(data);
      } else {
        reject(new Error(errorMessage));
      }
    }, delay);
  });
};

// ==================== 加载状态钩子（React 友好） ====================
export const createLoadingState = (): LoadingStateResult => {
  let state: LoadingState = "idle";

  const setLoading = () => {
    state = "loading";
  };
  const setSuccess = () => {
    state = "success";
  };
  const setError = (msg?: string) => {
    state = "error";
    void msg;
  };
  const reset = () => {
    state = "idle";
  };
  const getState = (): LoadingState => state;

  return {
    state,
    setLoading,
    setSuccess,
    setError,
    reset,
    getState,
  };
};

// ==================== 反馈消息组件状态管理 ====================
export interface FeedbackState {
  visible: boolean;
  type: "loading" | "success" | "error";
  message: string;
}

export const createFeedbackState = (): FeedbackState & {
  showLoading: (message?: string) => void;
  showSuccess: (message?: string) => void;
  showError: (message?: string) => void;
  hide: () => void;
} => {
  let _visible = false;
  let _type: "loading" | "success" | "error" = "loading";
  let _message = "处理中...";

  return {
    get visible() {
      return _visible;
    },
    get type() {
      return _type;
    },
    get message() {
      return _message;
    },

    showLoading: (message = "处理中...") => {
      _visible = true;
      _type = "loading";
      _message = message;
    },

    showSuccess: (message = "操作成功") => {
      _visible = true;
      _type = "success";
      _message = message;
    },

    showError: (message = "操作失败") => {
      _visible = true;
      _type = "error";
      _message = message;
    },

    hide: () => {
      _visible = false;
    },
  };
};

// ==================== 通用按钮反馈处理 ====================
export type FeedbackHandler = {
  showLoading: () => void;
  showSuccess: () => void;
  showError: (msg?: string) => void;
  isLoading: () => boolean;
};

export const createButtonFeedback = (
  setFeedbackState: React.Dispatch<React.SetStateAction<FeedbackState>>,
  clearDelay = 3000,
): FeedbackHandler => {
  let loading = false;

  const showLoading = () => {
    loading = true;
    setFeedbackState({ visible: true, type: "loading", message: "处理中..." });
  };

  const showSuccess = () => {
    loading = false;
    setFeedbackState({ visible: true, type: "success", message: "✓ 成功" });
    setTimeout(
      () => setFeedbackState({ visible: false, type: "loading", message: "" }),
      clearDelay,
    );
  };

  const showError = (msg?: string) => {
    loading = false;
    setFeedbackState({
      visible: true,
      type: "error",
      message: msg || "✗ 失败",
    });
    setTimeout(
      () => setFeedbackState({ visible: false, type: "loading", message: "" }),
      clearDelay,
    );
  };

  const isLoading = () => loading;

  return { showLoading, showSuccess, showError, isLoading };
};

// ==================== 带反馈的异步操作包装器 ====================
export const withFeedback = async <T>(
  handler: FeedbackHandler,
  operation: () => Promise<T>,
  _successMessage = "✓ 成功",
  errorMessage = "✗ 失败",
): Promise<T | undefined> => {
  handler.showLoading();
  try {
    const result = await operation();
    handler.showSuccess();
    return result;
  } catch (err) {
    handler.showError(err instanceof Error ? err.message : errorMessage);
    return undefined;
  }
};

// ==================== 存储键名常量 ====================
export const STORAGE_KEYS = {
  APPOINTMENTS: "g005_appointments",
  INSURANCE_AUDITS: "g005_insurance_audits",
  FOLLOW_UPS: "g005_follow_ups",
  DEVICE_CONTRACTS: "g005_device_contracts",
  CLINICAL_SYNC_RECORDS: "g005_clinical_sync",
  CONSULTATIONS: "g005_consultations",
  USER_PREFERENCES: "g005_user_preferences",
  LAST_SYNC_TIME: "g005_last_sync_time",
  SELECTED_PATIENT: "g005_selected_patient",
  FILTER_STATE: "g005_filter_state",
} as const;

// ==================== 导出类型供外部使用 ====================
export type { LoadingState, ApiCallOptions };
