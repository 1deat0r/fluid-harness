import { EVIDENCE_LEVELS } from './evidence.mjs';
import {
  isTrustedEvidenceLedger
} from './evidence-ledger.mjs';
import {
  isTrustedMemoryAwareAgent,
  isTrustedMemoryAwareAgentRunReport,
  memoryAwareAgentFromArchitectureAdoption
} from './memory-agent.mjs';
import { snapshotProcessData } from './process-boundary.mjs';
import {
  arrayEvery,
  arrayFilter,
  arrayForEach,
  arrayIsArray,
  arrayIncludes,
  arrayMap,
  arrayPush,
  arraySlice,
  arraySome,
  isInstanceOf,
  isPlainObject,
  isSafeInteger,
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
import { isTrustedAgentArchitectureAdoption } from './agent-architecture.mjs';

const TRUSTED_MEMORY_AGENT_ENSEMBLE_MEMBER_REPORTS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_ENSEMBLE_REPORTS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_ENSEMBLE_RUNNERS = weakSetCreate();
const ENSEMBLE_TOKEN = objectFreeze({});
export const MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE = 2;
export const MAXIMUM_MEMORY_AGENT_ENSEMBLE_SIZE = 4;
const MEMORY_AGENT_ENSEMBLE_FACTORY_KEYS = objectFreeze([
  'adoption',
  'agentCount',
  'idPrefix',
  'ledger',
  'maxEntries',
  'toolRegistry'
]);

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

function errorMessage(error) {
  return isInstanceOf(error, Error) ? error.message : stringFrom(error);
}

function contextForMember(baseContext, index) {
  const source = baseContext === null ? {} : baseContext;
  return snapshotProcessData({
    ...source,
    memoryAwareEnsemble: {
      memberIndex: index
    }
  });
}

function provenRun(report) {
  return isTrustedMemoryAwareAgentRunReport(report)
    && report.run.completed === true
    && report.run.auditValid === true
    && report.run.actionEvidence.length > 0
    && arrayEvery(
      report.run.actionEvidence,
      (evidence) => evidence === EVIDENCE_LEVELS.PROVEN
    );
}

export class MemoryAwareAgentEnsembleMemberReport {
  constructor({
    agent,
    index,
    runReport = null,
    error = null,
    token
  }) {
    if (
      token !== ENSEMBLE_TOKEN
      || !isTrustedMemoryAwareAgent(agent)
      || !isSafeInteger(index)
      || index < 0
      || (runReport !== null && !isTrustedMemoryAwareAgentRunReport(runReport))
    ) {
      throw new TypeError('Memory-aware ensemble member requires trusted agent evidence');
    }
    this.index = index;
    this.plannerId = agent.planner.plannerId;
    this.architectureId = agent.architectureId;
    this.previousArchitectureId = agent.previousArchitectureId;
    this.error = error === null ? null : stringFrom(error);
    this.completed = this.error === null
      && runReport !== null
      && runReport.run.completed === true;
    this.proven = this.completed && provenRun(runReport);
    this.auditValid = runReport?.run.auditValid === true;
    this.memoryResultCount = runReport?.memoryContext.resultCount ?? 0;
    this.actionsUsed = runReport?.run.actionsUsed ?? 0;
    this.actionEvidence = objectFreeze(
      arraySlice(runReport?.run.actionEvidence ?? [])
    );
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_MEMORY_AGENT_ENSEMBLE_MEMBER_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedMemoryAwareAgentEnsembleMemberReport(member) {
  return typeof member === 'object'
    && member !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_ENSEMBLE_MEMBER_REPORTS, member)
    && objectGetPrototypeOf(member) === MemoryAwareAgentEnsembleMemberReport.prototype;
}

export class MemoryAwareAgentEnsembleReport {
  constructor({
    runner,
    members,
    goal,
    query,
    context,
    reproduction,
    quorum,
    token
  }) {
    if (
      token !== ENSEMBLE_TOKEN
      || !isTrustedMemoryAwareAgentEnsembleRunner(runner)
      || !arrayIsArray(members)
      || members.length < MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE
      || arraySome(
        members,
        (member) => !isTrustedMemoryAwareAgentEnsembleMemberReport(member)
      )
      || !isSafeInteger(quorum)
      || quorum < 1
      || quorum > members.length
      || !isPlainObject(query)
      || (context !== null && !isPlainObject(context))
    ) {
      throw new TypeError('Memory-aware ensemble report requires trusted bounded evidence');
    }
    this.members = objectFreeze(arraySlice(members));
    this.goal = requireNonEmptyString(goal, 'Memory-aware ensemble goal');
    this.query = query;
    this.context = context;
    this.reproduction = requireNonEmptyString(
      reproduction,
      'Memory-aware ensemble reproduction'
    );
    this.quorum = quorum;
    this.attemptedAgents = members.length;
    this.completedAgents = arrayFilter(members, (member) => member.completed).length;
    this.provenAgents = arrayFilter(members, (member) => member.proven).length;
    this.auditValid = arrayEvery(members, (member) => member.auditValid);
    this.allComplete = this.completedAgents === this.attemptedAgents;
    this.allProven = this.provenAgents === this.attemptedAgents;
    this.quorumMet = this.provenAgents >= this.quorum;
    this.dataOnly = true;
    this.authorityTransferred = false;
    objectFreeze(this);
    weakSetAdd(TRUSTED_MEMORY_AGENT_ENSEMBLE_REPORTS, this);
  }
}

export function isTrustedMemoryAwareAgentEnsembleReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_ENSEMBLE_REPORTS, report)
    && objectGetPrototypeOf(report) === MemoryAwareAgentEnsembleReport.prototype;
}

