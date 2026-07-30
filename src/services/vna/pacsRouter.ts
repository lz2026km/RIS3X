import type { VnaRoutingRule, VnaRoutingCondition, DicomStudy } from './types';

const DEFAULT_RULES: VnaRoutingRule[] = [
  { id: 'rule-1', name: 'CT studies to hot tier', enabled: true, conditions: [{ field: 'modality', operator: 'equals', value: 'CT' }], action: 'store', targetStorageTier: 'hot', priority: 100 },
  { id: 'rule-2', name: 'MR studies to hot tier', enabled: true, conditions: [{ field: 'modality', operator: 'equals', value: 'MR' }], action: 'store', targetStorageTier: 'hot', priority: 90 },
  { id: 'rule-3', name: 'XR studies to cool tier', enabled: true, conditions: [{ field: 'modality', operator: 'equals', value: 'DR' }], action: 'store', targetStorageTier: 'cool', priority: 80 },
  { id: 'rule-4', name: 'Archive studies > 1 year', enabled: false, conditions: [{ field: 'studyDescription', operator: 'contains', value: 'archive' }], action: 'archive', targetStorageTier: 'cold', priority: 50 },
];

let routingRules: VnaRoutingRule[] = [...DEFAULT_RULES];

export function getRoutingRules(): VnaRoutingRule[] {
  return routingRules;
}

export function setRoutingRules(rules: VnaRoutingRule[]): void {
  routingRules = rules;
}

export function addRoutingRule(rule: VnaRoutingRule): void {
  routingRules.push(rule);
}

export function removeRoutingRule(id: string): void {
  routingRules = routingRules.filter(r => r.id !== id);
}

function evaluateCondition(condition: VnaRoutingCondition, study: DicomStudy): boolean {
  let fieldValue: string | undefined;
  switch (condition.field) {
    case 'modality': fieldValue = study.modalitiesInStudy?.join(','); break;
    case 'institution': fieldValue = study.institutionName; break;
    case 'bodyPart': fieldValue = study.bodyPartExamined; break;
    case 'studyDescription': fieldValue = study.studyDescription; break;
    case 'patientId': fieldValue = study.patientId; break;
  }
  if (!fieldValue) return false;
  const val: string = Array.isArray(condition.value) ? condition.value[0] ?? '' : condition.value;
  switch (condition.operator) {
    case 'equals': return fieldValue === val;
    case 'contains': return fieldValue.includes(val);
    case 'startsWith': return fieldValue.startsWith(val);
    case 'regex': return new RegExp(val).test(fieldValue);
    case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    default: return false;
  }
}

export function evaluateRoutingRules(study: DicomStudy): VnaRoutingRule[] {
  return routingRules
    .filter(r => r.enabled)
    .filter(r => r.conditions.every(c => evaluateCondition(c, study)))
    .sort((a, b) => b.priority - a.priority);
}

export function getTargetTier(study: DicomStudy): string {
  const matchedRules = evaluateRoutingRules(study);
  return matchedRules[0]?.targetStorageTier || 'hot';
}
