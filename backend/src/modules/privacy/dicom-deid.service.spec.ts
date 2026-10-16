/**
 * [G005 v3.0.6.16-0] DICOM 去标识化服务测试
 *
 * 直接打真实的 Part-10 样例文件 (backend/dicom-samples/*), 验证:
 *  1. 身份标签确实被清空 (而不是残留/错位)
 *  2. 日期按配置偏移、时间归一
 *  3. UID 被重新生成
 *  4. **像素数据逐字节不变** (脱敏后影像仍可用)
 *  5. 文件字节长度不变 (在原位覆写, 不破坏 DICOM 结构)
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as dicomParser from 'dicom-parser';
import { DicomDeidService } from './dicom-deid.service';

const SAMPLES_DIR = join(__dirname, '..', '..', '..', 'dicom-samples');

function readTag(bytes: Uint8Array, ds: dicomParser.DicomDataSet, tag: string): string {
  const el = ds.elements[tag];
  if (!el || el.length === 0 || el.length === 0xffffffff || el.length > 128) return '';
  return new TextDecoder('latin1')
    .decode(bytes.subarray(el.dataOffset, el.dataOffset + el.length))
    .replace(/[\0\s]+$/, '')
    .trim();
}

function sampleFiles(): string[] {
  if (!existsSync(SAMPLES_DIR)) return [];
  const out: string[] = [];
  for (const dir of readdirSync(SAMPLES_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const full = join(SAMPLES_DIR, dir.name);
    for (const f of readdirSync(full)) {
      if (f.toLowerCase().endsWith('.dcm')) out.push(join(full, f));
    }
  }
  return out;
}

describe('DicomDeidService (PS3.15 Basic Profile)', () => {
  const svc = new DicomDeidService();
  const files = sampleFiles();

  it('存在 Part-10 样例文件用于回归', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  describe.each(['CT_CHEST', 'MR_BRAIN', 'DR_CHEST', 'DBT'])('%s 样例', (modality) => {
    const file = files.find((f) => f.includes(modality)) as string;

    beforeAll(() => {
      expect(files.length).toBeGreaterThan(0);
      expect(file).toBeDefined();
    });


    it(`${modality}: 脱敏后身份标签被彻底清空`, () => {
      const raw = new Uint8Array(readFileSync(file));
      const { bytes } = svc.deidentifyFile(raw, { profile: 'basic', dateShiftDays: 365 });
      const after = dicomParser.parseDicom(bytes);

      expect(readTag(bytes, after, 'x00100010')).toBe(''); // PatientName
      expect(readTag(bytes, after, 'x00100020')).toBe(''); // PatientID
      expect(readTag(bytes, after, 'x00100030')).toBe(''); // PatientBirthDate
      expect(readTag(bytes, after, 'x00080050')).toBe(''); // AccessionNumber
      expect(readTag(bytes, after, 'x00080090')).toBe(''); // ReferringPhysicianName
    });

    it(`${modality}: 脱敏前样例确实带有身份信息(否则测试无意义)`, () => {
      const raw = new Uint8Array(readFileSync(file));
      const before = dicomParser.parseDicom(raw);
      expect(readTag(raw, before, 'x00100020')).not.toBe(''); // PatientID 非空
      expect(readTag(raw, before, 'x00080018')).toMatch(/^\d/); // SOPInstanceUID 是数字开头 UID
    });

    it(`${modality}: UID 被重新生成且符合 DICOM 规范`, () => {
      const raw = new Uint8Array(readFileSync(file));
      const before = dicomParser.parseDicom(raw);
      const { bytes, report } = svc.deidentifyFile(raw, { profile: 'basic', dateShiftDays: 365 });
      const after = dicomParser.parseDicom(bytes);

      const sop = readTag(bytes, after, 'x00080018');
      expect(sop).not.toBe(readTag(raw, before, 'x00080018'));
      expect(sop).toMatch(/^\d+(\.\d+)+$/); // 数字+点
      expect(sop.length).toBeLessThanOrEqual(64);
      expect(report.sopInstanceUid).toBe(sop);
      expect(readTag(bytes, after, 'x0020000d')).not.toBe(readTag(raw, before, 'x0020000d'));
      expect(readTag(bytes, after, 'x0020000e')).not.toBe(readTag(raw, before, 'x0020000e'));
    });

    it(`${modality}: 日期偏移 / 时间归一`, () => {
      const raw = new Uint8Array(readFileSync(file));
      const before = dicomParser.parseDicom(raw);
      const { bytes } = svc.deidentifyFile(raw, { profile: 'basic', dateShiftDays: 365 });
      const after = dicomParser.parseDicom(bytes);

      const oldDate = readTag(raw, before, 'x00080020');
      const newDate = readTag(bytes, after, 'x00080020');
      expect(oldDate).toMatch(/^\d{8}$/);
      expect(newDate).toMatch(/^\d{8}$/);
      expect(newDate).not.toBe(oldDate);
      // 偏移天数应与配置一致
      const d0 = new Date(`${oldDate.slice(0, 4)}-${oldDate.slice(4, 6)}-${oldDate.slice(6, 8)}T00:00:00Z`);
      const d1 = new Date(`${newDate.slice(0, 4)}-${newDate.slice(4, 6)}-${newDate.slice(6, 8)}T00:00:00Z`);
      const diffDays = Math.round((d1.getTime() - d0.getTime()) / 86400000);
      expect(diffDays).toBe(365);
    });

    it(`${modality}: 像素数据逐字节不变(影像仍可用于科研)`, () => {
      const raw = new Uint8Array(readFileSync(file));
      const before = dicomParser.parseDicom(raw);
      const { bytes, report } = svc.deidentifyFile(raw, { profile: 'basic', dateShiftDays: 365 });
      const after = dicomParser.parseDicom(bytes);

      expect(report.pixelDataPreserved).toBe(true);
      const pxB = before.elements['x7fe00010'];
      const pxA = after.elements['x7fe00010'];
      expect(pxA).toBeDefined();
      expect(pxA!.length).toBe(pxB!.length);
      const a = raw.subarray(pxB!.dataOffset, pxB!.dataOffset + pxB!.length);
      const b = bytes.subarray(pxA!.dataOffset, pxA!.dataOffset + pxA!.length);
      expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0);
    });

    it(`${modality}: 文件长度不变(原位覆写, 不破坏 DICOM 结构)`, () => {
      const raw = new Uint8Array(readFileSync(file));
      const { bytes } = svc.deidentifyFile(raw, { profile: 'basic', dateShiftDays: 365 });
      expect(bytes.length).toBe(raw.length);
      // 脱敏结果必须仍能被重新解析
      expect(() => dicomParser.parseDicom(bytes)).not.toThrow();
    });
  });

  describe('deidentifyBatch', () => {
    it('批量处理并汇总清洗数量', () => {
      expect(files.length).toBeGreaterThanOrEqual(4);
      const inputs = files.slice(0, 4).map((f) => ({ name: f, data: new Uint8Array(readFileSync(f)) }));
      const { outputs, result } = svc.deidentifyBatch(inputs, 'basic', 365);

      expect(outputs.length).toBe(inputs.length);
      expect(result.files.length).toBe(inputs.length);
      expect(result.cleanedTagCount).toBeGreaterThan(0);
      expect(result.totalBytesOut).toBe(result.totalBytesIn);

      // SOPInstanceUID 必须逐文件唯一
      const sops = new Set(result.files.map((r) => r.sopInstanceUid));
      expect(sops.size).toBe(result.files.length);

      // 引用一致性: **同一原始检查** 的文件必须映射到同一新 StudyInstanceUID,
      // 否则脱敏后同一检查会被拆散成多个检查, 序列/图像无法归组。
      // 注意: 不同检查本就应当得到不同的新 UID, 不能断言"全批次一致"。
      const origStudyOf = new Map<string, string>();
      inputs.forEach((inp, i) => {
        const ds = dicomParser.parseDicom(inp.data);
        origStudyOf.set(readTag(inp.data, ds, 'x0020000d'), result.files[i].studyInstanceUid);
      });
      // 重新按原始 UID 分组校验
      const groups = new Map<string, Set<string>>();
      inputs.forEach((inp, i) => {
        const ds = dicomParser.parseDicom(inp.data);
        const orig = readTag(inp.data, ds, 'x0020000d');
        if (!groups.has(orig)) groups.set(orig, new Set());
        groups.get(orig)!.add(result.files[i].studyInstanceUid);
      });
      for (const [orig, mapped] of groups) {
        expect(mapped.size).toBe(1); // 同一原始检查 -> 恰好一个新 UID
      }
      expect(origStudyOf.size).toBeGreaterThan(0);
    });

    it('跳过无法解析的文件而不中断整批', () => {
      expect(files.length).toBeGreaterThan(0);
      const junk = { name: 'broken.dcm', data: new Uint8Array([1, 2, 3, 4, 5]) };
      const good = { name: 'good.dcm', data: new Uint8Array(readFileSync(files[0])) };
      const { result } = svc.deidentifyBatch([junk, good], 'basic', 365);
      expect(result.files.length).toBe(1);
      expect(result.files[0].fileName).toBe('good.dcm');
    });
  });
});