export class MemoryAwareAgentEnsembleRunner {
  constructor({
    maxAgents = 4,
    minimumProvenAgents = MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE
  } = {}) {
    this.maxAgents = requirePositiveInteger(maxAgents, 'Memory-aware ensemble maxAgents');
    if (this.maxAgents < MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE) {
      throw new RangeError(
        `Memory-aware ensemble maxAgents must be at least ${MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE}`
      );
    }
    if (this.maxAgents > MAXIMUM_MEMORY_AGENT_ENSEMBLE_SIZE) {
      throw new RangeError(
        `Memory-aware ensemble maxAgents cannot exceed ${MAXIMUM_MEMORY_AGENT_ENSEMBLE_SIZE}`
      );
    }
    this.minimumProvenAgents = requirePositiveInteger(
      minimumProvenAgents,
      'Memory-aware ensemble minimumProvenAgents'
    );
    if (this.minimumProvenAgents > this.maxAgents) {
      throw new RangeError(
        'Memory-aware ensemble minimumProvenAgents cannot exceed maxAgents'
      );
    }
    weakSetAdd(TRUSTED_MEMORY_AGENT_ENSEMBLE_RUNNERS, this);
    objectFreeze(this);
  }

  run({
    agents,
    goal,
    query = {},
    context = null,
    reproduction = 'MemoryAwareAgentEnsembleRunner.run'
  } = {}) {
    if (!isTrustedMemoryAwareAgentEnsembleRunner(this)) {
      throw new TypeError('Memory-aware ensemble requires an exact trusted runner');
    }
    if (!arrayIsArray(agents)) {
      throw new TypeError('Memory-aware ensemble requires agents');
    }
    if (
      agents.length < MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE
      || agents.length > this.maxAgents
    ) {
      throw new RangeError(
        `Memory-aware ensemble requires ${MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE}-${this.maxAgents} agents`
      );
    }
    const trustedAgents = arrayMap(agents, (agent) => {
      if (!isTrustedMemoryAwareAgent(agent)) {
        throw new TypeError('Memory-aware ensemble agents must be trusted');
      }
      return agent;
    });
    if (setSize(setFromArray(trustedAgents)) !== trustedAgents.length) {
      throw new TypeError('Memory-aware ensemble agents must be distinct');
    }
    if (
      setSize(setFromArray(arrayMap(trustedAgents, (agent) => agent.planner)))
      !== trustedAgents.length
    ) {
      throw new TypeError('Memory-aware ensemble planners must be distinct');
    }
    if (
      setSize(setFromArray(arrayMap(trustedAgents, (agent) => agent.runner)))
      !== trustedAgents.length
    ) {
      throw new TypeError('Memory-aware ensemble bounded runners must be distinct');
    }
    if (!isPlainObject(query)) {
      throw new TypeError('Memory-aware ensemble query must be a plain object');
    }
    if (context !== null && !isPlainObject(context)) {
      throw new TypeError('Memory-aware ensemble context must be a plain object or null');
    }
    const normalizedGoal = requireNonEmptyString(goal, 'Memory-aware ensemble goal');
    const normalizedQuery = snapshotProcessData(query);
    const normalizedContext = context === null ? null : snapshotProcessData(context);
    const normalizedReproduction = requireNonEmptyString(
      reproduction,
      'Memory-aware ensemble reproduction'
    );
    const members = arrayMap(trustedAgents, (agent, index) => {
      try {
        const runReport = agent.run({
          goal: normalizedGoal,
          query: normalizedQuery,
          context: contextForMember(normalizedContext, index),
          reproduction: `${normalizedReproduction}#${index + 1}`
        });
        if (!isTrustedMemoryAwareAgentRunReport(runReport)) {
          throw new TypeError('Memory-aware ensemble member returned untrusted evidence');
        }
        return new MemoryAwareAgentEnsembleMemberReport({
          agent,
          index,
          runReport,
          token: ENSEMBLE_TOKEN
        });
      } catch (error) {
        return new MemoryAwareAgentEnsembleMemberReport({
          agent,
          index,
          error: errorMessage(error),
          token: ENSEMBLE_TOKEN
        });
      }
    });
    return new MemoryAwareAgentEnsembleReport({
      runner: this,
      members,
      goal: normalizedGoal,
      query: normalizedQuery,
      context: normalizedContext,
      reproduction: normalizedReproduction,
      quorum: this.minimumProvenAgents,
      token: ENSEMBLE_TOKEN
    });
  }
}

