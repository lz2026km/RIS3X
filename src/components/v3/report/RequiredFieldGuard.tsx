/**
 * G005 放射RIS系统 v3.0.2 - 必填项校验 + 提交阻塞
 * 对标:飞利浦 IntelliSpace / 卫宁危急值闭环
 *
 *  功能:
 *  - 声明式必填规则(field + validator)
 *  - 内置:所见/结论必填 + 长度限制 + 关键字黑名单 + ICD-10 格式 + RADS 必填
 *  - 失败时阻止提交 + 错误气泡 + 字段红色边框
 *  - 与 StructuredFieldEditor 集成(读取其必填)
 */
import React, { useMemo, useCallback, useState, useEffect, useRef, createContext, useContext } from 'react'
import { Modal, Button, Space, Tag, Tooltip, Alert, List } from 'antd'
import { ShieldAlert, AlertTriangle, X } from 'lucide-react'
import type { FieldSchema } from './StructuredFieldEditor'

export interface ValidationRule {
  /** 字段 key(或 field path) */
  key: string
  /** 显示标签 */
  label: string
  /** 是否必填 */
  required?: boolean
  /** 最小长度(对 text) */
  minLength?: number
  /** 最大长度 */
  maxLength?: number
  /** 最小值(对 number/measurement) */
  min?: number
  /** 最大值 */
  max?: number
  /** 黑名单关键字(任一命中即报错) */
  blacklist?: string[]
  /** 正则(对 text/code) */
  pattern?: { re: RegExp; message: string }
  /** 自定义校验 */
  custom?: (value: unknown, allValues: Record<string, unknown>) => string | null
  /** 严重等级(决定是否阻止提交) */
  severity?: 'error' | 'warning'
}

export interface ValidationError {
  key: string
  label: string
  message: string
  severity: 'error' | 'warning'
  value?: unknown
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  blocking: boolean
}

export const runValidation = (
  rules: ValidationRule[],
  values: Record<string, unknown>
): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  for (const rule of rules) {
    const v = values[rule.key]
    let msg: string | null = null
    if (rule.required) {
      if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
        msg = `${rule.label}为必填项`
      }
    }
    if (!msg && typeof v === 'string') {
      if (rule.minLength !== undefined && v.length < rule.minLength) {
        msg = `${rule.label}长度不能小于 ${rule.minLength} 字符`
      }
      if (rule.maxLength !== undefined && v.length > rule.maxLength) {
        msg = `${rule.label}长度不能大于 ${rule.maxLength} 字符`
      }
    }
    if (!msg && (typeof v === 'number')) {
      if (rule.min !== undefined && v < rule.min) msg = `${rule.label}不能小于 ${rule.min}`
      if (rule.max !== undefined && v > rule.max) msg = `${rule.label}不能大于 ${rule.max}`
    }
    if (!msg && rule.blacklist && rule.blacklist.length > 0 && typeof v === 'string') {
      for (const word of rule.blacklist) {
        if (v.includes(word)) {
          msg = `${rule.label}包含禁用词:${word}`
          break
        }
      }
    }
    if (!msg && rule.pattern && typeof v === 'string' && v) {
      if (!rule.pattern.re.test(v)) msg = rule.pattern.message
    }
    if (!msg && rule.custom) {
      msg = rule.custom(v, values)
    }
    if (msg) {
      const entry: ValidationError = {
        key: rule.key,
        label: rule.label,
        message: msg,
        severity: rule.severity ?? 'error',
        value: v,
      }
      if (entry.severity === 'error') errors.push(entry)
      else warnings.push(entry)
    }
  }
  return { ok: errors.length === 0, errors, warnings, blocking: errors.length > 0 }
}

// =============== 预置规则集(报告) ===============

