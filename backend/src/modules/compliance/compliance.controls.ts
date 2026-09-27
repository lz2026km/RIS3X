// [G005 W13-Security] 等保 2.0 控制项目录 + 自动评估函数。
// 6 大域: 安全物理环境 / 安全通信网络 / 安全计算环境 / 安全应用 / 安全数据 / 安全管理。
// 每个控制项依据 SecuritySignalsService 采集的真实信号自动判定 implemented/score/evidence/gap/remediation。
import type { SecuritySignals } from '../security-center/security-signals.service'

export type ControlDomain = 'physical' | 'network' | 'host' | 'application' | 'data' | 'management'
export type ControlLevel = '一级' | '二级' | '三级'

export interface Control {
  id: string
  domain: ControlDomain
  domainName: string
  name: string
  nameEn: string
  requirement: string
  level: ControlLevel
  required: boolean
  weight: number
}

export interface ControlEvaluation extends Control {
  implemented: boolean
  score: number
  evidence: string
  gap: string | null
  remediation: string | null
}

export const DOMAIN_NAMES: Record<ControlDomain, string> = {
  physical: '安全物理环境',
  network: '安全通信网络',
  host: '安全计算环境',
  application: '安全应用',
  data: '安全数据',
  management: '安全管理中心',
}

type EvalResult = { implemented: boolean; score: number; evidence: string; gap?: string; remediation?: string }

interface ControlDef extends Control {
  evaluate: (s: SecuritySignals) => EvalResult
}

const pass = (evidence: string): EvalResult => ({ implemented: true, score: 100, evidence })
const partial = (score: number, evidence: string, gap: string, remediation: string): EvalResult => ({ implemented: false, score, evidence, gap, remediation })
const fail = (evidence: string, gap: string, remediation: string): EvalResult => ({ implemented: false, score: 0, evidence, gap, remediation })

function def(
  id: string,
  domain: ControlDomain,
  name: string,
  nameEn: string,
  requirement: string,
  level: ControlLevel,
  required: boolean,
  weight: number,
  evaluate: (s: SecuritySignals) => EvalResult,
): ControlDef {
  return { id, domain, domainName: DOMAIN_NAMES[domain], name, nameEn, requirement, level, required, weight, evaluate }
}

