/* eslint-disable */
const fs = require('fs')
const path = require('path')
const { parseDicomPart10, rleEncode, rleDecode, predictiveEncode, predictiveDecode } = require('../src/modules/dicom-compress/dicom-codec')

const root = path.resolve(__dirname, '../dicom-samples')
const files = [
  'CT_CHEST/CT_CHEST_001.dcm',
  'CT_HEAD/CT_HEAD_001.dcm',
  'MR_BRAIN/MR_BRAIN_001.dcm',
  'DR_CHEST/DR_CHEST_001.dcm',
]

for (const rel of files) {
  const buf = fs.readFileSync(path.join(root, rel))
  const parsed = parseDicomPart10(buf)
  const px = parsed.pixelData
  const rle = rleEncode(px, parsed.bitsAllocated)
  const dec = rleDecode(rle, px.length)
  const rleOk = dec.equals(px)
  const pred = predictiveEncode(px, { bitsAllocated: parsed.bitsAllocated, pixelRepresentation: parsed.pixelRepresentation, quality: 100 })
  const decP = predictiveDecode(pred, { bitsAllocated: parsed.bitsAllocated, pixelRepresentation: parsed.pixelRepresentation, quality: 100, pixelCount: px.length / 2 })
  const predOk = decP.equals(px)
  const predL = predictiveEncode(px, { bitsAllocated: parsed.bitsAllocated, pixelRepresentation: parsed.pixelRepresentation, quality: 80 })
  const decL = predictiveDecode(predL, { bitsAllocated: parsed.bitsAllocated, pixelRepresentation: parsed.pixelRepresentation, quality: 80, pixelCount: px.length / 2 })
  let diff = 0, maxD = 0
  for (let i = 0; i < px.length; i += 2) { const d = Math.abs(decL.readUInt16LE(i) - px.readUInt16LE(i)); diff += d; if (d > maxD) maxD = d }
  console.log(
    `${rel.padEnd(28)} ${parsed.modality.padEnd(3)} ${parsed.rows}x${parsed.columns} px=${(px.length/1024).toFixed(0)}KB ` +
    `RLE=${(rle.length/1024).toFixed(1)}KB(${rleOk?'OK':'FAIL'}) x${(px.length/rle.length).toFixed(2)} ` +
    `PRED100=${(pred.length/1024).toFixed(1)}KB(${predOk?'OK':'FAIL'}) x${(px.length/pred.length).toFixed(2)} ` +
    `PRED80=${(predL.length/1024).toFixed(1)}KB x${(px.length/predL.length).toFixed(2)} meanErr=${(diff/(px.length/2)).toFixed(2)} maxErr=${maxD}`
  )
}

const g = Buffer.alloc(512 * 512 * 2)
for (let i = 0; i < 512 * 512; i++) { const v = (i % 4096); g.writeUInt16LE(v, i * 2) }
const r1 = predictiveEncode(g, { bitsAllocated: 16, pixelRepresentation: 0, quality: 100 })
const r2 = predictiveEncode(g, { bitsAllocated: 16, pixelRepresentation: 0, quality: 100 })
console.log('determinism:', r1.equals(r2), 'rand-free')
const flat = Buffer.alloc(262144, 0xab)
const rf = predictiveEncode(flat, { bitsAllocated: 16, pixelRepresentation: 0, quality: 100 })
console.log('flat16 ratio:', (flat.length / rf.length).toFixed(1), 'rle16 ratio:', (flat.length / rleEncode(flat, 16).length).toFixed(1))