export const DEFAULT_REPORT_RULES: ValidationRule[] = [
  {
    key: 'findings',
    label: '检查所见',
    required: true,
    minLength: 10,
    maxLength: 5000,
    blacklist: ['待补充', 'TODO', 'xxx', '...'],
  },
  {
    key: 'conclusion',
    label: '检查结论',
    required: true,
    minLength: 5,
    maxLength: 2000,
    blacklist: ['待补充', 'TODO'],
  },
  {
    key: 'suggestion',
    label: '建议',
    maxLength: 1000,
  },
  {
    key: 'signature',
    label: '签名',
    required: true,
    minLength: 2,
  },
  {
    key: 'icd10',
    label: 'ICD-10 编码',
    pattern: { re: /^[A-Z]\d{2}(\.\d{1,3})?$/, message: 'ICD-10 编码格式应为字母+数字(如 J18.901)' },
    severity: 'warning',
  },
  {
    key: 'lesionSize',
    label: '病灶大小',
    min: 0,
    max: 500,
    severity: 'warning',
  },
  {
    key: 'birads',
    label: 'BI-RADS 分级',
    custom: (v) => {
      if (v === null || v === undefined || v === '') return null
      const allowed = ['0', '1', '2', '3', '4A', '4B', '4C', '5', '6']
      if (!allowed.includes(String(v))) return 'BI-RADS 分级应为 0-6 或 4A/4B/4C'
      return null
    },
    severity: 'warning',
  },
]

/** 从 FieldSchema[] 提取 required 规则 */
export const fromFieldSchemas = (schemas: FieldSchema[]): ValidationRule[] =>
  schemas
    .filter((f) => f.required)
    .map((f) => ({
      key: f.key,
      label: f.label,
      required: true,
      minLength: f.type === 'text' ? 1 : undefined,
      min: f.type === 'number' || f.type === 'measurement' ? f.min : undefined,
      max: f.type === 'number' || f.type === 'measurement' ? f.max : undefined,
      custom:
        f.type === 'multiselect'
          ? (v) => (Array.isArray(v) && v.length > 0 ? null : `${f.label}至少选择一项`)
          : undefined,
    }))

// =============== Context + Hook ===============

interface GuardContextValue {
  result: ValidationResult
  rules: ValidationRule[]
  values: Record<string, unknown>
  addRules: (extra: ValidationRule[]) => void
  removeRules: (keys: string[]) => void
  validate: (overrides?: Record<string, unknown>) => ValidationResult
  attemptSubmit: (onPass: () => void) => void
}

const GuardContext = createContext<GuardContextValue | null>(null)

export const useFieldGuard = (): GuardContextValue => {
  const ctx = useContext(GuardContext)
  if (!ctx) throw new Error('useFieldGuard must be used within RequiredFieldGuard')
  return ctx
}

export interface RequiredFieldGuardProps {
  rules?: ValidationRule[]
  values: Record<string, unknown>
  children: React.ReactNode
  /** 校验成功后回调 */
  onValidSubmit?: () => void
  /** 字段错误时回调(用于高亮字段) */
  onFieldError?: (key: string, error: ValidationError | null) => void
  /** 自定义 Modal 标题 */
  modalTitle?: string
  /** 失败时是否弹 Modal */
  showModalOnFail?: boolean
}

