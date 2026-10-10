// ============================================================
// G005 放射科RIS系统 v1.0.6 - 分送/导出/签名 Mock 数据
// Phase R6
// ============================================================

// ============================================================
// PDF / Word 导出模板
// ============================================================
export type ExportFormat = 'pdf' | 'word' | 'html' | 'dicom-sr';
export type ExportTemplate = 'standard' | 'simplified' | 'research' | 'insurance' | 'patient';

export interface ExportTemplateConfig {
  id: string;
  name: string;
  format: ExportFormat;
  template: ExportTemplate;
  description: string;
  hasImages: boolean;
  hasSignature: boolean;
  hasQRCode: boolean;
  hasWatermark: boolean;
  pageSize: 'A4' | 'A5' | 'Letter';
  estimatedSize: string;
  icon: string;
  color: string;
}

export const EXPORT_TEMPLATES: ExportTemplateConfig[] = [
  { id: 'exp-001', name: '标准报告 PDF', format: 'pdf', template: 'standard',
    description: '含完整所见/诊断/建议+关键图像+医生签名+二维码', hasImages: true, hasSignature: true, hasQRCode: true, hasWatermark: true,
    pageSize: 'A4', estimatedSize: '~850 KB', icon: '', color: 'var(--color-error-600)' },
  { id: 'exp-002', name: '简化报告 PDF', format: 'pdf', template: 'simplified',
    description: '仅诊断意见和结论，适合患者打印', hasImages: false, hasSignature: true, hasQRCode: true, hasWatermark: false,
    pageSize: 'A5', estimatedSize: '~120 KB', icon: '', color: 'var(--color-primary-500)' },
  { id: 'exp-003', name: '科研用 PDF', format: 'pdf', template: 'research',
    description: '含完整 DICOM 图像+测量数据+结构化字段', hasImages: true, hasSignature: true, hasQRCode: false, hasWatermark: true,
    pageSize: 'A4', estimatedSize: '~12 MB', icon: '', color: '#7c3aed' },
  { id: 'exp-004', name: '医保专用 PDF', format: 'pdf', template: 'insurance',
    description: '符合医保审核要求，含 ICD-10 + DRG 编码', hasImages: false, hasSignature: true, hasQRCode: true, hasWatermark: true,
    pageSize: 'A4', estimatedSize: '~450 KB', icon: '', color: '#059669' },
  { id: 'exp-005', name: '患者告知 PDF', format: 'pdf', template: 'patient',
    description: '通俗易懂的诊断说明+注意事项', hasImages: false, hasSignature: false, hasQRCode: true, hasWatermark: false,
    pageSize: 'A5', estimatedSize: '~80 KB', icon: '', color: 'var(--color-info-600)' },
  { id: 'exp-006', name: 'Word 可编辑', format: 'word', template: 'standard',
    description: '可二次编辑的 Word 文档', hasImages: true, hasSignature: false, hasQRCode: false, hasWatermark: false,
    pageSize: 'A4', estimatedSize: '~2.3 MB', icon: '', color: 'var(--color-primary-600)' },
  { id: 'exp-007', name: 'DICOM SR', format: 'dicom-sr', template: 'standard',
    description: 'DICOM Structured Report 标准格式', hasImages: false, hasSignature: true, hasQRCode: false, hasWatermark: false,
    pageSize: 'A4', estimatedSize: '~25 KB', icon: '', color: '#475569' },
  { id: 'exp-008', name: 'HTML 网页版', format: 'html', template: 'standard',
    description: '可邮件发送的网页格式报告', hasImages: true, hasSignature: true, hasQRCode: true, hasWatermark: false,
    pageSize: 'A4', estimatedSize: '~340 KB', icon: '', color: '#7c3aed' },
];

// ============================================================
// 推送渠道
// ============================================================
export type DeliveryChannel = 'wechat' | 'sms' | 'email' | 'inApp' | 'dicom' | 'paper' | 'cloud' | 'film';

export interface DeliveryRecord {
  id: string;
  reportId: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  patientWechat?: string;
  channel: DeliveryChannel;
  deliveredAt: string;
  status: 'pending' | 'delivered' | 'read' | 'failed';
  failureReason?: string;
  retryCount: number;
  openedAt?: string;
  downloadCount: number;
  notifyDoctor: string;
  template: 'standard' | 'simplified' | 'patient';
}

