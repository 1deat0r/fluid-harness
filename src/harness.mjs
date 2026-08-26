import { ActionReport, freezeActionValue } from './action.mjs';
import { ExecutorRegistry, isTrustedExecution, sameInput } from './executor.mjs';
import { isTrustedVerification, VerifierRegistry } from './verification.mjs';
import {
  Observation,
  Prediction,
  SURPRISE_BANDS,
  WorldModel,
  sameObservation,
  surpriseFromLikelihood
} from './world-model.mjs';
import { EVIDENCE_LEVELS, evidenceForVerification } from './evidence.mjs';
import {
  arrayCreate,
  arrayIsArray,
  arrayForEach,
  isFiniteNumber,
  isFrozenObject,
  isInstanceOf,
  isPlainObject,
  objectDefineProperty,
  objectDefineProperties,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectEntries,
  reflectOwnKeys,
  stringFrom,
  weakMapCreate,
  weakMapGet,
  weakMapHas,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';
import {
  HeuristicRepresentationSelector,
  Strategy,
  Task,
  isTrustedTask,
  strategyFor
} from './representation.mjs';

function errorMessage(error) {
  return isInstanceOf(error, Error) ? error.message : stringFrom(error);
}

const TRUSTED_PLANS = weakMapCreate();
const TRUSTED_ACTION_REPORTS = weakMapCreate();
const TRUSTED_ACTION_REPORT_PLANS = weakMapCreate();
const TRUSTED_HARNESS_EXECUTIONS = weakMapCreate();
const TRUSTED_HARNESSES = weakSetCreate();
const NO_INPUT_CONSTRAINT = Symbol('no-input-constraint');

function copyAndFreeze(value, seen = weakMapCreate()) {
  if (typeof value === 'function') {
    throw new TypeError('Harness values must not contain functions');
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (weakMapHas(seen, value)) {
    return weakMapGet(seen, value);
  }

  if (!arrayIsArray(value) && !isPlainObject(value)) {
    throw new TypeError('Harness values must use plain objects and arrays');
  }

  arrayForEach(reflectOwnKeys(value), (key) => {
    if (arrayIsArray(value) && key === 'length') {
      return;
    }
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !descriptor?.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(
        'Harness values must contain only enumerable data properties'
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

function normalizePrediction(prediction, strategy) {
  const normalized = new Prediction({
    expectedObservation: prediction?.expectedObservation,
    expectedLikelihood: prediction?.expectedLikelihood,
    mismatchLikelihood: prediction?.mismatchLikelihood,
    strategyKey: prediction?.strategyKey
  });
  if (normalized.strategyKey !== strategy.reasoningEngine) {
    throw new TypeError('World-model prediction must match the selected reasoning engine');
  }
  return normalized;
}

function snapshotHighSurpriseThreshold(worldModel) {
  const threshold = worldModel?.highSurpriseThreshold;
  return isFiniteNumber(threshold) && threshold >= 0 ? threshold : 1;
}

function normalizeWorldModelSignal(signal, plan, observation) {
  const normalized = copyAndFreeze(signal);
  const predictionError = !sameObservation(
    plan.prediction.expectedObservation,
    observation.actualObservation
  );
  const observationLikelihood = predictionError
    ? plan.prediction.mismatchLikelihood
    : plan.prediction.expectedLikelihood;
  const surpriseNats = surpriseFromLikelihood(observationLikelihood);
  const highSurpriseThreshold = plan.highSurpriseThreshold;
  const surpriseBand = surpriseNats >= highSurpriseThreshold
    ? SURPRISE_BANDS.HIGH
    : SURPRISE_BANDS.LOW;
  if (
    !normalized
    || typeof normalized !== 'object'
    || typeof normalized.predictionError !== 'boolean'
    || !isFiniteNumber(normalized.surpriseNats)
    || normalized.surpriseNats < 0
    || normalized.predictionError !== predictionError
    || normalized.expectedLikelihood !== plan.prediction.expectedLikelihood
    || normalized.observationLikelihood !== observationLikelihood
    || normalized.surpriseNats !== surpriseNats
    || normalized.surpriseBand !== surpriseBand
    || (normalized.surpriseBand !== SURPRISE_BANDS.LOW
      && normalized.surpriseBand !== SURPRISE_BANDS.HIGH)
    || normalized.strategyKey !== plan.strategy.reasoningEngine
    || !sameObservation(normalized.actualObservation, observation.actualObservation)
  ) {
    throw new TypeError(
      'World-model signal must match the selected prediction, reasoning engine, and observed outcome'
    );
  }
  return normalized;
}

export class Plan {
  constructor({
    task,
    strategy,
    prediction,
    strategyProfile = null,
    highSurpriseThreshold = 1
  }) {
    if (!isTrustedTask(task) || !isInstanceOf(strategy, Strategy)) {
      throw new TypeError('Plan requires a Task and Strategy');
    }
    if (!isFiniteNumber(highSurpriseThreshold) || highSurpriseThreshold < 0) {
      throw new TypeError('Plan high-surprise threshold must be a non-negative finite number');
    }

    this.task = task;
    this.strategy = strategy;
    this.prediction = prediction;
    this.strategyProfile = strategyProfile;
    this.highSurpriseThreshold = highSurpriseThreshold;
    objectFreeze(this);
  }
}

export function isTrustedPlan(plan, harness = null) {
  const owner = typeof plan === 'object' && plan !== null
    ? weakMapGet(TRUSTED_PLANS, plan)
    : undefined;
  return typeof plan === 'object'
    && plan !== null
    && isFrozenObject(plan)
    && owner !== undefined
    && (harness === null || owner === harness);
}

export function isTrustedActionReport(
  report,
  harness = null,
  plan = null,
  input = NO_INPUT_CONSTRAINT
) {
  const owner = typeof report === 'object' && report !== null
    ? weakMapGet(TRUSTED_ACTION_REPORTS, report)
    : undefined;
  const sourcePlan = typeof report === 'object' && report !== null
    ? weakMapGet(TRUSTED_ACTION_REPORT_PLANS, report)
    : undefined;
  return typeof report === 'object'
    && report !== null
    && isFrozenObject(report)
    && owner !== undefined
    && (harness === null || owner === harness)
    && (plan === null || sourcePlan === plan)
    && (input === NO_INPUT_CONSTRAINT || sameInput(report.input, input));
}

export function isTrustedHarness(harness) {
  return typeof harness === 'object'
    && harness !== null
    && weakSetHas(TRUSTED_HARNESSES, harness);
}

export class FluidHarness {
  #record({
    plan,
    actualObservation,
    input = null,
    result,
    verification = null,
    verificationExecution = null
  }) {
    if (!isTrustedPlan(plan, this)) {
      throw new TypeError('record requires a trusted Plan');
    }
    if (
      isTrustedVerification(verification)
      && !isTrustedVerification(verification, verificationExecution)
    ) {
      throw new TypeError('record requires verification for the current execution');
    }

    const observation = new Observation({
      actualObservation: isInstanceOf(actualObservation, Observation)
        ? actualObservation.actualObservation
        : actualObservation
    });
    const normalizedResult = freezeActionValue(result);
    const signal = normalizeWorldModelSignal(
      this.worldModel.measure(plan.prediction, observation),
      plan,
      observation
    );
    const evidence = evidenceForVerification(verification);
    const learningSignal = objectFreeze({
      ...signal,
      evidence,
      verified: evidence === EVIDENCE_LEVELS.PROVEN,
      ...(isTrustedVerification(verification)
        ? { verification, verificationExecution }
        : {})
    });
    this.worldModel = this.worldModel.update(learningSignal);
    const strategyProfile = copyAndFreeze(
      this.worldModel.profile(plan.strategy.reasoningEngine)
    );

    const report = new ActionReport({
      task: plan.task,
      strategy: plan.strategy,
      prediction: plan.prediction,
      observation,
      input: input === null ? null : copyAndFreeze(input),
      result: normalizedResult,
      signal,
      verification,
      verificationExecution,
      strategyProfile,
      priorStrategyProfile: plan.strategyProfile
    });
    weakMapSet(TRUSTED_ACTION_REPORTS, report, this);
    weakMapSet(TRUSTED_ACTION_REPORT_PLANS, report, plan);
    return report;
  }

  constructor({
    selector = new HeuristicRepresentationSelector(),
    worldModel = new WorldModel(),
    executorRegistry = new ExecutorRegistry(),
    verifierRegistry = new VerifierRegistry()
  } = {}) {
    const plan = this.plan;
    const record = this.record;
    const recordFailure = this.recordFailure;
    const execute = this.execute;
    objectDefineProperties(this, {
      plan: {
        value: plan,
        enumerable: false,
        writable: true,
        configurable: true
      },
      record: {
        value: record,
        enumerable: false,
        writable: true,
        configurable: true
      },
      recordFailure: {
        value: recordFailure,
        enumerable: false,
        writable: true,
        configurable: true
      },
      execute: {
        value: execute,
        enumerable: false,
        writable: true,
        configurable: true
      },
      selector: {
        value: selector,
        enumerable: true,
        writable: false,
        configurable: false
      },
      executorRegistry: {
        value: executorRegistry,
        enumerable: true,
        writable: false,
        configurable: false
      },
      verifierRegistry: {
        value: verifierRegistry,
        enumerable: true,
        writable: false,
        configurable: false
      }
    });
    this.worldModel = worldModel;
    this.lastFailureLearningError = null;
    weakSetAdd(TRUSTED_HARNESSES, this);
  }

  plan(taskInput) {
    const task = isTrustedTask(taskInput) ? taskInput : new Task(taskInput);
    const strategy = strategyFor(task, this.selector);
    const strategyProfile = copyAndFreeze(
      this.worldModel.profile(strategy.reasoningEngine)
    );
    const prediction = normalizePrediction(
      this.worldModel.predict(strategy),
      strategy
    );
    const highSurpriseThreshold = snapshotHighSurpriseThreshold(this.worldModel);

    const plan = new Plan({
      task,
      strategy,
      prediction,
      strategyProfile,
      highSurpriseThreshold
    });
    weakMapSet(TRUSTED_PLANS, plan, this);
    return plan;
  }

  record({
    plan,
    actualObservation,
    result,
    verification = null
  }) {
    if (isTrustedVerification(verification)) {
      throw new TypeError('manual record cannot accept a trusted verification');
    }

    return this.#record({
      plan,
      actualObservation,
      result,
      verification
    });
  }

  recordFailure({ plan, error }) {
    if (!isTrustedPlan(plan, this)) {
      throw new TypeError('recordFailure requires a trusted Plan');
    }

    const failureReason = errorMessage(error);
    const observation = new Observation({
      actualObservation: `execution failed: ${failureReason}`
    });
    const signal = normalizeWorldModelSignal(
      this.worldModel.measure(plan.prediction, observation),
      plan,
      observation
    );
    const learningSignal = objectFreeze({
      ...signal,
      evidence: EVIDENCE_LEVELS.OBSERVED,
      verified: false,
      failure: true,
      failureReason
    });
    this.worldModel = this.worldModel.update(learningSignal);
    return this.worldModel.profile(plan.strategy.reasoningEngine);
  }

  execute({
    plan,
    input,
    reproduction = 'FluidHarness.execute',
    executionOptions = {}
  }) {
    if (!isTrustedPlan(plan, this)) {
      throw new TypeError('execute requires a trusted Plan');
    }

    const normalizedExecutionOptions = copyAndFreeze(executionOptions);
    const normalizedInput = copyAndFreeze(input);
    this.lastFailureLearningError = null;
    let execution;
    let verification;
    try {
      execution = this.executorRegistry.execute({
        task: plan.task,
        strategy: plan.strategy,
        input: normalizedInput,
        executionOptions: normalizedExecutionOptions
      });
      if (!isTrustedExecution(execution, this.executorRegistry)) {
        throw new TypeError('execute requires execution from the current executor registry');
      }
      const executionOwner = weakMapGet(TRUSTED_HARNESS_EXECUTIONS, execution);
      if (executionOwner !== undefined) {
        throw new TypeError(executionOwner === this
          ? 'execute received an already-consumed execution'
          : 'execute received an execution consumed by another harness');
      }
      weakMapSet(TRUSTED_HARNESS_EXECUTIONS, execution, this);
      verification = this.verifierRegistry.verify(execution, { reproduction });
      return this.#record({
        plan,
        actualObservation: execution.observation,
        input: normalizedInput,
        result: execution.result,
        verification,
        verificationExecution: execution
      });
    } catch (error) {
      try {
        this.recordFailure({ plan, error });
      } catch (learningError) {
        this.lastFailureLearningError = learningError;
      }
      throw error;
    }

  }
}

objectFreeze(FluidHarness.prototype);
