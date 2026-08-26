import { EVIDENCE_LEVELS } from './evidence.mjs';
import {
  isFrozenObject,
  objectFreeze,
  objectValues,
  setFromArray,
  setHas,
  weakMapCreate,
  weakMapGet,
  weakMapSet
} from './intrinsics.mjs';
import { SURPRISE_BANDS } from './world-model.mjs';

export const QUESTION_REASONS = objectFreeze({
  NONE: 'NONE',
  HIGH_SURPRISE: 'HIGH_SURPRISE',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  EXPLICIT_RESEARCH: 'EXPLICIT_RESEARCH'
});

const VALID_EVIDENCE = setFromArray(objectValues(EVIDENCE_LEVELS));
const VALID_SURPRISE_BANDS = setFromArray(objectValues(SURPRISE_BANDS));
const TRUSTED_QUESTION_DECISIONS = weakMapCreate();

function requireActionSignal(actionReport) {
  if (!actionReport || typeof actionReport !== 'object') {
    throw new TypeError('Question policy requires an action report');
  }
  if (!setHas(VALID_EVIDENCE, actionReport.evidence)) {
    throw new RangeError('Question policy requires a known evidence level');
  }
  if (!setHas(VALID_SURPRISE_BANDS, actionReport.surpriseBand)) {
    throw new RangeError('Question policy requires a known surprise band');
  }
}

export class QuestionDecision {
  constructor({
    actionReport,
    researchCompleted = false,
    researchRequested = false
  }) {
    requireActionSignal(actionReport);
    if (typeof researchCompleted !== 'boolean') {
      throw new TypeError('Question researchCompleted must be boolean');
    }
    if (typeof researchRequested !== 'boolean') {
      throw new TypeError('Question researchRequested must be boolean');
    }

    const highSurprise = actionReport.surpriseBand === SURPRISE_BANDS.HIGH;
    const insufficientEvidence = actionReport.evidence !== EVIDENCE_LEVELS.PROVEN;
    const explicitResearch = researchRequested || researchCompleted;
    const automatic = highSurprise || insufficientEvidence;
    const reason = highSurprise
      ? QUESTION_REASONS.HIGH_SURPRISE
      : insufficientEvidence
        ? QUESTION_REASONS.INSUFFICIENT_EVIDENCE
        : explicitResearch
          ? QUESTION_REASONS.EXPLICIT_RESEARCH
          : QUESTION_REASONS.NONE;

    this.requested = automatic || explicitResearch;
    this.reason = reason;
    this.automatic = automatic;
    this.researchCompleted = researchCompleted;
    this.researchRequested = explicitResearch;
    this.researchRequired = this.requested && !researchCompleted;
    this.evidence = actionReport.evidence;
    this.surpriseBand = actionReport.surpriseBand;
    objectFreeze(this);
  }
}

export function questionFor({
  actionReport,
  researchCompleted = false,
  researchRequested = false
}) {
  const decision = new QuestionDecision({
    actionReport,
    researchCompleted,
    researchRequested
  });
  weakMapSet(TRUSTED_QUESTION_DECISIONS, decision, actionReport);
  return decision;
}

export function isTrustedQuestionDecision(decision, actionReport = null) {
  const source = typeof decision === 'object' && decision !== null
    ? weakMapGet(TRUSTED_QUESTION_DECISIONS, decision)
    : undefined;
  return typeof decision === 'object'
    && decision !== null
    && isFrozenObject(decision)
    && source !== undefined
    && (actionReport === null || source === actionReport);
}
