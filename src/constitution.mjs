import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

import {
  arrayAt,
  arrayCreate,
  arrayEvery,
  arrayFilter,
  arrayForEach,
  arrayIncludes,
  arrayJoin,
  arrayMap,
  arrayPush,
  arraySlice,
  arraySort,
  arrayIsArray,
  arraySome,
  isFiniteNumber,
  isInstanceOf,
  isInteger,
  isPlainObject,
  isSafeInteger,
  jsonParse,
  jsonStringify,
  maxNumber,
  objectDefineProperty,
  objectFreeze,
  objectEntries,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectKeys,
  objectValues,
  reflectOwnKeys,
  stringFrom,
  stringTrim,
  toNumber,
  weakMapCreate,
  weakMapGet,
  weakMapHas,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetDelete,
  weakSetHas
} from './intrinsics.mjs';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES,
  PromotionAuthority,
  isTrustedEvaluationBudget,
  isTrustedEvaluationCase,
  isTrustedPromotionAuthority
} from './evaluation.mjs';
import { isTrustedQuestionDecision, QUESTION_REASONS } from './curiosity.mjs';
import { EVIDENCE_LEVELS } from './evidence.mjs';
import {
  FluidHarness,
  isTrustedActionReport,
  isTrustedHarness,
  isTrustedPlan
} from './harness.mjs';
import { REPRESENTATIONS } from './representation.mjs';
import { isCompleteSearchReport } from './search.mjs';
import { SURPRISE_BANDS } from './world-model.mjs';

export const CORE_EVENTS = objectFreeze({
  ACTION_ADMITTED: 'action-admitted',
  ACTION_COMPLETED: 'action-completed',
  ACTION_FAILED: 'action-failed',
  ACTION_REJECTED: 'action-rejected',
  EVALUATION_STARTED: 'evaluation-started',
  EVALUATION_COMPLETED: 'evaluation-completed',
  EVALUATION_FAILED: 'evaluation-failed',
  PROMOTION_DECIDED: 'promotion-decided',
  QUESTION_DECIDED: 'question-decided',
  RESEARCH_COMPLETED: 'research-completed',
  SHUTDOWN: 'shutdown',
  RESUMED: 'resumed'
});

const GENESIS_HASH = 'genesis';
const TRUSTED_CONSTITUTIONS = weakSetCreate();
const TRUSTED_CORE_HARNESSES = weakMapCreate();
const TRUSTED_CORE_INSTANCES = weakSetCreate();
const TRUSTED_CORE_PLANS = weakMapCreate();
const TRUSTED_CORE_ACTION_REPORTS = weakMapCreate();
const TRUSTED_CORE_ACTION_MODES = weakMapCreate();
const TRUSTED_CORE_QUESTION_ACTIONS = weakMapCreate();
const TRUSTED_CORE_QUESTION_DECISION_ACTIONS = weakMapCreate();
const TRUSTED_CORE_RESEARCH_QUEUE_ACTIONS = weakMapCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requirePositiveInteger(value, field) {
  if (!isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive integer (safe integer required)`);
  }
  return value;
}

function requireNonNegativeNumber(value, field) {
  if (!isFiniteNumber(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative finite number`);
  }
  return value;
}

function requireConstitutionalSurpriseThreshold(harness, constitution) {
  const configured = harness?.worldModel?.highSurpriseThreshold ?? 1;
  const threshold = requireNonNegativeNumber(
    configured,
    'World-model high-surprise threshold'
  );
  if (threshold > constitution.maxSurpriseThreshold) {
    throw new RangeError(
      `World-model high-surprise threshold ${threshold} exceeds constitutional maximum ${constitution.maxSurpriseThreshold}`
    );
  }
  return threshold;
}

function learningEntryForReport(report) {
  const predictionError = report.predictionError;
  const observationLikelihood = predictionError
    ? report.prediction.mismatchLikelihood
    : report.prediction.expectedLikelihood;
  return objectFreeze({
    strategyKey: report.prediction.strategyKey,
    predictionError,
    surpriseNats: report.surpriseNats,
    surpriseBand: report.surpriseBand,
    actualObservation: report.observation.actualObservation,
    expectedLikelihood: report.prediction.expectedLikelihood,
    observationLikelihood,
    evidence: report.evidence,
    verified: report.evidence === EVIDENCE_LEVELS.PROVEN
  });
}

