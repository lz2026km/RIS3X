/**
 * [G005 W12-PatientService] 微信服务号/小程序 MSW Handlers
 * 单一来源位于 ./w12PatientHandlers (wxHandlers), 此处重新导出以在 handlers.ts 注册。
 *
 * 覆盖端点 (挂载 /api/v1):
 *   POST /wechat/oauth/callback  POST /wechat/bind       GET  /wechat/subscribe/config
 *   GET  /wechat/menu            POST /wechat/menu       GET  /wechat/logs
 *   POST /wechat/logs/archive    GET  /wechat/users      GET  /wechat/user/:openid
 *   POST /wechat/push            POST /wechat/template/send
 */
export { wechatHandlers } from './w12PatientHandlers';
