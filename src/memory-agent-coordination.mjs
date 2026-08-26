import { isTrustedAgentArchitectureAdoption } from './agent-architecture.mjs';
import { isTrustedEvidenceLedger } from './evidence-ledger.mjs';
import {
  isTrustedMemoryAwareAgentEnsembleReport,
  MemoryAwareAgentEnsembleRunner,
  memoryAwareAgentEnsembleFromArchitectureAdoption
} from './memory-agent-ensemble.mjs';
import {
  isTrustedMemoryAwareAgentLedgerReceipt
} from './memory-agent.mjs';
import { snapshotProcessData } from './process-boundary.mjs';
import {
  arrayEvery,
  arrayFilter,
  arrayForEach,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arrayReduce,
  arraySlice,
  arraySome,
  isInstanceOf,
  isFrozenObject,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  reflectOwnKeys,
  stringFrom,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_MEMORY_AGENT_COORDINATION_REPORTS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_COORDINATION_RUNNERS = weakSetCreate();
const COORDINATION_TOKEN = objectFreeze({});
const MINIMUM_MEMORY_AGENT_COORDINATION_AGENTS = 2;
const MAXIMUM_MEMORY_AGENT_COORDINATION_AGENTS = 4;
const MAXIMUM_MEMORY_AGENT_COORDINATION_ROUNDS = 4;
const MEMORY_AGENT_COORDINATION_RUN_KEYS = objectFreeze([
  'adoption',
  'agentGoal',
  'context',
  'ledger',
  'query',
  'reproduction'
]);
const MEMORY_AGENT_COORDINATION_CONSENSUS_KEYS = objectFreeze([
  'allComplete',
  'allProven',
  'attemptedAgents',
  'auditValidAgents',
  'completedAgents',
  'dataOnly',
  'failedAgents',
  'provenAgents',
  'quorum',
  'quorumMet',
  'round',
  'authorityTransferred'
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

function requireDataObject(value, field, allowedKeys) {
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
      || !arrayIncludes(allowedKeys, key)
    ) {
      throw new TypeError(`${field} must contain only enumerable data properties`);
    }
  });
  return value;
}

function errorMessage(error) {
  return isInstanceOf(error, Error) ? error.message : stringFrom(error);
}

function peerEvidenceFor(report, round) {
  return snapshotProcessData(arrayMap(report.members, (member) => ({
    memberIndex: member.index,
    round,
    plannerId: member.plannerId,
    architectureId: member.architectureId,
    previousArchitectureId: member.previousArchitectureId,
    completed: member.completed,
    proven: member.proven,
    auditValid: member.auditValid,
    memoryResultCount: member.memoryResultCount,
    actionsUsed: member.actionsUsed,
    error: member.error
  })));
}

function consensusFor(report, round) {
  return snapshotProcessData({
    round,
    attemptedAgents: report.attemptedAgents,
    completedAgents: report.completedAgents,
    provenAgents: report.provenAgents,
    auditValidAgents: arrayFilter(
      report.members,
      (member) => member.auditValid
    ).length,
    failedAgents: report.attemptedAgents - report.completedAgents,
    quorum: report.quorum,
    quorumMet: report.quorumMet,
    allComplete: report.allComplete,
    allProven: report.allProven,
    dataOnly: true,
    authorityTransferred: false
  });
}

function validConsensusSummary(summary, report, expectedRound) {
  if (
    !isPlainObject(summary)
    || !isFrozenObject(summary)
    || objectGetPrototypeOf(summary) !== Object.prototype
    || reflectOwnKeys(summary).length !== MEMORY_AGENT_COORDINATION_CONSENSUS_KEYS.length
    || arraySome(
      reflectOwnKeys(summary),
      (key) => !arrayIncludes(MEMORY_AGENT_COORDINATION_CONSENSUS_KEYS, key)
    )
  ) {
    return false;
  }
  return summary.round === expectedRound
    && summary.attemptedAgents === report.attemptedAgents
    && summary.completedAgents === report.completedAgents
    && summary.provenAgents === report.provenAgents
    && summary.auditValidAgents === arrayFilter(
      report.members,
      (member) => member.auditValid
    ).length
    && summary.failedAgents === report.attemptedAgents - report.completedAgents
    && summary.quorum === report.quorum
    && summary.quorumMet === report.quorumMet
    && summary.allComplete === report.allComplete
    && summary.allProven === report.allProven
    && summary.dataOnly === true
    && summary.authorityTransferred === false;
}

function contextFor(baseContext, round, peerEvidence, peerConsensus) {
  const source = baseContext === null ? {} : baseContext;
  return snapshotProcessData({
    ...source,
    coordination: {
      round,
      peerEvidence,
      peerConsensus
    }
  });
}

