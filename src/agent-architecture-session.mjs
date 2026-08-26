import {
  AgentArchitectureCoordinationRunner,
  isTrustedAgentArchitectureCoordinationReport,
  isTrustedAgentArchitectureCoordinationRunner
} from './agent-architecture-coordination.mjs';
import {
  AgentArchitectureDiscoveryRunner,
  isTrustedAgentArchitectureDiscoveryReport
} from './agent-architecture-discovery.mjs';
import {
  isTrustedAgentArchitectureAdoption
} from './agent-architecture.mjs';
import {
  agentFromAdoptedArchitecture,
  isTrustedAgentArchitectureAgent
} from './agent-architecture-runtime.mjs';
import {
  isTrustedAgentArchitectureProposalRunner
} from './agent-architecture-proposal.mjs';
import { snapshotProcessData } from './process-boundary.mjs';
import {
  arrayIsArray,
  arrayPush,
  arraySlice,
  arraySome,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectGetPrototypeOf,
  setFromArray,
  setSize,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_AGENT_ARCHITECTURE_SESSION_REPORTS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_SESSION_RUNNERS = weakSetCreate();
const SESSION_TOKEN = objectFreeze({});
const MINIMUM_SESSION_AGENTS = 2;

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

export class AgentArchitectureSessionReport {
  constructor({
    runner,
    discovery,
    agents,
    coordination,
    architectureGoal,
    agentGoal,
    context,
    reproduction,
    token
  }) {
    if (
      token !== SESSION_TOKEN
      || !isTrustedAgentArchitectureSessionRunner(runner)
      || !isTrustedAgentArchitectureDiscoveryReport(discovery)
      || !isTrustedAgentArchitectureCoordinationReport(coordination)
      || !arrayIsArray(agents)
      || agents.length < MINIMUM_SESSION_AGENTS
      || agents.length !== coordination.rounds[0]?.attemptedAgents
      || arraySome(agents, (agent) => !isTrustedAgentArchitectureAgent(agent))
      || setSize(setFromArray(agents)) !== agents.length
      || !isPlainObject(context)
    ) {
      throw new TypeError('Architecture session requires trusted finite orchestration evidence');
    }
    if (
      discovery.adopted !== true
      || !isTrustedAgentArchitectureAdoption(
        discovery.adoption.adoption,
        runner.discoveryRunner.adoptionAuthority
      )
    ) {
      throw new TypeError('Architecture session requires trusted adopted architecture evidence');
    }
    const firstRound = coordination.rounds[0];
    if (firstRound.agents.length !== agents.length) {
      throw new TypeError('Architecture session coordination agents do not match session agents');
    }
    for (let index = 0; index < agents.length; index += 1) {
      if (firstRound.agents[index] !== agents[index]) {
        throw new TypeError('Architecture session coordination agent identity does not match');
      }
    }
    this.discovery = discovery;
    this.agents = objectFreeze(arraySlice(agents));
    this.coordination = coordination;
    this.architectureGoal = requireNonEmptyString(
      architectureGoal,
      'Architecture session architectureGoal'
    );
    this.agentGoal = requireNonEmptyString(agentGoal, 'Architecture session agentGoal');
    this.context = context;
    this.reproduction = requireNonEmptyString(
      reproduction,
      'Architecture session reproduction'
    );
    this.adopted = true;
    this.freshAgents = true;
    this.finalQuorumMet = coordination.finalQuorumMet;
    this.deployed = false;
    this.constitutionalMutation = false;
    this.dataOnly = false;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_SESSION_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureSessionReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_SESSION_REPORTS, report)
    && objectGetPrototypeOf(report) === AgentArchitectureSessionReport.prototype;
}

export class AgentArchitectureSessionRunner {
  constructor({
    proposalRunner,
    adoptionAuthority = undefined,
    agentCount = 2,
    maxRounds = 2,
    minimumProvenAgents = agentCount
  } = {}) {
    if (!isTrustedAgentArchitectureProposalRunner(proposalRunner)) {
      throw new TypeError('Architecture session requires a trusted proposal runner');
    }
    this.agentCount = requirePositiveInteger(agentCount, 'Architecture session agentCount');
    if (this.agentCount < MINIMUM_SESSION_AGENTS) {
      throw new RangeError(
        `Architecture session agentCount must be at least ${MINIMUM_SESSION_AGENTS}`
      );
    }
    this.maxRounds = requirePositiveInteger(maxRounds, 'Architecture session maxRounds');
    this.minimumProvenAgents = requirePositiveInteger(
      minimumProvenAgents,
      'Architecture session minimumProvenAgents'
    );
    if (this.minimumProvenAgents > this.agentCount) {
      throw new RangeError(
        'Architecture session minimumProvenAgents cannot exceed agentCount'
      );
    }
    this.discoveryRunner = new AgentArchitectureDiscoveryRunner({
      proposalRunner,
      ...(adoptionAuthority === undefined ? {} : { adoptionAuthority })
    });
    this.coordinationRunner = new AgentArchitectureCoordinationRunner({
      maxRounds: this.maxRounds,
      maxAgents: this.agentCount,
      minimumProvenAgents: this.minimumProvenAgents
    });
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_SESSION_RUNNERS, this);
    objectFreeze(this);
  }

  run({
    architectureGoal,
    agentGoal,
    plannerCandidates,
    cases,
    productionBudget,
    researchBudget,
    skepticBudget,
    context = {},
    reproduction = 'AgentArchitectureSessionRunner.run'
  } = {}) {
    if (!isTrustedAgentArchitectureSessionRunner(this)) {
      throw new TypeError('Architecture session requires an exact trusted runner');
    }
    const normalizedArchitectureGoal = requireNonEmptyString(
      architectureGoal,
      'Architecture session architectureGoal'
    );
    const normalizedAgentGoal = requireNonEmptyString(
      agentGoal,
      'Architecture session agentGoal'
    );
    if (!isPlainObject(context)) {
      throw new TypeError('Architecture session context must be a plain object');
    }
    const normalizedContext = snapshotProcessData(context);
    const normalizedReproduction = requireNonEmptyString(
      reproduction,
      'Architecture session reproduction'
    );
    const discovery = this.discoveryRunner.discover({
      goal: normalizedArchitectureGoal,
      plannerCandidates,
      cases,
      productionBudget,
      researchBudget,
      skepticBudget
    });
    if (!isTrustedAgentArchitectureDiscoveryReport(discovery)) {
      throw new TypeError('Architecture session discovery returned untrusted evidence');
    }
    if (
      discovery.adopted !== true
      || !isTrustedAgentArchitectureAdoption(
        discovery.adoption.adoption,
        this.discoveryRunner.adoptionAuthority
      )
    ) {
      throw new Error('Architecture session cannot construct agents without adopted evidence');
    }
    const agents = [];
    for (let index = 0; index < this.agentCount; index += 1) {
      const agent = agentFromAdoptedArchitecture(discovery.adoption.adoption);
      if (!isTrustedAgentArchitectureAgent(agent)) {
        throw new TypeError('Architecture session constructed an untrusted agent');
      }
      arrayPush(agents, agent);
    }
    const coordination = this.coordinationRunner.run({
      agents,
      goal: normalizedAgentGoal,
      context: normalizedContext,
      reproduction: normalizedReproduction
    });
    if (!isTrustedAgentArchitectureCoordinationRunner(this.coordinationRunner)) {
      throw new TypeError('Architecture session coordination runner lost trusted identity');
    }
    if (!isTrustedAgentArchitectureCoordinationReport(coordination)) {
      throw new TypeError('Architecture session coordination returned untrusted evidence');
    }
    return new AgentArchitectureSessionReport({
      runner: this,
      discovery,
      agents,
      coordination,
      architectureGoal: normalizedArchitectureGoal,
      agentGoal: normalizedAgentGoal,
      context: normalizedContext,
      reproduction: normalizedReproduction,
      token: SESSION_TOKEN
    });
  }
}

export function isTrustedAgentArchitectureSessionRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_SESSION_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === AgentArchitectureSessionRunner.prototype;
}

objectFreeze(AgentArchitectureSessionReport.prototype);
objectFreeze(AgentArchitectureSessionRunner.prototype);
