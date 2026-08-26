import {
  EvaluationBudget,
  EvaluationRunner,
  POLICY_MODES,
  isTrustedEvaluationCase,
  isTrustedEvaluationRunner
} from './evaluation.mjs';
import { sameInput } from './executor.mjs';
import { isTrustedHarness } from './harness.mjs';
import {
  arrayEvery,
  arrayFilter,
  arrayForEach,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arraySlice,
  isFrozenObject,
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

export const MAX_DISTRIBUTION_SHIFT_CASES = 8;
export const MIN_DISTRIBUTION_SHIFT_CASES = 1;

export const DISTRIBUTION_SHIFT_STATUSES = objectFreeze({
  ROBUST: 'robust',
  WEAKNESS_EXPOSED: 'weakness-exposed',
  BASELINE_FAILED: 'baseline-failed'
});

const SHIFT_OPTIONS_KEYS = objectFreeze([
  'maxShifts',
  'runnerFactory',
  'suiteId'
]);
const SHIFT_RUN_KEYS = objectFreeze([
  'baselineCase',
  'candidateId',
  'executionOptions',
  'shiftCases'
]);
const TRUSTED_DISTRIBUTION_SHIFT_RUNNERS = weakSetCreate();
const TRUSTED_DISTRIBUTION_SHIFT_REPORTS = weakSetCreate();
const USED_DISTRIBUTION_SHIFT_RUNNERS = weakSetCreate();
const USED_DISTRIBUTION_SHIFT_HARNESSES = weakSetCreate();
const DISTRIBUTION_SHIFT_REPORT_TOKEN = objectFreeze({});

function requireDataObject(value, field, allowedKeys = null) {
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
      || (allowedKeys !== null && !arrayIncludes(allowedKeys, key))
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

function normalizeResult(result, evaluationCase, role) {
  if (
    !isFrozenObject(result)
    || result.caseId !== evaluationCase.id
    || result.domain !== evaluationCase.domain
    || result.adversarial !== evaluationCase.adversarial
    || result.requiresProof !== evaluationCase.requiresProof
  ) {
    throw new TypeError('Distribution-shift runner received an inconsistent evaluation result');
  }
  return objectFreeze({
    role,
    caseId: result.caseId,
    domain: result.domain,
    representation: result.representation,
    proven: result.proven,
    expected: result.expected,
    success: result.success,
    requiresProof: result.requiresProof,
    adversarial: result.adversarial,
    surpriseNats: result.surpriseNats,
    surpriseBand: result.surpriseBand,
    verifierId: result.verifierId,
    error: result.error
  });
}

function evaluateFreshCase(runner, evaluationCase, role, executionOptions) {
  const report = runner.evaluate({
    candidateId: 'distribution-shift-case',
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 1 }),
    executionOptions
  });
  if (
    !isFrozenObject(report)
    || report.mode !== POLICY_MODES.RESEARCH
    || report.eligibleCases !== 1
    || report.attemptedCases !== 1
    || report.results.length !== 1
  ) {
    throw new TypeError('Distribution-shift runner received an invalid evaluation report');
  }
  return normalizeResult(report.results[0], evaluationCase, role);
}

function requireFreshRunner(factory, index) {
  const runner = factory(index);
  if (!isTrustedEvaluationRunner(runner)) {
    throw new TypeError(
      'Distribution-shift runnerFactory must return a trusted EvaluationRunner'
    );
  }
  if (weakSetHas(USED_DISTRIBUTION_SHIFT_RUNNERS, runner)) {
    throw new TypeError('Distribution-shift evaluation runner cannot be reused');
  }
  if (!isTrustedHarness(runner.harness)) {
    throw new TypeError('Distribution-shift evaluation runner must own a trusted harness');
  }
  if (weakSetHas(USED_DISTRIBUTION_SHIFT_HARNESSES, runner.harness)) {
    throw new TypeError('Distribution-shift evaluation harness cannot be reused');
  }
  weakSetAdd(USED_DISTRIBUTION_SHIFT_RUNNERS, runner);
  weakSetAdd(USED_DISTRIBUTION_SHIFT_HARNESSES, runner.harness);
  return runner;
}

