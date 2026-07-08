// Module 7.8: Orthopedic Structured Reports (35 points)
// Structured reporting templates for orthopedic & MSK imaging

export type OrthoBodyRegion = 'spine' | 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle' | 'foot' | 'long-bone' | 'pelvis'

export type OrthoModality = 'MR' | 'CT' | 'DR' | 'US' | 'DXA'

export type OrthoTemplateType = 'fracture' | 'osteoarthritis' | 'tumor' | 'sports-injury' | 'spine-degenerative' | 'bmd' | 'infection' | 'post-op' | 'general'

export interface OrthoStructuredField {
  key: string
  labelKey: string
  type: 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'group'
  required?: boolean
  options?: Array<{ value: string; labelKey: string }>
  defaultValue?: string | number | boolean
  children?: OrthoStructuredField[]
  unit?: string
  min?: number
  max?: number
}

export interface OrthoAnatomyMapping {
  region: OrthoBodyRegion
  modality: OrthoModality
  laterality: 'left' | 'right' | 'bilateral' | 'unpaired' | 'unilateral'
  segments: string[]
}

export interface OrthoStructuredReportTemplate {
  id: string
  nameKey: string
  descriptionKey: string
  type: OrthoTemplateType
  region: OrthoBodyRegion
  modality: OrthoModality
  anatomy: OrthoAnatomyMapping
  fields: OrthoStructuredField[]
  version: string
  radsCategory?: string
  measurementTools: string[]
}

export interface OrthoReportData {
  templateId: string
  values: Record<string, string | number | boolean | Record<string, unknown>>
  attachments?: string[]
}

export interface RenderedOrthoReport {
  templateId: string
  title: string
  sections: OrthoReportSection[]
  impression: string
  recommendation: string
}

export interface OrthoReportSection {
  heading: string
  content: string
  fields: Array<{ key: string; label: string; value: string }>
}

