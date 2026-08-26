import {
  isTrustedAgentArchitectureSessionRunner,
  isTrustedAgentArchitectureSessionReport
} from './agent-architecture-session.mjs';
import {
  arrayEvery,
  arrayAt,
  arrayFilter,
  arrayForEach,
  arrayIsArray,
  arrayMap,
  arraySome,
  arraySlice,
  arraySort,
  highResolutionTime,
  isFiniteNumber,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectGetPrototypeOf,
  setFromArray,
  setAdd,
  setHas,
  setSize,
  stringTrim,
  toNumber,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_AGENT_ARCHITECTURE_SCALING_LEVELS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_SCALING_POINTS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_SCALING_CURVES = weakSetCreate();
const SESSION_SCALING_MINIMUM_AGENTS = 2;

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

export class AgentArchitectureSessionScalingLevel {
  constructor({
    id,
    computeUnits,
    agentCount,
    maxRounds,
    minimumProvenAgents = agentCount
  } = {}) {
    this.id = requireNonEmptyString(id, 'Architecture session scaling level id');
    this.computeUnits = requirePositiveInteger(
      computeUnits,
      'Architecture session scaling computeUnits'
    );
    this.agentCount = requirePositiveInteger(
      agentCount,
      'Architecture session scaling agentCount'
    );
    if (this.agentCount < SESSION_SCALING_MINIMUM_AGENTS) {
      throw new RangeError(
        `Architecture session scaling agentCount must be at least ${SESSION_SCALING_MINIMUM_AGENTS}`
      );
    }
    this.maxRounds = requirePositiveInteger(
      maxRounds,
      'Architecture session scaling maxRounds'
    );
    this.minimumProvenAgents = requirePositiveInteger(
      minimumProvenAgents,
      'Architecture session scaling minimumProvenAgents'
    );
    if (this.minimumProvenAgents > this.agentCount) {
      throw new RangeError(
        'Architecture session scaling minimumProvenAgents cannot exceed agentCount'
      );
    }
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_SCALING_LEVELS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureSessionScalingLevel(level) {
  return typeof level === 'object'
    && level !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_SCALING_LEVELS, level)
    && objectGetPrototypeOf(level) === AgentArchitectureSessionScalingLevel.prototype;
}

export class AgentArchitectureSessionScalingPoint {
  constructor({
    level,
    completedAgents,
    provenAgents,
    completedRounds,
    provenRounds,
    allRoundsComplete,
    finalQuorumMet,
    allRoundsQuorumMet,
    elapsedMs
  } = {}) {
    if (!isTrustedAgentArchitectureSessionScalingLevel(level)) {
      throw new TypeError('Architecture session scaling point requires a trusted level');
    }
    this.levelId = level.id;
    this.computeUnits = level.computeUnits;
    this.agentCount = level.agentCount;
    this.maxRounds = level.maxRounds;
    this.minimumProvenAgents = level.minimumProvenAgents;
    this.completedAgents = requireNonNegativeInteger(
      completedAgents,
      'Architecture session scaling completedAgents'
    );
    this.provenAgents = requireNonNegativeInteger(
      provenAgents,
      'Architecture session scaling provenAgents'
    );
    this.completedRounds = requirePositiveInteger(
      completedRounds,
      'Architecture session scaling completedRounds'
    );
    this.provenRounds = requireNonNegativeInteger(
      provenRounds,
      'Architecture session scaling provenRounds'
    );
    this.allRoundsComplete = allRoundsComplete === true;
    this.finalQuorumMet = finalQuorumMet === true;
    this.allRoundsQuorumMet = allRoundsQuorumMet === true;
    if (this.completedAgents > this.agentCount || this.provenAgents > this.agentCount) {
      throw new RangeError('Architecture session scaling agent counts exceed agentCount');
    }
    if (this.provenAgents > this.completedAgents) {
      throw new RangeError('Architecture session scaling provenAgents exceed completedAgents');
    }
    if (this.completedRounds > level.maxRounds || this.provenRounds > this.completedRounds) {
      throw new RangeError('Architecture session scaling round counts are invalid');
    }
    this.successRate = this.finalQuorumMet ? 1 : 0;
    this.provenRate = this.completedRounds === 0
      ? 0
      : requireRate(
        this.provenRounds / this.completedRounds,
        'Architecture session scaling provenRate'
      );
    if (!isFiniteNumber(elapsedMs) || elapsedMs < 0) {
      throw new TypeError('Architecture session scaling elapsedMs must be non-negative');
    }
    this.elapsedMs = elapsedMs;
    this.complete = this.allRoundsComplete;
    this.deployed = false;
    this.constitutionalMutation = false;
    this.dataOnly = true;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_SCALING_POINTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureSessionScalingPoint(point) {
  return typeof point === 'object'
    && point !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_SCALING_POINTS, point)
    && objectGetPrototypeOf(point) === AgentArchitectureSessionScalingPoint.prototype;
}

export function agentArchitectureSessionScalingFrontier(points) {
  if (
    !arrayIsArray(points)
    || arraySomeMissing(points)
  ) {
    throw new TypeError('Architecture session scaling frontier requires trusted points');
  }
  return objectFreeze(arraySort(
    arrayFilter(points, (point, index) => arrayEvery(points, (other, otherIndex) => (
      index === otherIndex || !dominates(other, point)
    ))),
    (left, right) => left.computeUnits - right.computeUnits
  ));
}

function arraySomeMissing(points) {
  return arraySome(points, (point) => !isTrustedAgentArchitectureSessionScalingPoint(point));
}

export class AgentArchitectureSessionScalingCurve {
  constructor({ candidateId, points } = {}) {
    this.candidateId = requireNonEmptyString(
      candidateId,
      'Architecture session scaling candidateId'
    );
    if (!arrayIsArray(points) || points.length === 0) {
      throw new TypeError('Architecture session scaling curve requires points');
    }
    if (arraySomeMissing(points)) {
      throw new TypeError('Architecture session scaling curve points must be trusted');
    }
    const sortedPoints = arraySort(
      arraySlice(points),
      (left, right) => left.computeUnits - right.computeUnits
    );
    if (
      setSize(setFromArray(arrayMap(sortedPoints, (point) => point.computeUnits)))
      !== sortedPoints.length
    ) {
      throw new TypeError('Architecture session scaling computeUnits must be unique');
    }
    if (
      setSize(setFromArray(arrayMap(sortedPoints, (point) => point.levelId)))
      !== sortedPoints.length
    ) {
      throw new TypeError('Architecture session scaling level ids must be unique');
    }
    this.points = objectFreeze(sortedPoints);
    this.frontier = agentArchitectureSessionScalingFrontier(this.points);
    this.complete = arrayEvery(this.points, (point) => point.complete);
    this.dataOnly = true;
    objectFreeze(this);
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_SCALING_CURVES, this);
  }
}

export function isTrustedAgentArchitectureSessionScalingCurve(curve) {
  return typeof curve === 'object'
    && curve !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_SCALING_CURVES, curve)
    && objectGetPrototypeOf(curve) === AgentArchitectureSessionScalingCurve.prototype;
}

export class AgentArchitectureSessionScalingRunner {
  constructor({ sessionFactory, runOptionsFactory } = {}) {
    if (typeof sessionFactory !== 'function') {
      throw new TypeError('Architecture session scaling sessionFactory must be a function');
    }
    if (typeof runOptionsFactory !== 'function') {
      throw new TypeError('Architecture session scaling runOptionsFactory must be a function');
    }
    this.sessionFactory = sessionFactory;
    this.runOptionsFactory = runOptionsFactory;
    objectFreeze(this);
  }

  evaluate({ candidateId = 'architecture-session', levels } = {}) {
    if (!arrayIsArray(levels) || levels.length === 0) {
      throw new TypeError('Architecture session scaling requires at least one level');
    }
    const scalingLevels = arrayMap(levels, (level) => (
      isTrustedAgentArchitectureSessionScalingLevel(level)
        ? level
        : new AgentArchitectureSessionScalingLevel(level)
    ));
    const sessions = setFromArray([]);
    const coordinationRunners = setFromArray([]);
    const agents = setFromArray([]);
    const points = arrayMap(scalingLevels, (level) => {
      const session = this.sessionFactory({ level });
      if (!isTrustedAgentArchitectureSessionRunner(session)) {
        throw new TypeError(
          'Architecture session scaling sessionFactory must return a trusted session'
        );
      }
      if (setHas(sessions, session)) {
        throw new TypeError(
          'Architecture session scaling sessionFactory must return a fresh session per level'
        );
      }
      if (
        session.agentCount !== level.agentCount
        || session.maxRounds !== level.maxRounds
        || session.minimumProvenAgents !== level.minimumProvenAgents
      ) {
        throw new TypeError('Architecture session scaling level does not match session limits');
      }
      if (setHas(coordinationRunners, session.coordinationRunner)) {
        throw new TypeError(
          'Architecture session scaling requires fresh coordination runners per level'
        );
      }
      setAdd(sessions, session);
      setAdd(coordinationRunners, session.coordinationRunner);
      const options = this.runOptionsFactory({ level });
      if (!isPlainObject(options)) {
        throw new TypeError('Architecture session scaling runOptionsFactory must return a plain object');
      }
      const started = highResolutionTime();
      const report = session.run(options);
      const elapsedMs = toNumber(highResolutionTime() - started) / 1_000_000;
      if (!isTrustedAgentArchitectureSessionReport(report)) {
        throw new TypeError('Architecture session scaling returned an untrusted session report');
      }
      if (
        report.agents.length !== level.agentCount
        || report.coordination.roundCount !== level.maxRounds
        || report.coordination.rounds[0].quorum !== level.minimumProvenAgents
      ) {
        throw new TypeError('Architecture session scaling report does not match level limits');
      }
      arrayForEach(report.agents, (agent) => {
        if (setHas(agents, agent)) {
          throw new TypeError('Architecture session scaling reused an agent across levels');
        }
        setAdd(agents, agent);
      });
      return new AgentArchitectureSessionScalingPoint({
        level,
        completedAgents: arrayAt(report.coordination.rounds, -1).completedAgents,
        provenAgents: arrayAt(report.coordination.rounds, -1).provenAgents,
        completedRounds: report.coordination.rounds.length,
        provenRounds: arrayFilter(
          report.coordination.rounds,
          (round) => round.allProven
        ).length,
        allRoundsComplete: report.coordination.allRoundsComplete,
        finalQuorumMet: report.finalQuorumMet,
        allRoundsQuorumMet: report.allRoundsQuorumMet,
        elapsedMs
      });
    });
    return new AgentArchitectureSessionScalingCurve({ candidateId, points });
  }
}

objectFreeze(AgentArchitectureSessionScalingLevel.prototype);
objectFreeze(AgentArchitectureSessionScalingPoint.prototype);
objectFreeze(AgentArchitectureSessionScalingCurve.prototype);
objectFreeze(AgentArchitectureSessionScalingRunner.prototype);