export const DELIVERY_RECORDS: DeliveryRecord[] = [
  { id: 'dl-001', reportId: 'rpt-038', patientName: '袁建华', patientPhone: '138****1234',
    channel: 'wechat', deliveredAt: '2026-06-04 14:30:00', status: 'read', retryCount: 0,
    openedAt: '2026-06-04 15:12:00', downloadCount: 2, notifyDoctor: '李慧敏', template: 'standard' },
  { id: 'dl-002', reportId: 'rpt-039', patientName: '余小红', patientPhone: '139****5678',
    channel: 'sms', deliveredAt: '2026-06-04 15:00:00', status: 'delivered', retryCount: 0,
    downloadCount: 0, notifyDoctor: '王建华', template: 'simplified' },
  { id: 'dl-003', reportId: 'rpt-040', patientName: '邱淑芬', patientEmail: 'qiu****@163.com',
    channel: 'email', deliveredAt: '2026-06-04 16:00:00', status: 'read', retryCount: 0,
    openedAt: '2026-06-04 18:30:00', downloadCount: 1, notifyDoctor: '陈晓燕', template: 'patient' },
  { id: 'dl-004', reportId: 'rpt-041', patientName: '田亮', patientWechat: 'tian****',
    channel: 'wechat', deliveredAt: '2026-06-04 01:30:00', status: 'read', retryCount: 0,
    openedAt: '2026-06-04 09:00:00', downloadCount: 3, notifyDoctor: '张明远', template: 'standard' },
  { id: 'dl-005', reportId: 'rpt-042', patientName: '范敏', patientPhone: '135****9012',
    channel: 'sms', deliveredAt: '2026-06-04 18:15:00', status: 'failed',
    failureReason: '手机号空号', retryCount: 2,
    downloadCount: 0, notifyDoctor: '刘文博', template: 'simplified' },
  { id: 'dl-006', reportId: 'rpt-036', patientName: '杨秀云', patientPhone: '188****3456',
    channel: 'wechat', deliveredAt: '2026-06-03 09:00:00', status: 'read', retryCount: 0,
    openedAt: '2026-06-03 10:30:00', downloadCount: 1, notifyDoctor: '李慧敏', template: 'standard' },
  { id: 'dl-007', reportId: 'rpt-037', patientName: '高建军', patientEmail: 'gao****@qq.com',
    channel: 'email', deliveredAt: '2026-06-03 10:00:00', status: 'read', retryCount: 0,
    openedAt: '2026-06-03 14:20:00', downloadCount: 0, notifyDoctor: '王建华', template: 'patient' },
  { id: 'dl-008', reportId: 'rpt-038', patientName: '袁建华', patientPhone: '138****1234',
    channel: 'dicom', deliveredAt: '2026-06-03 08:00:00', status: 'delivered', retryCount: 0,
    downloadCount: 0, notifyDoctor: '李慧敏', template: 'standard' },
  { id: 'dl-009', reportId: 'rpt-042', patientName: '范敏', patientWechat: 'fan****',
    channel: 'cloud', deliveredAt: '2026-06-04 18:30:00', status: 'read', retryCount: 0,
    openedAt: '2026-06-04 19:00:00', downloadCount: 1, notifyDoctor: '刘文博', template: 'standard' },
  { id: 'dl-010', reportId: 'rpt-036', patientName: '杨秀云', patientPhone: '188****3456',
    channel: 'film', deliveredAt: '2026-06-03 14:00:00', status: 'delivered', retryCount: 0,
    downloadCount: 0, notifyDoctor: '李慧敏', template: 'standard' },
];

// ============================================================
// CA 数字签名
// ============================================================
export type SignatureAlgorithm = 'RSA-SHA256' | 'SM2-SM3';
export type CertificateStatus = 'valid' | 'expiring' | 'expired' | 'revoked';

export interface CACertificate {
  id: string;
  certId: string;
  holderName: string;
  holderTitle: string;
  holderIdNumber: string;
  algorithm: SignatureAlgorithm;
  issuer: string;          // CA 颁发机构
  validFrom: string;
  validTo: string;
  status: CertificateStatus;
  serialNumber: string;
  fingerprint: string;      // SHA-256 指纹
  usageCount: number;
  lastUsedAt?: string;
}