function persistRound(agents, ledger) {
  return snapshotProcessData(arrayMap(agents, (agent, index) => {
    try {
      const receipt = agent.persistRun({ ledger });
      if (!isTrustedMemoryAwareAgentLedgerReceipt(receipt)) {
        throw new TypeError('Memory-aware coordination received an untrusted ledger receipt');
      }
      return {
        index,
        persisted: true,
        sequence: receipt.sequence,
        ledgerLength: receipt.ledgerLength,
        architectureId: receipt.architectureId,
        error: null
      };
    } catch (error) {
      return {
        index,
        persisted: false,
        sequence: null,
        ledgerLength: ledger.length,
        architectureId: agent.architectureId,
        error: errorMessage(error)
      };
    }
  }));
}

function persistenceCount(persistence) {
  let count = 0;
  arrayForEach(persistence, (round) => {
    arrayForEach(round, (entry) => {
      if (entry.persisted === true) {
        count += 1;
      }
    });
  });
  return count;
}

export class MemoryAwareAgentCoordinationReport {
  constructor({
    runner,
    rounds,
    peerMessages,
    roundConsensus,
    persistence,
    goal,
    query,
    context,
    reproduction,
    ledgerLengthBefore,
    ledgerLengthAfter,
    token
  }) {
    if (
      token !== COORDINATION_TOKEN
      || !isTrustedMemoryAwareAgentCoordinationRunner(runner)
      || !arrayIsArray(rounds)
      || rounds.length === 0
      || rounds.length > runner.maxRounds
      || arraySome(rounds, (round) => !isTrustedMemoryAwareAgentEnsembleReport(round))
      || !arrayIsArray(peerMessages)
      || peerMessages.length !== rounds.length
      || arraySome(peerMessages, (message) => !arrayIsArray(message))
      || !arrayIsArray(roundConsensus)
      || roundConsensus.length !== rounds.length
      || arraySome(
        roundConsensus,
        (summary, index) => !validConsensusSummary(summary, rounds[index], index + 1)
      )
      || !arrayIsArray(persistence)
      || persistence.length !== rounds.length
      || arraySome(
        persistence,
        (round, index) => !arrayIsArray(round) || round.length !== rounds[index].members.length
      )
      || !isPlainObject(query)
      || (context !== null && !isPlainObject(context))
      || !isSafeInteger(ledgerLengthBefore)
      || ledgerLengthBefore < 0
      || !isSafeInteger(ledgerLengthAfter)
      || ledgerLengthAfter < ledgerLengthBefore
    ) {
      throw new TypeError('Memory-aware coordination requires trusted finite round evidence');
    }
    this.rounds = objectFreeze(arraySlice(rounds));
    this.peerMessages = objectFreeze(arraySlice(peerMessages));
    this.roundConsensus = objectFreeze(arraySlice(roundConsensus));
    this.persistence = objectFreeze(arraySlice(persistence));
    this.goal = requireNonEmptyString(goal, 'Memory-aware coordination goal');
    this.query = query;
    this.context = context;
    this.reproduction = requireNonEmptyString(
      reproduction,
      'Memory-aware coordination reproduction'
    );
    this.roundCount = rounds.length;
    this.finalRound = rounds[rounds.length - 1];
    this.finalQuorumMet = this.finalRound.quorumMet;
    this.allRoundsQuorumMet = arrayEvery(rounds, (round) => round.quorumMet);
    this.allRoundsComplete = arrayEvery(rounds, (round) => round.allComplete);
    this.allRoundsProven = arrayEvery(rounds, (round) => round.allProven);
    this.persistedRuns = persistenceCount(persistence);
    this.expectedPersistedRuns = arrayReduce(rounds,
      (total, round) => total + round.members.length,
      0
    );
    this.persistenceComplete = this.persistedRuns === this.expectedPersistedRuns;
    this.ledgerLengthBefore = ledgerLengthBefore;
    this.ledgerLengthAfter = ledgerLengthAfter;
    this.messagesDataOnly = true;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_MEMORY_AGENT_COORDINATION_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedMemoryAwareAgentCoordinationReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_COORDINATION_REPORTS, report)
    && isFrozenObject(report)
    && objectGetPrototypeOf(report) === MemoryAwareAgentCoordinationReport.prototype;
}

