import { EVIDENCE_LEVELS } from './evidence.mjs';
import {
  arrayCreate,
  arrayEvery,
  arrayFilter,
  arrayForEach,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arraySlice,
  arraySort,
  isFiniteNumber,
  isFrozenObject,
  isInstanceOf,
  isPlainObject,
  isSafeInteger,
  mapFromEntries,
  mapGet,
  maxNumber,
  objectDefineProperty,
  objectEntries,
  objectFreeze,
  objectFromEntries,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectIs,
  objectValues,
  reflectOwnKeys,
  setAdd,
  setFromArray,
  setHas,
  setSize,
  stringFrom,
  stringTrim,
  toBoolean,
  weakMapCreate,
  weakMapGet,
  weakMapHas,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';
import {
  FluidHarness,
  isTrustedActionReport,
  isTrustedHarness,
  isTrustedPlan
} from './harness.mjs';
import { SURPRISE_BANDS } from './world-model.mjs';

export const POLICY_MODES = objectFreeze({
  PRODUCTION: 'production',
  RESEARCH: 'research',
  SKEPTIC: 'skeptic'
});

const TRUSTED_EVALUATION_REPORTS = weakSetCreate();
const TRUSTED_EVALUATION_SUITES = weakMapCreate();
const TRUSTED_EVALUATION_ACTION_REPORTS = weakMapCreate();
const TRUSTED_EVALUATION_RUNNERS = weakSetCreate();
const TRUSTED_EVALUATION_BUDGETS = weakSetCreate();
const TRUSTED_EVALUATION_CASES = weakSetCreate();
const TRUSTED_PROMOTION_AUTHORITIES = weakSetCreate();

function isTrustedEvaluationReport(report) {
  return typeof report === 'object'
    && report !== null
    && isFrozenObject(report)
    && weakSetHas(TRUSTED_EVALUATION_REPORTS, report);
}

function sameEvaluationSuite(primary, skeptic) {
  const primarySuite = weakMapGet(TRUSTED_EVALUATION_SUITES, primary);
  const skepticSuite = weakMapGet(TRUSTED_EVALUATION_SUITES, skeptic);
  return arrayIsArray(primarySuite)
    && arrayIsArray(skepticSuite)
    && primarySuite.length === skepticSuite.length
    && arrayEvery(primarySuite, (evaluationCase, index) => evaluationCase === skepticSuite[index]);
}

function sameEvaluationEvidence(primary, skeptic) {
  const fields = [
    'caseId',
    'domain',
    'representation',
    'proven',
    'expected',
    'success',
    'requiresProof',
    'adversarial',
    'verifierId',
    'error'
  ];
  const primaryResults = mapFromEntries(arrayMap(primary.results, (result) => [result.caseId, result]));
  return arrayEvery(skeptic.results, (skepticResult) => {
    const primaryResult = mapGet(primaryResults, skepticResult.caseId);
    return primaryResult !== undefined
      && arrayEvery(fields, (field) => objectIs(primaryResult[field], skepticResult[field]));
  });
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requireRate(value, field) {
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    throw new RangeError(`${field} must be between 0 and 1`);
  }
  return value;
}

function requireEnumerableDataProperties(value, message) {
  arrayForEach(reflectOwnKeys(value), (key) => {
    if (arrayIsArray(value) && key === 'length') {
      return;
    }
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !descriptor?.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(message);
    }
  });
}

function copyAndFreeze(value, seen = weakMapCreate()) {
  if (typeof value === 'function') {
    throw new TypeError('Evaluation snapshot values must not contain functions');
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (weakMapHas(seen, value)) {
    return weakMapGet(seen, value);
  }

  if (!arrayIsArray(value) && !isPlainObject(value)) {
    throw new TypeError('Evaluation snapshot values must use plain objects and arrays');
  }

  arrayForEach(reflectOwnKeys(value), (key) => {
    if (arrayIsArray(value) && key === 'length') {
      return;
    }
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !descriptor?.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(
        'Evaluation snapshot values must contain only enumerable data properties'
      );
    }
  });

  const copy = arrayIsArray(value) ? arrayCreate(value.length) : {};
  weakMapSet(seen, value, copy);
  arrayForEach(objectEntries(value), (entry) => {
    const key = entry[0];
    const nestedValue = entry[1];
    objectDefineProperty(copy, key, {
      value: copyAndFreeze(nestedValue, seen),
      enumerable: true,
      writable: true,
      configurable: true
    });
  });
  return objectFreeze(copy);
}

