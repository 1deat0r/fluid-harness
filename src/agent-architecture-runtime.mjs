import {
  BoundedAgentRunner,
  isTrustedAgentRunReport,
  isTrustedAgentRunner
} from './agent.mjs';
import {
  architectureFromAdoptedSearch,
  isTrustedAgentArchitectureAdoption,
  isTrustedAgentArchitectureCandidate
} from './agent-architecture.mjs';
import {
  isTrustedAgentEpisodePlan,
  isTrustedAgentPlanner
} from './agent-plan.mjs';
import {
  isTrustedToolRegistry
} from './tool.mjs';
import {
  objectFreeze,
  objectGetPrototypeOf,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_AGENT_ARCHITECTURE_AGENTS = weakSetCreate();
const USED_AGENT_ARCHITECTURE_PLANNERS = weakSetCreate();
const ARCHITECTURE_AGENT_TOKEN = objectFreeze({});

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

export class AgentArchitectureAgent {
  constructor({ adoption, candidate, planner, runner, token }) {
    if (
      token !== ARCHITECTURE_AGENT_TOKEN
      || !isTrustedAgentArchitectureAdoption(adoption)
      || !isTrustedAgentArchitectureCandidate(candidate)
      || architectureFromAdoptedSearch(adoption) !== candidate
      || !isTrustedAgentPlanner(planner)
      || !isTrustedAgentRunner(runner)
    ) {
      throw new TypeError('Architecture agent requires a trusted adopted bundle and runtime');
    }
    this.adoption = adoption;
    this.candidate = candidate;
    this.architectureId = candidate.id;
    this.planner = planner;
    this.runner = runner;
    this.policy = runner.policy;
    this.deployed = false;
    this.dataOnly = false;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_AGENTS, this);
    objectFreeze(this);
  }

  plan({ goal, context = null } = {}) {
    if (!isTrustedAgentArchitectureAgent(this)) {
      throw new TypeError('Architecture agent requires an exact trusted runtime');
    }
    const plan = this.planner.plan({ goal, context });
    if (!isTrustedAgentEpisodePlan(plan)) {
      throw new TypeError('Architecture agent planner returned an untrusted plan');
    }
    return plan;
  }

  run({
    goal,
    context = null,
    reproduction = 'AgentArchitectureAgent.run',
    stopOnResearchRequired = true
  } = {}) {
    if (!isTrustedAgentArchitectureAgent(this)) {
      throw new TypeError('Architecture agent requires an exact trusted runtime');
    }
    if (typeof stopOnResearchRequired !== 'boolean') {
      throw new TypeError('Architecture agent stopOnResearchRequired must be boolean');
    }
    const plan = this.plan({ goal, context });
    const report = this.runner.runPlan({
      plan,
      reproduction: requireNonEmptyString(reproduction, 'Architecture agent reproduction'),
      stopOnResearchRequired
    });
    if (!isTrustedAgentRunReport(report)) {
      throw new TypeError('Architecture agent runner returned an untrusted run report');
    }
    return report;
  }
}

export function isTrustedAgentArchitectureAgent(agent) {
  return typeof agent === 'object'
    && agent !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_AGENTS, agent)
    && objectGetPrototypeOf(agent) === AgentArchitectureAgent.prototype;
}

export function agentFromAdoptedArchitecture(adoption, { toolRegistry = null } = {}) {
  if (!isTrustedAgentArchitectureAdoption(adoption)) {
    throw new TypeError('Architecture agent construction requires trusted adoption evidence');
  }
  if (toolRegistry !== null && !isTrustedToolRegistry(toolRegistry)) {
    throw new TypeError('Architecture agent construction requires a trusted ToolRegistry');
  }
  const candidate = architectureFromAdoptedSearch(adoption);
  const policy = candidate.createPolicy();
  const planner = candidate.plannerCandidate.createPlanner();
  if (!isTrustedAgentPlanner(planner)) {
    throw new TypeError('Architecture agent construction requires a trusted planner');
  }
  if (weakSetHas(USED_AGENT_ARCHITECTURE_PLANNERS, planner)) {
    throw new TypeError('Architecture agent construction requires a fresh planner instance');
  }
  const runner = new BoundedAgentRunner({ toolRegistry, policy });
  weakSetAdd(USED_AGENT_ARCHITECTURE_PLANNERS, planner);
  return new AgentArchitectureAgent({
    adoption,
    candidate,
    planner,
    runner,
    token: ARCHITECTURE_AGENT_TOKEN
  });
}

objectFreeze(AgentArchitectureAgent.prototype);