export const CA_CERTIFICATES: CACertificate[] = [
  { id: 'cert-001', certId: 'CFCA-RAD-2024-001', holderName: '张明远', holderTitle: '主任医师',
    holderIdNumber: '110101****1234', algorithm: 'RSA-SHA256',
    issuer: '中国金融认证中心（CFCA）', validFrom: '2024-01-15', validTo: '2027-01-14',
    status: 'valid', serialNumber: 'CFCA-SN-20240115-001', fingerprint: 'a4b3c2d1e5f67890123456789abcdef01234567890123456789abcdef012345678',
    usageCount: 1248, lastUsedAt: '2026-06-04 14:00:00' },
  { id: 'cert-002', certId: 'CFCA-RAD-2024-002', holderName: '李慧敏', holderTitle: '副主任医师',
    holderIdNumber: '110101****5678', algorithm: 'RSA-SHA256',
    issuer: '中国金融认证中心（CFCA）', validFrom: '2024-03-20', validTo: '2027-03-19',
    status: 'valid', serialNumber: 'CFCA-SN-20240320-002', fingerprint: 'b5c4d3e2f67890123456789abcdef01234567890123456789abcdef0123456789ab',
    usageCount: 956, lastUsedAt: '2026-06-04 11:30:00' },
  { id: 'cert-003', certId: 'CFCA-RAD-2024-003', holderName: '王建华', holderTitle: '主治医师',
    holderIdNumber: '110101****9012', algorithm: 'RSA-SHA256',
    issuer: '中国金融认证中心（CFCA）', validFrom: '2024-05-10', validTo: '2026-05-09',
    status: 'expired', serialNumber: 'CFCA-SN-20240510-003', fingerprint: 'c6d5e4f3a7890123456789abcdef01234567890123456789abcdef0123456789abc',
    usageCount: 678, lastUsedAt: '2026-05-08 17:00:00' },
  { id: 'cert-004', certId: 'GMCA-RAD-2025-001', holderName: '赵雪琴', holderTitle: '主任医师',
    holderIdNumber: '110101****3456', algorithm: 'SM2-SM3',
    issuer: '国家信息中心（GMCA）', validFrom: '2025-01-20', validTo: '2028-01-19',
    status: 'valid', serialNumber: 'GMCA-SN-20250120-001', fingerprint: 'd7e6f5a4b7890123456789abcdef01234567890123456789abcdef0123456789abcd',
    usageCount: 234, lastUsedAt: '2026-06-04 09:15:00' },
  { id: 'cert-005', certId: 'CFCA-RAD-2024-005', holderName: '刘文博', holderTitle: '副主任医师',
    holderIdNumber: '110101****7890', algorithm: 'RSA-SHA256',
    issuer: '中国金融认证中心（CFCA）', validFrom: '2024-08-15', validTo: '2026-08-14',
    status: 'expiring', serialNumber: 'CFCA-SN-20240815-005', fingerprint: 'e8f7a6b5c7890123456789abcdef01234567890123456789abcdef0123456789abcde',
    usageCount: 432, lastUsedAt: '2026-06-04 13:20:00' },
];

// ============================================================
// 区块链存证
// ============================================================
export interface BlockchainRecord {
  id: string;
  reportId: string;
  reportHash: string;          // SHA-256 of report content
  blockHash: string;            // 区块哈希
  blockNumber: number;
  chainName: string;            // 联盟链名称
  txHash: string;               // 交易哈希
  timestamp: string;
  signers: string[];            // 签名人列表
  status: 'pending' | 'confirmed' | 'invalid';
  confirmations: number;
  merkleRoot: string;           // Merkle 根
  explorerUrl: string;          // 浏览器地址
}

export const BLOCKCHAIN_RECORDS: BlockchainRecord[] = [
  { id: 'bc-001', reportId: 'rpt-038',
    reportHash: '0xa4b3c2d1e5f67890123456789abcdef01234567890123456789abcdef0123456789',
    blockHash: '0x00000000000000a1b2c3d4e5f60718291a2b3c4d5e6f708192a3b4c5d6e7f8091',
    blockNumber: 182345, chainName: '国密联盟链（GMCA）', txHash: '0xtx20260604001abc',
    timestamp: '2026-06-04 14:30:15', signers: ['李慧敏', '王建华'], status: 'confirmed',
    confirmations: 18, merkleRoot: '0xmerkle_root_001', explorerUrl: 'https://chain.gmca.cn/block/182345' },
  { id: 'bc-002', reportId: 'rpt-039',
    reportHash: '0xb5c4d3e2f67890123456789abcdef01234567890123456789abcdef0123456789a',
    blockHash: '0x00000000000000b2c3d4e5f60718291a2b3c4d5e6f708192a3b4c5d6e7f8091a2',
    blockNumber: 182346, chainName: '国密联盟链（GMCA）', txHash: '0xtx20260604002def',
    timestamp: '2026-06-04 15:00:30', signers: ['王建华'], status: 'confirmed',
    confirmations: 17, merkleRoot: '0xmerkle_root_002', explorerUrl: 'https://chain.gmca.cn/block/182346' },
  { id: 'bc-003', reportId: 'rpt-040',
    reportHash: '0xc6d5e4f3a7890123456789abcdef01234567890123456789abcdef0123456789ab',
    blockHash: '0x00000000000000c3d4e5f60718291a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3',
    blockNumber: 182350, chainName: '国密联盟链（GMCA）', txHash: '0xtx20260604003fed',
    timestamp: '2026-06-04 16:00:45', signers: ['陈晓燕'], status: 'confirmed',
    confirmations: 12, merkleRoot: '0xmerkle_root_003', explorerUrl: 'https://chain.gmca.cn/block/182350' },
  { id: 'bc-004', reportId: 'rpt-041',
    reportHash: '0xd7e6f5a4b7890123456789abcdef01234567890123456789abcdef0123456789abc',
    blockHash: '0x00000000000000d4e5f60718291a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4',
    blockNumber: 182355, chainName: '国密联盟链（GMCA）', txHash: '0xtx20260604004aaf',
    timestamp: '2026-06-04 01:30:50', signers: ['张明远'], status: 'confirmed',
    confirmations: 6, merkleRoot: '0xmerkle_root_004', explorerUrl: 'https://chain.gmca.cn/block/182355' },
  { id: 'bc-005', reportId: 'rpt-042',
    reportHash: '0xe8f7a6b5c7890123456789abcdef01234567890123456789abcdef0123456789abcd',
    blockHash: '0x00000000000000e5f60718291a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5',
    blockNumber: 182360, chainName: '国密联盟链（GMCA）', txHash: '0xtx20260604005bcd',
    timestamp: '2026-06-04 18:30:10', signers: ['刘文博', '赵雪琴'], status: 'pending',
    confirmations: 2, merkleRoot: '0xmerkle_root_005', explorerUrl: 'https://chain.gmca.cn/block/182360' },
];

