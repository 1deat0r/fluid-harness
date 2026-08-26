import { FluidHarness, isTrustedHarness } from './harness.mjs';
import {
  arrayCreate,
  arrayEvery,
  arrayFilter,
  arrayForEach,
  arrayIsArray,
  arrayMap,
  arraySlice,
  arraySome,
  arraySort,
  highResolutionTime,
  isFiniteNumber,
  isFrozenObject,
  isInstanceOf,
  isPlainObject,
  isSafeInteger,
  objectDefineProperty,
  objectEntries,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  reflectOwnKeys,
  setAdd,
  setFromArray,
  setHas,
  setSize,
  stringTrim,
  toNumber,
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
  EvaluationBudget,
  EvaluationRunner,
  POLICY_MODES
} from './evaluation.mjs';

const TRUSTED_SCALING_CURVES = weakSetCreate();
const TRUSTED_SCALING_LEVELS = weakSetCreate();

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

function requireNonNegativeInteger(value, field) {
  if (!isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative integer (safe integer required)`);
  }
  return value;
}

function requireNonNegativeNumber(value, field) {
  if (!isFiniteNumber(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative number`);
  }
  return value;
}

function copyAndFreeze(value, seen = weakMapCreate()) {
  if (typeof value === 'function') {
    throw new TypeError('Scaling snapshot values must not contain functions');
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (weakMapHas(seen, value)) {
    return weakMapGet(seen, value);
  }

  if (!arrayIsArray(value) && !isPlainObject(value)) {
    throw new TypeError('Scaling snapshot values must use plain objects and arrays');
  }

  arrayForEach(reflectOwnKeys(value), (key) => {
    if (arrayIsArray(value) && key === 'length') {
      return;
    }
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !descriptor?.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(
        'Scaling snapshot values must contain only enumerable data properties'
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

function proofValue(rate) {
  return rate === null ? 0 : rate;
}

function dominates(left, right) {
  const noWorse = left.successRate >= right.successRate
    && proofValue(left.provenRate) >= proofValue(right.provenRate)
    && left.computeUnits <= right.computeUnits;
  const strictlyBetter = left.successRate > right.successRate
    || proofValue(left.provenRate) > proofValue(right.provenRate)
    || left.computeUnits < right.computeUnits;
  return noWorse && strictlyBetter;
}

export class ScalingLevel {
  constructor({ id, computeUnits, executionOptions = {} }) {
    this.id = requireNonEmptyString(id, 'Scaling level id');
    this.computeUnits = requirePositiveInteger(computeUnits, 'Scaling computeUnits');
    if (!executionOptions || typeof executionOptions !== 'object' || arrayIsArray(executionOptions)) {
      throw new TypeError('Scaling executionOptions must be an object');
    }
    this.executionOptions = copyAndFreeze(executionOptions);
    weakSetAdd(TRUSTED_SCALING_LEVELS, this);
    objectFreeze(this);
  }
}

export function isTrustedScalingLevel(level) {
  return typeof level === 'object'
    && level !== null
    && weakSetHas(TRUSTED_SCALING_LEVELS, level)
    && objectGetPrototypeOf(level) === ScalingLevel.prototype;
}

export class ScalingPoint {
  constructor({
    levelId,
    computeUnits,
    eligibleCases,
    attemptedCases,
    successes,
    proofEligibleCases,
    proven,
    highSurpriseCases,
    elapsedMs,
    complete,
    transferMatrix
  }) {
    this.levelId = requireNonEmptyString(levelId, 'Scaling point levelId');
    this.computeUnits = requirePositiveInteger(computeUnits, 'Scaling point computeUnits');
    this.eligibleCases = requireNonNegativeInteger(eligibleCases, 'Scaling point eligibleCases');
    this.attemptedCases = requireNonNegativeInteger(attemptedCases, 'Scaling point attemptedCases');
    this.successes = requireNonNegativeInteger(successes, 'Scaling point successes');
    this.proofEligibleCases = requireNonNegativeInteger(
      proofEligibleCases,
      'Scaling point proofEligibleCases'
    );
    this.proven = requireNonNegativeInteger(proven, 'Scaling point proven');
    this.highSurpriseCases = requireNonNegativeInteger(
      highSurpriseCases,
      'Scaling point highSurpriseCases'
    );
    this.elapsedMs = requireNonNegativeNumber(elapsedMs, 'Scaling point elapsedMs');
    this.complete = toBoolean(complete);

    if (this.attemptedCases > this.eligibleCases) {
      throw new RangeError('Scaling attemptedCases cannot exceed eligibleCases');
    }
    if (this.successes > this.attemptedCases) {
      throw new RangeError('Scaling successes cannot exceed attemptedCases');
    }
    if (this.proofEligibleCases > this.attemptedCases) {
      throw new RangeError('Scaling proofEligibleCases cannot exceed attemptedCases');
    }
    if (this.proven > this.proofEligibleCases) {
      throw new RangeError('Scaling proven cannot exceed proofEligibleCases');
    }

    this.successRate = this.attemptedCases === 0
      ? 0
      : this.successes / this.attemptedCases;
    this.provenRate = this.proofEligibleCases === 0
      ? null
      : this.proven / this.proofEligibleCases;
    this.transferMatrix = copyAndFreeze(transferMatrix ?? {});
    objectFreeze(this);
  }
}

export function paretoFrontier(points) {
  if (!arrayIsArray(points) || arraySome(points, (point) => !isInstanceOf(point, ScalingPoint))) {
    throw new TypeError('Pareto frontier requires ScalingPoint instances');
  }

  return objectFreeze(arraySort(
    arrayFilter(points, (point, index) => arrayEvery(points, (other, otherIndex) => (
      index === otherIndex || !dominates(other, point)
    ))),
    (left, right) => left.computeUnits - right.computeUnits
  ));
}

export class ScalingCurve {
  constructor({ candidateId, mode, points }) {
    this.candidateId = requireNonEmptyString(candidateId, 'Scaling candidate id');
    this.mode = requireNonEmptyString(mode, 'Scaling mode');
    if (!arrayIsArray(points) || points.length === 0) {
      throw new TypeError('ScalingCurve requires at least one point');
    }
    if (arraySome(points, (point) => !isInstanceOf(point, ScalingPoint))) {
      throw new TypeError('ScalingCurve points must be ScalingPoint instances');
    }

    const sortedPoints = arraySort(
      arraySlice(points),
      (left, right) => left.computeUnits - right.computeUnits
    );
    if (setSize(setFromArray(arrayMap(sortedPoints, (point) => point.computeUnits))) !== sortedPoints.length) {
      throw new TypeError('ScalingCurve computeUnits must be unique');
    }
    if (setSize(setFromArray(arrayMap(sortedPoints, (point) => point.levelId))) !== sortedPoints.length) {
      throw new TypeError('ScalingCurve level ids must be unique');
    }

    this.points = objectFreeze(sortedPoints);
    this.frontier = paretoFrontier(this.points);
    this.complete = arrayEvery(this.points, (point) => point.complete);
    objectFreeze(this);
  }
}

export function isTrustedScalingCurve(curve) {
  return typeof curve === 'object'
    && curve !== null
    && isFrozenObject(curve)
    && weakSetHas(TRUSTED_SCALING_CURVES, curve);
}

export class ScalingRunner {
  constructor({ harnessFactory = () => new FluidHarness() } = {}) {
    if (typeof harnessFactory !== 'function') {
      throw new TypeError('ScalingRunner harnessFactory must be a function');
    }
    this.harnessFactory = harnessFactory;
    objectFreeze(this);
  }

  evaluate({
    candidateId = 'default-kernel',
    cases,
    mode = POLICY_MODES.RESEARCH,
    levels
  }) {
    if (!arrayIsArray(cases) || cases.length === 0) {
      throw new TypeError('Scaling evaluation requires at least one case');
    }
    if (!arrayIsArray(levels) || levels.length === 0) {
      throw new TypeError('Scaling evaluation requires at least one level');
    }
    const evaluationCases = objectFreeze(arraySlice(cases));

    const scalingLevels = arrayMap(levels, (level) => isTrustedScalingLevel(level)
      ? level
      : new ScalingLevel(level));
    const harnesses = setFromArray([]);
    const selectors = setFromArray([]);
    const worldModels = setFromArray([]);
    const executorRegistries = setFromArray([]);
    const verifierRegistries = setFromArray([]);
    const executors = setFromArray([]);
    const verifierFunctions = setFromArray([]);
    const points = arrayMap(scalingLevels, (level) => {
      const harness = this.harnessFactory();
      if (!isTrustedHarness(harness)) {
        throw new TypeError(
          'Scaling harnessFactory must return a FluidHarness; a trusted FluidHarness instance is required'
        );
      }
      if (setHas(harnesses, harness)) {
        throw new TypeError('Scaling harnessFactory must return a fresh harness for each level');
      }
      if (
        setHas(selectors, harness.selector)
        || setHas(worldModels, harness.worldModel)
        || setHas(executorRegistries, harness.executorRegistry)
        || setHas(verifierRegistries, harness.verifierRegistry)
        || arraySome(harness.executorRegistry.executors, (executor) => setHas(executors, executor))
        || arraySome(harness.verifierRegistry.verifiers, ({ verify }) => setHas(verifierFunctions, verify))
      ) {
        throw new TypeError('Scaling harnessFactory must return fresh harness dependencies and registry internals for each level');
      }
      setAdd(harnesses, harness);
      setAdd(selectors, harness.selector);
      setAdd(worldModels, harness.worldModel);
      setAdd(executorRegistries, harness.executorRegistry);
      setAdd(verifierRegistries, harness.verifierRegistry);
      arrayForEach(harness.executorRegistry.executors, (executor) => {
        setAdd(executors, executor);
      });
      arrayForEach(harness.verifierRegistry.verifiers, (verifier) => {
        const verify = verifier.verify;
        setAdd(verifierFunctions, verify);
      });
      const runner = new EvaluationRunner({ harness });
      const started = highResolutionTime();
      const report = runner.evaluate({
        candidateId,
        cases: evaluationCases,
        mode,
        budget: new EvaluationBudget({ maxCases: evaluationCases.length }),
        executionOptions: level.executionOptions
      });
      const elapsedMs = toNumber(highResolutionTime() - started) / 1_000_000;

      return new ScalingPoint({
        levelId: level.id,
        computeUnits: level.computeUnits,
        eligibleCases: report.eligibleCases,
        attemptedCases: report.attemptedCases,
        successes: report.successes,
        proofEligibleCases: report.proofEligibleCases,
        proven: report.proven,
        highSurpriseCases: report.highSurpriseCases,
        elapsedMs,
        complete: report.complete,
        transferMatrix: report.transferMatrix
      });
    });

    const curve = new ScalingCurve({ candidateId, mode, points });
    weakSetAdd(TRUSTED_SCALING_CURVES, curve);
    return curve;
  }
}

objectFreeze(ScalingRunner.prototype);