function evaluateExpectation(evaluationCase, report, error) {
  try {
    return toBoolean(evaluationCase.expected(report, error));
  } catch {
    return false;
  }
}

export class EvaluationBudget {
  constructor({ maxCases }) {
    if (!isSafeInteger(maxCases) || maxCases <= 0) {
      throw new TypeError(
        'Evaluation budget maxCases must be a positive integer (safe integer required)'
      );
    }

    this.maxCases = maxCases;
    weakSetAdd(TRUSTED_EVALUATION_BUDGETS, this);
    objectFreeze(this);
  }
}

export class EvaluationCase {
  constructor({
    id,
    domain,
    task,
    input,
    expected,
    productionEligible = true,
    adversarial = false,
    requiresProof = true
  }) {
    this.id = requireNonEmptyString(id, 'Evaluation case id');
    this.domain = requireNonEmptyString(domain, 'Evaluation case domain');
    if (!task || typeof task !== 'object') {
      throw new TypeError('Evaluation case task must be an object');
    }
    if (typeof expected !== 'function') {
      throw new TypeError('Evaluation case expected must be a function');
    }

    requireEnumerableDataProperties(
      task,
      'Evaluation snapshot values must contain only enumerable data properties'
    );
    this.task = copyAndFreeze({ ...task });
    this.input = copyAndFreeze(input);
    this.expected = expected;
    this.productionEligible = toBoolean(productionEligible);
    this.adversarial = toBoolean(adversarial);
    this.requiresProof = toBoolean(requiresProof);
    weakSetAdd(TRUSTED_EVALUATION_CASES, this);
    objectFreeze(this);
  }
}

export function isTrustedEvaluationBudget(budget) {
  return typeof budget === 'object'
    && budget !== null
    && weakSetHas(TRUSTED_EVALUATION_BUDGETS, budget)
    && objectGetPrototypeOf(budget) === EvaluationBudget.prototype;
}

export function isTrustedEvaluationCase(evaluationCase) {
  return typeof evaluationCase === 'object'
    && evaluationCase !== null
    && weakSetHas(TRUSTED_EVALUATION_CASES, evaluationCase)
    && objectGetPrototypeOf(evaluationCase) === EvaluationCase.prototype;
}

function transferMatrixFor(results) {
  const domainSet = setFromArray([]);
  const domains = [];
  arrayForEach(arrayMap(results, ({ domain }) => domain), (domain) => {
    if (!setHas(domainSet, domain)) {
      setAdd(domainSet, domain);
      arrayPush(domains, domain);
    }
  });
  arraySort(domains);
  return objectFreeze(objectFromEntries(arrayMap(domains, (domain) => {
    const domainResults = arrayFilter(results, (result) => result.domain === domain);
    const successes = arrayFilter(domainResults, (result) => result.success).length;
    const proofResults = arrayFilter(domainResults, (result) => result.requiresProof);
    const proven = arrayFilter(proofResults, (result) => result.proven).length;
    return [domain, objectFreeze({
      cases: domainResults.length,
      successes,
      successRate: domainResults.length === 0 ? 0 : successes / domainResults.length,
      provenRate: proofResults.length === 0 ? null : proven / proofResults.length
    })];
  })));
}