function researchQueueSnapshot({ actionNumber, taskId, policyMode, question, actionReport }) {
  return objectFreeze({
    actionNumber,
    taskId,
    policyMode,
    reason: question.reason,
    evidence: question.evidence,
    surpriseBand: question.surpriseBand,
    researchRequested: question.researchRequested,
    researchRequired: question.researchRequired,
    action: objectFreeze({
      strategyKey: actionReport.prediction.strategyKey,
      predictionError: actionReport.predictionError,
      surpriseNats: actionReport.surpriseNats,
      evidence: actionReport.evidence,
      environmentHash: actionReport.environmentHash
    })
  });
}

function copyAndFreeze(value, seen = weakMapCreate()) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (weakMapHas(seen, value)) {
    return weakMapGet(seen, value);
  }

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

function rejectUnsupportedInputStructure(value, seen = weakSetCreate()) {
  const type = typeof value;
  if (
    value === undefined
    || type === 'function'
    || type === 'symbol'
    || type === 'bigint'
    || (type === 'number' && !isFiniteNumber(value))
  ) {
    throw new TypeError('Input must contain only JSON-compatible values');
  }
  if (value === null || type !== 'object') {
    return;
  }
  if (weakSetHas(seen, value)) {
    return;
  }
  weakSetAdd(seen, value);

  const prototype = objectGetPrototypeOf(value);
  if (!arrayIsArray(value) && !isPlainObject(value)) {
    throw new TypeError('Input must contain only JSON-compatible values');
  }
  if (objectGetOwnPropertyDescriptor(value, 'toJSON') !== undefined) {
    throw new TypeError('Input must contain only JSON-compatible values');
  }
  const inheritedToJSON = prototype === null
    ? undefined
    : objectGetOwnPropertyDescriptor(prototype, 'toJSON');
  if (inheritedToJSON !== undefined) {
    throw new TypeError('Input must contain only JSON-compatible values');
  }

  arrayForEach(reflectOwnKeys(value), (key) => {
    if (arrayIsArray(value)) {
      if (key === 'length') {
        return;
      }
      const descriptor = objectGetOwnPropertyDescriptor(value, key);
      if (typeof key === 'symbol') {
        throw new TypeError('Input must contain only JSON-compatible values');
      }
      const index = toNumber(key);
      if (
        !isInteger(index)
        || index < 0
        || index >= value.length
        || stringFrom(index) !== key
        || !descriptor?.enumerable
        || descriptor.get
        || descriptor.set
      ) {
        throw new TypeError('Input must contain only JSON-compatible values');
      }
      if ('value' in descriptor) {
        rejectUnsupportedInputStructure(descriptor.value, seen);
      }
      return;
    } else {
      const descriptor = objectGetOwnPropertyDescriptor(value, key);
      if (
        typeof key === 'symbol'
        || !descriptor?.enumerable
        || descriptor.get
        || descriptor.set
      ) {
        throw new TypeError('Input must contain only JSON-compatible values');
      }
      if ('value' in descriptor) {
        rejectUnsupportedInputStructure(descriptor.value, seen);
      }
      return;
    }
  });
}

function rejectUnsupportedInputValue(_key, value) {
  const type = typeof value;
  if (
    value === undefined
    || type === 'function'
    || type === 'symbol'
    || type === 'bigint'
    || (type === 'number' && !isFiniteNumber(value))
  ) {
    throw new TypeError('Input must contain only JSON-compatible values');
  }
  if (value !== null && type === 'object' && !arrayIsArray(value)) {
    const prototype = objectGetPrototypeOf(value);
    if (!isPlainObject(value)) {
      throw new TypeError('Input must contain only JSON-compatible values');
    }
  }
  if (value !== null && type === 'object') {
    arrayForEach(reflectOwnKeys(value), (key) => {
      if (arrayIsArray(value)) {
        if (key === 'length') {
          return;
        }
        if (typeof key === 'symbol') {
          throw new TypeError('Input must contain only JSON-compatible values');
        }
        const index = toNumber(key);
        if (
          !isInteger(index)
          || index < 0
          || index >= value.length
          || stringFrom(index) !== key
        ) {
          throw new TypeError('Input must contain only JSON-compatible values');
        }
        return;
      }
      const descriptor = objectGetOwnPropertyDescriptor(value, key);
      if (typeof key === 'symbol' || !descriptor?.enumerable) {
        throw new TypeError('Input must contain only JSON-compatible values');
      }
    });
  }
  return value;
}