function requireCaseSuite(baselineCase, shiftCases, maxShifts) {
  if (!isTrustedEvaluationCase(baselineCase)) {
    throw new TypeError('Distribution-shift baselineCase must be trusted');
  }
  if (!arrayIsArray(shiftCases) || shiftCases.length < MIN_DISTRIBUTION_SHIFT_CASES) {
    throw new TypeError('Distribution-shift requires at least one shift case');
  }
  if (shiftCases.length > maxShifts) {
    throw new RangeError(`Distribution-shift cannot contain more than ${maxShifts} cases`);
  }
  if (!baselineCase.requiresProof) {
    throw new TypeError('Distribution-shift baseline case must require proof');
  }
  const allCases = [baselineCase];
  arrayForEach(shiftCases, (evaluationCase) => {
    if (!isTrustedEvaluationCase(evaluationCase)) {
      throw new TypeError('Distribution-shift cases must be trusted EvaluationCase instances');
    }
    if (!evaluationCase.requiresProof) {
      throw new TypeError('Distribution-shift cases must require proof');
    }
    if (!evaluationCase.adversarial) {
      throw new TypeError('Distribution-shift cases must be adversarial');
    }
    if (
      evaluationCase.task.id !== baselineCase.task.id
      || evaluationCase.task.description !== baselineCase.task.description
    ) {
      throw new TypeError('Distribution-shift cases must preserve the baseline task contract');
    }
    if (sameInput(evaluationCase.input, baselineCase.input)) {
      throw new TypeError('Distribution-shift cases must change the baseline input');
    }
    arrayPush(allCases, evaluationCase);
  });
  if (setSize(setFromArray(arrayMap(allCases, ({ id }) => id))) !== allCases.length) {
    throw new TypeError('Distribution-shift case ids must be unique');
  }
  return allCases;
}

export class DistributionShiftReport {
  constructor({ suiteId, candidateId, baseline, shifts, token }) {
    if (
      token !== DISTRIBUTION_SHIFT_REPORT_TOKEN
      || !isFrozenObject(baseline)
      || !arrayIsArray(shifts)
      || shifts.length < MIN_DISTRIBUTION_SHIFT_CASES
      || !arrayEvery(shifts, (shift) => isFrozenObject(shift))
    ) {
      throw new TypeError('Distribution-shift reports require the trusted runner path');
    }
    this.suiteId = requireNonEmptyString(suiteId, 'Distribution-shift suite id');
    this.candidateId = requireNonEmptyString(
      candidateId,
      'Distribution-shift candidate id'
    );
    this.taskId = requireNonEmptyString(baseline.taskId, 'Distribution-shift task id');
    this.domain = requireNonEmptyString(baseline.domain, 'Distribution-shift domain');
    this.baseline = baseline;
    this.shifts = objectFreeze(arraySlice(shifts));
    this.shiftCount = this.shifts.length;
    this.attemptedCases = this.shiftCount + 1;
    this.successes = (baseline.success ? 1 : 0)
      + arrayFilter(this.shifts, (shift) => shift.success).length;
    this.baselineSuccess = baseline.success;
    this.shiftSuccesses = arrayFilter(this.shifts, (shift) => shift.success).length;
    this.weaknessesExposed = this.shiftCount - this.shiftSuccesses;
    this.successRate = this.successes / this.attemptedCases;
    this.shiftSuccessRate = this.shiftSuccesses / this.shiftCount;
    this.status = !this.baselineSuccess
      ? DISTRIBUTION_SHIFT_STATUSES.BASELINE_FAILED
      : this.weaknessesExposed > 0
        ? DISTRIBUTION_SHIFT_STATUSES.WEAKNESS_EXPOSED
        : DISTRIBUTION_SHIFT_STATUSES.ROBUST;
    this.robust = this.status === DISTRIBUTION_SHIFT_STATUSES.ROBUST;
    this.requiresReview = !this.robust;
    this.complete = true;
    this.independent = true;
    this.evidence = 'OBSERVED';
    this.dataOnly = true;
    this.historicalOnly = true;
    this.productionEligible = false;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_DISTRIBUTION_SHIFT_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedDistributionShiftReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_DISTRIBUTION_SHIFT_REPORTS, report)
    && isFrozenObject(report)
    && objectGetPrototypeOf(report) === DistributionShiftReport.prototype;
}

