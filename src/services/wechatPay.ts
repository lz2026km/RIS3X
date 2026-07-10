// ============================================================
// G005 放射RIS - 微信支付服务 (Mock 完整接口)
// Phase B1: 真实化患者门户/收费流程
// 对标: 微信支付 V3 API / 微信 JSAPI 支付
// ============================================================

/**
 * 微信支付 V3 统一接口(本实现为 Mock,真实环境请对接 wxpay-sdk)
 * 所有方法返回 Promise<ApiResponse<T>> 形式
 */

export type WechatTradeState =
  | 'NOTPAY'      // 未支付
  | 'SUCCESS'     // 已支付
  | 'REFUND'      // 转入退款
  | 'CLOSED'      // 已关闭
  | 'REVOKED'     // 已撤销
  | 'USERPAYING'  // 用户支付中
  | 'PAYERROR';   // 支付失败

export interface UnifiedOrderRequest {
  /** 商户订单号(医院系统订单 ID) */
  outTradeNo: string;
  /** 金额(分) */
  totalFee: number;        // 单位:分
  /** 商品描述 */
  body: string;
  /** 患者 ID */
  patientId: string;
  /** 患者 openId(JSAPI 必填) */
  openId?: string;
  /** 支付场景:JSAPI / NATIVE / H5 / APP */
  tradeType: 'JSAPI' | 'NATIVE' | 'H5' | 'APP';
  /** 异步通知地址 */
  notifyUrl?: string;
  /** 订单过期时间(分钟) */
  expireMinutes?: number;
  /** 附加数据 */
  attach?: string;
}

export interface UnifiedOrderResult {
  /** 微信支付订单号 */
  transactionId?: string;
  /** 商户订单号 */
  outTradeNo: string;
  /** 预支付交易会话标识(JSAPI 调起支付必需) */
  prepayId: string;
  /** 二维码链接(NATIVE 必返) */
  codeUrl?: string;
  /** JSAPI 调起支付参数 */
  jsapiParams?: JsapiPayParams;
  /** 订单创建时间(ISO) */
  createdAt: string;
  /** 订单过期时间(ISO) */
  expireAt: string;
}

export interface JsapiPayParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;        // prepay_id=xxx
  signType: 'RSA' | 'MD5' | 'HMAC-SHA256';
  paySign: string;
}

export interface OrderQueryRequest {
  /** 商户订单号(优先) */
  outTradeNo?: string;
  /** 微信支付订单号 */
  transactionId?: string;
}

export interface OrderQueryResult {
  outTradeNo: string;
  transactionId: string;
  tradeState: WechatTradeState;
  totalFee: number;
  paidAt?: string;
  patientId?: string;
  body?: string;
  attach?: string;
  bankType?: string;
}

export interface RefundRequest {
  /** 商户订单号 */
  outTradeNo: string;
  /** 商户退款单号 */
  outRefundNo: string;
  /** 退款金额(分) */
  refundFee: number;
  /** 原订单金额(分) */
  totalFee: number;
  /** 退款原因 */
  reason: string;
  /** 退款通知地址 */
  notifyUrl?: string;
}

export interface RefundResult {
  outTradeNo: string;
  outRefundNo: string;
  refundId: string;
  refundFee: number;
  status: 'SUCCESS' | 'PROCESSING' | 'FAILED';
  refundedAt: string;
}

export interface WechatPayConfig {
  appId: string;
  mchId: string;
  apiKey: string;
  notifyUrl: string;
  sandbox: boolean;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error?: { code: string; message: string };
}

const MOCK_CONFIG: WechatPayConfig = {
  appId: 'wx5a0c8c0e7d3f1b22',
  mchId: '1638000001',
  apiKey: 'MOCK_API_KEY_RIS_PAYMENT_2026',
  notifyUrl: '/api/v1/wechat/pay/notify',
  sandbox: true,
};

const MOCK_ORDERS = new Map<string, UnifiedOrderResult & { tradeState: WechatTradeState; totalFee: number; patientId?: string }>();
const MOCK_REFUNDS = new Map<string, RefundResult>();

function nowIso(): string {
  return new Date().toISOString();
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')}`;
}

function genNonce(len = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function ok<T>(data: T): ApiEnvelope<T> {
  return { success: true, data };
}

function fail<T>(code: string, message: string): ApiEnvelope<T> {
  return { success: false, data: null, error: { code, message } };
}

async function delay(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms));
}

async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return `mock_${(h >>> 0).toString(16)}`;
}

/**
 * 统一下单 - 商户系统先调用本接口生成预支付交易单
 */
export async function unifiedOrder(req: UnifiedOrderRequest): Promise<ApiEnvelope<UnifiedOrderResult>> {
  await delay(80);
  if (!req.outTradeNo) return fail('PARAM_ERROR', 'outTradeNo 不能为空');
  if (req.totalFee <= 0) return fail('PARAM_ERROR', 'totalFee 必须大于 0');
  if (req.tradeType === 'JSAPI' && !req.openId) {
    return fail('PARAM_ERROR', 'JSAPI 模式 openId 必填');
  }
  if (MOCK_ORDERS.has(req.outTradeNo)) {
    return fail('ORDER_EXISTS', `订单 ${req.outTradeNo} 已存在`);
  }

  const prepayId = genId('pre');
  const expireMin = req.expireMinutes ?? 15;
  const createdAt = nowIso();
  const expireAt = new Date(Date.now() + expireMin * 60_000).toISOString();

  const order: UnifiedOrderResult & { tradeState: WechatTradeState; totalFee: number; patientId?: string } = {
    outTradeNo: req.outTradeNo,
    prepayId,
    codeUrl: req.tradeType === 'NATIVE' ? `weixin://wxpay/bizpayurl?pr=${prepayId}` : undefined,
    createdAt,
    expireAt,
    tradeState: 'NOTPAY',
    totalFee: req.totalFee,
    patientId: req.patientId,
  };

  if (req.tradeType === 'JSAPI') {
    const jsapiParams: JsapiPayParams = {
      appId: MOCK_CONFIG.appId,
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      nonceStr: genNonce(),
      package: `prepay_id=${prepayId}`,
      signType: 'RSA',
      paySign: await sha256Hex(`${prepayId}|${MOCK_CONFIG.apiKey}`),
    };
    order.jsapiParams = jsapiParams;
  }

  MOCK_ORDERS.set(req.outTradeNo, order);
  return ok(order);
}

