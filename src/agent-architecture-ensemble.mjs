import {
  isTrustedAgentArchitectureAgent
} from './agent-architecture-runtime.mjs';
import {
  isTrustedAgentRunReport
} from './agent.mjs';
import { EVIDENCE_LEVELS } from './evidence.mjs';
import { snapshotProcessData } from './process-boundary.mjs';
import {
  arrayEvery,
  arrayFilter,
  arrayIsArray,
  arrayMap,
  arraySlice,
  arraySome,
  isInstanceOf,
  isSafeInteger,
  objectFreeze,
  objectGetPrototypeOf,
  setFromArray,
  setSize,
  stringFrom,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_AGENT_ARCHITECTURE_ENSEMBLE_MEMBERS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_ENSEMBLE_REPORTS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_ENSEMBLE_RUNNERS = weakSetCreate();
const ENSEMBLE_MEMBER_TOKEN = objectFreeze({});
const MINIMUM_ENSEMBLE_AGENTS = 2;

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

function provenRun(report) {
  return isTrustedAgentRunReport(report)
    && report.completed === true
    && report.cycles.length > 0
    && arrayEvery(
      report.cycles,
      (cycle) => cycle.action.evidence === EVIDENCE_LEVELS.PROVEN
    );
}

export class AgentArchitectureEnsembleMemberReport {
  constructor({
    agent,
    index,
    runReport = null,
    error = null,
    token
  }) {
    if (
      token !== ENSEMBLE_MEMBER_TOKEN
      || !isTrustedAgentArchitectureAgent(agent)
      || !isSafeInteger(index)
      || index < 0
      || (runReport !== null && !isTrustedAgentRunReport(runReport))
    ) {
      throw new TypeError('Architecture ensemble member requires trusted agent evidence');
    }
    this.agent = agent;
    this.index = index;
    this.agentId = agent.architectureId;
    this.runReport = runReport;
    this.error = error === null ? null : stringFrom(error);
    this.completed = this.error === null
      && runReport !== null
      && runReport.completed === true;
    this.proven = this.completed && provenRun(runReport);
    this.auditValid = runReport?.auditValid === true;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_ENSEMBLE_MEMBERS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureEnsembleMemberReport(member) {
  return typeof member === 'object'
    && member !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_ENSEMBLE_MEMBERS, member)
    && objectGetPrototypeOf(member) === AgentArchitectureEnsembleMemberReport.prototype;
}

export class AgentArchitectureEnsembleReport {
  constructor({
    runner,
    agents,
    members,
    goal,
    context,
    reproduction,
    quorum,
    token
  }) {
    if (
      token !== ENSEMBLE_MEMBER_TOKEN
      || !isTrustedAgentArchitectureEnsembleRunner(runner)
      || !arrayIsArray(agents)
      || agents.length < MINIMUM_ENSEMBLE_AGENTS
      || arraySome(agents, (agent) => !isTrustedAgentArchitectureAgent(agent))
      || !arrayIsArray(members)
      || members.length !== agents.length
      || arraySome(members, (member) => !isTrustedAgentArchitectureEnsembleMemberReport(member))
      || !isSafeInteger(quorum)
      || quorum < 1
      || quorum > agents.length
    ) {
      throw new TypeError('Architecture ensemble report requires trusted bounded evidence');
    }
    this.agents = objectFreeze(arraySlice(agents));
    this.members = objectFreeze(arraySlice(members));
    this.goal = requireNonEmptyString(goal, 'Architecture ensemble goal');
    this.context = context;
    this.reproduction = requireNonEmptyString(reproduction, 'Architecture ensemble reproduction');
    this.quorum = quorum;
    this.attemptedAgents = members.length;
    this.completedAgents = arrayFilter(members, (member) => member.completed).length;
    this.provenAgents = arrayFilter(members, (member) => member.proven).length;
    this.auditValid = arrayEvery(members, (member) => member.auditValid);
    this.allComplete = this.completedAgents === this.attemptedAgents;
    this.allProven = this.provenAgents === this.attemptedAgents;
    this.quorumMet = this.provenAgents >= this.quorum;
    this.deployed = false;
    this.dataOnly = false;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_ENSEMBLE_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureEnsembleReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_ENSEMBLE_REPORTS, report)
    && objectGetPrototypeOf(report) === AgentArchitectureEnsembleReport.prototype;
}

export class AgentArchitectureEnsembleRunner {
  constructor({
    maxAgents = 4,
    minimumProvenAgents = MINIMUM_ENSEMBLE_AGENTS
  } = {}) {
    this.maxAgents = requirePositiveInteger(maxAgents, 'Architecture ensemble maxAgents');
    if (this.maxAgents < MINIMUM_ENSEMBLE_AGENTS) {
      throw new RangeError(
        `Architecture ensemble maxAgents must be at least ${MINIMUM_ENSEMBLE_AGENTS}`
      );
    }
    this.minimumProvenAgents = requirePositiveInteger(
      minimumProvenAgents,
      'Architecture ensemble minimumProvenAgents'
    );
    if (this.minimumProvenAgents > this.maxAgents) {
      throw new RangeError(
        'Architecture ensemble minimumProvenAgents cannot exceed maxAgents'
      );
    }
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_ENSEMBLE_RUNNERS, this);
    objectFreeze(this);
  }

  run({
    agents,
    goal,
    context = null,
    reproduction = 'AgentArchitectureEnsembleRunner.run'
  } = {}) {
    if (!isTrustedAgentArchitectureEnsembleRunner(this)) {
      throw new TypeError('Architecture ensemble requires an exact trusted runner');
    }
    if (!arrayIsArray(agents)) {
      throw new TypeError('Architecture ensemble requires agents');
    }
    if (agents.length < MINIMUM_ENSEMBLE_AGENTS || agents.length > this.maxAgents) {
      throw new RangeError(
        `Architecture ensemble requires ${MINIMUM_ENSEMBLE_AGENTS}-${this.maxAgents} agents`
      );
    }
    const trustedAgents = arrayMap(agents, (agent) => {
      if (!isTrustedAgentArchitectureAgent(agent)) {
        throw new TypeError('Architecture ensemble agents must be trusted runtimes');
      }
      return agent;
    });
    if (setSize(setFromArray(trustedAgents)) !== trustedAgents.length) {
      throw new TypeError('Architecture ensemble agents must be distinct');
    }
    if (setSize(setFromArray(arrayMap(trustedAgents, ({ planner }) => planner))) !== trustedAgents.length) {
      throw new TypeError('Architecture ensemble planners must be distinct');
    }
    if (setSize(setFromArray(arrayMap(trustedAgents, ({ runner }) => runner))) !== trustedAgents.length) {
      throw new TypeError('Architecture ensemble bounded runners must be distinct');
    }
    const normalizedGoal = requireNonEmptyString(goal, 'Architecture ensemble goal');
    const normalizedContext = context === null ? null : snapshotProcessData(context);
    const normalizedReproduction = requireNonEmptyString(
      reproduction,
      'Architecture ensemble reproduction'
    );
    const members = arrayMap(trustedAgents, (agent, index) => {
      try {
        const runReport = agent.run({
          goal: normalizedGoal,
          context: normalizedContext,
          reproduction: `${normalizedReproduction}#${index + 1}`
        });
        if (!isTrustedAgentRunReport(runReport)) {
          throw new TypeError('Architecture ensemble member returned an untrusted run report');
        }
        return new AgentArchitectureEnsembleMemberReport({
          agent,
          index,
          runReport,
          token: ENSEMBLE_MEMBER_TOKEN
        });
      } catch (error) {
        return new AgentArchitectureEnsembleMemberReport({
          agent,
          index,
          error: errorMessage(error),
          token: ENSEMBLE_MEMBER_TOKEN
        });
      }
    });
    return new AgentArchitectureEnsembleReport({
      runner: this,
      agents: trustedAgents,
      members,
      goal: normalizedGoal,
      context: normalizedContext,
      reproduction: normalizedReproduction,
      quorum: this.minimumProvenAgents,
      token: ENSEMBLE_MEMBER_TOKEN
    });
  }
}

export function isTrustedAgentArchitectureEnsembleRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_ENSEMBLE_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === AgentArchitectureEnsembleRunner.prototype;
}

objectFreeze(AgentArchitectureEnsembleMemberReport.prototype);
objectFreeze(AgentArchitectureEnsembleReport.prototype);
objectFreeze(AgentArchitectureEnsembleRunner.prototype);
