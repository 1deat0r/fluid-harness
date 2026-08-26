import {
  isTrustedMemoryAwareAgentSessionReport,
  isTrustedMemoryAwareAgentSessionRunner
} from './memory-agent-session.mjs';
import { isTrustedEvidenceLedger } from './evidence-ledger.mjs';
import {
  arrayAt,
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
  isPlainObject,
  isSafeInteger,
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
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_MEMORY_AGENT_SCALING_LEVELS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_SCALING_POINTS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_SCALING_CURVES = weakSetCreate();
const TRUSTED_MEMORY_AGENT_SCALING_RUNNERS = weakSetCreate();
const MEMORY_AGENT_SCALING_MINIMUM_AGENTS = 2;
const MEMORY_AGENT_SCALING_MAXIMUM_AGENTS = 4;
const MEMORY_AGENT_SCALING_MAXIMUM_ROUNDS = 4;

function requireDataObject(value, field) {
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
    ) {
      throw new TypeError(`${field} must contain only enumerable data properties`);
    }
  });
  return value;
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requirePositiveInteger(value, field) {
  if (!isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`);
  }
  return value;
}

function requireNonNegativeInteger(value, field) {
  if (!isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function requireRate(value, field) {
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    throw new RangeError(`${field} must be between 0 and 1`);
  }
  return value;
}

function dominates(left, right) {
  const noWorse = left.successRate >= right.successRate
    && left.provenRate >= right.provenRate
    && left.computeUnits <= right.computeUnits;
  const strictlyBetter = left.successRate > right.successRate
    || left.provenRate > right.provenRate
    || left.computeUnits < right.computeUnits;
  return noWorse && strictlyBetter;
}

export class MemoryAwareAgentSessionScalingLevel {
  constructor({
    id,
    computeUnits,
    agentCount,
    maxRounds,
    minimumProvenAgents = agentCount
  } = {}) {
    this.id = requireNonEmptyString(id, 'Memory-aware session scaling level id');
    this.computeUnits = requirePositiveInteger(
      computeUnits,
      'Memory-aware session scaling computeUnits'
    );
    this.agentCount = requirePositiveInteger(
      agentCount,
      'Memory-aware session scaling agentCount'
    );
    if (this.agentCount < MEMORY_AGENT_SCALING_MINIMUM_AGENTS) {
      throw new RangeError(
        `Memory-aware session scaling agentCount must be at least ${MEMORY_AGENT_SCALING_MINIMUM_AGENTS}`
      );
    }
    if (this.agentCount > MEMORY_AGENT_SCALING_MAXIMUM_AGENTS) {
      throw new RangeError(
        `Memory-aware session scaling agentCount cannot exceed ${MEMORY_AGENT_SCALING_MAXIMUM_AGENTS}`
      );
    }
    this.maxRounds = requirePositiveInteger(
      maxRounds,
      'Memory-aware session scaling maxRounds'
    );
    if (this.maxRounds > MEMORY_AGENT_SCALING_MAXIMUM_ROUNDS) {
      throw new RangeError(
        `Memory-aware session scaling maxRounds cannot exceed ${MEMORY_AGENT_SCALING_MAXIMUM_ROUNDS}`
      );
    }
    this.minimumProvenAgents = requirePositiveInteger(
      minimumProvenAgents,
      'Memory-aware session scaling minimumProvenAgents'
    );
    if (this.minimumProvenAgents > this.agentCount) {
      throw new RangeError(
        'Memory-aware session scaling minimumProvenAgents cannot exceed agentCount'
      );
    }
    weakSetAdd(TRUSTED_MEMORY_AGENT_SCALING_LEVELS, this);
    objectFreeze(this);
  }
}

export function isTrustedMemoryAwareAgentSessionScalingLevel(level) {
  return typeof level === 'object'
    && level !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_SCALING_LEVELS, level)
    && objectGetPrototypeOf(level) === MemoryAwareAgentSessionScalingLevel.prototype;
}

export class MemoryAwareAgentSessionScalingPoint {
  constructor({
    level,
    completedAgents,
    provenAgents,
    completedRounds,
    provenRounds,
    allRoundsComplete,
    finalQuorumMet,
    allRoundsQuorumMet,
    persistenceComplete,
    persistedRuns,
    expectedPersistedRuns,
    elapsedMs
  } = {}) {
    if (!isTrustedMemoryAwareAgentSessionScalingLevel(level)) {
      throw new TypeError('Memory-aware session scaling point requires a trusted level');
    }
    this.levelId = level.id;
    this.computeUnits = level.computeUnits;
    this.agentCount = level.agentCount;
    this.maxRounds = level.maxRounds;
    this.minimumProvenAgents = level.minimumProvenAgents;
    this.completedAgents = requireNonNegativeInteger(
      completedAgents,
      'Memory-aware session scaling completedAgents'
    );
    this.provenAgents = requireNonNegativeInteger(
      provenAgents,
      'Memory-aware session scaling provenAgents'
    );
    this.completedRounds = requirePositiveInteger(
      completedRounds,
      'Memory-aware session scaling completedRounds'
    );
    this.provenRounds = requireNonNegativeInteger(
      provenRounds,
      'Memory-aware session scaling provenRounds'
    );
    this.allRoundsComplete = allRoundsComplete === true;
    this.finalQuorumMet = finalQuorumMet === true;
    this.allRoundsQuorumMet = allRoundsQuorumMet === true;
    this.persistenceComplete = persistenceComplete === true;
    this.persistedRuns = requireNonNegativeInteger(
      persistedRuns,
      'Memory-aware session scaling persistedRuns'
    );
    this.expectedPersistedRuns = requireNonNegativeInteger(
      expectedPersistedRuns,
      'Memory-aware session scaling expectedPersistedRuns'
    );
    if (this.completedAgents > this.agentCount || this.provenAgents > this.agentCount) {
      throw new RangeError('Memory-aware session scaling agent counts exceed agentCount');
    }
    if (this.provenAgents > this.completedAgents) {
      throw new RangeError('Memory-aware session scaling provenAgents exceed completedAgents');
    }
    if (this.completedRounds > level.maxRounds || this.provenRounds > this.completedRounds) {
      throw new RangeError('Memory-aware session scaling round counts are invalid');
    }
    if (this.persistedRuns > this.expectedPersistedRuns) {
      throw new RangeError('Memory-aware session scaling persistedRuns exceed expected runs');
    }
    this.successRate = this.finalQuorumMet ? 1 : 0;
    this.provenRate = requireRate(
      this.provenRounds / this.completedRounds,
      'Memory-aware session scaling provenRate'
    );
    if (!isFiniteNumber(elapsedMs) || elapsedMs < 0) {
      throw new TypeError('Memory-aware session scaling elapsedMs must be non-negative');
    }
    this.elapsedMs = elapsedMs;
    this.complete = this.allRoundsComplete && this.persistenceComplete;
    this.deployed = false;
    this.constitutionalMutation = false;
    this.dataOnly = true;
    weakSetAdd(TRUSTED_MEMORY_AGENT_SCALING_POINTS, this);
    objectFreeze(this);
  }
}

export function isTrustedMemoryAwareAgentSessionScalingPoint(point) {
  return typeof point === 'object'
    && point !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_SCALING_POINTS, point)
    && objectGetPrototypeOf(point) === MemoryAwareAgentSessionScalingPoint.prototype;
}

function arraySomeMissing(points) {
  return arraySome(points, (point) => !isTrustedMemoryAwareAgentSessionScalingPoint(point));
}

export function memoryAwareAgentSessionScalingFrontier(points) {
  if (!arrayIsArray(points) || arraySomeMissing(points)) {
    throw new TypeError('Memory-aware session scaling frontier requires trusted points');
  }
  return objectFreeze(arraySort(
    arrayFilter(points, (point, index) => arrayEvery(points, (other, otherIndex) => (
      index === otherIndex || !dominates(other, point)
    ))),
    (left, right) => left.computeUnits - right.computeUnits
  ));
}

export class MemoryAwareAgentSessionScalingCurve {
  constructor({ candidateId, points } = {}) {
    this.candidateId = requireNonEmptyString(
      candidateId,
      'Memory-aware session scaling candidateId'
    );
    if (!arrayIsArray(points) || points.length === 0) {
      throw new TypeError('Memory-aware session scaling curve requires points');
    }
    if (arraySomeMissing(points)) {
      throw new TypeError('Memory-aware session scaling curve points must be trusted');
    }
    const sortedPoints = arraySort(
      arraySlice(points),
      (left, right) => left.computeUnits - right.computeUnits
    );
    if (
      setSize(setFromArray(arrayMap(sortedPoints, (point) => point.computeUnits)))
      !== sortedPoints.length
    ) {
      throw new TypeError('Memory-aware session scaling computeUnits must be unique');
    }
    if (
      setSize(setFromArray(arrayMap(sortedPoints, (point) => point.levelId)))
      !== sortedPoints.length
    ) {
      throw new TypeError('Memory-aware session scaling level ids must be unique');
    }
    this.points = objectFreeze(sortedPoints);
    this.frontier = memoryAwareAgentSessionScalingFrontier(this.points);
    this.complete = arrayEvery(this.points, (point) => point.complete);
    this.dataOnly = true;
    objectFreeze(this);
    weakSetAdd(TRUSTED_MEMORY_AGENT_SCALING_CURVES, this);
  }
}

export function isTrustedMemoryAwareAgentSessionScalingCurve(curve) {
  return typeof curve === 'object'
    && curve !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_SCALING_CURVES, curve)
    && objectGetPrototypeOf(curve) === MemoryAwareAgentSessionScalingCurve.prototype;
}

export class MemoryAwareAgentSessionScalingRunner {
  constructor({ sessionFactory, runOptionsFactory } = {}) {
    if (typeof sessionFactory !== 'function') {
      throw new TypeError('Memory-aware session scaling sessionFactory must be a function');
    }
    if (typeof runOptionsFactory !== 'function') {
      throw new TypeError('Memory-aware session scaling runOptionsFactory must be a function');
    }
    this.sessionFactory = sessionFactory;
    this.runOptionsFactory = runOptionsFactory;
    weakSetAdd(TRUSTED_MEMORY_AGENT_SCALING_RUNNERS, this);
    objectFreeze(this);
  }

  evaluate({ candidateId = 'memory-aware-agent-session', levels } = {}) {
    if (!isTrustedMemoryAwareAgentSessionScalingRunner(this)) {
      throw new TypeError('Memory-aware session scaling requires an exact trusted runner');
    }
    if (!arrayIsArray(levels) || levels.length === 0) {
      throw new TypeError('Memory-aware session scaling requires at least one level');
    }
    const scalingLevels = arrayMap(levels, (level) => (
      isTrustedMemoryAwareAgentSessionScalingLevel(level)
        ? level
        : new MemoryAwareAgentSessionScalingLevel(level)
    ));
    const sessions = setFromArray([]);
    const discoveryRunners = setFromArray([]);
    const coordinationRunners = setFromArray([]);
    const ledgers = setFromArray([]);
    const points = arrayMap(scalingLevels, (level) => {
      const session = this.sessionFactory({ level });
      if (!isTrustedMemoryAwareAgentSessionRunner(session)) {
        throw new TypeError(
          'Memory-aware session scaling sessionFactory must return a trusted session'
        );
      }
      if (setHas(sessions, session)) {
        throw new TypeError(
          'Memory-aware session scaling sessionFactory must return a fresh session per level'
        );
      }
      if (
        session.agentCount !== level.agentCount
        || session.maxRounds !== level.maxRounds
        || session.minimumProvenAgents !== level.minimumProvenAgents
      ) {
        throw new TypeError('Memory-aware session scaling level does not match session limits');
      }
      if (setHas(discoveryRunners, session.discoveryRunner)) {
        throw new TypeError(
          'Memory-aware session scaling requires fresh discovery runners per level'
        );
      }
      if (setHas(coordinationRunners, session.coordinationRunner)) {
        throw new TypeError(
          'Memory-aware session scaling requires fresh coordination runners per level'
        );
      }
      setAdd(sessions, session);
      setAdd(discoveryRunners, session.discoveryRunner);
      setAdd(coordinationRunners, session.coordinationRunner);
      const options = this.runOptionsFactory({ level });
      requireDataObject(options, 'Memory-aware session scaling run options');
      if (!isTrustedEvidenceLedger(options.ledger)) {
        throw new TypeError(
          'Memory-aware session scaling runOptionsFactory must return a trusted ledger'
        );
      }
      if (setHas(ledgers, options.ledger)) {
        throw new TypeError(
          'Memory-aware session scaling requires a fresh ledger per level'
        );
      }
      setAdd(ledgers, options.ledger);
      const started = highResolutionTime();
      const report = session.run(options);
      const elapsedMs = toNumber(highResolutionTime() - started) / 1_000_000;
      if (!isTrustedMemoryAwareAgentSessionReport(report)) {
        throw new TypeError('Memory-aware session scaling returned an untrusted session report');
      }
      const finalRound = arrayAt(report.coordination.rounds, -1);
      if (
        report.coordination.roundCount !== level.maxRounds
        || finalRound.quorum !== level.minimumProvenAgents
      ) {
        throw new TypeError('Memory-aware session scaling report does not match level limits');
      }
      return new MemoryAwareAgentSessionScalingPoint({
        level,
        completedAgents: finalRound.completedAgents,
        provenAgents: finalRound.provenAgents,
        completedRounds: report.coordination.roundCount,
        provenRounds: arrayFilter(
          report.coordination.rounds,
          (round) => round.allProven
        ).length,
        allRoundsComplete: report.coordination.allRoundsComplete,
        finalQuorumMet: report.finalQuorumMet,
        allRoundsQuorumMet: report.coordination.allRoundsQuorumMet,
        persistenceComplete: report.persistenceComplete,
        persistedRuns: report.coordination.persistedRuns,
        expectedPersistedRuns: report.coordination.expectedPersistedRuns,
        elapsedMs
      });
    });
    return new MemoryAwareAgentSessionScalingCurve({ candidateId, points });
  }
}

export function isTrustedMemoryAwareAgentSessionScalingRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_SCALING_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === MemoryAwareAgentSessionScalingRunner.prototype;
}

objectFreeze(MemoryAwareAgentSessionScalingLevel.prototype);
objectFreeze(MemoryAwareAgentSessionScalingPoint.prototype);
objectFreeze(MemoryAwareAgentSessionScalingCurve.prototype);
objectFreeze(MemoryAwareAgentSessionScalingRunner.prototype);
