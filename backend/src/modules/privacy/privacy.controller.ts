import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { DicomDeidService, type DeidProfile } from './dicom-deid.service';

/**
 * [G005 v3.0.6.16-0] 隐私 / DICOM 去标识化端点
 *
 * 说明: 前端「研究/科研 - DICOM 脱敏」此前是前端 setTimeout 伪造(1.5s 后弹
 * "脱敏完成(本地模拟)")。本控制器提供真实的 PS3.15 去标识化能力。
 *
 * 边界说明(避免过度承诺):
 *  - 采用 **Basic Application Level Confidentiality Profile**;
 *  - 不支持 Clean Pixel Data / Clean Structured Content / Clean Descriptors,
 *    因此**不宣称** HIPAA "专家判定" 等级; `profile=expert` 仅表示"在此基础上
 *    额外清空描述性字段", 临床使用前仍建议人工复核。
 */
@Controller('privacy')
export class PrivacyController {
  constructor(private readonly deid: DicomDeidService) {}

  /** 脱敏配置能力说明 (前端据此渲染可选项与免责声明) */
  @Get('de-identify/profile')
  getProfile() {
    return {
      success: true,
      data: {
        standard: 'DICOM PS3.15 Annex E - Basic Application Level Confidentiality Profile',
        profiles: [
          {
            id: 'basic',
            label: '基础配置文件',
            description: '清空身份标签 / 重生成 UID / 日期偏移 / 时间归一; 保留影像描述字段',
          },
          {
            id: 'hipaa',
            label: 'HIPAA 安全港',
            description: '在基础之上额外清空检查/序列描述, 不保留任何可能含姓名的自由文本',
          },
          {
            id: 'expert',
            label: '专家判定(保守)',
            description: '额外清空协议名/治疗设备名等, 临床可用性下降, 需人工复核',
          },
        ],
        guarantees: [
          '像素数据 (PixelData) 逐字节不变, 脱敏后影像仍可用于阅片与科研统计',
          '文件在原位覆写, 字节长度不变, DICOM 结构不被破坏',
          '批次内同一检查的序列/图像共享同一新 StudyInstanceUID/SeriesInstanceUID',
          'SOPInstanceUID 逐文件唯一',
        ],
        limitations: [
          '不支持 Clean Pixel Data(烧录在像素里的文字需另行处理)',
          '不支持 Clean Structured Content / Clean Descriptors',
          '私标签 (奇数组号) 不在基础配置范围内, 建议导出前人工抽查',
        ],
        defaultDateShiftDays: DicomDeidService.DEFAULT_DATE_SHIFT_DAYS,
      },
    };
  }

  /**
   * 对一批 DICOM 执行去标识化。
   *
   * 请求体: `{ profile, dateShiftDays?, files: [{ name, dataBase64 }] }`
   * 响应体: `{ result, files: [{ name, dataBase64 }] }`
   *
   * 采用 JSON + base64 而非 multipart, 以便前端在浏览器内直接把已选中的
   * File 读成 ArrayBuffer 上传, 无需额外引入上传组件。
   */
  @Post('de-identify')
  run(@Body() body: {
    profile?: DeidProfile;
    dateShiftDays?: number;
    files?: Array<{ name?: string; dataBase64?: string }>;
  }) {
    const files = body?.files ?? [];
    if (files.length === 0) {
      throw new HttpException('未提供待脱敏文件', HttpStatus.BAD_REQUEST);
    }
    if (files.length > 200) {
      throw new HttpException('单次最多脱敏 200 个文件, 请分批提交', HttpStatus.BAD_REQUEST);
    }

    const profile: DeidProfile = body.profile ?? 'basic';
    if (!['basic', 'hipaa', 'expert'].includes(profile)) {
      throw new HttpException(`不支持的脱敏配置: ${profile}`, HttpStatus.BAD_REQUEST);
    }

    let decoded: Array<{ name: string; data: Uint8Array }>;
    try {
      decoded = files.map((f, i) => ({
        name: f.name ?? `instance-${i + 1}.dcm`,
        data: new Uint8Array(Buffer.from(f.dataBase64 ?? '', 'base64')),
      }));
    } catch {
      throw new HttpException('文件内容无法解析(base64 非法)', HttpStatus.BAD_REQUEST);
    }

    const empty = decoded.find((f) => f.data.length === 0);
    if (empty) {
      throw new HttpException(`文件 ${empty.name} 内容为空`, HttpStatus.BAD_REQUEST);
    }

    const shift = Number.isFinite(body.dateShiftDays)
      ? Math.trunc(Number(body.dateShiftDays))
      : DicomDeidService.DEFAULT_DATE_SHIFT_DAYS;

    const { outputs, result } = this.deid.deidentifyBatch(decoded, profile, shift);

    if (outputs.length === 0) {
      throw new HttpException('全部文件解析失败, 请确认是否为 DICOM Part-10 文件', HttpStatus.BAD_REQUEST);
    }

    return {
      success: true,
      data: {
        result,
        files: outputs.map((o) => ({
          name: o.name,
          dataBase64: Buffer.from(o.bytes).toString('base64'),
        })),
      },
    };
  }
}