function stableSerialize(value, ancestors = weakSetCreate()) {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return jsonStringify(value);
  }
  if (typeof value === 'number') {
    if (!isFiniteNumber(value)) {
      throw new TypeError('Audit payload numbers must be finite');
    }
    return jsonStringify(value);
  }
  if (arrayIsArray(value)) {
    if (weakSetHas(ancestors, value)) {
      throw new TypeError('Audit payload must not contain cyclic values');
    }
    weakSetAdd(ancestors, value);
    try {
      return `[${arrayJoin(arrayMap(value, (entry) => stableSerialize(entry, ancestors)), ',')}]`;
    } finally {
      weakSetDelete(ancestors, value);
    }
  }
  if (typeof value === 'object') {
    if (weakSetHas(ancestors, value)) {
      throw new TypeError('Audit payload must not contain cyclic values');
    }
    weakSetAdd(ancestors, value);
    try {
      return `{${arrayJoin(arrayMap(arraySort(objectKeys(value)), (key) => (
        `${jsonStringify(key)}:${stableSerialize(value[key], ancestors)}`
      )), ',')}}`;
    } finally {
      weakSetDelete(ancestors, value);
    }
  }
  throw new TypeError('Audit payload must contain only JSON-compatible values');
}

function auditHash({ sequence, event, payload, previousHash }) {
  const material = stableSerialize({ sequence, event, payload, previousHash });
  return `sha256:${createHash('sha256').update(material).digest('hex')}`;
}

function requirePolicyMode(value) {
  if (!arrayIncludes(objectValues(POLICY_MODES), value)) {
    throw new RangeError(`Unknown policy mode: ${value}`);
  }
  return value;
}

function errorMessage(error) {
  return isInstanceOf(error, Error) ? error.message : stringFrom(error);
}

function reportSummary(report) {
  return {
    taskId: report.taskId,
    representation: report.strategy.representation,
    evidence: report.evidence,
    verifierId: report.verification?.verifierId ?? null,
    surpriseBand: report.surpriseBand,
    predictionError: report.predictionError
  };
}

class AuditLog {
  #entries = objectFreeze([]);

  #maxEntries;

  constructor(maxEntries) {
    this.#maxEntries = maxEntries;
  }

