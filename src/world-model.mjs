import { EVIDENCE_LEVELS } from './evidence.mjs';
import { isTrustedVerification } from './verification.mjs';
import {
  absNumber,
  arrayCreate,
  arrayEvery,
  arrayFilter,
  arrayForEach,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arrayReduce,
  arraySlice,
  arraySort,
  isFiniteNumber,
  isPlainObject,
  logNumber,
  maxNumber,
  minNumbers,
  objectDefineProperty,
  objectEntries,
  objectFromEntries,
  objectFreeze,
  objectHasOwn,
  objectIs,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectKeys,
  objectValues,
  reflectOwnKeys,
  setFromArray,
  setHas,
  stringTrim,
  weakMapCreate,
  weakMapGet,
  weakMapHas,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const SURPRISE_BANDS = objectFreeze({
  LOW: 'LOW',
  HIGH: 'HIGH'
});

const EXPECTED_OBSERVATIONS = objectFreeze({
  'graph-algorithms': 'graph path resolved',
  'constraint-solver': 'constraint solution resolved',
  'program-synthesis': 'program synthesized',
  'bayesian-inference': 'bayesian posterior computed',
  'monte-carlo-search': 'search completed',
  'numerical-optimizer': 'optimization completed',
  'simulation-engine': 'simulation completed',
  'theorem-prover': 'theorem proved',
  'query-planner': 'query completed',
  'array-computer': 'array computation completed',
  'language-model': 'model response completed'
});

const VALID_EVIDENCE = setFromArray(objectValues(EVIDENCE_LEVELS));
const TRUSTED_LEARNING_EXECUTIONS = weakMapCreate();

function copyAndFreeze(value, seen = weakMapCreate()) {
  if (typeof value === 'function') {
    throw new TypeError('World-model values must not contain functions');
  }
  if (value === undefined || typeof value === 'symbol' || typeof value === 'bigint') {
    throw new TypeError('World-model values must contain only data-compatible primitives');
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (weakMapHas(seen, value)) {
    return weakMapGet(seen, value);
  }

  if (!arrayIsArray(value) && !isPlainObject(value)) {
    throw new TypeError(
      'World-model values must use plain objects and arrays; mutable containers are not supported'
    );
  }

  arrayForEach(reflectOwnKeys(value), (key) => {
    if (arrayIsArray(value) && key === 'length') {
      return;
    }
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !descriptor?.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(
        'World-model values must contain only enumerable data properties'
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

function snapshotObservation(value, message) {
  if (!value) {
    throw new TypeError(message);
  }
  if (typeof value === 'function') {
    throw new TypeError('World-model values must not contain functions');
  }
  if (typeof value === 'symbol' || typeof value === 'bigint') {
    throw new TypeError('World-model values must contain only data-compatible primitives');
  }
  return typeof value === 'object' ? copyAndFreeze(value) : value;
}

export function sameObservation(left, right, pairs = weakMapCreate()) {
  if (objectIs(left, right)) {
    return true;
  }
  if (
    !left
    || !right
    || typeof left !== 'object'
    || typeof right !== 'object'
    || arrayIsArray(left) !== arrayIsArray(right)
  ) {
    return false;
  }
  if (!arrayIsArray(left) && (!isPlainObject(left) || !isPlainObject(right))) {
    return false;
  }
  let matchedRights = weakMapGet(pairs, left);
  if (matchedRights === undefined) {
    matchedRights = weakSetCreate();
    weakMapSet(pairs, left, matchedRights);
  }
  if (weakSetHas(matchedRights, right)) {
    return true;
  }
  weakSetAdd(matchedRights, right);

  if (arrayIsArray(left)) {
    const leftKeys = objectKeys(left);
    const rightKeys = objectKeys(right);
    return left.length === right.length
      && leftKeys.length === rightKeys.length
      && arrayEvery(leftKeys, (key) => (
        objectHasOwn(right, key) && sameObservation(left[key], right[key], pairs)
      ));
  }

  const leftKeys = objectKeys(left);
  const rightKeys = objectKeys(right);
  return leftKeys.length === rightKeys.length
    && arrayEvery(leftKeys, (key) => (
      objectHasOwn(right, key) && sameObservation(left[key], right[key], pairs)
    ));
}

export function surpriseFromLikelihood(likelihood) {
  if (!isFiniteNumber(likelihood) || likelihood <= 0 || likelihood > 1) {
    throw new RangeError('Observation likelihood must be greater than 0 and at most 1');
  }

  return -logNumber(likelihood);
}

export class Prediction {
  constructor({
    expectedObservation,
    expectedLikelihood = 0.8,
    mismatchLikelihood = 0.05,
    strategyKey = 'unknown'
  }) {
    surpriseFromLikelihood(expectedLikelihood);
    surpriseFromLikelihood(mismatchLikelihood);
    this.expectedObservation = snapshotObservation(
      expectedObservation,
      'Prediction requires an expected observation'
    );
    this.expectedLikelihood = expectedLikelihood;
    this.mismatchLikelihood = mismatchLikelihood;
    this.strategyKey = strategyKey;
    objectFreeze(this);
  }
}

export class Observation {
  constructor({ actualObservation }) {
    this.actualObservation = snapshotObservation(
      actualObservation,
      'Observation requires an actual observation'
    );
    objectFreeze(this);
  }
}

export class WorldModel {
  constructor({ highSurpriseThreshold = 1, history = [] } = {}) {
    if (!isFiniteNumber(highSurpriseThreshold) || highSurpriseThreshold < 0) {
      throw new RangeError('High-surprise threshold must be a non-negative number');
    }

    if (!arrayIsArray(history)) {
      throw new TypeError('World-model history must be an array');
    }

    this.highSurpriseThreshold = highSurpriseThreshold;
    this.history = objectFreeze(arrayMap(history, (entry) => copyAndFreeze(entry)));
    objectFreeze(this);
  }

  predict(strategy) {
    const prior = arrayFilter(this.history, (entry) => entry.strategyKey === strategy.reasoningEngine);
    const successes = arrayFilter(prior, (entry) => !entry.predictionError).length;
    const expectedLikelihood = prior.length === 0
      ? 0.8
      : minNumbers([0.99, maxNumber(0.51, (8 + successes) / (10 + prior.length))]);

    return new Prediction({
      expectedObservation: EXPECTED_OBSERVATIONS[strategy.reasoningEngine]
        ?? `strategy ${strategy.reasoningEngine} completed`,
      expectedLikelihood,
      mismatchLikelihood: 0.05,
      strategyKey: strategy.reasoningEngine
    });
  }

  measure(prediction, observation) {
    const predictionError = !sameObservation(
      prediction.expectedObservation,
      observation.actualObservation
    );
    const likelihood = predictionError
      ? prediction.mismatchLikelihood
      : prediction.expectedLikelihood;
    const surpriseNats = surpriseFromLikelihood(likelihood);

    return objectFreeze({
      predictionError,
      surpriseNats,
      strategyKey: prediction.strategyKey,
      actualObservation: observation.actualObservation,
      expectedLikelihood: prediction.expectedLikelihood,
      observationLikelihood: likelihood,
      surpriseBand: surpriseNats >= this.highSurpriseThreshold
        ? SURPRISE_BANDS.HIGH
        : SURPRISE_BANDS.LOW
    });
  }

  update(signal) {
    if (!signal || typeof signal.strategyKey !== 'string' || !isFiniteNumber(signal.surpriseNats)) {
      throw new TypeError('World-model updates require a strategy key and surprise measurement');
    }

    const {
      verification = null,
      verificationExecution = null,
      ...signalWithoutVerification
    } = signal;

    const evidence = signal.evidence === undefined
      ? EVIDENCE_LEVELS.BELIEVED
      : signal.evidence;
    if (!setHas(VALID_EVIDENCE, evidence)) {
      throw new RangeError('World-model updates require a known evidence level');
    }

    const verified = signal.verified === undefined
      ? evidence === EVIDENCE_LEVELS.PROVEN
      : signal.verified;
    if (typeof verified !== 'boolean') {
      throw new TypeError('World-model update verification flag must be boolean');
    }
    if (verified !== (evidence === EVIDENCE_LEVELS.PROVEN)) {
      throw new Error('World-model update verification must match evidence level');
    }
    if (evidence === EVIDENCE_LEVELS.PROVEN) {
      if (
        !verificationExecution
        ||
        !isTrustedVerification(verification, verificationExecution)
        || verification.passed !== true
        || verification.deterministic !== true
        || signalWithoutVerification.strategyKey !== verificationExecution.reasoningEngine
        || signalWithoutVerification.actualObservation !== verificationExecution.observation
      ) {
        throw new TypeError(
          'PROVEN world-model updates require a passing deterministic verification; trusted verification for the current execution is required'
        );
      }
      const owner = weakMapGet(TRUSTED_LEARNING_EXECUTIONS, verificationExecution);
      if (owner !== undefined) {
        throw new TypeError('World-model learning cannot reuse an already-consumed execution');
      }
      weakMapSet(TRUSTED_LEARNING_EXECUTIONS, verificationExecution, this);
    }

    const normalizedSignal = objectFreeze({
      ...signalWithoutVerification,
      evidence,
      verified
    });
    const nextHistory = arraySlice(this.history);
    arrayPush(nextHistory, normalizedSignal);

    return new WorldModel({
      highSurpriseThreshold: this.highSurpriseThreshold,
      history: nextHistory
    });
  }

  profile(strategyKey) {
    if (typeof strategyKey !== 'string' || stringTrim(strategyKey) === '') {
      throw new TypeError('Strategy profile requires a non-empty strategy key');
    }

    const entries = arrayFilter(this.history, (entry) => entry.strategyKey === strategyKey);
    const attempts = entries.length;
    const predictionErrors = arrayFilter(entries, ({ predictionError }) => predictionError === true).length;
    const predictionAccuracy = attempts === 0 ? 0 : (attempts - predictionErrors) / attempts;
    const expectedLikelihoods = arrayFilter(
      arrayMap(entries, ({ expectedLikelihood }) => expectedLikelihood),
      (likelihood) => isFiniteNumber(likelihood)
    );
    const meanExpectedLikelihood = expectedLikelihoods.length === 0
      ? null
      : arrayReduce(expectedLikelihoods, (total, likelihood) => total + likelihood, 0) / expectedLikelihoods.length;
    const surpriseValues = arrayFilter(
      arrayMap(entries, ({ surpriseNats }) => surpriseNats),
      (surprise) => isFiniteNumber(surprise)
    );
    const averageSurpriseNats = surpriseValues.length === 0
      ? 0
      : arrayReduce(surpriseValues, (total, surprise) => total + surprise, 0) / surpriseValues.length;
    const evidenceCounts = objectFromEntries(arrayMap(objectValues(EVIDENCE_LEVELS), (level) => [
      level,
      arrayFilter(entries, (entry) => entry.evidence === level).length
    ]));

    return objectFreeze({
      strategyKey,
      attempts,
      predictionErrors,
      predictionAccuracy,
      meanExpectedLikelihood,
      calibrationGap: meanExpectedLikelihood === null
        ? null
        : absNumber(meanExpectedLikelihood - predictionAccuracy),
      averageSurpriseNats,
      highSurpriseCases: arrayFilter(entries, ({ surpriseBand }) => surpriseBand === SURPRISE_BANDS.HIGH).length,
      failureCases: arrayFilter(entries, ({ failure }) => failure === true).length,
      evidenceCounts: objectFreeze(evidenceCounts),
      provenCases: evidenceCounts[EVIDENCE_LEVELS.PROVEN],
      observedCases: evidenceCounts[EVIDENCE_LEVELS.OBSERVED]
    });
  }

  strategyProfiles() {
    const strategyKeys = [];
    arrayForEach(this.history, ({ strategyKey }) => {
      if (
        typeof strategyKey === 'string'
        && strategyKey !== ''
        && !arrayIncludes(strategyKeys, strategyKey)
      ) {
        arrayPush(strategyKeys, strategyKey);
      }
    });
    arraySort(strategyKeys);
    return objectFreeze(objectFromEntries(arrayMap(strategyKeys, (strategyKey) => [
      strategyKey,
      this.profile(strategyKey)
    ])));
  }
}

objectFreeze(WorldModel.prototype);