export class MemoryAwareAgentCoordinationRunner {
  constructor({
    agentCount = MINIMUM_MEMORY_AGENT_COORDINATION_AGENTS,
    maxRounds = 2,
    minimumProvenAgents = agentCount
  } = {}) {
    this.agentCount = requirePositiveInteger(
      agentCount,
      'Memory-aware coordination agentCount'
    );
    if (this.agentCount < MINIMUM_MEMORY_AGENT_COORDINATION_AGENTS) {
      throw new RangeError(
        `Memory-aware coordination agentCount must be at least ${MINIMUM_MEMORY_AGENT_COORDINATION_AGENTS}`
      );
    }
    if (this.agentCount > MAXIMUM_MEMORY_AGENT_COORDINATION_AGENTS) {
      throw new RangeError(
        `Memory-aware coordination agentCount cannot exceed ${MAXIMUM_MEMORY_AGENT_COORDINATION_AGENTS}`
      );
    }
    this.maxRounds = requirePositiveInteger(
      maxRounds,
      'Memory-aware coordination maxRounds'
    );
    if (this.maxRounds > MAXIMUM_MEMORY_AGENT_COORDINATION_ROUNDS) {
      throw new RangeError(
        `Memory-aware coordination maxRounds cannot exceed ${MAXIMUM_MEMORY_AGENT_COORDINATION_ROUNDS}`
      );
    }
    this.minimumProvenAgents = requirePositiveInteger(
      minimumProvenAgents,
      'Memory-aware coordination minimumProvenAgents'
    );
    if (this.minimumProvenAgents > this.agentCount) {
      throw new RangeError(
        'Memory-aware coordination minimumProvenAgents cannot exceed agentCount'
      );
    }
    this.ensembleRunner = new MemoryAwareAgentEnsembleRunner({
      maxAgents: this.agentCount,
      minimumProvenAgents: this.minimumProvenAgents
    });
    weakSetAdd(TRUSTED_MEMORY_AGENT_COORDINATION_RUNNERS, this);
    objectFreeze(this);
  }

  run(options = {}) {
    if (!isTrustedMemoryAwareAgentCoordinationRunner(this)) {
      throw new TypeError('Memory-aware coordination requires an exact trusted runner');
    }
    requireDataObject(
      options,
      'Memory-aware coordination options',
      MEMORY_AGENT_COORDINATION_RUN_KEYS
    );
    const {
      adoption,
      agentGoal,
      context = null,
      ledger,
      query = {},
      reproduction = 'MemoryAwareAgentCoordinationRunner.run'
    } = options;
    if (!isTrustedAgentArchitectureAdoption(adoption)) {
      throw new TypeError('Memory-aware coordination requires trusted adoption evidence');
    }
    if (!isTrustedEvidenceLedger(ledger)) {
      throw new TypeError('Memory-aware coordination requires a trusted evidence ledger');
    }
    if (!isPlainObject(query)) {
      throw new TypeError('Memory-aware coordination query must be a plain object');
    }
    if (context !== null && !isPlainObject(context)) {
      throw new TypeError('Memory-aware coordination context must be a plain object or null');
    }
    const normalizedGoal = requireNonEmptyString(agentGoal, 'Memory-aware coordination agentGoal');
    const normalizedQuery = snapshotProcessData(query);
    const normalizedContext = context === null ? null : snapshotProcessData(context);
    const normalizedReproduction = requireNonEmptyString(
      reproduction,
      'Memory-aware coordination reproduction'
    );
    const ledgerLengthBefore = ledger.length;
    const rounds = [];
    const peerMessages = [];
    const roundConsensus = [];
    const persistence = [];
    let peerEvidence = objectFreeze([]);
    let peerConsensus = null;
    for (let round = 1; round <= this.maxRounds; round += 1) {
      const agents = memoryAwareAgentEnsembleFromArchitectureAdoption({
        adoption,
        ledger,
        agentCount: this.agentCount
      });
      const ensembleReport = this.ensembleRunner.run({
        agents,
        goal: normalizedGoal,
        query: normalizedQuery,
        context: contextFor(normalizedContext, round, peerEvidence, peerConsensus),
        reproduction: `${normalizedReproduction}#round-${round}`
      });
      if (!isTrustedMemoryAwareAgentEnsembleReport(ensembleReport)) {
        throw new TypeError('Memory-aware coordination received an untrusted ensemble report');
      }
      arrayPush(rounds, ensembleReport);
      const consensus = consensusFor(ensembleReport, round);
      arrayPush(roundConsensus, consensus);
      arrayPush(persistence, persistRound(agents, ledger));
      peerEvidence = peerEvidenceFor(ensembleReport, round);
      peerConsensus = consensus;
      arrayPush(peerMessages, peerEvidence);
    }
    return new MemoryAwareAgentCoordinationReport({
      runner: this,
      rounds,
      peerMessages,
      roundConsensus,
      persistence,
      goal: normalizedGoal,
      query: normalizedQuery,
      context: normalizedContext,
      reproduction: normalizedReproduction,
      ledgerLengthBefore,
      ledgerLengthAfter: ledger.length,
      token: COORDINATION_TOKEN
    });
  }
}

export function isTrustedMemoryAwareAgentCoordinationRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_COORDINATION_RUNNERS, runner)
    && isFrozenObject(runner)
    && objectGetPrototypeOf(runner) === MemoryAwareAgentCoordinationRunner.prototype;
}

objectFreeze(MemoryAwareAgentCoordinationReport.prototype);
objectFreeze(MemoryAwareAgentCoordinationRunner.prototype);