export class DistributionShiftRunner {
  constructor(options = {}) {
    requireDataObject(options, 'Distribution-shift options', SHIFT_OPTIONS_KEYS);
    const {
      suiteId = 'distribution-shift-suite',
      runnerFactory = () => new EvaluationRunner(),
      maxShifts = MAX_DISTRIBUTION_SHIFT_CASES
    } = options;
    this.suiteId = requireNonEmptyString(suiteId, 'Distribution-shift suite id');
    this.runnerFactory = requireFactory(
      runnerFactory,
      'Distribution-shift runnerFactory'
    );
    if (
      typeof maxShifts !== 'number'
      || !isSafeInteger(maxShifts)
      || maxShifts < MIN_DISTRIBUTION_SHIFT_CASES
      || maxShifts > MAX_DISTRIBUTION_SHIFT_CASES
    ) {
      throw new RangeError(
        `Distribution-shift maxShifts must be between `
        + `${MIN_DISTRIBUTION_SHIFT_CASES} and ${MAX_DISTRIBUTION_SHIFT_CASES}`
      );
    }
    this.maxShifts = maxShifts;
    weakSetAdd(TRUSTED_DISTRIBUTION_SHIFT_RUNNERS, this);
    objectFreeze(this);
  }

  run(options = {}) {
    if (!isTrustedDistributionShiftRunner(this)) {
      throw new TypeError('Distribution-shift requires an exact trusted runner');
    }
    requireDataObject(options, 'Distribution-shift run options', SHIFT_RUN_KEYS);
    const {
      candidateId,
      baselineCase,
      shiftCases,
      executionOptions = {}
    } = options;
    const normalizedCandidateId = requireNonEmptyString(
      candidateId,
      'Distribution-shift candidate id'
    );
    requireDataObject(executionOptions, 'Distribution-shift executionOptions');
    const allCases = requireCaseSuite(baselineCase, shiftCases, this.maxShifts);
    const baseline = allCases[0];
    const baselineRunner = requireFreshRunner(this.runnerFactory, 0);
    const baselineResult = evaluateFreshCase(
      baselineRunner,
      baseline,
      'baseline',
      executionOptions
    );
    const normalizedBaseline = objectFreeze({
      ...baselineResult,
      taskId: baseline.task.id
    });
    const shifts = [];
    arrayForEach(arraySlice(allCases, 1), (evaluationCase, index) => {
      const runner = requireFreshRunner(this.runnerFactory, index + 1);
      const result = evaluateFreshCase(
        runner,
        evaluationCase,
        'shift',
        executionOptions
      );
      arrayPush(shifts, objectFreeze({
        ...result,
        taskId: baseline.task.id
      }));
    });
    return new DistributionShiftReport({
      suiteId: this.suiteId,
      candidateId: normalizedCandidateId,
      baseline: normalizedBaseline,
      shifts,
      token: DISTRIBUTION_SHIFT_REPORT_TOKEN
    });
  }
}

export function isTrustedDistributionShiftRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_DISTRIBUTION_SHIFT_RUNNERS, runner)
    && isFrozenObject(runner)
    && objectGetPrototypeOf(runner) === DistributionShiftRunner.prototype;
}

objectFreeze(DistributionShiftReport.prototype);
objectFreeze(DistributionShiftRunner.prototype);
