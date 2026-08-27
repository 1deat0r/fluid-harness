import {
  AgentArchitectureAdoptionAuthority,
  AgentArchitectureReproducibilityAuthority,
  AgentArchitectureSearchRunner,
  isTrustedAgentArchitectureAdoption,
  isTrustedAgentArchitectureAdoptionAuthority,
  isTrustedAgentArchitectureCandidate,
  isTrustedAgentArchitectureReproducibilityReport,
  isTrustedAgentArchitectureSearchReport
} from './agent-architecture.mjs';
import {
  AgentArchitectureProposalRunner,
  isTrustedAgentArchitectureProposalReport,
  isTrustedAgentArchitectureProposalRunner
} from './agent-architecture-proposal.mjs';
import {
  isTrustedAgentPlannerCandidate,
  isTrustedAgentPlannerCase
} from './agent-search.mjs';
import {
  EvaluationBudget,
  isTrustedEvaluationBudget
} from './evaluation.mjs';
import {
  arrayIsArray,
  arrayMap,
  arraySlice,
  arraySome,
  isPlainObject,
  objectFreeze,
  objectGetPrototypeOf,
  setFromArray,
  setSize,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const TRUSTED_AGENT_ARCHITECTURE_DISCOVERY_REPORTS = weakSetCreate();
const TRUSTED_AGENT_ARCHITECTURE_DISCOVERY_RUNNERS = weakSetCreate();
const DISCOVERY_TOKEN = objectFreeze({});

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requireTrustedCases(cases) {
  if (!arrayIsArray(cases) || cases.length === 0) {
    throw new TypeError('Agent architecture discovery requires cases');
  }
  const normalizedCases = arrayMap(cases, (evaluationCase) => {
    if (!isTrustedAgentPlannerCase(evaluationCase)) {
      throw new TypeError('Agent architecture discovery cases must be trusted AgentPlannerCase instances');
    }
    return evaluationCase;
  });
  if (setSize(setFromArray(arrayMap(normalizedCases, ({ id }) => id))) !== normalizedCases.length) {
    throw new TypeError('Agent architecture discovery case ids must be unique');
  }
  return objectFreeze(arraySlice(normalizedCases));
}

function requireTrustedPlannerCandidates(plannerCandidates) {
  if (!arrayIsArray(plannerCandidates) || plannerCandidates.length === 0) {
    throw new TypeError('Agent architecture discovery requires planner candidates');
  }
  const normalizedCandidates = arrayMap(plannerCandidates, (candidate) => {
    if (!isTrustedAgentPlannerCandidate(candidate)) {
      throw new TypeError('Agent architecture discovery planner candidates must be trusted');
    }
    return candidate;
  });
  if (
    setSize(setFromArray(arrayMap(normalizedCandidates, ({ id }) => id)))
    !== normalizedCandidates.length
  ) {
    throw new TypeError('Agent architecture discovery planner candidate ids must be unique');
  }
  return objectFreeze(arraySlice(normalizedCandidates));
}

function budgetOrDefault(budget, maxCases, field) {
  const normalized = budget ?? new EvaluationBudget({ maxCases });
  if (!isTrustedEvaluationBudget(normalized)) {
    throw new TypeError(`${field} must be a trusted EvaluationBudget`);
  }
  return normalized;
}

function discoverFromTrustedProposalReport(
  runner,
  {
    proposalReport,
    plannerCandidates,
    cases,
    productionBudget,
    researchBudget,
    skepticBudget
  } = {}
) {
  if (!isTrustedAgentArchitectureDiscoveryRunner(runner)) {
    throw new TypeError('Agent architecture discovery requires an exact trusted runner');
  }
  if (!isTrustedAgentArchitectureProposalReport(proposalReport)) {
    throw new TypeError(
      'Agent architecture discovery from proposal requires a trusted proposal report'
    );
  }
  const normalizedPlannerCandidates = requireTrustedPlannerCandidates(plannerCandidates);
  const normalizedCases = requireTrustedCases(cases);
  const budgets = {
    production: budgetOrDefault(
      productionBudget,
      normalizedCases.length,
      'Architecture discovery production budget'
    ),
    research: budgetOrDefault(
      researchBudget,
      normalizedCases.length,
      'Architecture discovery research budget'
    ),
    skeptic: budgetOrDefault(
      skepticBudget,
      normalizedCases.length,
      'Architecture discovery skeptic budget'
    )
  };
  const candidates = runner.proposalRunner.resolve({
    report: proposalReport,
    plannerCandidates: normalizedPlannerCandidates
  });
  const primary = new AgentArchitectureSearchRunner().evaluate({
    candidates,
    cases: normalizedCases,
    productionBudget: budgets.production,
    researchBudget: budgets.research,
    skepticBudget: budgets.skeptic
  });
  const reproduction = new AgentArchitectureSearchRunner().evaluate({
    candidates,
    cases: normalizedCases,
    productionBudget: budgets.production,
    researchBudget: budgets.research,
    skepticBudget: budgets.skeptic
  });
  const reproducibility = new AgentArchitectureReproducibilityAuthority().reproduce({
    searchReport: primary,
    reproductionReport: reproduction,
    candidateId: primary.winner.architectureId
  });
  const adoption = runner.adoptionAuthority.adopt(reproducibility);
  return new AgentArchitectureDiscoveryReport({
    runner,
    proposalReport,
    candidates,
    primary,
    reproduction,
    reproducibility,
    adoption,
    token: DISCOVERY_TOKEN
  });
}

export class AgentArchitectureDiscoveryReport {
  constructor({
    runner,
    proposalReport,
    candidates,
    primary,
    reproduction,
    reproducibility,
    adoption,
    token
  }) {
    if (
      token !== DISCOVERY_TOKEN
      || !isTrustedAgentArchitectureDiscoveryRunner(runner)
      || !isTrustedAgentArchitectureProposalReport(proposalReport)
      || !isTrustedAgentArchitectureProposalRunner(runner.proposalRunner)
      || !arrayIsArray(candidates)
      || arraySome(candidates, (candidate) => !isTrustedAgentArchitectureCandidate(candidate))
      || !isTrustedAgentArchitectureSearchReport(primary)
      || !isTrustedAgentArchitectureSearchReport(reproduction)
      || !isTrustedAgentArchitectureReproducibilityReport(reproducibility)
      || !isPlainObject(adoption)
    ) {
      throw new TypeError('Architecture discovery report requires trusted transaction evidence');
    }
    if (
      adoption.adopted === true
      && !isTrustedAgentArchitectureAdoption(adoption.adoption, runner.adoptionAuthority)
    ) {
      throw new TypeError('Architecture discovery report requires trusted adoption evidence');
    }
    if (adoption.adopted !== true && adoption.adoption !== null) {
      throw new TypeError('Architecture discovery report cannot carry a rejected adoption');
    }
    this.goal = proposalReport.goal;
    this.proposalReport = proposalReport;
    this.proposals = proposalReport.proposals;
    this.candidates = objectFreeze(arraySlice(candidates));
    this.primary = primary;
    this.reproduction = reproduction;
    this.reproducibility = reproducibility;
    this.adoption = adoption;
    this.winnerId = primary.winner.architectureId;
    this.complete = primary.complete
      && reproduction.complete
      && reproducibility.reproducible === true;
    this.adopted = adoption.adopted === true;
    this.adoptedCandidate = this.adopted ? adoption.adoption.candidate : null;
    this.deployed = false;
    this.dataOnly = false;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_DISCOVERY_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentArchitectureDiscoveryReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_DISCOVERY_REPORTS, report)
    && objectGetPrototypeOf(report) === AgentArchitectureDiscoveryReport.prototype;
}

export class AgentArchitectureDiscoveryRunner {
  constructor({
    proposalRunner,
    adoptionAuthority = new AgentArchitectureAdoptionAuthority()
  } = {}) {
    if (!isTrustedAgentArchitectureProposalRunner(proposalRunner)) {
      throw new TypeError('Architecture discovery requires a trusted proposal runner');
    }
    if (!isTrustedAgentArchitectureAdoptionAuthority(adoptionAuthority)) {
      throw new TypeError('Architecture discovery requires a trusted adoption authority');
    }
    this.proposalRunner = proposalRunner;
    this.adoptionAuthority = adoptionAuthority;
    weakSetAdd(TRUSTED_AGENT_ARCHITECTURE_DISCOVERY_RUNNERS, this);
    objectFreeze(this);
  }

  discover({
    goal,
    plannerCandidates,
    cases,
    productionBudget,
    researchBudget,
    skepticBudget,
    researchContext = null
  } = {}) {
    if (!isTrustedAgentArchitectureDiscoveryRunner(this)) {
      throw new TypeError('Architecture discovery requires an exact trusted runner');
    }
    const normalizedGoal = requireNonEmptyString(goal, 'Agent architecture discovery goal');
    const normalizedPlannerCandidates = requireTrustedPlannerCandidates(plannerCandidates);
    const normalizedCases = requireTrustedCases(cases);
    const budgets = {
      production: budgetOrDefault(
        productionBudget,
        normalizedCases.length,
        'Architecture discovery production budget'
      ),
      research: budgetOrDefault(
        researchBudget,
        normalizedCases.length,
        'Architecture discovery research budget'
      ),
      skeptic: budgetOrDefault(
        skepticBudget,
        normalizedCases.length,
        'Architecture discovery skeptic budget'
      )
    };
    const proposalReport = this.proposalRunner.propose({
      goal: normalizedGoal,
      plannerCandidateIds: arrayMap(normalizedPlannerCandidates, ({ id }) => id),
      researchContext
    });
    return discoverFromTrustedProposalReport(this, {
      proposalReport,
      plannerCandidates: normalizedPlannerCandidates,
      cases: normalizedCases,
      productionBudget: budgets.production,
      researchBudget: budgets.research,
      skepticBudget: budgets.skeptic
    });
  }

  discoverFromProposalReport({
    proposalReport,
    plannerCandidates,
    cases,
    productionBudget,
    researchBudget,
    skepticBudget
  } = {}) {
    return discoverFromTrustedProposalReport(this, {
      proposalReport,
      plannerCandidates,
      cases,
      productionBudget,
      researchBudget,
      skepticBudget
    });
  }
}

export function isTrustedAgentArchitectureDiscoveryRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_AGENT_ARCHITECTURE_DISCOVERY_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === AgentArchitectureDiscoveryRunner.prototype;
}

objectFreeze(AgentArchitectureDiscoveryReport.prototype);
objectFreeze(AgentArchitectureDiscoveryRunner.prototype);