const ORTHO_TEMPLATES: OrthoStructuredReportTemplate[] = [
  {
    id: 'ortho-knee-oa',
    nameKey: 'template.ortho.kneeOA.name',
    descriptionKey: 'template.ortho.kneeOA.desc',
    type: 'osteoarthritis', region: 'knee', modality: 'MR',
    anatomy: { region: 'knee', modality: 'MR', laterality: 'bilateral', segments: ['medial-compartment', 'lateral-compartment', 'patellofemoral', 'femur', 'tibia'] },
    fields: [
      { key: 'laterality', labelKey: 'ortho.field.laterality', type: 'select', required: true, options: [{ value: 'left', labelKey: 'ortho.left' }, { value: 'right', labelKey: 'ortho.right' }, { value: 'bilateral', labelKey: 'ortho.bilateral' }] },
      { key: 'klGrade', labelKey: 'ortho.field.klGrade', type: 'select', required: true, options: [{ value: '0', labelKey: 'ortho.kl.0' }, { value: '1', labelKey: 'ortho.kl.1' }, { value: '2', labelKey: 'ortho.kl.2' }, { value: '3', labelKey: 'ortho.kl.3' }, { value: '4', labelKey: 'ortho.kl.4' }] },
      { key: 'jointSpaceWidth', labelKey: 'ortho.field.jointSpaceWidth', type: 'number', unit: 'mm', min: 0, max: 10 },
      { key: 'osteophytes', labelKey: 'ortho.field.osteophytes', type: 'boolean' },
      { key: 'subchondralSclerosis', labelKey: 'ortho.field.subchondralSclerosis', type: 'boolean' },
      { key: 'effusion', labelKey: 'ortho.field.effusion', type: 'select', options: [{ value: 'none', labelKey: 'ortho.effusion.none' }, { value: 'mild', labelKey: 'ortho.effusion.mild' }, { value: 'moderate', labelKey: 'ortho.effusion.moderate' }, { value: 'large', labelKey: 'ortho.effusion.large' }] },
      { key: 'meniscusMedial', labelKey: 'ortho.field.meniscusMedial', type: 'select', options: [{ value: 'normal', labelKey: 'ortho.meniscus.normal' }, { value: 'grade1', labelKey: 'ortho.meniscus.grade1' }, { value: 'grade2', labelKey: 'ortho.meniscus.grade2' }, { value: 'grade3', labelKey: 'ortho.meniscus.grade3' }] },
      { key: 'meniscusLateral', labelKey: 'ortho.field.meniscusLateral', type: 'select', options: [{ value: 'normal', labelKey: 'ortho.meniscus.normal' }, { value: 'grade1', labelKey: 'ortho.meniscus.grade1' }, { value: 'grade2', labelKey: 'ortho.meniscus.grade2' }, { value: 'grade3', labelKey: 'ortho.meniscus.grade3' }] },
      { key: 'cartilageAssessment', labelKey: 'ortho.field.cartilageAssessment', type: 'group', children: [
        { key: 'medialFemoralCondyle', labelKey: 'ortho.cartilage.medialFemoralCondyle', type: 'select', options: [{ value: 'icrs0', labelKey: 'ICRS 0' }, { value: 'icrs1', labelKey: 'ICRS 1' }, { value: 'icrs2', labelKey: 'ICRS 2' }, { value: 'icrs3', labelKey: 'ICRS 3' }, { value: 'icrs4', labelKey: 'ICRS 4' }] },
        { key: 'medialTibialPlateau', labelKey: 'ortho.cartilage.medialTibialPlateau', type: 'select', options: [{ value: 'icrs0', labelKey: 'ICRS 0' }, { value: 'icrs1', labelKey: 'ICRS 1' }, { value: 'icrs2', labelKey: 'ICRS 2' }, { value: 'icrs3', labelKey: 'ICRS 3' }, { value: 'icrs4', labelKey: 'ICRS 4' }] },
      ]},
      { key: 'acl', labelKey: 'ortho.field.acl', type: 'select', options: [{ value: 'intact', labelKey: 'ortho.acl.intact' }, { value: 'partial-tear', labelKey: 'ortho.acl.partialTear' }, { value: 'complete-tear', labelKey: 'ortho.acl.completeTear' }] },
      { key: 'pcl', labelKey: 'ortho.field.pcl', type: 'select', options: [{ value: 'intact', labelKey: 'ortho.acl.intact' }, { value: 'partial-tear', labelKey: 'ortho.acl.partialTear' }, { value: 'complete-tear', labelKey: 'ortho.acl.completeTear' }] },
      { key: 'impression', labelKey: 'ortho.field.impression', type: 'textarea', required: true },
      { key: 'recommendation', labelKey: 'ortho.field.recommendation', type: 'textarea' },
    ],
    version: '1.0', measurementTools: ['measureJointSpaceWidth', 'assessMeniscus'],
  },
  {
    id: 'ortho-spine-degenerative',
    nameKey: 'template.ortho.spineDeg.name',
    descriptionKey: 'template.ortho.spineDeg.desc',
    type: 'spine-degenerative', region: 'spine', modality: 'MR',
    anatomy: { region: 'spine', modality: 'MR', laterality: 'unpaired', segments: ['cervical', 'thoracic', 'lumbar', 'sacral'] },
    fields: [
      { key: 'region', labelKey: 'ortho.field.region', type: 'select', required: true, options: [{ value: 'cervical', labelKey: 'ortho.region.cervical' }, { value: 'thoracic', labelKey: 'ortho.region.thoracic' }, { value: 'lumbar', labelKey: 'ortho.region.lumbar' }, { value: 'full-spine', labelKey: 'ortho.region.fullSpine' }] },
      { key: 'alignment', labelKey: 'ortho.field.alignment', type: 'select', options: [{ value: 'normal', labelKey: 'ortho.alignment.normal' }, { value: 'lordosis-loss', labelKey: 'ortho.alignment.lordosisLoss' }, { value: 'kyphosis', labelKey: 'ortho.alignment.kyphosis' }, { value: 'scoliosis', labelKey: 'ortho.alignment.scoliosis' }] },
      { key: 'discLevels', labelKey: 'ortho.field.discLevels', type: 'group', children: [
        { key: 'discLevel', labelKey: 'ortho.field.discLevel', type: 'text', required: true },
        { key: 'pfirrmann', labelKey: 'ortho.field.pfirrmann', type: 'select', options: [{ value: '1', labelKey: 'I' }, { value: '2', labelKey: 'II' }, { value: '3', labelKey: 'III' }, { value: '4', labelKey: 'IV' }, { value: '5', labelKey: 'V' }] },
        { key: 'herniation', labelKey: 'ortho.field.herniation', type: 'select', options: [{ value: 'none', labelKey: 'ortho.herniation.none' }, { value: 'bulging', labelKey: 'ortho.herniation.bulging' }, { value: 'protrusion', labelKey: 'ortho.herniation.protrusion' }, { value: 'extrusion', labelKey: 'ortho.herniation.extrusion' }, { value: 'sequestration', labelKey: 'ortho.herniation.sequestration' }] },
        { key: 'canalDiameter', labelKey: 'ortho.field.canalDiameter', type: 'number', unit: 'mm' },
        { key: 'foraminalStenosis', labelKey: 'ortho.field.foraminalStenosis', type: 'select', options: [{ value: 'none', labelKey: 'ortho.stenosis.none' }, { value: 'mild', labelKey: 'ortho.stenosis.mild' }, { value: 'moderate', labelKey: 'ortho.stenosis.moderate' }, { value: 'severe', labelKey: 'ortho.stenosis.severe' }] },
        { key: 'modic', labelKey: 'ortho.field.modic', type: 'select', options: [{ value: '0', labelKey: '0' }, { value: '1', labelKey: '1' }, { value: '2', labelKey: '2' }, { value: '3', labelKey: '3' }] },
      ]},
      { key: 'impression', labelKey: 'ortho.field.impression', type: 'textarea', required: true },
      { key: 'recommendation', labelKey: 'ortho.field.recommendation', type: 'textarea' },
    ],
    version: '1.0', measurementTools: ['measureCobbAngle', 'assessDisc'],
  },
  {
    id: 'ortho-shoulder-sports',
    nameKey: 'template.ortho.shoulderSports.name',
    descriptionKey: 'template.ortho.shoulderSports.desc',
    type: 'sports-injury', region: 'shoulder', modality: 'MR',
    anatomy: { region: 'shoulder', modality: 'MR', laterality: 'unilateral', segments: ['glenohumeral', 'acromioclavicular', 'rotator-cuff', 'labrum'] },
    fields: [
      { key: 'laterality', labelKey: 'ortho.field.laterality', type: 'select', required: true, options: [{ value: 'left', labelKey: 'ortho.left' }, { value: 'right', labelKey: 'ortho.right' }] },
      { key: 'supraspinatus', labelKey: 'ortho.field.supraspinatus', type: 'select', options: [{ value: 'intact', labelKey: 'ortho.cuff.intact' }, { value: 'tendinosis', labelKey: 'ortho.cuff.tendinosis' }, { value: 'partial-tear', labelKey: 'ortho.cuff.partialTear' }, { value: 'full-tear', labelKey: 'ortho.cuff.fullTear' }] },
      { key: 'infraspinatus', labelKey: 'ortho.field.infraspinatus', type: 'select', options: [{ value: 'intact', labelKey: 'ortho.cuff.intact' }, { value: 'tendinosis', labelKey: 'ortho.cuff.tendinosis' }, { value: 'partial-tear', labelKey: 'ortho.cuff.partialTear' }, { value: 'full-tear', labelKey: 'ortho.cuff.fullTear' }] },
      { key: 'subscapularis', labelKey: 'ortho.field.subscapularis', type: 'select', options: [{ value: 'intact', labelKey: 'ortho.cuff.intact' }, { value: 'tendinosis', labelKey: 'ortho.cuff.tendinosis' }, { value: 'partial-tear', labelKey: 'ortho.cuff.partialTear' }, { value: 'full-tear', labelKey: 'ortho.cuff.fullTear' }] },
      { key: 'labrum', labelKey: 'ortho.field.labrum', type: 'select', options: [{ value: 'normal', labelKey: 'ortho.labrum.normal' }, { value: 'slap', labelKey: 'ortho.labrum.slap' }, { value: 'bankart', labelKey: 'ortho.labrum.bankart' }, { value: 'degenerative', labelKey: 'ortho.labrum.degenerative' }] },
      { key: 'tendonRetraction', labelKey: 'ortho.field.tendonRetraction', type: 'number', unit: 'mm' },
      { key: 'fattyInfiltration', labelKey: 'ortho.field.fattyInfiltration', type: 'select', options: [{ value: '0', labelKey: 'Goutallier 0' }, { value: '1', labelKey: 'Goutallier 1' }, { value: '2', labelKey: 'Goutallier 2' }, { value: '3', labelKey: 'Goutallier 3' }, { value: '4', labelKey: 'Goutallier 4' }] },
      { key: 'impression', labelKey: 'ortho.field.impression', type: 'textarea', required: true },
      { key: 'recommendation', labelKey: 'ortho.field.recommendation', type: 'textarea' },
    ],
    version: '1.0', measurementTools: ['assessRotatorCuff'],
  },
  {
    id: 'ortho-hip-bmd',
    nameKey: 'template.ortho.hipBMD.name',
    descriptionKey: 'template.ortho.hipBMD.desc',
    type: 'bmd', region: 'hip', modality: 'DXA',
    anatomy: { region: 'hip', modality: 'DXA', laterality: 'bilateral', segments: ['femoral-neck', 'total-hip', 'trochanter'] },
    fields: [
      { key: 'femoralNeckBMD', labelKey: 'ortho.field.femoralNeckBMD', type: 'number', unit: 'g/cm²', min: 0.2, max: 1.5 },
      { key: 'totalHipBMD', labelKey: 'ortho.field.totalHipBMD', type: 'number', unit: 'g/cm²', min: 0.2, max: 1.5 },
      { key: 'lumbarSpineBMD', labelKey: 'ortho.field.lumbarSpineBMD', type: 'number', unit: 'g/cm²', min: 0.2, max: 1.8 },
      { key: 'lowestTScore', labelKey: 'ortho.field.lowestTScore', type: 'number', min: -6, max: 6 },
      { key: 'category', labelKey: 'ortho.field.osteoporosisCategory', type: 'select', required: true, options: [{ value: 'normal', labelKey: 'ortho.bmd.normal' }, { value: 'osteopenia', labelKey: 'ortho.bmd.osteopenia' }, { value: 'osteoporosis', labelKey: 'ortho.bmd.osteoporosis' }] },
      { key: 'vertebralFracture', labelKey: 'ortho.field.vertebralFracture', type: 'select', options: [{ value: 'none', labelKey: 'ortho.vfa.none' }, { value: 'genant1', labelKey: 'ortho.vfa.genant1' }, { value: 'genant2', labelKey: 'ortho.vfa.genant2' }, { value: 'genant3', labelKey: 'ortho.vfa.genant3' }] },
      { key: 'fraxMajor', labelKey: 'ortho.field.fraxMajor', type: 'number', unit: '%' },
      { key: 'fraxHip', labelKey: 'ortho.field.fraxHip', type: 'number', unit: '%' },
      { key: 'impression', labelKey: 'ortho.field.impression', type: 'textarea', required: true },
      { key: 'recommendation', labelKey: 'ortho.field.recommendation', type: 'textarea' },
    ],
    version: '1.0', radsCategory: 'Bone-RADS', measurementTools: ['interpretDxa', 'calculateFrax', 'assessVertebralFracture'],
  },
  {
    id: 'ortho-trauma-general',
    nameKey: 'template.ortho.trauma.name',
    descriptionKey: 'template.ortho.trauma.desc',
    type: 'fracture', region: 'long-bone', modality: 'DR',
    anatomy: { region: 'long-bone', modality: 'DR', laterality: 'unilateral', segments: ['proximal', 'midshaft', 'distal'] },
    fields: [
      { key: 'laterality', labelKey: 'ortho.field.laterality', type: 'select', required: true, options: [{ value: 'left', labelKey: 'ortho.left' }, { value: 'right', labelKey: 'ortho.right' }] },
      { key: 'bone', labelKey: 'ortho.field.bone', type: 'text', required: true },
      { key: 'fractureLocation', labelKey: 'ortho.field.fractureLocation', type: 'select', options: [{ value: 'proximal', labelKey: 'ortho.location.proximal' }, { value: 'midshaft', labelKey: 'ortho.location.midshaft' }, { value: 'distal', labelKey: 'ortho.location.distal' }, { value: 'articular', labelKey: 'ortho.location.articular' }] },
      { key: 'fracturePattern', labelKey: 'ortho.field.fracturePattern', type: 'select', options: [{ value: 'transverse', labelKey: 'ortho.pattern.transverse' }, { value: 'oblique', labelKey: 'ortho.pattern.oblique' }, { value: 'spiral', labelKey: 'ortho.pattern.spiral' }, { value: 'comminuted', labelKey: 'ortho.pattern.comminuted' }] },
      { key: 'displacementMm', labelKey: 'ortho.field.displacementMm', type: 'number', unit: 'mm' },
      { key: 'angulationDeg', labelKey: 'ortho.field.angulationDeg', type: 'number', unit: '°' },
      { key: 'intraArticular', labelKey: 'ortho.field.intraArticular', type: 'boolean' },
      { key: 'openFracture', labelKey: 'ortho.field.openFracture', type: 'boolean' },
      { key: 'aoCode', labelKey: 'ortho.field.aoCode', type: 'text' },
      { key: 'impression', labelKey: 'ortho.field.impression', type: 'textarea', required: true },
      { key: 'recommendation', labelKey: 'ortho.field.recommendation', type: 'textarea' },
    ],
    version: '1.0', measurementTools: ['assessFracture'],
  },
  {
    id: 'ortho-hip-oa',
    nameKey: 'template.ortho.hipOA.name',
    descriptionKey: 'template.ortho.hipOA.desc',
    type: 'osteoarthritis', region: 'hip', modality: 'MR',
    anatomy: { region: 'hip', modality: 'MR', laterality: 'unilateral', segments: ['acetabulum', 'femoral-head', 'labrum', 'cartilage'] },
    fields: [
      { key: 'laterality', labelKey: 'ortho.field.laterality', type: 'select', required: true, options: [{ value: 'left', labelKey: 'ortho.left' }, { value: 'right', labelKey: 'ortho.right' }, { value: 'bilateral', labelKey: 'ortho.bilateral' }] },
      { key: 'alphaAngle', labelKey: 'ortho.field.alphaAngle', type: 'number', unit: '°' },
      { key: 'lateralCenterEdge', labelKey: 'ortho.field.lateralCenterEdge', type: 'number', unit: '°' },
      { key: 'labrumTear', labelKey: 'ortho.field.labrumTear', type: 'boolean' },
      { key: 'cartilageDefect', labelKey: 'ortho.field.cartilageDefect', type: 'select', options: [{ value: 'none', labelKey: 'ortho.cartilage.none' }, { value: 'superior', labelKey: 'ortho.cartilage.superior' }, { value: 'anterior', labelKey: 'ortho.cartilage.anterior' }, { value: 'diffuse', labelKey: 'ortho.cartilage.diffuse' }] },
      { key: 'jointEffusion', labelKey: 'ortho.field.jointEffusion', type: 'boolean' },
      { key: 'impression', labelKey: 'ortho.field.impression', type: 'textarea', required: true },
      { key: 'recommendation', labelKey: 'ortho.field.recommendation', type: 'textarea' },
    ],
    version: '1.0', measurementTools: ['measureLimbAlignment', 'fitCircleToFemoralHead'],
  },
  {
    id: 'ortho-ankle-sports',
    nameKey: 'template.ortho.ankleSports.name',
    descriptionKey: 'template.ortho.ankleSports.desc',
    type: 'sports-injury', region: 'ankle', modality: 'MR',
    anatomy: { region: 'ankle', modality: 'MR', laterality: 'unilateral', segments: ['talus', 'calcaneus', 'ligaments', 'tendons'] },
    fields: [
      { key: 'laterality', labelKey: 'ortho.field.laterality', type: 'select', required: true, options: [{ value: 'left', labelKey: 'ortho.left' }, { value: 'right', labelKey: 'ortho.right' }] },
      { key: 'atfl', labelKey: 'ortho.field.atfl', type: 'select', options: [{ value: 'intact', labelKey: 'ortho.ligament.intact' }, { value: 'sprain', labelKey: 'ortho.ligament.sprain' }, { value: 'partial-tear', labelKey: 'ortho.ligament.partialTear' }, { value: 'complete-tear', labelKey: 'ortho.ligament.completeTear' }] },
      { key: 'cfl', labelKey: 'ortho.field.cfl', type: 'select', options: [{ value: 'intact', labelKey: 'ortho.ligament.intact' }, { value: 'sprain', labelKey: 'ortho.ligament.sprain' }, { value: 'partial-tear', labelKey: 'ortho.ligament.partialTear' }, { value: 'complete-tear', labelKey: 'ortho.ligament.completeTear' }] },
      { key: 'ptfl', labelKey: 'ortho.field.ptfl', type: 'select', options: [{ value: 'intact', labelKey: 'ortho.ligament.intact' }, { value: 'sprain', labelKey: 'ortho.ligament.sprain' }, { value: 'partial-tear', labelKey: 'ortho.ligament.partialTear' }, { value: 'complete-tear', labelKey: 'ortho.ligament.completeTear' }] },
      { key: 'achillesTendon', labelKey: 'ortho.field.achillesTendon', type: 'select', options: [{ value: 'normal', labelKey: 'ortho.achilles.normal' }, { value: 'tendinosis', labelKey: 'ortho.achilles.tendinosis' }, { value: 'partial-tear', labelKey: 'ortho.achilles.partialTear' }, { value: 'complete-tear', labelKey: 'ortho.achilles.completeTear' }] },
      { key: 'osteochondralLesion', labelKey: 'ortho.field.osteochondralLesion', type: 'select', options: [{ value: 'none', labelKey: 'ortho.ocl.none' }, { value: 'hepple1', labelKey: 'Hepple I' }, { value: 'hepple2', labelKey: 'Hepple II' }, { value: 'hepple3', labelKey: 'Hepple III' }, { value: 'hepple4', labelKey: 'Hepple IV' }, { value: 'hepple5', labelKey: 'Hepple V' }] },
      { key: 'impression', labelKey: 'ortho.field.impression', type: 'textarea', required: true },
      { key: 'recommendation', labelKey: 'ortho.field.recommendation', type: 'textarea' },
    ],
    version: '1.0', measurementTools: ['assessLigament'],
  },
  {
    id: 'ortho-tumor-bone',
    nameKey: 'template.ortho.boneTumor.name',
    descriptionKey: 'template.ortho.boneTumor.desc',
    type: 'tumor', region: 'long-bone', modality: 'MR',
    anatomy: { region: 'long-bone', modality: 'MR', laterality: 'unilateral', segments: ['epiphysis', 'metaphysis', 'diaphysis'] },
    fields: [
      { key: 'bone', labelKey: 'ortho.field.bone', type: 'text', required: true },
      { key: 'location', labelKey: 'ortho.field.tumorLocation', type: 'select', options: [{ value: 'epiphysis', labelKey: 'ortho.location.epiphysis' }, { value: 'metaphysis', labelKey: 'ortho.location.metaphysis' }, { value: 'diaphysis', labelKey: 'ortho.location.diaphysis' }] },
      { key: 'matrix', labelKey: 'ortho.field.matrix', type: 'select', options: [{ value: 'osteolytic', labelKey: 'ortho.matrix.osteolytic' }, { value: 'osteoblastic', labelKey: 'ortho.matrix.osteoblastic' }, { value: 'mixed', labelKey: 'ortho.matrix.mixed' }, { value: 'ground-glass', labelKey: 'ortho.matrix.groundGlass' }] },
      { key: 'margin', labelKey: 'ortho.field.margin', type: 'select', options: [{ value: 'well-defined-sclerotic', labelKey: 'ortho.margin.wellSclerotic' }, { value: 'well-defined-non-sclerotic', labelKey: 'ortho.margin.wellNonSclerotic' }, { value: 'ill-defined', labelKey: 'ortho.margin.illDefined' }, { value: 'permeative', labelKey: 'ortho.margin.permeative' }] },
      { key: 'largestDimension', labelKey: 'ortho.field.largestDimension', type: 'number', unit: 'mm', required: true },
      { key: 'periostealReaction', labelKey: 'ortho.field.periostealReaction', type: 'select', options: [{ value: 'none', labelKey: 'ortho.periosteal.none' }, { value: 'solid', labelKey: 'ortho.periosteal.solid' }, { value: 'lamellated', labelKey: 'ortho.periosteal.lamellated' }, { value: 'sunburst', labelKey: 'ortho.periosteal.sunburst' }, { value: 'codman', labelKey: 'ortho.periosteal.codman' }] },
      { key: 'softTissueMass', labelKey: 'ortho.field.softTissueMass', type: 'boolean' },
      { key: 'boneRadsCategory', labelKey: 'ortho.field.boneRadsCategory', type: 'select', options: [{ value: '1', labelKey: 'Bone-RADS 1' }, { value: '2', labelKey: 'Bone-RADS 2' }, { value: '3', labelKey: 'Bone-RADS 3' }, { value: '4', labelKey: 'Bone-RADS 4' }] },
      { key: 'impression', labelKey: 'ortho.field.impression', type: 'textarea', required: true },
      { key: 'recommendation', labelKey: 'ortho.field.recommendation', type: 'textarea' },
    ],
    version: '1.0', radsCategory: 'Bone-RADS', measurementTools: ['assessBoneTumor', 'assessTumorFollowUp'],
  },
  {
    id: 'ortho-spine-trauma',
    nameKey: 'template.ortho.spineTrauma.name',
    descriptionKey: 'template.ortho.spineTrauma.desc',
    type: 'fracture', region: 'spine', modality: 'CT',
    anatomy: { region: 'spine', modality: 'CT', laterality: 'unpaired', segments: ['vertebral-body', 'posterior-elements', 'disc-ligamentous'] },
    fields: [
      { key: 'level', labelKey: 'ortho.field.vertebraLevel', type: 'text', required: true },
      { key: 'aoClassification', labelKey: 'ortho.field.aoClassification', type: 'select', options: [{ value: 'A0', labelKey: 'AO A0' }, { value: 'A1', labelKey: 'AO A1' }, { value: 'A2', labelKey: 'AO A2' }, { value: 'A3', labelKey: 'AO A3' }, { value: 'A4', labelKey: 'AO A4' }, { value: 'B1', labelKey: 'AO B1' }, { value: 'B2', labelKey: 'AO B2' }, { value: 'B3', labelKey: 'AO B3' }, { value: 'C', labelKey: 'AO C' }] },
      { key: 'heightLoss', labelKey: 'ortho.field.heightLossPercent', type: 'number', unit: '%' },
      { key: 'canalCompromise', labelKey: 'ortho.field.canalCompromise', type: 'select', options: [{ value: 'none', labelKey: 'ortho.compression.none' }, { value: '<25', labelKey: '<25%' }, { value: '25-50', labelKey: '25-50%' }, { value: '>50', labelKey: '>50%' }] },
      { key: 'posteriorLigamentous', labelKey: 'ortho.field.posteriorLigamentous', type: 'select', options: [{ value: 'intact', labelKey: 'ortho.ligament.intact' }, { value: 'distraction', labelKey: 'ortho.ligament.distraction' }, { value: 'rupture', labelKey: 'ortho.ligament.rupture' }] },
      { key: 'neurologicDeficit', labelKey: 'ortho.field.neurologicDeficit', type: 'select', options: [{ value: 'none', labelKey: 'ortho.neuro.none' }, { value: 'complete', labelKey: 'ortho.neuro.complete' }, { value: 'incomplete', labelKey: 'ortho.neuro.incomplete' }, { value: 'cauda-equina', labelKey: 'ortho.neuro.caudaEquina' }] },
      { key: 'impression', labelKey: 'ortho.field.impression', type: 'textarea', required: true },
      { key: 'recommendation', labelKey: 'ortho.field.recommendation', type: 'textarea' },
    ],
    version: '1.0', measurementTools: ['classifyVertebraFracture', 'computeSpinalAlignment'],
  },
]

