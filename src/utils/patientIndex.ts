/**
 * PIX/eMPI Patient Index Management
 * Supports patient identity cross-referencing across identity domains
 */

// ============================================================================
// Types
// ============================================================================

/** Represents an identity domain (e.g., hospital MRN, national ID, passport) */
export interface IdentityDomain {
  code: string;           // e.g., "MRN", "NID", "PASSPORT"
  authority: string;      // e.g., "HOSPITAL", "GOV", "UN"
  description: string;
  assignDomain?: string;  // Assigning authority domain
}

/** A single patient identity within a specific domain */
export interface PatientIdentity {
  id: string;             // Unique identity ID
  patientId: string;      // Root patient ID (eMPI)
  domain: IdentityDomain;
  identityValue: string;  // The actual identifier value (MRN, ID number, etc.)
  identityType?: string;  // e.g., "ID_CARD", "PASSPORT", "MRN"
  givenName?: string;
  familyName?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  phone?: string;
  email?: string;
  active: boolean;
  verified: boolean;
  verificationDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Links multiple patient identities across domains for the same patient */
export interface PatientLink {
  linkId: string;
  patientId: string;
  linkedIdentities: string[];  // Array of PatientIdentity IDs
  linkType: "AUTOMATIC" | "MANUAL" | "probabilistic" | "probable";
  linkConfidence: number;      // 0.0 - 1.0
  status: "ACTIVE" | "MERGED" | "UNLINKED";
  effectiveDate: string;
  expiryDate?: string;
  createdBy: string;
  createdAt: string;
  notes?: string;
}

// ============================================================================
// Mock Data (12 records)
// ============================================================================

const identityDomains: IdentityDomain[] = [
  { code: "MRN", authority: "HOSPITAL", description: "Medical Record Number", assignDomain: "HOSPITAL" },
  { code: "NID", authority: "GOV", description: "National Identity Card", assignDomain: "GOV" },
  { code: "PP", authority: "UN", description: "Passport", assignDomain: "UN" },
  { code: "SSN", authority: "GOV", description: "Social Security Number", assignDomain: "SSA" },
  { code: "DL", authority: "GOV", description: "Driver's License", assignDomain: "DMV" },
];

export const mockPatients: PatientIdentity[] = [
  {
    id: "ID-001-001",
    patientId: "PT-001",
    domain: identityDomains[0]!,
    identityValue: "MRN-100001",
    identityType: "MRN",
    givenName: "Wei",
    familyName: "Zhang",
    birthDate: "1975-03-15",
    gender: "M",
    address: "123 Zhongshan Rd, Guangzhou",
    phone: "13800138001",
    email: "wei.zhang@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-01-10",
    createdAt: "2024-01-10T08:30:00Z",
    updatedAt: "2024-01-10T08:30:00Z",
  },
  {
    id: "ID-001-002",
    patientId: "PT-001",
    domain: identityDomains[1]!,
    identityValue: "440103197503151234",
    identityType: "ID_CARD",
    givenName: "Wei",
    familyName: "Zhang",
    birthDate: "1975-03-15",
    gender: "M",
    active: true,
    verified: true,
    verificationDate: "2024-01-10",
    createdAt: "2024-01-10T08:35:00Z",
    updatedAt: "2024-01-10T08:35:00Z",
  },
  {
    id: "ID-002-001",
    patientId: "PT-002",
    domain: identityDomains[0]!,
    identityValue: "MRN-100002",
    identityType: "MRN",
    givenName: "Mei",
    familyName: "Chen",
    birthDate: "1988-07-22",
    gender: "F",
    address: "456 Tianhe Rd, Guangzhou",
    phone: "13800138002",
    email: "mei.chen@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-02-05",
    createdAt: "2024-02-05T10:15:00Z",
    updatedAt: "2024-02-05T10:15:00Z",
  },
  {
    id: "ID-003-001",
    patientId: "PT-003",
    domain: identityDomains[0]!,
    identityValue: "MRN-100003",
    identityType: "MRN",
    givenName: "Jian",
    familyName: "Wang",
    birthDate: "1992-11-08",
    gender: "M",
    address: "789 Yuejiang Rd, Guangzhou",
    phone: "13800138003",
    email: "jian.wang@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-03-12",
    createdAt: "2024-03-12T14:20:00Z",
    updatedAt: "2024-03-12T14:20:00Z",
  },
  {
    id: "ID-003-002",
    patientId: "PT-003",
    domain: identityDomains[1]!,
    identityValue: "440103199211081567",
    identityType: "ID_CARD",
    givenName: "Jian",
    familyName: "Wang",
    birthDate: "1992-11-08",
    gender: "M",
    active: true,
    verified: true,
    verificationDate: "2024-03-12",
    createdAt: "2024-03-12T14:25:00Z",
    updatedAt: "2024-03-12T14:25:00Z",
  },
  {
    id: "ID-004-001",
    patientId: "PT-004",
    domain: identityDomains[0]!,
    identityValue: "MRN-100004",
    identityType: "MRN",
    givenName: "Xiu",
    familyName: "Li",
    birthDate: "1960-05-30",
    gender: "F",
    address: "321 Baiyun Ave, Guangzhou",
    phone: "13800138004",
    email: "xiu.li@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-04-01",
    createdAt: "2024-04-01T09:00:00Z",
    updatedAt: "2024-04-01T09:00:00Z",
  },
  {
    id: "ID-005-001",
    patientId: "PT-005",
    domain: identityDomains[0]!,
    identityValue: "MRN-100005",
    identityType: "MRN",
    givenName: "Hao",
    familyName: "Liu",
    birthDate: "2001-09-14",
    gender: "M",
    address: "654 Huangpu Rd, Guangzhou",
    phone: "13800138005",
    email: "hao.liu@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-05-20",
    createdAt: "2024-05-20T11:45:00Z",
    updatedAt: "2024-05-20T11:45:00Z",
  },
  {
    id: "ID-006-001",
    patientId: "PT-006",
    domain: identityDomains[0]!,
    identityValue: "MRN-100006",
    identityType: "MRN",
    givenName: "Qing",
    familyName: "Zhou",
    birthDate: "1978-12-03",
    gender: "F",
    address: "987 Tianhe North Rd, Guangzhou",
    phone: "13800138006",
    email: "qing.zhou@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-06-15",
    createdAt: "2024-06-15T16:30:00Z",
    updatedAt: "2024-06-15T16:30:00Z",
  },
  {
    id: "ID-007-001",
    patientId: "PT-007",
    domain: identityDomains[0]!,
    identityValue: "MRN-100007",
    identityType: "MRN",
    givenName: "Feng",
    familyName: "Yang",
    birthDate: "1985-02-28",
    gender: "M",
    address: "135 Liwan Rd, Guangzhou",
    phone: "13800138007",
    email: "feng.yang@email.com",
    active: true,
    verified: false,
    createdAt: "2024-07-08T08:00:00Z",
    updatedAt: "2024-07-08T08:00:00Z",
  },
  {
    id: "ID-008-001",
    patientId: "PT-008",
    domain: identityDomains[0]!,
    identityValue: "MRN-100008",
    identityType: "MRN",
    givenName: "Lin",
    familyName: "Xu",
    birthDate: "1995-08-17",
    gender: "F",
    address: "246 Haizhu Rd, Guangzhou",
    phone: "13800138008",
    email: "lin.xu@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-08-22",
    createdAt: "2024-08-22T13:10:00Z",
    updatedAt: "2024-08-22T13:10:00Z",
  },
  {
    id: "ID-009-001",
    patientId: "PT-009",
    domain: identityDomains[0]!,
    identityValue: "MRN-100009",
    identityType: "MRN",
    givenName: "Tao",
    familyName: "Huang",
    birthDate: "1968-04-25",
    gender: "M",
    address: "579 Panyu Ave, Guangzhou",
    phone: "13800138009",
    email: "tao.huang@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-09-30",
    createdAt: "2024-09-30T10:00:00Z",
    updatedAt: "2024-09-30T10:00:00Z",
  },
  {
    id: "ID-010-001",
    patientId: "PT-010",
    domain: identityDomains[0]!,
    identityValue: "MRN-100010",
    identityType: "MRN",
    givenName: "Yan",
    familyName: "Guo",
    birthDate: "2010-10-10",
    gender: "F",
    address: "802 Zengcheng Rd, Guangzhou",
    phone: "13800138010",
    email: "yan.guo@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-10-15",
    createdAt: "2024-10-15T15:45:00Z",
    updatedAt: "2024-10-15T15:45:00Z",
  },
  {
    id: "ID-011-001",
    patientId: "PT-011",
    domain: identityDomains[0]!,
    identityValue: "MRN-100011",
    identityType: "MRN",
    givenName: "Rong",
    familyName: "Deng",
    birthDate: "1955-06-18",
    gender: "M",
    address: "913 Conghua Rd, Guangzhou",
    phone: "13800138011",
    email: "rong.deng@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-11-05",
    createdAt: "2024-11-05T09:30:00Z",
    updatedAt: "2024-11-05T09:30:00Z",
  },
  {
    id: "ID-012-001",
    patientId: "PT-012",
    domain: identityDomains[0]!,
    identityValue: "MRN-100012",
    identityType: "MRN",
    givenName: "Yi",
    familyName: "Cai",
    birthDate: "1980-01-01",
    gender: "F",
    address: "104 Nansha Ave, Guangzhou",
    phone: "13800138012",
    email: "yi.cai@email.com",
    active: true,
    verified: true,
    verificationDate: "2024-12-01",
    createdAt: "2024-12-01T12:00:00Z",
    updatedAt: "2024-12-01T12:00:00Z",
  },
];

export const mockPatientLinks: PatientLink[] = [
  {
    linkId: "LINK-001",
    patientId: "PT-001",
    linkedIdentities: ["ID-001-001", "ID-001-002"],
    linkType: "MANUAL",
    linkConfidence: 1.0,
    status: "ACTIVE",
    effectiveDate: "2024-01-10",
    createdBy: "ADMIN",
    createdAt: "2024-01-10T08:40:00Z",
    notes: "Patient confirmed identity with ID card",
  },
  {
    linkId: "LINK-002",
    patientId: "PT-003",
    linkedIdentities: ["ID-003-001", "ID-003-002"],
    linkType: "MANUAL",
    linkConfidence: 1.0,
    status: "ACTIVE",
    effectiveDate: "2024-03-12",
    createdBy: "ADMIN",
    createdAt: "2024-03-12T14:30:00Z",
    notes: "Patient verified with national ID",
  },
];

// ============================================================================
// In-memory store for runtime modifications
// ============================================================================

let patientsStore: PatientIdentity[] = [...mockPatients];
const linksStore: PatientLink[] = [...mockPatientLinks];

// ============================================================================
// Functions
// ============================================================================

/**
 * Query patients with optional filters
 */
export function queryPatients(params: {
  givenName?: string;
  familyName?: string;
  birthDate?: string;
  gender?: string;
  domainCode?: string;
  active?: boolean;
  verified?: boolean;
  limit?: number;
  offset?: number;
}): { patients: PatientIdentity[]; total: number } {
  let results = patientsStore.filter(p => p.active);

  if (params.givenName) {
    results = results.filter(p => p.givenName?.toLowerCase().includes(params.givenName!.toLowerCase()));
  }
  if (params.familyName) {
    results = results.filter(p => p.familyName?.toLowerCase().includes(params.familyName!.toLowerCase()));
  }
  if (params.birthDate) {
    results = results.filter(p => p.birthDate === params.birthDate);
  }
  if (params.gender) {
    results = results.filter(p => p.gender === params.gender);
  }
  if (params.domainCode) {
    results = results.filter(p => p.domain.code === params.domainCode);
  }
  if (params.active !== undefined) {
    results = results.filter(p => p.active === params.active);
  }
  if (params.verified !== undefined) {
    results = results.filter(p => p.verified === params.verified);
  }

  const total = results.length;
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 50;
  results = results.slice(offset, offset + limit);

  return { patients: results, total };
}

/**
 * Get a patient by their unique identity ID
 */
export function getPatientById(id: string): PatientIdentity | null {
  return patientsStore.find(p => p.id === id) ?? null;
}

/**
 * Register a new patient identity
 */
export function registerPatient(patient: Omit<PatientIdentity, "id" | "createdAt" | "updatedAt">): PatientIdentity {
  const now = new Date().toISOString();
  const newPatient: PatientIdentity = {
    ...patient,
    id: `ID-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
  };
  patientsStore.push(newPatient);
  return newPatient;
}

/**
 * Link multiple patient identities across domains
 */
export function linkPatientIdentities(params: {
  patientId: string;
  identityIds: string[];
  linkType?: PatientLink["linkType"];
  createdBy: string;
  notes?: string;
}): PatientLink {
  const link: PatientLink = {
    linkId: `LINK-${Date.now()}`,
    patientId: params.patientId,
    linkedIdentities: params.identityIds,
    linkType: params.linkType ?? "MANUAL",
    linkConfidence: 1.0,
    status: "ACTIVE",
    effectiveDate: new Date().toISOString().split("T")[0]!,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    notes: params.notes,
  };
  linksStore.push(link);
  return link;
}

/**
 * Merge two patients into one (link all identities under surviving patientId)
 */
export function mergePatients(params: {
  survivingPatientId: string;
  mergedPatientId: string;
  createdBy: string;
  notes?: string;
}): PatientLink {
  // Get all identities from merged patient
  const mergedIdentities = patientsStore
    .filter(p => p.patientId === params.mergedPatientId)
    .map(p => p.id);

  // Get surviving patient identities
  const survivingIdentities = patientsStore
    .filter(p => p.patientId === params.survivingPatientId)
    .map(p => p.id);

  // Update patientId references for merged identities
  patientsStore = patientsStore.map(p => {
    if (p.patientId === params.mergedPatientId) {
      return { ...p, patientId: params.survivingPatientId, updatedAt: new Date().toISOString() };
    }
    return p;
  });

  // Create link for all merged identities
  return linkPatientIdentities({
    patientId: params.survivingPatientId,
    identityIds: [...survivingIdentities, ...mergedIdentities],
    linkType: "MANUAL",
    createdBy: params.createdBy,
    notes: params.notes ?? `Merged patient ${params.mergedPatientId} into ${params.survivingPatientId}`,
  });
}

/**
 * Search patients by ID card number
 */
export function searchByIdCard(idCardNumber: string): PatientIdentity[] {
  return patientsStore.filter(p =>
    p.identityValue === idCardNumber ||
    (p.identityType === "ID_CARD" && p.identityValue === idCardNumber)
  );
}

/**
 * Search patients by phone number
 */
export function searchByPhone(phone: string): PatientIdentity[] {
  const normalizedPhone = phone.replace(/\D/g, "");
  return patientsStore.filter(p => p.phone?.replace(/\D/g, "").includes(normalizedPhone));
}

// ============================================================================
// Theme Colors (Blue #3b82f6)
// ============================================================================

export const patientIndexTheme = {
  primary: "#3b82f6",
  primaryLight: "#60a5fa",
  primaryDark: "#1d4ed8",
  primaryLighter: "#93c5fd",
  primaryBg: "#eff6ff",
  secondary: "#3b82f6",
  accent: "#3b82f6",
  success: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",
  info: "#3b82f6",
  text: {
    primary: "#1e293b",
    secondary: "#64748b",
    muted: "#94a3b8",
    inverse: "#ffffff",
  },
  border: "#e2e8f0",
  bg: {
    primary: "#ffffff",
    secondary: "#f8fafc",
    tertiary: "#f1f5f9",
  },
};

export const cssVariables = `
  :root {
    --patient-index-primary: ${patientIndexTheme.primary};
    --patient-index-primary-light: ${patientIndexTheme.primaryLight};
    --patient-index-primary-dark: ${patientIndexTheme.primaryDark};
    --patient-index-primary-lighter: ${patientIndexTheme.primaryLighter};
    --patient-index-primary-bg: ${patientIndexTheme.primaryBg};
  }
`;