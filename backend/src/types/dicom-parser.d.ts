/**
 * `dicom-parser` (v1.8.x) 未随包提供类型定义, 也没有官方 @types。
 * 这里声明本项目实际使用到的最小 API 面。
 *
 * 命名注意: 刻意避开 `DataSet` / `DataElement` —— 二者与 TypeScript 内置的
 * DOM 全局类型同名, 会在 `import * as dicomParser` 后产生解析歧义。
 */
declare module 'dicom-parser' {
  export interface DicomDataElement {
    tag: string;
    vr: string;
    length: number;
    dataOffset: number;
    dataOffsetEnd?: number;
    description?: string;
    pixelDataElement?: { [key: string]: unknown };
    [key: string]: unknown;
  }

  export interface DicomDataSet {
    elements: { [tag: string]: DicomDataElement };
    string(tag: string, index?: number): string | undefined;
    sequences?: { [tag: string]: unknown[] };
    meta?: Record<string, unknown>;
    [key: string]: unknown;
  }

  /** 解析 Part-10 DICOM 字节流 */
  export function parseDicom(byteArray: Uint8Array | ArrayBuffer): DicomDataSet;

  export function isStringVr(vr: string): boolean;
  export function isPrivateTag(tag: string): boolean;
  export function parsePN(str: string): unknown;
  export function parseTM(str: string): unknown;
  export function parseDA(str: string): unknown;
  export function explicitElementToString(el: DicomDataElement): string;
  export function explicitDataSetToJS(dataSet: DicomDataSet): unknown;
  export function createJPEGBasicOffsetTable(fragments: Uint8Array[]): Uint8Array;
  export function readEncapsulatedImageFrame(
    pixelDataElement: DicomDataElement,
    pixelData: Uint8Array,
    frameIndex: number,
    info: { fragmentSize?: number; itemsPerFragment?: number; basicOffsetTable?: Uint8Array; length?: number },
  ): { pixelData: Uint8Array } | null;
  export function encapsulatedPixelData(
    pixelDataElement: DicomDataElement,
    pixelData: Uint8Array,
    info: { fragmentSize?: number; itemsPerFragment?: number; basicOffsetTable?: Uint8Array; length?: number },
  ): Uint8Array[];
}
