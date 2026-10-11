export const PATIENT_MASTER_MIN = 1;
export const PATIENT_MASTER_MAX = 49700;

export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function hashToMasterPatientId(legacyId: string): string {
  const n = (fnv1a32(legacyId) % PATIENT_MASTER_MAX) + PATIENT_MASTER_MIN;
  return `P${n.toString().padStart(6, "0")}`;
}

const LEGACY_NAMESPACES: string[] = [
  ...Array.from({ length: 12 }, (_, i) => `P${(i + 1).toString().padStart(3, "0")}`),
  ...Array.from({ length: 5 }, (_, i) => `P${100001 + i}`),
  ...Array.from({ length: 36 }, (_, i) => `p-${1001 + i}`),
  ...Array.from({ length: 500 }, (_, i) => `P2026${(i + 1).toString().padStart(5, "0")}`),
  ...Array.from({ length: 200 }, (_, i) => `RAD-P${(i + 1).toString().padStart(3, "0")}`),
];

export const LEGACY_ID_TO_MASTER: Record<string, string> = Object.fromEntries(
  LEGACY_NAMESPACES.map((id) => [id, hashToMasterPatientId(id)]),
);

const MASTER_ID_RE = /^P\d{6}$/;
const PATIENT_SHAPED_RE = /^[Pp]/;
const RAD_PATIENT_RE = /^RAD-P\d+$/;

export function isMasterPatientId(id: string): boolean {
  if (!MASTER_ID_RE.test(id)) return false;
  const n = Number(id.slice(1));
  return n >= PATIENT_MASTER_MIN && n <= PATIENT_MASTER_MAX;
}

export function resolvePatientId(id: string): string {
  if (!id) return id;
  const trimmed = id.trim();
  if (!trimmed) return id;
  const known = LEGACY_ID_TO_MASTER[trimmed];
  if (known) return known;
  if (isMasterPatientId(trimmed)) return trimmed;
  if (PATIENT_SHAPED_RE.test(trimmed) || RAD_PATIENT_RE.test(trimmed)) {
    return hashToMasterPatientId(trimmed);
  }
  return id;
}