export function isTrustedMemoryAwareAgentEnsembleRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_ENSEMBLE_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === MemoryAwareAgentEnsembleRunner.prototype;
}

export function memoryAwareAgentEnsembleFromArchitectureAdoption(options = {}) {
  if (!isPlainObject(options)) {
    throw new TypeError('Memory-aware ensemble factory options must be a plain object');
  }
  arrayForEach(reflectOwnKeys(options), (key) => {
    const descriptor = objectGetOwnPropertyDescriptor(options, key);
    if (
      typeof key === 'symbol'
      || !descriptor?.enumerable
      || descriptor.get
      || descriptor.set
      || !arrayIncludes(MEMORY_AGENT_ENSEMBLE_FACTORY_KEYS, key)
    ) {
      throw new TypeError('Memory-aware ensemble factory options must contain only data properties');
    }
  });
  const {
    adoption,
    agentCount = MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE,
    ledger,
    toolRegistry,
    maxEntries,
    idPrefix
  } = options;
  if (!isTrustedAgentArchitectureAdoption(adoption)) {
    throw new TypeError('Memory-aware ensemble factory requires trusted adoption evidence');
  }
  if (!isTrustedEvidenceLedger(ledger)) {
    throw new TypeError('Memory-aware ensemble factory requires a trusted evidence ledger');
  }
  const count = requirePositiveInteger(agentCount, 'Memory-aware ensemble agentCount');
  if (count < MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE) {
    throw new RangeError(
      `Memory-aware ensemble agentCount must be at least ${MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE}`
    );
  }
  if (count > MAXIMUM_MEMORY_AGENT_ENSEMBLE_SIZE) {
    throw new RangeError(
      `Memory-aware ensemble agentCount cannot exceed ${MAXIMUM_MEMORY_AGENT_ENSEMBLE_SIZE}`
    );
  }
  const agents = [];
  for (let index = 0; index < count; index += 1) {
    const factoryOptions = { adoption, ledger };
    if (toolRegistry !== undefined) {
      factoryOptions.toolRegistry = toolRegistry;
    }
    if (maxEntries !== undefined) {
      factoryOptions.maxEntries = maxEntries;
    }
    if (idPrefix !== undefined) {
      factoryOptions.idPrefix = idPrefix;
    }
    arrayPush(agents, memoryAwareAgentFromArchitectureAdoption(factoryOptions));
  }
  return objectFreeze(agents);
}

objectFreeze(MemoryAwareAgentEnsembleMemberReport.prototype);
objectFreeze(MemoryAwareAgentEnsembleReport.prototype);
objectFreeze(MemoryAwareAgentEnsembleRunner.prototype);