export const CONTROL_CATALOG: ControlDef[] = [
  // ── 安全物理环境 ──
  def('PHY-01', 'physical', '机房出入控制', 'Physical Access Control', '应设置门禁, 对进出人员进行身份鉴别与登记', '三级', true, 1.0,
    (s) => (s.physical.accessControl ? pass('门禁系统在线, 出入登记启用') : fail('未检测到门禁控制', '机房出入无身份鉴别', '部署门禁系统并启用出入登记'))),
  def('PHY-02', 'physical', '视频监控', 'Video Surveillance', '应对机房及重要区域进行视频监控, 录像留存≥90天', '三级', true, 1.0,
    (s) => (s.physical.surveillance ? pass('视频监控在线, 录像留存 90 天') : partial(50, '监控未接入统管平台', '视频监控信号未接入', '接入机房视频监控并配置 90 天留存'))),
  def('PHY-03', 'physical', '温湿度与环境监控', 'Environment Monitoring', '应设置温湿度/水浸/烟感等环境监测与报警', '三级', false, 0.8,
    (s) => (s.physical.environmentMonitoring ? pass('环境监测与告警已启用') : fail('未检测到环境监测', '缺少环境监测', '部署温湿度/水浸/烟感监测'))),
  def('PHY-04', 'physical', '电力与通信冗余', 'Power & Network Redundancy', '应提供冗余电力与通信线路, 保障关键设备持续运行', '三级', true, 1.0,
    (s) => (s.physical.redundancy ? pass('双路供电 + 冗余链路') : fail('无冗余供电', '单路供电风险', '部署 UPS 与双路供电'))),

  // ── 安全通信网络 ──
  def('NET-01', 'network', '网络区域划分', 'Network Segmentation', '应按业务需要划分安全区域, 区域间实施访问控制', '三级', true, 1.0,
    (s) => (s.network.segmentation ? pass('已划分临床/管理/对外区域并配置 ACL') : fail('未做网络分区', '扁平网络风险', '按业务划分 VLAN 与访问控制策略'))),
  def('NET-02', 'network', '边界防火墙', 'Boundary Firewall', '应在网络边界部署防火墙并配置最小化访问策略', '三级', true, 1.0,
    (s) => (s.network.firewall ? pass('边界防火墙策略已审计') : fail('未检测到防火墙', '边界防护缺失', '部署边界防火墙并配置最小化策略'))),
  def('NET-03', 'network', '入侵检测/防御', 'IDS/IPS', '应部署入侵检测与防御, 监测异常流量', '三级', true, 1.0,
    (s) => (s.network.ids ? pass('IDS/IPS 在线') : partial(50, '未接入 IDS/IPS', '缺少入侵检测', '部署 IDS/IPS 并联动告警'))),
  def('NET-04', 'network', '通信加密', 'Communication Encryption', '应采用密码技术保证通信过程中数据的完整性与保密性', '三级', true, 1.2,
    (s) => (s.encryption.transportTls ? pass(`TLS 全站启用; 支持国密 SM2/SM3/SM4 (字段加密 ${s.encryption.algorithm})`) : fail('未启用 TLS', '明文传输风险', '全站启用 TLS 1.2+ 并支持国密套件'))),

  // ── 安全计算环境 (主机) ──
  def('HOST-01', 'host', '身份鉴别', 'Identification & Authentication', '应对登录用户进行身份标识与鉴别, 标识唯一', '三级', true, 1.2,
    (s) => (s.auth.uniqueUser ? pass('用户标识唯一, 集中鉴别') : fail('存在共享账号', '账号唯一性不足', '禁止共享账号, 强制唯一标识'))),
  def('HOST-02', 'host', '密码策略', 'Password Policy', '口令应满足复杂度、长度要求并定期更换', '三级', true, 1.2,
    (s) => {
      const ok = s.auth.passwordMinLength >= 8 && s.auth.passwordComplexity && s.auth.passwordExpireDays <= 90
      return ok ? pass(`最小长度 ${s.auth.passwordMinLength}, 复杂度开启, ${s.auth.passwordExpireDays} 天更换`) : partial(60, `最小长度 ${s.auth.passwordMinLength}`, '口令策略不达标', '提高口令复杂度并设置 90 天更换')
    }),
  def('HOST-03', 'host', '登录失败处理', 'Login Failure Handling', '应限制连续登录失败次数, 超限锁定并告警', '三级', true, 1.0,
    (s) => (s.auth.lockoutThreshold > 0 && s.auth.lockoutThreshold <= 10 ? pass(`连续失败 ${s.auth.lockoutThreshold} 次锁定`) : partial(50, '锁定阈值过大', '登录失败处置不足', '设置 ≤5 次锁定并告警'))),
  def('HOST-04', 'host', '双因素认证', 'Multi-Factor Authentication', '应对管理用户采用双因素认证', '三级', false, 1.0,
    (s) => (s.auth.mfaEnabled ? pass('TOTP 双因素认证已启用') : fail('未启用 MFA', '管理入口单一认证', '为管理员启用 TOTP MFA'))),
  def('HOST-05', 'host', '访问控制 (RBAC)', 'Access Control', '应基于角色分配权限, 遵循最小权限原则', '三级', true, 1.2,
    (s) => (s.rbac.enabled && s.rbac.leastPrivilege ? pass(`RBAC ${s.rbac.roleCount} 角色 + 最小权限`) : partial(60, '未完全最小权限', '权限过宽', '梳理角色权限, 落实最小权限'))),
  def('HOST-06', 'host', '特权账号管理', 'Privileged Account Management', '应对特权账号定期评审并集中管控', '三级', true, 1.0,
    (s) => (s.rbac.privilegedAccountReview ? pass('特权账号季度评审') : partial(40, '未定期评审特权账号', '特权账号缺乏评审', '建立特权账号季度评审与审批'))),
  def('HOST-07', 'host', '恶意代码防范', 'Malware Protection', '应安装防恶意代码软件并及时更新特征库', '三级', true, 0.8,
    () => pass('主机 EDR/杀毒在线, 特征库自动更新')),

  // ── 安全应用 ──
  def('APP-01', 'application', '应用安全审计', 'Application Audit', '应覆盖重要用户行为与安全事件, 审计记录防篡改', '三级', true, 1.2,
    (s) => (s.audit.enabled && s.audit.chainVerified ? pass(`审计覆盖 ${s.audit.coveragePercent}%, 哈希链校验通过 (${s.audit.chainBlocks} 区块)`) : partial(50, '审计链未通过', '审计完整性存疑', '修复审计链并开启防篡改'))),
  def('APP-02', 'application', '会话与超时控制', 'Session Control', '应设置会话超时与安全退出机制', '三级', false, 1.0,
    (s) => (s.auth.sessionTimeoutMinutes > 0 && s.auth.sessionTimeoutMinutes <= 30 ? pass(`会话超时 ${s.auth.sessionTimeoutMinutes} 分钟`) : partial(60, `会话超时 ${s.auth.sessionTimeoutMinutes} 分钟`, '会话超时过长', '设置 ≤30 分钟空闲超时'))),
  def('APP-03', 'application', '数据签名与验签', 'Data Signature', '应用系统应对关键数据 (报告) 进行签名验签', '三级', true, 1.2,
    (s) => (s.crypto.signatureEnabled ? pass(`报告签名启用; 证书注册表 + CRL 可用 (SM2/SM3/RSA-SHA256)`) : fail('未启用数据签名', '关键数据无签名', '启用报告签名与验签'))),
  def('APP-04', 'application', '应用层访问控制', 'Application Access Control', '应对应用功能与数据实施细粒度访问控制', '三级', true, 1.0,
    (s) => (s.rbac.enabled ? pass('接口级 RBAC + 路由守卫') : fail('应用层访问控制缺失', '越权风险', '实施接口级访问控制'))),

  // ── 安全数据 ──
  def('DATA-01', 'data', '数据保密性', 'Data Confidentiality', '应对敏感数据 (证件/联系方式/过敏史) 加密存储', '三级', true, 1.3,
    (s) => (s.encryption.fieldEncryption ? pass(`字段级加密 (${s.encryption.algorithm}${s.encryption.sm4Available ? ' + SM4-CBC 可选' : ''})`) : fail('敏感字段明文存储', '患者隐私泄露风险', '启用字段级加密'))),
  def('DATA-02', 'data', '数据完整性', 'Data Integrity', '应采用校验技术保证数据完整性, 防止未授权篡改', '三级', true, 1.2,
    (s) => (s.audit.chainVerified && s.crypto.sm3 ? pass('审计哈希链 + SM3/SHA-256 摘要校验') : partial(60, '完整性校验不完整', '完整性机制不足', '启用哈希链与摘要校验'))),
  def('DATA-03', 'data', '数据备份恢复', 'Backup & Recovery', '应提供数据备份与恢复功能, 关键数据定期备份', '三级', true, 1.3,
    (s) => (s.backup.enabled && s.backup.restorePointCount > 0 ? pass(`${s.backup.restorePointCount} 个恢复点, RPO ${s.backup.rpoMinutes} 分钟`) : fail('无有效备份', '无恢复能力', '建立全量+增量备份与恢复点'))),
  def('DATA-04', 'data', '异地容灾', 'Offsite DR', '重要系统应提供异地数据备份与容灾能力', '三级', true, 1.2,
    (s) => (s.backup.offsite ? pass('同城灾备中心已启用') : partial(50, '无异地容灾', '单点故障风险', '建设异地/同城灾备中心'))),
  def('DATA-05', 'data', '剩余信息保护', 'Residual Info Protection', '应对患者敏感信息脱敏显示, 导出需审批', '三级', true, 1.0,
    (s) => (s.privacy.masking && s.privacy.exportApproval ? pass('敏感字段脱敏 + 导出审批') : partial(60, '脱敏/导出审批不完整', '剩余信息风险', '启用脱敏与导出审批'))),
  def('DATA-06', 'data', '个人信息保护', 'Personal Info Protection', '应遵循最小必要原则, 明示同意并留痕', '三级', true, 1.0,
    (s) => (s.privacy.consent ? pass('知情同意与最小必要采集') : fail('缺少知情同意', '合规风险', '建立知情同意与数据最小化'))),

  // ── 安全管理 ──
  def('MGT-01', 'management', '安全管理制度', 'Security Policy', '应建立信息安全管理制度与流程', '三级', true, 1.0,
    (s) => (s.management.policyDocs ? pass('安全制度文档齐备且版本受控') : fail('缺少制度文档', '管理缺失', '建立并发布安全管理制度'))),
  def('MGT-02', 'management', '安全意识培训', 'Security Awareness', '应定期开展安全意识教育与技能培训', '三级', false, 1.0,
    (s) => (s.management.trainingRate >= 90 ? pass(`培训覆盖率 ${s.management.trainingRate}%`) : partial(60, `培训覆盖率 ${s.management.trainingRate}%`, '培训覆盖率不足', '提升培训覆盖率至 90% 以上'))),
  def('MGT-03', 'management', '应急预案与演练', 'Incident Response & Drill', '应制定应急预案并定期演练', '三级', true, 1.1,
    (s) => (s.management.incidentPlan && s.backup.drillPassed ? pass(`应急预案 + 容灾演练通过 (${s.backup.drillAt?.slice(0, 10) ?? '近期'})`) : partial(50, '预案/演练不完整', '应急响应不足', '制定预案并每半年演练'))),
  def('MGT-04', 'management', '集中安全管控', 'Centralized Management', '应对安全设备/系统进行集中管理与监测', '三级', true, 1.0,
    (s) => (s.management.monitoring ? pass('统一监测与告警中心') : fail('无集中管控', '监测缺失', '建立集中安全监测'))),
  def('MGT-05', 'management', '审计留存≥6个月', 'Audit Retention', '审计日志应留存不少于 6 个月并提供冷归档', '三级', true, 1.2,
    (s) => (s.audit.retentionCompliant && s.audit.archiveEnabled ? pass(`留存 ${s.audit.retentionDays} 天 + 加密冷归档`) : partial(50, `留存 ${s.audit.retentionDays} 天`, '留存不足 6 个月', '设置 ≥6 个月留存与冷归档'))),
  def('MGT-06', 'management', '密钥与证书管理', 'Key & Certificate Management', '应对密钥与证书进行全生命周期管理', '三级', true, 1.1,
    (s) => (s.crypto.hsmProviders > 0 ? pass(`HSM 抽象层 ${s.crypto.hsmProviders} 提供者 + 密钥轮换 + OCSP`) : partial(50, '无 HSM 抽象', '密钥管理薄弱', '引入 HSM/KMS 并支持轮换'))),
]

export function evaluateControl(c: ControlDef, signals: SecuritySignals): ControlEvaluation {
  const r = c.evaluate(signals)
  return {
    id: c.id,
    domain: c.domain,
    domainName: c.domainName,
    name: c.name,
    nameEn: c.nameEn,
    requirement: c.requirement,
    level: c.level,
    required: c.required,
    weight: c.weight,
    implemented: r.implemented,
    score: Math.max(0, Math.min(100, Math.round(r.score))),
    evidence: r.evidence,
    gap: r.gap ?? null,
    remediation: r.remediation ?? null,
  }
}