  append(event, payload) {
    if (this.#entries.length >= this.#maxEntries) {
      throw new RangeError('Constitutional audit log capacity exhausted');
    }

    const sequence = this.#entries.length + 1;
    const previousHash = arrayAt(this.#entries, -1)?.hash ?? GENESIS_HASH;
    const safePayload = copyAndFreeze(payload);
    const entry = objectFreeze({
      sequence,
      event: requireNonEmptyString(event, 'Audit event'),
      payload: safePayload,
      previousHash,
      hash: auditHash({ sequence, event, payload: safePayload, previousHash })
    });
    const nextEntries = arraySlice(this.#entries);
    arrayPush(nextEntries, entry);
    this.#entries = objectFreeze(nextEntries);
    return entry;
  }

  canAppend(count = 1) {
    return this.#entries.length + count <= this.#maxEntries;
  }

  snapshot() {
    return objectFreeze(arraySlice(this.#entries));
  }

  verify() {
    let previousHash = GENESIS_HASH;
    return arrayEvery(this.#entries, (entry) => {
      if (entry.previousHash !== previousHash) {
        return false;
      }
      if (entry.hash !== auditHash({
        sequence: entry.sequence,
        event: entry.event,
        payload: entry.payload,
        previousHash: entry.previousHash
      })) {
        return false;
      }
      previousHash = entry.hash;
      return true;
    });
  }
}

export class Constitution {
  constructor({
    maxActions = 100,
    maxGraphExpansions = 1000,
    maxAuditEntries = 1000,
    maxInputBytes = 1_000_000,
    maxGraphNodes = 10_000,
    maxGraphEdges = 50_000,
    maxConstraintJobs = 1_000,
    maxArrayElements = 10_000,
    maxSurpriseThreshold = 1
  } = {}) {
    this.maxActions = requirePositiveInteger(maxActions, 'Constitution maxActions');
    this.maxGraphExpansions = requirePositiveInteger(
      maxGraphExpansions,
      'Constitution maxGraphExpansions'
    );
    this.maxAuditEntries = requirePositiveInteger(maxAuditEntries, 'Constitution maxAuditEntries');
    this.maxInputBytes = requirePositiveInteger(maxInputBytes, 'Constitution maxInputBytes');
    this.maxGraphNodes = requirePositiveInteger(maxGraphNodes, 'Constitution maxGraphNodes');
    this.maxGraphEdges = requirePositiveInteger(maxGraphEdges, 'Constitution maxGraphEdges');
    this.maxConstraintJobs = requirePositiveInteger(maxConstraintJobs, 'Constitution maxConstraintJobs');
    this.maxArrayElements = requirePositiveInteger(maxArrayElements, 'Constitution maxArrayElements');
    this.maxSurpriseThreshold = requireNonNegativeNumber(
      maxSurpriseThreshold,
      'Constitution maxSurpriseThreshold'
    );
    weakSetAdd(TRUSTED_CONSTITUTIONS, this);
    objectFreeze(this);
  }
}

export function isTrustedConstitution(constitution) {
  return typeof constitution === 'object'
    && constitution !== null
    && weakSetHas(TRUSTED_CONSTITUTIONS, constitution)
    && objectGetPrototypeOf(constitution) === Constitution.prototype;
}

export class ConstitutionalCore {
  #constitution;

  #harness;

  #promotionAuthority;

  #evaluationReports;

  #audit;

  #learningHistory;

  #researchQueue;

  #state;

  constructor({
    constitution = new Constitution(),
    harness = new FluidHarness(),
    promotionAuthority = new PromotionAuthority()
  } = {}) {
    if (!isTrustedConstitution(constitution)) {
      throw new TypeError('ConstitutionalCore requires a trusted Constitution');
    }
    if (!isTrustedHarness(harness)) {
      throw new TypeError(
        'ConstitutionalCore requires a FluidHarness; a trusted FluidHarness instance is required'
      );
    }
    if (!isTrustedPromotionAuthority(promotionAuthority)) {
      throw new TypeError('ConstitutionalCore requires a trusted PromotionAuthority');
    }
    if (weakMapHas(TRUSTED_CORE_HARNESSES, harness)) {
      throw new TypeError('ConstitutionalCore requires a fresh harness not already owned by another core');
    }
    requireConstitutionalSurpriseThreshold(harness, constitution);

    this.#constitution = constitution;
    this.#harness = harness;
    this.#promotionAuthority = promotionAuthority;
    this.#evaluationReports = weakMapCreate();
    this.#audit = new AuditLog(constitution.maxAuditEntries);
    this.#learningHistory = [];
    this.#researchQueue = [];
    this.#state = objectFreeze({
      shutdown: false,
      shutdownReason: null,
      actionsUsed: 0
    });
    weakMapSet(TRUSTED_CORE_HARNESSES, harness, this);
    weakSetAdd(TRUSTED_CORE_INSTANCES, this);
    objectFreeze(this);
  }

  get constitution() {
    return this.#constitution;
  }

  get status() {
    return objectFreeze({
      ...this.#state,
      remainingActions: this.#constitution.maxActions - this.#state.actionsUsed
    });
  }

  get auditTrail() {
    return this.#audit.snapshot();
  }

  get learningHistory() {
    return objectFreeze(arraySlice(this.#learningHistory));
  }

  get researchQueue() {
    return objectFreeze(arrayMap(
      this.#researchQueue,
      ({ snapshot }) => copyAndFreeze(snapshot)
    ));
  }

  canAppendAudit(count = 1) {
    return this.#audit.canAppend(count);
  }

  verifyAudit() {
    return this.#audit.verify();
  }

  plan(taskInput) {
    requireConstitutionalSurpriseThreshold(this.#harness, this.#constitution);
    const plan = this.#harness.plan(taskInput);
    if (!isTrustedPlan(plan, this.#harness)) {
      throw new TypeError('ConstitutionalCore.plan requires a trusted Plan from its harness');
    }
    const owner = weakMapGet(TRUSTED_CORE_PLANS, plan);
    if (owner !== undefined && owner !== this) {
      throw new TypeError('ConstitutionalCore.plan received a Plan bound to another core');
    }
    weakMapSet(TRUSTED_CORE_PLANS, plan, this);
    return plan;
  }

  ownsPlan(plan) {
    return isTrustedPlan(plan, this.#harness)
      && weakMapGet(TRUSTED_CORE_PLANS, plan) === this;
  }

  ownsActionReport(report, plan = null) {
    return isTrustedActionReport(report, this.#harness, plan)
      && weakMapGet(TRUSTED_CORE_ACTION_REPORTS, report) === this;
  }

  ownsQuestionDecision(question, actionReport = null) {
    const recordedAction = typeof question === 'object' && question !== null
      ? weakMapGet(TRUSTED_CORE_QUESTION_DECISION_ACTIONS, question)
      : undefined;
    const expectedAction = actionReport ?? recordedAction;
    return isTrustedQuestionDecision(question, expectedAction)
      && recordedAction === expectedAction
      && weakMapGet(TRUSTED_CORE_QUESTION_ACTIONS, expectedAction) === this;
  }

  #record(event, payload) {
    return this.#audit.append(event, payload);
  }

  #recordLearning(report) {
    arrayPush(this.#learningHistory, learningEntryForReport(report));
  }

  #requireAuditCapacity(count) {
    if (!this.#audit.canAppend(count)) {
      throw new RangeError(
        `Constitutional audit log capacity exhausted: operation requires ${count} entries`
      );
    }
  }

  #evaluationAuditEntries(cases, mode, budget) {
    if (
      !arrayIsArray(cases)
      || arraySome(cases, (evaluationCase) => !isTrustedEvaluationCase(evaluationCase))
      || (budget !== undefined && !isTrustedEvaluationBudget(budget))
    ) {
      return 2;
    }

    const eligibleCases = mode === POLICY_MODES.PRODUCTION
      ? arrayFilter(cases, (evaluationCase) => evaluationCase.productionEligible).length
      : mode === POLICY_MODES.SKEPTIC
        ? arrayFilter(cases, (evaluationCase) => evaluationCase.adversarial).length
        : cases.length;
    const requestedCases = budget?.maxCases ?? cases.length;
    const selectedCases = eligibleCases < requestedCases ? eligibleCases : requestedCases;
    const availableActions = this.#constitution.maxActions - this.#state.actionsUsed;
    const actionBackedCases = selectedCases < availableActions ? selectedCases : availableActions;
    return 2 + (actionBackedCases * 2) + (selectedCases - actionBackedCases);
  }

  #requireActive(action, payload) {
    if (this.#state.shutdown) {
      this.#record(CORE_EVENTS.ACTION_REJECTED, {
        action,
        ...payload,
        reason: `core shutdown: ${this.#state.shutdownReason}`
      });
      throw new Error(`Constitutional core is shutdown: ${this.#state.shutdownReason}`);
    }
  }

  #normalizeExecutionOptions(plan, executionOptions) {
    if (!executionOptions || typeof executionOptions !== 'object' || arrayIsArray(executionOptions)) {
      throw new TypeError('Constitutional executionOptions must be an object');
    }

    try {
      rejectUnsupportedInputStructure(executionOptions);
    } catch (error) {
      throw new TypeError(
        `Constitutional executionOptions must contain only JSON-compatible values: ${errorMessage(error)}`
      );
    }

    const normalized = { ...executionOptions };
    if (plan.strategy.representation === REPRESENTATIONS.GRAPH) {
      const requested = normalized.maxExpansions ?? this.#constitution.maxGraphExpansions;
      if (!isSafeInteger(requested) || requested <= 0) {
        throw new TypeError(
          'Constitutional maxExpansions must be a positive integer (safe integer required)'
        );
      }
      if (requested > this.#constitution.maxGraphExpansions) {
        throw new RangeError(
          `Requested graph budget ${requested} exceeds constitutional limit ${this.#constitution.maxGraphExpansions}`
        );
      }
      normalized.maxExpansions = requested;
    }
    stableSerialize(normalized);
    return objectFreeze(normalized);
  }

