import {
  isCompleteSearchReport,
  isTrustedSearchReport,
  sameSearchSuite
} from './search.mjs';
import {
  arrayEvery,
  arrayFind,
  arrayMap,
  arrayPush,
  arraySlice,
  arraySome,
  isFrozenObject,
  isInteger,
  isSafeInteger,
  jsonStringify,
  objectEntries,
  objectFromEntries,
  objectGetPrototypeOf,
  objectIs,
  objectKeys,
  objectFreeze,
  stringToLowerCase,
  stringTrim,
  toBoolean,
  weakMapCreate,
  weakMapGet,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const MUTATION_LEVELS = objectFreeze({
  PARAMETERS: 1,
  PROMPTS: 2,
  POLICIES: 3,
  WORKFLOWS: 4,
  MODULES: 5,
  ARCHITECTURES: 6,
  REPRESENTATIONS: 7,
  SEARCH_ALGORITHMS: 8,
  REPRESENTATION_INVENTION: 9
});

export const MUTATION_TARGETS = objectFreeze({
  SEARCH: 'SEARCH',
  AGENT_POLICY: 'AGENT_POLICY'
});

const MUTATION_LEVEL_NAMES = objectFreeze(objectFromEntries(
  arrayMap(objectEntries(MUTATION_LEVELS), ([name, level]) => [level, stringToLowerCase(name)])
));
const TRUSTED_PROPOSALS = weakMapCreate();
const TRUSTED_PERMITS = weakMapCreate();
const TRUSTED_AGENT_POLICIES = weakSetCreate();
const TRUSTED_PERMIT_PROPOSALS = weakMapCreate();
const CONSUMED_PERMITS = weakSetCreate();
const TRUSTED_AGENT_POLICY_APPLICATIONS = weakSetCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requireLevel(value, field) {
  if (!isInteger(value) || value < MUTATION_LEVELS.PARAMETERS || value > MUTATION_LEVELS.REPRESENTATION_INVENTION) {
    throw new RangeError(`${field} must be a mutation level from 1 through 9`);
  }
  return value;
}

function metricValue(value) {
  return value === null ? 0 : value;
}

function metricsFromResult(result) {
  return objectFreeze({
    candidateId: result.candidateId,
    promoted: result.promoted,
    productionSuccessRate: result.fitness.productionSuccessRate,
    productionProvenRate: result.fitness.productionProvenRate,
    researchSuccessRate: result.fitness.researchSuccessRate,
    researchProvenRate: result.fitness.researchProvenRate,
    skepticSuccessRate: result.fitness.skepticSuccessRate,
    skepticWeaknessesExposed: result.fitness.skepticWeaknessesExposed,
    transferSuccessRate: result.fitness.transferSuccessRate,
    transferProvenRate: result.fitness.transferProvenRate
  });
}

function sameMetrics(left, right) {
  const leftMetrics = metricsFromResult(left);
  const rightMetrics = metricsFromResult(right);
  return arrayEvery(objectKeys(leftMetrics), (key) => objectIs(leftMetrics[key], rightMetrics[key]));
}

function sameReportEvidence(left, right) {
  if (
    left === undefined
    || left === null
    || right === undefined
    || right === null
    || left.mode !== right.mode
    || left.results.length !== right.results.length
  ) {
    return false;
  }

  const fields = [
    'caseId',
    'domain',
    'representation',
    'proven',
    'expected',
    'success',
    'requiresProof',
    'adversarial',
    'surpriseNats',
    'surpriseBand',
    'verifierId',
    'error'
  ];
  return arrayEvery(left.results, (leftResult, index) => {
    const rightResult = right.results[index];
    return arrayEvery(fields, (field) => objectIs(leftResult[field], rightResult[field]));
  });
}

function sameCandidateEvidence(left, right) {
  return sameReportEvidence(left.production, right.production)
    && sameReportEvidence(left.research, right.research)
    && sameReportEvidence(left.skeptic, right.skeptic);
}

function completeResult(result) {
  return result !== undefined
    && result !== null
    && result.error === null
    && result.production?.complete === true
    && result.research?.complete === true
    && result.skeptic?.complete === true;
}

function sameCandidateDefinition(left, right) {
  return left !== undefined
    && left !== null
    && right !== undefined
    && right !== null
    && left.candidate === right.candidate
    && left.definitionFingerprint === right.definitionFingerprint;
}

function hasIndependentReproducibilityEvidence({
  searchReport,
  reproductionReport,
  baselineCandidateId,
  candidateCandidateId
}) {
  if (
    !isCompleteSearchReport(searchReport)
    || !isCompleteSearchReport(reproductionReport)
    || reproductionReport === searchReport
    || !sameSearchSuite(searchReport, reproductionReport)
  ) {
    return false;
  }

  const baseline = arrayFind(searchReport.results, ({ candidateId }) => candidateId === baselineCandidateId);
  const candidate = arrayFind(searchReport.results, ({ candidateId }) => candidateId === candidateCandidateId);
  const reproductionBaseline = arrayFind(reproductionReport.results, ({ candidateId }) => candidateId === baselineCandidateId);
  const reproductionCandidate = arrayFind(reproductionReport.results, ({ candidateId }) => candidateId === candidateCandidateId);
  return completeResult(baseline)
    && completeResult(candidate)
    && completeResult(reproductionBaseline)
    && completeResult(reproductionCandidate)
    && sameCandidateDefinition(baseline, reproductionBaseline)
    && sameCandidateDefinition(candidate, reproductionCandidate)
    && sameMetrics(baseline, reproductionBaseline)
    && sameMetrics(candidate, reproductionCandidate)
    && sameCandidateEvidence(baseline, reproductionBaseline)
    && sameCandidateEvidence(candidate, reproductionCandidate);
}

function improvementBetween(baseline, candidate) {
  const keys = [
    'productionSuccessRate',
    'productionProvenRate',
    'researchSuccessRate',
    'researchProvenRate',
    'skepticSuccessRate',
    'transferSuccessRate',
    'transferProvenRate'
  ];
  const improvement = objectFromEntries(arrayMap(keys, (key) => [
    key,
    candidate[key] - baseline[key]
  ]));
  const nonRegressing = arrayEvery(keys, (key) => candidate[key] >= baseline[key]);
  const strictImprovement = arraySome(keys, (key) => candidate[key] > baseline[key]);
  return objectFreeze({
    ...improvement,
    nonRegressing,
    strictImprovement,
    demonstrated: nonRegressing && strictImprovement
  });
}

function hasCompletePromotionEvidence(metrics) {
  return metrics.productionSuccessRate === 1
    && metrics.productionProvenRate === 1
    && metrics.researchSuccessRate === 1
    && metrics.researchProvenRate === 1
    && metrics.skepticSuccessRate === 1
    && metrics.skepticWeaknessesExposed === 0;
}

export const AGENT_POLICY_LIMITS = objectFreeze({
  MIN_EPISODES: 1,
  MAX_EPISODES: 32,
  MIN_TOOL_CALLS_PER_EPISODE: 1,
  MAX_TOOL_CALLS_PER_EPISODE: 8
});

function requirePolicyLimit(value, field, minimum, maximum) {
  if (!isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${field} must be a safe integer from ${minimum} through ${maximum}`);
  }
  return value;
}

export class AgentPolicy {
  constructor({
    maxEpisodes = AGENT_POLICY_LIMITS.MAX_EPISODES,
    maxToolCallsPerEpisode = AGENT_POLICY_LIMITS.MAX_TOOL_CALLS_PER_EPISODE
  } = {}) {
    this.maxEpisodes = requirePolicyLimit(
      maxEpisodes,
      'Agent policy maxEpisodes',
      AGENT_POLICY_LIMITS.MIN_EPISODES,
      AGENT_POLICY_LIMITS.MAX_EPISODES
    );
    this.maxToolCallsPerEpisode = requirePolicyLimit(
      maxToolCallsPerEpisode,
      'Agent policy maxToolCallsPerEpisode',
      AGENT_POLICY_LIMITS.MIN_TOOL_CALLS_PER_EPISODE,
      AGENT_POLICY_LIMITS.MAX_TOOL_CALLS_PER_EPISODE
    );
    this.dataOnly = true;
    weakSetAdd(TRUSTED_AGENT_POLICIES, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentPolicy(policy) {
  return typeof policy === 'object'
    && policy !== null
    && weakSetHas(TRUSTED_AGENT_POLICIES, policy)
    && isFrozenObject(policy)
    && objectGetPrototypeOf(policy) === AgentPolicy.prototype;
}

function agentPolicyFingerprint(policy) {
  return jsonStringify({
    maxEpisodes: policy.maxEpisodes,
    maxToolCallsPerEpisode: policy.maxToolCallsPerEpisode
  });
}

export class MutationProposal {
  constructor({
    id,
    level,
    baseline,
    candidate,
    reproducible,
    baselinePolicy = null,
    candidatePolicy = null
  }) {
    if ((baselinePolicy === null) !== (candidatePolicy === null)) {
      throw new TypeError('Mutation proposal policy target requires both baselinePolicy and candidatePolicy');
    }
    if (
      baselinePolicy !== null
      && (!isTrustedAgentPolicy(baselinePolicy) || !isTrustedAgentPolicy(candidatePolicy))
    ) {
      throw new TypeError('Mutation proposal policy target requires trusted AgentPolicy snapshots');
    }
    this.id = requireNonEmptyString(id, 'Mutation proposal id');
    this.level = requireLevel(level, 'Mutation proposal level');
    this.levelName = MUTATION_LEVEL_NAMES[this.level];
    this.baseline = baseline;
    this.candidate = candidate;
    this.reproducible = toBoolean(reproducible);
    this.mutationTarget = baselinePolicy === null
      ? MUTATION_TARGETS.SEARCH
      : MUTATION_TARGETS.AGENT_POLICY;
    this.baselinePolicy = baselinePolicy;
    this.candidatePolicy = candidatePolicy;
    this.baselinePolicyFingerprint = baselinePolicy === null
      ? null
      : agentPolicyFingerprint(baselinePolicy);
    this.candidatePolicyFingerprint = candidatePolicy === null
      ? null
      : agentPolicyFingerprint(candidatePolicy);
    this.improvement = improvementBetween(baseline, candidate);
    objectFreeze(this);
  }
}

export class MutationPermit {
  constructor({ proposalId, level }) {
    this.proposalId = requireNonEmptyString(proposalId, 'Mutation permit proposalId');
    this.level = requireLevel(level, 'Mutation permit level');
    this.levelName = MUTATION_LEVEL_NAMES[this.level];
    objectFreeze(this);
  }
}

export function isTrustedMutationProposal(proposal, authority = null) {
  const owner = typeof proposal === 'object' && proposal !== null
    ? weakMapGet(TRUSTED_PROPOSALS, proposal)
    : undefined;
  return typeof proposal === 'object'
    && proposal !== null
    && isFrozenObject(proposal)
    && owner !== undefined
    && (authority === null || owner === authority);
}

export function isTrustedMutationPermit(permit, authority = null) {
  const owner = typeof permit === 'object' && permit !== null
    ? weakMapGet(TRUSTED_PERMITS, permit)
    : undefined;
  return typeof permit === 'object'
    && permit !== null
    && isFrozenObject(permit)
    && owner !== undefined
    && (authority === null || owner === authority);
}

export class AgentPolicyApplication {
  constructor({
    permit,
    proposalId,
    previousPolicy,
    currentPolicy
  }) {
    if (!isTrustedMutationPermit(permit)) {
      throw new TypeError('AgentPolicyApplication requires a trusted mutation permit');
    }
    if (!isTrustedAgentPolicy(previousPolicy) || !isTrustedAgentPolicy(currentPolicy)) {
      throw new TypeError('AgentPolicyApplication requires trusted policy snapshots');
    }
    this.permit = permit;
    this.proposalId = requireNonEmptyString(proposalId, 'Agent policy application proposalId');
    this.previousPolicy = previousPolicy;
    this.currentPolicy = currentPolicy;
    this.dataOnly = true;
    objectFreeze(this);
  }
}

export function isTrustedAgentPolicyApplication(application) {
  return typeof application === 'object'
    && application !== null
    && weakSetHas(TRUSTED_AGENT_POLICY_APPLICATIONS, application)
    && isFrozenObject(application)
    && objectGetPrototypeOf(application) === AgentPolicyApplication.prototype;
}

export class EvolutionAuthority {
  #unlockedThrough;

  #history;

  constructor({ unlockedThrough = MUTATION_LEVELS.PARAMETERS } = {}) {
    this.#unlockedThrough = requireLevel(unlockedThrough, 'Initial unlocked mutation level');
    this.#history = objectFreeze([]);
    objectFreeze(this);
  }

  get unlockedThrough() {
    return this.#unlockedThrough;
  }

  get unlockedLevelName() {
    return MUTATION_LEVEL_NAMES[this.#unlockedThrough];
  }

  get history() {
    return this.#history;
  }

  canAttempt(level) {
    return requireLevel(level, 'Mutation level') <= this.#unlockedThrough;
  }

  propose({
    id,
    level,
    searchReport,
    baselineCandidateId,
    candidateCandidateId,
    reproductionReport = null,
    baselinePolicy = null,
    candidatePolicy = null
  }) {
    if (!isTrustedSearchReport(searchReport)) {
      throw new TypeError('Mutation proposal requires a trusted representation search report');
    }

    const baseline = arrayFind(searchReport.results, ({ candidateId }) => candidateId === baselineCandidateId);
    const candidate = arrayFind(searchReport.results, ({ candidateId }) => candidateId === candidateCandidateId);
    if (!baseline || !candidate) {
      throw new RangeError('Mutation proposal candidates must exist in the search report');
    }

    const proposal = new MutationProposal({
      id,
      level,
      baseline: metricsFromResult(baseline),
      candidate: metricsFromResult(candidate),
      reproducible: hasIndependentReproducibilityEvidence({
        searchReport,
        reproductionReport,
        baselineCandidateId,
        candidateCandidateId
      }),
      baselinePolicy,
      candidatePolicy
    });
    weakMapSet(TRUSTED_PROPOSALS, proposal, this);
    return proposal;
  }

  approve(proposal) {
    if (!isTrustedMutationProposal(proposal, this)) {
      throw new TypeError('Mutation approval requires a proposal issued by EvolutionAuthority');
    }

    const reasons = [];
    if (proposal.level !== this.#unlockedThrough + 1) {
      arrayPush(reasons, `next mutation level after ${this.#unlockedThrough} is required`);
    }
    if (!proposal.candidate.promoted) {
      arrayPush(reasons, 'candidate must pass research and skeptic promotion');
    }
    if (!hasCompletePromotionEvidence(proposal.candidate)) {
      arrayPush(
        reasons,
        'candidate must pass every production, research, and skeptic case without exposed weaknesses'
      );
    }
    if (!proposal.improvement.demonstrated) {
      arrayPush(reasons, 'candidate must strictly improve without regressing measured metrics');
    }
    if (!proposal.reproducible) {
      arrayPush(reasons, 'reproducible evidence is required');
    }

    if (reasons.length > 0) {
      return objectFreeze({
        approved: false,
        proposalId: proposal.id,
        level: proposal.level,
        reasons: objectFreeze(reasons),
        permit: null
      });
    }

    const permit = new MutationPermit({ proposalId: proposal.id, level: proposal.level });
    weakMapSet(TRUSTED_PERMITS, permit, this);
    weakMapSet(TRUSTED_PERMIT_PROPOSALS, permit, proposal);
    this.#unlockedThrough = proposal.level;
    const nextHistory = arraySlice(this.#history);
    arrayPush(nextHistory, objectFreeze({
      proposalId: proposal.id,
      level: proposal.level,
      levelName: proposal.levelName,
      candidateId: proposal.candidate.candidateId,
      approved: true
    }));
    this.#history = objectFreeze(nextHistory);
    return objectFreeze({
      approved: true,
      proposalId: proposal.id,
      level: proposal.level,
      reasons: objectFreeze([]),
      permit
    });
  }

  applyAgentPolicy({ permit, currentPolicy, nextPolicy } = {}) {
    if (!isTrustedMutationPermit(permit, this)) {
      throw new TypeError('Agent policy application requires a permit issued by EvolutionAuthority');
    }
    if (weakSetHas(CONSUMED_PERMITS, permit)) {
      throw new Error('Mutation permit has already been consumed');
    }
    const proposal = weakMapGet(TRUSTED_PERMIT_PROPOSALS, permit);
    if (!isTrustedMutationProposal(proposal, this)) {
      throw new TypeError('Agent policy application requires a trusted mutation proposal binding');
    }
    if (proposal.mutationTarget !== MUTATION_TARGETS.AGENT_POLICY) {
      throw new TypeError('Mutation permit is not bound to an agent policy target');
    }
    if (permit.level < MUTATION_LEVELS.POLICIES) {
      throw new RangeError('Agent policy application requires the policies mutation level');
    }
    if (!isTrustedAgentPolicy(currentPolicy) || !isTrustedAgentPolicy(nextPolicy)) {
      throw new TypeError('Agent policy application requires trusted policy snapshots');
    }
    if (agentPolicyFingerprint(currentPolicy) !== proposal.baselinePolicyFingerprint) {
      throw new Error('Current AgentPolicy does not match the permit baseline fingerprint');
    }
    if (agentPolicyFingerprint(nextPolicy) !== proposal.candidatePolicyFingerprint) {
      throw new Error('Next AgentPolicy does not match the permit candidate fingerprint');
    }
    if (agentPolicyFingerprint(currentPolicy) === agentPolicyFingerprint(nextPolicy)) {
      throw new Error('Agent policy application cannot be a no-op');
    }

    const application = new AgentPolicyApplication({
      permit,
      proposalId: proposal.id,
      previousPolicy: currentPolicy,
      currentPolicy: nextPolicy
    });
    weakSetAdd(CONSUMED_PERMITS, permit);
    weakSetAdd(TRUSTED_AGENT_POLICY_APPLICATIONS, application);
    return application;
  }
}

objectFreeze(AgentPolicy.prototype);
objectFreeze(AgentPolicyApplication.prototype);
objectFreeze(EvolutionAuthority.prototype);