// ============================================================
// 患者门户
// ============================================================
export interface PatientReportAccess {
  id: string;
  reportId: string;
  patientName: string;
  accessToken: string;         // 访问令牌
  qrCodeUrl: string;            // 二维码
  expiresAt: string;            // 过期时间
  viewCount: number;
  downloadCount: number;
  shareCount: number;
  deviceFingerprint: string;     // 设备指纹
  ipHistory: string[];           // IP 历史
  lastAccessAt?: string;
}

export const PATIENT_REPORT_ACCESS: PatientReportAccess[] = [
  { id: 'pa-001', reportId: 'rpt-038', patientName: '袁建华',
    accessToken: 'PT-2026-001-ABCDEF', qrCodeUrl: '/qrcode/rpt-038.png',
    expiresAt: '2026-07-04 14:30:00', viewCount: 5, downloadCount: 2, shareCount: 1,
    deviceFingerprint: 'iPhone-15-Pro-iOS-17.4', ipHistory: ['36.21.xx.xx', '114.81.xx.xx'],
    lastAccessAt: '2026-06-04 15:12:00' },
  { id: 'pa-002', reportId: 'rpt-039', patientName: '余小红',
    accessToken: 'PT-2026-002-123456', qrCodeUrl: '/qrcode/rpt-039.png',
    expiresAt: '2026-07-04 15:00:00', viewCount: 2, downloadCount: 0, shareCount: 0,
    deviceFingerprint: 'HUAWEI-Mate60-HarmonyOS', ipHistory: ['111.34.xx.xx'],
    lastAccessAt: '2026-06-04 17:30:00' },
  { id: 'pa-003', reportId: 'rpt-040', patientName: '邱淑芬',
    accessToken: 'PT-2026-003-789012', qrCodeUrl: '/qrcode/rpt-040.png',
    expiresAt: '2026-07-04 16:00:00', viewCount: 3, downloadCount: 1, shareCount: 0,
    deviceFingerprint: 'Xiaomi-14-Android-14', ipHistory: ['223.71.xx.xx', '117.136.xx.xx'],
    lastAccessAt: '2026-06-04 18:30:00' },
];

// ============================================================
// 推送 / 导出 KPI
// ============================================================
export interface DeliveryKPI {
  totalThisMonth: number;
  successRate: number;
  avgDeliveryTime: number;     // 秒
  readRate: number;
  downloadRate: number;
  channelDistribution: Record<DeliveryChannel, number>;
  topTemplates: Array<{ name: string; count: number }>;
  certificatesActive: number;
  certificatesExpiring: number;
  blockchainConfirmed: number;
}

export const DELIVERY_KPI: DeliveryKPI = {
  totalThisMonth: 156,
  successRate: 95.5,
  avgDeliveryTime: 12,
  readRate: 78.2,
  downloadRate: 42.3,
  channelDistribution: {
    wechat: 65, sms: 32, email: 18, inApp: 12, dicom: 8, paper: 5, cloud: 10, film: 6,
  },
  topTemplates: [
    { name: '标准报告 PDF', count: 78 },
    { name: '简化报告 PDF', count: 45 },
    { name: '患者告知 PDF', count: 22 },
  ],
  certificatesActive: 4,
  certificatesExpiring: 1,
  blockchainConfirmed: 28,
};

export default {
  EXPORT_TEMPLATES,
  DELIVERY_RECORDS,
  CA_CERTIFICATES,
  BLOCKCHAIN_RECORDS,
  PATIENT_REPORT_ACCESS,
  DELIVERY_KPI,
};
