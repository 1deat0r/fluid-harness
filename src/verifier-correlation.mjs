import {
  arrayEvery,
  arrayFilter,
  arrayForEach,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arraySlice,
  arraySort,
  isFrozenObject,
  isPlainObject,
  objectFreeze,
  objectGetPrototypeOf,
  setAdd,
  setFromArray,
  setHas,
  setSize,
  stringLocaleCompare,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';
import {
  isTrustedAdversarialLineageEnsembleReport
} from './adversarial-lineage-ensemble.mjs';

export const VERIFIER_CORRELATION_STATUSES = objectFreeze({
  CORRELATED: 'correlated',
  DIVERSE: 'diverse',
  UNRESOLVED: 'unresolved'
});

const VERIFIER_CORRELATION_AUDIT_TOKEN = objectFreeze({});
const TRUSTED_VERIFIER_CORRELATION_AUDITS = weakSetCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function normalizeVerifierId(value, field) {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a string or null`);
  }
  return stringTrim(value);
}

function requireEnsembleShape(ensemble) {
  if (!isTrustedAdversarialLineageEnsembleReport(ensemble)) {
    throw new TypeError(
      'Verifier-correlation auditing requires a trusted adversarial lineage ensemble report'
    );
  }
  if (
    !arrayIsArray(ensemble.lineages)
    || ensemble.lineages.length < 2
    || !arrayEvery(ensemble.lineages, (lineage) => (
      isPlainObject(lineage)
      && arrayIsArray(lineage.results)
    ))
  ) {
    throw new TypeError('Verifier-correlation auditing received an invalid ensemble summary');
  }
  return ensemble;
}

function summarizeCase(ensemble, firstResult, index) {
  const verifierIds = [];
  let coveredLineages = 0;

  arrayForEach(ensemble.lineages, (lineage, lineageIndex) => {
    const result = lineage.results[index];
    if (
      !result
      || result.caseId !== firstResult.caseId
      || result.domain !== firstResult.domain
    ) {
      throw new TypeError(
        `Verifier-correlation ensemble case ${index} is inconsistent across lineages`
      );
    }
    const verifierId = normalizeVerifierId(
      result.verifierId,
      `Verifier-correlation verifier id for case ${index}, lineage ${lineageIndex}`
    );
    if (verifierId !== null) {
      coveredLineages += 1;
      arrayPush(verifierIds, verifierId);
    }
  });

  const verifierIdSet = setFromArray([]);
  const uniqueVerifierIds = [];
  arrayForEach(verifierIds, (verifierId) => {
    if (!setHas(verifierIdSet, verifierId)) {
      setAdd(verifierIdSet, verifierId);
      arrayPush(uniqueVerifierIds, verifierId);
    }
  });
  const distinctVerifierIds = setSize(verifierIdSet);
  const status = coveredLineages !== ensemble.lineageCount
    ? VERIFIER_CORRELATION_STATUSES.UNRESOLVED
    : distinctVerifierIds === 1
      ? VERIFIER_CORRELATION_STATUSES.CORRELATED
      : VERIFIER_CORRELATION_STATUSES.DIVERSE;

  return objectFreeze({
    caseId: firstResult.caseId,
    domain: firstResult.domain,
    status,
    lineageCount: ensemble.lineageCount,
    coveredLineages,
    distinctVerifierCount: distinctVerifierIds,
    verifierIds: objectFreeze(arraySort(
      arraySlice(uniqueVerifierIds),
      (left, right) => stringLocaleCompare(left, right)
    ))
  });
}

export class VerifierCorrelationAuditReport {
  constructor({ ensembleId, candidateId, cases, token }) {
    if (
      token !== VERIFIER_CORRELATION_AUDIT_TOKEN
      || !arrayIsArray(cases)
      || cases.length === 0
      || !arrayEvery(cases, (entry) => isFrozenObject(entry))
    ) {
      throw new TypeError('Verifier-correlation audit reports require the trusted audit path');
    }
    this.auditType = 'verifier-correlation';
    this.ensembleId = requireNonEmptyString(
      ensembleId,
      'Verifier-correlation ensemble id'
    );
    this.candidateId = requireNonEmptyString(
      candidateId,
      'Verifier-correlation candidate id'
    );
    this.lineageCount = cases[0].lineageCount;
    this.caseCount = cases.length;
    this.cases = objectFreeze(arraySlice(cases));
    this.correlatedCases = arrayFilter(cases,
      (entry) => entry.status === VERIFIER_CORRELATION_STATUSES.CORRELATED
    ).length;
    this.diverseCases = arrayFilter(cases,
      (entry) => entry.status === VERIFIER_CORRELATION_STATUSES.DIVERSE
    ).length;
    this.unresolvedCases = arrayFilter(cases,
      (entry) => entry.status === VERIFIER_CORRELATION_STATUSES.UNRESOLVED
    ).length;
    this.coveredCases = this.caseCount - this.unresolvedCases;
    this.correlationRate = this.caseCount === 0
      ? 0
      : this.correlatedCases / this.caseCount;
    this.diversityComplete = this.unresolvedCases === 0
      && this.diverseCases === this.caseCount;
    this.runtimeIndependent = true;
    this.requiresVerifierReview = this.correlatedCases > 0 || this.unresolvedCases > 0;
    this.evidence = 'OBSERVED';
    this.dataOnly = true;
    this.historicalOnly = true;
    this.productionEligible = false;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_VERIFIER_CORRELATION_AUDITS, this);
    objectFreeze(this);
  }
}

export function isTrustedVerifierCorrelationAudit(audit) {
  return typeof audit === 'object'
    && audit !== null
    && weakSetHas(TRUSTED_VERIFIER_CORRELATION_AUDITS, audit)
    && isFrozenObject(audit)
    && objectGetPrototypeOf(audit) === VerifierCorrelationAuditReport.prototype;
}

export function auditVerifierCorrelation(ensemble) {
  const trustedEnsemble = requireEnsembleShape(ensemble);
  if (trustedEnsemble.lineages.length === 0) {
    throw new TypeError('Verifier-correlation auditing requires lineages');
  }
  const firstLineage = trustedEnsemble.lineages[0];
  if (firstLineage.results.length === 0) {
    throw new TypeError('Verifier-correlation auditing requires case results');
  }
  const cases = arrayMap(
    firstLineage.results,
    (firstResult, index) => summarizeCase(trustedEnsemble, firstResult, index)
  );
  return new VerifierCorrelationAuditReport({
    ensembleId: trustedEnsemble.ensembleId,
    candidateId: trustedEnsemble.candidateId,
    cases,
    token: VERIFIER_CORRELATION_AUDIT_TOKEN
  });
}

objectFreeze(VerifierCorrelationAuditReport.prototype);