export const RequiredFieldGuard: React.FC<RequiredFieldGuardProps> = ({
  rules: initialRules = DEFAULT_REPORT_RULES,
  values,
  children,
  onValidSubmit,
  onFieldError,
  modalTitle = '必填项校验未通过',
  showModalOnFail = true,
}) => {
  const [rules, setRules] = useState<ValidationRule[]>(initialRules)
  const [result, setResult] = useState<ValidationResult>({ ok: true, errors: [], warnings: [], blocking: false })
  const [modalOpen, setModalOpen] = useState(false)
  const lastValuesRef = useRef<string>('')

  const validate = useCallback(
    (overrides?: Record<string, unknown>) => {
      const merged = { ...values, ...(overrides ?? {}) }
      const r = runValidation(rules, merged)
      setResult(r)
      onFieldError && r.errors.forEach((e) => onFieldError(e.key, e))
      return r
    },
    [rules, values, onFieldError]
  )

  // 字段错误回调
  useEffect(() => {
    if (!onFieldError) return
    result.errors.forEach((e) => onFieldError(e.key, e))
    // 已通过的字段清空
    rules.forEach((rule) => {
      const hasError = result.errors.some((e) => e.key === rule.key)
      if (!hasError) onFieldError(rule.key, null)
    })
  }, [result, rules, onFieldError])

  // 值变化自动重新校验
  useEffect(() => {
    const sig = JSON.stringify(values)
    if (sig === lastValuesRef.current) return
    lastValuesRef.current = sig
    validate()
  }, [values, validate])

  const addRules = useCallback((extra: ValidationRule[]) => {
    setRules((prev) => {
      const keys = new Set(prev.map((r) => r.key))
      const filtered = extra.filter((r) => !keys.has(r.key))
      return [...prev, ...filtered]
    })
  }, [])

  const removeRules = useCallback((keys: string[]) => {
    setRules((prev) => prev.filter((r) => !keys.includes(r.key)))
  }, [])

  const attemptSubmit = useCallback(
    (onPass: () => void) => {
      const r = validate()
      if (r.ok) {
        onPass()
        onValidSubmit?.()
      } else if (showModalOnFail) {
        setModalOpen(true)
      }
    },
    [validate, onValidSubmit, showModalOnFail]
  )

  const value: GuardContextValue = useMemo(
    () => ({ result, rules, values, addRules, removeRules, validate, attemptSubmit }),
    [result, rules, values, addRules, removeRules, validate, attemptSubmit]
  )

  return (
    <GuardContext.Provider value={value}>
      {children}
      <Modal
        data-testid="rfg-modal"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setModalOpen(false)}>
            我知道了
          </Button>,
        ]}
        title={
          <Space>
            <ShieldAlert size={16} color="#dc2626" />
            <span>{modalTitle}</span>
          </Space>
        }
        width={560}
      >
        <Alert
          type="error"
          showIcon
          title={`发现 ${result.errors.length} 个必填/错误项,请修正后再提交`}
          style={{ marginBottom: 12 }}
        />
        <List
          dataSource={result.errors}
          renderItem={(e) => (
            <List.Item style={{ padding: '8px 0' }}>
              <Space>
                <Tag color="red" icon={<X size={10} />}>
                  错误
                </Tag>
                <strong>{e.label}</strong>
                <span style={{ color: '#dc2626' }}>{e.message}</span>
              </Space>
            </List.Item>
          )}
        />
        {result.warnings.length > 0 && (
          <>
            <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600 }}>警告(不阻塞)</div>
            <List
              dataSource={result.warnings}
              renderItem={(e) => (
                <List.Item style={{ padding: '6px 0' }}>
                  <Space>
                    <Tag color="orange" icon={<AlertTriangle size={10} />}>
                      警告
                    </Tag>
                    <span>{e.label}</span>
                    <span style={{ color: '#d97706' }}>{e.message}</span>
                  </Space>
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>
    </GuardContext.Provider>
  )
}

// =============== 字段级错误高亮 HOC ===============

export interface FieldErrorHighlightProps {
  error: ValidationError | null
  children: React.ReactNode
}

export const FieldErrorHighlight: React.FC<FieldErrorHighlightProps> = ({ error, children }) => {
  if (!error) return <>{children}</>
  return (
    <div
      data-testid={`field-error-${error.key}`}
      style={{
        borderLeft: `3px solid #dc2626`,
        paddingLeft: 8,
        background: '#fef2f2',
        borderRadius: 4,
        position: 'relative',
      }}
    >
      <Tooltip title={error.message} placement="left">
        <span
          style={{
            position: 'absolute',
            top: -8,
            left: -8,
            width: 16,
            height: 16,
            background: '#dc2626',
            color: 'white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            zIndex: 1,
          }}
        >
          !
        </span>
      </Tooltip>
      {children}
    </div>
  )
}

export default RequiredFieldGuard
