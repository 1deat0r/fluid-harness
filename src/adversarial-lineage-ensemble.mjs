import {
  AdversarialLineageRunner,
  ADVERSARIAL_LINEAGE_TYPES,
  isTrustedAdversarialLineageReport,
  isTrustedAdversarialLineageRunner
} from './adversarial-lineage.mjs';
import {
  EvaluationBudget,
  POLICY_MODES,
  isTrustedEvaluationBudget,
  isTrustedEvaluationCase
} from './evaluation.mjs';
import {
  arrayEvery,
  arrayForEach,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arraySlice,
  arraySome,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  reflectOwnKeys,
  setFromArray,
  setSize,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const MAX_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE = 4;
export const MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE = 2;

const ENSEMBLE_OPTIONS_KEYS = objectFreeze([
  'ensembleId',
  'lineageFactory',
  'maxLineages'
]);
const ENSEMBLE_RUN_KEYS = objectFreeze([
  'candidateId',
  'cases',
  'budget',
  'executionOptions',
  'lineageCount'
]);
const TRUSTED_ADVERSARIAL_LINEAGE_ENSEMBLE_RUNNERS = weakSetCreate();
const TRUSTED_ADVERSARIAL_LINEAGE_ENSEMBLE_REPORTS = weakSetCreate();
const USED_ADVERSARIAL_LINEAGE_RUNNERS = weakSetCreate();
const ENSEMBLE_REPORT_TOKEN = objectFreeze({});

function requireDataObject(value, field, allowedKeys) {
  if (!isPlainObject(value)) {
    throw new TypeError(`${field} must be a plain object`);
  }
  arrayForEach(reflectOwnKeys(value), (key) => {
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (
      typeof key === 'symbol'
      || !descriptor?.enumerable
      || descriptor.get
      || descriptor.set
      || !arrayIncludes(allowedKeys, key)
    ) {
      throw new TypeError(`${field} must contain only enumerable data properties`);
    }
  });
  return value;
}

function requireNonEmptyString(value, field, maximum = 256) {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string`);
  }
  const normalized = stringTrim(value);
  if (normalized === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  if (normalized.length > maximum) {
    throw new RangeError(`${field} must not exceed ${maximum} characters`);
  }
  return normalized;
}

function requireFactory(value, field) {
  if (typeof value !== 'function') {
    throw new TypeError(`${field} must be a function`);
  }
  return value;
}

function copyLineageResult(result) {
  return objectFreeze({
    adversarial: result.adversarial,
    caseId: result.caseId,
    domain: result.domain,
    error: result.error,
    expected: result.expected,
    proven: result.proven,
    representation: result.representation,
    requiresProof: result.requiresProof,
    success: result.success,
    surpriseBand: result.surpriseBand,
    surpriseNats: result.surpriseNats,
    verifierId: result.verifierId
  });
}

function copyLineageReport(report) {
  return objectFreeze({
    adversarialCases: report.adversarialCases,
    adversarialSuccessRate: report.adversarialSuccessRate,
    adversarialSuccesses: report.adversarialSuccesses,
    attemptedCases: report.attemptedCases,
    authorityTransferred: false,
    candidateId: report.candidateId,
    complete: report.complete,
    dataOnly: true,
    eligibleCases: report.eligibleCases,
    historicalOnly: true,
    lineageId: report.lineageId,
    lineageType: report.lineageType,
    mode: report.mode,
    productionEligible: false,
    proofEligibleCases: report.proofEligibleCases,
    proven: report.proven,
    results: objectFreeze(arrayMap(report.results, copyLineageResult)),
    skippedCases: report.skippedCases,
    successRate: report.successRate,
    successes: report.successes,
    weaknessesExposed: report.weaknessesExposed
  });
}

function sameResultSuite(left, right) {
  return left.length === right.length
    && arrayEvery(left, (result, index) => result.caseId === right[index].caseId);
}

export class AdversarialLineageEnsembleReport {
  constructor({
    ensembleId,
    candidateId,
    lineages,
    token
  }) {
    if (
      token !== ENSEMBLE_REPORT_TOKEN
      || !arrayIsArray(lineages)
      || lineages.length < MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE
      || !arrayEvery(lineages, (lineage) => isPlainObject(lineage))
    ) {
      throw new TypeError('Adversarial lineage ensemble reports require the trusted runner path');
    }
    this.ensembleId = requireNonEmptyString(ensembleId, 'Adversarial lineage ensemble id');
    this.candidateId = requireNonEmptyString(
      candidateId,
      'Adversarial lineage ensemble candidate id'
    );
    this.lineageType = ADVERSARIAL_LINEAGE_TYPES.SKEPTIC;
    this.mode = POLICY_MODES.SKEPTIC;
    this.lineages = objectFreeze(arraySlice(lineages));
    this.lineageCount = this.lineages.length;
    const first = this.lineages[0];
    this.eligibleCases = first.eligibleCases;
    this.attemptedCases = first.attemptedCases;
    this.skippedCases = first.skippedCases;
    this.evaluatedCases = this.attemptedCases * this.lineageCount;
    this.eligibleEvaluations = this.eligibleCases * this.lineageCount;
    let successes = 0;
    let proofEligibleCases = 0;
    let proven = 0;
    arrayForEach(this.lineages, (lineage) => {
      successes += lineage.successes;
      proofEligibleCases += lineage.proofEligibleCases;
      proven += lineage.proven;
    });
    this.successes = successes;
    this.proofEligibleCases = proofEligibleCases;
    this.proven = proven;
    this.adversarialCases = this.evaluatedCases;
    this.adversarialSuccesses = this.successes;
    this.weaknessesExposed = this.adversarialCases - this.adversarialSuccesses;
    this.successRate = this.evaluatedCases === 0
      ? 0
      : this.successes / this.evaluatedCases;
    this.adversarialSuccessRate = this.adversarialCases === 0
      ? null
      : this.adversarialSuccesses / this.adversarialCases;
    this.complete = arrayEvery(this.lineages, (lineage) => lineage.complete);
    this.independent = true;
    this.dataOnly = true;
    this.historicalOnly = true;
    this.productionEligible = false;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_ADVERSARIAL_LINEAGE_ENSEMBLE_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAdversarialLineageEnsembleReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_ADVERSARIAL_LINEAGE_ENSEMBLE_REPORTS, report)
    && objectGetPrototypeOf(report) === AdversarialLineageEnsembleReport.prototype;
}

export class AdversarialLineageEnsembleRunner {
  constructor(options = {}) {
    requireDataObject(options, 'Adversarial lineage ensemble options', ENSEMBLE_OPTIONS_KEYS);
    const {
      ensembleId = 'skeptic-lineage-ensemble',
      lineageFactory = (index) => new AdversarialLineageRunner({
        lineageId: `skeptic-lineage-ensemble:${index + 1}`
      }),
      maxLineages = MAX_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE
    } = options;
    this.ensembleId = requireNonEmptyString(
      ensembleId,
      'Adversarial lineage ensemble id'
    );
    this.lineageFactory = requireFactory(
      lineageFactory,
      'Adversarial lineage ensemble lineageFactory'
    );
    if (
      !isSafeInteger(maxLineages)
      || maxLineages < MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE
      || maxLineages > MAX_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE
    ) {
      throw new RangeError(
        `Adversarial lineage ensemble maxLineages must be between `
        + `${MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE} and ${MAX_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE}`
      );
    }
    this.maxLineages = maxLineages;
    weakSetAdd(TRUSTED_ADVERSARIAL_LINEAGE_ENSEMBLE_RUNNERS, this);
    objectFreeze(this);
  }

  run(options = {}) {
    if (!isTrustedAdversarialLineageEnsembleRunner(this)) {
      throw new TypeError('Adversarial lineage ensemble requires an exact trusted runner');
    }
    requireDataObject(
      options,
      'Adversarial lineage ensemble run options',
      ENSEMBLE_RUN_KEYS
    );
    const {
      candidateId,
      cases,
      budget = null,
      executionOptions = {},
      lineageCount = MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE
    } = options;
    const normalizedCandidateId = requireNonEmptyString(
      candidateId,
      'Adversarial lineage ensemble candidate id'
    );
    if (
      !isSafeInteger(lineageCount)
      || lineageCount < MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE
      || lineageCount > this.maxLineages
    ) {
      throw new RangeError(
        `Adversarial lineage ensemble lineageCount must be between `
        + `${MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE} and ${this.maxLineages}`
      );
    }
    if (!arrayIsArray(cases) || cases.length === 0) {
      throw new TypeError('Adversarial lineage ensemble requires evaluation cases');
    }
    const normalizedCases = arrayMap(cases, (evaluationCase) => {
      if (!isTrustedEvaluationCase(evaluationCase)) {
        throw new TypeError('Adversarial lineage ensemble cases must be trusted EvaluationCase instances');
      }
      return evaluationCase;
    });
    if (!arraySome(normalizedCases, (evaluationCase) => evaluationCase.adversarial)) {
      throw new TypeError('Adversarial lineage ensemble requires adversarial evaluation cases');
    }
    if (budget !== null && !isTrustedEvaluationBudget(budget)) {
      throw new TypeError('Adversarial lineage ensemble budget must be trusted');
    }
    if (!isPlainObject(executionOptions) || arrayIsArray(executionOptions)) {
      throw new TypeError('Adversarial lineage ensemble executionOptions must be an object');
    }

    const lineages = [];
    for (let index = 0; index < lineageCount; index += 1) {
      const lineage = this.lineageFactory(index);
      if (!isTrustedAdversarialLineageRunner(lineage)) {
        throw new TypeError(
          'Adversarial lineage ensemble lineageFactory must return a trusted lineage runner'
        );
      }
      if (weakSetHas(USED_ADVERSARIAL_LINEAGE_RUNNERS, lineage)) {
        throw new TypeError('Adversarial lineage ensemble lineage runner cannot be reused');
      }
      weakSetAdd(USED_ADVERSARIAL_LINEAGE_RUNNERS, lineage);
      const report = lineage.run({
        candidateId: normalizedCandidateId,
        cases: normalizedCases,
        budget,
        executionOptions
      });
      if (!isTrustedAdversarialLineageReport(report)) {
        throw new TypeError('Adversarial lineage ensemble received an untrusted lineage report');
      }
      if (
        report.candidateId !== normalizedCandidateId
        || report.mode !== POLICY_MODES.SKEPTIC
        || report.lineageType !== ADVERSARIAL_LINEAGE_TYPES.SKEPTIC
      ) {
        throw new TypeError('Adversarial lineage ensemble lineage identity is inconsistent');
      }
      const summary = copyLineageReport(report);
      if (lineages.length > 0) {
        const first = lineages[0];
        if (
          summary.candidateId !== first.candidateId
          || summary.eligibleCases !== first.eligibleCases
          || summary.attemptedCases !== first.attemptedCases
          || !sameResultSuite(summary.results, first.results)
        ) {
          throw new TypeError('Adversarial lineage ensemble case suite is inconsistent');
        }
      }
      arrayPush(lineages, summary);
    }
    if (setSize(setFromArray(arrayMap(lineages, ({ lineageId }) => lineageId))) !== lineages.length) {
      throw new TypeError('Adversarial lineage ensemble lineage ids must be unique');
    }
    return new AdversarialLineageEnsembleReport({
      ensembleId: this.ensembleId,
      candidateId: normalizedCandidateId,
      lineages,
      token: ENSEMBLE_REPORT_TOKEN
    });
  }
}

export function isTrustedAdversarialLineageEnsembleRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_ADVERSARIAL_LINEAGE_ENSEMBLE_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === AdversarialLineageEnsembleRunner.prototype;
}

objectFreeze(AdversarialLineageEnsembleReport.prototype);
objectFreeze(AdversarialLineageEnsembleRunner.prototype);