class EvaluationReport {
  constructor({ candidateId, mode, budget, eligibleCases, results }) {
    this.candidateId = candidateId;
    this.mode = mode;
    this.budget = budget;
    this.eligibleCases = eligibleCases;
    this.results = objectFreeze(arraySlice(results));
    this.attemptedCases = results.length;
    this.skippedCases = maxNumber(0, eligibleCases - results.length);
    this.successes = arrayFilter(results, (result) => result.success).length;
    this.proofEligibleCases = arrayFilter(results, (result) => result.requiresProof).length;
    this.proven = arrayFilter(results, (result) => result.requiresProof && result.proven).length;
    this.adversarialCases = arrayFilter(results, (result) => result.adversarial).length;
    this.adversarialSuccesses = arrayFilter(results, (result) => result.adversarial && result.success).length;
    this.weaknessesExposed = this.adversarialCases - this.adversarialSuccesses;
    this.highSurpriseCases = arrayFilter(results, (result) => result.surpriseBand === SURPRISE_BANDS.HIGH).length;
    this.successRate = results.length === 0 ? 0 : this.successes / results.length;
    this.provenRate = this.proofEligibleCases === 0 ? null : this.proven / this.proofEligibleCases;
    this.adversarialSuccessRate = this.adversarialCases === 0
      ? null
      : this.adversarialSuccesses / this.adversarialCases;
    this.complete = this.skippedCases === 0;
    this.transferMatrix = transferMatrixFor(results);
    objectFreeze(this);
  }
}

export class EvaluationRunner {
  constructor({ harness = new FluidHarness(), plan = null, execute = null } = {}) {
    if (!isTrustedHarness(harness)) {
      throw new TypeError(
        'EvaluationRunner requires a FluidHarness; a trusted FluidHarness instance is required'
      );
    }
    if (plan !== null && typeof plan !== 'function') {
      throw new TypeError('EvaluationRunner plan override must be a function');
    }
    if (execute !== null && typeof execute !== 'function') {
      throw new TypeError('EvaluationRunner execute override must be a function');
    }
    this.harness = harness;
    this.plan = plan ?? ((taskInput) => this.harness.plan(taskInput));
    this.execute = execute ?? ((argumentsObject) => this.harness.execute(argumentsObject));
    weakSetAdd(TRUSTED_EVALUATION_RUNNERS, this);
    objectFreeze(this);
  }

  evaluate({
    candidateId = 'default-kernel',
    cases,
    mode = POLICY_MODES.PRODUCTION,
    budget = new EvaluationBudget({ maxCases: cases?.length ?? 0 }),
    executionOptions = {}
  }) {
    if (!isTrustedEvaluationRunner(this)) {
      throw new TypeError('EvaluationRunner requires an exact trusted EvaluationRunner instance');
    }
    const normalizedCandidateId = requireNonEmptyString(candidateId, 'Candidate id');
    if (!arrayIsArray(cases) || cases.length === 0) {
      throw new TypeError('Evaluation requires at least one case');
    }
    if (!arrayIncludes(objectValues(POLICY_MODES), mode)) {
      throw new RangeError(`Unknown evaluation policy: ${mode}`);
    }
    if (!isTrustedEvaluationBudget(budget)) {
      throw new TypeError('Evaluation requires a trusted EvaluationBudget');
    }
    if (!executionOptions || typeof executionOptions !== 'object' || arrayIsArray(executionOptions)) {
      throw new TypeError('Evaluation executionOptions must be an object');
    }
    const normalizedExecutionOptions = copyAndFreeze(executionOptions);

    const evaluationCases = arrayMap(cases, (evaluationCase) => {
      if (!isTrustedEvaluationCase(evaluationCase)) {
        throw new TypeError('Evaluation cases must be trusted EvaluationCase instances');
      }
      return evaluationCase;
    });
    if (setSize(setFromArray(arrayMap(evaluationCases, ({ id }) => id))) !== evaluationCases.length) {
      throw new TypeError('Evaluation case ids must be unique');
    }
    const eligibleCases = mode === POLICY_MODES.PRODUCTION
      ? arrayFilter(evaluationCases, (evaluationCase) => evaluationCase.productionEligible)
      : mode === POLICY_MODES.SKEPTIC
        ? arrayFilter(evaluationCases, (evaluationCase) => evaluationCase.adversarial)
        : evaluationCases;
    if (eligibleCases.length === 0) {
      throw new TypeError(`Evaluation policy ${mode} has no eligible cases`);
    }
    const selectedCases = arraySlice(eligibleCases, 0, budget.maxCases);
    const results = arrayMap(selectedCases, (evaluationCase) => this.runCase(
      evaluationCase,
      mode,
      { executionOptions: normalizedExecutionOptions }
    ));

    const report = new EvaluationReport({
      candidateId: normalizedCandidateId,
      mode,
      budget,
      eligibleCases: eligibleCases.length,
      results
    });
    weakSetAdd(TRUSTED_EVALUATION_REPORTS, report);
    weakMapSet(TRUSTED_EVALUATION_SUITES, report, objectFreeze(arraySlice(evaluationCases)));
    return report;
  }