export function getOrthoTemplates(): OrthoStructuredReportTemplate[] {
  return ORTHO_TEMPLATES
}

export function getOrthoTemplatesByRegion(region: OrthoBodyRegion): OrthoStructuredReportTemplate[] {
  return ORTHO_TEMPLATES.filter(t => t.region === region)
}

export function getOrthoTemplatesByType(type: OrthoTemplateType): OrthoStructuredReportTemplate[] {
  return ORTHO_TEMPLATES.filter(t => t.type === type)
}

export function getOrthoTemplateById(id: string): OrthoStructuredReportTemplate | undefined {
  return ORTHO_TEMPLATES.find(t => t.id === id)
}

export function renderOrthoReport(templateId: string, data: OrthoReportData, locale: 'zh-CN' | 'en-US'): RenderedOrthoReport {
  const template = getOrthoTemplateById(templateId)
  if (!template) throw new Error(`Template not found: ${templateId}`)

  const isZh = locale === 'zh-CN'
  const sections: OrthoReportSection[] = []
  const fieldLabels: Record<string, string> = {
    laterality: isZh ? '侧别' : 'Laterality',
    klGrade: isZh ? 'Kellgren-Lawrence 分级' : 'Kellgren-Lawrence Grade',
    jointSpaceWidth: isZh ? '关节间隙宽度' : 'Joint Space Width',
    osteophytes: isZh ? '骨赘' : 'Osteophytes',
    subchondralSclerosis: isZh ? '软骨下硬化' : 'Subchondral Sclerosis',
    effusion: isZh ? '关节积液' : 'Joint Effusion',
    impression: isZh ? '印象' : 'Impression',
    recommendation: isZh ? '建议' : 'Recommendation',
  }

  for (const field of template.fields) {
    if (field.key === 'impression' || field.key === 'recommendation') continue
    const label = field.labelKey ? (fieldLabels[field.key] || field.key) : field.key
    const value = data.values[field.key]
    if (value !== undefined && value !== '' && value !== false) {
      sections.push({
        heading: label,
        content: String(value),
        fields: [{ key: field.key, label, value: String(value) }],
      })
    }
  }

  const impression = String(data.values.impression || '')
  const recommendation = String(data.values.recommendation || '')

  return {
    templateId,
    title: template.nameKey,
    sections,
    impression,
    recommendation,
  }
}

export function validateOrthoReportData(templateId: string, data: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const template = getOrthoTemplateById(templateId)
  if (!template) return { valid: false, errors: [`Template ${templateId} not found`] }

  const errors: string[] = []
  for (const field of template.fields) {
    if (field.required && (data[field.key] === undefined || data[field.key] === '' || data[field.key] === null)) {
      errors.push(`${field.key} is required`)
    }
    if (field.type === 'number' && data[field.key] !== undefined) {
      const val = Number(data[field.key])
      if (field.min !== undefined && val < field.min) errors.push(`${field.key} minimum is ${field.min}`)
      if (field.max !== undefined && val > field.max) errors.push(`${field.key} maximum is ${field.max}`)
    }
  }
  return { valid: errors.length === 0, errors }
}