  #enforceInputEnvelope(plan, input) {
    let serialized;
    try {
      rejectUnsupportedInputStructure(input);
      serialized = jsonStringify(input, rejectUnsupportedInputValue);
    } catch (error) {
      throw new TypeError(`Input is not JSON-serializable: ${errorMessage(error)}`);
    }
    if (typeof serialized !== 'string') {
      throw new TypeError('Input must be JSON-serializable');
    }

    const inputBytes = Buffer.byteLength(serialized, 'utf8');
    if (inputBytes > this.#constitution.maxInputBytes) {
      throw new RangeError(
        `Input size ${inputBytes} exceeds constitutional limit ${this.#constitution.maxInputBytes} bytes`
      );
    }

    const normalizedInput = copyAndFreeze(jsonParse(serialized));

    const representation = plan.strategy.representation;
    if (representation === REPRESENTATIONS.GRAPH) {
      if (arrayIsArray(normalizedInput?.nodes) && normalizedInput.nodes.length > this.#constitution.maxGraphNodes) {
        throw new RangeError(
          `Graph node count ${normalizedInput.nodes.length} exceeds constitutional limit ${this.#constitution.maxGraphNodes}`
        );
      }
      if (arrayIsArray(normalizedInput?.edges) && normalizedInput.edges.length > this.#constitution.maxGraphEdges) {
        throw new RangeError(
          `Graph edge count ${normalizedInput.edges.length} exceeds constitutional limit ${this.#constitution.maxGraphEdges}`
        );
      }
    } else if (representation === REPRESENTATIONS.CONSTRAINT_SYSTEM) {
      if (arrayIsArray(normalizedInput?.jobs) && normalizedInput.jobs.length > this.#constitution.maxConstraintJobs) {
        throw new RangeError(
          `Constraint job count ${normalizedInput.jobs.length} exceeds constitutional limit ${this.#constitution.maxConstraintJobs}`
        );
      }
    } else if (representation === REPRESENTATIONS.ARRAY_COMPUTATION) {
      const leftLength = arrayIsArray(normalizedInput?.left) ? normalizedInput.left.length : 0;
      const rightLength = arrayIsArray(normalizedInput?.right) ? normalizedInput.right.length : 0;
      if (maxNumber(leftLength, rightLength) > this.#constitution.maxArrayElements) {
        throw new RangeError(
          `Array length ${maxNumber(leftLength, rightLength)} exceeds constitutional limit ${this.#constitution.maxArrayElements}`
        );
      }
    }

