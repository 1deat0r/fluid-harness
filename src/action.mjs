import { evidenceForVerification } from './evidence.mjs';
import { normalizeInputForStrategy, sameInput } from './executor.mjs';
import {
  arrayForEach,
  arrayIsArray,
  arrayMap,
  isFiniteNumber,
  isPlainObject,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  reflectOwnKeys,
  weakSetCreate,
  weakSetAdd,
  weakSetHas
} from './intrinsics.mjs';
import { isTrustedVerification } from './verification.mjs';

function freezeValue(value, seen = weakSetCreate()) {
  if (typeof value === 'function') {
    throw new TypeError('Action report values must not contain functions');
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'number' && !isFiniteNumber(value)) {
      throw new TypeError('Action report values must contain finite numbers');
    }
    return value;
  }

  if (!arrayIsArray(value) && !isPlainObject(value)) {
    throw new TypeError(
      'Action report values must use plain objects and arrays; mutable containers are not supported'
    );
  }

  if (weakSetHas(seen, value)) {
    return value;
  }
  weakSetAdd(seen, value);

  arrayForEach(reflectOwnKeys(value), (key) => {
    if (typeof key === 'symbol') {
      throw new TypeError('Action report values must not contain symbol properties');
    }
    if (arrayIsArray(value) && key === 'length') {
      return;
    }
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError('Action report values must contain only enumerable data properties');
    }
    freezeValue(descriptor.value, seen);
  });
  return objectFreeze(value);
}

export function freezeActionValue(value) {
  return freezeValue(value);
}

export class ActionReport {
  constructor({
    task,
    strategy,
    prediction,
    observation,
    input = null,
    result,
    signal,
    verification = null,
    verificationExecution = null,
    strategyProfile = null,
    priorStrategyProfile = null
  }) {
    if (!task?.id || !strategy || !prediction || !observation || !signal || result === undefined || result === null) {
      throw new TypeError('ActionReport requires task, strategy, prediction, observation, signal, and result');
    }

    const frozenInput = input === null ? null : freezeValue(input);
    const frozenResult = freezeValue(result);
    let inputMatchesExecution = false;
    if (verificationExecution !== null && frozenInput !== null) {
      try {
        inputMatchesExecution = sameInput(
          normalizeInputForStrategy(strategy, frozenInput),
          verificationExecution.input
        );
      } catch {
        inputMatchesExecution = false;
      }
    }

    const trustedVerification = verificationExecution !== null
      && isTrustedVerification(verification, verificationExecution)
      && verificationExecution.taskId === task.id
      && verificationExecution.representation === strategy.representation
      && verificationExecution.reasoningEngine === strategy.reasoningEngine
      && sameInput(verificationExecution.observation, observation.actualObservation)
      && sameInput(verificationExecution.result, frozenResult)
      && inputMatchesExecution;

    this.taskId = task.id;
    this.strategy = strategy;
    this.prediction = prediction;
    this.observation = observation;
    this.input = frozenInput;
    this.result = frozenResult;
    this.predictionError = signal.predictionError;
    this.surpriseNats = signal.surpriseNats;
    this.surpriseBand = signal.surpriseBand;
    this.priorStrategyProfile = priorStrategyProfile === null
      ? null
      : freezeValue(priorStrategyProfile);
    this.strategyProfile = strategyProfile === null ? null : freezeValue(strategyProfile);
    this.evidence = evidenceForVerification(trustedVerification ? verification : null);
    this.verification = trustedVerification ? verification : null;
    this.invariantsChecked = objectFreeze(
      trustedVerification
        ? arrayMap(verification.checks, ({ id }) => id)
        : []
    );
    this.environmentHash = trustedVerification ? verification.environmentHash : null;
    this.reproduction = trustedVerification ? verification.reproduction : null;
    objectFreeze(this);
  }
}