  runCase(evaluationCase, mode, { executionOptions = {} } = {}) {
    try {
      const plan = this.plan(evaluationCase.task);
      if (!isTrustedPlan(plan, this.harness)) {
        throw new TypeError('EvaluationRunner requires a trusted Plan from its harness');
      }
      if (
        plan.task.id !== evaluationCase.task.id
        || plan.task.description !== evaluationCase.task.description
      ) {
        throw new TypeError('EvaluationRunner plan must match the current evaluation case task');
      }
      const report = this.execute({
        plan,
        input: evaluationCase.input,
        reproduction: `evaluation:${mode}:${evaluationCase.id}`,
        executionOptions
      });
      if (!isTrustedActionReport(report, this.harness, plan, evaluationCase.input)) {
        throw new TypeError('EvaluationRunner requires an action report from the current Plan');
      }
      const reportOwner = weakMapGet(TRUSTED_EVALUATION_ACTION_REPORTS, report);
      if (reportOwner !== undefined) {
        throw new TypeError(reportOwner === this
          ? 'EvaluationRunner received an already-consumed action report'
          : 'EvaluationRunner received an action report consumed by another evaluation runner');
      }
      weakMapSet(TRUSTED_EVALUATION_ACTION_REPORTS, report, this);
      const proven = report.evidence === EVIDENCE_LEVELS.PROVEN;
      const expected = evaluateExpectation(evaluationCase, report, null);
      return objectFreeze({
        caseId: evaluationCase.id,
        domain: evaluationCase.domain,
        representation: report.strategy.representation,
        proven,
        expected,
        success: evaluationCase.requiresProof ? proven && expected : expected,
        requiresProof: evaluationCase.requiresProof,
        adversarial: evaluationCase.adversarial,
        surpriseNats: report.surpriseNats,
        surpriseBand: report.surpriseBand,
        verifierId: report.verification?.verifierId ?? null,
        error: null
      });
    } catch (error) {
      const expected = evaluateExpectation(evaluationCase, null, error);
      return objectFreeze({
        caseId: evaluationCase.id,
        domain: evaluationCase.domain,
        representation: null,
        proven: false,
        expected,
        success: !evaluationCase.requiresProof && expected,
        requiresProof: evaluationCase.requiresProof,
        adversarial: evaluationCase.adversarial,
        surpriseNats: null,
        surpriseBand: SURPRISE_BANDS.HIGH,
        verifierId: null,
        error: isInstanceOf(error, Error) ? error.message : stringFrom(error)
      });
    }
  }
}

objectFreeze(EvaluationRunner.prototype);

export class PromotionAuthority {
  constructor({
    minimumSuccessRate = 1,
    minimumProvenRate = 1,
    requireResearch = true,
    requireSkeptic = true
  } = {}) {
    this.minimumSuccessRate = requireRate(minimumSuccessRate, 'Minimum success rate');
    this.minimumProvenRate = requireRate(minimumProvenRate, 'Minimum proven rate');
    this.requireResearch = toBoolean(requireResearch);
    this.requireSkeptic = toBoolean(requireSkeptic);
    weakSetAdd(TRUSTED_PROMOTION_AUTHORITIES, this);
    objectFreeze(this);
  }