/**
 * 查询订单 - 轮询订单支付状态
 */
export async function orderQuery(req: OrderQueryRequest): Promise<ApiEnvelope<OrderQueryResult>> {
  await delay(40);
  if (!req.outTradeNo && !req.transactionId) {
    return fail('PARAM_ERROR', 'outTradeNo / transactionId 至少传一个');
  }
  const order = req.outTradeNo ? MOCK_ORDERS.get(req.outTradeNo) : null;
  if (!order) {
    // Mock 兜底: 找不到时返回模拟的已支付订单
    if (req.outTradeNo) {
      return ok({
        outTradeNo: req.outTradeNo,
        transactionId: genId('wx'),
        tradeState: 'SUCCESS',
        totalFee: 0,
        paidAt: nowIso(),
      });
    }
    return fail('NOT_FOUND', '订单不存在');
  }
  return ok({
    outTradeNo: order.outTradeNo,
    transactionId: genId('wx'),
    tradeState: order.tradeState,
    totalFee: order.totalFee,
    paidAt: order.tradeState === 'SUCCESS' ? nowIso() : undefined,
    patientId: order.patientId,
  });
}

/**
 * 申请退款
 */
export async function refund(req: RefundRequest): Promise<ApiEnvelope<RefundResult>> {
  await delay(120);
  if (!req.outTradeNo) return fail('PARAM_ERROR', 'outTradeNo 必填');
  if (req.refundFee <= 0 || req.refundFee > req.totalFee) {
    return fail('PARAM_ERROR', 'refundFee 必须在 (0, totalFee] 区间');
  }
  if (MOCK_REFUNDS.has(req.outRefundNo)) {
    return fail('REFUND_EXISTS', `退款单 ${req.outRefundNo} 已存在`);
  }
  const result: RefundResult = {
    outTradeNo: req.outTradeNo,
    outRefundNo: req.outRefundNo,
    refundId: genId('rf'),
    refundFee: req.refundFee,
    status: 'SUCCESS',
    refundedAt: nowIso(),
  };
  MOCK_REFUNDS.set(req.outRefundNo, result);
  return ok(result);
}

/**
 * JSAPI 调起支付 - 在微信内浏览器/H5 中唤起支付面板
 * 真实环境需通过 WeixinJSBridge / wx.miniProgram.navigateTo 触发
 */
export async function jsapiPay(params: {
  outTradeNo: string;
  totalFee: number;
  body: string;
  openId: string;
  patientId: string;
  onSuccess?: (result: { transactionId: string; paidAt: string }) => void;
  onFail?: (err: { code: string; message: string }) => void;
}): Promise<ApiEnvelope<{ prepayId: string; jsapiParams: JsapiPayParams; status: 'INVOKED' }>> {
  const order = await unifiedOrder({
    outTradeNo: params.outTradeNo,
    totalFee: params.totalFee,
    body: params.body,
    patientId: params.patientId,
    openId: params.openId,
    tradeType: 'JSAPI',
  });
  if (!order.success || !order.data) {
    if (params.onFail) params.onFail(order.error ?? { code: 'UNKNOWN', message: '下单失败' });
    return fail(order.error?.code ?? 'UNKNOWN', order.error?.message ?? '下单失败');
  }

  // Mock: 模拟用户在 1.5s 后确认支付
  setTimeout(() => {
    const txId = genId('wx');
    const stored = MOCK_ORDERS.get(params.outTradeNo);
    if (stored) {
      stored.tradeState = 'SUCCESS';
      MOCK_ORDERS.set(params.outTradeNo, stored);
    }
    params.onSuccess?.({ transactionId: txId, paidAt: nowIso() });
  }, 1500);

  return ok({
    prepayId: order.data.prepayId,
    jsapiParams: order.data.jsapiParams!,
    status: 'INVOKED',
  });
}

/**
 * 关闭订单 - 撤销未支付订单
 */
export async function closeOrder(outTradeNo: string): Promise<ApiEnvelope<{ closed: boolean }>> {
  await delay(40);
  const order = MOCK_ORDERS.get(outTradeNo);
  if (!order) return fail('NOT_FOUND', '订单不存在');
  if (order.tradeState === 'SUCCESS') return fail('ORDER_PAID', '订单已支付,不可关闭');
  order.tradeState = 'CLOSED';
  MOCK_ORDERS.set(outTradeNo, order);
  return ok({ closed: true });
}

/**
 * 获取当前生效的支付配置(仅供前端展示用途,密钥永远不要下发到客户端)
 */
export function getWechatPayPublicConfig(): Omit<WechatPayConfig, 'apiKey'> {
  const { appId, mchId, notifyUrl, sandbox } = MOCK_CONFIG;
  return { appId, mchId, notifyUrl, sandbox };
}

export const wechatPay = {
  unifiedOrder,
  orderQuery,
  refund,
  jsapiPay,
  closeOrder,
  getWechatPayPublicConfig,
};

export default wechatPay;
