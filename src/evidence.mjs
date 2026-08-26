import { isTrustedVerification } from './verification.mjs';
import { objectFreeze, objectHasOwn } from './intrinsics.mjs';

export const EVIDENCE_LEVELS = objectFreeze({
  BELIEVED: 'BELIEVED',
  OBSERVED: 'OBSERVED',
  PROVEN: 'PROVEN'
});

const EVIDENCE_RANK = objectFreeze({
  [EVIDENCE_LEVELS.BELIEVED]: 0,
  [EVIDENCE_LEVELS.OBSERVED]: 1,
  [EVIDENCE_LEVELS.PROVEN]: 2
});

export function promoteEvidence(current, target) {
  if (!objectHasOwn(EVIDENCE_RANK, current) || !objectHasOwn(EVIDENCE_RANK, target)) {
    throw new RangeError('Unknown evidence level');
  }

  if (EVIDENCE_RANK[target] < EVIDENCE_RANK[current]) {
    throw new Error(`Evidence cannot move backwards from ${current} to ${target}`);
  }

  return target;
}

export function evidenceForVerification(verification) {
  if (!isTrustedVerification(verification)) {
    return EVIDENCE_LEVELS.OBSERVED;
  }

  if (verification.passed && verification.deterministic) {
    return EVIDENCE_LEVELS.PROVEN;
  }

  return EVIDENCE_LEVELS.OBSERVED;
}
