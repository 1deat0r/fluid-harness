import { createHash } from 'node:crypto';

import {
  AgentArchitectureReproducibilityAuthority,
  AgentArchitectureSearchRunner,
  isTrustedAgentArchitectureSearchReport
} from './agent-architecture.mjs';
import {
  isTrustedAgentArchitectureDiscoveryReport,
  isTrustedAgentArchitectureDiscoveryRunner
} from './agent-architecture-discovery.mjs';
import {
  isTrustedAgentArchitectureCandidate
} from './agent-architecture.mjs';
import { isTrustedAgentPlannerCase } from './agent-search.mjs';
import {
  isTrustedAgentRunReport
} from './agent.mjs';
import {
  agentFromAdoptedArchitecture,
  isTrustedAgentArchitectureAgent
} from './agent-architecture-runtime.mjs';
import { EvidenceLedger, isTrustedEvidenceLedger } from './evidence-ledger.mjs';
import { EVIDENCE_LEVELS } from './evidence.mjs';
import {
  EvaluationBudget,
  isTrustedEvaluationBudget
} from './evaluation.mjs';
import {
  buildStructuredMemoryContext,
  isTrustedStructuredMemoryContext,
  MAX_STRUCTURED_MEMORY_ENTRIES,
  memoryFromLedger,
  MEMORY_SOURCES
} from './memory.mjs';
import { snapshotProcessData } from './process-boundary.mjs';
import { isTrustedToolRegistry } from './tool.mjs';
import {
  arrayEvery,
  arrayFilter,
  arrayFind,
  arrayIncludes,
  arrayIsArray,
  arrayForEach,
  arrayJoin,
  arrayMap,
  arrayPush,
  arrayReduce,
  arraySlice,
  arraySort,
  arraySome,
  highResolutionTime,
  isFiniteNumber,
  isPlainObject,
  isSafeInteger,
  jsonStringify,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  reflectOwnKeys,
  setFromArray,
  setSize,
  stringLocaleCompare,
  stringTrim,
  toNumber,
  weakMapCreate,
  weakMapGet,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const HARNESS_FACTORY_STATUSES = objectFreeze({
  ADOPTED: 'ADOPTED',
  REJECTED: 'REJECTED'
});

export const HARNESS_FACTORY_HOLDOUT_STATUSES = objectFreeze({
  FAILED: 'FAILED',
  NOT_RUN: 'NOT_RUN',
  PASSED: 'PASSED'
});
export const HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES = objectFreeze({
  INSUFFICIENT: 'INSUFFICIENT',
  STABLE: 'STABLE',
  UNSTABLE: 'UNSTABLE'
});
export const HARNESS_FACTORY_RECOMMENDATION_STATUSES = objectFreeze({
  IMPROVE_LATEST_GENERATION: 'IMPROVE_LATEST_GENERATION',
  NO_HISTORY: 'NO_HISTORY',
  RECOVER_FAILED_HOLDOUT: 'RECOVER_FAILED_HOLDOUT',
  VALIDATE_LATEST_HOLDOUT: 'VALIDATE_LATEST_HOLDOUT'
});
export const HARNESS_FACTORY_RESEARCH_TARGETS = objectFreeze({
  IMPROVE_LATEST_GENERATION: 'IMPROVE_LATEST_GENERATION',
  INVESTIGATE_BENCHMARK_VALIDATION: 'INVESTIGATE_BENCHMARK_VALIDATION',
  INVESTIGATE_SKEPTIC_WEAKNESS: 'INVESTIGATE_SKEPTIC_WEAKNESS',
  RECOVER_FAILED_HOLDOUT: 'RECOVER_FAILED_HOLDOUT',
  TEST_TRANSFER_GAP: 'TEST_TRANSFER_GAP',
  VALIDATE_UNSEEN_HOLDOUT: 'VALIDATE_UNSEEN_HOLDOUT'
});
const HARNESS_FACTORY_RESEARCH_TARGET_VALUES = objectFreeze([
  HARNESS_FACTORY_RESEARCH_TARGETS.IMPROVE_LATEST_GENERATION,
  HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION,
  HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_SKEPTIC_WEAKNESS,
  HARNESS_FACTORY_RESEARCH_TARGETS.RECOVER_FAILED_HOLDOUT,
  HARNESS_FACTORY_RESEARCH_TARGETS.TEST_TRANSFER_GAP,
  HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT
]);

export const MAX_HARNESS_FACTORY_FRONTIER_ENTRIES = 8;
export const MAX_HARNESS_FACTORY_FRONTIER_PARTITIONS = 8;
export const MAX_HARNESS_FACTORY_HISTORY_ENTRIES = 32;
export const MAX_HARNESS_FACTORY_HOLDOUT_CASES = 8;
export const MAX_HARNESS_FACTORY_RESEARCH_AGENDA_ITEMS = 8;
export const MAX_HARNESS_FACTORY_BENCHMARK_CANDIDATES = 8;
export const MAX_HARNESS_FACTORY_BENCHMARK_LEVELS = 8;
export const MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES = 32;
export const MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES = 32;

const FACTORY_OPTIONS_KEYS = objectFreeze([
  'factoryId',
  'discoveryRunner',
  'ledger'
]);
const MANUFACTURE_OPTIONS_KEYS = objectFreeze([
  'goal',
  'plannerCandidates',
  'cases',
  'productionBudget',
  'researchBudget',
  'skepticBudget',
  'researchContext',
  'holdoutCases',
  'holdoutProductionBudget',
  'holdoutResearchBudget',
  'holdoutSkepticBudget',
  'archive',
  'agentGoal',
  'agentContext',
  'agentReproduction',
  'toolRegistry'
]);
const IMPROVEMENT_OPTIONS_KEYS = objectFreeze([
  'goal',
  'plannerCandidates',
  'cases',
  'productionBudget',
  'researchBudget',
  'skepticBudget',
  'baselineGeneration',
  'holdoutCases',
  'holdoutProductionBudget',
  'holdoutResearchBudget',
  'holdoutSkepticBudget',
  'archive',
  'agentGoal',
  'agentContext',
  'agentReproduction',
  'toolRegistry',
  'memoryQuery',
  'maxMemoryEntries'
]);
const IMPROVEMENT_QUERY_KEYS = objectFreeze([
  'architectureId',
  'keywords',
  'taskId',
  'strategyKey',
  'source',
  'evidence',
  'surpriseBand',
  'minSurpriseNats',
  'limit'
]);
const FACTORY_FITNESS_RATE_KEYS = objectFreeze([
  'productionSuccessRate',
  'productionProvenRate',
  'researchSuccessRate',
  'researchProvenRate',
  'skepticSuccessRate',
  'transferSuccessRate'
]);
const DISPOSE_OPTIONS_KEYS = objectFreeze(['candidates', 'reason']);
const BENCHMARK_OPTIONS_KEYS = objectFreeze(['candidate', 'cases', 'levels']);
const BENCHMARK_CAMPAIGN_OPTIONS_KEYS = objectFreeze(['candidates', 'cases', 'levels']);
const BENCHMARK_CAMPAIGN_VALIDATION_OPTIONS_KEYS = objectFreeze([
  'candidate',
  'levelId',
  'cases',
  'holdoutCases',
  'holdoutProductionBudget',
  'holdoutResearchBudget',
  'holdoutSkepticBudget'
]);
const BENCHMARK_VALIDATION_RESEARCH_OPTIONS_KEYS = objectFreeze([
  'campaign',
  'candidate',
  'levelId',
  'cases',
  'holdoutCases',
  'holdoutProductionBudget',
  'holdoutResearchBudget',
  'holdoutSkepticBudget',
  'archive'
]);
const BENCHMARK_LEVEL_KEYS = objectFreeze([
  'id',
  'computeUnits',
  'productionBudget',
  'researchBudget',
  'skepticBudget'
]);
const FACTORY_TOKEN = objectFreeze({});
const TRUSTED_HARNESS_FACTORIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_REPORTS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_DISPOSALS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_FRONTIERS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_FRONTIER_PORTFOLIOS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_HISTORIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_RECOMMENDATIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_RECOMMENDATION_FACTORIES = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_RESEARCH_AGENDAS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_RESEARCH_AGENDA_ITEM_FACTORIES = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARKS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGNS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FACTORIES = weakMapCreate();
const ARCHIVED_HARNESS_FACTORY_BENCHMARK_CAMPAIGNS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_HISTORIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_VALIDATION_SCORECARDS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_FACTORIES = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_CAMPAIGNS = weakMapCreate();
const ARCHIVED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_VALIDATIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_VALIDATION_FACTORIES = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_VALIDATION_RECOMMENDATIONS = weakMapCreate();
const DISPOSED_ARCHITECTURE_CANDIDATES = weakSetCreate();
const PROTECTED_ADOPTED_CANDIDATES = weakSetCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requireOptionalPositiveSafeInteger(value, field) {
  if (value === null) {
    return null;
  }
  if (!isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be null or a positive safe integer`);
  }
  return value;
}

function requireDataObject(value, field, allowedKeys) {
  if (
    value === null
    || typeof value !== 'object'
    || !isPlainObject(value)
  ) {
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

function requireTrustedArchitectureCandidates(candidates) {
  if (!arrayIsArray(candidates) || candidates.length === 0) {
    throw new TypeError('Harness Factory disposal requires candidates');
  }
  const normalizedCandidates = arrayMap(candidates, (candidate) => {
    if (!isTrustedAgentArchitectureCandidate(candidate)) {
      throw new TypeError('Harness Factory disposal requires trusted architecture candidates');
    }
    return candidate;
  });
  if (
    setSize(setFromArray(arrayMap(normalizedCandidates, ({ id }) => id)))
    !== normalizedCandidates.length
  ) {
    throw new TypeError('Harness Factory disposal candidate ids must be unique');
  }
  return objectFreeze(arraySlice(normalizedCandidates));
}

function requireTrustedHoldoutCases(cases) {
  if (!arrayIsArray(cases) || cases.length === 0) {
    throw new TypeError('Harness Factory holdoutCases must contain at least one case');
  }
  if (cases.length > MAX_HARNESS_FACTORY_HOLDOUT_CASES) {
    throw new RangeError(
      `Harness Factory holdoutCases cannot exceed ${MAX_HARNESS_FACTORY_HOLDOUT_CASES} cases`
    );
  }
  const normalizedCases = arrayMap(cases, (evaluationCase) => {
    if (!isTrustedAgentPlannerCase(evaluationCase)) {
      throw new TypeError('Harness Factory holdoutCases must contain trusted planner cases');
    }
    if (evaluationCase.productionEligible !== true) {
      throw new TypeError('Harness Factory holdoutCases must be production eligible');
    }
    return evaluationCase;
  });
  if (
    setSize(setFromArray(arrayMap(normalizedCases, ({ id }) => id)))
    !== normalizedCases.length
  ) {
    throw new TypeError('Harness Factory holdout case ids must be unique');
  }
  return objectFreeze(arraySlice(normalizedCases));
}

function requireDisjointHoldoutCases(cases, holdoutCases) {
  if (holdoutCases === null) {
    return;
  }
  if (arraySome(
    holdoutCases,
    (holdoutCase) => arraySome(
      cases,
      (evaluationCase) => evaluationCase === holdoutCase
        || evaluationCase.id === holdoutCase.id
    )
  )) {
    throw new TypeError('Harness Factory holdoutCases must be disjoint from benchmark cases');
  }
}

function holdoutBudget(budget, field, requiredCases) {
  const normalized = budget ?? new EvaluationBudget({
    maxCases: requiredCases === 0 ? 1 : requiredCases
  });
  if (!isTrustedEvaluationBudget(normalized)) {
    throw new TypeError(`${field} must be a trusted EvaluationBudget`);
  }
  if (normalized.maxCases < requiredCases) {
    throw new RangeError(`${field} must cover every eligible holdout case`);
  }
  return normalized;
}

function holdoutBudgets(holdoutCases, productionBudget, researchBudget, skepticBudget) {
  const productionCases = arrayFilter(
    holdoutCases,
    (evaluationCase) => evaluationCase.productionEligible
  ).length;
  const researchCases = holdoutCases.length;
  const skepticCases = arrayFilter(
    holdoutCases,
    (evaluationCase) => evaluationCase.adversarial
  ).length;
  return objectFreeze({
    production: holdoutBudget(
      productionBudget,
      'Harness Factory holdoutProductionBudget',
      productionCases
    ),
    research: holdoutBudget(
      researchBudget,
      'Harness Factory holdoutResearchBudget',
      researchCases
    ),
    skeptic: holdoutBudget(
      skepticBudget,
      'Harness Factory holdoutSkepticBudget',
      skepticCases
    )
  });
}

function archiveLocator(record) {
  if (
    record === null
    || typeof record !== 'object'
    || typeof record.kind !== 'string'
    || !isSafeInteger(record.sequence)
    || record.sequence <= 0
    || typeof record.hash !== 'string'
  ) {
    throw new TypeError('Harness Factory archive returned an invalid ledger record');
  }
  return objectFreeze({
    kind: record.kind,
    sequence: record.sequence,
    hash: record.hash
  });
}

function verifiedLedgerSnapshot(ledger) {
  if (!isTrustedEvidenceLedger(ledger)) {
    throw new TypeError('Harness Factory improvement requires a trusted evidence ledger');
  }
  if (reflectOwnKeys(ledger).length !== 0) {
    throw new TypeError(
      'Harness Factory improvement requires an unmodified evidence ledger instance'
    );
  }
  return EvidenceLedger.fromSerialized(ledger.serialize());
}

function summarizeAgentRun(runReport) {
  if (!isTrustedAgentRunReport(runReport)) {
    throw new TypeError('Harness Factory agent run must be trusted');
  }
  let provenActions = 0;
  let observedActions = 0;
  arrayForEach(runReport.cycles, (cycle) => {
    if (cycle.action.evidence === EVIDENCE_LEVELS.PROVEN) {
      provenActions += 1;
    } else if (cycle.action.evidence === EVIDENCE_LEVELS.OBSERVED) {
      observedActions += 1;
    }
  });
  return objectFreeze({
    attemptedEpisodes: runReport.attemptedEpisodes,
    auditValid: runReport.auditValid,
    completed: runReport.completed,
    cycleCount: runReport.cycles.length,
    observedActions,
    plannerId: runReport.plannerId,
    provenActions,
    stopReason: runReport.stopReason,
    dataOnly: true,
    authorityTransferred: false
  });
}

function evaluateFactoryHoldout(candidate, cases, budgets) {
  if (!isTrustedAgentArchitectureCandidate(candidate)) {
    throw new TypeError('Harness Factory holdout requires a trusted adopted candidate');
  }
  const primary = new AgentArchitectureSearchRunner().evaluate({
    candidates: [candidate],
    cases,
    productionBudget: budgets.production,
    researchBudget: budgets.research,
    skepticBudget: budgets.skeptic
  });
  const reproduction = new AgentArchitectureSearchRunner().evaluate({
    candidates: [candidate],
    cases,
    productionBudget: budgets.production,
    researchBudget: budgets.research,
    skepticBudget: budgets.skeptic
  });
  if (
    !isTrustedAgentArchitectureSearchReport(primary)
    || !isTrustedAgentArchitectureSearchReport(reproduction)
  ) {
    throw new TypeError('Harness Factory holdout returned untrusted search evidence');
  }
  const reproducibility = new AgentArchitectureReproducibilityAuthority().reproduce({
    searchReport: primary,
    reproductionReport: reproduction,
    candidateId: candidate.id
  });
  const primaryResult = arrayFind(
    primary.results,
    (result) => result.architectureId === candidate.id
  );
  const plannerResult = arrayFind(
    primaryResult?.plannerReport?.results ?? [],
    (result) => result.candidateId === candidate.plannerCandidate.id
  );
  const architectureFingerprint = primaryResult?.architectureFingerprint ?? null;
  const production = plannerResult?.production ?? null;
  const attemptedCases = production?.attemptedCases ?? 0;
  const successes = production?.successes ?? 0;
  const proofEligibleCases = production?.proofEligibleCases ?? 0;
  const proven = production?.proven ?? 0;
  const complete = primary.complete === true
    && reproduction.complete === true
    && reproducibility.reproducible === true
    && primaryResult?.complete === true
    && production?.complete === true;
  const productionComplete = attemptedCases === cases.length
    && successes === attemptedCases;
  const proofComplete = proofEligibleCases === 0 || proven === proofEligibleCases;
  return objectFreeze({
    architectureId: candidate.id,
    architectureFingerprint,
    caseCount: cases.length,
    caseIds: objectFreeze(arrayMap(cases, ({ id }) => id)),
    attemptedCases,
    successes,
    successRate: production?.successRate ?? 0,
    proofEligibleCases,
    proven,
    provenRate: production?.provenRate ?? null,
    primaryComplete: primary.complete,
    reproductionComplete: reproduction.complete,
    reproducible: reproducibility.reproducible,
    reproducibilityReasons: objectFreeze(arraySlice(reproducibility.reasons)),
    complete,
    passed: complete && productionComplete && proofComplete,
    independent: primary !== reproduction,
    dataOnly: true,
    authorityTransferred: false
  });
}

function factoryFitnessForDiscovery(discovery) {
  const winner = arrayFind(
    discovery?.primary?.results ?? [],
    (result) => result.architectureId === discovery.winnerId
  );
  if (!winner || !isPlainObject(winner.fitness)) {
    throw new TypeError('Harness Factory discovery has no measurable winner fitness');
  }
  return objectFreeze({
    productionSuccessRate: winner.fitness.productionSuccessRate,
    productionProvenRate: winner.fitness.productionProvenRate,
    researchSuccessRate: winner.fitness.researchSuccessRate,
    researchProvenRate: winner.fitness.researchProvenRate,
    skepticSuccessRate: winner.fitness.skepticSuccessRate,
    skepticWeaknessesExposed: winner.fitness.skepticWeaknessesExposed,
    transferSuccessRate: winner.fitness.transferSuccessRate
  });
}

function factoryArchitectureForDiscovery(discovery) {
  const winner = arrayFind(
    discovery?.primary?.results ?? [],
    (result) => result.architectureId === discovery.winnerId
  );
  const candidate = arrayFind(
    discovery?.candidates ?? [],
    (entry) => entry.id === discovery.winnerId
  );
  if (!winner || !isPlainObject(candidate?.components)) {
    throw new TypeError('Harness Factory discovery has no bounded winner configuration');
  }
  return objectFreeze({
    architectureFingerprint: winner.architectureFingerprint ?? candidate.architectureFingerprint,
    architectureId: winner.architectureId,
    components: candidate.components,
    plannerCandidateId: candidate.plannerCandidateId,
    policyDefinitionFingerprint: winner.policyDefinitionFingerprint
      ?? candidate.policyDefinitionFingerprint
  });
}

function factoryBenchmarkForDiscovery(discovery) {
  const winner = arrayFind(
    discovery?.primary?.results ?? [],
    (result) => result.architectureId === discovery.winnerId
  );
  const plannerSearch = winner?.plannerReport ?? winner?.planner;
  const archivedCandidate = arrayFind(
    discovery?.candidates ?? [],
    (candidate) => candidate.id === discovery.winnerId
  );
  const plannerCandidateId = winner?.candidate?.plannerCandidate?.id
    ?? archivedCandidate?.plannerCandidateId;
  const planner = arrayFind(
    plannerSearch?.results ?? [],
    (result) => result.candidateId === plannerCandidateId
  );
  if (!planner || typeof planner !== 'object') {
    throw new TypeError('Harness Factory discovery has no benchmark contract');
  }
  const modes = ['production', 'research', 'skeptic'];
  return objectFreeze(arrayMap(modes, (mode) => {
    const modeReport = planner[mode];
    if (!modeReport || typeof modeReport !== 'object' || !arrayIsArray(modeReport.results)) {
      throw new TypeError('Harness Factory discovery benchmark contract is incomplete');
    }
    const budgetMaxCases = modeReport.budget?.maxCases ?? modeReport.budgetMaxCases;
    const cases = objectFreeze(arrayMap(modeReport.results, (result) => objectFreeze({
      adversarial: result.adversarial,
      caseId: result.caseId,
      domain: result.domain,
      requiresProof: result.requiresProof
    })));
    return objectFreeze({
      budgetMaxCases,
      caseCount: cases.length,
      cases,
      eligibleCases: modeReport.eligibleCases,
      mode
    });
  }));
}

function sameFactoryBenchmark(left, right) {
  return left.length === right.length
    && arrayEvery(left, (leftMode, index) => {
      const rightMode = right[index];
      return rightMode !== undefined
        && leftMode.mode === rightMode.mode
        && leftMode.budgetMaxCases === rightMode.budgetMaxCases
        && leftMode.caseCount === rightMode.caseCount
        && leftMode.eligibleCases === rightMode.eligibleCases
        && leftMode.cases.length === rightMode.cases.length
        && arrayEvery(leftMode.cases, (leftCase, caseIndex) => {
          const rightCase = rightMode.cases[caseIndex];
          return rightCase !== undefined
            && leftCase.adversarial === rightCase.adversarial
            && leftCase.caseId === rightCase.caseId
            && leftCase.domain === rightCase.domain
            && leftCase.requiresProof === rightCase.requiresProof;
        });
    });
}

function factoryBenchmarkIdentity({ cases, discovery, holdoutCases = null }) {
  if (
    !arrayIsArray(cases)
    || cases.length === 0
    || arraySome(cases, (evaluationCase) => !isTrustedAgentPlannerCase(evaluationCase))
  ) {
    throw new TypeError('Harness Factory benchmark identity requires trusted planner cases');
  }
  const benchmark = factoryBenchmarkForDiscovery(discovery);
  const caseDefinitions = arrayMap(cases, (evaluationCase) => ({
    adversarial: evaluationCase.adversarial,
    context: evaluationCase.context,
    domain: evaluationCase.domain,
    goal: evaluationCase.goal,
    id: evaluationCase.id,
    productionEligible: evaluationCase.productionEligible,
    requiresProof: evaluationCase.requiresProof,
    task: evaluationCase.task
  }));
  const identityInput = {
    cases: caseDefinitions,
    modes: arrayMap(benchmark, ({ budgetMaxCases, eligibleCases, mode }) => ({
      budgetMaxCases,
      eligibleCases,
      mode
    }))
  };
  if (holdoutCases !== null) {
    if (
      !arrayIsArray(holdoutCases)
      || arraySome(holdoutCases, (evaluationCase) => !isTrustedAgentPlannerCase(evaluationCase))
    ) {
      throw new TypeError('Harness Factory benchmark identity requires trusted holdout cases');
    }
    identityInput.holdoutCases = arrayMap(holdoutCases, (evaluationCase) => ({
      adversarial: evaluationCase.adversarial,
      context: evaluationCase.context,
      domain: evaluationCase.domain,
      goal: evaluationCase.goal,
      id: evaluationCase.id,
      productionEligible: evaluationCase.productionEligible,
      requiresProof: evaluationCase.requiresProof,
      task: evaluationCase.task
    }));
  }
  const modeBudget = (mode) => arrayFind(
    benchmark,
    (entry) => entry.mode === mode
  )?.budgetMaxCases;
  return objectFreeze({
    budgets: objectFreeze({
      production: modeBudget('production'),
      research: modeBudget('research'),
      skeptic: modeBudget('skeptic')
    }),
    caseCount: cases.length,
    fingerprint: `sha256:${createHash('sha256')
      .update(jsonStringify(identityInput))
      .digest('hex')}`
  });
}

function compareFactoryFitness({
  baselineRecord,
  baselineDiscovery,
  currentDiscovery,
  currentBenchmarkIdentity
}) {
  const baselineFitness = factoryFitnessForDiscovery(baselineDiscovery);
  const currentFitness = factoryFitnessForDiscovery(currentDiscovery);
  const normalizedCurrentBenchmarkIdentity = currentBenchmarkIdentity ?? null;
  const baselineBenchmark = factoryBenchmarkForDiscovery(baselineDiscovery);
  const currentBenchmark = factoryBenchmarkForDiscovery(currentDiscovery);
  const baselineBenchmarkIdentity = baselineDiscovery.factory?.benchmark ?? null;
  const rateDeltas = objectFreeze({
    productionSuccessRate: currentFitness.productionSuccessRate
      - baselineFitness.productionSuccessRate,
    productionProvenRate: currentFitness.productionProvenRate
      - baselineFitness.productionProvenRate,
    researchSuccessRate: currentFitness.researchSuccessRate
      - baselineFitness.researchSuccessRate,
    researchProvenRate: currentFitness.researchProvenRate
      - baselineFitness.researchProvenRate,
    skepticSuccessRate: currentFitness.skepticSuccessRate
      - baselineFitness.skepticSuccessRate,
    skepticWeaknessesExposed: baselineFitness.skepticWeaknessesExposed
      - currentFitness.skepticWeaknessesExposed,
    transferSuccessRate: currentFitness.transferSuccessRate
      - baselineFitness.transferSuccessRate
  });
  const nonRegressing = arrayEvery(
    FACTORY_FITNESS_RATE_KEYS,
    (key) => currentFitness[key] >= baselineFitness[key]
  ) && currentFitness.skepticWeaknessesExposed <= baselineFitness.skepticWeaknessesExposed;
  const strictlyImproved = arraySome(
    FACTORY_FITNESS_RATE_KEYS,
    (key) => currentFitness[key] > baselineFitness[key]
  ) || currentFitness.skepticWeaknessesExposed < baselineFitness.skepticWeaknessesExposed;
  const benchmarkIdentityStable = baselineBenchmarkIdentity !== null
    && normalizedCurrentBenchmarkIdentity !== null
    && baselineBenchmarkIdentity.fingerprint === normalizedCurrentBenchmarkIdentity.fingerprint
    && baselineBenchmarkIdentity.caseCount === normalizedCurrentBenchmarkIdentity.caseCount
    && baselineBenchmarkIdentity.budgets.production
      === normalizedCurrentBenchmarkIdentity.budgets.production
    && baselineBenchmarkIdentity.budgets.research
      === normalizedCurrentBenchmarkIdentity.budgets.research
    && baselineBenchmarkIdentity.budgets.skeptic
      === normalizedCurrentBenchmarkIdentity.budgets.skeptic;
  const benchmarkStable = sameFactoryBenchmark(baselineBenchmark, currentBenchmark)
    && benchmarkIdentityStable;
  const reasons = [];
  if (!currentDiscovery.adopted) {
    arrayPush(reasons, 'next generation was not adopted');
  }
  if (!nonRegressing) {
    arrayPush(reasons, 'next generation regressed measured fitness');
  }
  if (!benchmarkStable) {
    arrayPush(reasons, 'benchmark contract changed between generations');
  }
  if (!strictlyImproved) {
    arrayPush(reasons, 'next generation did not strictly improve measured fitness');
  }
  return objectFreeze({
    baseline: objectFreeze({
      archive: archiveLocator(baselineRecord),
      adopted: baselineDiscovery.adopted,
      benchmark: baselineBenchmark,
      benchmarkIdentity: baselineBenchmarkIdentity,
      fitness: baselineFitness,
      winnerId: baselineDiscovery.winnerId
    }),
    current: objectFreeze({
      adopted: currentDiscovery.adopted,
      benchmark: currentBenchmark,
      benchmarkIdentity: normalizedCurrentBenchmarkIdentity,
      fitness: currentFitness,
      winnerId: currentDiscovery.winnerId
    }),
    deltas: rateDeltas,
    benchmarkIdentityStable,
    benchmarkStable,
    nonRegressing,
    strictlyImproved,
    accepted: currentDiscovery.adopted === true
      && nonRegressing
      && benchmarkStable
      && strictlyImproved,
    reasons: objectFreeze(reasons),
    dataOnly: true,
    authorityTransferred: false
  });
}

function sameArchiveLocator(left, right) {
  return left !== null
    && right !== null
    && left.kind === right.kind
    && left.sequence === right.sequence
    && left.hash === right.hash;
}

function factoryHistoryFromLedger(ledger, factoryId) {
  const discoveries = ledger.restoreArchitectureDiscoveries();
  const records = arrayFilter(
    ledger.records,
    (record) => record.kind === 'architecture-discovery'
  );
  if (discoveries.length !== records.length) {
    throw new Error('Harness Factory history has inconsistent archive records');
  }
  const history = [];
  arrayForEach(records, (record, index) => {
    const discovery = discoveries[index];
    if (discovery.factory?.factoryId !== factoryId) {
      return;
    }
    const previous = history.length === 0
      ? null
      : history[history.length - 1];
    const metadata = discovery.factory;
    if (metadata.generation !== history.length + 1) {
      throw new Error('Harness Factory history generation sequence is inconsistent');
    }
    const predecessor = metadata.predecessor;
    if (previous === null) {
      if (predecessor !== null) {
        throw new Error('Harness Factory first generation has an unexpected predecessor');
      }
    } else if (!sameArchiveLocator(predecessor, archiveLocator(previous.record))) {
      throw new Error('Harness Factory generation predecessor is inconsistent');
    }
    const baselineSequence = metadata.improvement?.baselineSequence ?? null;
    if (baselineSequence !== null) {
      const baseline = arrayFind(
        history,
        ({ record }) => record.sequence === baselineSequence
      );
      if (baseline === undefined) {
        throw new Error('Harness Factory improvement baseline is not in verified history');
      }
      if (!sameFactoryBenchmarkIdentity(
        baseline.discovery.factory?.benchmark ?? null,
        metadata.benchmark
      )) {
        throw new Error('Harness Factory improvement baseline benchmark is inconsistent');
      }
    }
    arrayPush(history, objectFreeze({ discovery, record }));
  });
  return objectFreeze(history);
}

function factoryHistorySummary({ discovery, record }) {
  const metadata = discovery.factory;
  const benchmark = factoryBenchmarkForDiscovery(discovery);
  return objectFreeze({
    archive: archiveLocator(record),
    architecture: factoryArchitectureForDiscovery(discovery),
    benchmark: metadata.benchmark,
    benchmarkCaseIds: objectFreeze(arrayMap(
      benchmark[0]?.cases ?? [],
      ({ caseId }) => caseId
    )),
    factoryId: metadata.factoryId,
    fitness: factoryFitnessForDiscovery(discovery),
    generation: metadata.generation,
    holdoutStatus: factoryHoldoutStatus(metadata),
    improvement: metadata.improvement,
    status: metadata.status,
    winnerId: discovery.winnerId
  });
}

function validationForHistoryEntry(validations, entry) {
  let latest = null;
  arrayForEach(validations, (validation) => {
    if (
      validation.factoryId === entry.discovery.factory?.factoryId
      && validation.baselineGeneration === entry.discovery.factory?.generation
      && sameArchiveLocator(validation.baseline, archiveLocator(entry.record))
      && validation.architectureId === entry.discovery.winnerId
      && validation.architectureFingerprint
        === entry.discovery.winnerArchitectureFingerprint
    ) {
      latest = validation;
    }
  });
  return latest;
}

function effectiveHoldoutStatus(entry, validation) {
  const archivedStatus = factoryHoldoutStatus(entry.discovery.factory);
  return archivedStatus === HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN
    && validation !== null
    ? validation.status
    : archivedStatus;
}

function factoryRecommendationFromHistory({ factory, history, validations = [] }) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError('Harness Factory recommendation requires an exact trusted factory');
  }
  if (!arrayIsArray(history)) {
    throw new TypeError('Harness Factory recommendation requires verified history');
  }
  if (!arrayIsArray(validations)) {
    throw new TypeError('Harness Factory recommendation requires verified validations');
  }
  if (history.length === 0) {
    return new HarnessFactoryRecommendationReport({
      factory,
      consideredGenerationCount: 0,
      recommendation: null,
      reason: 'no archived factory generation is available',
      status: HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY,
      token: FACTORY_TOKEN
    });
  }
  let failedHoldoutTarget = null;
  arrayForEach(history, (entry, index) => {
    const validation = validationForHistoryEntry(validations, entry);
    if (effectiveHoldoutStatus(entry, validation) !== HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED) {
      return;
    }
    const recoveredLater = arraySome(
      history,
      (laterEntry, laterIndex) => laterIndex > index
        && sameFactoryBenchmarkIdentity(
          laterEntry.discovery.factory?.benchmark ?? null,
          entry.discovery.factory?.benchmark ?? null
        )
        && effectiveHoldoutStatus(
          laterEntry,
          validationForHistoryEntry(validations, laterEntry)
        )
          === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
    );
    if (!recoveredLater) {
      failedHoldoutTarget = entry;
    }
  });
  const latest = history[history.length - 1];
  const target = failedHoldoutTarget ?? latest;
  const targetHoldoutStatus = effectiveHoldoutStatus(
    target,
    validationForHistoryEntry(validations, target)
  );
  const status = failedHoldoutTarget !== null
    ? HARNESS_FACTORY_RECOMMENDATION_STATUSES.RECOVER_FAILED_HOLDOUT
    : targetHoldoutStatus === HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN
      ? HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
      : HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION;
  const reason = status === HARNESS_FACTORY_RECOMMENDATION_STATUSES.RECOVER_FAILED_HOLDOUT
    ? 'recover the latest unresolved failed holdout'
    : status === HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
      ? 'validate the latest generation with an unseen holdout'
      : 'seek a strict improvement from the latest generation';
  return new HarnessFactoryRecommendationReport({
    factory,
    consideredGenerationCount: history.length,
    recommendation: factoryHistorySummary(target),
    reason,
    status,
    token: FACTORY_TOKEN
  });
}

const HARNESS_FACTORY_RESEARCH_TARGET_PRIORITIES = objectFreeze({
  [HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION]: 450,
  [HARNESS_FACTORY_RESEARCH_TARGETS.RECOVER_FAILED_HOLDOUT]: 400,
  [HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT]: 300,
  [HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_SKEPTIC_WEAKNESS]: 220,
  [HARNESS_FACTORY_RESEARCH_TARGETS.TEST_TRANSFER_GAP]: 210,
  [HARNESS_FACTORY_RESEARCH_TARGETS.IMPROVE_LATEST_GENERATION]: 200
});

function holdoutRecoveredLater(history, validations, index) {
  const entry = history[index];
  return arraySome(
    history,
    (laterEntry, laterIndex) => laterIndex > index
      && sameFactoryBenchmarkIdentity(
        laterEntry.discovery.factory?.benchmark ?? null,
        entry.discovery.factory?.benchmark ?? null
      )
      && effectiveHoldoutStatus(
        laterEntry,
        validationForHistoryEntry(validations, laterEntry)
      ) === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
  );
}

function factoryResearchAgendaItem({
  entry,
  validation,
  target,
  reason
}) {
  const summary = factoryHistorySummary(entry);
  const holdoutStatus = effectiveHoldoutStatus(entry, validation);
  return objectFreeze({
    id: `harness-factory-research:${target}:${entry.record.sequence}`,
    factoryId: summary.factoryId,
    target,
    priority: HARNESS_FACTORY_RESEARCH_TARGET_PRIORITIES[target],
    generation: summary.generation,
    archive: summary.archive,
    validationArchive: validation?.archive ?? null,
    benchmark: summary.benchmark,
    holdoutStatus,
    fitness: summary.fitness,
    reason: requireNonEmptyString(reason, 'Harness Factory research agenda reason'),
    dataOnly: true,
    authorityTransferred: false
  });
}

function factoryBenchmarkValidationResearchAgendaItem({ validation, reason }) {
  const benchmarkPoint = validation.benchmarkPoint;
  const campaignArchive = archiveLocator(validation.campaignArchive);
  const validationArchive = archiveLocator(validation.archive);
  const benchmarkValidation = objectFreeze({
    candidateId: validation.candidateId,
    levelId: validation.levelId,
    caseFingerprint: validation.caseFingerprint,
    caseIds: objectFreeze(arraySlice(validation.caseIds)),
    architectureFingerprint: benchmarkPoint.architectureFingerprint,
    campaignArchive,
    campaignPoint: validation.campaignPoint,
    benchmarkPoint,
    holdout: validation.holdout,
    complete: validation.complete,
    reproducible: validation.reproducible,
    independent: validation.independent,
    status: validation.status,
    passed: validation.passed,
    benchmarkMatch: true,
    deployed: false,
    dataOnly: true,
    authorityTransferred: false
  });
  return objectFreeze({
    id: `harness-factory-research:${HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION}:${validation.archive.sequence}`,
    factoryId: validation.factoryId,
    target: HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION,
    priority: HARNESS_FACTORY_RESEARCH_TARGET_PRIORITIES[
      HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION
    ],
    generation: null,
    archive: validationArchive,
    validationArchive,
    benchmark: objectFreeze({
      candidateId: validation.candidateId,
      levelId: validation.levelId,
      caseFingerprint: validation.caseFingerprint,
      caseIds: objectFreeze(arraySlice(validation.caseIds)),
      campaignArchive
    }),
    benchmarkValidation,
    holdoutStatus: validation.status,
    fitness: objectFreeze({
      productionSuccessRate: benchmarkPoint.productionSuccessRate,
      productionProvenRate: benchmarkPoint.productionProvenRate,
      researchSuccessRate: benchmarkPoint.researchSuccessRate,
      researchProvenRate: benchmarkPoint.researchProvenRate,
      skepticSuccessRate: benchmarkPoint.skepticSuccessRate,
      transferSuccessRate: benchmarkPoint.transferSuccessRate,
      skepticWeaknessesExposed: benchmarkPoint.skepticWeaknessesExposed
    }),
    reason: requireNonEmptyString(
      reason,
      'Harness Factory benchmark validation research agenda reason'
    ),
    dataOnly: true,
    authorityTransferred: false
  });
}

function isValidHarnessFactoryBenchmarkValidationResearchAgendaItem(item, factory) {
  const benchmark = item?.benchmark;
  const detail = item?.benchmarkValidation;
  const benchmarkPoint = detail?.benchmarkPoint;
  const campaignPoint = detail?.campaignPoint;
  const holdout = detail?.holdout;
  const fitness = item?.fitness;
  const forbiddenKeys = [
    'candidate',
    'candidates',
    'runner',
    'actionReport'
  ];
  return isPlainObject(item)
    && item.factoryId === factory.factoryId
    && item.target === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION
    && item.priority === HARNESS_FACTORY_RESEARCH_TARGET_PRIORITIES[
      HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION
    ]
    && item.generation === null
    && isPlainObject(item.archive)
    && item.archive.kind === 'harness-factory-benchmark-validation'
    && isSafeInteger(item.archive.sequence)
    && item.archive.sequence > 0
    && sameArchiveLocator(item.archive, item.validationArchive)
    && isPlainObject(benchmark)
    && benchmark.candidateId === detail?.candidateId
    && benchmark.levelId === detail?.levelId
    && benchmark.caseFingerprint === detail?.caseFingerprint
    && jsonStringify(benchmark.caseIds) === jsonStringify(detail?.caseIds)
    && sameArchiveLocator(benchmark.campaignArchive, detail?.campaignArchive)
    && isPlainObject(detail)
    && typeof detail.candidateId === 'string'
    && stringTrim(detail.candidateId) !== ''
    && typeof detail.levelId === 'string'
    && stringTrim(detail.levelId) !== ''
    && typeof detail.caseFingerprint === 'string'
    && stringTrim(detail.caseFingerprint) !== ''
    && arrayIsArray(detail.caseIds)
    && detail.caseIds.length > 0
    && setSize(setFromArray(detail.caseIds)) === detail.caseIds.length
    && arrayEvery(
      detail.caseIds,
      (caseId) => typeof caseId === 'string' && stringTrim(caseId) !== ''
    )
    && typeof detail.architectureFingerprint === 'string'
    && stringTrim(detail.architectureFingerprint) !== ''
    && isValidFactoryBenchmarkPoint(campaignPoint, [detail.candidateId])
    && isValidFactoryBenchmarkPoint(benchmarkPoint, [detail.candidateId])
    && sameFactoryBenchmarkPointEvidence(campaignPoint, benchmarkPoint)
    && campaignPoint.architectureFingerprint === detail.architectureFingerprint
    && benchmarkPoint.architectureFingerprint === detail.architectureFingerprint
    && isValidFactoryHoldoutEvidence(holdout, detail.candidateId, false)
    && detail.status === item.holdoutStatus
    && detail.benchmarkMatch === true
    && (
      detail.status === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
      || detail.status === HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED
    )
    && detail.complete === (benchmarkPoint.complete && holdout.complete)
    && detail.reproducible === (benchmarkPoint.reproducible && holdout.reproducible)
    && detail.independent === (benchmarkPoint.independent && holdout.independent)
    && detail.passed === (
      campaignPoint.complete
      && campaignPoint.reproducible
      && campaignPoint.independent
      && benchmarkPoint.complete
      && benchmarkPoint.reproducible
      && benchmarkPoint.independent
      && holdout.passed
    )
    && detail.status === (
      detail.passed
        ? HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
        : HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED
    )
    && detail.dataOnly === true
    && detail.deployed === false
    && detail.authorityTransferred === false
    && item.holdoutStatus === (
      detail.passed
        ? HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
        : HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED
    )
    && isPlainObject(fitness)
    && fitness.productionSuccessRate === benchmarkPoint.productionSuccessRate
    && fitness.productionProvenRate === benchmarkPoint.productionProvenRate
    && fitness.researchSuccessRate === benchmarkPoint.researchSuccessRate
    && fitness.researchProvenRate === benchmarkPoint.researchProvenRate
    && fitness.skepticSuccessRate === benchmarkPoint.skepticSuccessRate
    && fitness.transferSuccessRate === benchmarkPoint.transferSuccessRate
    && fitness.skepticWeaknessesExposed === benchmarkPoint.skepticWeaknessesExposed
    && item.dataOnly === true
    && item.authorityTransferred === false
    && !arraySome(
      forbiddenKeys,
      (key) => arrayIncludes(reflectOwnKeys(item), key)
        || arrayIncludes(reflectOwnKeys(benchmark), key)
        || arrayIncludes(reflectOwnKeys(detail), key)
        || arrayIncludes(reflectOwnKeys(campaignPoint), key)
        || arrayIncludes(reflectOwnKeys(benchmarkPoint), key)
        || arrayIncludes(reflectOwnKeys(holdout), key)
    );
}

function factoryResearchAgendaFromHistory({
  factory,
  history,
  validations,
  benchmarkValidations = [],
  maxItems
}) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError('Harness Factory research agenda requires an exact trusted factory');
  }
  if (!arrayIsArray(history)) {
    throw new TypeError('Harness Factory research agenda requires verified history');
  }
  if (!arrayIsArray(validations)) {
    throw new TypeError('Harness Factory research agenda requires verified validations');
  }
  if (!arrayIsArray(benchmarkValidations)) {
    throw new TypeError(
      'Harness Factory research agenda requires verified benchmark validations'
    );
  }
  if (!isSafeInteger(maxItems) || maxItems <= 0) {
    throw new TypeError('Harness Factory research agenda maxItems must be positive');
  }

  const recommendation = factoryRecommendationFromHistory({
    factory,
    history,
    validations
  });
  const proposed = [];
  const add = (entry, validation, target, reason) => {
    arrayPush(proposed, factoryResearchAgendaItem({
      entry,
      validation,
      target,
      reason
    }));
  };

  arrayForEach(benchmarkValidations, (validation, index) => {
    if (
      validation.factoryId !== factory.factoryId
      || validation.status !== HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED
      || arraySome(
        benchmarkValidations,
        (laterValidation, laterIndex) => laterIndex > index
          && laterValidation.factoryId === validation.factoryId
          && laterValidation.candidateId === validation.candidateId
          && laterValidation.levelId === validation.levelId
          && sameArchiveLocator(
            laterValidation.campaignArchive,
            validation.campaignArchive
          )
          && laterValidation.status === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
      )
    ) {
      return;
    }
    arrayPush(
      proposed,
      factoryBenchmarkValidationResearchAgendaItem({
        validation,
        reason: 'an unresolved failed benchmark validation needs a fresh generalization experiment'
      })
    );
  });

  arrayForEach(history, (entry, index) => {
    const validation = validationForHistoryEntry(validations, entry);
    if (
      effectiveHoldoutStatus(entry, validation)
        === HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED
      && !holdoutRecoveredLater(history, validations, index)
    ) {
      add(
        entry,
        validation,
        HARNESS_FACTORY_RESEARCH_TARGETS.RECOVER_FAILED_HOLDOUT,
        'an unresolved failed holdout needs a fresh recovery experiment'
      );
    }
  });

  if (history.length > 0) {
    const latest = history[history.length - 1];
    const validation = validationForHistoryEntry(validations, latest);
    const status = effectiveHoldoutStatus(latest, validation);
    const fitness = factoryFitnessForDiscovery(latest.discovery);
    if (fitness.skepticWeaknessesExposed > 0) {
      add(
        latest,
        validation,
        HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_SKEPTIC_WEAKNESS,
        'skeptic evaluation exposed a weakness that merits a targeted experiment'
      );
    }
    if (status === HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN) {
      add(
        latest,
        validation,
        HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT,
        'the latest generation has no independent holdout result'
      );
    } else if (status === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED) {
      if (fitness.transferSuccessRate < fitness.productionSuccessRate) {
        add(
          latest,
          validation,
          HARNESS_FACTORY_RESEARCH_TARGETS.TEST_TRANSFER_GAP,
          'transfer performance trails production performance on the verified benchmark'
        );
      }
      add(
        latest,
        validation,
        HARNESS_FACTORY_RESEARCH_TARGETS.IMPROVE_LATEST_GENERATION,
        'the latest generation passed holdout and is ready for a strict improvement experiment'
      );
    }
  }

  const ranked = arraySort(
    proposed,
    (left, right) => right.priority - left.priority
      || right.generation - left.generation
      || right.archive.sequence - left.archive.sequence
      || stringLocaleCompare(left.id, right.id)
  );
  const truncated = ranked.length > maxItems;
  const selected = arrayMap(
    arraySlice(
      ranked,
      0,
      maxItems
    ),
    (item, index) => objectFreeze({
      ...item,
      rank: index + 1
    })
  );
  return new HarnessFactoryResearchAgendaReport({
    factory,
    consideredGenerationCount: history.length,
    consideredValidationCount: validations.length + benchmarkValidations.length,
    consideredTargetCount: proposed.length,
    requestedItemCount: maxItems,
    recommendationStatus: recommendation.status,
    items: selected,
    truncated,
    token: FACTORY_TOKEN
  });
}

export const MAX_HARNESS_FACTORY_BENCHMARK_CASES = 32;

function requireTrustedBenchmarkCases(cases) {
  if (!arrayIsArray(cases) || cases.length === 0) {
    throw new TypeError('Harness Factory benchmark requires cases');
  }
  if (cases.length > MAX_HARNESS_FACTORY_BENCHMARK_CASES) {
    throw new RangeError(
      `Harness Factory benchmark cases cannot exceed ${MAX_HARNESS_FACTORY_BENCHMARK_CASES}`
    );
  }
  const normalizedCases = arrayMap(cases, (evaluationCase) => {
    if (!isTrustedAgentPlannerCase(evaluationCase)) {
      throw new TypeError('Harness Factory benchmark cases must be trusted planner cases');
    }
    return evaluationCase;
  });
  if (
    setSize(setFromArray(arrayMap(normalizedCases, ({ id }) => id)))
      !== normalizedCases.length
  ) {
    throw new TypeError('Harness Factory benchmark case ids must be unique');
  }
  return objectFreeze(arraySlice(normalizedCases));
}

function benchmarkCaseFingerprint(cases) {
  const definitions = arrayMap(cases, (evaluationCase) => ({
    adversarial: evaluationCase.adversarial,
    context: evaluationCase.context,
    domain: evaluationCase.domain,
    goal: evaluationCase.goal,
    id: evaluationCase.id,
    productionEligible: evaluationCase.productionEligible,
    requiresProof: evaluationCase.requiresProof,
    task: evaluationCase.task
  }));
  return `sha256:${createHash('sha256')
    .update(jsonStringify(definitions))
    .digest('hex')}`;
}

function benchmarkBudget(value, field, caseCount) {
  const normalized = value ?? new EvaluationBudget({ maxCases: caseCount });
  if (!isTrustedEvaluationBudget(normalized)) {
    throw new TypeError(`${field} must be a trusted EvaluationBudget`);
  }
  return normalized;
}

function normalizeBenchmarkLevel(level, index, caseCount) {
  requireDataObject(level, `Harness Factory benchmark level ${index}`, BENCHMARK_LEVEL_KEYS);
  if (!isSafeInteger(level.computeUnits) || level.computeUnits <= 0) {
    throw new TypeError(
      `Harness Factory benchmark level ${index} computeUnits must be positive`
    );
  }
  return objectFreeze({
    id: requireNonEmptyString(
      level.id,
      `Harness Factory benchmark level ${index} id`
    ),
    computeUnits: level.computeUnits,
    productionBudget: benchmarkBudget(
      level.productionBudget,
      `Harness Factory benchmark level ${index} productionBudget`,
      caseCount
    ),
    researchBudget: benchmarkBudget(
      level.researchBudget,
      `Harness Factory benchmark level ${index} researchBudget`,
      caseCount
    ),
    skepticBudget: benchmarkBudget(
      level.skepticBudget,
      `Harness Factory benchmark level ${index} skepticBudget`,
      caseCount
    )
  });
}

function requireBenchmarkLevels(levels, caseCount) {
  if (!arrayIsArray(levels) || levels.length === 0) {
    throw new TypeError('Harness Factory benchmark requires levels');
  }
  if (levels.length > MAX_HARNESS_FACTORY_BENCHMARK_LEVELS) {
    throw new RangeError(
      `Harness Factory benchmark levels cannot exceed ${MAX_HARNESS_FACTORY_BENCHMARK_LEVELS}`
    );
  }
  const normalizedLevels = arrayMap(
    levels,
    (level, index) => normalizeBenchmarkLevel(level, index, caseCount)
  );
  if (
    setSize(setFromArray(arrayMap(normalizedLevels, ({ id }) => id)))
      !== normalizedLevels.length
    || setSize(setFromArray(arrayMap(normalizedLevels, ({ computeUnits }) => computeUnits)))
      !== normalizedLevels.length
  ) {
    throw new TypeError(
      'Harness Factory benchmark level ids and computeUnits must be unique'
    );
  }
  return objectFreeze(normalizedLevels);
}

function requireTrustedBenchmarkCandidates(candidates) {
  if (!arrayIsArray(candidates) || candidates.length < 2) {
    throw new TypeError(
      'Harness Factory benchmark campaign requires at least two candidates'
    );
  }
  if (candidates.length > MAX_HARNESS_FACTORY_BENCHMARK_CANDIDATES) {
    throw new RangeError(
      `Harness Factory benchmark campaign candidates cannot exceed ${MAX_HARNESS_FACTORY_BENCHMARK_CANDIDATES}`
    );
  }
  const normalizedCandidates = arrayMap(candidates, (candidate) => {
    if (!isTrustedAgentArchitectureCandidate(candidate)) {
      throw new TypeError(
        'Harness Factory benchmark campaign requires trusted architecture candidates'
      );
    }
    if (
      weakSetHas(DISPOSED_ARCHITECTURE_CANDIDATES, candidate)
      || weakSetHas(PROTECTED_ADOPTED_CANDIDATES, candidate)
    ) {
      throw new TypeError(
        'Harness Factory benchmark campaign requires fresh unretired candidates'
      );
    }
    return candidate;
  });
  if (
    setSize(setFromArray(arrayMap(normalizedCandidates, ({ id }) => id)))
      !== normalizedCandidates.length
    || setSize(setFromArray(arrayMap(normalizedCandidates, ({ plannerCandidate }) => plannerCandidate)))
      !== normalizedCandidates.length
    || setSize(setFromArray(arrayMap(normalizedCandidates, ({ policyFactory }) => policyFactory)))
      !== normalizedCandidates.length
  ) {
    throw new TypeError(
      'Harness Factory benchmark campaign candidate ids, planners, and policy factories must be unique'
    );
  }
  return objectFreeze(arraySlice(normalizedCandidates));
}

function factoryBenchmarkFitnessForResult(result) {
  if (!isPlainObject(result?.fitness)) {
    throw new TypeError('Harness Factory benchmark result has no measurable fitness');
  }
  return objectFreeze({
    productionSuccessRate: result.fitness.productionSuccessRate,
    productionProvenRate: result.fitness.productionProvenRate,
    researchSuccessRate: result.fitness.researchSuccessRate,
    researchProvenRate: result.fitness.researchProvenRate,
    skepticSuccessRate: result.fitness.skepticSuccessRate,
    skepticWeaknessesExposed: result.fitness.skepticWeaknessesExposed,
    transferSuccessRate: result.fitness.transferSuccessRate
  });
}

function factoryBenchmarkPoint({
  candidate,
  level,
  primary,
  reproduction,
  reproducibility,
  elapsedMs
}) {
  if (
    !isTrustedAgentArchitectureSearchReport(primary)
    || !isTrustedAgentArchitectureSearchReport(reproduction)
  ) {
    throw new TypeError('Harness Factory benchmark requires trusted search reports');
  }
  const primaryResult = arrayFind(
    primary.results,
    (result) => result.architectureId === candidate.id
  );
  const reproductionResult = arrayFind(
    reproduction.results,
    (result) => result.architectureId === candidate.id
  );
  if (!primaryResult || !reproductionResult) {
    throw new TypeError('Harness Factory benchmark search reports lack the candidate');
  }
  const fitness = factoryBenchmarkFitnessForResult(primaryResult);
  const definitionFingerprint = primaryResult.architectureFingerprint ?? null;
  return objectFreeze({
    architectureId: candidate.id,
    architectureFingerprint: definitionFingerprint,
    levelId: level.id,
    computeUnits: level.computeUnits,
    budgets: objectFreeze({
      production: level.productionBudget.maxCases,
      research: level.researchBudget.maxCases,
      skeptic: level.skepticBudget.maxCases
    }),
    ...fitness,
    complete: primary.complete === true
      && reproduction.complete === true
      && primaryResult.complete === true
      && reproductionResult.complete === true
      && reproducibility.reproducible === true,
    reproducible: reproducibility.reproducible === true,
    independent: primary !== reproduction,
    elapsedMs,
    error: primaryResult.error,
    dataOnly: true,
    authorityTransferred: false
  });
}

function factoryBenchmarkDominates(left, right) {
  const noWorse = arrayEvery(
    FACTORY_FITNESS_RATE_KEYS,
    (key) => left[key] >= right[key]
  )
    && left.skepticWeaknessesExposed <= right.skepticWeaknessesExposed
    && left.computeUnits <= right.computeUnits;
  const strictlyBetter = arraySome(
    FACTORY_FITNESS_RATE_KEYS,
    (key) => left[key] > right[key]
  )
    || left.skepticWeaknessesExposed < right.skepticWeaknessesExposed
    || left.computeUnits < right.computeUnits;
  return noWorse && strictlyBetter;
}

function factoryBenchmarkFrontier(points) {
  return objectFreeze(arraySort(
    arrayFilter(
      points,
      (point, pointIndex) => arrayEvery(
        points,
        (other, otherIndex) => pointIndex === otherIndex
          || !factoryBenchmarkDominates(other, point)
      )
    ),
    (left, right) => left.computeUnits - right.computeUnits
      || stringLocaleCompare(left.architectureId, right.architectureId)
      || stringLocaleCompare(left.levelId, right.levelId)
  ));
}

function factoryBenchmarkCandidate({ factory, candidate, cases, levels }) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError('Harness Factory benchmark requires an exact trusted factory');
  }
  if (!isTrustedAgentArchitectureCandidate(candidate)) {
    throw new TypeError('Harness Factory benchmark requires a trusted architecture candidate');
  }
  if (
    weakSetHas(DISPOSED_ARCHITECTURE_CANDIDATES, candidate)
    || weakSetHas(PROTECTED_ADOPTED_CANDIDATES, candidate)
  ) {
    throw new TypeError('Harness Factory benchmark requires a fresh unretired candidate');
  }
  verifiedLedgerSnapshot(factory.ledger);
  const normalizedCases = requireTrustedBenchmarkCases(cases);
  const normalizedLevels = requireBenchmarkLevels(levels, normalizedCases.length);
  const points = [];
  let firstDefinitionFingerprint = null;
  let definitionFingerprintSet = false;
  arrayForEach(normalizedLevels, (level) => {
    const primaryRunner = new AgentArchitectureSearchRunner();
    const reproductionRunner = new AgentArchitectureSearchRunner();
    const started = highResolutionTime();
    const primary = primaryRunner.evaluate({
      candidates: [candidate],
      cases: normalizedCases,
      productionBudget: level.productionBudget,
      researchBudget: level.researchBudget,
      skepticBudget: level.skepticBudget
    });
    const reproduction = reproductionRunner.evaluate({
      candidates: [candidate],
      cases: normalizedCases,
      productionBudget: level.productionBudget,
      researchBudget: level.researchBudget,
      skepticBudget: level.skepticBudget
    });
    const reproducibility = new AgentArchitectureReproducibilityAuthority().reproduce({
      searchReport: primary,
      reproductionReport: reproduction,
      candidateId: candidate.id
    });
    const primaryResult = arrayFind(
      primary.results,
      (result) => result.architectureId === candidate.id
    );
    const currentDefinitionFingerprint = primaryResult?.architectureFingerprint ?? null;
    if (!definitionFingerprintSet) {
      firstDefinitionFingerprint = currentDefinitionFingerprint;
      definitionFingerprintSet = true;
    } else if (currentDefinitionFingerprint !== firstDefinitionFingerprint) {
      throw new Error(
        'Harness Factory benchmark architecture definition drifted across levels'
      );
    }
    const elapsedMs = toNumber(highResolutionTime() - started) / 1_000_000;
    arrayPush(points, factoryBenchmarkPoint({
      candidate,
      level,
      primary,
      reproduction,
      reproducibility,
      elapsedMs
    }));
  });
  const sortedPoints = objectFreeze(arraySort(
    points,
    (left, right) => left.computeUnits - right.computeUnits
      || stringLocaleCompare(left.levelId, right.levelId)
  ));
  return new HarnessFactoryBenchmarkReport({
    factory,
    candidateId: candidate.id,
    caseIds: arrayMap(normalizedCases, ({ id }) => id),
    architectureFingerprint: firstDefinitionFingerprint,
    points: sortedPoints,
    frontier: factoryBenchmarkFrontier(sortedPoints),
    token: FACTORY_TOKEN
  });
}

function factoryBenchmarkCampaign({ factory, candidates, cases, levels }) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError(
      'Harness Factory benchmark campaign requires an exact trusted factory'
    );
  }
  const normalizedCandidates = requireTrustedBenchmarkCandidates(candidates);
  verifiedLedgerSnapshot(factory.ledger);
  const normalizedCases = requireTrustedBenchmarkCases(cases);
  const normalizedLevels = requireBenchmarkLevels(levels, normalizedCases.length);
  const points = [];
  const definitionFingerprints = [];
  arrayForEach(normalizedLevels, (level) => {
    const primaryRunner = new AgentArchitectureSearchRunner();
    const reproductionRunner = new AgentArchitectureSearchRunner();
    const started = highResolutionTime();
    const primary = primaryRunner.evaluate({
      candidates: normalizedCandidates,
      cases: normalizedCases,
      productionBudget: level.productionBudget,
      researchBudget: level.researchBudget,
      skepticBudget: level.skepticBudget
    });
    const reproduction = reproductionRunner.evaluate({
      candidates: normalizedCandidates,
      cases: normalizedCases,
      productionBudget: level.productionBudget,
      researchBudget: level.researchBudget,
      skepticBudget: level.skepticBudget
    });
    const elapsedMs = toNumber(highResolutionTime() - started) / 1_000_000;
    arrayForEach(normalizedCandidates, (candidate) => {
      const primaryResult = arrayFind(
        primary.results,
        (result) => result.architectureId === candidate.id
      );
      const currentDefinitionFingerprint = primaryResult?.architectureFingerprint ?? null;
      const knownDefinition = arrayFind(
        definitionFingerprints,
        ({ candidateId }) => candidateId === candidate.id
      );
      if (knownDefinition === undefined) {
        arrayPush(definitionFingerprints, {
          candidateId: candidate.id,
          architectureFingerprint: currentDefinitionFingerprint
        });
      } else if (
        knownDefinition.architectureFingerprint !== currentDefinitionFingerprint
      ) {
        throw new Error(
          'Harness Factory benchmark campaign architecture definition drifted across levels'
        );
      }
      const reproducibility = new AgentArchitectureReproducibilityAuthority().reproduce({
        searchReport: primary,
        reproductionReport: reproduction,
        candidateId: candidate.id
      });
      arrayPush(points, factoryBenchmarkPoint({
        candidate,
        level,
        primary,
        reproduction,
        reproducibility,
        elapsedMs
      }));
    });
  });
  const sortedPoints = objectFreeze(arraySort(
    points,
    (left, right) => left.computeUnits - right.computeUnits
      || stringLocaleCompare(left.architectureId, right.architectureId)
      || stringLocaleCompare(left.levelId, right.levelId)
  ));
  return new HarnessFactoryBenchmarkCampaignReport({
    factory,
    candidateIds: arrayMap(normalizedCandidates, ({ id }) => id),
    caseIds: arrayMap(normalizedCases, ({ id }) => id),
    caseFingerprint: benchmarkCaseFingerprint(normalizedCases),
    points: sortedPoints,
    frontier: factoryBenchmarkFrontier(sortedPoints),
    token: FACTORY_TOKEN
  });
}

const BENCHMARK_POINT_VALIDATION_KEYS = objectFreeze([
  'architectureFingerprint',
  'architectureId',
  'authorityTransferred',
  'budgets',
  'complete',
  'computeUnits',
  'dataOnly',
  'error',
  'independent',
  'levelId',
  'productionProvenRate',
  'productionSuccessRate',
  'reproducible',
  'researchProvenRate',
  'researchSuccessRate',
  'skepticSuccessRate',
  'skepticWeaknessesExposed',
  'transferSuccessRate'
]);

function sameFactoryBenchmarkPointEvidence(left, right) {
  return arrayEvery(
    BENCHMARK_POINT_VALIDATION_KEYS,
    (key) => jsonStringify(left[key]) === jsonStringify(right[key])
  );
}

function sameFactoryBenchmarkPointRecord(left, right) {
  return sameFactoryBenchmarkPointEvidence(left, right)
    && left.elapsedMs === right.elapsedMs;
}

function sameFactoryBenchmarkPointArray(left, right, includeElapsedMs) {
  const pointComparator = includeElapsedMs
    ? sameFactoryBenchmarkPointRecord
    : sameFactoryBenchmarkPointEvidence;
  return left.length === right.length
    && arrayEvery(left, (leftPoint) => {
      const rightPoint = arrayFind(
        right,
        (candidatePoint) => candidatePoint.architectureId === leftPoint.architectureId
          && candidatePoint.levelId === leftPoint.levelId
      );
      return rightPoint !== undefined && pointComparator(leftPoint, rightPoint);
    });
}

function sameFactoryBenchmarkCampaignEvidence(left, right) {
  return left.factoryId === right.factoryId
    && left.caseFingerprint === right.caseFingerprint
    && jsonStringify(left.candidateIds) === jsonStringify(right.candidateIds)
    && jsonStringify(left.caseIds) === jsonStringify(right.caseIds)
    && sameFactoryBenchmarkPointArray(left.points, right.points, true)
    && sameFactoryBenchmarkPointArray(left.frontier, right.frontier, true)
    && left.complete === right.complete
    && left.reproducible === right.reproducible
    && left.independent === right.independent
    && left.dataOnly === right.dataOnly
    && left.deployed === right.deployed
    && left.authorityTransferred === right.authorityTransferred;
}

function verifyArchivedBenchmarkCampaign({ factory, campaign, ledger }) {
  if (
    !isTrustedHarnessFactoryBenchmarkCampaignReport(campaign)
    || weakMapGet(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FACTORIES, campaign)
      !== factory
    || campaign.archived !== true
    || campaign.archive === null
  ) {
    throw new TypeError(
      'Harness Factory benchmark validation requires an archived campaign from this factory'
    );
  }
  const restored = ledger.restoreHarnessFactoryBenchmarkCampaigns();
  const historical = arrayFind(
    restored,
    (entry) => entry.factoryId === factory.factoryId
      && sameArchiveLocator(entry.archive, campaign.archive)
  );
  if (historical === undefined || !sameFactoryBenchmarkCampaignEvidence(campaign, historical)) {
    throw new Error(
      'Harness Factory benchmark validation requires the archived campaign to match the current ledger'
    );
  }
  return historical;
}

function benchmarkLevelFromPoint(point) {
  return objectFreeze({
    id: point.levelId,
    computeUnits: point.computeUnits,
    productionBudget: new EvaluationBudget({ maxCases: point.budgets.production }),
    researchBudget: new EvaluationBudget({ maxCases: point.budgets.research }),
    skepticBudget: new EvaluationBudget({ maxCases: point.budgets.skeptic })
  });
}

function requireMatchingBenchmarkCaseSuite(cases, campaign) {
  const normalizedCases = requireTrustedBenchmarkCases(cases);
  if (
    normalizedCases.length !== campaign.caseIds.length
    || !arrayEvery(
      normalizedCases,
      (evaluationCase, index) => evaluationCase.id === campaign.caseIds[index]
    )
    || benchmarkCaseFingerprint(normalizedCases) !== campaign.caseFingerprint
  ) {
    throw new Error(
      'Harness Factory benchmark validation cases do not match the archived campaign suite'
    );
  }
  return normalizedCases;
}

function validateFactoryBenchmarkCampaign({
  factory,
  campaign,
  candidate,
  levelId,
  cases,
  holdoutCases,
  holdoutProductionBudget,
  holdoutResearchBudget,
  holdoutSkepticBudget
}) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError(
      'Harness Factory benchmark validation requires an exact trusted factory'
    );
  }
  const ledger = verifiedLedgerSnapshot(factory.ledger);
  verifyArchivedBenchmarkCampaign({ factory, campaign, ledger });
  if (!isTrustedAgentArchitectureCandidate(candidate)) {
    throw new TypeError(
      'Harness Factory benchmark validation requires a trusted candidate'
    );
  }
  if (
    weakSetHas(DISPOSED_ARCHITECTURE_CANDIDATES, candidate)
    || weakSetHas(PROTECTED_ADOPTED_CANDIDATES, candidate)
  ) {
    throw new TypeError(
      'Harness Factory benchmark validation requires a fresh unretired candidate'
    );
  }
  const normalizedLevelId = requireNonEmptyString(
    levelId,
    'Harness Factory benchmark validation levelId'
  );
  const campaignPoint = arrayFind(
    campaign.frontier,
    (point) => point.architectureId === candidate.id
      && point.levelId === normalizedLevelId
  );
  if (campaignPoint === undefined) {
    throw new Error(
      'Harness Factory benchmark validation requires a frontier point for the candidate and level'
    );
  }
  const normalizedCases = requireMatchingBenchmarkCaseSuite(cases, campaign);
  const normalizedHoldoutCases = requireTrustedHoldoutCases(holdoutCases);
  requireDisjointHoldoutCases(normalizedCases, normalizedHoldoutCases);
  const budgets = holdoutBudgets(
    normalizedHoldoutCases,
    holdoutProductionBudget,
    holdoutResearchBudget,
    holdoutSkepticBudget
  );
  const benchmark = factoryBenchmarkCandidate({
    factory,
    candidate,
    cases: normalizedCases,
    levels: [benchmarkLevelFromPoint(campaignPoint)]
  });
  const benchmarkPoint = benchmark.points[0];
  if (!sameFactoryBenchmarkPointEvidence(campaignPoint, benchmarkPoint)) {
    throw new Error(
      'Harness Factory benchmark validation replay does not match the archived frontier point'
    );
  }
  const holdout = evaluateFactoryHoldout(
    candidate,
    normalizedHoldoutCases,
    budgets
  );
  if (holdout.architectureFingerprint !== campaignPoint.architectureFingerprint) {
    throw new Error(
      'Harness Factory benchmark validation holdout fingerprint does not match the archived architecture'
    );
  }
  return new HarnessFactoryBenchmarkCampaignValidationReport({
    factory,
    campaign,
    campaignPoint,
    benchmarkPoint,
    holdout,
    token: FACTORY_TOKEN
  });
}

function sameFactoryRecommendation(left, right) {
  return left.status === right.status
    && left.consideredGenerationCount === right.consideredGenerationCount
    && left.baselineGeneration === right.baselineGeneration
    && (
      left.baseline === null && right.baseline === null
      || sameArchiveLocator(left.baseline?.archive ?? null, right.baseline?.archive ?? null)
    );
}

function sameFactoryArchitectureConfiguration(candidate, architecture) {
  return candidate.id === architecture.architectureId
    && candidate.plannerCandidate.id === architecture.plannerCandidateId
    && jsonStringify(candidate.components) === jsonStringify(architecture.components);
}

function factoryHistoryReportFromHistory({ factory, history }) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError('Harness Factory history requires an exact trusted factory');
  }
  if (!arrayIsArray(history)) {
    throw new TypeError('Harness Factory history requires verified history');
  }
  const summaries = arrayMap(history, factoryHistorySummary);
  const truncated = summaries.length > MAX_HARNESS_FACTORY_HISTORY_ENTRIES;
  const generations = truncated
    ? arraySlice(
      summaries,
      summaries.length - MAX_HARNESS_FACTORY_HISTORY_ENTRIES
    )
    : summaries;
  return new HarnessFactoryHistoryReport({
    factory,
    consideredGenerationCount: summaries.length,
    generations,
    truncated,
    token: FACTORY_TOKEN
  });
}

function factoryHistoryReportFromLedger(ledger, factory) {
  const history = factoryHistoryFromLedger(ledger, factory.factoryId);
  return factoryHistoryReportFromHistory({
    factory,
    history
  });
}

function isValidHarnessFactoryBenchmarkCampaignHistorySummary(campaign) {
  const forbiddenKeys = [
    'candidate',
    'candidates',
    'primary',
    'reproduction',
    'reproducibility',
    'runner',
    'actionReport'
  ];
  return isPlainObject(campaign)
    && typeof campaign.factoryId === 'string'
    && stringTrim(campaign.factoryId) !== ''
    && arrayIsArray(campaign.candidateIds)
    && campaign.candidateIds.length >= 2
    && campaign.candidateIds.length <= MAX_HARNESS_FACTORY_BENCHMARK_CANDIDATES
    && setSize(setFromArray(campaign.candidateIds)) === campaign.candidateIds.length
    && arrayEvery(campaign.candidateIds, (candidateId) => (
      typeof candidateId === 'string' && stringTrim(candidateId) !== ''
    ))
    && arrayIsArray(campaign.caseIds)
    && campaign.caseIds.length > 0
    && setSize(setFromArray(campaign.caseIds)) === campaign.caseIds.length
    && arrayEvery(campaign.caseIds, (caseId) => (
      typeof caseId === 'string' && stringTrim(caseId) !== ''
    ))
    && arrayIsArray(campaign.points)
    && campaign.points.length > 0
    && campaign.points.length <= MAX_HARNESS_FACTORY_BENCHMARK_CANDIDATES
      * MAX_HARNESS_FACTORY_BENCHMARK_LEVELS
    && arrayEvery(
      campaign.points,
      (point) => isPlainObject(point)
        && typeof point.architectureId === 'string'
        && arrayIncludes(campaign.candidateIds, point.architectureId)
        && typeof point.levelId === 'string'
        && point.dataOnly === true
        && point.authorityTransferred === false
        && point.independent === true
        && !arraySome(
          forbiddenKeys,
          (key) => arrayIncludes(reflectOwnKeys(point), key)
        )
    )
    && arrayIsArray(campaign.frontier)
    && campaign.frontier.length > 0
    && campaign.frontier.length <= campaign.points.length
    && arrayEvery(
      campaign.frontier,
      (point) => isPlainObject(point)
        && arraySome(
          campaign.points,
          (candidatePoint) => jsonStringify(candidatePoint) === jsonStringify(point)
        )
    )
    && typeof campaign.complete === 'boolean'
    && typeof campaign.reproducible === 'boolean'
    && typeof campaign.independent === 'boolean'
    && campaign.dataOnly === true
    && campaign.deployed === false
    && campaign.authorityTransferred === false
    && isPlainObject(campaign.archive)
    && campaign.archive.kind === 'harness-factory-benchmark-campaign'
    && isSafeInteger(campaign.archive.sequence)
    && campaign.archive.sequence > 0
    && typeof campaign.archive.hash === 'string'
    && stringTrim(campaign.archive.hash) !== ''
    && !arraySome(
      forbiddenKeys,
      (key) => arrayIncludes(reflectOwnKeys(campaign), key)
    );
}

function factoryBenchmarkCampaignHistoryReportFromLedger(ledger, factory) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError(
      'Harness Factory benchmark campaign history requires an exact trusted factory'
    );
  }
  const campaigns = ledger.restoreHarnessFactoryBenchmarkCampaigns();
  const factoryCampaigns = arrayFilter(
    campaigns,
    (campaign) => campaign.factoryId === factory.factoryId
  );
  const truncated = factoryCampaigns.length
    > MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES;
  const returnedCampaigns = truncated
    ? arraySlice(
      factoryCampaigns,
      factoryCampaigns.length - MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES
    )
    : factoryCampaigns;
  return new HarnessFactoryBenchmarkCampaignHistoryReport({
    factory,
    consideredCampaignCount: factoryCampaigns.length,
    campaigns: returnedCampaigns,
    truncated,
    token: FACTORY_TOKEN
  });
}

function isValidHarnessFactoryBenchmarkCampaignValidationHistorySummary(validation) {
  const forbiddenKeys = [
    'candidate',
    'candidates',
    'primary',
    'reproduction',
    'runner',
    'actionReport'
  ];
  const candidateIds = [validation?.candidateId];
  const campaignPoint = validation?.campaignPoint;
  const benchmarkPoint = validation?.benchmarkPoint;
  const holdout = validation?.holdout;
  const passed = campaignPoint?.complete === true
    && campaignPoint?.reproducible === true
    && campaignPoint?.independent === true
    && benchmarkPoint?.complete === true
    && benchmarkPoint?.reproducible === true
    && benchmarkPoint?.independent === true
    && holdout?.passed === true;
  return isPlainObject(validation)
    && typeof validation.factoryId === 'string'
    && stringTrim(validation.factoryId) !== ''
    && typeof validation.candidateId === 'string'
    && stringTrim(validation.candidateId) !== ''
    && typeof validation.levelId === 'string'
    && stringTrim(validation.levelId) !== ''
    && typeof validation.architectureFingerprint === 'string'
    && stringTrim(validation.architectureFingerprint) !== ''
    && typeof validation.caseFingerprint === 'string'
    && stringTrim(validation.caseFingerprint) !== ''
    && arrayIsArray(validation.caseIds)
    && validation.caseIds.length > 0
    && setSize(setFromArray(validation.caseIds)) === validation.caseIds.length
    && arrayEvery(
      validation.caseIds,
      (caseId) => typeof caseId === 'string' && stringTrim(caseId) !== ''
    )
    && isValidFactoryBenchmarkPoint(campaignPoint, candidateIds)
    && isValidFactoryBenchmarkPoint(benchmarkPoint, candidateIds)
    && campaignPoint.levelId === validation.levelId
    && benchmarkPoint.levelId === validation.levelId
    && campaignPoint.architectureFingerprint === validation.architectureFingerprint
    && benchmarkPoint.architectureFingerprint === validation.architectureFingerprint
    && sameFactoryBenchmarkPointEvidence(campaignPoint, benchmarkPoint)
    && isValidFactoryHoldoutEvidence(holdout, validation.candidateId, false)
    && validation.benchmarkMatch === true
    && typeof validation.complete === 'boolean'
    && typeof validation.reproducible === 'boolean'
    && typeof validation.independent === 'boolean'
    && typeof validation.passed === 'boolean'
    && validation.complete === (benchmarkPoint.complete === true && holdout.complete === true)
    && validation.reproducible === (
      benchmarkPoint.reproducible === true && holdout.reproducible === true
    )
    && validation.independent === (
      benchmarkPoint.independent === true && holdout.independent === true
    )
    && validation.passed === passed
    && validation.status === (passed
      ? HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
      : HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED)
    && validation.dataOnly === true
    && validation.deployed === false
    && validation.authorityTransferred === false
    && isPlainObject(validation.campaignArchive)
    && validation.campaignArchive.kind === 'harness-factory-benchmark-campaign'
    && isSafeInteger(validation.campaignArchive.sequence)
    && validation.campaignArchive.sequence > 0
    && typeof validation.campaignArchive.hash === 'string'
    && stringTrim(validation.campaignArchive.hash) !== ''
    && isPlainObject(validation.archive)
    && validation.archive.kind === 'harness-factory-benchmark-validation'
    && isSafeInteger(validation.archive.sequence)
    && validation.archive.sequence > validation.campaignArchive.sequence
    && typeof validation.archive.hash === 'string'
    && stringTrim(validation.archive.hash) !== ''
    && !arraySome(
      forbiddenKeys,
      (key) => arrayIncludes(reflectOwnKeys(validation), key)
        || arrayIncludes(reflectOwnKeys(campaignPoint), key)
        || arrayIncludes(reflectOwnKeys(benchmarkPoint), key)
        || arrayIncludes(reflectOwnKeys(holdout), key)
    );
}

function factoryBenchmarkCampaignValidationHistoryReportFromLedger(ledger, factory) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError(
      'Harness Factory benchmark validation history requires an exact trusted factory'
    );
  }
  const validations = ledger.restoreHarnessFactoryBenchmarkValidations();
  const factoryValidations = arrayFilter(
    validations,
    (validation) => validation.factoryId === factory.factoryId
  );
  const truncated = factoryValidations.length
    > MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES;
  const returnedValidations = truncated
    ? arraySlice(
      factoryValidations,
      factoryValidations.length
        - MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES
    )
    : factoryValidations;
  return new HarnessFactoryBenchmarkCampaignValidationHistoryReport({
    factory,
    consideredValidationCount: factoryValidations.length,
    validations: returnedValidations,
    truncated,
    token: FACTORY_TOKEN
  });
}

function factoryBenchmarkValidationScorecardFromLedger(ledger, factory) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError(
      'Harness Factory benchmark validation scorecard requires an exact trusted factory'
    );
  }
  const validations = ledger.restoreHarnessFactoryBenchmarkValidations();
  const factoryValidations = arrayFilter(
    validations,
    (validation) => validation.factoryId === factory.factoryId
  );
  const truncated = factoryValidations.length
    > MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES;
  const returnedValidations = truncated
    ? arraySlice(
      factoryValidations,
      factoryValidations.length
        - MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES
    )
    : factoryValidations;
  const mutableScores = [];
  arrayForEach(returnedValidations, (validation) => {
    let score = arrayFind(
      mutableScores,
      (candidateScore) => candidateScore.candidateId === validation.candidateId
    );
    if (score === undefined) {
      score = {
        candidateId: validation.candidateId,
        validationCount: 0,
        passedCount: 0,
        failedCount: 0,
        completeCount: 0,
        reproducibleCount: 0,
        independentCount: 0,
        latestStatus: null,
        latestLevelId: null,
        latestArchive: null,
        latestCampaignArchive: null
      };
      arrayPush(mutableScores, score);
    }
    score.validationCount += 1;
    if (validation.passed) {
      score.passedCount += 1;
    } else {
      score.failedCount += 1;
    }
    if (validation.complete) {
      score.completeCount += 1;
    }
    if (validation.reproducible) {
      score.reproducibleCount += 1;
    }
    if (validation.independent) {
      score.independentCount += 1;
    }
    score.latestStatus = validation.status;
    score.latestLevelId = validation.levelId;
    score.latestArchive = validation.archive;
    score.latestCampaignArchive = validation.campaignArchive;
  });
  const candidateScores = arraySort(
    arrayMap(mutableScores, (score) => objectFreeze({
      candidateId: score.candidateId,
      validationCount: score.validationCount,
      passedCount: score.passedCount,
      failedCount: score.failedCount,
      passRate: score.passedCount / score.validationCount,
      completeCount: score.completeCount,
      reproducibleCount: score.reproducibleCount,
      independentCount: score.independentCount,
      latestStatus: score.latestStatus,
      latestLevelId: score.latestLevelId,
      latestArchive: score.latestArchive,
      latestCampaignArchive: score.latestCampaignArchive,
      dataOnly: true,
      authorityTransferred: false
    })),
    (left, right) => right.passRate - left.passRate
      || right.validationCount - left.validationCount
      || right.latestArchive.sequence - left.latestArchive.sequence
      || stringLocaleCompare(left.candidateId, right.candidateId)
  );
  return new HarnessFactoryBenchmarkValidationScorecardReport({
    factory,
    consideredValidationCount: factoryValidations.length,
    returnedValidationCount: returnedValidations.length,
    candidateScores,
    truncated,
    token: FACTORY_TOKEN
  });
}

function factoryBenchmarkValidationStabilityFromLedger(ledger, factory) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError(
      'Harness Factory benchmark validation stability requires an exact trusted factory'
    );
  }
  const validations = ledger.restoreHarnessFactoryBenchmarkValidations();
  const factoryValidations = arrayFilter(
    validations,
    (validation) => validation.factoryId === factory.factoryId
  );
  const truncated = factoryValidations.length
    > MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES;
  const returnedValidations = truncated
    ? arraySlice(
      factoryValidations,
      factoryValidations.length
        - MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES
    )
    : factoryValidations;
  const mutableScores = [];
  arrayForEach(returnedValidations, (validation) => {
    let score = arrayFind(
      mutableScores,
      (candidateScore) => candidateScore.candidateId === validation.candidateId
        && candidateScore.architectureFingerprint === validation.architectureFingerprint
    );
    if (score === undefined) {
      score = {
        candidateId: validation.candidateId,
        architectureFingerprint: validation.architectureFingerprint,
        validationCount: 0,
        campaignArchives: [],
        passedCount: 0,
        failedCount: 0,
        completeCount: 0,
        reproducibleCount: 0,
        independentCount: 0,
        firstArchive: null,
        latestArchive: null,
        firstCampaignArchive: null,
        latestCampaignArchive: null,
        latestStatus: null,
        latestLevelId: null
      };
      arrayPush(mutableScores, score);
    }
    score.validationCount += 1;
    if (score.firstArchive === null) {
      score.firstArchive = validation.archive;
      score.firstCampaignArchive = validation.campaignArchive;
    }
    score.latestArchive = validation.archive;
    score.latestCampaignArchive = validation.campaignArchive;
    score.latestStatus = validation.status;
    score.latestLevelId = validation.levelId;
    if (!validation.passed) {
      score.failedCount += 1;
    } else {
      score.passedCount += 1;
    }
    if (validation.complete) {
      score.completeCount += 1;
    }
    if (validation.reproducible) {
      score.reproducibleCount += 1;
    }
    if (validation.independent) {
      score.independentCount += 1;
    }
    if (!arraySome(
      score.campaignArchives,
      (campaignArchive) => sameArchiveLocator(
        campaignArchive,
        validation.campaignArchive
      )
    )) {
      arrayPush(score.campaignArchives, validation.campaignArchive);
    }
  });
  const candidateScores = arraySort(
    arrayMap(mutableScores, (score) => {
      const campaignCount = score.campaignArchives.length;
      const stable = campaignCount >= 2
        && score.passedCount === score.validationCount
        && score.completeCount === score.validationCount
        && score.reproducibleCount === score.validationCount
        && score.independentCount === score.validationCount;
      const stabilityStatus = campaignCount < 2
        ? HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
        : stable
          ? HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES.STABLE
          : HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES.UNSTABLE;
      return objectFreeze({
        candidateId: score.candidateId,
        architectureFingerprint: score.architectureFingerprint,
        validationCount: score.validationCount,
        campaignCount,
        passedCount: score.passedCount,
        failedCount: score.failedCount,
        passRate: score.passedCount / score.validationCount,
        completeCount: score.completeCount,
        reproducibleCount: score.reproducibleCount,
        independentCount: score.independentCount,
        stabilityStatus,
        stable,
        firstArchive: score.firstArchive,
        latestArchive: score.latestArchive,
        firstCampaignArchive: score.firstCampaignArchive,
        latestCampaignArchive: score.latestCampaignArchive,
        latestStatus: score.latestStatus,
        latestLevelId: score.latestLevelId,
        dataOnly: true,
        authorityTransferred: false
      });
    }),
    (left, right) => {
      const stabilityRank = (status) => status
        === HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES.STABLE
        ? 3
        : status
          === HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES.UNSTABLE
          ? 2
          : 1;
      return stabilityRank(right.stabilityStatus) - stabilityRank(left.stabilityStatus)
        || right.passRate - left.passRate
        || right.campaignCount - left.campaignCount
        || right.validationCount - left.validationCount
        || right.latestArchive.sequence - left.latestArchive.sequence
        || stringLocaleCompare(left.candidateId, right.candidateId)
        || stringLocaleCompare(left.architectureFingerprint, right.architectureFingerprint);
    }
  );
  return new HarnessFactoryBenchmarkValidationStabilityReport({
    factory,
    consideredValidationCount: factoryValidations.length,
    returnedValidationCount: returnedValidations.length,
    candidateScores,
    truncated,
    token: FACTORY_TOKEN
  });
}

function sameFactoryBenchmarkIdentity(left, right) {
  return left !== null
    && right !== null
    && left.fingerprint === right.fingerprint
    && left.caseCount === right.caseCount
    && left.budgets.production === right.budgets.production
    && left.budgets.research === right.budgets.research
    && left.budgets.skeptic === right.budgets.skeptic;
}

function factoryFitnessDominates(left, right) {
  const nonRegressing = arrayEvery(
    FACTORY_FITNESS_RATE_KEYS,
    (key) => left[key] >= right[key]
  ) && left.skepticWeaknessesExposed <= right.skepticWeaknessesExposed;
  const strictlyBetter = arraySome(
    FACTORY_FITNESS_RATE_KEYS,
    (key) => left[key] > right[key]
  ) || left.skepticWeaknessesExposed < right.skepticWeaknessesExposed;
  return nonRegressing && strictlyBetter;
}

function factoryHoldoutStatus(metadata) {
  if (metadata.holdout === undefined) {
    return HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN;
  }
  if (metadata.holdout.passed === true) {
    return HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED;
  }
  if (metadata.holdout.passed === false) {
    return HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED;
  }
  throw new Error('Harness Factory frontier contains invalid holdout metadata');
}

function factoryFrontierFromHistory({ factory, history, benchmarkIdentity }) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError('Harness Factory frontier requires an exact trusted factory');
  }
  if (!arrayIsArray(history)) {
    throw new TypeError('Harness Factory frontier requires verified history');
  }
  if (!isPlainObject(benchmarkIdentity)) {
    throw new TypeError('Harness Factory frontier requires a benchmark identity');
  }
  const comparableHistory = arrayFilter(
    history,
    ({ discovery }) => sameFactoryBenchmarkIdentity(
      discovery.factory?.benchmark ?? null,
      benchmarkIdentity
    )
  );
  const statusCounts = {
    [HARNESS_FACTORY_STATUSES.ADOPTED]: 0,
    [HARNESS_FACTORY_STATUSES.REJECTED]: 0
  };
  const holdoutStatusCounts = {
    [HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED]: 0,
    [HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN]: 0,
    [HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED]: 0
  };
  let recoveryCount = 0;
  let previousHoldoutStatus = null;
  const summaries = arrayMap(comparableHistory, ({ discovery, record }) => {
    const metadata = discovery.factory;
    const holdoutStatus = factoryHoldoutStatus(metadata);
    statusCounts[metadata.status] += 1;
    holdoutStatusCounts[holdoutStatus] += 1;
    if (
      previousHoldoutStatus === HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED
      && holdoutStatus === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
    ) {
      recoveryCount += 1;
    }
    previousHoldoutStatus = holdoutStatus;
    return objectFreeze({
      archive: archiveLocator(record),
      factoryId: metadata.factoryId,
      generation: metadata.generation,
      holdoutStatus,
      status: metadata.status,
      winnerId: discovery.winnerId,
      fitness: factoryFitnessForDiscovery(discovery)
    });
  });
  const frontier = arraySort(
    arrayFilter(
      summaries,
      (candidate, candidateIndex) => arrayEvery(
        summaries,
        (other, otherIndex) => candidateIndex === otherIndex
          || !factoryFitnessDominates(other.fitness, candidate.fitness)
      )
    ),
    (left, right) => left.generation - right.generation
  );
  const truncated = frontier.length > MAX_HARNESS_FACTORY_FRONTIER_ENTRIES;
  const returned = truncated
    ? arraySlice(
      frontier,
      frontier.length - MAX_HARNESS_FACTORY_FRONTIER_ENTRIES
    )
    : frontier;
  return new HarnessFactoryFrontierReport({
    factory,
    benchmarkIdentity,
    consideredGenerationCount: comparableHistory.length,
    frontierGenerationCount: frontier.length,
    frontier: returned,
    holdoutStatusCounts: objectFreeze(holdoutStatusCounts),
    recoveryCount,
    statusCounts: objectFreeze(statusCounts),
    truncated,
    token: FACTORY_TOKEN
  });
}

function factoryFrontierFromLedger(ledger, factory, benchmarkIdentity = null) {
  const history = factoryHistoryFromLedger(ledger, factory.factoryId);
  const normalizedBenchmarkIdentity = benchmarkIdentity
    ?? (history.length === 0
      ? null
      : history[history.length - 1].discovery.factory.benchmark);
  if (normalizedBenchmarkIdentity === null) {
    throw new Error(
      'Harness Factory frontier requires at least one archived factory generation'
    );
  }
  return factoryFrontierFromHistory({
    factory,
    history,
    benchmarkIdentity: normalizedBenchmarkIdentity
  });
}

function factoryFrontierPortfolioFromHistory({ factory, history }) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError('Harness Factory frontier portfolio requires an exact trusted factory');
  }
  if (!arrayIsArray(history)) {
    throw new TypeError('Harness Factory frontier portfolio requires verified history');
  }
  const benchmarkPartitions = [];
  arrayForEach(history, ({ discovery }) => {
    const metadata = discovery.factory ?? null;
    const benchmarkIdentity = metadata?.benchmark ?? null;
    if (
      benchmarkIdentity !== null
      && metadata !== null
    ) {
      const existingPartition = arrayFind(
        benchmarkPartitions,
        ({ identity }) => sameFactoryBenchmarkIdentity(identity, benchmarkIdentity)
      );
      if (existingPartition === undefined) {
        arrayPush(benchmarkPartitions, {
          identity: benchmarkIdentity,
          lastGeneration: metadata.generation
        });
      } else {
        existingPartition.lastGeneration = metadata.generation;
      }
    }
  });
  const orderedPartitions = arraySort(
    benchmarkPartitions,
    (left, right) => left.lastGeneration - right.lastGeneration
  );
  const benchmarkIdentities = arrayMap(
    orderedPartitions,
    ({ identity }) => identity
  );
  const truncated = benchmarkIdentities.length > MAX_HARNESS_FACTORY_FRONTIER_PARTITIONS;
  const returnedIdentities = truncated
    ? arraySlice(
      benchmarkIdentities,
      benchmarkIdentities.length - MAX_HARNESS_FACTORY_FRONTIER_PARTITIONS
    )
    : benchmarkIdentities;
  const frontiers = arrayMap(
    returnedIdentities,
    (benchmarkIdentity) => factoryFrontierFromHistory({
      factory,
      history,
      benchmarkIdentity
    })
  );
  return new HarnessFactoryFrontierPortfolioReport({
    factory,
    consideredBenchmarkCount: benchmarkIdentities.length,
    frontiers,
    truncated,
    token: FACTORY_TOKEN
  });
}

function factoryFrontierPortfolioFromLedger(ledger, factory) {
  const history = factoryHistoryFromLedger(ledger, factory.factoryId);
  return factoryFrontierPortfolioFromHistory({
    factory,
    history
  });
}

function factoryHoldoutMetadata(holdout) {
  if (holdout === null) {
    return null;
  }
  return objectFreeze({
    architectureId: holdout.architectureId,
    attemptedCases: holdout.attemptedCases,
    authorityTransferred: holdout.authorityTransferred,
    caseCount: holdout.caseCount,
    caseIds: objectFreeze(arraySlice(holdout.caseIds)),
    complete: holdout.complete,
    dataOnly: holdout.dataOnly,
    independent: holdout.independent,
    passed: holdout.passed,
    primaryComplete: holdout.primaryComplete,
    proofEligibleCases: holdout.proofEligibleCases,
    proven: holdout.proven,
    provenRate: holdout.provenRate,
    reproducibilityReasons: objectFreeze(arraySlice(holdout.reproducibilityReasons)),
    reproducible: holdout.reproducible,
    reproductionComplete: holdout.reproductionComplete,
    successRate: holdout.successRate,
    successes: holdout.successes
  });
}

function holdoutOverlapsFactoryBenchmark(holdoutCases, benchmarkCaseIds) {
  return arraySome(
    holdoutCases,
    (holdoutCase) => arrayIncludes(benchmarkCaseIds, holdoutCase.id)
  );
}

function factoryGenerationMetadata({
  factory,
  cases,
  holdoutCases,
  discovery,
  improvement,
  holdout
}) {
  const benchmark = factoryBenchmarkIdentity({ cases, discovery, holdoutCases });
  const priorGenerations = factoryHistoryFromLedger(factory.ledger, factory.factoryId);
  const predecessor = priorGenerations.length === 0
    ? null
    : priorGenerations[priorGenerations.length - 1].record;
  const improvementMetadata = improvement === null
    ? null
    : objectFreeze({
      accepted: improvement.accepted,
      baselineSequence: improvement.baseline.archive.sequence,
      benchmarkStable: improvement.benchmarkStable,
      nonRegressing: improvement.nonRegressing,
      strictlyImproved: improvement.strictlyImproved
    });
  const metadata = {
    benchmark,
    dataOnly: true,
    factoryId: factory.factoryId,
    generation: priorGenerations.length + 1,
    improvement: improvementMetadata,
    predecessor: predecessor === null ? null : archiveLocator(predecessor),
    status: discovery.adopted
      && (holdout === null || holdout.passed === true)
      ? HARNESS_FACTORY_STATUSES.ADOPTED
      : HARNESS_FACTORY_STATUSES.REJECTED
  };
  const holdoutMetadata = factoryHoldoutMetadata(holdout);
  if (holdoutMetadata !== null) {
    metadata.holdout = holdoutMetadata;
  }
  return objectFreeze(metadata);
}

function manufactureFactory(factory, options, improvementBaseline = null) {
  requireDataObject(options, 'Harness Factory manufacture options', MANUFACTURE_OPTIONS_KEYS);
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError('Harness Factory requires an exact trusted factory');
  }
  const {
    goal,
    plannerCandidates,
    cases,
    productionBudget,
    researchBudget,
    skepticBudget,
    researchContext = null,
    holdoutCases = null,
    holdoutProductionBudget = null,
    holdoutResearchBudget = null,
    holdoutSkepticBudget = null,
    archive = true,
    agentGoal = null,
    agentContext = null,
    agentReproduction = 'HarnessFactory.manufacture',
    toolRegistry = null
  } = options;
  if (typeof archive !== 'boolean') {
    throw new TypeError('Harness Factory archive must be boolean');
  }
  if (
    researchContext !== null
    && !isTrustedStructuredMemoryContext(researchContext)
  ) {
    throw new TypeError(
      'Harness Factory researchContext requires a trusted structured memory context'
    );
  }
  const normalizedHoldoutCases = holdoutCases === null
    ? null
    : requireTrustedHoldoutCases(holdoutCases);
  const normalizedHoldoutBudgets = normalizedHoldoutCases === null
    ? null
    : holdoutBudgets(
      normalizedHoldoutCases,
      holdoutProductionBudget,
      holdoutResearchBudget,
      holdoutSkepticBudget
    );
  if (
    normalizedHoldoutCases !== null
    && arrayIsArray(cases)
    && arrayEvery(cases, isTrustedAgentPlannerCase)
  ) {
    requireDisjointHoldoutCases(cases, normalizedHoldoutCases);
  }
  const normalizedAgentGoal = agentGoal === null
    ? null
    : requireNonEmptyString(agentGoal, 'Harness Factory agentGoal');
  const normalizedAgentContext = agentContext === null
    ? null
    : snapshotProcessData(agentContext);
  const normalizedAgentReproduction = requireNonEmptyString(
    agentReproduction,
    'Harness Factory agentReproduction'
  );
  if (
    toolRegistry !== null
    && !isTrustedToolRegistry(toolRegistry)
  ) {
    throw new TypeError('Harness Factory toolRegistry requires a trusted ToolRegistry');
  }
  const discovery = factory.discoveryRunner.discover({
    goal,
    plannerCandidates,
    cases,
    productionBudget,
    researchBudget,
    skepticBudget,
    researchContext
  });
  if (!isTrustedAgentArchitectureDiscoveryReport(discovery)) {
    throw new TypeError('Harness Factory discovery returned untrusted evidence');
  }
  const currentBenchmarkIdentity = factoryBenchmarkIdentity({
    cases,
    discovery,
    holdoutCases: normalizedHoldoutCases
  });
  const improvement = improvementBaseline === null
    ? null
    : compareFactoryFitness({
      baselineRecord: improvementBaseline.record,
      baselineDiscovery: improvementBaseline.discovery,
      currentDiscovery: discovery,
      currentBenchmarkIdentity
    });
  if (
    improvement !== null
    && discovery.adopted === true
    && improvement.accepted !== true
  ) {
    factory.dispose({
      candidates: discovery.candidates,
      reason: 'evaluated candidates retired after improvement guard rejection'
    });
    throw new Error(
      `Harness Factory improvement rejected: ${arrayJoin(improvement.reasons, '; ')}`
    );
  }
  const holdout = discovery.adopted === true && normalizedHoldoutCases !== null
    ? evaluateFactoryHoldout(
      discovery.adoption.adoption.candidate,
      normalizedHoldoutCases,
      normalizedHoldoutBudgets
    )
    : null;
  if (holdout !== null && holdout.passed !== true) {
    factory.dispose({
      candidates: discovery.candidates,
      reason: 'evaluated candidates retired after holdout rejection'
    });
    if (archive) {
      factory.ledger.appendArchitectureDiscovery(
        discovery,
        factoryGenerationMetadata({
          cases,
          holdoutCases: normalizedHoldoutCases,
          discovery,
          factory,
          improvement,
          holdout
        })
      );
    }
    throw new Error(
      'Harness Factory holdout benchmark rejected the adopted candidate'
    );
  }
  if (reflectOwnKeys(factory.ledger).length !== 0) {
    throw new TypeError('Harness Factory requires an unmodified evidence ledger instance');
  }
  const factoryMetadata = factoryGenerationMetadata({
    cases,
    holdoutCases: normalizedHoldoutCases,
    discovery,
    factory,
    improvement,
    holdout
  });
  const archiveRecord = archive
    ? factory.ledger.appendArchitectureDiscovery(discovery, factoryMetadata)
    : null;
  if (discovery.adopted === true) {
    weakSetAdd(PROTECTED_ADOPTED_CANDIDATES, discovery.adoptedCandidate);
  }
  let agentRun = null;
  let agentArchiveRecord = null;
  if (discovery.adopted === true && normalizedAgentGoal !== null) {
    const agent = agentFromAdoptedArchitecture(
      discovery.adoption.adoption,
      { toolRegistry }
    );
    if (!isTrustedAgentArchitectureAgent(agent)) {
      throw new TypeError('Harness Factory constructed an untrusted agent');
    }
    const runReport = agent.run({
      goal: normalizedAgentGoal,
      context: normalizedAgentContext,
      reproduction: normalizedAgentReproduction
    });
    agentRun = summarizeAgentRun(runReport);
    if (archive) {
      agentArchiveRecord = factory.ledger.appendAgentRun(
        runReport,
        discovery.adoptedCandidate.id
      );
    }
  }
  const retirement = factory.dispose({
    candidates: discovery.candidates,
    reason: discovery.adopted === true
      ? 'evaluated candidates retired after fresh adoption'
      : 'evaluated candidates retired after adoption rejection'
  });
  return new HarnessFactoryReport({
    factory,
    discovery,
    archive: archiveRecord === null ? null : archiveLocator(archiveRecord),
    agentRun,
    agentArchive: agentArchiveRecord === null ? null : archiveLocator(agentArchiveRecord),
    agentRequested: normalizedAgentGoal !== null,
    factoryMetadata,
    improvement,
    holdout,
    holdoutRequested: normalizedHoldoutCases !== null,
    frontier: factoryFrontierFromLedger(
      factory.ledger,
      factory,
      factoryMetadata.benchmark
    ),
    retirement,
    token: FACTORY_TOKEN
  });
}

export class HarnessFactoryDisposalReport {
  constructor({ factory, candidateIds, reason, token }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !arrayIsArray(candidateIds)
      || candidateIds.length === 0
      || arraySome(candidateIds, (candidateId) => typeof candidateId !== 'string')
    ) {
      throw new TypeError('Harness Factory disposal requires trusted lifecycle evidence');
    }
    this.factoryId = factory.factoryId;
    this.candidateIds = objectFreeze(arraySlice(candidateIds));
    this.count = candidateIds.length;
    this.reason = requireNonEmptyString(reason, 'Harness Factory disposal reason');
    this.status = 'DISPOSED';
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_DISPOSALS, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryDisposalReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_DISPOSALS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryDisposalReport.prototype;
}

export class HarnessFactoryFrontierReport {
  constructor({
    factory,
    benchmarkIdentity,
    consideredGenerationCount,
    frontierGenerationCount,
    frontier,
    holdoutStatusCounts,
    recoveryCount,
    statusCounts,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isPlainObject(benchmarkIdentity)
      || !isSafeInteger(consideredGenerationCount)
      || consideredGenerationCount < 0
      || !isSafeInteger(frontierGenerationCount)
      || frontierGenerationCount < 0
      || !arrayIsArray(frontier)
      || !arrayEvery(frontier, (entry) => isPlainObject(entry))
      || !isPlainObject(holdoutStatusCounts)
      || !isSafeInteger(recoveryCount)
      || recoveryCount < 0
      || !isPlainObject(statusCounts)
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError('Harness Factory frontier requires trusted lifecycle evidence');
    }
    if (
      frontier.length > MAX_HARNESS_FACTORY_FRONTIER_ENTRIES
      || frontierGenerationCount < frontier.length
      || consideredGenerationCount < frontierGenerationCount
      || truncated !== (frontierGenerationCount > MAX_HARNESS_FACTORY_FRONTIER_ENTRIES)
    ) {
      throw new TypeError('Harness Factory frontier bounds are inconsistent');
    }
    const statusCountValues = [
      statusCounts[HARNESS_FACTORY_STATUSES.ADOPTED],
      statusCounts[HARNESS_FACTORY_STATUSES.REJECTED]
    ];
    const holdoutStatusCountValues = [
      holdoutStatusCounts[HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED],
      holdoutStatusCounts[HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN],
      holdoutStatusCounts[HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED]
    ];
    if (
      arraySome(
        [...statusCountValues, ...holdoutStatusCountValues],
        (count) => !isSafeInteger(count) || count < 0
      )
      || statusCountValues[0] + statusCountValues[1] !== consideredGenerationCount
      || holdoutStatusCountValues[0]
        + holdoutStatusCountValues[1]
        + holdoutStatusCountValues[2] !== consideredGenerationCount
      || recoveryCount > consideredGenerationCount
    ) {
      throw new TypeError('Harness Factory frontier evidence counts are inconsistent');
    }
    this.factoryId = factory.factoryId;
    this.benchmarkIdentity = benchmarkIdentity;
    this.consideredGenerationCount = consideredGenerationCount;
    this.frontierGenerationCount = frontierGenerationCount;
    this.returnedGenerationCount = frontier.length;
    this.maxEntries = MAX_HARNESS_FACTORY_FRONTIER_ENTRIES;
    this.holdoutStatusCounts = objectFreeze({ ...holdoutStatusCounts });
    this.recoveryCount = recoveryCount;
    this.statusCounts = objectFreeze({ ...statusCounts });
    this.truncated = truncated;
    this.frontier = objectFreeze(arraySlice(frontier));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_FRONTIERS, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryFrontierReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_FRONTIERS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryFrontierReport.prototype;
}

export class HarnessFactoryFrontierPortfolioReport {
  constructor({
    factory,
    consideredBenchmarkCount,
    frontiers,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredBenchmarkCount)
      || consideredBenchmarkCount < 0
      || !arrayIsArray(frontiers)
      || !arrayEvery(frontiers, (frontier) => isTrustedHarnessFactoryFrontierReport(frontier))
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError(
        'Harness Factory frontier portfolio requires trusted lifecycle evidence'
      );
    }
    if (
      frontiers.length > MAX_HARNESS_FACTORY_FRONTIER_PARTITIONS
      || consideredBenchmarkCount < frontiers.length
      || truncated !== (
        consideredBenchmarkCount > MAX_HARNESS_FACTORY_FRONTIER_PARTITIONS
      )
    ) {
      throw new TypeError('Harness Factory frontier portfolio bounds are inconsistent');
    }
    if (arraySome(frontiers, (frontier) => frontier.factoryId !== factory.factoryId)) {
      throw new TypeError('Harness Factory frontier portfolio contains another factory');
    }
    this.factoryId = factory.factoryId;
    this.consideredBenchmarkCount = consideredBenchmarkCount;
    this.returnedBenchmarkCount = frontiers.length;
    this.maxPartitions = MAX_HARNESS_FACTORY_FRONTIER_PARTITIONS;
    this.truncated = truncated;
    this.frontiers = objectFreeze(arraySlice(frontiers));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_FRONTIER_PORTFOLIOS, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryFrontierPortfolioReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_FRONTIER_PORTFOLIOS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryFrontierPortfolioReport.prototype;
}

export class HarnessFactoryHistoryReport {
  constructor({
    factory,
    consideredGenerationCount,
    generations,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredGenerationCount)
      || consideredGenerationCount < 0
      || !arrayIsArray(generations)
      || !arrayEvery(generations, (generation) => isPlainObject(generation))
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError('Harness Factory history requires trusted lifecycle evidence');
    }
    if (
      generations.length > MAX_HARNESS_FACTORY_HISTORY_ENTRIES
      || consideredGenerationCount < generations.length
      || truncated !== (
        consideredGenerationCount > MAX_HARNESS_FACTORY_HISTORY_ENTRIES
      )
      || arraySome(generations, (generation) => generation.factoryId !== factory.factoryId)
    ) {
      throw new TypeError('Harness Factory history bounds are inconsistent');
    }
    this.factoryId = factory.factoryId;
    this.consideredGenerationCount = consideredGenerationCount;
    this.returnedGenerationCount = generations.length;
    this.maxEntries = MAX_HARNESS_FACTORY_HISTORY_ENTRIES;
    this.truncated = truncated;
    this.generations = objectFreeze(arraySlice(generations));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_HISTORIES, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryHistoryReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_HISTORIES, report)
    && objectGetPrototypeOf(report) === HarnessFactoryHistoryReport.prototype;
}

export class HarnessFactoryRecommendationReport {
  constructor({
    factory,
    consideredGenerationCount,
    recommendation,
    reason,
    status,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredGenerationCount)
      || consideredGenerationCount < 0
      || typeof reason !== 'string'
    ) {
      throw new TypeError('Harness Factory recommendation requires trusted lifecycle evidence');
    }
    if (
      status !== HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION
      && status !== HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY
      && status !== HARNESS_FACTORY_RECOMMENDATION_STATUSES.RECOVER_FAILED_HOLDOUT
      && status !== HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
    ) {
      throw new TypeError('Harness Factory recommendation status is invalid');
    }
    const normalizedReason = requireNonEmptyString(
      reason,
      'Harness Factory recommendation reason'
    );
    if (status === HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY) {
      if (consideredGenerationCount !== 0 || recommendation !== null) {
        throw new TypeError('Harness Factory empty recommendation is inconsistent');
      }
    } else if (
      consideredGenerationCount === 0
      || !isPlainObject(recommendation)
      || recommendation.factoryId !== factory.factoryId
      || !isSafeInteger(recommendation.generation)
      || recommendation.generation <= 0
    ) {
      throw new TypeError('Harness Factory recommendation baseline is inconsistent');
    }
    this.factoryId = factory.factoryId;
    this.consideredGenerationCount = consideredGenerationCount;
    this.status = status;
    this.baseline = recommendation;
    this.baselineGeneration = recommendation?.generation ?? null;
    this.reason = normalizedReason;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_RECOMMENDATIONS, this);
    weakMapSet(TRUSTED_HARNESS_FACTORY_RECOMMENDATION_FACTORIES, this, factory);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryRecommendationReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_RECOMMENDATIONS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryRecommendationReport.prototype;
}

export class HarnessFactoryResearchAgendaReport {
  constructor({
    factory,
    consideredGenerationCount,
    consideredValidationCount,
    consideredTargetCount,
    requestedItemCount,
    recommendationStatus,
    items,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredGenerationCount)
      || consideredGenerationCount < 0
      || !isSafeInteger(consideredValidationCount)
      || consideredValidationCount < 0
      || !isSafeInteger(consideredTargetCount)
      || consideredTargetCount < 0
      || !isSafeInteger(requestedItemCount)
      || requestedItemCount <= 0
      || !arrayIncludes(
        [
          HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION,
          HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY,
          HARNESS_FACTORY_RECOMMENDATION_STATUSES.RECOVER_FAILED_HOLDOUT,
          HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
        ],
        recommendationStatus
      )
      || !arrayIsArray(items)
      || !arrayEvery(items, (item) => isPlainObject(item))
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError('Harness Factory research agenda requires trusted evidence');
    }
    if (
      items.length > MAX_HARNESS_FACTORY_RESEARCH_AGENDA_ITEMS
      || items.length > requestedItemCount
      || consideredTargetCount < items.length
      || consideredGenerationCount === 0
        && arraySome(items, (item) => item.generation !== null)
      || arraySome(
        items,
        (item) => item.generation > consideredGenerationCount
      )
      || truncated !== (consideredTargetCount > requestedItemCount)
    ) {
      throw new TypeError('Harness Factory research agenda bounds are inconsistent');
    }
    if (
      recommendationStatus === HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY
      && (
        consideredGenerationCount !== 0
        || arraySome(items, (item) => item.generation !== null)
      )
    ) {
      throw new TypeError('Harness Factory empty research agenda is inconsistent');
    }
    if (arraySome(items, (item) => item.factoryId !== factory.factoryId)) {
      throw new TypeError('Harness Factory research agenda contains another factory');
    }
    if (
      setSize(setFromArray(arrayMap(items, ({ id }) => id))) !== items.length
      || arraySome(
        items,
        (item, index) => item.rank !== index + 1
          || !arrayIncludes(
            HARNESS_FACTORY_RESEARCH_TARGET_VALUES,
            item.target
          )
          || !isSafeInteger(item.priority)
          || item.priority <= 0
          || (
            item.target === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION
              ? !isValidHarnessFactoryBenchmarkValidationResearchAgendaItem(item, factory)
              : !isSafeInteger(item.generation)
                || item.generation <= 0
                || !isPlainObject(item.archive)
                || item.archive.kind !== 'architecture-discovery'
                || !isSafeInteger(item.archive.sequence)
                || item.archive.sequence <= 0
          )
          || item.dataOnly !== true
          || item.authorityTransferred !== false
      )
    ) {
      throw new TypeError('Harness Factory research agenda item is invalid');
    }
    this.factoryId = factory.factoryId;
    this.consideredGenerationCount = consideredGenerationCount;
    this.consideredValidationCount = consideredValidationCount;
    this.consideredTargetCount = consideredTargetCount;
    this.requestedItemCount = requestedItemCount;
    this.returnedItemCount = items.length;
    this.maxItems = MAX_HARNESS_FACTORY_RESEARCH_AGENDA_ITEMS;
    this.recommendationStatus = recommendationStatus;
    this.primaryTargetId = items[0]?.id ?? null;
    this.truncated = truncated;
    this.complete = truncated === false;
    this.items = objectFreeze(arraySlice(items));
    this.dataOnly = true;
    this.authorityTransferred = false;
    arrayForEach(this.items, (item) => {
      weakMapSet(
        TRUSTED_HARNESS_FACTORY_RESEARCH_AGENDA_ITEM_FACTORIES,
        item,
        factory
      );
    });
    weakSetAdd(TRUSTED_HARNESS_FACTORY_RESEARCH_AGENDAS, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryResearchAgendaReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_RESEARCH_AGENDAS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryResearchAgendaReport.prototype;
}

function isTrustedHarnessFactoryResearchAgendaItem(item, factory) {
  return isPlainObject(item)
    && weakMapGet(
      TRUSTED_HARNESS_FACTORY_RESEARCH_AGENDA_ITEM_FACTORIES,
      item
    ) === factory;
}

export class HarnessFactoryBenchmarkReport {
  constructor({
    factory,
    candidateId,
    caseIds,
    architectureFingerprint,
    points,
    frontier,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || typeof candidateId !== 'string'
      || !arrayIsArray(caseIds)
      || !arrayEvery(caseIds, (caseId) => typeof caseId === 'string')
      || !arrayIsArray(points)
      || !arrayIsArray(frontier)
      || points.length === 0
      || points.length > MAX_HARNESS_FACTORY_BENCHMARK_LEVELS
      || frontier.length === 0
      || frontier.length > points.length
      || !arrayEvery(points, (point) => isPlainObject(point))
      || !arrayEvery(frontier, (point) => arrayIncludes(points, point))
      || architectureFingerprint !== null
        && typeof architectureFingerprint !== 'string'
    ) {
      throw new TypeError('Harness Factory benchmark requires trusted evidence');
    }
    const normalizedCandidateId = requireNonEmptyString(
      candidateId,
      'Harness Factory benchmark candidateId'
    );
    const normalizedCaseIds = arrayMap(
      caseIds,
      (caseId, index) => requireNonEmptyString(
        caseId,
        `Harness Factory benchmark caseIds[${index}]`
      )
    );
    if (
      setSize(setFromArray(normalizedCaseIds)) !== normalizedCaseIds.length
      || arraySome(
        points,
        (point) => (
          point.architectureId !== normalizedCandidateId
          || point.levelId === undefined
          || !isSafeInteger(point.computeUnits)
          || point.computeUnits <= 0
          || !isPlainObject(point.budgets)
          || arraySome(
            [
              point.budgets.production,
              point.budgets.research,
              point.budgets.skeptic
            ],
            (budget) => !isSafeInteger(budget) || budget <= 0
          )
          || point.architectureFingerprint !== architectureFingerprint
          || !isFiniteNumber(point.productionSuccessRate)
          || !isFiniteNumber(point.productionProvenRate)
          || !isFiniteNumber(point.researchSuccessRate)
          || !isFiniteNumber(point.researchProvenRate)
          || !isFiniteNumber(point.skepticSuccessRate)
          || !isFiniteNumber(point.transferSuccessRate)
          || arraySome(
            [
              point.productionSuccessRate,
              point.productionProvenRate,
              point.researchSuccessRate,
              point.researchProvenRate,
              point.skepticSuccessRate,
              point.transferSuccessRate
            ],
            (rate) => rate < 0 || rate > 1
          )
          || !isSafeInteger(point.skepticWeaknessesExposed)
          || point.skepticWeaknessesExposed < 0
          || !isFiniteNumber(point.elapsedMs)
          || point.elapsedMs < 0
          || typeof point.complete !== 'boolean'
          || typeof point.reproducible !== 'boolean'
          || typeof point.independent !== 'boolean'
          || point.dataOnly !== true
          || point.authorityTransferred !== false
          || typeof point.levelId !== 'string'
          || stringTrim(point.levelId) === ''
        )
      )
    ) {
      throw new TypeError('Harness Factory benchmark point is invalid');
    }
    const computeUnits = arrayMap(points, ({ computeUnits: units }) => units);
    const levelIds = arrayMap(points, ({ levelId }) => levelId);
    if (
      setSize(setFromArray(computeUnits)) !== computeUnits.length
      || setSize(setFromArray(levelIds)) !== levelIds.length
    ) {
      throw new TypeError('Harness Factory benchmark points must be unique');
    }
    this.factoryId = factory.factoryId;
    this.candidateId = normalizedCandidateId;
    this.caseIds = objectFreeze(arraySlice(normalizedCaseIds));
    this.caseCount = normalizedCaseIds.length;
    this.architectureFingerprint = architectureFingerprint;
    this.points = objectFreeze(arraySlice(points));
    this.frontier = objectFreeze(arraySlice(frontier));
    this.complete = arrayEvery(points, (point) => point.complete);
    this.reproducible = arrayEvery(points, (point) => point.reproducible);
    this.independent = arrayEvery(points, (point) => point.independent);
    this.deployed = false;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARKS, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_BENCHMARKS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryBenchmarkReport.prototype;
}

function isValidFactoryBenchmarkPoint(point, candidateIds) {
  return isPlainObject(point)
    && arrayIncludes(candidateIds, point.architectureId)
    && typeof point.architectureId === 'string'
    && stringTrim(point.architectureId) !== ''
    && typeof point.levelId === 'string'
    && stringTrim(point.levelId) !== ''
    && isSafeInteger(point.computeUnits)
    && point.computeUnits > 0
    && isPlainObject(point.budgets)
    && isSafeInteger(point.budgets.production)
    && point.budgets.production > 0
    && isSafeInteger(point.budgets.research)
    && point.budgets.research > 0
    && isSafeInteger(point.budgets.skeptic)
    && point.budgets.skeptic > 0
    && (point.architectureFingerprint === null
      || typeof point.architectureFingerprint === 'string')
    && arrayEvery(
      [
        point.productionSuccessRate,
        point.productionProvenRate,
        point.researchSuccessRate,
        point.researchProvenRate,
        point.skepticSuccessRate,
        point.transferSuccessRate
      ],
      (rate) => isFiniteNumber(rate) && rate >= 0 && rate <= 1
    )
    && isSafeInteger(point.skepticWeaknessesExposed)
    && point.skepticWeaknessesExposed >= 0
    && isFiniteNumber(point.elapsedMs)
    && point.elapsedMs >= 0
    && (point.error === null || typeof point.error === 'string')
    && typeof point.complete === 'boolean'
    && typeof point.reproducible === 'boolean'
    && typeof point.independent === 'boolean'
    && point.dataOnly === true
    && point.authorityTransferred === false;
}

export class HarnessFactoryBenchmarkCampaignReport {
  constructor({
    factory,
    candidateIds,
    caseIds,
    caseFingerprint,
    points,
    frontier,
    archive = null,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !arrayIsArray(candidateIds)
      || candidateIds.length < 2
      || candidateIds.length > MAX_HARNESS_FACTORY_BENCHMARK_CANDIDATES
      || !arrayIsArray(caseIds)
      || caseIds.length === 0
      || typeof caseFingerprint !== 'string'
      || stringTrim(caseFingerprint) === ''
      || !arrayIsArray(points)
      || points.length === 0
      || points.length > MAX_HARNESS_FACTORY_BENCHMARK_CANDIDATES
        * MAX_HARNESS_FACTORY_BENCHMARK_LEVELS
      || !arrayIsArray(frontier)
      || frontier.length === 0
      || frontier.length > points.length
      || !arrayEvery(candidateIds, (candidateId) => typeof candidateId === 'string')
      || !arrayEvery(caseIds, (caseId) => typeof caseId === 'string')
      || !arrayEvery(points, (point) => isValidFactoryBenchmarkPoint(point, candidateIds))
      || !arrayEvery(frontier, (point) => arrayIncludes(points, point))
      || archive !== null
        && (
          !isPlainObject(archive)
          || archive.kind !== 'harness-factory-benchmark-campaign'
          || !isSafeInteger(archive.sequence)
          || archive.sequence <= 0
          || typeof archive.hash !== 'string'
        )
    ) {
      throw new TypeError('Harness Factory benchmark campaign requires trusted evidence');
    }
    const normalizedCandidateIds = arrayMap(
      candidateIds,
      (candidateId, index) => requireNonEmptyString(
        candidateId,
        `Harness Factory benchmark campaign candidateIds[${index}]`
      )
    );
    const normalizedCaseIds = arrayMap(
      caseIds,
      (caseId, index) => requireNonEmptyString(
        caseId,
        `Harness Factory benchmark campaign caseIds[${index}]`
      )
    );
    if (
      setSize(setFromArray(normalizedCandidateIds)) !== normalizedCandidateIds.length
      || setSize(setFromArray(normalizedCaseIds)) !== normalizedCaseIds.length
    ) {
      throw new TypeError('Harness Factory benchmark campaign ids must be unique');
    }
    const fingerprintByCandidate = [];
    const pointKeys = [];
    arrayForEach(points, (point) => {
      const key = `${point.architectureId}\u0000${point.levelId}`;
      if (arrayIncludes(pointKeys, key)) {
        throw new TypeError(
          'Harness Factory benchmark campaign points must be unique per candidate and level'
        );
      }
      arrayPush(pointKeys, key);
      const knownFingerprint = arrayFind(
        fingerprintByCandidate,
        ({ candidateId }) => candidateId === point.architectureId
      );
      if (knownFingerprint === undefined) {
        arrayPush(fingerprintByCandidate, {
          candidateId: point.architectureId,
          architectureFingerprint: point.architectureFingerprint
        });
      } else if (
        knownFingerprint.architectureFingerprint !== point.architectureFingerprint
      ) {
        throw new TypeError(
          'Harness Factory benchmark campaign architecture definitions must be stable'
        );
      }
    });
    arrayForEach(normalizedCandidateIds, (candidateId) => {
      const candidatePoints = arrayFilter(
        points,
        (point) => point.architectureId === candidateId
      );
      if (
        candidatePoints.length === 0
        || candidatePoints.length > MAX_HARNESS_FACTORY_BENCHMARK_LEVELS
        || setSize(setFromArray(arrayMap(candidatePoints, ({ levelId }) => levelId)))
          !== candidatePoints.length
        || setSize(setFromArray(arrayMap(candidatePoints, ({ computeUnits }) => computeUnits)))
          !== candidatePoints.length
      ) {
        throw new TypeError(
          'Harness Factory benchmark campaign must contain unique bounded levels for every candidate'
        );
      }
    });
    this.factoryId = factory.factoryId;
    this.candidateIds = objectFreeze(arraySlice(normalizedCandidateIds));
    this.candidateCount = normalizedCandidateIds.length;
    this.caseIds = objectFreeze(arraySlice(normalizedCaseIds));
    this.caseCount = normalizedCaseIds.length;
    this.caseFingerprint = requireNonEmptyString(
      caseFingerprint,
      'Harness Factory benchmark campaign caseFingerprint'
    );
    this.points = objectFreeze(arraySlice(points));
    this.frontier = objectFreeze(arraySlice(frontier));
    this.archive = archive === null ? null : archiveLocator(archive);
    this.archived = this.archive !== null;
    this.complete = arrayEvery(points, (point) => point.complete);
    this.reproducible = arrayEvery(points, (point) => point.reproducible);
    this.independent = arrayEvery(points, (point) => point.independent);
    this.deployed = false;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGNS, this);
    weakMapSet(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FACTORIES, this, factory);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkCampaignReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGNS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryBenchmarkCampaignReport.prototype;
}

export class HarnessFactoryBenchmarkCampaignHistoryReport {
  constructor({
    factory,
    consideredCampaignCount,
    campaigns,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredCampaignCount)
      || consideredCampaignCount < 0
      || !arrayIsArray(campaigns)
      || !arrayEvery(
        campaigns,
        (campaign) => isValidHarnessFactoryBenchmarkCampaignHistorySummary(campaign)
      )
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError(
        'Harness Factory benchmark campaign history requires trusted evidence'
      );
    }
    if (
      campaigns.length > MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES
      || consideredCampaignCount < campaigns.length
      || truncated !== (
        consideredCampaignCount
          > MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES
      )
      || arraySome(
        campaigns,
        (campaign) => campaign.factoryId !== factory.factoryId
      )
    ) {
      throw new TypeError(
        'Harness Factory benchmark campaign history bounds are inconsistent'
      );
    }
    const archiveSequences = arrayMap(
      campaigns,
      (campaign) => campaign.archive.sequence
    );
    if (arraySome(
      archiveSequences,
      (sequence, index) => index > 0 && sequence <= archiveSequences[index - 1]
    )) {
      throw new TypeError(
        'Harness Factory benchmark campaign history must preserve archive order'
      );
    }
    this.factoryId = factory.factoryId;
    this.consideredCampaignCount = consideredCampaignCount;
    this.returnedCampaignCount = campaigns.length;
    this.maxEntries = MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES;
    this.truncated = truncated;
    this.campaigns = objectFreeze(arraySlice(campaigns));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORIES, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkCampaignHistoryReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORIES, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryBenchmarkCampaignHistoryReport.prototype;
}

export class HarnessFactoryBenchmarkCampaignValidationHistoryReport {
  constructor({
    factory,
    consideredValidationCount,
    validations,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredValidationCount)
      || consideredValidationCount < 0
      || !arrayIsArray(validations)
      || !arrayEvery(
        validations,
        (validation) => isValidHarnessFactoryBenchmarkCampaignValidationHistorySummary(
          validation
        )
      )
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError(
        'Harness Factory benchmark validation history requires trusted evidence'
      );
    }
    if (
      validations.length > MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES
      || consideredValidationCount < validations.length
      || truncated !== (
        consideredValidationCount
          > MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES
      )
      || arraySome(
        validations,
        (validation) => validation.factoryId !== factory.factoryId
      )
    ) {
      throw new TypeError(
        'Harness Factory benchmark validation history bounds are inconsistent'
      );
    }
    const archiveSequences = arrayMap(
      validations,
      (validation) => validation.archive.sequence
    );
    if (arraySome(
      archiveSequences,
      (sequence, index) => index > 0 && sequence <= archiveSequences[index - 1]
    )) {
      throw new TypeError(
        'Harness Factory benchmark validation history must preserve archive order'
      );
    }
    this.factoryId = factory.factoryId;
    this.consideredValidationCount = consideredValidationCount;
    this.returnedValidationCount = validations.length;
    this.maxEntries = MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES;
    this.truncated = truncated;
    this.validations = objectFreeze(arraySlice(validations));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_HISTORIES, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkCampaignValidationHistoryReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_HISTORIES,
      report
    )
    && objectGetPrototypeOf(report)
      === HarnessFactoryBenchmarkCampaignValidationHistoryReport.prototype;
}

export class HarnessFactoryBenchmarkValidationScorecardReport {
  constructor({
    factory,
    consideredValidationCount,
    returnedValidationCount,
    candidateScores,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredValidationCount)
      || consideredValidationCount < 0
      || !isSafeInteger(returnedValidationCount)
      || returnedValidationCount < 0
      || returnedValidationCount > consideredValidationCount
      || !arrayIsArray(candidateScores)
      || candidateScores.length > MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES
      || !arrayEvery(candidateScores, (score) => (
        isPlainObject(score)
        && typeof score.candidateId === 'string'
        && stringTrim(score.candidateId) !== ''
        && isSafeInteger(score.validationCount)
        && score.validationCount > 0
        && isSafeInteger(score.passedCount)
        && score.passedCount >= 0
        && isSafeInteger(score.failedCount)
        && score.failedCount >= 0
        && score.passedCount + score.failedCount === score.validationCount
        && isFiniteNumber(score.passRate)
        && score.passRate >= 0
        && score.passRate <= 1
        && score.passRate === score.passedCount / score.validationCount
        && isSafeInteger(score.completeCount)
        && score.completeCount >= 0
        && score.completeCount <= score.validationCount
        && isSafeInteger(score.reproducibleCount)
        && score.reproducibleCount >= 0
        && score.reproducibleCount <= score.validationCount
        && isSafeInteger(score.independentCount)
        && score.independentCount >= 0
        && score.independentCount <= score.validationCount
        && (
          score.latestStatus === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
          || score.latestStatus === HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED
        )
        && typeof score.latestLevelId === 'string'
        && stringTrim(score.latestLevelId) !== ''
        && isPlainObject(score.latestArchive)
        && score.latestArchive.kind === 'harness-factory-benchmark-validation'
        && isSafeInteger(score.latestArchive.sequence)
        && score.latestArchive.sequence > 0
        && typeof score.latestArchive.hash === 'string'
        && stringTrim(score.latestArchive.hash) !== ''
        && isPlainObject(score.latestCampaignArchive)
        && score.latestCampaignArchive.kind === 'harness-factory-benchmark-campaign'
        && isSafeInteger(score.latestCampaignArchive.sequence)
        && score.latestCampaignArchive.sequence > 0
        && score.latestCampaignArchive.sequence < score.latestArchive.sequence
        && typeof score.latestCampaignArchive.hash === 'string'
        && stringTrim(score.latestCampaignArchive.hash) !== ''
        && score.dataOnly === true
        && score.authorityTransferred === false
        && !arraySome(
          ['candidate', 'candidates', 'runner', 'actionReport', 'holdout'],
          (key) => arrayIncludes(reflectOwnKeys(score), key)
        )
      ))
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError(
        'Harness Factory benchmark validation scorecard requires trusted evidence'
      );
    }
    const candidateIds = arrayMap(candidateScores, ({ candidateId }) => candidateId);
    const countedValidations = candidateScores.reduce(
      (total, score) => total + score.validationCount,
      0
    );
    if (
      setSize(setFromArray(candidateIds)) !== candidateIds.length
      || countedValidations !== returnedValidationCount
      || truncated !== (
        consideredValidationCount
          > MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES
      )
      || returnedValidationCount !== 0 && candidateScores.length === 0
    ) {
      throw new TypeError(
        'Harness Factory benchmark validation scorecard bounds are inconsistent'
      );
    }
    this.factoryId = factory.factoryId;
    this.consideredValidationCount = consideredValidationCount;
    this.returnedValidationCount = returnedValidationCount;
    this.candidateCount = candidateScores.length;
    this.maxEntries = MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES;
    this.truncated = truncated;
    this.candidateScores = objectFreeze(arraySlice(candidateScores));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARK_VALIDATION_SCORECARDS, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkValidationScorecardReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_BENCHMARK_VALIDATION_SCORECARDS, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryBenchmarkValidationScorecardReport.prototype;
}

export class HarnessFactoryBenchmarkValidationStabilityReport {
  constructor({
    factory,
    consideredValidationCount,
    returnedValidationCount,
    candidateScores,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredValidationCount)
      || consideredValidationCount < 0
      || !isSafeInteger(returnedValidationCount)
      || returnedValidationCount < 0
      || returnedValidationCount > consideredValidationCount
      || !arrayIsArray(candidateScores)
      || candidateScores.length > MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES
      || !arrayEvery(candidateScores, (score) => {
        const expectedStable = score?.campaignCount >= 2
          && score?.passedCount === score?.validationCount
          && score?.completeCount === score?.validationCount
          && score?.reproducibleCount === score?.validationCount
          && score?.independentCount === score?.validationCount;
        const expectedStatus = score?.campaignCount < 2
          ? HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
          : expectedStable
            ? HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES.STABLE
            : HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES.UNSTABLE;
        return isPlainObject(score)
          && typeof score.candidateId === 'string'
          && stringTrim(score.candidateId) !== ''
          && typeof score.architectureFingerprint === 'string'
          && stringTrim(score.architectureFingerprint) !== ''
          && isSafeInteger(score.validationCount)
          && score.validationCount > 0
          && isSafeInteger(score.campaignCount)
          && score.campaignCount > 0
          && score.campaignCount <= score.validationCount
          && isSafeInteger(score.passedCount)
          && score.passedCount >= 0
          && isSafeInteger(score.failedCount)
          && score.failedCount >= 0
          && score.passedCount + score.failedCount === score.validationCount
          && isFiniteNumber(score.passRate)
          && score.passRate >= 0
          && score.passRate <= 1
          && score.passRate === score.passedCount / score.validationCount
          && isSafeInteger(score.completeCount)
          && score.completeCount >= 0
          && score.completeCount <= score.validationCount
          && isSafeInteger(score.reproducibleCount)
          && score.reproducibleCount >= 0
          && score.reproducibleCount <= score.validationCount
          && isSafeInteger(score.independentCount)
          && score.independentCount >= 0
          && score.independentCount <= score.validationCount
          && score.stable === expectedStable
          && score.stabilityStatus === expectedStatus
          && isPlainObject(score.firstArchive)
          && score.firstArchive.kind === 'harness-factory-benchmark-validation'
          && isSafeInteger(score.firstArchive.sequence)
          && score.firstArchive.sequence > 0
          && typeof score.firstArchive.hash === 'string'
          && stringTrim(score.firstArchive.hash) !== ''
          && isPlainObject(score.latestArchive)
          && score.latestArchive.kind === 'harness-factory-benchmark-validation'
          && isSafeInteger(score.latestArchive.sequence)
          && score.latestArchive.sequence >= score.firstArchive.sequence
          && typeof score.latestArchive.hash === 'string'
          && stringTrim(score.latestArchive.hash) !== ''
          && isPlainObject(score.firstCampaignArchive)
          && score.firstCampaignArchive.kind === 'harness-factory-benchmark-campaign'
          && isSafeInteger(score.firstCampaignArchive.sequence)
          && score.firstCampaignArchive.sequence < score.firstArchive.sequence
          && typeof score.firstCampaignArchive.hash === 'string'
          && stringTrim(score.firstCampaignArchive.hash) !== ''
          && isPlainObject(score.latestCampaignArchive)
          && score.latestCampaignArchive.kind === 'harness-factory-benchmark-campaign'
          && isSafeInteger(score.latestCampaignArchive.sequence)
          && score.latestCampaignArchive.sequence < score.latestArchive.sequence
          && typeof score.latestCampaignArchive.hash === 'string'
          && stringTrim(score.latestCampaignArchive.hash) !== ''
          && (
            score.latestStatus === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
            || score.latestStatus === HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED
          )
          && typeof score.latestLevelId === 'string'
          && stringTrim(score.latestLevelId) !== ''
          && score.dataOnly === true
          && score.authorityTransferred === false
          && !arraySome(
            [
              'candidate',
              'candidates',
              'runner',
              'actionReport',
              'holdout',
              'campaignArchives'
            ],
            (key) => arrayIncludes(reflectOwnKeys(score), key)
          );
      })
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError(
        'Harness Factory benchmark validation stability requires trusted evidence'
      );
    }
    const scoreKeys = arrayMap(
      candidateScores,
      (score) => `${score.candidateId}\u0000${score.architectureFingerprint}`
    );
    const countedValidations = arrayReduce(
      candidateScores,
      (total, score) => total + score.validationCount,
      0
    );
    if (
      setSize(setFromArray(scoreKeys)) !== scoreKeys.length
      || countedValidations !== returnedValidationCount
      || truncated !== (
        consideredValidationCount
          > MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES
      )
      || returnedValidationCount !== 0 && candidateScores.length === 0
    ) {
      throw new TypeError(
        'Harness Factory benchmark validation stability bounds are inconsistent'
      );
    }
    this.factoryId = factory.factoryId;
    this.consideredValidationCount = consideredValidationCount;
    this.returnedValidationCount = returnedValidationCount;
    this.candidateCount = candidateScores.length;
    this.stableCandidateCount = arrayFilter(
      candidateScores,
      (score) => score.stable
    ).length;
    this.maxEntries = MAX_HARNESS_FACTORY_BENCHMARK_VALIDATION_HISTORY_ENTRIES;
    this.truncated = truncated;
    this.candidateScores = objectFreeze(arraySlice(candidateScores));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITIES, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkValidationStabilityReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITIES, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryBenchmarkValidationStabilityReport.prototype;
}

function isValidFactoryHoldoutEvidence(
  holdout,
  architectureId,
  requireArchitectureFingerprint = true
) {
  return isPlainObject(holdout)
    && holdout.architectureId === architectureId
    && (requireArchitectureFingerprint
      ? holdout.architectureFingerprint === null
        || typeof holdout.architectureFingerprint === 'string'
      : holdout.architectureFingerprint === undefined)
    && isSafeInteger(holdout.caseCount)
    && holdout.caseCount > 0
    && arrayIsArray(holdout.caseIds)
    && holdout.caseIds.length === holdout.caseCount
    && setSize(setFromArray(holdout.caseIds)) === holdout.caseIds.length
    && arrayEvery(
      holdout.caseIds,
      (caseId) => typeof caseId === 'string' && stringTrim(caseId) !== ''
    )
    && arrayEvery(
      [
        holdout.attemptedCases,
        holdout.successes,
        holdout.proofEligibleCases,
        holdout.proven
      ],
      (count) => isSafeInteger(count) && count >= 0
    )
    && holdout.successes <= holdout.attemptedCases
    && holdout.proven <= holdout.proofEligibleCases
    && isFiniteNumber(holdout.successRate)
    && holdout.successRate >= 0
    && holdout.successRate <= 1
    && (holdout.provenRate === null
      || isFiniteNumber(holdout.provenRate)
        && holdout.provenRate >= 0
        && holdout.provenRate <= 1)
    && arrayEvery(
      [
        holdout.primaryComplete,
        holdout.reproductionComplete,
        holdout.reproducible,
        holdout.complete,
        holdout.passed,
        holdout.independent,
        holdout.dataOnly,
        holdout.authorityTransferred
      ],
      (value) => typeof value === 'boolean'
    )
    && holdout.independent === true
    && holdout.dataOnly === true
    && holdout.authorityTransferred === false
    && arrayIsArray(holdout.reproducibilityReasons)
    && arrayEvery(
      holdout.reproducibilityReasons,
      (reason) => typeof reason === 'string'
    );
}

export class HarnessFactoryBenchmarkCampaignValidationReport {
  constructor({
    factory,
    campaign,
    campaignPoint,
    benchmarkPoint,
    holdout,
    archive = null,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isTrustedHarnessFactoryBenchmarkCampaignReport(campaign)
      || weakMapGet(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FACTORIES, campaign)
        !== factory
      || campaign.archived !== true
      || campaign.archive === null
      || !isValidFactoryBenchmarkPoint(campaignPoint, campaign.candidateIds)
      || !arrayIncludes(campaign.frontier, campaignPoint)
      || !isValidFactoryBenchmarkPoint(benchmarkPoint, campaign.candidateIds)
      || !sameFactoryBenchmarkPointEvidence(campaignPoint, benchmarkPoint)
      || !isValidFactoryHoldoutEvidence(holdout, campaignPoint.architectureId)
      || holdout.architectureFingerprint !== campaignPoint.architectureFingerprint
      || archive !== null
        && (
          !isPlainObject(archive)
          || archive.kind !== 'harness-factory-benchmark-validation'
          || !isSafeInteger(archive.sequence)
          || archive.sequence <= 0
          || typeof archive.hash !== 'string'
        )
    ) {
      throw new TypeError(
        'Harness Factory benchmark validation requires matching trusted evidence'
      );
    }
    const passed = campaignPoint.complete === true
      && campaignPoint.reproducible === true
      && campaignPoint.independent === true
      && benchmarkPoint.complete === true
      && benchmarkPoint.reproducible === true
      && benchmarkPoint.independent === true
      && holdout.passed === true;
    this.factoryId = factory.factoryId;
    this.campaignArchive = archiveLocator(campaign.archive);
    this.candidateId = campaignPoint.architectureId;
    this.levelId = campaignPoint.levelId;
    this.caseFingerprint = campaign.caseFingerprint;
    this.caseIds = objectFreeze(arraySlice(campaign.caseIds));
    this.holdoutCaseIds = objectFreeze(arraySlice(holdout.caseIds));
    this.campaignPoint = campaignPoint;
    this.benchmarkPoint = benchmarkPoint;
    this.benchmarkMatch = true;
    this.holdout = holdout;
    this.complete = benchmarkPoint.complete === true && holdout.complete === true;
    this.reproducible = benchmarkPoint.reproducible === true
      && holdout.reproducible === true;
    this.independent = benchmarkPoint.independent === true && holdout.independent === true;
    this.status = passed
      ? HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
      : HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED;
    this.passed = passed;
    this.archived = archive !== null;
    this.archive = archive === null ? null : archiveLocator(archive);
    this.deployed = false;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATIONS, this);
    weakMapSet(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_FACTORIES, this, factory);
    weakMapSet(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_CAMPAIGNS,
      this,
      campaign
    );
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkCampaignValidationReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATIONS, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryBenchmarkCampaignValidationReport.prototype;
}

export class HarnessFactoryValidationReport {
  constructor({
    factory,
    recommendation,
    holdout,
    architectureFingerprint = null,
    archive = null,
    token
  }) {
    const normalizedArchitectureFingerprint = holdout?.architectureFingerprint
      ?? architectureFingerprint;
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isTrustedHarnessFactoryRecommendationReport(recommendation)
      || weakMapGet(TRUSTED_HARNESS_FACTORY_RECOMMENDATION_FACTORIES, recommendation)
        !== factory
      || recommendation.status
        !== HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
      || !isPlainObject(holdout)
      || normalizedArchitectureFingerprint
        !== recommendation.baseline?.architecture?.architectureFingerprint
      || archive !== null
        && (
          !isPlainObject(archive)
          || archive.kind !== 'harness-factory-validation'
          || !isSafeInteger(archive.sequence)
          || archive.sequence <= 0
          || typeof archive.hash !== 'string'
        )
    ) {
      throw new TypeError('Harness Factory validation requires matching lifecycle evidence');
    }
    this.factoryId = factory.factoryId;
    this.recommendationStatus = recommendation.status;
    this.baseline = recommendation.baseline;
    this.baselineGeneration = recommendation.baselineGeneration;
    this.architectureId = holdout.architectureId;
    this.architectureFingerprint = normalizedArchitectureFingerprint;
    this.status = holdout.passed === true
      ? HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
      : HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED;
    this.passed = holdout.passed;
    this.complete = holdout.complete;
    this.primaryComplete = holdout.primaryComplete;
    this.reproductionComplete = holdout.reproductionComplete;
    this.reproducible = holdout.reproducible;
    this.independent = holdout.independent;
    this.holdout = factoryHoldoutMetadata(holdout);
    this.archive = archive === null ? null : archiveLocator(archive);
    this.archived = this.archive !== null;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_VALIDATIONS, this);
    weakMapSet(TRUSTED_HARNESS_FACTORY_VALIDATION_FACTORIES, this, factory);
    weakMapSet(
      TRUSTED_HARNESS_FACTORY_VALIDATION_RECOMMENDATIONS,
      this,
      recommendation
    );
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryValidationReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_VALIDATIONS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryValidationReport.prototype;
}

export class HarnessFactoryReport {
  constructor({
    factory,
    discovery,
    archive,
    agentRun,
    agentArchive,
    agentRequested,
    factoryMetadata,
    improvement,
    holdout,
    holdoutRequested,
    frontier,
    retirement,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isTrustedAgentArchitectureDiscoveryReport(discovery)
      || !isTrustedHarnessFactoryDisposalReport(retirement)
      || retirement.factoryId !== factory.factoryId
      || archive !== null && !isPlainObject(archive)
      || agentRun !== null && !isPlainObject(agentRun)
      || agentArchive !== null && !isPlainObject(agentArchive)
      || !isPlainObject(factoryMetadata)
      || improvement !== null && !isPlainObject(improvement)
      || holdout !== null && !isPlainObject(holdout)
      || !isTrustedHarnessFactoryFrontierReport(frontier)
      || frontier.factoryId !== factory.factoryId
      || typeof holdoutRequested !== 'boolean'
      || typeof agentRequested !== 'boolean'
    ) {
      throw new TypeError('Harness Factory report requires trusted lifecycle evidence');
    }
    if (
      discovery.adopted === true
      && discovery.adoptedCandidate === null
    ) {
      throw new TypeError('Harness Factory adopted result requires a fresh candidate');
    }
    if (
      holdout !== null && (
        holdoutRequested === false
        || discovery.adopted !== true
        || holdout.passed !== true
      )
      || holdoutRequested === true
        && discovery.adopted === true
        && holdout === null
    ) {
      throw new TypeError('Harness Factory holdout lifecycle evidence is inconsistent');
    }
    this.factoryId = factory.factoryId;
    this.goal = discovery.goal;
    this.status = discovery.adopted
      ? HARNESS_FACTORY_STATUSES.ADOPTED
      : HARNESS_FACTORY_STATUSES.REJECTED;
    this.proposalIds = objectFreeze(arrayMap(
      discovery.proposals,
      ({ id }) => id
    ));
    this.candidateIds = objectFreeze(arrayMap(
      discovery.candidates,
      ({ id }) => id
    ));
    this.proposalCount = this.proposalIds.length;
    this.builtCandidateCount = this.candidateIds.length;
    this.winnerId = discovery.winnerId;
    this.adoptedCandidateId = discovery.adoptedCandidate?.id ?? null;
    this.fitness = factoryFitnessForDiscovery(discovery);
    this.benchmark = factoryBenchmarkForDiscovery(discovery);
    this.benchmarkIdentity = factoryMetadata.benchmark;
    this.generation = factoryMetadata.generation;
    this.predecessor = factoryMetadata.predecessor;
    this.complete = discovery.complete;
    this.primaryComplete = discovery.primary.complete;
    this.reproductionComplete = discovery.reproduction.complete;
    this.reproducible = discovery.reproducibility.reproducible;
    this.freshAdoption = discovery.adopted === true;
    this.proofStatus = discovery.adopted === true ? 'PROVEN' : 'NONE';
    this.researchContext = discovery.proposalReport.researchContext;
    this.improvedFromArchive = this.researchContext?.query?.source
      === MEMORY_SOURCES.ARCHITECTURE_DISCOVERY
      || this.researchContext?.query?.source
        === MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN
      || this.researchContext?.query?.source
        === MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION;
    this.retiredCandidateIds = retirement.candidateIds;
    this.retiredCandidateCount = retirement.count;
    this.archive = archive;
    this.agentRun = agentRun;
    this.agentRunRequested = agentRequested;
    this.agentBuilt = agentRun !== null;
    this.agentProofStatus = agentRun === null
      ? 'NONE'
      : agentRun.provenActions > 0
        ? 'PROVEN'
        : agentRun.completed
          ? 'OBSERVED'
          : 'NONE';
    this.agentArchive = agentArchive;
    this.factoryMetadata = factoryMetadata;
    this.improvement = improvement;
    this.holdout = holdout;
    this.holdoutRequested = holdoutRequested;
    this.holdoutStatus = holdout === null
      ? HARNESS_FACTORY_HOLDOUT_STATUSES.NOT_RUN
      : HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED;
    this.frontier = frontier;
    this.deployed = false;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_REPORTS, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_REPORTS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryReport.prototype;
}

export class HarnessFactory {
  constructor(options = {}) {
    requireDataObject(options, 'Harness Factory options', FACTORY_OPTIONS_KEYS);
    const {
      factoryId = 'fluid-harness-factory',
      discoveryRunner,
      ledger = new EvidenceLedger()
    } = options;
    if (!isTrustedAgentArchitectureDiscoveryRunner(discoveryRunner)) {
      throw new TypeError('Harness Factory requires a trusted architecture discovery runner');
    }
    if (!isTrustedEvidenceLedger(ledger)) {
      throw new TypeError('Harness Factory requires a trusted evidence ledger');
    }
    if (reflectOwnKeys(ledger).length !== 0) {
      throw new TypeError('Harness Factory requires an unmodified evidence ledger instance');
    }
    this.factoryId = requireNonEmptyString(factoryId, 'Harness Factory factoryId');
    this.discoveryRunner = discoveryRunner;
    this.ledger = ledger;
    weakSetAdd(TRUSTED_HARNESS_FACTORIES, this);
    objectFreeze(this);
  }

  manufacture(options = {}) {
    return manufactureFactory(this, options);
  }

  improve(options = {}) {
    requireDataObject(options, 'Harness Factory improvement options', IMPROVEMENT_OPTIONS_KEYS);
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const {
      goal,
      plannerCandidates,
      cases,
      productionBudget,
      researchBudget,
      skepticBudget,
      baselineGeneration = null,
      holdoutCases = null,
      holdoutProductionBudget = null,
      holdoutResearchBudget = null,
      holdoutSkepticBudget = null,
      archive = true,
      agentGoal = null,
      agentContext = null,
      agentReproduction = 'HarnessFactory.improve',
      toolRegistry = null,
      memoryQuery = {},
      maxMemoryEntries = MAX_STRUCTURED_MEMORY_ENTRIES
    } = options;
    const normalizedBaselineGeneration = requireOptionalPositiveSafeInteger(
      baselineGeneration,
      'Harness Factory improvement baselineGeneration'
    );
    requireDataObject(
      memoryQuery,
      'Harness Factory improvement memoryQuery',
      IMPROVEMENT_QUERY_KEYS
    );
    if (
      memoryQuery.source !== undefined
      && memoryQuery.source !== MEMORY_SOURCES.ARCHITECTURE_DISCOVERY
      && memoryQuery.source !== MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN
      && memoryQuery.source !== MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION
    ) {
      throw new TypeError(
        'Harness Factory improvement memoryQuery must use ARCHITECTURE_DISCOVERY source, '
        + 'HARNESS_FACTORY_BENCHMARK_CAMPAIGN source, or '
        + 'HARNESS_FACTORY_BENCHMARK_VALIDATION source'
      );
    }
    const normalizedMemoryQuery = {
      ...memoryQuery,
      source: memoryQuery.source === undefined
        ? MEMORY_SOURCES.ARCHITECTURE_DISCOVERY
        : memoryQuery.source
    };
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    const historicalFactoryHistory = factoryHistoryFromLedger(
      historicalLedger,
      this.factoryId
    );
    if (historicalFactoryHistory.length === 0) {
      throw new Error(
        'Harness Factory improvement requires at least one archived factory generation'
      );
    }
    const baselineHistory = normalizedBaselineGeneration === null
      ? historicalFactoryHistory[historicalFactoryHistory.length - 1]
      : arrayFind(
        historicalFactoryHistory,
        ({ discovery }) => discovery.factory.generation === normalizedBaselineGeneration
      );
    if (baselineHistory === undefined) {
      throw new RangeError(
        `Harness Factory improvement baselineGeneration ${normalizedBaselineGeneration} `
        + 'does not identify an archived factory generation'
      );
    }
    if (normalizedBaselineGeneration !== null) {
      const baselineTaskId = `architecture-discovery:${baselineHistory.record.sequence}`;
      if (
        memoryQuery.taskId !== undefined
        && memoryQuery.taskId !== null
        && memoryQuery.taskId !== baselineTaskId
      ) {
        throw new Error(
          'Harness Factory improvement memoryQuery taskId must match the selected baseline'
        );
      }
      normalizedMemoryQuery.taskId = baselineTaskId;
    }
    const memory = memoryFromLedger({
      ledger: historicalLedger,
      maxEntries: maxMemoryEntries,
      idPrefix: 'harness-factory-improvement'
    });
    const researchContext = buildStructuredMemoryContext({
      memory,
      query: normalizedMemoryQuery
    });
    if (researchContext.resultCount === 0) {
      throw new Error('Harness Factory improvement query found no archived factory history');
    }
    return manufactureFactory(this, {
      goal,
      plannerCandidates,
      cases,
      productionBudget,
      researchBudget,
      skepticBudget,
      holdoutCases,
      holdoutProductionBudget,
      holdoutResearchBudget,
      holdoutSkepticBudget,
      researchContext,
      archive,
      agentGoal,
      agentContext,
      agentReproduction,
      toolRegistry
    }, {
      record: baselineHistory.record,
      discovery: baselineHistory.discovery
    });
  }

  frontier() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryFrontierFromLedger(
      historicalLedger,
      this
    );
  }

  frontiers() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryFrontierPortfolioFromLedger(
      historicalLedger,
      this
    );
  }

  history() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryHistoryReportFromLedger(
      historicalLedger,
      this
    );
  }

  benchmarkCampaigns() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryBenchmarkCampaignHistoryReportFromLedger(
      historicalLedger,
      this
    );
  }

  benchmarkCampaignValidations() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryBenchmarkCampaignValidationHistoryReportFromLedger(
      historicalLedger,
      this
    );
  }

  benchmarkValidationScorecard() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryBenchmarkValidationScorecardFromLedger(
      historicalLedger,
      this
    );
  }

  benchmarkValidationStability() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryBenchmarkValidationStabilityFromLedger(
      historicalLedger,
      this
    );
  }

  dispose(options = {}) {
    requireDataObject(options, 'Harness Factory disposal options', DISPOSE_OPTIONS_KEYS);
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const {
      candidates,
      reason = 'retired by Harness Factory'
    } = options;
    const normalizedCandidates = requireTrustedArchitectureCandidates(candidates);
    const normalizedReason = requireNonEmptyString(
      reason,
      'Harness Factory disposal reason'
    );
    arrayMap(normalizedCandidates, (candidate) => {
      if (weakSetHas(PROTECTED_ADOPTED_CANDIDATES, candidate)) {
        throw new TypeError(
          `Harness Factory cannot dispose adopted candidate ${candidate.id}`
        );
      }
      if (weakSetHas(DISPOSED_ARCHITECTURE_CANDIDATES, candidate)) {
        throw new TypeError(
          `Harness Factory candidate ${candidate.id} has already been disposed`
        );
      }
      return candidate;
    });
    arrayMap(normalizedCandidates, (candidate) => {
      weakSetAdd(DISPOSED_ARCHITECTURE_CANDIDATES, candidate);
      return candidate;
    });
    return new HarnessFactoryDisposalReport({
      factory: this,
      candidateIds: arrayMap(normalizedCandidates, ({ id }) => id),
      reason: normalizedReason,
      token: FACTORY_TOKEN
    });
  }

  recommend() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    const history = factoryHistoryFromLedger(historicalLedger, this.factoryId);
    const validations = historicalLedger.restoreHarnessFactoryValidations();
    return factoryRecommendationFromHistory({
      factory: this,
      history,
      validations
    });
  }

  researchAgenda(options = {}) {
    requireDataObject(
      options,
      'Harness Factory research agenda options',
      ['maxItems']
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const maxItems = options.maxItems === undefined
      ? MAX_HARNESS_FACTORY_RESEARCH_AGENDA_ITEMS
      : options.maxItems;
    if (
      !isSafeInteger(maxItems)
      || maxItems <= 0
      || maxItems > MAX_HARNESS_FACTORY_RESEARCH_AGENDA_ITEMS
    ) {
      throw new RangeError(
        'Harness Factory research agenda maxItems must be a positive integer no greater than '
        + `${MAX_HARNESS_FACTORY_RESEARCH_AGENDA_ITEMS}`
      );
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    const history = factoryHistoryFromLedger(historicalLedger, this.factoryId);
    const validations = historicalLedger.restoreHarnessFactoryValidations();
    const benchmarkValidations = historicalLedger.restoreHarnessFactoryBenchmarkValidations();
    return factoryResearchAgendaFromHistory({
      factory: this,
      history,
      validations,
      benchmarkValidations,
      maxItems
    });
  }

  executeBenchmarkValidationResearch(target, options = {}) {
    requireDataObject(
      options,
      'Harness Factory benchmark validation research execution options',
      BENCHMARK_VALIDATION_RESEARCH_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (!isTrustedHarnessFactoryResearchAgendaItem(target, this)) {
      throw new TypeError(
        'Harness Factory benchmark validation research requires an exact agenda item from this factory'
      );
    }
    const currentAgenda = this.researchAgenda();
    const currentTarget = arrayFind(
      currentAgenda.items,
      ({ id }) => id === target.id
    );
    if (
      currentTarget === undefined
      || jsonStringify(currentTarget) !== jsonStringify(target)
    ) {
      throw new Error('Harness Factory benchmark validation research target is stale');
    }
    if (
      target.target
        !== HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION
    ) {
      throw new Error(
        'Harness Factory benchmark validation research target is not executable'
      );
    }
    const {
      campaign,
      candidate,
      levelId,
      cases,
      holdoutCases,
      holdoutProductionBudget,
      holdoutResearchBudget,
      holdoutSkepticBudget,
      archive = true
    } = options;
    if (archive !== true) {
      throw new TypeError(
        'Harness Factory benchmark validation research execution requires archive true'
      );
    }
    if (
      !isTrustedHarnessFactoryBenchmarkCampaignReport(campaign)
      || weakMapGet(
        TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FACTORIES,
        campaign
      ) !== this
      || campaign.archived !== true
      || campaign.archive === null
    ) {
      throw new TypeError(
        'Harness Factory benchmark validation research requires an exact archived campaign from this factory'
      );
    }
    if (
      !sameArchiveLocator(
        campaign.archive,
        target.benchmarkValidation.campaignArchive
      )
    ) {
      throw new Error(
        'Harness Factory benchmark validation research campaign does not match the target'
      );
    }
    if (!isTrustedAgentArchitectureCandidate(candidate)) {
      throw new TypeError(
        'Harness Factory benchmark validation research requires a trusted candidate'
      );
    }
    if (
      candidate.id !== target.benchmarkValidation.candidateId
      || levelId !== target.benchmarkValidation.levelId
    ) {
      throw new Error(
        'Harness Factory benchmark validation research candidate or level does not match the target'
      );
    }
    const validation = this.validateBenchmarkCampaign(campaign, {
      candidate,
      levelId,
      cases,
      holdoutCases,
      holdoutProductionBudget,
      holdoutResearchBudget,
      holdoutSkepticBudget
    });
    return this.archiveBenchmarkCampaignValidation(validation);
  }

  benchmark(options = {}) {
    requireDataObject(
      options,
      'Harness Factory benchmark options',
      BENCHMARK_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    return factoryBenchmarkCandidate({
      factory: this,
      candidate: options.candidate,
      cases: options.cases,
      levels: options.levels
    });
  }

  benchmarkCampaign(options = {}) {
    requireDataObject(
      options,
      'Harness Factory benchmark campaign options',
      BENCHMARK_CAMPAIGN_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    return factoryBenchmarkCampaign({
      factory: this,
      candidates: options.candidates,
      cases: options.cases,
      levels: options.levels
    });
  }

  archiveBenchmarkCampaign(campaign) {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (
      !isTrustedHarnessFactoryBenchmarkCampaignReport(campaign)
      || weakMapGet(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FACTORIES, campaign)
        !== this
    ) {
      throw new TypeError(
        'Harness Factory benchmark archival requires an exact campaign from this factory'
      );
    }
    if (
      weakSetHas(ARCHIVED_HARNESS_FACTORY_BENCHMARK_CAMPAIGNS, campaign)
      || campaign.archived !== false
      || campaign.archive !== null
    ) {
      throw new Error('Harness Factory benchmark campaign has already been archived');
    }
    verifiedLedgerSnapshot(this.ledger);
    const record = this.ledger.appendHarnessFactoryBenchmarkCampaign(campaign);
    weakSetAdd(ARCHIVED_HARNESS_FACTORY_BENCHMARK_CAMPAIGNS, campaign);
    return new HarnessFactoryBenchmarkCampaignReport({
      factory: this,
      candidateIds: campaign.candidateIds,
      caseIds: campaign.caseIds,
      caseFingerprint: campaign.caseFingerprint,
      points: campaign.points,
      frontier: campaign.frontier,
      archive: record,
      token: FACTORY_TOKEN
    });
  }

  validateBenchmarkCampaign(campaign, options = {}) {
    requireDataObject(
      options,
      'Harness Factory benchmark validation options',
      BENCHMARK_CAMPAIGN_VALIDATION_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    return validateFactoryBenchmarkCampaign({
      factory: this,
      campaign,
      candidate: options.candidate,
      levelId: options.levelId,
      cases: options.cases,
      holdoutCases: options.holdoutCases,
      holdoutProductionBudget: options.holdoutProductionBudget,
      holdoutResearchBudget: options.holdoutResearchBudget,
      holdoutSkepticBudget: options.holdoutSkepticBudget
    });
  }

  archiveBenchmarkCampaignValidation(validation) {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (
      !isTrustedHarnessFactoryBenchmarkCampaignValidationReport(validation)
      || weakMapGet(
        TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_FACTORIES,
        validation
      ) !== this
    ) {
      throw new TypeError(
        'Harness Factory benchmark validation archival requires an exact validation from this factory'
      );
    }
    if (
      weakSetHas(ARCHIVED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATIONS, validation)
      || validation.archived !== false
      || validation.archive !== null
    ) {
      throw new Error(
        'Harness Factory benchmark validation has already been archived'
      );
    }
    const campaign = weakMapGet(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_CAMPAIGNS,
      validation
    );
    if (!isTrustedHarnessFactoryBenchmarkCampaignReport(campaign)) {
      throw new TypeError(
        'Harness Factory benchmark validation source campaign is not trusted'
      );
    }
    verifiedLedgerSnapshot(this.ledger);
    const record = this.ledger.appendHarnessFactoryBenchmarkValidation(validation);
    weakSetAdd(ARCHIVED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATIONS, validation);
    return new HarnessFactoryBenchmarkCampaignValidationReport({
      factory: this,
      campaign,
      campaignPoint: validation.campaignPoint,
      benchmarkPoint: validation.benchmarkPoint,
      holdout: validation.holdout,
      archive: record,
      token: FACTORY_TOKEN
    });
  }

  validateRecommendation(recommendation, options = {}) {
    requireDataObject(
      options,
      'Harness Factory recommendation validation options',
      [
        'candidate',
        'holdoutCases',
        'holdoutProductionBudget',
        'holdoutResearchBudget',
        'holdoutSkepticBudget'
      ]
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (
      !isTrustedHarnessFactoryRecommendationReport(recommendation)
      || weakMapGet(TRUSTED_HARNESS_FACTORY_RECOMMENDATION_FACTORIES, recommendation)
        !== this
    ) {
      throw new TypeError(
        'Harness Factory recommendation validation requires an exact recommendation from this factory'
      );
    }
    const currentRecommendation = this.recommend();
    if (!sameFactoryRecommendation(recommendation, currentRecommendation)) {
      throw new Error('Harness Factory recommendation is stale');
    }
    if (recommendation.status !== HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT) {
      throw new Error(
        'Harness Factory candidate validation requires a VALIDATE_LATEST_HOLDOUT recommendation'
      );
    }
    const { candidate, holdoutCases } = options;
    if (!isTrustedAgentArchitectureCandidate(candidate)) {
      throw new TypeError(
        'Harness Factory recommendation validation requires a trusted candidate'
      );
    }
    if (
      weakSetHas(DISPOSED_ARCHITECTURE_CANDIDATES, candidate)
      || weakSetHas(PROTECTED_ADOPTED_CANDIDATES, candidate)
    ) {
      throw new TypeError(
        'Harness Factory recommendation validation requires a fresh unretired candidate'
      );
    }
    const baselineArchitecture = recommendation.baseline?.architecture;
    if (
      !isPlainObject(baselineArchitecture)
      || !sameFactoryArchitectureConfiguration(candidate, baselineArchitecture)
    ) {
      throw new TypeError(
        'Harness Factory recommendation validation candidate configuration does not match the baseline'
      );
    }
    const normalizedHoldoutCases = requireTrustedHoldoutCases(holdoutCases);
    if (holdoutOverlapsFactoryBenchmark(
      normalizedHoldoutCases,
      recommendation.baseline.benchmarkCaseIds
    )) {
      throw new Error(
        'Harness Factory recommendation validation holdout overlaps the baseline benchmark'
      );
    }
    const budgets = holdoutBudgets(
      normalizedHoldoutCases,
      options.holdoutProductionBudget,
      options.holdoutResearchBudget,
      options.holdoutSkepticBudget
    );
    const holdout = evaluateFactoryHoldout(
      candidate,
      normalizedHoldoutCases,
      budgets
    );
    if (
      holdout.architectureFingerprint
      !== baselineArchitecture.architectureFingerprint
    ) {
      throw new TypeError(
        'Harness Factory recommendation validation candidate fingerprint does not match the baseline'
      );
    }
    return new HarnessFactoryValidationReport({
      factory: this,
      recommendation,
      holdout,
      token: FACTORY_TOKEN
    });
  }

  archiveValidation(validation) {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (
      !isTrustedHarnessFactoryValidationReport(validation)
      || weakMapGet(TRUSTED_HARNESS_FACTORY_VALIDATION_FACTORIES, validation) !== this
    ) {
      throw new TypeError(
        'Harness Factory validation archival requires an exact validation from this factory'
      );
    }
    if (validation.archived !== false || validation.archive !== null) {
      throw new Error('Harness Factory validation has already been archived');
    }
    const recommendation = weakMapGet(
      TRUSTED_HARNESS_FACTORY_VALIDATION_RECOMMENDATIONS,
      validation
    );
    const currentRecommendation = this.recommend();
    if (
      !isTrustedHarnessFactoryRecommendationReport(recommendation)
      || !sameFactoryRecommendation(recommendation, currentRecommendation)
      || recommendation.status
        !== HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
    ) {
      throw new Error('Harness Factory validation is stale');
    }
    const record = this.ledger.appendHarnessFactoryValidation(validation);
    return new HarnessFactoryValidationReport({
      factory: this,
      recommendation,
      holdout: {
        ...validation.holdout,
        architectureFingerprint: validation.architectureFingerprint
      },
      architectureFingerprint: validation.architectureFingerprint,
      archive: archiveLocator(record),
      token: FACTORY_TOKEN
    });
  }

  executeRecommendation(recommendation, options = {}) {
    requireDataObject(
      options,
      'Harness Factory recommendation execution options',
      IMPROVEMENT_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (
      !isTrustedHarnessFactoryRecommendationReport(recommendation)
      || weakMapGet(TRUSTED_HARNESS_FACTORY_RECOMMENDATION_FACTORIES, recommendation)
        !== this
    ) {
      throw new TypeError(
        'Harness Factory recommendation execution requires an exact recommendation from this factory'
      );
    }
    const currentRecommendation = this.recommend();
    if (!sameFactoryRecommendation(recommendation, currentRecommendation)) {
      throw new Error('Harness Factory recommendation is stale');
    }
    if (recommendation.status === HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY) {
      throw new Error(
        'Harness Factory recommendation cannot execute without an archived generation'
      );
    }
    if (recommendation.status === HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT) {
      throw new Error(
        'Harness Factory holdout validation recommendation requires explicit candidate reconstruction'
      );
    }
    if (options.archive === false) {
      throw new TypeError(
        'Harness Factory recommendation execution requires archive true'
      );
    }
    if (
      options.baselineGeneration !== undefined
      && options.baselineGeneration !== recommendation.baselineGeneration
    ) {
      throw new Error(
        'Harness Factory recommendation execution baselineGeneration must match the recommendation'
      );
    }
    if (
      recommendation.status === HARNESS_FACTORY_RECOMMENDATION_STATUSES.RECOVER_FAILED_HOLDOUT
      && (options.holdoutCases === undefined || options.holdoutCases === null)
    ) {
      throw new TypeError(
        'Harness Factory failed-holdout recovery recommendation requires holdoutCases'
      );
    }
    return this.improve({
      ...options,
      baselineGeneration: recommendation.baselineGeneration
    });
  }

  isDisposed(candidate) {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (!isTrustedAgentArchitectureCandidate(candidate)) {
      throw new TypeError('Harness Factory disposal lookup requires a trusted candidate');
    }
    return weakSetHas(DISPOSED_ARCHITECTURE_CANDIDATES, candidate);
  }

  isAdoptedCandidate(candidate) {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (!isTrustedAgentArchitectureCandidate(candidate)) {
      throw new TypeError('Harness Factory adoption lookup requires a trusted candidate');
    }
    return weakSetHas(PROTECTED_ADOPTED_CANDIDATES, candidate);
  }
}

export function isTrustedHarnessFactory(factory) {
  return typeof factory === 'object'
    && factory !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORIES, factory)
    && objectGetPrototypeOf(factory) === HarnessFactory.prototype;
}

objectFreeze(HarnessFactoryDisposalReport.prototype);
objectFreeze(HarnessFactoryFrontierPortfolioReport.prototype);
objectFreeze(HarnessFactoryHistoryReport.prototype);
objectFreeze(HarnessFactoryRecommendationReport.prototype);
objectFreeze(HarnessFactoryResearchAgendaReport.prototype);
objectFreeze(HarnessFactoryBenchmarkReport.prototype);
objectFreeze(HarnessFactoryBenchmarkCampaignReport.prototype);
objectFreeze(HarnessFactoryBenchmarkCampaignHistoryReport.prototype);
objectFreeze(HarnessFactoryBenchmarkCampaignValidationHistoryReport.prototype);
objectFreeze(HarnessFactoryBenchmarkValidationScorecardReport.prototype);
objectFreeze(HarnessFactoryBenchmarkValidationStabilityReport.prototype);
objectFreeze(HarnessFactoryBenchmarkCampaignValidationReport.prototype);
objectFreeze(HarnessFactoryValidationReport.prototype);
objectFreeze(HarnessFactoryReport.prototype);
objectFreeze(HarnessFactory.prototype);