  decide(report, { skepticReport = null, productionReport = null } = {}) {
    if (!isTrustedEvaluationReport(report)) {
      throw new TypeError('Promotion requires a report produced by EvaluationRunner');
    }

    const reasons = [];
    if (productionReport !== null) {
      if (!isTrustedEvaluationReport(productionReport) || productionReport.mode !== POLICY_MODES.PRODUCTION) {
        arrayPush(reasons, 'complete production evaluation required');
      } else if (productionReport.candidateId !== report.candidateId) {
        arrayPush(reasons, 'production evaluation candidate must match the primary candidate');
      } else if (!sameEvaluationSuite(report, productionReport)) {
        arrayPush(reasons, 'production evaluation case suite must match the primary evaluation');
      } else if (!productionReport.complete) {
        arrayPush(reasons, 'production evaluation budget did not cover all eligible cases');
      } else {
        if (productionReport.successRate < this.minimumSuccessRate) {
          arrayPush(reasons, `production success rate ${productionReport.successRate} below ${this.minimumSuccessRate}`);
        }
        if (
          productionReport.provenRate === null
          || productionReport.provenRate < this.minimumProvenRate
        ) {
          arrayPush(reasons, `production proven rate ${productionReport.provenRate} below ${this.minimumProvenRate}`);
        }
      }
    }
    if (this.requireResearch && report.mode !== POLICY_MODES.RESEARCH) {
      arrayPush(reasons, 'research evaluation required');
    }
    if (!report.complete) {
      arrayPush(reasons, 'evaluation budget did not cover all eligible cases');
    }
    if (report.successRate < this.minimumSuccessRate) {
      arrayPush(reasons, `success rate ${report.successRate} below ${this.minimumSuccessRate}`);
    }
    if (report.provenRate === null || report.provenRate < this.minimumProvenRate) {
      arrayPush(reasons, `proven rate ${report.provenRate} below ${this.minimumProvenRate}`);
    }
    if (this.requireSkeptic) {
      if (!isTrustedEvaluationReport(skepticReport) || skepticReport.mode !== POLICY_MODES.SKEPTIC) {
        arrayPush(reasons, 'complete skeptic evaluation required');
      } else if (skepticReport.candidateId !== report.candidateId) {
        arrayPush(reasons, 'skeptic evaluation candidate must match the primary candidate');
      } else if (!sameEvaluationSuite(report, skepticReport)) {
        arrayPush(reasons, 'skeptic evaluation case suite must match the primary evaluation');
      } else if (!skepticReport.complete) {
        arrayPush(reasons, 'skeptic evaluation budget did not cover all adversarial cases');
      } else if (!sameEvaluationEvidence(report, skepticReport)) {
        arrayPush(reasons, 'skeptic evaluation evidence must match the primary candidate');
      } else if (skepticReport.adversarialSuccessRate === null || skepticReport.adversarialSuccessRate < this.minimumSuccessRate) {
        arrayPush(reasons, `skeptic success rate ${skepticReport.adversarialSuccessRate} below ${this.minimumSuccessRate}`);
      }
      if (isTrustedEvaluationReport(skepticReport) && skepticReport.weaknessesExposed > 0) {
        arrayPush(reasons, `skeptic exposed ${skepticReport.weaknessesExposed} weakness(es)`);
      }
    }

    return objectFreeze({
      candidateId: report.candidateId,
      promoted: reasons.length === 0,
      reasons: objectFreeze(reasons),
      successRate: report.successRate,
      provenRate: report.provenRate
    });
  }
}

objectFreeze(PromotionAuthority.prototype);

export function isTrustedPromotionAuthority(authority) {
  return typeof authority === 'object'
    && authority !== null
    && weakSetHas(TRUSTED_PROMOTION_AUTHORITIES, authority)
    && objectGetPrototypeOf(authority) === PromotionAuthority.prototype;
}

export function isTrustedEvaluationRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_EVALUATION_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === EvaluationRunner.prototype;
}
