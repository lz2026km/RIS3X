/**
 * G005 放射RIS系统 v3.0.6.0 - PowerPoint (.pptx) 导出
 * Phase R7:实现符合 OOXML 规范的 PPTX 文件(含图像嵌入)
 *
 * 设计:
 * - PPTX 是 ZIP + Open XML 文档
 * - 本模块自带极简的 ZIP 写入器(避免依赖第三方)
 * - 每个幻灯片为独立的 .xml 文件,通过 [Content_Types].xml 与 _rels 注册
 */
import type { PptxExportOptions, PptxSlide, ExportResult } from '../../types/export';

const MIME_PNG = 'image/png';
const MIME_JPEG = 'image/jpeg';

interface PptxEntry {
  name: string;
  data: Uint8Array;
}

export class PptxExporter {
  async export(options: PptxExportOptions): Promise<ExportResult> {
    if (!options.slides?.length) {
      return { success: false, error: 'No slides provided' };
    }
    try {
      const files = this.buildPptx(options);
      const zip = this.buildZip(files);
      const blob = new Blob([zip], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      const safeName = options.title.replace(/[^\w\u4e00-\u9fa5_-]+/g, '_');
      return { success: true, blob, fileName: `${safeName}.pptx` };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private buildPptx(opts: PptxExportOptions): PptxEntry[] {
    const files: PptxEntry[] = [];
    const now = new Date().toISOString();
    const themeColor = opts.themeColor ?? '1E40AF';

    files.push({ name: '[Content_Types].xml', data: text(this.contentTypes(opts.slides.length)) });
    files.push({ name: '_rels/.rels', data: text(this.rootRels()) });
    files.push({ name: 'ppt/presentation.xml', data: text(this.presentationXml(opts, opts.slides.length)) });
    files.push({ name: 'ppt/_rels/presentation.xml.rels', data: text(this.presentationRels()) });
    files.push({ name: 'ppt/theme/theme1.xml', data: text(this.themeXml(themeColor)) });

    opts.slides.forEach((slide: any, i: any) => {
      const slideNo = i + 1;
      const imageEmbeddings: string[] = [];
      const mediaFiles: PptxEntry[] = [];

      if (slide.imageDataUrl) {
        const decoded = decodeDataUrl(slide.imageDataUrl);
        if (decoded) {
          const ext = decoded.mime === MIME_PNG ? 'png' : 'jpg';
          const imageId = slideNo;
          const relId = `rId${imageId + 100}`;
          imageEmbeddings.push(this.imageRel(relId, `../media/image${imageId}.${ext}`));
          mediaFiles.push({ name: `ppt/media/image${imageId}.${ext}`, data: decoded.bytes });
        }
      }

      files.push({
        name: `ppt/slides/slide${slideNo}.xml`,
        data: text(this.slideXml(slide, slideNo, imageEmbeddings.length > 0)),
      });
      files.push({
        name: `ppt/slides/_rels/slide${slideNo}.xml.rels`,
        data: text(this.slideRels(slideNo, imageEmbeddings)),
      });
      mediaFiles.forEach(m => files.push(m));
    });

    files.push({ name: 'docProps/core.xml', data: text(this.coreXml(opts, now)) });
    files.push({ name: 'docProps/app.xml', data: text(this.appXml(opts)) });

    return files;
  }

  private contentTypes(slideCount: number): string {
    const overrides: string[] = [];
    for (let i = 1; i <= slideCount; i++) {
      overrides.push(`<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml" />`);
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
<Default Extension="xml" ContentType="application/xml" />
<Default Extension="png" ContentType="image/png" />
<Default Extension="jpeg" ContentType="image/jpeg" />
<Default Extension="jpg" ContentType="image/jpeg" />
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml" />
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml" />
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml" />
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml" />
${overrides.join('\n')}
</Types>`;
  }

  private rootRels(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml" />
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml" />
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml" />
</Relationships>`;
  }

  private presentationXml(opts: PptxExportOptions, slideCount: number): string {
    const slideList = Array.from({ length: slideCount }, (_, i) =>
      `<p:sldId id="${256 + i}" r:id="rId${i + 1}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" />`,
    ).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>
<p:sldIdLst>${slideList}</p:sldIdLst>
<p:sldSz cx="9144000" cy="6858000" type="screen4x3" />
<p:notesSz cx="6858000" cy="9144000" />
<${'p:defaultTextStyle'}><a:bodyPr/><a:lstStyle/></${'p:defaultTextStyle'}>
</p:presentation>`;
  }

  private presentationRels(): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml" />
<Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml" />
${Array.from({ length: 100 }, (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml" />`).join('\n')}
</Relationships>`;
  }

  private themeXml(primary: string): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="G005 RIS">
<a:themeElements>
<a:clrScheme name="G005"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="${primary}"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2><a:accent1><a:srgbClr val="${primary}"/></a:accent1><a:accent2><a:srgbClr val="DC2626"/></a:accent2><a:accent3><a:srgbClr val="10B981"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="7C3AED"/></a:accent5><a:accent6><a:srgbClr val="0891B2"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme>
<a:fontScheme name="G005"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="G005"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln/><a:ln/><a:ln/></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
</a:themeElements>
</a:theme>`;
  }

  private slideXml(slide: PptxSlide, slideNo: number, hasImage: boolean): string {
    const layout = slide.layout ?? 'content';
    const titleSp = `<p:sp><p:nvSpPr><p:cNvPr id="1" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="274680"/><a:ext cx="8229240" cy="800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN" sz="3200" b="1"/><a:t>${escapeXml(slide.title)}</a:t></a:r></a:p></p:txBody></p:sp>`;

    let bodySp = '';
    if (layout === 'title') {
      bodySp = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Subtitle"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1500000"/><a:ext cx="8229240" cy="800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN" sz="2000"/><a:t>${escapeXml(slide.subtitle ?? '')}</a:t></a:r></a:p></p:txBody></p:sp>`;
    } else if (layout === 'image-full' && hasImage) {
      bodySp = `<p:pic><p:nvPicPr><p:cNvPr id="100" name="Image"/><p:cNvPicPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId200" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="457200" y="1200000"/><a:ext cx="8229240" cy="5000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
    } else if (layout === 'two-column' && hasImage) {
      bodySp = `<p:pic><p:nvPicPr><p:cNvPr id="100" name="Image"/><p:cNvPicPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId200" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="457200" y="1200000"/><a:ext cx="3500000" cy="4000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="4200000" y="1200000"/><a:ext cx="4500000" cy="4000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN" sz="1600"/><a:t>${escapeXml(slide.body ?? '')}</a:t></a:r></a:p></p:txBody></p:sp>`;
    } else {
      bodySp = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="457200" y="1200000"/><a:ext cx="8229240" cy="5000000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-CN" sz="1800"/><a:t>${escapeXml(slide.body ?? '')}</a:t></a:r></a:p></p:txBody></p:sp>`;
    }

    void slideNo;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="0" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${titleSp}
${bodySp}
</p:spTree></p:cSld>
</p:sld>`;
  }

  private slideRels(slideNo: number, imageEmbeds: string[]): string {
    void slideNo;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml" />
${imageEmbeds.join('\n')}
</Relationships>`;
  }

  private imageRel(relId: string, target: string): string {
    return `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}" />`;
  }

  private coreXml(opts: PptxExportOptions, now: string): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${escapeXml(opts.title)}</dc:title>
<dc:creator>${escapeXml(opts.author ?? 'G005 RIS')}</dc:creator>
<cp:lastModifiedBy>${escapeXml(opts.author ?? 'G005 RIS')}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
  }

  private appXml(opts: PptxExportOptions): string {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>G005 RIS</Application>
<Company>${escapeXml(opts.company ?? 'G005 Hospital')}</Company>
<Slides>${opts.slides.length}</Slides>
</Properties>`;
  }

  // ---- Minimal ZIP encoder (STORED, no compression) ----
  private buildZip(entries: PptxEntry[]): Uint8Array {
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;

    const enc = new TextEncoder();
    const crcTable = makeCrcTable();

    for (const entry of entries) {
      const nameBytes = enc.encode(entry.name);
      const data = entry.data;
      const crc = crc32(data, crcTable);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(localHeader.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, 0, true);
      dv.setUint16(12, 0, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);
      localHeader.set(nameBytes, 30);
      localParts.push(localHeader, data);

      const central = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(central.buffer);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, 0, true);
      cdv.setUint16(14, 0, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, data.length, true);
      cdv.setUint32(24, data.length, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);

      offset += localHeader.length + data.length;
    }

    const central = concat(centralParts);
    const local = concat(localParts);
    const end = new Uint8Array(22);
    const edv = new DataView(end.buffer);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(8, entries.length, true);
    edv.setUint16(10, entries.length, true);
    edv.setUint32(12, central.length, true);
    edv.setUint32(16, local.length, true);

    return concat([local, central, end]);
  }
}

function text(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function makeCrcTable(): Uint32Array {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c >>> 0;
  }
  return t;
}

function crc32(data: Uint8Array, table: Uint32Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    c = table[(c ^ data[i]!) & 0xFF]! ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

interface DecodedDataUrl {
  mime: string;
  bytes: Uint8Array;
}

function decodeDataUrl(url: string): DecodedDataUrl | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(url);
  if (!m) return null;
  const mime = m[1]!;
  const b64 = m[2]!;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}

let singleton: PptxExporter | null = null;
export function getPptxExporter(): PptxExporter {
  if (!singleton) singleton = new PptxExporter();
  return singleton;
}