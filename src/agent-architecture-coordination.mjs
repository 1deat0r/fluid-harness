import {
  AgentArchitectureEnsembleRunner,
  isTrustedAgentArchitectureEnsembleReport,
  isTrustedAgentArchitectureEnsembleRunner
} from './agent-architecture-ensemble.mjs';
import { snapshotProcessData } from './process-boundary.mjs';
import {
  arrayEvery,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arraySlice,
  arraySome,
  isInstanceOf,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectGetPrototypeOf,
  stringFrom,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_AGENT_ARCHITECTURE_COORDINATION_REPORTS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_COORDINATION_RUNNERS = weakSetCreate();
const COORDINATION_TOKEN = objectFreeze({});

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

function peerEvidenceFor(report, round) {
  return snapshotProcessData(arrayMap(report.members, (member) => ({
    agentId: member.agentId,
    memberIndex: member.index,
    round,
    completed: member.completed,
    proven: member.proven,
    auditValid: member.auditValid,
    stopReason: member.runReport?.stopReason ?? null,
    error: member.error
  })));
}

function contextFor(baseContext, round, peerEvidence) {
  const source = baseContext === null ? {} : baseContext;
  return snapshotProcessData({
    ...source,
    coordination: {
      round,
      peerEvidence
    }
  });
}

export class AgentArchitectureCoordinationReport {
  constructor({
    runner,
    rounds,
    peerMessages,
    goal,
    context,
    reproduction,
    token
  }) {
    if (
      token !== COORDINATION_TOKEN
      || !isTrustedAgentArchitectureCoordinationRunner(runner)
      || !arrayIsArray(rounds)
      || rounds.length === 0
      || rounds.length > runner.maxRounds
      || arraySome(rounds, (round) => !isTrustedAgentArchitectureEnsembleReport(round))
      || !arrayIsArray(peerMessages)
      || peerMessages.length !== rounds.length
      || arraySome(peerMessages, (message) => !arrayIsArray(message))
    ) {
      throw new TypeError('Architecture coordination requires trusted finite round evidence');
    }
    this.rounds = objectFreeze(arraySlice(rounds));
    this.peerMessages = objectFreeze(arraySlice(peerMessages));
    this.goal = requireNonEmptyString(goal, 'Architecture coordination goal');
    this.context = context;
    this.reproduction = requireNonEmptyString(
      reproduction,
      'Architecture coordination reproduction'
    );
    this.roundCount = rounds.length;
    this.finalRound = rounds[rounds.length - 1];
    this.finalQuorumMet = this.finalRound.quorumMet;
    this.allRoundsQuorumMet = arrayEvery(rounds, (round) => round.quorumMet);
    this.allRoundsComplete = arrayEvery(rounds, (round) => round.allComplete);
    this.allRoundsProven = arrayEvery(rounds, (round) => round.allProven);
    this.messagesDataOnly = true;
    this.deployed = false;
    this.dataOnly = false;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_COORDINATION_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureCoordinationReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_COORDINATION_REPORTS, report)
    && objectGetPrototypeOf(report) === AgentArchitectureCoordinationReport.prototype;
}

export class AgentArchitectureCoordinationRunner {
  constructor({
    maxRounds = 2,
    maxAgents = 4,
    minimumProvenAgents = 2
  } = {}) {
    this.maxRounds = requirePositiveInteger(maxRounds, 'Architecture coordination maxRounds');
    this.ensembleRunner = new AgentArchitectureEnsembleRunner({
      maxAgents,
      minimumProvenAgents
    });
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_COORDINATION_RUNNERS, this);
    objectFreeze(this);
  }

  run({
    agents,
    goal,
    context = null,
    reproduction = 'AgentArchitectureCoordinationRunner.run'
  } = {}) {
    if (!isTrustedAgentArchitectureCoordinationRunner(this)) {
      throw new TypeError('Architecture coordination requires an exact trusted runner');
    }
    if (context !== null && !isPlainObject(context)) {
      throw new TypeError('Architecture coordination context must be a plain object or null');
    }
    const normalizedGoal = requireNonEmptyString(goal, 'Architecture coordination goal');
    const normalizedContext = context === null ? null : snapshotProcessData(context);
    const normalizedReproduction = requireNonEmptyString(
      reproduction,
      'Architecture coordination reproduction'
    );
    const rounds = [];
    const peerMessages = [];
    let peerEvidence = objectFreeze([]);
    for (let round = 1; round <= this.maxRounds; round += 1) {
      const ensembleReport = this.ensembleRunner.run({
        agents,
        goal: normalizedGoal,
        context: contextFor(normalizedContext, round, peerEvidence),
        reproduction: `${normalizedReproduction}#round-${round}`
      });
      arrayPush(rounds, ensembleReport);
      peerEvidence = peerEvidenceFor(ensembleReport, round);
      arrayPush(peerMessages, peerEvidence);
    }
    return new AgentArchitectureCoordinationReport({
      runner: this,
      rounds,
      peerMessages,
      goal: normalizedGoal,
      context: normalizedContext,
      reproduction: normalizedReproduction,
      token: COORDINATION_TOKEN
    });
  }
}

export function isTrustedAgentArchitectureCoordinationRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_COORDINATION_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === AgentArchitectureCoordinationRunner.prototype;
}

objectFreeze(AgentArchitectureCoordinationReport.prototype);
objectFreeze(AgentArchitectureCoordinationRunner.prototype);