    return objectFreeze({ input: normalizedInput, inputBytes });
  }

  execute({
    plan,
    input,
    reproduction = 'ConstitutionalCore.execute',
    policyMode = POLICY_MODES.PRODUCTION,
    executionOptions = {}
  }) {
    if (!this.ownsPlan(plan)) {
      throw new TypeError('ConstitutionalCore.execute requires a trusted Plan owned by this core');
    }
    const mode = requirePolicyMode(policyMode);
    this.#requireActive('execute', {
      taskId: plan.task.id,
      policyMode: mode
    });
    if (this.#state.actionsUsed >= this.#constitution.maxActions) {
      this.#record(CORE_EVENTS.ACTION_REJECTED, {
        action: 'execute',
        taskId: plan.task.id,
        policyMode: mode,
        reason: 'action budget exhausted'
      });
      throw new RangeError('Constitutional action budget exhausted');
    }

    let boundedOptions;
    let inputEnvelope;
    try {
      requireConstitutionalSurpriseThreshold(this.#harness, this.#constitution);
      boundedOptions = this.#normalizeExecutionOptions(plan, executionOptions);
      inputEnvelope = this.#enforceInputEnvelope(plan, input);
    } catch (error) {
      this.#record(CORE_EVENTS.ACTION_REJECTED, {
        action: 'execute',
        taskId: plan.task.id,
        policyMode: mode,
        reason: errorMessage(error)
      });
      throw error;
    }
    this.#requireAuditCapacity(2);
    const actionNumber = this.#state.actionsUsed + 1;
    this.#record(CORE_EVENTS.ACTION_ADMITTED, {
      actionNumber,
      taskId: plan.task.id,
      representation: plan.strategy.representation,
      policyMode,
      executionOptions: boundedOptions,
      inputBytes: inputEnvelope.inputBytes
    });
    this.#state = objectFreeze({
      ...this.#state,
      actionsUsed: actionNumber
    });

    try {
      const report = this.#harness.execute({
        plan,
        input: inputEnvelope.input,
        reproduction,
        executionOptions: boundedOptions
      });
      if (!isTrustedActionReport(report, this.#harness)) {
        throw new TypeError('ConstitutionalCore.execute requires a trusted action report');
      }
      if (!isTrustedActionReport(report, this.#harness, plan, inputEnvelope.input)) {
        throw new TypeError('ConstitutionalCore.execute requires an action report matching the current plan');
      }
      if (
        report.taskId !== plan.task.id
        || report.strategy.representation !== plan.strategy.representation
        || report.strategy.reasoningEngine !== plan.strategy.reasoningEngine
      ) {
        throw new TypeError('ConstitutionalCore.execute requires an action report matching the current plan');
      }
      const reportOwner = weakMapGet(TRUSTED_CORE_ACTION_REPORTS, report);
      if (reportOwner !== undefined) {
        throw new TypeError(reportOwner === this
          ? 'ConstitutionalCore.execute received an already-consumed action report'
          : 'ConstitutionalCore.execute received an action report bound to another core');
      }
      weakMapSet(TRUSTED_CORE_ACTION_REPORTS, report, this);
      weakMapSet(TRUSTED_CORE_ACTION_MODES, report, mode);
      this.#record(CORE_EVENTS.ACTION_COMPLETED, {
        actionNumber,
        policyMode: mode,
        ...reportSummary(report)
      });
      this.#recordLearning(report);
      return report;
    } catch (error) {
      this.#record(CORE_EVENTS.ACTION_FAILED, {
        actionNumber,
        policyMode: mode,
        taskId: plan.task.id,
        error: errorMessage(error)
      });
      throw error;
    }
  }

  evaluate({
    candidateId = 'default-kernel',
    cases,
    mode = POLICY_MODES.RESEARCH,
    budget,
    executionOptions = {}
  }) {
    const selectedMode = requirePolicyMode(mode);
    this.#requireActive('evaluate', { candidateId, policyMode: selectedMode });
    this.#requireAuditCapacity(this.#evaluationAuditEntries(cases, selectedMode, budget));
    this.#record(CORE_EVENTS.EVALUATION_STARTED, {
      candidateId,
      policyMode: selectedMode,
      maxCases: budget?.maxCases ?? null
    });

    const runner = new EvaluationRunner({
      harness: this.#harness,
      plan: (taskInput) => this.plan(taskInput),
      execute: ({ plan, input, reproduction, executionOptions: options }) => this.execute({
        plan,
        input,
        reproduction,
        policyMode: selectedMode,
        executionOptions: options
      })
    });

    try {
      const report = runner.evaluate({
        candidateId,
        cases,
        mode: selectedMode,
        budget,
        executionOptions
      });
      this.#record(CORE_EVENTS.EVALUATION_COMPLETED, {
        candidateId: report.candidateId,
        policyMode: report.mode,
        attemptedCases: report.attemptedCases,
        successes: report.successes,
        proven: report.proven,
        complete: report.complete
      });
      weakMapSet(this.#evaluationReports, report, this);
      return report;
    } catch (error) {
      this.#record(CORE_EVENTS.EVALUATION_FAILED, {
        candidateId,
        policyMode: selectedMode,
        error: errorMessage(error)
      });
      throw error;
    }
  }

  promote(report, { skepticReport = null, productionReport = null } = {}) {
    this.#requireActive('promote', { candidateId: report?.candidateId ?? null });
    if (
      typeof report !== 'object'
      || report === null
      || weakMapGet(this.#evaluationReports, report) !== this
    ) {
      throw new TypeError('Promotion requires an evaluation report produced by this core');
    }
    const decision = this.#promotionAuthority.decide(report, {
      skepticReport,
      productionReport
    });
    this.#record(CORE_EVENTS.PROMOTION_DECIDED, {
      candidateId: decision.candidateId,
      promoted: decision.promoted,
      reasons: decision.reasons
    });
    return decision;
  }

  recordQuestion({
    taskId,
    policyMode = POLICY_MODES.PRODUCTION,
    question,
    actionReport,
    researchReport = null
  }) {
    const normalizedTaskId = requireNonEmptyString(taskId, 'Question taskId');
    const mode = requirePolicyMode(policyMode);
    this.#requireActive('question', {
      taskId: normalizedTaskId,
      policyMode: mode
    });
    if (!this.ownsActionReport(actionReport)) {
      throw new TypeError('Question decision requires an action report produced by this core');
    }
    if (weakMapGet(TRUSTED_CORE_ACTION_MODES, actionReport) !== mode) {
      throw new Error('Question policy mode must match the action policy mode');
    }
    if (actionReport.taskId !== normalizedTaskId) {
      throw new Error('Question taskId must match the action report task');
    }
    if (!question || typeof question !== 'object') {
      throw new TypeError('Question decision is required');
    }
    if (!isTrustedQuestionDecision(question, actionReport)) {
      throw new TypeError('Question decision must be produced by the trusted policy for this action');
    }
    if (typeof question.requested !== 'boolean' || typeof question.automatic !== 'boolean') {
      throw new TypeError('Question decision flags must be boolean');
    }
    if (typeof question.researchCompleted !== 'boolean' || typeof question.researchRequired !== 'boolean') {
      throw new TypeError('Question research flags must be boolean');
    }
    if (typeof question.researchRequested !== 'boolean') {
      throw new TypeError('Question researchRequested must be boolean');
    }
    if (!arrayIncludes(objectValues(QUESTION_REASONS), question.reason)) {
      throw new RangeError('Unknown question reason');
    }
    if (!arrayIncludes(objectValues(EVIDENCE_LEVELS), question.evidence)) {
      throw new RangeError('Unknown question evidence level');
    }
    if (!arrayIncludes(objectValues(SURPRISE_BANDS), question.surpriseBand)) {
      throw new RangeError('Unknown question surprise band');
    }
    if (question.researchRequired !== (question.requested && !question.researchCompleted)) {
      throw new Error('Question researchRequired flag is inconsistent');
    }
    if (question.researchCompleted && !isCompleteSearchReport(researchReport)) {
      throw new TypeError('Question research completion requires a complete trusted search report');
    }
    if (!question.researchCompleted && researchReport !== null) {
      throw new Error('Question research completion must match the supplied research report');
    }

    this.#requireAuditCapacity(1);
    if (weakMapHas(TRUSTED_CORE_QUESTION_ACTIONS, actionReport)) {
      throw new TypeError('Question decision has already been recorded for this action');
    }
    const entry = this.#record(CORE_EVENTS.QUESTION_DECIDED, {
      taskId: normalizedTaskId,
      policyMode: mode,
      requested: question.requested,
      reason: question.reason,
      automatic: question.automatic,
      researchRequested: question.researchRequested,
      researchCompleted: question.researchCompleted,
      researchRequired: question.researchRequired,
      evidence: question.evidence,
      surpriseBand: question.surpriseBand
    });
    weakMapSet(TRUSTED_CORE_QUESTION_ACTIONS, actionReport, this);
    weakMapSet(TRUSTED_CORE_QUESTION_DECISION_ACTIONS, question, actionReport);
    if (question.researchRequired) {
      const snapshot = researchQueueSnapshot({
        actionNumber: this.#state.actionsUsed,
        taskId: normalizedTaskId,
        policyMode: mode,
        question,
        actionReport
      });
      arrayPush(this.#researchQueue, objectFreeze({ actionReport, snapshot }));
      weakMapSet(TRUSTED_CORE_RESEARCH_QUEUE_ACTIONS, actionReport, this);
    }
    return entry;
  }

  recordResearchCompletion({ actionReport, researchReport }) {
    this.#requireActive('research-completion', {
      taskId: actionReport?.taskId ?? null
    });
    if (!this.ownsActionReport(actionReport)) {
      throw new TypeError('Research completion requires an action report produced by this core');
    }
    if (weakMapGet(TRUSTED_CORE_RESEARCH_QUEUE_ACTIONS, actionReport) !== this) {
      throw new TypeError('Research completion requires a queued research question for this action');
    }
    if (!isCompleteSearchReport(researchReport)) {
      throw new TypeError('Research completion requires a complete trusted search report');
    }

    this.#requireAuditCapacity(1);
    const entry = this.#record(CORE_EVENTS.RESEARCH_COMPLETED, {
      taskId: actionReport.taskId,
      candidateId: researchReport.winner.candidateId,
      promotedCandidateId: researchReport.promoted?.candidateId ?? null,
      allAuditsValid: researchReport.allAuditsValid
    });
    this.#researchQueue = arrayFilter(
      this.#researchQueue,
      ({ actionReport: queuedAction }) => queuedAction !== actionReport
    );
    weakMapSet(TRUSTED_CORE_RESEARCH_QUEUE_ACTIONS, actionReport, null);
    return entry;
  }

  shutdown(reason) {
    const normalizedReason = requireNonEmptyString(reason, 'Shutdown reason');
    if (this.#state.shutdown) {
      return this.status;
    }

    this.#requireAuditCapacity(1);
    this.#record(CORE_EVENTS.SHUTDOWN, { reason: normalizedReason });
    this.#state = objectFreeze({
      ...this.#state,
      shutdown: true,
      shutdownReason: normalizedReason
    });
    return this.status;
  }

  resume(reason) {
    const normalizedReason = requireNonEmptyString(reason, 'Resume reason');
    if (!this.#state.shutdown) {
      throw new Error('Constitutional core is already active');
    }

    this.#record(CORE_EVENTS.RESUMED, {
      reason: normalizedReason,
      previousReason: this.#state.shutdownReason
    });
    this.#state = objectFreeze({
      ...this.#state,
      shutdown: false,
      shutdownReason: null
    });
    return this.status;
  }
}

objectFreeze(ConstitutionalCore.prototype);

export function isTrustedConstitutionalCore(core) {
  return typeof core === 'object'
    && core !== null
    && weakSetHas(TRUSTED_CORE_INSTANCES, core)
    && objectGetPrototypeOf(core) === ConstitutionalCore.prototype;
}
