import {
  EvaluationBudget,
  EvaluationRunner,
  POLICY_MODES,
  isTrustedEvaluationBudget,
  isTrustedEvaluationCase,
  isTrustedEvaluationRunner
} from './evaluation.mjs';
import { isTrustedHarness, FluidHarness } from './harness.mjs';
import {
  arrayEvery,
  arrayFilter,
  arrayForEach,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arraySlice,
  isFiniteNumber,
  isFrozenObject,
  isInstanceOf,
  isPlainObject,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  reflectOwnKeys,
  setFromArray,
  setSize,
  stringFrom,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const ADVERSARIAL_LINEAGE_TYPES = objectFreeze({
  SKEPTIC: 'skeptic'
});

export const MAX_ADVERSARIAL_LINEAGE_CASES = 64;

const LINEAGE_OPTIONS_KEYS = objectFreeze(['lineageId', 'runnerFactory']);
const LINEAGE_RUN_KEYS = objectFreeze([
  'candidateId',
  'cases',
  'budget',
  'executionOptions'
]);
const LINEAGE_RESULT_KEYS = objectFreeze([
  'caseId',
  'domain',
  'representation',
  'proven',
  'expected',
  'success',
  'requiresProof',
  'adversarial',
  'surpriseNats',
  'surpriseBand',
  'verifierId',
  'error'
]);
const TRUSTED_ADVERSARIAL_LINEAGE_RUNNERS = weakSetCreate();
const TRUSTED_ADVERSARIAL_LINEAGE_REPORTS = weakSetCreate();
const USED_EVALUATION_RUNNERS = weakSetCreate();
const USED_EVALUATION_HARNESSES = weakSetCreate();
const ADVERSARIAL_LINEAGE_REPORT_TOKEN = objectFreeze({});

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

function errorMessage(error) {
  return isInstanceOf(error, Error) ? error.message : stringFrom(error);
}

function exactDataObject(value, field, allowedKeys) {
  requireDataObject(value, field, allowedKeys);
  const keys = reflectOwnKeys(value);
  if (
    keys.length !== allowedKeys.length
    || !arrayEvery(allowedKeys, (key) => arrayIncludes(keys, key))
  ) {
    throw new TypeError(`${field} must contain exactly the expected data fields`);
  }
  return value;
}

function normalizeLineageResult(result, index) {
  exactDataObject(result, `Adversarial lineage result ${index}`, LINEAGE_RESULT_KEYS);
  if (typeof result.caseId !== 'string' || stringTrim(result.caseId) === '') {
    throw new TypeError(`Adversarial lineage result ${index} caseId is invalid`);
  }
  if (typeof result.domain !== 'string' || stringTrim(result.domain) === '') {
    throw new TypeError(`Adversarial lineage result ${index} domain is invalid`);
  }
  if (result.representation !== null && typeof result.representation !== 'string') {
    throw new TypeError(`Adversarial lineage result ${index} representation is invalid`);
  }
  if (
    typeof result.proven !== 'boolean'
    || typeof result.expected !== 'boolean'
    || typeof result.success !== 'boolean'
    || typeof result.requiresProof !== 'boolean'
    || result.adversarial !== true
  ) {
    throw new TypeError(`Adversarial lineage result ${index} flags are invalid`);
  }
  if (
    result.surpriseNats !== null
    && (!isFiniteNumber(result.surpriseNats) || result.surpriseNats < 0)
  ) {
    throw new TypeError(`Adversarial lineage result ${index} surprise is invalid`);
  }
  if (result.surpriseBand !== null && typeof result.surpriseBand !== 'string') {
    throw new TypeError(`Adversarial lineage result ${index} surprise band is invalid`);
  }
  if (result.verifierId !== null && typeof result.verifierId !== 'string') {
    throw new TypeError(`Adversarial lineage result ${index} verifier is invalid`);
  }
  if (result.error !== null && typeof result.error !== 'string') {
    throw new TypeError(`Adversarial lineage result ${index} error is invalid`);
  }
  return objectFreeze({
    caseId: stringTrim(result.caseId),
    domain: stringTrim(result.domain),
    representation: result.representation,
    proven: result.proven,
    expected: result.expected,
    success: result.success,
    requiresProof: result.requiresProof,
    adversarial: true,
    surpriseNats: result.surpriseNats,
    surpriseBand: result.surpriseBand,
    verifierId: result.verifierId,
    error: result.error
  });
}

function reportSummary(report, candidateId, expectedEligibleCases) {
  if (
    typeof report !== 'object'
    || report === null
    || !isFrozenObject(report)
    || report.mode !== POLICY_MODES.SKEPTIC
    || report.candidateId !== candidateId
    || !arrayIsArray(report.results)
    || report.eligibleCases !== expectedEligibleCases
    || report.attemptedCases !== report.results.length
    || report.skippedCases !== report.eligibleCases - report.attemptedCases
    || report.complete !== (report.skippedCases === 0)
  ) {
    throw new TypeError('Adversarial lineage received an invalid skeptic evaluation report');
  }
  const results = arrayMap(report.results, normalizeLineageResult);
  if (setSize(setFromArray(arrayMap(results, ({ caseId }) => caseId))) !== results.length) {
    throw new TypeError('Adversarial lineage result case IDs must be unique');
  }
  const adversarialCases = results.length;
  const successes = arrayFilter(results, (result) => result.success).length;
  const proven = arrayFilter(
    results,
    (result) => result.requiresProof && result.proven
  ).length;
  const proofEligibleCases = arrayFilter(results, (result) => result.requiresProof).length;
  const adversarialSuccesses = successes;
  const weaknessesExposed = adversarialCases - adversarialSuccesses;
  if (
    report.adversarialCases !== adversarialCases
    || report.adversarialSuccesses !== adversarialSuccesses
    || report.weaknessesExposed !== weaknessesExposed
    || report.successes !== successes
    || report.proven !== proven
    || report.proofEligibleCases !== proofEligibleCases
  ) {
    throw new TypeError('Adversarial lineage skeptic report metrics are inconsistent');
  }
  return {
    results,
    attemptedCases: results.length,
    skippedCases: report.skippedCases,
    eligibleCases: expectedEligibleCases,
    successes,
    proven,
    proofEligibleCases,
    adversarialCases,
    adversarialSuccesses,
    weaknessesExposed,
    complete: report.complete
  };
}

export class AdversarialLineageReport {
  constructor({ lineageId, candidateId, summary, token }) {
    if (token !== ADVERSARIAL_LINEAGE_REPORT_TOKEN) {
      throw new TypeError('Adversarial lineage reports require the trusted runner path');
    }
    this.lineageId = requireNonEmptyString(lineageId, 'Adversarial lineage id');
    this.candidateId = requireNonEmptyString(candidateId, 'Adversarial lineage candidate id');
    this.lineageType = ADVERSARIAL_LINEAGE_TYPES.SKEPTIC;
    this.mode = POLICY_MODES.SKEPTIC;
    this.results = objectFreeze(arraySlice(summary.results));
    this.eligibleCases = summary.eligibleCases;
    this.attemptedCases = summary.attemptedCases;
    this.skippedCases = summary.skippedCases;
    this.successes = summary.successes;
    this.proofEligibleCases = summary.proofEligibleCases;
    this.proven = summary.proven;
    this.adversarialCases = summary.adversarialCases;
    this.adversarialSuccesses = summary.adversarialSuccesses;
    this.weaknessesExposed = summary.weaknessesExposed;
    this.successRate = this.attemptedCases === 0
      ? 0
      : this.successes / this.attemptedCases;
    this.adversarialSuccessRate = this.adversarialCases === 0
      ? null
      : this.adversarialSuccesses / this.adversarialCases;
    this.complete = summary.complete;
    this.dataOnly = true;
    this.historicalOnly = true;
    this.productionEligible = false;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_ADVERSARIAL_LINEAGE_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAdversarialLineageReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_ADVERSARIAL_LINEAGE_REPORTS, report)
    && isFrozenObject(report)
    && objectGetPrototypeOf(report) === AdversarialLineageReport.prototype;
}

export class AdversarialLineageRunner {
  constructor(options = {}) {
    requireDataObject(options, 'Adversarial lineage options', LINEAGE_OPTIONS_KEYS);
    const {
      lineageId = 'skeptic-lineage',
      runnerFactory = () => new EvaluationRunner({ harness: new FluidHarness() })
    } = options;
    this.lineageId = requireNonEmptyString(lineageId, 'Adversarial lineage id');
    this.runnerFactory = requireFactory(
      runnerFactory,
      'Adversarial lineage runnerFactory'
    );
    weakSetAdd(TRUSTED_ADVERSARIAL_LINEAGE_RUNNERS, this);
    objectFreeze(this);
  }

  run(options = {}) {
    if (!isTrustedAdversarialLineageRunner(this)) {
      throw new TypeError('Adversarial lineage requires an exact trusted runner');
    }
    requireDataObject(options, 'Adversarial lineage run options', LINEAGE_RUN_KEYS);
    const {
      candidateId,
      cases,
      budget = null,
      executionOptions = {}
    } = options;
    const normalizedCandidateId = requireNonEmptyString(
      candidateId,
      'Adversarial lineage candidate id'
    );
    if (!arrayIsArray(cases) || cases.length === 0) {
      throw new TypeError('Adversarial lineage requires at least one evaluation case');
    }
    if (cases.length > MAX_ADVERSARIAL_LINEAGE_CASES) {
      throw new RangeError(
        `Adversarial lineage cannot contain more than ${MAX_ADVERSARIAL_LINEAGE_CASES} cases`
      );
    }
    const normalizedCases = arrayMap(cases, (evaluationCase) => {
      if (!isTrustedEvaluationCase(evaluationCase)) {
        throw new TypeError('Adversarial lineage cases must be trusted EvaluationCase instances');
      }
      return evaluationCase;
    });
    if (setSize(setFromArray(arrayMap(normalizedCases, ({ id }) => id))) !== normalizedCases.length) {
      throw new TypeError('Adversarial lineage case ids must be unique');
    }
    const adversarialCases = arrayFilter(
      normalizedCases,
      (evaluationCase) => evaluationCase.adversarial
    );
    if (adversarialCases.length === 0) {
      throw new TypeError('Adversarial lineage requires adversarial evaluation cases');
    }
    const normalizedBudget = budget === null
      ? new EvaluationBudget({ maxCases: adversarialCases.length })
      : budget;
    if (!isTrustedEvaluationBudget(normalizedBudget)) {
      throw new TypeError('Adversarial lineage requires a trusted EvaluationBudget');
    }
    if (normalizedBudget.maxCases > MAX_ADVERSARIAL_LINEAGE_CASES) {
      throw new RangeError(
        `Adversarial lineage budget cannot exceed ${MAX_ADVERSARIAL_LINEAGE_CASES} cases`
      );
    }
    if (!isPlainObject(executionOptions) || arrayIsArray(executionOptions)) {
      throw new TypeError('Adversarial lineage executionOptions must be an object');
    }

    const evaluationRunner = this.runnerFactory();
    if (!isTrustedEvaluationRunner(evaluationRunner)) {
      throw new TypeError('Adversarial lineage runnerFactory must return a trusted EvaluationRunner');
    }
    if (weakSetHas(USED_EVALUATION_RUNNERS, evaluationRunner)) {
      throw new TypeError('Adversarial lineage evaluation runner cannot be reused');
    }
    if (!isTrustedHarness(evaluationRunner.harness)) {
      throw new TypeError('Adversarial lineage evaluation runner must own a trusted harness');
    }
    if (weakSetHas(USED_EVALUATION_HARNESSES, evaluationRunner.harness)) {
      throw new TypeError('Adversarial lineage evaluation harness cannot be reused');
    }
    weakSetAdd(USED_EVALUATION_RUNNERS, evaluationRunner);
    weakSetAdd(USED_EVALUATION_HARNESSES, evaluationRunner.harness);

    const report = evaluationRunner.evaluate({
      candidateId: normalizedCandidateId,
      cases: normalizedCases,
      mode: POLICY_MODES.SKEPTIC,
      budget: normalizedBudget,
      executionOptions
    });
    const summary = reportSummary(report, normalizedCandidateId, adversarialCases.length);
    return new AdversarialLineageReport({
      lineageId: this.lineageId,
      candidateId: normalizedCandidateId,
      summary,
      token: ADVERSARIAL_LINEAGE_REPORT_TOKEN
    });
  }
}

export function isTrustedAdversarialLineageRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_ADVERSARIAL_LINEAGE_RUNNERS, runner)
    && isFrozenObject(runner)
    && objectGetPrototypeOf(runner) === AdversarialLineageRunner.prototype;
}

objectFreeze(AdversarialLineageReport.prototype);
objectFreeze(AdversarialLineageRunner.prototype);
