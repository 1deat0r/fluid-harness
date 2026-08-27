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
import {
  AgentArchitectureProposal,
  AgentArchitectureProposalReport
} from './agent-architecture-proposal.mjs';
import {
  isTrustedAgentPlannerCandidate,
  isTrustedAgentPlannerCase
} from './agent-search.mjs';
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
  objectKeys,
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
export const HARNESS_FACTORY_ARCHITECTURE_ATTEMPT_SOURCES = objectFreeze({
  GENERATION: 'GENERATION',
  IMPROVEMENT_REJECTION: 'IMPROVEMENT_REJECTION'
});
export const HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_SOURCES = objectFreeze({
  PROCESS_ISOLATED: 'PROCESS_ISOLATED'
});
export const HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES = objectFreeze({
  NOVEL: 'NOVEL',
  REPEATED: 'REPEATED'
});
export const HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUSES = objectFreeze({
  CONVERTED: 'CONVERTED',
  REPLAYED: 'REPLAYED',
  UNTESTED: 'UNTESTED'
});
const HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUS_VALUES = objectFreeze([
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUSES.CONVERTED,
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUSES.REPLAYED,
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUSES.UNTESTED
]);
export const HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITY_STATUSES = objectFreeze({
  INSUFFICIENT: 'INSUFFICIENT',
  STABLE: 'STABLE',
  UNSTABLE: 'UNSTABLE'
});
export const HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES = objectFreeze({
  FAILED: 'FAILED',
  INCOMPLETE: 'INCOMPLETE',
  PASSED: 'PASSED'
});
export const HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES = objectFreeze({
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
  COMPLETE_BENCHMARK_FRONTIER_VALIDATION: 'COMPLETE_BENCHMARK_FRONTIER_VALIDATION',
  IMPROVE_LATEST_GENERATION: 'IMPROVE_LATEST_GENERATION',
  INVESTIGATE_BENCHMARK_VALIDATION: 'INVESTIGATE_BENCHMARK_VALIDATION',
  INVESTIGATE_BENCHMARK_FRONTIER_STABILITY: 'INVESTIGATE_BENCHMARK_FRONTIER_STABILITY',
  INVESTIGATE_SKEPTIC_WEAKNESS: 'INVESTIGATE_SKEPTIC_WEAKNESS',
  RECOVER_FAILED_HOLDOUT: 'RECOVER_FAILED_HOLDOUT',
  TEST_TRANSFER_GAP: 'TEST_TRANSFER_GAP',
  VALIDATE_UNSEEN_HOLDOUT: 'VALIDATE_UNSEEN_HOLDOUT'
});
export const HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES = objectFreeze({
  BENCHMARK_FRONTIER_VALIDATION: 'BENCHMARK_FRONTIER_VALIDATION',
  BENCHMARK_VALIDATION: 'BENCHMARK_VALIDATION',
  FACTORY_RECOMMENDATION: 'FACTORY_RECOMMENDATION',
  FRONTIER_STABILITY: 'FRONTIER_STABILITY',
  HOLDOUT_VALIDATION: 'HOLDOUT_VALIDATION',
  OPERATOR_EXPERIMENT: 'OPERATOR_EXPERIMENT'
});
export const HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES = objectFreeze({
  BENCHMARK_FRONTIER_VALIDATION_RESEARCH:
    'HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_RESEARCH',
  BENCHMARK_VALIDATION: 'HARNESS_FACTORY_BENCHMARK_VALIDATION',
  BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH:
    'HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH',
  FACTORY_REPORT: 'HARNESS_FACTORY_REPORT',
  VALIDATION: 'HARNESS_FACTORY_VALIDATION'
});
const HARNESS_FACTORY_RESEARCH_TARGET_VALUES = objectFreeze([
  HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION,
  HARNESS_FACTORY_RESEARCH_TARGETS.IMPROVE_LATEST_GENERATION,
  HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION,
  HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY,
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
export const MAX_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_HISTORY_ENTRIES = 32;
export const MAX_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORY_ENTRIES = 32;
export const MAX_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_ENTRIES = 32;
export const MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_ENTRIES = 8;
export const MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORY_ENTRIES = 32;
export const MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES = 8;

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
const ARCHIVED_PROPOSAL_MANUFACTURE_OPTIONS_KEYS = objectFreeze([
  'goal',
  'plannerCandidates',
  'cases',
  'productionBudget',
  'researchBudget',
  'skepticBudget',
  'holdoutCases',
  'holdoutProductionBudget',
  'holdoutResearchBudget',
  'holdoutSkepticBudget',
  'agentGoal',
  'agentContext',
  'agentReproduction',
  'toolRegistry'
]);
const ARCHITECTURE_PROPOSAL_OPTIONS_KEYS = objectFreeze([
  'goal',
  'plannerCandidates',
  'memoryQuery',
  'maxMemoryEntries',
  'researchContext',
  'archive'
]);
const RESEARCH_PLAN_OPTIONS_KEYS = objectFreeze(['maxItems']);
const RESEARCH_PLAN_ITEM_KEYS = objectFreeze([
  'agendaItemId',
  'archive',
  'authorityTransferred',
  'benchmark',
  'bridge',
  'dataOnly',
  'executionMethod',
  'expectedEvidence',
  'factoryId',
  'fitness',
  'generation',
  'holdoutStatus',
  'id',
  'objective',
  'priority',
  'rank',
  'requiredInputs',
  'target',
  'validationArchive'
]);
const RESEARCH_PLAN_EXECUTION_OPTIONS_KEYS = objectFreeze([
  'agentContext',
  'agentGoal',
  'agentReproduction',
  'archive',
  'baselineGeneration',
  'campaign',
  'candidate',
  'cases',
  'goal',
  'holdoutCases',
  'holdoutProductionBudget',
  'holdoutResearchBudget',
  'holdoutSkepticBudget',
  'levelId',
  'maxMemoryEntries',
  'memoryQuery',
  'plannerCandidates',
  'points',
  'productionBudget',
  'researchBudget',
  'skepticBudget',
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
  'sources',
  'evidence',
  'surpriseBand',
  'minSurpriseNats',
  'limit'
]);
const HARNESS_FACTORY_IMPROVEMENT_MEMORY_SOURCES = objectFreeze([
  'ARCHITECTURE_DISCOVERY',
  'HARNESS_FACTORY_BENCHMARK_CAMPAIGN',
  'HARNESS_FACTORY_BENCHMARK_VALIDATION',
  'HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION',
  'HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY',
  'HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION',
  'HARNESS_FACTORY_IMPROVEMENT_REJECTION',
  'HARNESS_FACTORY_ARCHITECTURE_COVERAGE',
  'HARNESS_FACTORY_ARCHITECTURE_PROPOSAL',
  'HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION'
]);

function usesHarnessFactoryImprovementMemory(researchContext) {
  const query = researchContext?.query;
  return arrayIncludes(
    HARNESS_FACTORY_IMPROVEMENT_MEMORY_SOURCES,
    query?.source
  ) || arrayIsArray(query?.sources)
    && arraySome(
      query.sources,
      (source) => arrayIncludes(
        HARNESS_FACTORY_IMPROVEMENT_MEMORY_SOURCES,
        source
      )
    );
}

function normalizedHarnessFactoryProposalMemoryQuery(memoryQuery) {
  requireDataObject(
    memoryQuery,
    'Harness Factory architecture proposal memoryQuery',
    IMPROVEMENT_QUERY_KEYS
  );
  const requestedMemorySources = memoryQuery.sources === undefined
    || memoryQuery.sources === null
    ? null
    : snapshotProcessData(memoryQuery.sources);
  if (
    memoryQuery.source !== undefined
    && memoryQuery.source !== null
    && !arrayIncludes(
      HARNESS_FACTORY_IMPROVEMENT_MEMORY_SOURCES,
      memoryQuery.source
    )
  ) {
    throw new TypeError(
      'Harness Factory architecture proposal memoryQuery source is unsupported'
    );
  }
  if (requestedMemorySources !== null) {
    if (
      !arrayIsArray(requestedMemorySources)
      || requestedMemorySources.length === 0
      || setSize(setFromArray(requestedMemorySources))
        !== requestedMemorySources.length
      || arraySome(
        requestedMemorySources,
        (source) => !arrayIncludes(
          HARNESS_FACTORY_IMPROVEMENT_MEMORY_SOURCES,
          source
        )
      )
    ) {
      throw new TypeError(
        'Harness Factory architecture proposal memoryQuery sources must contain unique supported sources'
      );
    }
    if (memoryQuery.source !== undefined && memoryQuery.source !== null) {
      throw new TypeError(
        'Harness Factory architecture proposal memoryQuery cannot use source and sources together'
      );
    }
  }
  return {
    ...memoryQuery,
    ...(requestedMemorySources === null
      ? {
        source: memoryQuery.source === undefined
          ? MEMORY_SOURCES.ARCHITECTURE_DISCOVERY
          : memoryQuery.source
      }
      : {
        sources: requestedMemorySources
      })
  };
}
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
const BENCHMARK_FRONTIER_VALIDATION_RESEARCH_OPTIONS_KEYS = objectFreeze([
  'campaign',
  'points',
  'cases',
  'holdoutCases',
  'holdoutProductionBudget',
  'holdoutResearchBudget',
  'holdoutSkepticBudget',
  'archive'
]);
const BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_OPTIONS_KEYS = objectFreeze([
  'campaign',
  'points',
  'cases',
  'holdoutCases',
  'holdoutProductionBudget',
  'holdoutResearchBudget',
  'holdoutSkepticBudget',
  'archive'
]);
const BENCHMARK_CAMPAIGN_FRONTIER_VALIDATION_OPTIONS_KEYS = objectFreeze([
  'campaign',
  'points',
  'cases',
  'holdoutCases',
  'holdoutProductionBudget',
  'holdoutResearchBudget',
  'holdoutSkepticBudget'
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
const TRUSTED_HARNESS_FACTORY_RESEARCH_PLANS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_ITEMS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_ITEM_FACTORIES = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_FACTORIES = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_HISTORIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_IMPROVEMENT_REJECTIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_IMPROVEMENT_REJECTION_FACTORIES = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_ARCHITECTURE_COVERAGES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPORTS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_FACTORIES = weakMapCreate();
const ARCHIVED_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARKS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGNS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FACTORIES = weakMapCreate();
const ARCHIVED_HARNESS_FACTORY_BENCHMARK_CAMPAIGNS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_HISTORIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_VALIDATION_SCORECARDS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_VALIDATION_STABILITIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARDS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITIES = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_RESEARCH_EXECUTIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_EXECUTIONS = weakSetCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_FACTORIES = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_CAMPAIGNS = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_FACTORIES = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_CAMPAIGNS = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_RESEARCH_EXECUTION_FACTORIES = weakMapCreate();
const TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_EXECUTION_FACTORIES = weakMapCreate();
const ARCHIVED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATIONS = weakSetCreate();
const ARCHIVED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATIONS = weakSetCreate();
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

function requireTrustedFactoryPlannerCandidates(plannerCandidates) {
  if (!arrayIsArray(plannerCandidates) || plannerCandidates.length === 0) {
    throw new TypeError('Harness Factory architecture proposal requires planner candidates');
  }
  const normalizedCandidates = arrayMap(plannerCandidates, (candidate) => {
    if (!isTrustedAgentPlannerCandidate(candidate)) {
      throw new TypeError(
        'Harness Factory architecture proposal requires trusted planner candidates'
      );
    }
    return candidate;
  });
  if (
    setSize(setFromArray(arrayMap(normalizedCandidates, ({ id }) => id)))
    !== normalizedCandidates.length
  ) {
    throw new TypeError(
      'Harness Factory architecture proposal planner candidate ids must be unique'
    );
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

function isValidArchiveLocator(record) {
  const keys = record !== null && typeof record === 'object'
    ? reflectOwnKeys(record)
    : [];
  return isPlainObject(record)
    && keys.length === 3
    && arrayEvery(
      ['hash', 'kind', 'sequence'],
      (key) => arrayIncludes(keys, key)
    )
    && typeof record.kind === 'string'
    && stringTrim(record.kind) !== ''
    && isSafeInteger(record.sequence)
    && record.sequence > 0
    && typeof record.hash === 'string'
    && stringTrim(record.hash) !== '';
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

function sameFactoryArchitectureProposalBatchAsReport(batch, report) {
  if (
    batch.factoryId !== report.factoryId
    || batch.goal !== report.goal
    || batch.proposalSource !== report.source
    || batch.proposalCount !== report.proposalCount
    || batch.novelProposalCount !== report.novelProposalCount
    || batch.repeatedProposalCount !== report.repeatedProposalCount
    || jsonStringify(batch.researchContext) !== jsonStringify(report.researchContext)
    || batch.proposals.length !== report.proposals.length
  ) {
    return false;
  }
  return arrayEvery(batch.proposals, (batchProposal, index) => {
    const reportProposal = report.proposals[index];
    return reportProposal !== undefined
      && batchProposal.id === reportProposal.id
      && batchProposal.plannerCandidateId === reportProposal.plannerCandidateId
      && batchProposal.architectureFingerprint === reportProposal.architectureFingerprint
      && batchProposal.novel === reportProposal.novel
      && batchProposal.repeated === reportProposal.repeated
      && batchProposal.status === reportProposal.status
      && batchProposal.historicalMatchCount === reportProposal.historicalMatchCount
      && batchProposal.batchDuplicate === reportProposal.batchDuplicate
      && jsonStringify(batchProposal.policy) === jsonStringify(reportProposal.policy)
      && jsonStringify(batchProposal.components) === jsonStringify(reportProposal.components);
  });
}

function agentArchitectureProposalReportFromArchivedFactoryReport(
  factory,
  report,
  ledger
) {
  if (
    !isTrustedHarnessFactoryArchitectureProposalReport(report)
    || weakMapGet(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_FACTORIES, report)
      !== factory
    || report.archived !== true
    || report.archive === null
  ) {
    throw new TypeError(
      'Harness Factory archived-proposal manufacture requires an exact archived report from this factory'
    );
  }
  const batch = arrayFind(
    ledger.restoreHarnessFactoryArchitectureProposals(),
    (candidate) => sameArchiveLocator(candidate.archive, report.archive)
  );
  if (
    batch === undefined
    || batch.factoryId !== factory.factoryId
    || !sameFactoryArchitectureProposalBatchAsReport(batch, report)
  ) {
    throw new Error(
      'Harness Factory archived-proposal manufacture requires a matching current archive'
    );
  }
  const proposalReport = new AgentArchitectureProposalReport({
    goal: report.goal,
    proposals: arrayMap(
      report.proposals,
      (proposal) => new AgentArchitectureProposal({
        id: proposal.id,
        plannerCandidateId: proposal.plannerCandidateId,
        policy: proposal.policy,
        components: proposal.components
      })
    ),
    source: report.source,
    researchContext: report.researchContext
  });
  return objectFreeze({
    archive: archiveLocator(batch.archive),
    report: proposalReport
  });
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

function factoryImprovementRejectionSummary({
  factory,
  baselineRecord,
  baselineDiscovery,
  currentDiscovery,
  currentBenchmarkIdentity,
  improvement
}) {
  const baselineArchitecture = factoryArchitectureForDiscovery(baselineDiscovery);
  const currentArchitecture = factoryArchitectureForDiscovery(currentDiscovery);
  const baselineFitness = factoryFitnessForDiscovery(baselineDiscovery);
  const currentFitness = factoryFitnessForDiscovery(currentDiscovery);
  return objectFreeze({
    attemptedGeneration: baselineDiscovery.factory.generation + 1,
    authorityTransferred: false,
    baseline: objectFreeze({
      archive: archiveLocator(baselineRecord),
      architectureFingerprint: baselineArchitecture.architectureFingerprint,
      architectureId: baselineArchitecture.architectureId,
      fitness: baselineFitness,
      generation: baselineDiscovery.factory.generation
    }),
    benchmark: objectFreeze({
      budgets: objectFreeze({ ...currentBenchmarkIdentity.budgets }),
      caseCount: currentBenchmarkIdentity.caseCount,
      fingerprint: currentBenchmarkIdentity.fingerprint
    }),
    candidate: objectFreeze({
      adopted: currentDiscovery.adopted,
      architectureFingerprint: currentArchitecture.architectureFingerprint,
      architectureId: currentArchitecture.architectureId,
      fitness: currentFitness
    }),
    dataOnly: true,
    factoryId: factory.factoryId,
    improvement: objectFreeze({
      accepted: false,
      benchmarkIdentityStable: improvement.benchmarkIdentityStable,
      benchmarkStable: improvement.benchmarkStable,
      deltas: objectFreeze({ ...improvement.deltas }),
      nonRegressing: improvement.nonRegressing,
      strictlyImproved: improvement.strictlyImproved
    }),
    reasons: objectFreeze(arraySlice(improvement.reasons))
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
    proposalArchive: metadata.proposalArchive ?? null,
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
  [HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION]: 460,
  [HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY]: 455,
  [HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION]: 450,
  [HARNESS_FACTORY_RESEARCH_TARGETS.RECOVER_FAILED_HOLDOUT]: 400,
  [HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT]: 300,
  [HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_SKEPTIC_WEAKNESS]: 220,
  [HARNESS_FACTORY_RESEARCH_TARGETS.TEST_TRANSFER_GAP]: 210,
  [HARNESS_FACTORY_RESEARCH_TARGETS.IMPROVE_LATEST_GENERATION]: 200
});

const HARNESS_FACTORY_RESEARCH_PLAN_BLUEPRINTS = objectFreeze({
  [HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION]: objectFreeze({
    bridge: HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.BENCHMARK_FRONTIER_VALIDATION,
    executionMethod: 'factory.executeBenchmarkFrontierValidationResearch',
    requiredInputs: objectFreeze([
      'the exact current frontier agenda item',
      'the matching archived benchmark campaign',
      'one fresh candidate reconstruction for every missing frontier point',
      'the original benchmark cases and a disjoint holdout suite',
      'holdout budgets and archive=true'
    ]),
    expectedEvidence: objectFreeze([
      'one fresh validation for every missing frontier point',
      'hash-chained child validation archives',
      'post-experiment frontier coverage and pass/fail status'
    ])
  }),
  [HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY]: objectFreeze({
    bridge: HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FRONTIER_STABILITY,
    executionMethod: 'factory.executeBenchmarkFrontierValidationStabilityResearch',
    requiredInputs: objectFreeze([
      'the exact current instability agenda item',
      'the latest matching archived benchmark campaign',
      'one fresh candidate reconstruction for every variable frontier point',
      'the original benchmark cases and a disjoint holdout suite',
      'holdout budgets and archive=true'
    ]),
    expectedEvidence: objectFreeze([
      'one fresh validation for every diagnosed variable point',
      'hash-chained pass/fail validation archives',
      'updated repeated-frontier stability with remaining variance or recovery'
    ])
  }),
  [HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_VALIDATION]: objectFreeze({
    bridge: HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.BENCHMARK_VALIDATION,
    executionMethod: 'factory.executeBenchmarkValidationResearch',
    requiredInputs: objectFreeze([
      'the exact current benchmark-validation agenda item',
      'the matching archived benchmark campaign',
      'a fresh candidate reconstruction for the cited candidate and level',
      'the original benchmark cases and a disjoint holdout suite',
      'holdout budgets and archive=true'
    ]),
    expectedEvidence: objectFreeze([
      'a fresh benchmark-point replay',
      'independent disjoint holdout evidence',
      'a hash-chained pass/fail validation archive'
    ])
  }),
  [HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_SKEPTIC_WEAKNESS]: objectFreeze({
    bridge: HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.OPERATOR_EXPERIMENT,
    executionMethod: 'operator-supplied factory.manufacture',
    requiredInputs: objectFreeze([
      'fresh planner candidates and policies',
      'finite adversarial cases aimed at the recorded weakness',
      'production, research, and skeptic budgets',
      'archive=true'
    ]),
    expectedEvidence: objectFreeze([
      'fresh adversarial weakness counts',
      'independent replay and proof status',
      'a new factory generation comparison'
    ])
  }),
  [HARNESS_FACTORY_RESEARCH_TARGETS.RECOVER_FAILED_HOLDOUT]: objectFreeze({
    bridge: HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FACTORY_RECOMMENDATION,
    executionMethod: 'factory.executeRecommendation',
    requiredInputs: objectFreeze([
      'the exact current factory recommendation',
      'fresh planner candidates and policies',
      'the benchmark cases plus a disjoint holdout suite',
      'production, research, skeptic, and holdout budgets',
      'archive=true'
    ]),
    expectedEvidence: objectFreeze([
      'fresh strict-improvement evidence against the failed baseline',
      'fresh independent holdout recovery evidence',
      'an adopted or rejected archived generation'
    ])
  }),
  [HARNESS_FACTORY_RESEARCH_TARGETS.TEST_TRANSFER_GAP]: objectFreeze({
    bridge: HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.OPERATOR_EXPERIMENT,
    executionMethod: 'operator-supplied factory.manufacture',
    requiredInputs: objectFreeze([
      'fresh planner candidates and policies',
      'finite transfer cases that exercise the recorded gap',
      'production, research, and skeptic budgets',
      'archive=true'
    ]),
    expectedEvidence: objectFreeze([
      'fresh production-versus-transfer comparison',
      'independent replay and proof status',
      'a new factory generation comparison'
    ])
  }),
  [HARNESS_FACTORY_RESEARCH_TARGETS.VALIDATE_UNSEEN_HOLDOUT]: objectFreeze({
    bridge: HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.HOLDOUT_VALIDATION,
    executionMethod: 'factory.validateRecommendation + factory.archiveValidation',
    requiredInputs: objectFreeze([
      'the exact current factory recommendation',
      'a fresh candidate reconstruction matching the archived architecture',
      'a disjoint unseen holdout suite',
      'holdout budgets'
    ]),
    expectedEvidence: objectFreeze([
      'fresh complete independent holdout evidence',
      'a hash-chained validation archive',
      'an updated advisory recommendation without creating a generation'
    ])
  }),
  [HARNESS_FACTORY_RESEARCH_TARGETS.IMPROVE_LATEST_GENERATION]: objectFreeze({
    bridge: HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FACTORY_RECOMMENDATION,
    executionMethod: 'factory.executeRecommendation',
    requiredInputs: objectFreeze([
      'the exact current factory recommendation',
      'fresh planner candidates and policies',
      'the same benchmark cases and compatible budgets',
      'archive=true'
    ]),
    expectedEvidence: objectFreeze([
      'fresh strict-improvement evidence against the selected baseline',
      'independent replay and proof status',
      'an adopted or rejected archived generation'
    ])
  })
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

function factoryBenchmarkFrontierValidationResearchAgendaItem({
  factory,
  score,
  reason
}) {
  const missingPoints = objectFreeze(arrayMap(
    score.missingPoints,
    ({ candidateId, levelId }) => objectFreeze({ candidateId, levelId })
  ));
  const frontierValidation = objectFreeze({
    campaignArchive: score.campaignArchive,
    frontierCount: score.frontierCount,
    validationCount: score.validationCount,
    coveredCount: score.coveredCount,
    frontierCoverageRate: score.frontierCoverageRate,
    missingPoints,
    duplicateValidationCount: score.duplicateValidationCount,
    passedCount: score.passedCount,
    failedCount: score.failedCount,
    passRate: score.passRate,
    complete: score.complete,
    reproducible: score.reproducible,
    independent: score.independent,
    status: score.status,
    firstValidationArchive: score.firstValidationArchive,
    latestValidationArchive: score.latestValidationArchive,
    dataOnly: true,
    authorityTransferred: false
  });
  const benchmark = objectFreeze({
    campaignArchive: score.campaignArchive,
    frontierCount: score.frontierCount,
    coveredCount: score.coveredCount,
    missingPoints
  });
  return objectFreeze({
    id: `harness-factory-research:${HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION}:${score.campaignArchive.sequence}`,
    factoryId: factory.factoryId,
    target: HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION,
    priority: HARNESS_FACTORY_RESEARCH_TARGET_PRIORITIES[
      HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
    ],
    generation: null,
    archive: score.latestValidationArchive,
    validationArchive: score.latestValidationArchive,
    benchmark,
    frontierValidation,
    holdoutStatus: score.status,
    fitness: objectFreeze({
      frontierCoverageRate: score.frontierCoverageRate,
      passRate: score.passRate
    }),
    reason: requireNonEmptyString(
      reason,
      'Harness Factory frontier validation research agenda reason'
    ),
    dataOnly: true,
    authorityTransferred: false
  });
}

function isValidHarnessFactoryBenchmarkFrontierValidationResearchAgendaItem(item, factory) {
  const benchmark = item?.benchmark;
  const detail = item?.frontierValidation;
  const missingPoints = detail?.missingPoints;
  const missingPointKeys = arrayIsArray(missingPoints)
    ? arrayMap(
      missingPoints,
      (point) => `${point?.candidateId}\u0000${point?.levelId}`
    )
    : [];
  const expectedStatus = detail?.coveredCount < detail?.frontierCount
    ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
    : detail?.passedCount === detail?.coveredCount
      && detail?.complete === true
      && detail?.reproducible === true
      && detail?.independent === true
      ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
      : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED;
  const validLocator = (locator, kind, minimumSequence = 0) => isPlainObject(locator)
    && reflectOwnKeys(locator).length === 3
    && locator.kind === kind
    && isSafeInteger(locator.sequence)
    && locator.sequence > minimumSequence
    && typeof locator.hash === 'string'
    && stringTrim(locator.hash) !== '';
  const forbiddenKeys = [
    'candidate',
    'candidates',
    'campaign',
    'holdout',
    'runner',
    'actionReport',
    'validations'
  ];
  return isPlainObject(item)
    && item.factoryId === factory.factoryId
    && item.target === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
    && item.priority === HARNESS_FACTORY_RESEARCH_TARGET_PRIORITIES[
      HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
    ]
    && item.generation === null
    && validLocator(item.archive, 'harness-factory-benchmark-validation')
    && sameArchiveLocator(item.archive, item.validationArchive)
    && isPlainObject(benchmark)
    && sameArchiveLocator(benchmark.campaignArchive, detail?.campaignArchive)
    && benchmark.frontierCount === detail?.frontierCount
    && benchmark.coveredCount === detail?.coveredCount
    && jsonStringify(benchmark.missingPoints) === jsonStringify(missingPoints)
    && isPlainObject(detail)
    && validLocator(
      detail.campaignArchive,
      'harness-factory-benchmark-campaign'
    )
    && isSafeInteger(detail.frontierCount)
    && detail.frontierCount > 0
    && isSafeInteger(detail.validationCount)
    && detail.validationCount > 0
    && isSafeInteger(detail.coveredCount)
    && detail.coveredCount > 0
    && detail.coveredCount <= detail.frontierCount
    && isFiniteNumber(detail.frontierCoverageRate)
    && detail.frontierCoverageRate >= 0
    && detail.frontierCoverageRate <= 1
    && detail.frontierCoverageRate === detail.coveredCount / detail.frontierCount
    && arrayIsArray(missingPoints)
    && missingPoints.length === detail.frontierCount - detail.coveredCount
    && setSize(setFromArray(missingPointKeys)) === missingPointKeys.length
    && arrayEvery(
      missingPoints,
      (point) => isPlainObject(point)
        && reflectOwnKeys(point).length === 2
        && typeof point.candidateId === 'string'
        && stringTrim(point.candidateId) !== ''
        && typeof point.levelId === 'string'
        && stringTrim(point.levelId) !== ''
    )
    && isSafeInteger(detail.duplicateValidationCount)
    && detail.duplicateValidationCount >= 0
    && detail.duplicateValidationCount
      === detail.validationCount - detail.coveredCount
    && isSafeInteger(detail.passedCount)
    && detail.passedCount >= 0
    && detail.passedCount <= detail.coveredCount
    && isSafeInteger(detail.failedCount)
    && detail.failedCount >= 0
    && detail.failedCount <= detail.coveredCount
    && detail.passedCount + detail.failedCount === detail.coveredCount
    && isFiniteNumber(detail.passRate)
    && detail.passRate >= 0
    && detail.passRate <= 1
    && detail.passRate === detail.passedCount / detail.coveredCount
    && typeof detail.complete === 'boolean'
    && typeof detail.reproducible === 'boolean'
    && typeof detail.independent === 'boolean'
    && (!detail.complete || detail.coveredCount === detail.frontierCount)
    && (!detail.reproducible || detail.complete)
    && (!detail.independent || detail.complete)
    && detail.status === expectedStatus
    && validLocator(
      detail.firstValidationArchive,
      'harness-factory-benchmark-validation',
      detail.campaignArchive.sequence
    )
    && validLocator(
      detail.latestValidationArchive,
      'harness-factory-benchmark-validation',
      detail.firstValidationArchive.sequence - 1
    )
    && detail.latestValidationArchive.sequence >= detail.firstValidationArchive.sequence
    && item.holdoutStatus === detail.status
    && isPlainObject(item.fitness)
    && reflectOwnKeys(item.fitness).length === 2
    && item.fitness.frontierCoverageRate === detail.frontierCoverageRate
    && item.fitness.passRate === detail.passRate
    && typeof item.reason === 'string'
    && stringTrim(item.reason) !== ''
    && item.dataOnly === true
    && item.authorityTransferred === false
    && detail.dataOnly === true
    && detail.authorityTransferred === false
    && !arraySome(
      forbiddenKeys,
      (key) => arrayIncludes(reflectOwnKeys(item), key)
        || arrayIncludes(reflectOwnKeys(benchmark), key)
        || arrayIncludes(reflectOwnKeys(detail), key)
        || arrayIncludes(reflectOwnKeys(item.fitness), key)
        || arraySome(
          missingPoints,
          (point) => arrayIncludes(reflectOwnKeys(point), key)
        )
    );
}

function factoryBenchmarkFrontierValidationStabilityResearchAgendaItem({
  factory,
  score,
  reason
}) {
  const variablePoints = objectFreeze(arrayMap(
    arrayFilter(
      score.pointScores,
      ({ stabilityStatus }) => stabilityStatus
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
    ),
    (pointScore) => objectFreeze({
      candidateId: pointScore.candidateId,
      levelId: pointScore.levelId,
      campaignCount: pointScore.campaignCount,
      validationCount: pointScore.validationCount,
      passedCount: pointScore.passedCount,
      failedCount: pointScore.failedCount,
      incompleteCount: pointScore.incompleteCount,
      passRate: pointScore.passRate,
      completeCount: pointScore.completeCount,
      reproducibleCount: pointScore.reproducibleCount,
      independentCount: pointScore.independentCount,
      stable: pointScore.stable,
      stabilityStatus: pointScore.stabilityStatus,
      campaignStatuses: objectFreeze(arrayMap(
        pointScore.campaignStatuses,
        (campaignStatus) => objectFreeze({ ...campaignStatus })
      )),
      dataOnly: true,
      authorityTransferred: false
    })
  ));
  const campaignStatuses = objectFreeze(arrayMap(
    score.campaignStatuses,
    (campaignStatus) => objectFreeze({ ...campaignStatus })
  ));
  const frontierStability = objectFreeze({
    frontierFingerprint: score.frontierFingerprint,
    frontierCount: score.frontierCount,
    validationCount: score.validationCount,
    campaignCount: score.campaignCount,
    passedCount: score.passedCount,
    failedCount: score.failedCount,
    incompleteCount: score.incompleteCount,
    passRate: score.passRate,
    completeCount: score.completeCount,
    reproducibleCount: score.reproducibleCount,
    independentCount: score.independentCount,
    stable: score.stable,
    stabilityStatus: score.stabilityStatus,
    stablePointCount: score.stablePointCount,
    unstablePointCount: score.unstablePointCount,
    insufficientPointCount: score.insufficientPointCount,
    variablePoints,
    firstCampaignArchive: score.firstCampaignArchive,
    latestCampaignArchive: score.latestCampaignArchive,
    firstValidationArchive: score.firstValidationArchive,
    latestValidationArchive: score.latestValidationArchive,
    campaignStatuses,
    dataOnly: true,
    authorityTransferred: false
  });
  const benchmark = objectFreeze({
    frontierFingerprint: score.frontierFingerprint,
    frontierCount: score.frontierCount,
    campaignCount: score.campaignCount,
    firstCampaignArchive: score.firstCampaignArchive,
    latestCampaignArchive: score.latestCampaignArchive
  });
  return objectFreeze({
    id: `harness-factory-research:${HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY}:${score.frontierFingerprint}`,
    factoryId: factory.factoryId,
    target: HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY,
    priority: HARNESS_FACTORY_RESEARCH_TARGET_PRIORITIES[
      HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
    ],
    generation: null,
    archive: score.latestCampaignArchive,
    validationArchive: score.latestValidationArchive,
    benchmark,
    frontierStability,
    holdoutStatus: score.stabilityStatus,
    fitness: objectFreeze({
      passRate: score.passRate,
      completeRate: score.completeCount / score.campaignCount,
      reproducibleRate: score.reproducibleCount / score.campaignCount,
      independentRate: score.independentCount / score.campaignCount
    }),
    reason: requireNonEmptyString(
      reason,
      'Harness Factory frontier stability research agenda reason'
    ),
    dataOnly: true,
    authorityTransferred: false
  });
}

function isValidHarnessFactoryBenchmarkFrontierValidationStabilityResearchAgendaItem(
  item,
  factory
) {
  const benchmark = item?.benchmark;
  const detail = item?.frontierStability;
  const campaignStatuses = detail?.campaignStatuses;
  const validArchive = (archive, kind) => isPlainObject(archive)
    && reflectOwnKeys(archive).length === 3
    && archive.kind === kind
    && isSafeInteger(archive.sequence)
    && archive.sequence > 0
    && typeof archive.hash === 'string'
    && stringTrim(archive.hash) !== '';
  const expectedStable = detail?.campaignCount >= 2
    && detail?.passedCount === detail?.campaignCount
    && detail?.completeCount === detail?.campaignCount
    && detail?.reproducibleCount === detail?.campaignCount
    && detail?.independentCount === detail?.campaignCount;
  const expectedStatus = detail?.campaignCount < 2
    ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
    : expectedStable
      ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
      : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE;
  const isValidCampaignStatus = (campaignStatus) => {
    const expectedCampaignStatus = campaignStatus?.coveredCount
        < campaignStatus?.frontierCount
      ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
      : campaignStatus?.passedCount === campaignStatus?.coveredCount
          && campaignStatus?.complete === true
          && campaignStatus?.reproducible === true
          && campaignStatus?.independent === true
        ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
        : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED;
    return isPlainObject(campaignStatus)
      && validArchive(
        campaignStatus.campaignArchive,
        'harness-factory-benchmark-campaign'
      )
      && isSafeInteger(campaignStatus.frontierCount)
      && campaignStatus.frontierCount > 0
      && isSafeInteger(campaignStatus.validationCount)
      && campaignStatus.validationCount > 0
      && isSafeInteger(campaignStatus.coveredCount)
      && campaignStatus.coveredCount > 0
      && campaignStatus.coveredCount <= campaignStatus.frontierCount
      && campaignStatus.validationCount >= campaignStatus.coveredCount
      && isFiniteNumber(campaignStatus.frontierCoverageRate)
      && campaignStatus.frontierCoverageRate >= 0
      && campaignStatus.frontierCoverageRate <= 1
      && campaignStatus.frontierCoverageRate
        === campaignStatus.coveredCount / campaignStatus.frontierCount
      && isSafeInteger(campaignStatus.duplicateValidationCount)
      && campaignStatus.duplicateValidationCount >= 0
      && campaignStatus.duplicateValidationCount
        === campaignStatus.validationCount - campaignStatus.coveredCount
      && isSafeInteger(campaignStatus.passedCount)
      && campaignStatus.passedCount >= 0
      && campaignStatus.passedCount <= campaignStatus.coveredCount
      && isSafeInteger(campaignStatus.failedCount)
      && campaignStatus.failedCount >= 0
      && campaignStatus.failedCount <= campaignStatus.coveredCount
      && campaignStatus.passedCount + campaignStatus.failedCount
        === campaignStatus.coveredCount
      && isFiniteNumber(campaignStatus.passRate)
      && campaignStatus.passRate >= 0
      && campaignStatus.passRate <= 1
      && campaignStatus.passRate
        === campaignStatus.passedCount / campaignStatus.coveredCount
      && typeof campaignStatus.complete === 'boolean'
      && typeof campaignStatus.reproducible === 'boolean'
      && typeof campaignStatus.independent === 'boolean'
      && (!campaignStatus.complete
        || campaignStatus.coveredCount === campaignStatus.frontierCount)
      && (!campaignStatus.reproducible || campaignStatus.complete)
      && (!campaignStatus.independent || campaignStatus.complete)
      && campaignStatus.status === expectedCampaignStatus
      && validArchive(
        campaignStatus.firstValidationArchive,
        'harness-factory-benchmark-validation'
      )
      && campaignStatus.firstValidationArchive.sequence
        > campaignStatus.campaignArchive.sequence
      && validArchive(
        campaignStatus.latestValidationArchive,
        'harness-factory-benchmark-validation'
      )
      && campaignStatus.latestValidationArchive.sequence
        >= campaignStatus.firstValidationArchive.sequence
      && campaignStatus.dataOnly === true
      && campaignStatus.authorityTransferred === false
      && !arraySome(
        [
          'candidate',
          'candidates',
          'campaign',
          'holdout',
          'runner',
          'actionReport',
          'validations'
        ],
        (key) => arrayIncludes(reflectOwnKeys(campaignStatus), key)
      );
  };
  const campaignArchives = arrayIsArray(campaignStatuses)
    ? arrayMap(
      campaignStatuses,
      ({ campaignArchive }) => `${campaignArchive?.sequence}\u0000${campaignArchive?.hash}`
    )
    : [];
  const countedValidationCount = arrayIsArray(campaignStatuses)
    ? arrayReduce(
      campaignStatuses,
      (total, campaignStatus) => total + (campaignStatus?.validationCount ?? 0),
      0
    )
    : 0;
  const countedPassedCount = arrayIsArray(campaignStatuses)
    ? arrayFilter(
      campaignStatuses,
      ({ status }) => status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
    ).length
    : 0;
  const countedFailedCount = arrayIsArray(campaignStatuses)
    ? arrayFilter(
      campaignStatuses,
      ({ status }) => status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED
    ).length
    : 0;
  const countedIncompleteCount = arrayIsArray(campaignStatuses)
    ? arrayFilter(
      campaignStatuses,
      ({ status }) => status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
    ).length
    : 0;
  const countedCompleteCount = arrayIsArray(campaignStatuses)
    ? arrayFilter(campaignStatuses, ({ complete }) => complete).length
    : 0;
  const countedReproducibleCount = arrayIsArray(campaignStatuses)
    ? arrayFilter(campaignStatuses, ({ reproducible }) => reproducible).length
    : 0;
  const countedIndependentCount = arrayIsArray(campaignStatuses)
    ? arrayFilter(campaignStatuses, ({ independent }) => independent).length
    : 0;
  const variablePoints = detail?.variablePoints;
  const variablePointKeys = arrayIsArray(variablePoints)
    ? arrayMap(
      variablePoints,
      ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
    )
    : [];
  const isValidVariablePoint = (point) => {
    const expectedPointStable = point?.campaignCount >= 2
      && point?.passedCount === point?.campaignCount
      && point?.completeCount === point?.campaignCount
      && point?.reproducibleCount === point?.campaignCount
      && point?.independentCount === point?.campaignCount;
    const expectedPointStatus = point?.campaignCount < 2
      ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
      : expectedPointStable
        ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
        : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE;
    const pointCampaignStatuses = point?.campaignStatuses;
    const pointCampaignArchives = arrayIsArray(pointCampaignStatuses)
      ? arrayMap(
        pointCampaignStatuses,
        ({ campaignArchive }) => `${campaignArchive?.sequence}\u0000${campaignArchive?.hash}`
      )
      : [];
    const pointPassedCount = arrayIsArray(pointCampaignStatuses)
      ? arrayFilter(
        pointCampaignStatuses,
        ({ status }) => status
          === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
      ).length
      : 0;
    const pointFailedCount = arrayIsArray(pointCampaignStatuses)
      ? arrayFilter(
        pointCampaignStatuses,
        ({ status }) => status
          === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED
      ).length
      : 0;
    const pointIncompleteCount = arrayIsArray(pointCampaignStatuses)
      ? arrayFilter(
        pointCampaignStatuses,
        ({ status }) => status
          === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
      ).length
      : 0;
    const pointCompleteCount = arrayIsArray(pointCampaignStatuses)
      ? arrayFilter(pointCampaignStatuses, ({ complete }) => complete).length
      : 0;
    const pointReproducibleCount = arrayIsArray(pointCampaignStatuses)
      ? arrayFilter(
        pointCampaignStatuses,
        ({ reproducible }) => reproducible
      ).length
      : 0;
    const pointIndependentCount = arrayIsArray(pointCampaignStatuses)
      ? arrayFilter(
        pointCampaignStatuses,
        ({ independent }) => independent
      ).length
      : 0;
    const pointValidationArchiveCount = arrayIsArray(pointCampaignStatuses)
      ? arrayFilter(
        pointCampaignStatuses,
        ({ validationArchive }) => validationArchive !== null
      ).length
      : 0;
    const isValidPointCampaignStatus = (campaignStatus) => {
      const expectedStatus = campaignStatus?.validationArchive === null
        ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
        : campaignStatus?.passed === true
            && campaignStatus?.complete === true
            && campaignStatus?.reproducible === true
            && campaignStatus?.independent === true
          ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
          : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED;
      const validationArchive = campaignStatus?.validationArchive;
      return isPlainObject(campaignStatus)
        && reflectOwnKeys(campaignStatus).length === 9
        && validArchive(
          campaignStatus.campaignArchive,
          'harness-factory-benchmark-campaign'
        )
        && (
          validationArchive === null
          || validArchive(
            validationArchive,
            'harness-factory-benchmark-validation'
          )
        )
        && (
          validationArchive === null
          || validationArchive.sequence > campaignStatus.campaignArchive.sequence
        )
        && arrayIncludes(
          [
            HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED,
            HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE,
            HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
          ],
          campaignStatus.status
        )
        && typeof campaignStatus.passed === 'boolean'
        && typeof campaignStatus.complete === 'boolean'
        && typeof campaignStatus.reproducible === 'boolean'
        && typeof campaignStatus.independent === 'boolean'
        && campaignStatus.status === expectedStatus
        && (
          campaignStatus.status
            === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
          ? validationArchive === null
          : validationArchive !== null
        )
        && campaignStatus.dataOnly === true
        && campaignStatus.authorityTransferred === false
        && !arraySome(
          [
            'candidate',
            'candidates',
            'campaign',
            'holdout',
            'runner',
            'actionReport',
            'validations'
          ],
          (key) => arrayIncludes(reflectOwnKeys(campaignStatus), key)
        );
    };
    return isPlainObject(point)
      && typeof point.candidateId === 'string'
      && stringTrim(point.candidateId) !== ''
      && typeof point.levelId === 'string'
      && stringTrim(point.levelId) !== ''
      && isSafeInteger(point.campaignCount)
      && point.campaignCount === detail?.campaignCount
      && isSafeInteger(point.validationCount)
      && point.validationCount >= 0
      && isSafeInteger(point.passedCount)
      && point.passedCount >= 0
      && isSafeInteger(point.failedCount)
      && point.failedCount >= 0
      && isSafeInteger(point.incompleteCount)
      && point.incompleteCount >= 0
      && point.passedCount + point.failedCount + point.incompleteCount
        === point.campaignCount
      && isFiniteNumber(point.passRate)
      && point.passRate >= 0
      && point.passRate <= 1
      && point.passRate === point.passedCount / point.campaignCount
      && isSafeInteger(point.completeCount)
      && point.completeCount >= 0
      && point.completeCount <= point.campaignCount
      && isSafeInteger(point.reproducibleCount)
      && point.reproducibleCount >= 0
      && point.reproducibleCount <= point.campaignCount
      && isSafeInteger(point.independentCount)
      && point.independentCount >= 0
      && point.independentCount <= point.campaignCount
      && point.stable === expectedPointStable
      && point.stable === false
      && point.stabilityStatus === expectedPointStatus
      && point.stabilityStatus
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
      && arrayIsArray(pointCampaignStatuses)
      && pointCampaignStatuses.length === point.campaignCount
      && setSize(setFromArray(pointCampaignArchives)) === pointCampaignArchives.length
      && arrayEvery(pointCampaignStatuses, isValidPointCampaignStatus)
      && arrayEvery(
        pointCampaignStatuses,
        (campaignStatus, index) => index === 0
          || campaignStatus.campaignArchive.sequence
            > pointCampaignStatuses[index - 1].campaignArchive.sequence
      )
      && pointCampaignStatuses.length === campaignStatuses.length
      && arrayEvery(
        pointCampaignStatuses,
        (campaignStatus, index) => sameArchiveLocator(
          campaignStatus.campaignArchive,
          campaignStatuses[index].campaignArchive
        )
      )
      && pointValidationArchiveCount <= point.validationCount
      && pointPassedCount === point.passedCount
      && pointFailedCount === point.failedCount
      && pointIncompleteCount === point.incompleteCount
      && pointCompleteCount === point.completeCount
      && pointReproducibleCount === point.reproducibleCount
      && pointIndependentCount === point.independentCount
      && point.dataOnly === true
      && point.authorityTransferred === false
      && !arraySome(
        [
          'candidate',
          'candidates',
          'campaign',
          'holdout',
          'runner',
          'actionReport',
          'validations'
        ],
        (key) => arrayIncludes(reflectOwnKeys(point), key)
      );
  };
  const countedVariablePointCount = arrayIsArray(variablePoints)
    ? variablePoints.length
    : 0;
  const forbiddenKeys = [
    'candidate',
    'candidates',
    'campaign',
    'holdout',
    'runner',
    'actionReport',
    'validations'
  ];
  return isPlainObject(item)
    && item.factoryId === factory.factoryId
    && item.id === `harness-factory-research:${HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY}:${detail?.frontierFingerprint}`
    && item.target === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
    && item.priority === HARNESS_FACTORY_RESEARCH_TARGET_PRIORITIES[
      HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
    ]
    && item.generation === null
    && validArchive(item.archive, 'harness-factory-benchmark-campaign')
    && validArchive(item.validationArchive, 'harness-factory-benchmark-validation')
    && isPlainObject(benchmark)
    && reflectOwnKeys(benchmark).length === 5
    && typeof benchmark.frontierFingerprint === 'string'
    && stringTrim(benchmark.frontierFingerprint) !== ''
    && benchmark.frontierFingerprint === detail?.frontierFingerprint
    && benchmark.frontierCount === detail?.frontierCount
    && benchmark.campaignCount === detail?.campaignCount
    && sameArchiveLocator(benchmark.firstCampaignArchive, detail?.firstCampaignArchive)
    && sameArchiveLocator(benchmark.latestCampaignArchive, detail?.latestCampaignArchive)
    && isPlainObject(detail)
    && typeof detail.frontierFingerprint === 'string'
    && stringTrim(detail.frontierFingerprint) !== ''
    && isSafeInteger(detail.frontierCount)
    && detail.frontierCount > 0
    && isSafeInteger(detail.validationCount)
    && detail.validationCount > 0
    && isSafeInteger(detail.campaignCount)
    && detail.campaignCount >= 2
    && isSafeInteger(detail.passedCount)
    && detail.passedCount >= 0
    && isSafeInteger(detail.failedCount)
    && detail.failedCount >= 0
    && isSafeInteger(detail.incompleteCount)
    && detail.incompleteCount >= 0
    && detail.passedCount + detail.failedCount + detail.incompleteCount
      === detail.campaignCount
    && isFiniteNumber(detail.passRate)
    && detail.passRate >= 0
    && detail.passRate <= 1
    && detail.passRate === detail.passedCount / detail.campaignCount
    && isSafeInteger(detail.completeCount)
    && detail.completeCount >= 0
    && detail.completeCount <= detail.campaignCount
    && isSafeInteger(detail.reproducibleCount)
    && detail.reproducibleCount >= 0
    && detail.reproducibleCount <= detail.campaignCount
    && isSafeInteger(detail.independentCount)
    && detail.independentCount >= 0
    && detail.independentCount <= detail.campaignCount
    && detail.stable === expectedStable
    && detail.stable === false
    && detail.stabilityStatus === expectedStatus
    && detail.stabilityStatus
      === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
    && validArchive(detail.firstCampaignArchive, 'harness-factory-benchmark-campaign')
    && validArchive(detail.latestCampaignArchive, 'harness-factory-benchmark-campaign')
    && detail.latestCampaignArchive.sequence >= detail.firstCampaignArchive.sequence
    && validArchive(detail.firstValidationArchive, 'harness-factory-benchmark-validation')
    && validArchive(detail.latestValidationArchive, 'harness-factory-benchmark-validation')
    && detail.latestValidationArchive.sequence >= detail.firstValidationArchive.sequence
    && sameArchiveLocator(item.archive, detail.latestCampaignArchive)
    && sameArchiveLocator(item.validationArchive, detail.latestValidationArchive)
    && arrayIsArray(campaignStatuses)
    && campaignStatuses.length === detail.campaignCount
    && setSize(setFromArray(campaignArchives)) === campaignArchives.length
    && arrayEvery(campaignStatuses, isValidCampaignStatus)
    && arrayEvery(
      campaignStatuses,
      (campaignStatus, index) => index === 0
        || campaignStatus.campaignArchive.sequence
          > campaignStatuses[index - 1].campaignArchive.sequence
    )
    && campaignStatuses[0].campaignArchive.sequence
      === detail.firstCampaignArchive.sequence
    && campaignStatuses[campaignStatuses.length - 1].campaignArchive.sequence
      === detail.latestCampaignArchive.sequence
    && campaignStatuses[0].firstValidationArchive.sequence
      === detail.firstValidationArchive.sequence
    && campaignStatuses[campaignStatuses.length - 1].latestValidationArchive.sequence
      === detail.latestValidationArchive.sequence
    && countedValidationCount === detail.validationCount
    && countedPassedCount === detail.passedCount
    && countedFailedCount === detail.failedCount
    && countedIncompleteCount === detail.incompleteCount
    && countedCompleteCount === detail.completeCount
    && countedReproducibleCount === detail.reproducibleCount
    && countedIndependentCount === detail.independentCount
    && isSafeInteger(detail.stablePointCount)
    && detail.stablePointCount >= 0
    && detail.stablePointCount <= detail.frontierCount
    && isSafeInteger(detail.unstablePointCount)
    && detail.unstablePointCount > 0
    && detail.unstablePointCount <= detail.frontierCount
    && isSafeInteger(detail.insufficientPointCount)
    && detail.insufficientPointCount >= 0
    && detail.insufficientPointCount <= detail.frontierCount
    && detail.stablePointCount
      + detail.unstablePointCount
      + detail.insufficientPointCount
      === detail.frontierCount
    && arrayIsArray(variablePoints)
    && countedVariablePointCount === detail.unstablePointCount
    && setSize(setFromArray(variablePointKeys)) === variablePointKeys.length
    && arrayEvery(variablePoints, isValidVariablePoint)
    && arrayEvery(
      variablePoints,
      (point, index) => index === 0
        || stringLocaleCompare(
          `${variablePoints[index - 1].candidateId}\u0000${variablePoints[index - 1].levelId}`,
          `${point.candidateId}\u0000${point.levelId}`
        ) < 0
    )
    && isPlainObject(item.fitness)
    && reflectOwnKeys(item.fitness).length === 4
    && item.fitness.passRate === detail.passRate
    && item.fitness.completeRate === detail.completeCount / detail.campaignCount
    && item.fitness.reproducibleRate
      === detail.reproducibleCount / detail.campaignCount
    && item.fitness.independentRate
      === detail.independentCount / detail.campaignCount
    && item.holdoutStatus === detail.stabilityStatus
    && typeof item.reason === 'string'
    && stringTrim(item.reason) !== ''
    && item.dataOnly === true
    && item.authorityTransferred === false
    && detail.dataOnly === true
    && detail.authorityTransferred === false
    && !arraySome(
      forbiddenKeys,
      (key) => arrayIncludes(reflectOwnKeys(item), key)
        || arrayIncludes(reflectOwnKeys(benchmark), key)
        || arrayIncludes(reflectOwnKeys(detail), key)
        || arrayIncludes(reflectOwnKeys(item.fitness), key)
        || arraySome(
          campaignStatuses,
          (campaignStatus) => arrayIncludes(reflectOwnKeys(campaignStatus), key)
        )
    );
}

function factoryResearchAgendaFromHistory({
  factory,
  history,
  validations,
  benchmarkValidations = [],
  benchmarkFrontierValidationScorecard = null,
  benchmarkFrontierValidationStability = null,
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
  if (
    benchmarkFrontierValidationScorecard !== null
    && (
      !isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport(
        benchmarkFrontierValidationScorecard
      )
      || benchmarkFrontierValidationScorecard.factoryId !== factory.factoryId
    )
  ) {
    throw new TypeError(
      'Harness Factory research agenda requires verified frontier validation scorecard'
    );
  }
  if (
    benchmarkFrontierValidationStability !== null
    && (
      !isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityReport(
        benchmarkFrontierValidationStability
      )
      || benchmarkFrontierValidationStability.factoryId !== factory.factoryId
    )
  ) {
    throw new TypeError(
      'Harness Factory research agenda requires verified frontier validation stability'
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

  if (benchmarkFrontierValidationScorecard !== null) {
    arrayForEach(
      benchmarkFrontierValidationScorecard.batchScores,
      (score) => {
        if (
          score.status
            !== HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
        ) {
          return;
        }
        arrayPush(
          proposed,
          factoryBenchmarkFrontierValidationResearchAgendaItem({
            factory,
            score,
            reason: 'an incomplete frontier needs fresh validation for every missing point'
          })
        );
      }
    );
  }

  if (benchmarkFrontierValidationStability !== null) {
    arrayForEach(
      benchmarkFrontierValidationStability.frontierScores,
      (score) => {
        if (
          score.stabilityStatus
            !== HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
        ) {
          return;
        }
        arrayPush(
          proposed,
          factoryBenchmarkFrontierValidationStabilityResearchAgendaItem({
            factory,
            score,
            reason: 'repeated frontier validation is unstable and needs a targeted variance investigation'
          })
        );
      }
    );
  }

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

function factoryResearchPlanItem(factory, agendaItem) {
  const blueprint = HARNESS_FACTORY_RESEARCH_PLAN_BLUEPRINTS[agendaItem.target];
  if (blueprint === undefined) {
    throw new Error(
      `Harness Factory research target ${agendaItem.target} has no planning blueprint`
    );
  }
  return objectFreeze({
    id: `harness-factory-research-plan:${agendaItem.id}`,
    agendaItemId: agendaItem.id,
    factoryId: factory.factoryId,
    target: agendaItem.target,
    bridge: blueprint.bridge,
    executionMethod: blueprint.executionMethod,
    rank: agendaItem.rank,
    priority: agendaItem.priority,
    generation: agendaItem.generation,
    archive: agendaItem.archive,
    validationArchive: agendaItem.validationArchive,
    benchmark: agendaItem.benchmark,
    holdoutStatus: agendaItem.holdoutStatus,
    fitness: agendaItem.fitness,
    objective: agendaItem.reason,
    requiredInputs: objectFreeze(arraySlice(blueprint.requiredInputs)),
    expectedEvidence: objectFreeze(arraySlice(blueprint.expectedEvidence)),
    dataOnly: true,
    authorityTransferred: false
  });
}

function factoryResearchPlanFromAgenda({ factory, agenda }) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError('Harness Factory research plan requires an exact trusted factory');
  }
  if (
    !isTrustedHarnessFactoryResearchAgendaReport(agenda)
    || agenda.factoryId !== factory.factoryId
  ) {
    throw new TypeError('Harness Factory research plan requires a trusted agenda from this factory');
  }
  const plans = arrayMap(
    agenda.items,
    (agendaItem) => factoryResearchPlanItem(factory, agendaItem)
  );
  return new HarnessFactoryResearchPlanReport({
    factory,
    consideredGenerationCount: agenda.consideredGenerationCount,
    consideredValidationCount: agenda.consideredValidationCount,
    consideredTargetCount: agenda.consideredTargetCount,
    requestedItemCount: agenda.requestedItemCount,
    recommendationStatus: agenda.recommendationStatus,
    plans,
    truncated: agenda.truncated,
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

function requireTrustedBenchmarkCampaignFrontierPoints(points, campaign) {
  if (!arrayIsArray(points) || points.length === 0) {
    throw new TypeError(
      'Harness Factory benchmark frontier validation requires points'
    );
  }
  if (points.length !== campaign.frontier.length) {
    throw new Error(
      'Harness Factory benchmark frontier validation must cover every frontier point'
    );
  }
  const normalized = arrayMap(points, (point, index) => {
    requireDataObject(
      point,
      `Harness Factory benchmark frontier validation points[${index}]`,
      ['candidate', 'levelId']
    );
    if (!isTrustedAgentArchitectureCandidate(point.candidate)) {
      throw new TypeError(
        'Harness Factory benchmark frontier validation points require trusted candidates'
      );
    }
    if (
      weakSetHas(DISPOSED_ARCHITECTURE_CANDIDATES, point.candidate)
      || weakSetHas(PROTECTED_ADOPTED_CANDIDATES, point.candidate)
    ) {
      throw new TypeError(
        'Harness Factory benchmark frontier validation points require fresh unretired candidates'
      );
    }
    const levelId = requireNonEmptyString(
      point.levelId,
      `Harness Factory benchmark frontier validation points[${index}].levelId`
    );
    if (arrayFind(
      campaign.frontier,
      (frontierPoint) => frontierPoint.architectureId === point.candidate.id
        && frontierPoint.levelId === levelId
    ) === undefined) {
      throw new Error(
        'Harness Factory benchmark frontier validation point is not in the archived frontier'
      );
    }
    return objectFreeze({
      candidate: point.candidate,
      levelId
    });
  });
  const pointKeys = arrayMap(
    normalized,
    ({ candidate, levelId }) => `${candidate.id}\u0000${levelId}`
  );
  if (
    setSize(setFromArray(pointKeys)) !== pointKeys.length
    || arraySome(
      campaign.frontier,
      (frontierPoint) => !arrayIncludes(
        pointKeys,
        `${frontierPoint.architectureId}\u0000${frontierPoint.levelId}`
      )
    )
  ) {
    throw new Error(
      'Harness Factory benchmark frontier validation points must cover each frontier point once'
    );
  }
  return objectFreeze(arrayMap(
    campaign.frontier,
    (frontierPoint) => arrayFind(
      normalized,
      ({ candidate, levelId }) => candidate.id === frontierPoint.architectureId
        && levelId === frontierPoint.levelId
    )
  ));
}

function validateFactoryBenchmarkCampaignFrontier({
  factory,
  campaign,
  points,
  cases,
  holdoutCases,
  holdoutProductionBudget,
  holdoutResearchBudget,
  holdoutSkepticBudget
}) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError(
      'Harness Factory benchmark frontier validation requires an exact trusted factory'
    );
  }
  const ledger = verifiedLedgerSnapshot(factory.ledger);
  verifyArchivedBenchmarkCampaign({ factory, campaign, ledger });
  const normalizedPoints = requireTrustedBenchmarkCampaignFrontierPoints(
    points,
    campaign
  );
  const validations = arrayMap(
    normalizedPoints,
    ({ candidate, levelId }) => validateFactoryBenchmarkCampaign({
      factory,
      campaign,
      candidate,
      levelId,
      cases,
      holdoutCases,
      holdoutProductionBudget,
      holdoutResearchBudget,
      holdoutSkepticBudget
    })
  );
  return new HarnessFactoryBenchmarkFrontierValidationReport({
    factory,
    campaign,
    validations,
    token: FACTORY_TOKEN
  });
}

function requireTrustedBenchmarkFrontierValidationResearchPoints(
  points,
  target,
  campaign
) {
  const missingPoints = target.frontierValidation.missingPoints;
  if (!arrayIsArray(points) || points.length === 0) {
    throw new TypeError(
      'Harness Factory frontier validation research requires missing points'
    );
  }
  if (points.length !== missingPoints.length) {
    throw new Error(
      'Harness Factory frontier validation research points must cover exactly the target missing points'
    );
  }
  const normalized = arrayMap(points, (point, index) => {
    requireDataObject(
      point,
      `Harness Factory frontier validation research points[${index}]`,
      ['candidate', 'levelId']
    );
    if (!isTrustedAgentArchitectureCandidate(point.candidate)) {
      throw new TypeError(
        'Harness Factory frontier validation research points require trusted candidates'
      );
    }
    if (
      weakSetHas(DISPOSED_ARCHITECTURE_CANDIDATES, point.candidate)
      || weakSetHas(PROTECTED_ADOPTED_CANDIDATES, point.candidate)
    ) {
      throw new TypeError(
        'Harness Factory frontier validation research points require fresh unretired candidates'
      );
    }
    const levelId = requireNonEmptyString(
      point.levelId,
      `Harness Factory frontier validation research points[${index}].levelId`
    );
    if (arrayFind(
      campaign.frontier,
      (frontierPoint) => frontierPoint.architectureId === point.candidate.id
        && frontierPoint.levelId === levelId
    ) === undefined) {
      throw new Error(
        'Harness Factory frontier validation research point is not in the archived frontier'
      );
    }
    return objectFreeze({
      candidate: point.candidate,
      levelId
    });
  });
  const pointKeys = arrayMap(
    normalized,
    ({ candidate, levelId }) => `${candidate.id}\u0000${levelId}`
  );
  const missingPointKeys = arrayMap(
    missingPoints,
    ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
  );
  if (
    setSize(setFromArray(pointKeys)) !== pointKeys.length
    || jsonStringify(arraySort(pointKeys, stringLocaleCompare))
      !== jsonStringify(arraySort(missingPointKeys, stringLocaleCompare))
  ) {
    throw new Error(
      'Harness Factory frontier validation research points must match the target missing points'
    );
  }
  return objectFreeze(arrayMap(
    missingPoints,
    (missingPoint) => arrayFind(
      normalized,
      ({ candidate, levelId }) => candidate.id === missingPoint.candidateId
        && levelId === missingPoint.levelId
    )
  ));
}

function requireTrustedBenchmarkFrontierValidationStabilityResearchPoints(
  points,
  target,
  campaign
) {
  const variablePoints = target.frontierStability.variablePoints;
  if (!arrayIsArray(points) || points.length === 0) {
    throw new TypeError(
      'Harness Factory frontier stability research requires variable points'
    );
  }
  if (points.length !== variablePoints.length) {
    throw new Error(
      'Harness Factory frontier stability research points must cover exactly the target variable points'
    );
  }
  const normalized = arrayMap(points, (point, index) => {
    requireDataObject(
      point,
      `Harness Factory frontier stability research points[${index}]`,
      ['candidate', 'levelId']
    );
    if (!isTrustedAgentArchitectureCandidate(point.candidate)) {
      throw new TypeError(
        'Harness Factory frontier stability research points require trusted candidates'
      );
    }
    if (
      weakSetHas(DISPOSED_ARCHITECTURE_CANDIDATES, point.candidate)
      || weakSetHas(PROTECTED_ADOPTED_CANDIDATES, point.candidate)
    ) {
      throw new TypeError(
        'Harness Factory frontier stability research points require fresh unretired candidates'
      );
    }
    const levelId = requireNonEmptyString(
      point.levelId,
      `Harness Factory frontier stability research points[${index}].levelId`
    );
    if (arrayFind(
      campaign.frontier,
      (frontierPoint) => frontierPoint.architectureId === point.candidate.id
        && frontierPoint.levelId === levelId
    ) === undefined) {
      throw new Error(
        'Harness Factory frontier stability research point is not in the archived frontier'
      );
    }
    return objectFreeze({
      candidate: point.candidate,
      levelId
    });
  });
  const pointKeys = arrayMap(
    normalized,
    ({ candidate, levelId }) => `${candidate.id}\u0000${levelId}`
  );
  const variablePointKeys = arrayMap(
    variablePoints,
    ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
  );
  if (
    setSize(setFromArray(pointKeys)) !== pointKeys.length
    || jsonStringify(arraySort(pointKeys, stringLocaleCompare))
      !== jsonStringify(arraySort(variablePointKeys, stringLocaleCompare))
  ) {
    throw new Error(
      'Harness Factory frontier stability research points must match the target variable points'
    );
  }
  return objectFreeze(arrayMap(
    variablePoints,
    (variablePoint) => arrayFind(
      normalized,
      ({ candidate, levelId }) => candidate.id === variablePoint.candidateId
        && levelId === variablePoint.levelId
    )
  ));
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

function factoryBenchmarkFrontierValidationScorecardFromLedger(ledger, factory) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError(
      'Harness Factory frontier validation scorecard requires an exact trusted factory'
    );
  }
  const campaigns = ledger.restoreHarnessFactoryBenchmarkCampaigns();
  const validations = ledger.restoreHarnessFactoryBenchmarkValidations();
  const factoryCampaigns = arrayFilter(
    campaigns,
    (campaign) => campaign.factoryId === factory.factoryId
  );
  const factoryValidations = arrayFilter(
    validations,
    (validation) => validation.factoryId === factory.factoryId
  );
  const mutableBatchScores = [];
  arrayForEach(factoryCampaigns, (campaign) => {
    const campaignValidations = arrayFilter(
      factoryValidations,
      (validation) => sameArchiveLocator(
        validation.campaignArchive,
        campaign.archive
      )
    );
    if (campaignValidations.length === 0) {
      return;
    }
    const mutablePointScores = [];
    arrayForEach(campaignValidations, (validation) => {
      const frontierPoint = arrayFind(
        campaign.frontier,
        (point) => point.architectureId === validation.candidateId
          && point.levelId === validation.levelId
      );
      if (
        frontierPoint === undefined
        || validation.caseFingerprint !== campaign.caseFingerprint
        || jsonStringify(validation.caseIds) !== jsonStringify(campaign.caseIds)
        || !sameFactoryBenchmarkPointEvidence(
          frontierPoint,
          validation.campaignPoint
        )
      ) {
        throw new Error(
          'Harness Factory frontier validation scorecard found inconsistent archived evidence'
        );
      }
      let pointScore = arrayFind(
        mutablePointScores,
        (candidatePoint) => candidatePoint.candidateId === validation.candidateId
          && candidatePoint.levelId === validation.levelId
      );
      if (pointScore === undefined) {
        pointScore = {
          candidateId: validation.candidateId,
          levelId: validation.levelId,
          validationCount: 0,
          latest: null
        };
        arrayPush(mutablePointScores, pointScore);
      }
      pointScore.validationCount += 1;
      pointScore.latest = validation;
    });
    const latestPointScores = mutablePointScores;
    const frontierCount = campaign.frontier.length;
    const coveredCount = latestPointScores.length;
    const validationCount = campaignValidations.length;
    const passedCount = arrayFilter(
      latestPointScores,
      ({ latest }) => latest.passed === true
    ).length;
    const complete = coveredCount === frontierCount
      && arrayEvery(
        latestPointScores,
        ({ latest }) => latest.complete === true
      );
    const reproducible = coveredCount === frontierCount
      && arrayEvery(
        latestPointScores,
        ({ latest }) => latest.reproducible === true
      );
    const independent = coveredCount === frontierCount
      && arrayEvery(
        latestPointScores,
        ({ latest }) => latest.independent === true
      );
    const status = coveredCount < frontierCount
      ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
      : passedCount === coveredCount
        && complete
        && reproducible
        && independent
        ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
        : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED;
    const coveredPointKeys = arrayMap(
      latestPointScores,
      ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
    );
    const missingPoints = arrayFilter(
      campaign.frontier,
      (point) => !arrayIncludes(
        coveredPointKeys,
        `${point.architectureId}\u0000${point.levelId}`
      )
    );
    mutableBatchScores.push({
      campaignArchive: campaign.archive,
      frontierCount,
      validationCount,
      coveredCount,
      frontierCoverageRate: coveredCount / frontierCount,
      missingPoints,
      duplicateValidationCount: validationCount - coveredCount,
      passedCount,
      failedCount: coveredCount - passedCount,
      passRate: passedCount / coveredCount,
      complete,
      reproducible,
      independent,
      status,
      firstValidationArchive: campaignValidations[0].archive,
      latestValidationArchive: campaignValidations[campaignValidations.length - 1].archive
    });
  });
  const truncated = mutableBatchScores.length
    > MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES;
  const returnedBatchScores = truncated
    ? arraySlice(
      mutableBatchScores,
      mutableBatchScores.length
        - MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES
    )
    : mutableBatchScores;
  const batchScores = arraySort(
    arrayMap(returnedBatchScores, (score) => objectFreeze({
      ...score,
      missingPoints: objectFreeze(arrayMap(
        score.missingPoints,
        ({ architectureId, levelId }) => objectFreeze({
          candidateId: architectureId,
          levelId
        })
      )),
      dataOnly: true,
      authorityTransferred: false
    })),
    (left, right) => {
      const statusRank = (status) => status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
        ? 3
        : status
          === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED
          ? 2
          : 1;
      return statusRank(right.status) - statusRank(left.status)
        || right.passRate - left.passRate
        || right.coveredCount - left.coveredCount
        || right.latestValidationArchive.sequence - left.latestValidationArchive.sequence
        || left.campaignArchive.sequence - right.campaignArchive.sequence;
    }
  );
  const returnedValidationCount = arrayReduce(
    batchScores,
    (total, score) => total + score.validationCount,
    0
  );
  return new HarnessFactoryBenchmarkFrontierValidationScorecardReport({
    factory,
    consideredBatchCount: mutableBatchScores.length,
    returnedBatchCount: batchScores.length,
    consideredValidationCount: factoryValidations.length,
    returnedValidationCount,
    batchScores,
    truncated,
    token: FACTORY_TOKEN
  });
}

function factoryBenchmarkFrontierValidationIdentity(campaign) {
  const identity = {
    caseFingerprint: campaign.caseFingerprint,
    caseIds: campaign.caseIds,
    frontier: arrayMap(
      campaign.frontier,
      ({ architectureId, levelId, computeUnits, budgets, architectureFingerprint }) => ({
        architectureId,
        levelId,
        computeUnits,
        budgets,
        architectureFingerprint
      })
    )
  };
  return `sha256:${createHash('sha256')
    .update(jsonStringify(identity))
    .digest('hex')}`;
}

function factoryBenchmarkFrontierValidationStabilityFromLedger(ledger, factory) {
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError(
      'Harness Factory frontier validation stability requires an exact trusted factory'
    );
  }
  const scorecard = factoryBenchmarkFrontierValidationScorecardFromLedger(
    ledger,
    factory
  );
  const campaigns = ledger.restoreHarnessFactoryBenchmarkCampaigns();
  const validations = ledger.restoreHarnessFactoryBenchmarkValidations();
  const mutableScores = [];
  arrayForEach(scorecard.batchScores, (score) => {
    const campaign = arrayFind(
      campaigns,
      (candidateCampaign) => sameArchiveLocator(
        candidateCampaign.archive,
        score.campaignArchive
      )
    );
    if (campaign === undefined) {
      throw new Error(
        'Harness Factory frontier validation stability found an unlinked campaign score'
      );
    }
    const frontierFingerprint = factoryBenchmarkFrontierValidationIdentity(campaign);
    let frontierScore = arrayFind(
      mutableScores,
      (candidateScore) => candidateScore.frontierFingerprint === frontierFingerprint
    );
    if (frontierScore === undefined) {
      frontierScore = {
        frontierFingerprint,
        frontierCount: campaign.frontier.length,
        validationCount: 0,
        campaignCount: 0,
        passedCount: 0,
        failedCount: 0,
        incompleteCount: 0,
        completeCount: 0,
        reproducibleCount: 0,
        independentCount: 0,
        campaignStatuses: [],
        pointScores: []
      };
      arrayPush(mutableScores, frontierScore);
    }
    if (frontierScore.frontierCount !== campaign.frontier.length) {
      throw new Error(
        'Harness Factory frontier validation stability found inconsistent frontier identities'
      );
    }
    frontierScore.validationCount += score.validationCount;
    frontierScore.campaignCount += 1;
    if (
      score.status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
    ) {
      frontierScore.passedCount += 1;
    } else if (
      score.status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED
    ) {
      frontierScore.failedCount += 1;
    } else {
      frontierScore.incompleteCount += 1;
    }
    if (score.complete) {
      frontierScore.completeCount += 1;
    }
    if (score.reproducible) {
      frontierScore.reproducibleCount += 1;
    }
    if (score.independent) {
      frontierScore.independentCount += 1;
    }
    arrayPush(frontierScore.campaignStatuses, {
      campaignArchive: score.campaignArchive,
      frontierCount: score.frontierCount,
      validationCount: score.validationCount,
      coveredCount: score.coveredCount,
      frontierCoverageRate: score.frontierCoverageRate,
      duplicateValidationCount: score.duplicateValidationCount,
      passedCount: score.passedCount,
      failedCount: score.failedCount,
      passRate: score.passRate,
      complete: score.complete,
      reproducible: score.reproducible,
      independent: score.independent,
      status: score.status,
      firstValidationArchive: score.firstValidationArchive,
      latestValidationArchive: score.latestValidationArchive
    });
    const campaignValidations = arrayFilter(
      validations,
      (validation) => validation.factoryId === campaign.factoryId
        && sameArchiveLocator(validation.campaignArchive, campaign.archive)
    );
    arrayForEach(campaign.frontier, (frontierPoint) => {
      const pointValidations = arrayFilter(
        campaignValidations,
        (validation) => validation.candidateId === frontierPoint.architectureId
          && validation.levelId === frontierPoint.levelId
      );
      const latestValidation = pointValidations[pointValidations.length - 1] ?? null;
      let pointScore = arrayFind(
        frontierScore.pointScores,
        (candidatePoint) => candidatePoint.candidateId === frontierPoint.architectureId
          && candidatePoint.levelId === frontierPoint.levelId
      );
      if (pointScore === undefined) {
        pointScore = {
          candidateId: frontierPoint.architectureId,
          levelId: frontierPoint.levelId,
          campaignCount: 0,
          validationCount: 0,
          passedCount: 0,
          failedCount: 0,
          incompleteCount: 0,
          completeCount: 0,
          reproducibleCount: 0,
          independentCount: 0,
          campaignStatuses: []
        };
        arrayPush(frontierScore.pointScores, pointScore);
      }
      pointScore.campaignCount += 1;
      pointScore.validationCount += pointValidations.length;
      const pointStatus = latestValidation === null
        ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
        : latestValidation.passed === true
            && latestValidation.complete === true
            && latestValidation.reproducible === true
            && latestValidation.independent === true
          ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
          : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED;
      if (
        pointStatus
          === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
      ) {
        pointScore.passedCount += 1;
      } else if (
        pointStatus
          === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED
      ) {
        pointScore.failedCount += 1;
      } else {
        pointScore.incompleteCount += 1;
      }
      if (latestValidation?.complete === true) {
        pointScore.completeCount += 1;
      }
      if (latestValidation?.reproducible === true) {
        pointScore.reproducibleCount += 1;
      }
      if (latestValidation?.independent === true) {
        pointScore.independentCount += 1;
      }
      arrayPush(pointScore.campaignStatuses, {
        campaignArchive: score.campaignArchive,
        validationArchive: latestValidation?.archive ?? null,
        status: pointStatus,
        passed: latestValidation?.passed === true,
        complete: latestValidation?.complete === true,
        reproducible: latestValidation?.reproducible === true,
        independent: latestValidation?.independent === true
      });
    });
  });
  const frontierScores = arraySort(
    arrayMap(mutableScores, (score) => {
      const campaignStatuses = arraySort(
        arrayMap(score.campaignStatuses, (campaignStatus) => objectFreeze({
          ...campaignStatus,
          dataOnly: true,
          authorityTransferred: false
        })),
        (left, right) => left.campaignArchive.sequence - right.campaignArchive.sequence
      );
      const firstCampaign = campaignStatuses[0];
      const latestCampaign = campaignStatuses[campaignStatuses.length - 1];
      const stable = score.campaignCount >= 2
        && score.passedCount === score.campaignCount
        && score.completeCount === score.campaignCount
        && score.reproducibleCount === score.campaignCount
        && score.independentCount === score.campaignCount;
      const stabilityStatus = score.campaignCount < 2
        ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
        : stable
          ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
          : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE;
      const pointScores = arraySort(
        arrayMap(score.pointScores, (pointScore) => {
          const pointStable = pointScore.campaignCount >= 2
            && pointScore.passedCount === pointScore.campaignCount
            && pointScore.completeCount === pointScore.campaignCount
            && pointScore.reproducibleCount === pointScore.campaignCount
            && pointScore.independentCount === pointScore.campaignCount;
          const pointStabilityStatus = pointScore.campaignCount < 2
            ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
            : pointStable
              ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
              : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE;
          const pointCampaignStatuses = arraySort(
            arrayMap(pointScore.campaignStatuses, (campaignStatus) => objectFreeze({
              ...campaignStatus,
              dataOnly: true,
              authorityTransferred: false
            })),
            (left, right) => left.campaignArchive.sequence - right.campaignArchive.sequence
          );
          return objectFreeze({
            candidateId: pointScore.candidateId,
            levelId: pointScore.levelId,
            campaignCount: pointScore.campaignCount,
            validationCount: pointScore.validationCount,
            passedCount: pointScore.passedCount,
            failedCount: pointScore.failedCount,
            incompleteCount: pointScore.incompleteCount,
            passRate: pointScore.passedCount / pointScore.campaignCount,
            completeCount: pointScore.completeCount,
            reproducibleCount: pointScore.reproducibleCount,
            independentCount: pointScore.independentCount,
            stable: pointStable,
            stabilityStatus: pointStabilityStatus,
            campaignStatuses: objectFreeze(pointCampaignStatuses),
            dataOnly: true,
            authorityTransferred: false
          });
        }),
        (left, right) => stringLocaleCompare(
          `${left.candidateId}\u0000${left.levelId}`,
          `${right.candidateId}\u0000${right.levelId}`
        )
      );
      return objectFreeze({
        frontierFingerprint: score.frontierFingerprint,
        frontierCount: score.frontierCount,
        validationCount: score.validationCount,
        campaignCount: score.campaignCount,
        passedCount: score.passedCount,
        failedCount: score.failedCount,
        incompleteCount: score.incompleteCount,
        passRate: score.passedCount / score.campaignCount,
        completeCount: score.completeCount,
        reproducibleCount: score.reproducibleCount,
        independentCount: score.independentCount,
        stable,
        stabilityStatus,
        firstCampaignArchive: firstCampaign.campaignArchive,
        latestCampaignArchive: latestCampaign.campaignArchive,
        firstValidationArchive: firstCampaign.firstValidationArchive,
        latestValidationArchive: latestCampaign.latestValidationArchive,
        campaignStatuses: objectFreeze(campaignStatuses),
        stablePointCount: arrayFilter(
          pointScores,
          ({ stabilityStatus }) => stabilityStatus
            === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
        ).length,
        unstablePointCount: arrayFilter(
          pointScores,
          ({ stabilityStatus }) => stabilityStatus
            === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
        ).length,
        insufficientPointCount: arrayFilter(
          pointScores,
          ({ stabilityStatus }) => stabilityStatus
            === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
        ).length,
        pointScores: objectFreeze(pointScores),
        dataOnly: true,
        authorityTransferred: false
      });
    }),
    (left, right) => {
      const stabilityRank = (status) => status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
        ? 3
        : status
          === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
          ? 2
          : 1;
      return stabilityRank(right.stabilityStatus) - stabilityRank(left.stabilityStatus)
        || right.passRate - left.passRate
        || right.campaignCount - left.campaignCount
        || right.latestCampaignArchive.sequence - left.latestCampaignArchive.sequence
        || stringLocaleCompare(left.frontierFingerprint, right.frontierFingerprint);
    }
  );
  return new HarnessFactoryBenchmarkFrontierValidationStabilityReport({
    factory,
    consideredCampaignCount: scorecard.consideredBatchCount,
    returnedCampaignCount: scorecard.returnedBatchCount,
    consideredValidationCount: scorecard.consideredValidationCount,
    returnedValidationCount: scorecard.returnedValidationCount,
    frontierScores,
    truncated: scorecard.truncated,
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
  holdout,
  proposalArchive = null
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
    proposalArchive: proposalArchive === null
      ? null
      : archiveLocator(proposalArchive),
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

function manufactureFactory(
  factory,
  options,
  improvementBaseline = null,
  proposalArchive = null,
  discoveryOverride = null
) {
  requireDataObject(options, 'Harness Factory manufacture options', MANUFACTURE_OPTIONS_KEYS);
  if (!isTrustedHarnessFactory(factory)) {
    throw new TypeError('Harness Factory requires an exact trusted factory');
  }
  if (
    discoveryOverride !== null
    && !isTrustedAgentArchitectureDiscoveryReport(discoveryOverride)
  ) {
    throw new TypeError('Harness Factory discovery override must be trusted evidence');
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
    proposalArchive !== null
    && (
      !isPlainObject(proposalArchive)
      || proposalArchive.kind !== 'harness-factory-architecture-proposals'
      || !isSafeInteger(proposalArchive.sequence)
      || proposalArchive.sequence <= 0
      || typeof proposalArchive.hash !== 'string'
      || stringTrim(proposalArchive.hash) === ''
    )
  ) {
    throw new TypeError('Harness Factory proposal archive provenance is invalid');
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
  const discovery = discoveryOverride === null
    ? factory.discoveryRunner.discover({
      goal,
      plannerCandidates,
      cases,
      productionBudget,
      researchBudget,
      skepticBudget,
      researchContext
    })
    : discoveryOverride;
  if (!isTrustedAgentArchitectureDiscoveryReport(discovery)) {
    throw new TypeError('Harness Factory discovery returned untrusted evidence');
  }
  if (
    discoveryOverride !== null
    && discovery.goal !== requireNonEmptyString(goal, 'Harness Factory goal')
  ) {
    throw new TypeError(
      'Harness Factory discovery override goal must match manufacture goal'
    );
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
    const rejectionSummary = factoryImprovementRejectionSummary({
      factory,
      baselineRecord: improvementBaseline.record,
      baselineDiscovery: improvementBaseline.discovery,
      currentDiscovery: discovery,
      currentBenchmarkIdentity,
      improvement
    });
    factory.dispose({
      candidates: discovery.candidates,
      reason: 'evaluated candidates retired after improvement guard rejection'
    });
    if (archive) {
      const pendingRejection = new HarnessFactoryImprovementRejectionReport({
        factory,
        summary: rejectionSummary,
        token: FACTORY_TOKEN
      });
      verifiedLedgerSnapshot(factory.ledger);
      factory.ledger.appendHarnessFactoryImprovementRejection(pendingRejection);
    }
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
          holdout,
          proposalArchive
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
    holdout,
    proposalArchive
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
              : item.target
                === HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
                ? !isValidHarnessFactoryBenchmarkFrontierValidationResearchAgendaItem(
                  item,
                  factory
                )
                : item.target
                  === HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
                  ? !isValidHarnessFactoryBenchmarkFrontierValidationStabilityResearchAgendaItem(
                    item,
                    factory
                  )
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

export class HarnessFactoryResearchPlanReport {
  constructor({
    factory,
    consideredGenerationCount,
    consideredValidationCount,
    consideredTargetCount,
    requestedItemCount,
    recommendationStatus,
    plans,
    truncated,
    token
  }) {
    const planIds = arrayIsArray(plans)
      ? arrayMap(plans, ({ id }) => id)
      : [];
    const forbiddenKeys = [
      'candidate',
      'candidates',
      'planner',
      'runner',
      'actionReport',
      'authority'
    ];
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
      || !arrayIsArray(plans)
      || plans.length > MAX_HARNESS_FACTORY_RESEARCH_AGENDA_ITEMS
      || plans.length > requestedItemCount
      || consideredTargetCount < plans.length
      || typeof truncated !== 'boolean'
      || truncated !== (consideredTargetCount > requestedItemCount)
      || setSize(setFromArray(planIds)) !== planIds.length
      || arraySome(
        plans,
        (plan, index) => (
          !isPlainObject(plan)
          || reflectOwnKeys(plan).length !== RESEARCH_PLAN_ITEM_KEYS.length
          || arraySome(
            reflectOwnKeys(plan),
            (key) => !arrayIncludes(RESEARCH_PLAN_ITEM_KEYS, key)
          )
          || plan.id !== `harness-factory-research-plan:${plan.agendaItemId}`
          || typeof plan.agendaItemId !== 'string'
          || stringTrim(plan.agendaItemId) === ''
          || plan.factoryId !== factory.factoryId
          || !arrayIncludes(HARNESS_FACTORY_RESEARCH_TARGET_VALUES, plan.target)
          || !isSafeInteger(plan.rank)
          || plan.rank !== index + 1
          || !isSafeInteger(plan.priority)
          || plan.priority <= 0
          || plan.generation !== null
            && (!isSafeInteger(plan.generation) || plan.generation <= 0)
          || !isPlainObject(plan.archive)
          || plan.validationArchive !== null
            && !isPlainObject(plan.validationArchive)
          || !isPlainObject(plan.benchmark)
          || !isPlainObject(plan.fitness)
          || typeof plan.holdoutStatus !== 'string'
          || stringTrim(plan.holdoutStatus) === ''
          || !arrayIncludes(
            [
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.BENCHMARK_FRONTIER_VALIDATION,
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.BENCHMARK_VALIDATION,
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FACTORY_RECOMMENDATION,
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FRONTIER_STABILITY,
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.HOLDOUT_VALIDATION,
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.OPERATOR_EXPERIMENT
            ],
            plan.bridge
          )
          || typeof plan.executionMethod !== 'string'
          || stringTrim(plan.executionMethod) === ''
          || typeof plan.objective !== 'string'
          || stringTrim(plan.objective) === ''
          || !arrayIsArray(plan.requiredInputs)
          || plan.requiredInputs.length === 0
          || !arrayEvery(
            plan.requiredInputs,
            (input) => typeof input === 'string' && stringTrim(input) !== ''
          )
          || !arrayIsArray(plan.expectedEvidence)
          || plan.expectedEvidence.length === 0
          || !arrayEvery(
            plan.expectedEvidence,
            (evidence) => typeof evidence === 'string' && stringTrim(evidence) !== ''
          )
          || plan.dataOnly !== true
          || plan.authorityTransferred !== false
          || arraySome(
            forbiddenKeys,
            (key) => arrayIncludes(reflectOwnKeys(plan), key)
              || arrayIncludes(reflectOwnKeys(plan.archive), key)
              || plan.validationArchive !== null
                && arrayIncludes(reflectOwnKeys(plan.validationArchive), key)
              || arrayIncludes(reflectOwnKeys(plan.benchmark), key)
              || arrayIncludes(reflectOwnKeys(plan.fitness), key)
          )
          || HARNESS_FACTORY_RESEARCH_PLAN_BLUEPRINTS[plan.target] === undefined
          || plan.bridge !== HARNESS_FACTORY_RESEARCH_PLAN_BLUEPRINTS[plan.target].bridge
          || plan.executionMethod
            !== HARNESS_FACTORY_RESEARCH_PLAN_BLUEPRINTS[plan.target].executionMethod
          || jsonStringify(plan.requiredInputs)
            !== jsonStringify(
              HARNESS_FACTORY_RESEARCH_PLAN_BLUEPRINTS[plan.target].requiredInputs
            )
          || jsonStringify(plan.expectedEvidence)
            !== jsonStringify(
              HARNESS_FACTORY_RESEARCH_PLAN_BLUEPRINTS[plan.target].expectedEvidence
            )
        )
      )
    ) {
      throw new TypeError('Harness Factory research plan requires trusted data-only evidence');
    }
    if (
      recommendationStatus === HARNESS_FACTORY_RECOMMENDATION_STATUSES.NO_HISTORY
      && (
        consideredGenerationCount !== 0
        || arraySome(plans, (plan) => plan.generation !== null)
      )
    ) {
      throw new TypeError('Harness Factory empty research plan is inconsistent');
    }
    this.factoryId = factory.factoryId;
    this.consideredGenerationCount = consideredGenerationCount;
    this.consideredValidationCount = consideredValidationCount;
    this.consideredTargetCount = consideredTargetCount;
    this.requestedItemCount = requestedItemCount;
    this.returnedPlanCount = plans.length;
    this.maxItems = MAX_HARNESS_FACTORY_RESEARCH_AGENDA_ITEMS;
    this.recommendationStatus = recommendationStatus;
    this.primaryPlanId = plans[0]?.id ?? null;
    this.truncated = truncated;
    this.complete = truncated === false;
    this.plans = objectFreeze(arrayMap(
      plans,
      (plan) => objectFreeze({
        ...plan,
        requiredInputs: objectFreeze(arraySlice(plan.requiredInputs)),
        expectedEvidence: objectFreeze(arraySlice(plan.expectedEvidence))
      })
    ));
    arrayForEach(this.plans, (plan) => {
      weakSetAdd(TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_ITEMS, plan);
      weakMapSet(
        TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_ITEM_FACTORIES,
        plan,
        factory
      );
    });
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_RESEARCH_PLANS, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryResearchPlanReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_RESEARCH_PLANS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryResearchPlanReport.prototype;
}

function isTrustedHarnessFactoryResearchPlanItem(item, factory) {
  return isPlainObject(item)
    && weakSetHas(TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_ITEMS, item)
    && weakMapGet(
      TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_ITEM_FACTORIES,
      item
    ) === factory;
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

export class HarnessFactoryBenchmarkFrontierValidationScorecardReport {
  constructor({
    factory,
    consideredBatchCount,
    returnedBatchCount,
    consideredValidationCount,
    returnedValidationCount,
    batchScores,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredBatchCount)
      || consideredBatchCount < 0
      || !isSafeInteger(returnedBatchCount)
      || returnedBatchCount < 0
      || returnedBatchCount > consideredBatchCount
      || !isSafeInteger(consideredValidationCount)
      || consideredValidationCount < 0
      || !isSafeInteger(returnedValidationCount)
      || returnedValidationCount < 0
      || returnedValidationCount > consideredValidationCount
      || !arrayIsArray(batchScores)
      || batchScores.length > MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES
      || !arrayEvery(batchScores, (score) => {
        const expectedStatus = score?.coveredCount < score?.frontierCount
          ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
          : score?.passedCount === score?.coveredCount
            && score?.complete === true
            && score?.reproducible === true
            && score?.independent === true
            ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
            : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED;
        const missingPoints = score?.missingPoints;
        const missingPointKeys = arrayIsArray(missingPoints)
          ? arrayMap(
            missingPoints,
            (point) => `${point?.candidateId}\u0000${point?.levelId}`
          )
          : [];
        return isPlainObject(score)
          && isPlainObject(score.campaignArchive)
          && score.campaignArchive.kind === 'harness-factory-benchmark-campaign'
          && isSafeInteger(score.campaignArchive.sequence)
          && score.campaignArchive.sequence > 0
          && typeof score.campaignArchive.hash === 'string'
          && stringTrim(score.campaignArchive.hash) !== ''
          && isSafeInteger(score.frontierCount)
          && score.frontierCount > 0
          && isSafeInteger(score.validationCount)
          && score.validationCount > 0
          && isSafeInteger(score.coveredCount)
          && score.coveredCount > 0
          && score.coveredCount <= score.frontierCount
          && score.validationCount >= score.coveredCount
          && isFiniteNumber(score.frontierCoverageRate)
          && score.frontierCoverageRate >= 0
          && score.frontierCoverageRate <= 1
          && score.frontierCoverageRate === score.coveredCount / score.frontierCount
          && arrayIsArray(missingPoints)
          && missingPoints.length === score.frontierCount - score.coveredCount
          && setSize(setFromArray(missingPointKeys)) === missingPointKeys.length
          && arrayEvery(
            missingPoints,
            (point) => isPlainObject(point)
              && reflectOwnKeys(point).length === 2
              && typeof point.candidateId === 'string'
              && stringTrim(point.candidateId) !== ''
              && typeof point.levelId === 'string'
              && stringTrim(point.levelId) !== ''
          )
          && isSafeInteger(score.duplicateValidationCount)
          && score.duplicateValidationCount >= 0
          && score.duplicateValidationCount === score.validationCount - score.coveredCount
          && isSafeInteger(score.passedCount)
          && score.passedCount >= 0
          && score.passedCount <= score.coveredCount
          && isSafeInteger(score.failedCount)
          && score.failedCount >= 0
          && score.failedCount <= score.coveredCount
          && score.passedCount + score.failedCount === score.coveredCount
          && isFiniteNumber(score.passRate)
          && score.passRate >= 0
          && score.passRate <= 1
          && score.passRate === score.passedCount / score.coveredCount
          && typeof score.complete === 'boolean'
          && typeof score.reproducible === 'boolean'
          && typeof score.independent === 'boolean'
          && (!score.complete || score.coveredCount === score.frontierCount)
          && (!score.reproducible || score.complete)
          && (!score.independent || score.complete)
          && score.status === expectedStatus
          && isPlainObject(score.firstValidationArchive)
          && score.firstValidationArchive.kind === 'harness-factory-benchmark-validation'
          && isSafeInteger(score.firstValidationArchive.sequence)
          && score.firstValidationArchive.sequence > score.campaignArchive.sequence
          && typeof score.firstValidationArchive.hash === 'string'
          && stringTrim(score.firstValidationArchive.hash) !== ''
          && isPlainObject(score.latestValidationArchive)
          && score.latestValidationArchive.kind === 'harness-factory-benchmark-validation'
          && isSafeInteger(score.latestValidationArchive.sequence)
          && score.latestValidationArchive.sequence >= score.firstValidationArchive.sequence
          && typeof score.latestValidationArchive.hash === 'string'
          && stringTrim(score.latestValidationArchive.hash) !== ''
          && score.dataOnly === true
          && score.authorityTransferred === false
          && !arraySome(
            [
              'candidate',
              'candidates',
              'campaign',
              'holdout',
              'runner',
              'actionReport',
              'validations'
            ],
            (key) => arrayIncludes(reflectOwnKeys(score), key)
          );
      })
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError(
        'Harness Factory frontier validation scorecard requires trusted evidence'
      );
    }
    const campaignKeys = arrayMap(
      batchScores,
      (score) => `${score.campaignArchive.sequence}\u0000${score.campaignArchive.hash}`
    );
    const countedValidations = arrayReduce(
      batchScores,
      (total, score) => total + score.validationCount,
      0
    );
    if (
      setSize(setFromArray(campaignKeys)) !== campaignKeys.length
      || countedValidations !== returnedValidationCount
      || truncated !== (
        consideredBatchCount
          > MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES
      )
      || returnedBatchCount !== batchScores.length
      || returnedBatchCount !== 0 && batchScores.length === 0
    ) {
      throw new TypeError(
        'Harness Factory frontier validation scorecard bounds are inconsistent'
      );
    }
    this.factoryId = factory.factoryId;
    this.consideredBatchCount = consideredBatchCount;
    this.returnedBatchCount = returnedBatchCount;
    this.consideredValidationCount = consideredValidationCount;
    this.returnedValidationCount = returnedValidationCount;
    this.batchCount = batchScores.length;
    this.completeBatchCount = arrayFilter(
      batchScores,
      ({ complete }) => complete
    ).length;
    this.passedBatchCount = arrayFilter(
      batchScores,
      ({ status }) => status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
    ).length;
    this.failedBatchCount = arrayFilter(
      batchScores,
      ({ status }) => status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED
    ).length;
    this.incompleteBatchCount = arrayFilter(
      batchScores,
      ({ status }) => status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
    ).length;
    this.maxEntries = MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES;
    this.truncated = truncated;
    this.batchScores = objectFreeze(arraySlice(batchScores));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARDS, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARDS,
      report
    )
    && objectGetPrototypeOf(report)
      === HarnessFactoryBenchmarkFrontierValidationScorecardReport.prototype;
}

export class HarnessFactoryBenchmarkFrontierValidationStabilityReport {
  constructor({
    factory,
    consideredCampaignCount,
    returnedCampaignCount,
    consideredValidationCount,
    returnedValidationCount,
    frontierScores,
    truncated,
    token
  }) {
    const stabilityStatuses = [
      HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT,
      HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE,
      HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
    ];
    const isValidArchive = (archive, kind) => isPlainObject(archive)
      && archive.kind === kind
      && isSafeInteger(archive.sequence)
      && archive.sequence > 0
      && typeof archive.hash === 'string'
      && stringTrim(archive.hash) !== '';
    const isValidCampaignStatus = (campaignStatus) => {
      const expectedStatus = campaignStatus?.coveredCount < campaignStatus?.frontierCount
        ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
        : campaignStatus?.passedCount === campaignStatus?.coveredCount
          && campaignStatus?.complete === true
          && campaignStatus?.reproducible === true
          && campaignStatus?.independent === true
          ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
          : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED;
      return isPlainObject(campaignStatus)
        && isValidArchive(campaignStatus.campaignArchive, 'harness-factory-benchmark-campaign')
        && isSafeInteger(campaignStatus.frontierCount)
        && campaignStatus.frontierCount > 0
        && isSafeInteger(campaignStatus.validationCount)
        && campaignStatus.validationCount > 0
        && isSafeInteger(campaignStatus.coveredCount)
        && campaignStatus.coveredCount > 0
        && campaignStatus.coveredCount <= campaignStatus.frontierCount
        && campaignStatus.validationCount >= campaignStatus.coveredCount
        && isFiniteNumber(campaignStatus.frontierCoverageRate)
        && campaignStatus.frontierCoverageRate >= 0
        && campaignStatus.frontierCoverageRate <= 1
        && campaignStatus.frontierCoverageRate
          === campaignStatus.coveredCount / campaignStatus.frontierCount
        && isSafeInteger(campaignStatus.duplicateValidationCount)
        && campaignStatus.duplicateValidationCount >= 0
        && campaignStatus.duplicateValidationCount
          === campaignStatus.validationCount - campaignStatus.coveredCount
        && isSafeInteger(campaignStatus.passedCount)
        && campaignStatus.passedCount >= 0
        && campaignStatus.passedCount <= campaignStatus.coveredCount
        && isSafeInteger(campaignStatus.failedCount)
        && campaignStatus.failedCount >= 0
        && campaignStatus.failedCount <= campaignStatus.coveredCount
        && campaignStatus.passedCount + campaignStatus.failedCount
          === campaignStatus.coveredCount
        && isFiniteNumber(campaignStatus.passRate)
        && campaignStatus.passRate >= 0
        && campaignStatus.passRate <= 1
        && campaignStatus.passRate
          === campaignStatus.passedCount / campaignStatus.coveredCount
        && typeof campaignStatus.complete === 'boolean'
        && typeof campaignStatus.reproducible === 'boolean'
        && typeof campaignStatus.independent === 'boolean'
        && (!campaignStatus.complete
          || campaignStatus.coveredCount === campaignStatus.frontierCount)
        && (!campaignStatus.reproducible || campaignStatus.complete)
        && (!campaignStatus.independent || campaignStatus.complete)
        && campaignStatus.status === expectedStatus
        && isValidArchive(
          campaignStatus.firstValidationArchive,
          'harness-factory-benchmark-validation'
        )
        && campaignStatus.firstValidationArchive.sequence
          > campaignStatus.campaignArchive.sequence
        && isValidArchive(
          campaignStatus.latestValidationArchive,
          'harness-factory-benchmark-validation'
        )
        && campaignStatus.latestValidationArchive.sequence
          >= campaignStatus.firstValidationArchive.sequence
        && campaignStatus.dataOnly === true
        && campaignStatus.authorityTransferred === false
        && !arraySome(
          [
            'candidate',
            'candidates',
            'campaign',
            'holdout',
            'runner',
            'actionReport',
            'validations'
          ],
          (key) => arrayIncludes(reflectOwnKeys(campaignStatus), key)
        );
    };
    const isValidPointCampaignStatus = (campaignStatus) =>
      isPlainObject(campaignStatus)
      && isValidArchive(
        campaignStatus.campaignArchive,
        'harness-factory-benchmark-campaign'
      )
      && (
        campaignStatus.validationArchive === null
        || isValidArchive(
          campaignStatus.validationArchive,
          'harness-factory-benchmark-validation'
        )
      )
      && arrayIncludes(
        [
          HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED,
          HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE,
          HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
        ],
        campaignStatus.status
      )
      && typeof campaignStatus.passed === 'boolean'
      && typeof campaignStatus.complete === 'boolean'
      && typeof campaignStatus.reproducible === 'boolean'
      && typeof campaignStatus.independent === 'boolean'
      && campaignStatus.status
        === (
          campaignStatus.validationArchive === null
            ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
            : campaignStatus.passed === true
                && campaignStatus.complete === true
                && campaignStatus.reproducible === true
                && campaignStatus.independent === true
              ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
              : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED
        )
      && campaignStatus.dataOnly === true
      && campaignStatus.authorityTransferred === false
      && !arraySome(
        [
          'candidate',
          'candidates',
          'campaign',
          'holdout',
          'runner',
          'actionReport',
          'validations'
        ],
        (key) => arrayIncludes(reflectOwnKeys(campaignStatus), key)
      );
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredCampaignCount)
      || consideredCampaignCount < 0
      || !isSafeInteger(returnedCampaignCount)
      || returnedCampaignCount < 0
      || returnedCampaignCount > consideredCampaignCount
      || !isSafeInteger(consideredValidationCount)
      || consideredValidationCount < 0
      || !isSafeInteger(returnedValidationCount)
      || returnedValidationCount < 0
      || returnedValidationCount > consideredValidationCount
      || !arrayIsArray(frontierScores)
      || frontierScores.length > MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES
      || !arrayEvery(frontierScores, (score) => {
        const expectedStable = score?.campaignCount >= 2
          && score?.passedCount === score?.campaignCount
          && score?.completeCount === score?.campaignCount
          && score?.reproducibleCount === score?.campaignCount
          && score?.independentCount === score?.campaignCount;
        const expectedStatus = score?.campaignCount < 2
          ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
          : expectedStable
            ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
            : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE;
        const campaignStatuses = score?.campaignStatuses;
        const campaignArchives = arrayIsArray(campaignStatuses)
          ? arrayMap(
            campaignStatuses,
            ({ campaignArchive }) => `${campaignArchive?.sequence}\u0000${campaignArchive?.hash}`
          )
          : [];
        const countedValidationCount = arrayIsArray(campaignStatuses)
          ? arrayReduce(
            campaignStatuses,
            (total, campaignStatus) => total + (campaignStatus?.validationCount ?? 0),
            0
          )
          : 0;
        const countedPassedCount = arrayIsArray(campaignStatuses)
          ? arrayFilter(
            campaignStatuses,
            ({ status }) => status
              === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
          ).length
          : 0;
        const countedFailedCount = arrayIsArray(campaignStatuses)
          ? arrayFilter(
            campaignStatuses,
            ({ status }) => status
              === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED
          ).length
          : 0;
        const countedIncompleteCount = arrayIsArray(campaignStatuses)
          ? arrayFilter(
            campaignStatuses,
            ({ status }) => status
              === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
          ).length
          : 0;
        const countedCompleteCount = arrayIsArray(campaignStatuses)
          ? arrayFilter(campaignStatuses, ({ complete }) => complete).length
          : 0;
        const countedReproducibleCount = arrayIsArray(campaignStatuses)
          ? arrayFilter(campaignStatuses, ({ reproducible }) => reproducible).length
          : 0;
        const countedIndependentCount = arrayIsArray(campaignStatuses)
          ? arrayFilter(campaignStatuses, ({ independent }) => independent).length
            : 0;
        const pointScores = score?.pointScores;
        const pointKeys = arrayIsArray(pointScores)
          ? arrayMap(
            pointScores,
            ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
          )
          : [];
        const countedStablePointCount = arrayIsArray(pointScores)
          ? arrayFilter(
            pointScores,
            ({ stabilityStatus }) => stabilityStatus
              === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
          ).length
          : 0;
        const countedUnstablePointCount = arrayIsArray(pointScores)
          ? arrayFilter(
            pointScores,
            ({ stabilityStatus }) => stabilityStatus
              === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
          ).length
          : 0;
        const countedInsufficientPointCount = arrayIsArray(pointScores)
          ? arrayFilter(
            pointScores,
            ({ stabilityStatus }) => stabilityStatus
              === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
          ).length
          : 0;
        return isPlainObject(score)
          && typeof score.frontierFingerprint === 'string'
          && stringTrim(score.frontierFingerprint) !== ''
          && isSafeInteger(score.frontierCount)
          && score.frontierCount > 0
          && isSafeInteger(score.validationCount)
          && score.validationCount > 0
          && isSafeInteger(score.campaignCount)
          && score.campaignCount > 0
          && isSafeInteger(score.passedCount)
          && score.passedCount >= 0
          && isSafeInteger(score.failedCount)
          && score.failedCount >= 0
          && isSafeInteger(score.incompleteCount)
          && score.incompleteCount >= 0
          && score.passedCount + score.failedCount + score.incompleteCount
            === score.campaignCount
          && isFiniteNumber(score.passRate)
          && score.passRate >= 0
          && score.passRate <= 1
          && score.passRate === score.passedCount / score.campaignCount
          && isSafeInteger(score.completeCount)
          && score.completeCount >= 0
          && score.completeCount <= score.campaignCount
          && isSafeInteger(score.reproducibleCount)
          && score.reproducibleCount >= 0
          && score.reproducibleCount <= score.campaignCount
          && isSafeInteger(score.independentCount)
          && score.independentCount >= 0
          && score.independentCount <= score.campaignCount
          && score.stable === expectedStable
          && score.stabilityStatus === expectedStatus
          && arrayIsArray(campaignStatuses)
          && campaignStatuses.length === score.campaignCount
          && setSize(setFromArray(campaignArchives)) === campaignArchives.length
          && arrayEvery(campaignStatuses, isValidCampaignStatus)
          && arrayEvery(
            campaignStatuses,
            (campaignStatus, index) => index === 0
              || campaignStatus.campaignArchive.sequence
                > campaignStatuses[index - 1].campaignArchive.sequence
          )
          && countedValidationCount === score.validationCount
          && countedPassedCount === score.passedCount
          && countedFailedCount === score.failedCount
          && countedIncompleteCount === score.incompleteCount
          && countedCompleteCount === score.completeCount
          && countedReproducibleCount === score.reproducibleCount
          && countedIndependentCount === score.independentCount
          && isSafeInteger(score.stablePointCount)
          && score.stablePointCount >= 0
          && score.stablePointCount <= score.frontierCount
          && isSafeInteger(score.unstablePointCount)
          && score.unstablePointCount >= 0
          && score.unstablePointCount <= score.frontierCount
          && isSafeInteger(score.insufficientPointCount)
          && score.insufficientPointCount >= 0
          && score.insufficientPointCount <= score.frontierCount
          && score.stablePointCount === countedStablePointCount
          && score.unstablePointCount === countedUnstablePointCount
          && score.insufficientPointCount === countedInsufficientPointCount
          && arrayIsArray(pointScores)
          && pointScores.length === score.frontierCount
          && setSize(setFromArray(pointKeys)) === pointKeys.length
          && arrayEvery(pointScores, (pointScore) => {
            const pointExpectedStable = pointScore?.campaignCount >= 2
              && pointScore?.passedCount === pointScore?.campaignCount
              && pointScore?.completeCount === pointScore?.campaignCount
              && pointScore?.reproducibleCount === pointScore?.campaignCount
              && pointScore?.independentCount === pointScore?.campaignCount;
            const pointExpectedStatus = pointScore?.campaignCount < 2
              ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
              : pointExpectedStable
                ? HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
                : HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE;
            const pointCampaignStatuses = pointScore?.campaignStatuses;
            const pointCampaignArchives = arrayIsArray(pointCampaignStatuses)
              ? arrayMap(
                pointCampaignStatuses,
                ({ campaignArchive }) => `${campaignArchive?.sequence}\u0000${campaignArchive?.hash}`
              )
              : [];
            const pointCount = arrayIsArray(pointCampaignStatuses)
              ? pointCampaignStatuses.length
              : 0;
            const pointPassedCount = arrayIsArray(pointCampaignStatuses)
              ? arrayFilter(
                pointCampaignStatuses,
                ({ status }) => status
                  === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.PASSED
              ).length
              : 0;
            const pointFailedCount = arrayIsArray(pointCampaignStatuses)
              ? arrayFilter(
                pointCampaignStatuses,
                ({ status }) => status
                  === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.FAILED
              ).length
              : 0;
            const pointIncompleteCount = arrayIsArray(pointCampaignStatuses)
              ? arrayFilter(
                pointCampaignStatuses,
                ({ status }) => status
                  === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
              ).length
              : 0;
            const pointCompleteCount = arrayIsArray(pointCampaignStatuses)
              ? arrayFilter(pointCampaignStatuses, ({ complete }) => complete).length
              : 0;
            const pointReproducibleCount = arrayIsArray(pointCampaignStatuses)
              ? arrayFilter(
                pointCampaignStatuses,
                ({ reproducible }) => reproducible
              ).length
              : 0;
            const pointIndependentCount = arrayIsArray(pointCampaignStatuses)
              ? arrayFilter(
                pointCampaignStatuses,
                ({ independent }) => independent
              ).length
              : 0;
            return isPlainObject(pointScore)
              && typeof pointScore.candidateId === 'string'
              && stringTrim(pointScore.candidateId) !== ''
              && typeof pointScore.levelId === 'string'
              && stringTrim(pointScore.levelId) !== ''
              && isSafeInteger(pointScore.campaignCount)
              && pointScore.campaignCount === score.campaignCount
              && isSafeInteger(pointScore.validationCount)
              && pointScore.validationCount >= 0
              && isSafeInteger(pointScore.passedCount)
              && pointScore.passedCount >= 0
              && isSafeInteger(pointScore.failedCount)
              && pointScore.failedCount >= 0
              && isSafeInteger(pointScore.incompleteCount)
              && pointScore.incompleteCount >= 0
              && pointScore.passedCount
                + pointScore.failedCount
                + pointScore.incompleteCount
                === pointScore.campaignCount
              && isFiniteNumber(pointScore.passRate)
              && pointScore.passRate >= 0
              && pointScore.passRate <= 1
              && pointScore.passRate
                === pointScore.passedCount / pointScore.campaignCount
              && isSafeInteger(pointScore.completeCount)
              && pointScore.completeCount >= 0
              && pointScore.completeCount <= pointScore.campaignCount
              && isSafeInteger(pointScore.reproducibleCount)
              && pointScore.reproducibleCount >= 0
              && pointScore.reproducibleCount <= pointScore.campaignCount
              && isSafeInteger(pointScore.independentCount)
              && pointScore.independentCount >= 0
              && pointScore.independentCount <= pointScore.campaignCount
              && pointScore.stable === pointExpectedStable
              && pointScore.stabilityStatus === pointExpectedStatus
              && arrayIsArray(pointCampaignStatuses)
              && pointCount === pointScore.campaignCount
              && setSize(setFromArray(pointCampaignArchives)) === pointCampaignArchives.length
              && arrayEvery(
                pointCampaignStatuses,
                isValidPointCampaignStatus
              )
              && arrayEvery(
                pointCampaignStatuses,
                (campaignStatus, index) => index === 0
                  || campaignStatus.campaignArchive.sequence
                    > pointCampaignStatuses[index - 1].campaignArchive.sequence
              )
              && pointPassedCount === pointScore.passedCount
              && pointFailedCount === pointScore.failedCount
              && pointIncompleteCount === pointScore.incompleteCount
              && pointCompleteCount === pointScore.completeCount
              && pointReproducibleCount === pointScore.reproducibleCount
              && pointIndependentCount === pointScore.independentCount
              && pointScore.dataOnly === true
              && pointScore.authorityTransferred === false
              && !arraySome(
                [
                  'candidate',
                  'candidates',
                  'campaign',
                  'holdout',
                  'runner',
                  'actionReport',
                  'validations'
                ],
                (key) => arrayIncludes(reflectOwnKeys(pointScore), key)
              );
          })
          && arrayEvery(
            pointScores,
            (pointScore) => pointScore.campaignStatuses.length
              === campaignStatuses.length
              && arrayEvery(
                pointScore.campaignStatuses,
                (campaignStatus, index) => sameArchiveLocator(
                  campaignStatus.campaignArchive,
                  campaignStatuses[index].campaignArchive
                )
              )
          )
          && isValidArchive(score.firstCampaignArchive, 'harness-factory-benchmark-campaign')
          && isValidArchive(score.latestCampaignArchive, 'harness-factory-benchmark-campaign')
          && score.firstCampaignArchive.sequence
            === campaignStatuses[0].campaignArchive.sequence
          && score.latestCampaignArchive.sequence
            === campaignStatuses[campaignStatuses.length - 1].campaignArchive.sequence
          && isValidArchive(
            score.firstValidationArchive,
            'harness-factory-benchmark-validation'
          )
          && isValidArchive(
            score.latestValidationArchive,
            'harness-factory-benchmark-validation'
          )
          && score.firstValidationArchive.sequence
            === campaignStatuses[0].firstValidationArchive.sequence
          && score.latestValidationArchive.sequence
            === campaignStatuses[campaignStatuses.length - 1].latestValidationArchive.sequence
          && typeof score.dataOnly === 'boolean'
          && score.dataOnly === true
          && score.authorityTransferred === false
          && !arraySome(
            [
              'candidate',
              'candidates',
              'campaign',
              'holdout',
              'runner',
              'actionReport',
              'validations'
            ],
            (key) => arrayIncludes(reflectOwnKeys(score), key)
          )
          && arrayIncludes(stabilityStatuses, score.stabilityStatus);
      })
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError(
        'Harness Factory frontier validation stability requires trusted evidence'
      );
    }
    const frontierFingerprints = arrayMap(
      frontierScores,
      ({ frontierFingerprint }) => frontierFingerprint
    );
    const countedCampaigns = arrayReduce(
      frontierScores,
      (total, score) => total + score.campaignCount,
      0
    );
    const countedValidations = arrayReduce(
      frontierScores,
      (total, score) => total + score.validationCount,
      0
    );
    if (
      setSize(setFromArray(frontierFingerprints)) !== frontierFingerprints.length
      || countedCampaigns !== returnedCampaignCount
      || countedValidations !== returnedValidationCount
      || truncated !== (
        consideredCampaignCount
          > MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES
      )
      || frontierScores.length > returnedCampaignCount
      || returnedCampaignCount !== 0 && frontierScores.length === 0
    ) {
      throw new TypeError(
        'Harness Factory frontier validation stability bounds are inconsistent'
      );
    }
    this.factoryId = factory.factoryId;
    this.consideredCampaignCount = consideredCampaignCount;
    this.returnedCampaignCount = returnedCampaignCount;
    this.consideredValidationCount = consideredValidationCount;
    this.returnedValidationCount = returnedValidationCount;
    this.frontierGroupCount = frontierScores.length;
    this.stableFrontierCount = arrayFilter(
      frontierScores,
      ({ stabilityStatus }) => stabilityStatus
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.STABLE
    ).length;
    this.unstableFrontierCount = arrayFilter(
      frontierScores,
      ({ stabilityStatus }) => stabilityStatus
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
    ).length;
    this.insufficientFrontierCount = arrayFilter(
      frontierScores,
      ({ stabilityStatus }) => stabilityStatus
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.INSUFFICIENT
    ).length;
    this.maxEntries = MAX_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_HISTORY_ENTRIES;
    this.truncated = truncated;
    this.frontierScores = objectFreeze(arraySlice(frontierScores));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITIES, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITIES, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryBenchmarkFrontierValidationStabilityReport.prototype;
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

export class HarnessFactoryBenchmarkFrontierValidationReport {
  constructor({
    factory,
    campaign,
    validations,
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
      || !arrayIsArray(validations)
      || validations.length !== campaign.frontier.length
      || !arrayEvery(
        validations,
        (validation) => isTrustedHarnessFactoryBenchmarkCampaignValidationReport(
          validation
        )
          && weakMapGet(
            TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_FACTORIES,
            validation
          ) === factory
          && weakMapGet(
            TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_CAMPAIGNS,
            validation
          ) === campaign
          && sameArchiveLocator(validation.campaignArchive, campaign.archive)
          && arrayIncludes(campaign.frontier, validation.campaignPoint)
      )
    ) {
      throw new TypeError(
        'Harness Factory benchmark frontier validation requires matching trusted evidence'
      );
    }
    const pointKeys = arrayMap(
      validations,
      (validation) => `${validation.candidateId}\u0000${validation.levelId}`
    );
    const archived = validations[0].archived;
    if (
      setSize(setFromArray(pointKeys)) !== pointKeys.length
      || arraySome(
        campaign.frontier,
        (frontierPoint) => !arrayIncludes(
          pointKeys,
          `${frontierPoint.architectureId}\u0000${frontierPoint.levelId}`
        )
      )
      || arraySome(
        validations,
        (validation) => validation.archived !== archived
      )
    ) {
      throw new TypeError(
        'Harness Factory benchmark frontier validation points are inconsistent'
      );
    }
    this.factoryId = factory.factoryId;
    this.campaignArchive = archiveLocator(campaign.archive);
    this.validations = objectFreeze(arraySlice(validations));
    this.validationCount = validations.length;
    this.passedCount = arrayFilter(validations, ({ passed }) => passed).length;
    this.failedCount = this.validationCount - this.passedCount;
    this.complete = arrayEvery(validations, ({ complete }) => complete);
    this.reproducible = arrayEvery(
      validations,
      ({ reproducible }) => reproducible
    );
    this.independent = arrayEvery(
      validations,
      ({ independent }) => independent
    );
    this.status = this.failedCount === 0
      ? HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
      : HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED;
    this.archived = archived;
    this.validationArchives = objectFreeze(
      arrayMap(validations, ({ archive }) => archive)
    );
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATIONS, this);
    weakMapSet(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_FACTORIES,
      this,
      factory
    );
    weakMapSet(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_CAMPAIGNS,
      this,
      campaign
    );
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkFrontierValidationReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATIONS, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryBenchmarkFrontierValidationReport.prototype;
}

export class HarnessFactoryBenchmarkFrontierValidationResearchExecutionReport {
  constructor({
    factory,
    target,
    campaign,
    validations,
    scorecard,
    token
  }) {
    const missingPoints = target?.frontierValidation?.missingPoints;
    const missingPointKeys = arrayIsArray(missingPoints)
      ? arrayMap(
        missingPoints,
        ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
      )
      : [];
    const validationKeys = arrayIsArray(validations)
      ? arrayMap(
        validations,
        ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
      )
      : [];
    const score = scorecard?.batchScores === undefined
      ? undefined
      : arrayFind(
        scorecard.batchScores,
        ({ campaignArchive }) => sameArchiveLocator(
          campaignArchive,
          campaign?.archive
        )
      );
    const validationStatus = arrayIsArray(validations)
      && arrayEvery(
        validations,
        ({ status }) => status === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
      )
      ? HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
      : HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED;
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isTrustedHarnessFactoryResearchAgendaItem(target, factory)
      || target.target
        !== HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
      || target.frontierValidation?.status
        !== HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
      || !isTrustedHarnessFactoryBenchmarkCampaignReport(campaign)
      || weakMapGet(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FACTORIES, campaign)
        !== factory
      || campaign.archived !== true
      || campaign.archive === null
      || !arrayIsArray(validations)
      || validations.length !== missingPointKeys.length
      || validations.length === 0
      || setSize(setFromArray(missingPointKeys)) !== missingPointKeys.length
      || setSize(setFromArray(validationKeys)) !== validationKeys.length
      || jsonStringify(arraySort(validationKeys, stringLocaleCompare))
        !== jsonStringify(arraySort(missingPointKeys, stringLocaleCompare))
      || !arrayEvery(
        validations,
        (validation) => isTrustedHarnessFactoryBenchmarkCampaignValidationReport(
          validation
        )
          && weakMapGet(
            TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_FACTORIES,
            validation
          ) === factory
          && weakMapGet(
            TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_CAMPAIGNS,
            validation
          ) === campaign
          && validation.archived === true
          && isPlainObject(validation.archive)
          && validation.archive.kind === 'harness-factory-benchmark-validation'
          && isSafeInteger(validation.archive.sequence)
          && validation.archive.sequence > campaign.archive.sequence
          && typeof validation.archive.hash === 'string'
          && stringTrim(validation.archive.hash) !== ''
          && sameArchiveLocator(validation.campaignArchive, campaign.archive)
          && arrayIncludes(campaign.frontier, validation.campaignPoint)
          && arrayIncludes(
            missingPointKeys,
            `${validation.candidateId}\u0000${validation.levelId}`
          )
      )
      || !isTrustedHarnessFactoryBenchmarkFrontierValidationScorecardReport(scorecard)
      || scorecard.factoryId !== factory.factoryId
      || score === undefined
      || score.status
        === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE
      || score.coveredCount !== score.frontierCount
      || score.missingPoints.length !== 0
      || scorecard.batchScores.length === 0
    ) {
      throw new TypeError(
        'Harness Factory frontier validation research execution requires matching trusted evidence'
      );
    }
    this.factoryId = factory.factoryId;
    this.targetId = target.id;
    this.campaignArchive = archiveLocator(campaign.archive);
    this.validations = objectFreeze(arraySlice(validations));
    this.validationArchives = objectFreeze(
      arrayMap(validations, ({ archive }) => archiveLocator(archive))
    );
    this.validationCount = validations.length;
    this.passedCount = arrayFilter(
      validations,
      ({ status }) => status === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
    ).length;
    this.failedCount = this.validationCount - this.passedCount;
    this.status = validationStatus;
    this.frontierStatus = score.status;
    this.frontierCoverageRate = score.frontierCoverageRate;
    this.remainingMissingPoints = objectFreeze(arrayMap(
      score.missingPoints,
      ({ candidateId, levelId }) => objectFreeze({ candidateId, levelId })
    ));
    this.targetResolved = score.status
      !== HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_SCORECARD_STATUSES.INCOMPLETE;
    this.archived = true;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_RESEARCH_EXECUTIONS, this);
    weakMapSet(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_RESEARCH_EXECUTION_FACTORIES,
      this,
      factory
    );
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkFrontierValidationResearchExecutionReport(
  report
) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_RESEARCH_EXECUTIONS,
      report
    )
    && objectGetPrototypeOf(report)
      === HarnessFactoryBenchmarkFrontierValidationResearchExecutionReport.prototype;
}

export class HarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport {
  constructor({
    factory,
    target,
    campaign,
    validations,
    stability,
    token
  }) {
    const variablePoints = target?.frontierStability?.variablePoints;
    const variablePointKeys = arrayIsArray(variablePoints)
      ? arrayMap(
        variablePoints,
        ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
      )
      : [];
    const validationKeys = arrayIsArray(validations)
      ? arrayMap(
        validations,
        ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
      )
      : [];
    const score = stability?.frontierScores === undefined
      ? undefined
      : arrayFind(
        stability.frontierScores,
        ({ frontierFingerprint }) => frontierFingerprint
          === target?.frontierStability?.frontierFingerprint
      );
    const validationStatus = arrayIsArray(validations)
      && arrayEvery(
        validations,
        ({ status }) => status === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
      )
      ? HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
      : HARNESS_FACTORY_HOLDOUT_STATUSES.FAILED;
    const remainingVariablePoints = score?.pointScores === undefined
      ? []
      : arrayMap(
        arrayFilter(
          score.pointScores,
          ({ stabilityStatus }) => stabilityStatus
            === HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
        ),
        ({ candidateId, levelId }) => objectFreeze({ candidateId, levelId })
      );
    const remainingVariablePointKeys = arrayMap(
      remainingVariablePoints,
      ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
    );
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isTrustedHarnessFactoryResearchAgendaItem(target, factory)
      || target.target
        !== HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
      || target.frontierStability?.stabilityStatus
        !== HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
      || !isTrustedHarnessFactoryBenchmarkCampaignReport(campaign)
      || weakMapGet(TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_FACTORIES, campaign)
        !== factory
      || campaign.archived !== true
      || campaign.archive === null
      || !sameArchiveLocator(
        campaign.archive,
        target.frontierStability.latestCampaignArchive
      )
      || !arrayIsArray(variablePoints)
      || variablePoints.length === 0
      || setSize(setFromArray(variablePointKeys)) !== variablePointKeys.length
      || !arrayIsArray(validations)
      || validations.length !== variablePointKeys.length
      || validations.length === 0
      || setSize(setFromArray(validationKeys)) !== validationKeys.length
      || jsonStringify(arraySort(validationKeys, stringLocaleCompare))
        !== jsonStringify(arraySort(variablePointKeys, stringLocaleCompare))
      || !arrayEvery(
        validations,
        (validation) => isTrustedHarnessFactoryBenchmarkCampaignValidationReport(
          validation
        )
          && weakMapGet(
            TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_FACTORIES,
            validation
          ) === factory
          && weakMapGet(
            TRUSTED_HARNESS_FACTORY_BENCHMARK_CAMPAIGN_VALIDATION_CAMPAIGNS,
            validation
          ) === campaign
          && validation.archived === true
          && isPlainObject(validation.archive)
          && validation.archive.kind === 'harness-factory-benchmark-validation'
          && isSafeInteger(validation.archive.sequence)
          && validation.archive.sequence > campaign.archive.sequence
          && typeof validation.archive.hash === 'string'
          && stringTrim(validation.archive.hash) !== ''
          && sameArchiveLocator(validation.campaignArchive, campaign.archive)
          && arrayIncludes(campaign.frontier, validation.campaignPoint)
          && arrayIncludes(
            variablePointKeys,
            `${validation.candidateId}\u0000${validation.levelId}`
          )
      )
      || !isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityReport(stability)
      || stability.factoryId !== factory.factoryId
      || score === undefined
      || score.frontierCount !== target.frontierStability.frontierCount
      || score.campaignCount !== target.frontierStability.campaignCount
      || score.frontierFingerprint
        !== target.frontierStability.frontierFingerprint
      || !arrayEvery(
        variablePointKeys,
        (pointKey) => arrayIncludes(
          arrayMap(
            score.pointScores,
            ({ candidateId, levelId }) => `${candidateId}\u0000${levelId}`
          ),
          pointKey
        )
      )
      || setSize(setFromArray(remainingVariablePointKeys))
        !== remainingVariablePointKeys.length
    ) {
      throw new TypeError(
        'Harness Factory frontier stability research execution requires matching trusted evidence'
      );
    }
    this.factoryId = factory.factoryId;
    this.targetId = target.id;
    this.campaignArchive = archiveLocator(campaign.archive);
    this.validations = objectFreeze(arraySlice(validations));
    this.validationArchives = objectFreeze(
      arrayMap(validations, ({ archive }) => archiveLocator(archive))
    );
    this.validationCount = validations.length;
    this.passedCount = arrayFilter(
      validations,
      ({ status }) => status === HARNESS_FACTORY_HOLDOUT_STATUSES.PASSED
    ).length;
    this.failedCount = this.validationCount - this.passedCount;
    this.status = validationStatus;
    this.frontierStatus = score.stabilityStatus;
    this.stabilityStatus = score.stabilityStatus;
    this.stablePointCount = score.stablePointCount;
    this.unstablePointCount = score.unstablePointCount;
    this.insufficientPointCount = score.insufficientPointCount;
    this.remainingVariablePoints = objectFreeze(remainingVariablePoints);
    this.targetResolved = score.stabilityStatus
      !== HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE;
    this.archived = true;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_EXECUTIONS,
      this
    );
    weakMapSet(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_EXECUTION_FACTORIES,
      this,
      factory
    );
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport(
  report
) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_EXECUTIONS,
      report
    )
    && objectGetPrototypeOf(report)
      === HarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport.prototype;
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

const FACTORY_IMPROVEMENT_REJECTION_SUMMARY_KEYS = objectFreeze([
  'attemptedGeneration',
  'authorityTransferred',
  'baseline',
  'benchmark',
  'candidate',
  'dataOnly',
  'factoryId',
  'improvement',
  'reasons'
]);
const FACTORY_IMPROVEMENT_REJECTION_BASELINE_KEYS = objectFreeze([
  'archive',
  'architectureFingerprint',
  'architectureId',
  'fitness',
  'generation'
]);
const FACTORY_IMPROVEMENT_REJECTION_CANDIDATE_KEYS = objectFreeze([
  'adopted',
  'architectureFingerprint',
  'architectureId',
  'fitness'
]);
const FACTORY_IMPROVEMENT_REJECTION_BENCHMARK_KEYS = objectFreeze([
  'budgets',
  'caseCount',
  'fingerprint'
]);
const FACTORY_IMPROVEMENT_REJECTION_BUDGET_KEYS = objectFreeze([
  'production',
  'research',
  'skeptic'
]);
const FACTORY_IMPROVEMENT_REJECTION_FITNESS_KEYS = objectFreeze([
  'productionProvenRate',
  'productionSuccessRate',
  'researchProvenRate',
  'researchSuccessRate',
  'skepticSuccessRate',
  'skepticWeaknessesExposed',
  'transferSuccessRate'
]);
const FACTORY_IMPROVEMENT_REJECTION_IMPROVEMENT_KEYS = objectFreeze([
  'accepted',
  'benchmarkIdentityStable',
  'benchmarkStable',
  'deltas',
  'nonRegressing',
  'strictlyImproved'
]);
const FACTORY_IMPROVEMENT_REJECTION_HISTORY_KEYS = objectFreeze([
  ...FACTORY_IMPROVEMENT_REJECTION_SUMMARY_KEYS,
  'archive'
]);

function hasExactKeys(value, expectedKeys) {
  const keys = value !== null && typeof value === 'object'
    ? reflectOwnKeys(value)
    : [];
  return isPlainObject(value)
    && keys.length === expectedKeys.length
    && arrayEvery(expectedKeys, (key) => arrayIncludes(keys, key));
}

function validFactoryImprovementRejectionFitness(value) {
  return hasExactKeys(value, FACTORY_IMPROVEMENT_REJECTION_FITNESS_KEYS)
    && arrayEvery(
      [
        'productionProvenRate',
        'productionSuccessRate',
        'researchProvenRate',
        'researchSuccessRate',
        'skepticSuccessRate',
        'transferSuccessRate'
      ],
      (key) => isFiniteNumber(value[key]) && value[key] >= 0 && value[key] <= 1
    )
    && isSafeInteger(value.skepticWeaknessesExposed)
    && value.skepticWeaknessesExposed >= 0;
}

function validFactoryImprovementRejectionBenchmark(value) {
  return hasExactKeys(value, FACTORY_IMPROVEMENT_REJECTION_BENCHMARK_KEYS)
    && hasExactKeys(value.budgets, FACTORY_IMPROVEMENT_REJECTION_BUDGET_KEYS)
    && arrayEvery(
      FACTORY_IMPROVEMENT_REJECTION_BUDGET_KEYS,
      (key) => isSafeInteger(value.budgets[key]) && value.budgets[key] > 0
    )
    && isSafeInteger(value.caseCount)
    && value.caseCount > 0
    && typeof value.fingerprint === 'string'
    && stringTrim(value.fingerprint) !== '';
}

function validFactoryImprovementRejectionSummary(summary) {
  if (
    !hasExactKeys(summary, FACTORY_IMPROVEMENT_REJECTION_SUMMARY_KEYS)
    || !isSafeInteger(summary.attemptedGeneration)
    || summary.attemptedGeneration <= 0
    || summary.authorityTransferred !== false
    || summary.dataOnly !== true
    || typeof summary.factoryId !== 'string'
    || stringTrim(summary.factoryId) === ''
    || !validFactoryImprovementRejectionBenchmark(summary.benchmark)
    || !hasExactKeys(summary.baseline, FACTORY_IMPROVEMENT_REJECTION_BASELINE_KEYS)
    || !isValidArchiveLocator(summary.baseline.archive)
    || summary.baseline.archive.kind !== 'architecture-discovery'
    || !isSafeInteger(summary.baseline.generation)
    || summary.baseline.generation <= 0
    || summary.attemptedGeneration <= summary.baseline.generation
    || typeof summary.baseline.architectureId !== 'string'
    || stringTrim(summary.baseline.architectureId) === ''
    || summary.baseline.architectureFingerprint !== null
      && (
        typeof summary.baseline.architectureFingerprint !== 'string'
        || stringTrim(summary.baseline.architectureFingerprint) === ''
      )
    || !validFactoryImprovementRejectionFitness(summary.baseline.fitness)
    || !hasExactKeys(summary.candidate, FACTORY_IMPROVEMENT_REJECTION_CANDIDATE_KEYS)
    || typeof summary.candidate.adopted !== 'boolean'
    || summary.candidate.adopted !== true
    || typeof summary.candidate.architectureId !== 'string'
    || stringTrim(summary.candidate.architectureId) === ''
    || typeof summary.candidate.architectureFingerprint !== 'string'
    || stringTrim(summary.candidate.architectureFingerprint) === ''
    || !validFactoryImprovementRejectionFitness(summary.candidate.fitness)
    || !hasExactKeys(summary.improvement, FACTORY_IMPROVEMENT_REJECTION_IMPROVEMENT_KEYS)
    || summary.improvement.accepted !== false
    || typeof summary.improvement.benchmarkIdentityStable !== 'boolean'
    || typeof summary.improvement.benchmarkStable !== 'boolean'
    || !hasExactKeys(summary.improvement.deltas, FACTORY_IMPROVEMENT_REJECTION_FITNESS_KEYS)
    || !arrayEvery(
      FACTORY_IMPROVEMENT_REJECTION_FITNESS_KEYS,
      (key) => isFiniteNumber(summary.improvement.deltas[key])
    )
    || typeof summary.improvement.nonRegressing !== 'boolean'
    || typeof summary.improvement.strictlyImproved !== 'boolean'
    || !arrayIsArray(summary.reasons)
    || summary.reasons.length === 0
    || arraySome(
      summary.reasons,
      (reason) => typeof reason !== 'string' || stringTrim(reason) === ''
    )
  ) {
    return false;
  }
  return true;
}

function validFactoryImprovementRejectionHistoryItem(rejection) {
  if (!hasExactKeys(rejection, FACTORY_IMPROVEMENT_REJECTION_HISTORY_KEYS)) {
    return false;
  }
  const {
    archive,
    ...summary
  } = rejection;
  return validFactoryImprovementRejectionSummary(summary)
    && isValidArchiveLocator(archive)
    && archive.kind === 'harness-factory-improvement-rejection';
}

export class HarnessFactoryImprovementRejectionReport {
  constructor({ factory, summary, archive = null, token }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !validFactoryImprovementRejectionSummary(summary)
      || archive !== null
        && (
          !isValidArchiveLocator(archive)
          || archive.kind !== 'harness-factory-improvement-rejection'
        )
    ) {
      throw new TypeError(
        'Harness Factory improvement rejection requires matching trusted data-only evidence'
      );
    }
    if (summary.factoryId !== factory.factoryId) {
      throw new TypeError(
        'Harness Factory improvement rejection factory identity is inconsistent'
      );
    }
    this.factoryId = factory.factoryId;
    this.attemptedGeneration = summary.attemptedGeneration;
    this.baseline = objectFreeze({
      ...summary.baseline,
      archive: objectFreeze({ ...summary.baseline.archive }),
      fitness: objectFreeze({ ...summary.baseline.fitness })
    });
    this.benchmark = objectFreeze({
      ...summary.benchmark,
      budgets: objectFreeze({ ...summary.benchmark.budgets })
    });
    this.candidate = objectFreeze({
      ...summary.candidate,
      fitness: objectFreeze({ ...summary.candidate.fitness })
    });
    this.improvement = objectFreeze({
      ...summary.improvement,
      deltas: objectFreeze({ ...summary.improvement.deltas })
    });
    this.reasons = objectFreeze(arraySlice(summary.reasons));
    this.archive = archive === null ? null : archiveLocator(archive);
    this.archived = this.archive !== null;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_IMPROVEMENT_REJECTIONS, this);
    weakMapSet(
      TRUSTED_HARNESS_FACTORY_IMPROVEMENT_REJECTION_FACTORIES,
      this,
      factory
    );
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryImprovementRejectionReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_IMPROVEMENT_REJECTIONS, report)
    && objectGetPrototypeOf(report) === HarnessFactoryImprovementRejectionReport.prototype;
}

export class HarnessFactoryImprovementRejectionHistoryReport {
  constructor({
    factory,
    consideredRejectionCount,
    rejections,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredRejectionCount)
      || consideredRejectionCount < 0
      || !arrayIsArray(rejections)
      || rejections.length > MAX_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORY_ENTRIES
      || rejections.length > consideredRejectionCount
      || typeof truncated !== 'boolean'
      || truncated !== (
        consideredRejectionCount > MAX_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORY_ENTRIES
      )
      || arraySome(
        rejections,
        (rejection) => !validFactoryImprovementRejectionHistoryItem(rejection)
          || rejection.factoryId !== factory.factoryId
      )
    ) {
      throw new TypeError(
        'Harness Factory improvement rejection history requires trusted data-only evidence'
      );
    }
    this.factoryId = factory.factoryId;
    this.consideredRejectionCount = consideredRejectionCount;
    this.returnedRejectionCount = rejections.length;
    this.maxEntries = MAX_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORY_ENTRIES;
    this.truncated = truncated;
    this.complete = truncated === false;
    this.rejections = objectFreeze(arrayMap(rejections, (rejection) => objectFreeze({
      ...rejection,
      archive: objectFreeze({ ...rejection.archive }),
      baseline: objectFreeze({
        ...rejection.baseline,
        archive: objectFreeze({ ...rejection.baseline.archive }),
        fitness: objectFreeze({ ...rejection.baseline.fitness })
      }),
      benchmark: objectFreeze({
        ...rejection.benchmark,
        budgets: objectFreeze({ ...rejection.benchmark.budgets })
      }),
      candidate: objectFreeze({
        ...rejection.candidate,
        fitness: objectFreeze({ ...rejection.candidate.fitness })
      }),
      improvement: objectFreeze({
        ...rejection.improvement,
        deltas: objectFreeze({ ...rejection.improvement.deltas })
      }),
      reasons: objectFreeze(arraySlice(rejection.reasons))
    })));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORIES, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryImprovementRejectionHistoryReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORIES, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryImprovementRejectionHistoryReport.prototype;
}

function harnessFactoryArchitectureProposalResearchSummary(researchContext) {
  if (researchContext === null) {
    return null;
  }
  if (!isPlainObject(researchContext)) {
    throw new TypeError(
      'Harness Factory architecture proposal research context must be a plain object'
    );
  }
  const normalized = snapshotProcessData(researchContext);
  if (
    normalized.source !== 'STRUCTURED_MEMORY'
    || !isSafeInteger(normalized.resultCount)
    || normalized.resultCount < 0
    || !isPlainObject(normalized.sourceCounts)
    || normalized.dataOnly !== true
    || normalized.historicalOnly !== true
    || normalized.authorityTransferred !== false
  ) {
    throw new TypeError(
      'Harness Factory architecture proposal research context is invalid'
    );
  }
  let sourceCountTotal = 0;
  arrayForEach(objectKeys(normalized.sourceCounts), (source) => {
    const count = normalized.sourceCounts[source];
    if (!isSafeInteger(count) || count < 0) {
      throw new TypeError(
        'Harness Factory architecture proposal research context source counts are invalid'
      );
    }
    sourceCountTotal += count;
  });
  if (sourceCountTotal !== normalized.resultCount) {
    throw new TypeError(
      'Harness Factory architecture proposal research context source counts are invalid'
    );
  }
  return objectFreeze({
    source: normalized.source,
    query: normalized.query,
    sourceCounts: normalized.sourceCounts,
    resultCount: normalized.resultCount,
    dataOnly: true,
    historicalOnly: true,
    authorityTransferred: false
  });
}

function factoryArchitectureConfigurationFromCandidate(candidate) {
  if (!isTrustedAgentArchitectureCandidate(candidate)) {
    throw new TypeError(
      'Harness Factory architecture proposal requires a trusted resolved candidate'
    );
  }
  const policy = candidate.createPolicy();
  const normalizedPolicy = objectFreeze({
    maxEpisodes: policy.maxEpisodes,
    maxToolCallsPerEpisode: policy.maxToolCallsPerEpisode
  });
  return objectFreeze({
    architectureFingerprint: jsonStringify({
      components: candidate.components,
      plannerCandidateId: candidate.plannerCandidate.id,
      policy: jsonStringify(normalizedPolicy)
    }),
    components: candidate.components,
    plannerCandidateId: candidate.plannerCandidate.id,
    policy: normalizedPolicy
  });
}

function factoryArchitectureHistoricalFingerprintCounts(ledger, factoryId) {
  const counts = [];
  const addFingerprint = (fingerprint) => {
    if (
      typeof fingerprint !== 'string'
      || stringTrim(fingerprint) === ''
    ) {
      return;
    }
    const current = arrayFind(
      counts,
      (entry) => entry.fingerprint === fingerprint
    );
    if (current === undefined) {
      arrayPush(counts, { fingerprint, count: 1 });
    } else {
      current.count += 1;
    }
  };
  arrayForEach(
    factoryHistoryFromLedger(ledger, factoryId),
    ({ discovery }) => addFingerprint(discovery.winnerArchitectureFingerprint ?? null)
  );
  arrayForEach(
    ledger.restoreHarnessFactoryImprovementRejections(),
    (rejection) => {
      if (rejection.factoryId === factoryId) {
        addFingerprint(rejection.candidate.architectureFingerprint);
      }
    }
  );
  arrayForEach(
    ledger.restoreHarnessFactoryArchitectureProposals(),
    (batch) => {
      if (batch.factoryId === factoryId) {
        arrayForEach(
          batch.proposals,
          (proposal) => addFingerprint(proposal.architectureFingerprint)
        );
      }
    }
  );
  return objectFreeze(arrayMap(
    counts,
    (entry) => objectFreeze({ ...entry })
  ));
}

const HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_SUMMARY_KEYS = objectFreeze([
  'architectureFingerprint',
  'authorityTransferred',
  'batchDuplicate',
  'components',
  'dataOnly',
  'historicalMatchCount',
  'id',
  'novel',
  'plannerCandidateId',
  'policy',
  'repeated',
  'status'
]);

function validHarnessFactoryArchitectureProposalSummary(proposal) {
  if (
    !isPlainObject(proposal)
    || reflectOwnKeys(proposal).length
      !== HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_SUMMARY_KEYS.length
    || arraySome(
      reflectOwnKeys(proposal),
      (key) => !arrayIncludes(
        HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_SUMMARY_KEYS,
        key
      )
    )
    || typeof proposal.id !== 'string'
    || stringTrim(proposal.id) === ''
    || typeof proposal.plannerCandidateId !== 'string'
    || stringTrim(proposal.plannerCandidateId) === ''
    || typeof proposal.architectureFingerprint !== 'string'
    || stringTrim(proposal.architectureFingerprint) === ''
    || !isPlainObject(proposal.components)
    || !isPlainObject(proposal.policy)
    || !isSafeInteger(proposal.policy.maxEpisodes)
    || proposal.policy.maxEpisodes <= 0
    || !isSafeInteger(proposal.policy.maxToolCallsPerEpisode)
    || proposal.policy.maxToolCallsPerEpisode <= 0
    || !isSafeInteger(proposal.historicalMatchCount)
    || proposal.historicalMatchCount < 0
    || typeof proposal.batchDuplicate !== 'boolean'
    || typeof proposal.novel !== 'boolean'
    || typeof proposal.repeated !== 'boolean'
    || !arrayIncludes(
      [
        HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES.NOVEL,
        HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES.REPEATED
      ],
      proposal.status
    )
    || proposal.novel !== (
      proposal.status === HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES.NOVEL
    )
    || proposal.repeated !== !proposal.novel
    || proposal.novel && (
      proposal.historicalMatchCount !== 0
      || proposal.batchDuplicate
    )
    || proposal.repeated && (
      proposal.historicalMatchCount === 0
      && !proposal.batchDuplicate
    )
    || proposal.dataOnly !== true
    || proposal.authorityTransferred !== false
  ) {
    return false;
  }
  return true;
}

export class HarnessFactoryArchitectureProposalReport {
  constructor({
    factory,
    goal,
    source,
    researchContext,
    proposals,
    archive = null,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || typeof goal !== 'string'
      || stringTrim(goal) === ''
      || !arrayIncludes(
        [HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_SOURCES.PROCESS_ISOLATED],
        source
      )
      || !arrayIsArray(proposals)
      || proposals.length === 0
      || proposals.length > MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_ENTRIES
      || arraySome(
        proposals,
        (proposal) => !validHarnessFactoryArchitectureProposalSummary(proposal)
      )
      || archive !== null
        && (
          !isPlainObject(archive)
          || archive.kind !== 'harness-factory-architecture-proposals'
          || !isSafeInteger(archive.sequence)
          || archive.sequence <= 0
          || typeof archive.hash !== 'string'
          || stringTrim(archive.hash) === ''
        )
    ) {
      throw new TypeError(
        'Harness Factory architecture proposal report requires trusted data-only evidence'
      );
    }
    const normalizedResearchContext =
      harnessFactoryArchitectureProposalResearchSummary(researchContext);
    this.factoryId = factory.factoryId;
    this.goal = stringTrim(goal);
    this.source = source;
    this.researchContext = normalizedResearchContext;
    this.proposalCount = proposals.length;
    this.novelProposalCount = arrayFilter(proposals, ({ novel }) => novel).length;
    this.repeatedProposalCount = arrayFilter(proposals, ({ repeated }) => repeated).length;
    this.archive = archive === null ? null : archiveLocator(archive);
    this.archived = this.archive !== null;
    this.evaluated = false;
    this.adopted = false;
    this.deployed = false;
    this.proposals = objectFreeze(arrayMap(
      proposals,
      (proposal) => objectFreeze({
        ...proposal,
        components: snapshotProcessData(proposal.components),
        policy: objectFreeze({ ...proposal.policy })
      })
    ));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPORTS, this);
    weakMapSet(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_FACTORIES, this, factory);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryArchitectureProposalReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPORTS, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryArchitectureProposalReport.prototype;
}

export class HarnessFactoryArchitectureProposalHistoryReport {
  constructor({
    factory,
    consideredBatchCount,
    batches,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredBatchCount)
      || consideredBatchCount < 0
      || !arrayIsArray(batches)
      || batches.length > MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORY_ENTRIES
      || batches.length > consideredBatchCount
      || typeof truncated !== 'boolean'
      || truncated !== (
        consideredBatchCount
          > MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORY_ENTRIES
      )
      || arraySome(
        batches,
        (batch) => (
          !isPlainObject(batch)
          || batch.factoryId !== factory.factoryId
          || !isValidArchiveLocator(batch.archive)
          || !arrayIsArray(batch.proposals)
          || batch.proposals.length === 0
          || batch.proposalCount !== batch.proposals.length
          || batch.dataOnly !== true
          || batch.authorityTransferred !== false
          || batch.evaluated !== false
          || batch.adopted !== false
          || batch.deployed !== false
        )
      )
    ) {
      throw new TypeError(
        'Harness Factory architecture proposal history requires trusted data-only evidence'
      );
    }
    const archiveSequences = arrayMap(
      batches,
      (batch) => batch.archive.sequence
    );
    if (arraySome(
      archiveSequences,
      (sequence, index) => index > 0 && sequence <= archiveSequences[index - 1]
    )) {
      throw new TypeError(
        'Harness Factory architecture proposal history must preserve archive order'
      );
    }
    this.factoryId = factory.factoryId;
    this.consideredBatchCount = consideredBatchCount;
    this.returnedBatchCount = batches.length;
    this.maxEntries = MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORY_ENTRIES;
    this.truncated = truncated;
    this.complete = truncated === false;
    this.batches = objectFreeze(arrayMap(
      batches,
      (batch) => objectFreeze({
        ...batch,
        archive: objectFreeze({ ...batch.archive }),
        proposals: objectFreeze(arrayMap(
          batch.proposals,
          (proposal) => objectFreeze({
            ...proposal,
            components: snapshotProcessData(proposal.components),
            policy: objectFreeze({ ...proposal.policy })
          })
        ))
      })
    ));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORIES, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryArchitectureProposalHistoryReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORIES, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryArchitectureProposalHistoryReport.prototype;
}

function factoryArchitectureProposalReportFromProcess({
  factory,
  ledger,
  proposalReport,
  resolvedCandidates
}) {
  if (
    !isTrustedHarnessFactory(factory)
    || !isTrustedEvidenceLedger(ledger)
    || proposalReport?.dataOnly !== true
    || !arrayIsArray(proposalReport?.proposals)
    || !arrayIsArray(resolvedCandidates)
    || resolvedCandidates.length !== proposalReport.proposals.length
    || arraySome(
      resolvedCandidates,
      (candidate) => !isTrustedAgentArchitectureCandidate(candidate)
    )
  ) {
    throw new TypeError(
      'Harness Factory architecture proposal report requires trusted process evidence'
    );
  }
  const historicalCounts = factoryArchitectureHistoricalFingerprintCounts(
    ledger,
    factory.factoryId
  );
  const batchFingerprints = [];
  const proposals = arrayMap(
    proposalReport.proposals,
    (proposal, index) => {
      const configuration = factoryArchitectureConfigurationFromCandidate(
        resolvedCandidates[index]
      );
      const historicalMatchCount = arrayFind(
        historicalCounts,
        (entry) => entry.fingerprint === configuration.architectureFingerprint
      )?.count ?? 0;
      const batchDuplicate = arrayIncludes(
        batchFingerprints,
        configuration.architectureFingerprint
      );
      arrayPush(batchFingerprints, configuration.architectureFingerprint);
      const novel = historicalMatchCount === 0 && !batchDuplicate;
      return objectFreeze({
        architectureFingerprint: configuration.architectureFingerprint,
        authorityTransferred: false,
        batchDuplicate,
        components: configuration.components,
        dataOnly: true,
        historicalMatchCount,
        id: proposal.id,
        novel,
        plannerCandidateId: configuration.plannerCandidateId,
        policy: configuration.policy,
        repeated: !novel,
        status: novel
          ? HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES.NOVEL
          : HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_STATUSES.REPEATED
      });
    }
  );
  return new HarnessFactoryArchitectureProposalReport({
    factory,
    goal: proposalReport.goal,
    source: proposalReport.source,
    researchContext: proposalReport.researchContext,
    proposals,
    token: FACTORY_TOKEN
  });
}

function validHarnessFactoryArchitectureCoverageAttempt(attempt) {
  if (
    !isPlainObject(attempt)
    || !isValidArchiveLocator(attempt.archive)
    || typeof attempt.architectureId !== 'string'
    || stringTrim(attempt.architectureId) === ''
    || attempt.architectureFingerprint !== null
      && (
        typeof attempt.architectureFingerprint !== 'string'
        || stringTrim(attempt.architectureFingerprint) === ''
      )
    || !isSafeInteger(attempt.attemptedGeneration)
    || attempt.attemptedGeneration <= 0
    || !arrayIncludes(
      [
        HARNESS_FACTORY_ARCHITECTURE_ATTEMPT_SOURCES.GENERATION,
        HARNESS_FACTORY_ARCHITECTURE_ATTEMPT_SOURCES.IMPROVEMENT_REJECTION
      ],
      attempt.source
    )
    || !arrayIncludes(
      [HARNESS_FACTORY_STATUSES.ADOPTED, HARNESS_FACTORY_STATUSES.REJECTED],
      attempt.outcome
    )
    || typeof attempt.novel !== 'boolean'
    || typeof attempt.repeated !== 'boolean'
    || attempt.novel && attempt.repeated
    || attempt.architectureFingerprint === null
      && (attempt.novel || attempt.repeated)
    || attempt.architectureFingerprint !== null
      && attempt.novel === attempt.repeated
    || attempt.source === HARNESS_FACTORY_ARCHITECTURE_ATTEMPT_SOURCES.GENERATION
      && attempt.archive.kind !== 'architecture-discovery'
    || attempt.source === HARNESS_FACTORY_ARCHITECTURE_ATTEMPT_SOURCES.IMPROVEMENT_REJECTION
      && (
        attempt.archive.kind !== 'harness-factory-improvement-rejection'
        || attempt.outcome !== HARNESS_FACTORY_STATUSES.REJECTED
      )
  ) {
    return false;
  }
  return true;
}

export class HarnessFactoryArchitectureCoverageReport {
  constructor({
    factory,
    consideredAttemptCount,
    uniqueArchitectureCount,
    novelAttemptCount,
    repeatedAttemptCount,
    unknownArchitectureCount,
    adoptedAttemptCount,
    rejectedAttemptCount,
    attempts,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredAttemptCount)
      || consideredAttemptCount < 0
      || !isSafeInteger(uniqueArchitectureCount)
      || uniqueArchitectureCount < 0
      || !isSafeInteger(novelAttemptCount)
      || novelAttemptCount < 0
      || !isSafeInteger(repeatedAttemptCount)
      || repeatedAttemptCount < 0
      || !isSafeInteger(unknownArchitectureCount)
      || unknownArchitectureCount < 0
      || !isSafeInteger(adoptedAttemptCount)
      || adoptedAttemptCount < 0
      || !isSafeInteger(rejectedAttemptCount)
      || rejectedAttemptCount < 0
      || !arrayIsArray(attempts)
      || !arrayEvery(
        attempts,
        validHarnessFactoryArchitectureCoverageAttempt
      )
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError(
        'Harness Factory architecture coverage requires trusted lifecycle evidence'
      );
    }
    if (
      attempts.length > MAX_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_ENTRIES
      || attempts.length > consideredAttemptCount
      || uniqueArchitectureCount !== novelAttemptCount
      || novelAttemptCount + repeatedAttemptCount + unknownArchitectureCount
        !== consideredAttemptCount
      || adoptedAttemptCount + rejectedAttemptCount !== consideredAttemptCount
      || truncated !== (
        consideredAttemptCount > MAX_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_ENTRIES
      )
    ) {
      throw new TypeError('Harness Factory architecture coverage counts are inconsistent');
    }
    this.factoryId = factory.factoryId;
    this.consideredAttemptCount = consideredAttemptCount;
    this.returnedAttemptCount = attempts.length;
    this.maxEntries = MAX_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_ENTRIES;
    this.uniqueArchitectureCount = uniqueArchitectureCount;
    this.novelAttemptCount = novelAttemptCount;
    this.repeatedAttemptCount = repeatedAttemptCount;
    this.unknownArchitectureCount = unknownArchitectureCount;
    this.adoptedAttemptCount = adoptedAttemptCount;
    this.rejectedAttemptCount = rejectedAttemptCount;
    this.truncated = truncated;
    this.attempts = objectFreeze(arrayMap(
      attempts,
      (attempt) => objectFreeze({
        ...attempt,
        archive: objectFreeze({ ...attempt.archive })
      })
    ));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_COVERAGES, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryArchitectureCoverageReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_COVERAGES, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryArchitectureCoverageReport.prototype;
}

const HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_BATCH_KEYS = objectFreeze([
  'archive',
  'convertedFingerprintCount',
  'distinctFingerprintCount',
  'novelProposalCount',
  'proposalCount',
  'replayed',
  'repeatedProposalCount',
  'status',
  'untestedFingerprintCount'
]);

function validHarnessFactoryArchitectureProposalConversionBatch(batch) {
  if (
    !isPlainObject(batch)
    || !hasExactKeys(batch, HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_BATCH_KEYS)
    || !isValidArchiveLocator(batch.archive)
    || batch.archive.kind !== 'harness-factory-architecture-proposals'
    || !isSafeInteger(batch.proposalCount)
    || batch.proposalCount <= 0
    || !isSafeInteger(batch.novelProposalCount)
    || batch.novelProposalCount < 0
    || !isSafeInteger(batch.repeatedProposalCount)
    || batch.repeatedProposalCount < 0
    || batch.novelProposalCount + batch.repeatedProposalCount !== batch.proposalCount
    || !isSafeInteger(batch.distinctFingerprintCount)
    || batch.distinctFingerprintCount <= 0
    || batch.distinctFingerprintCount > batch.proposalCount
    || !isSafeInteger(batch.convertedFingerprintCount)
    || batch.convertedFingerprintCount < 0
    || batch.convertedFingerprintCount > batch.distinctFingerprintCount
    || !isSafeInteger(batch.untestedFingerprintCount)
    || batch.untestedFingerprintCount
      !== batch.distinctFingerprintCount - batch.convertedFingerprintCount
    || typeof batch.replayed !== 'boolean'
    || !arrayIncludes(
      HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUS_VALUES,
      batch.status
    )
    || batch.replayed !== (
      batch.status
        === HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUSES.REPLAYED
    )
    || (
      batch.status === HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUSES.UNTESTED
    ) !== (batch.convertedFingerprintCount === 0)
  ) {
    return false;
  }
  return true;
}

export class HarnessFactoryArchitectureProposalConversionReport {
  constructor({
    factory,
    consideredBatchCount,
    archivedProposalCount,
    archivedFingerprintCount,
    evaluatedFingerprintCount,
    convertedFingerprintCount,
    untestedFingerprintCount,
    conversionRate,
    replayedBatchCount,
    convertedBatchCount,
    untestedBatchCount,
    batches,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredBatchCount)
      || consideredBatchCount < 0
      || !isSafeInteger(archivedProposalCount)
      || archivedProposalCount < 0
      || !isSafeInteger(archivedFingerprintCount)
      || archivedFingerprintCount < 0
      || !isSafeInteger(evaluatedFingerprintCount)
      || evaluatedFingerprintCount < 0
      || !isSafeInteger(convertedFingerprintCount)
      || convertedFingerprintCount < 0
      || !isSafeInteger(untestedFingerprintCount)
      || untestedFingerprintCount < 0
      || !isFiniteNumber(conversionRate)
      || conversionRate < 0
      || conversionRate > 1
      || !isSafeInteger(replayedBatchCount)
      || replayedBatchCount < 0
      || !isSafeInteger(convertedBatchCount)
      || convertedBatchCount < 0
      || !isSafeInteger(untestedBatchCount)
      || untestedBatchCount < 0
      || !arrayIsArray(batches)
      || !arrayEvery(
        batches,
        validHarnessFactoryArchitectureProposalConversionBatch
      )
      || !arrayEvery(
        batches,
        (batch) => batch.archive.kind === 'harness-factory-architecture-proposals'
      )
      || typeof truncated !== 'boolean'
    ) {
      throw new TypeError(
        'Harness Factory proposal conversion requires trusted lifecycle evidence'
      );
    }
    if (
      batches.length > MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES
      || batches.length > consideredBatchCount
      || truncated !== (
        consideredBatchCount
          > MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES
      )
      || convertedFingerprintCount > archivedFingerprintCount
      || archivedFingerprintCount > archivedProposalCount
      || untestedFingerprintCount
        !== archivedFingerprintCount - convertedFingerprintCount
      || replayedBatchCount + convertedBatchCount + untestedBatchCount
        !== consideredBatchCount
      || (
        archivedFingerprintCount === 0
          ? conversionRate !== 0
          : conversionRate !== convertedFingerprintCount / archivedFingerprintCount
      )
    ) {
      throw new TypeError(
        'Harness Factory proposal conversion counts are inconsistent'
      );
    }
    this.factoryId = factory.factoryId;
    this.consideredBatchCount = consideredBatchCount;
    this.returnedBatchCount = batches.length;
    this.maxEntries = MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES;
    this.truncated = truncated;
    this.complete = truncated === false;
    this.archivedProposalCount = archivedProposalCount;
    this.archivedFingerprintCount = archivedFingerprintCount;
    this.evaluatedFingerprintCount = evaluatedFingerprintCount;
    this.convertedFingerprintCount = convertedFingerprintCount;
    this.untestedFingerprintCount = untestedFingerprintCount;
    this.conversionRate = conversionRate;
    this.replayedBatchCount = replayedBatchCount;
    this.convertedBatchCount = convertedBatchCount;
    this.untestedBatchCount = untestedBatchCount;
    this.batches = objectFreeze(arrayMap(
      batches,
      (batch) => objectFreeze({
        ...batch,
        archive: objectFreeze({ ...batch.archive })
      })
    ));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSIONS, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryArchitectureProposalConversionReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSIONS, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryArchitectureProposalConversionReport.prototype;
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
    this.proposalArchive = factoryMetadata.proposalArchive ?? null;
    this.complete = discovery.complete;
    this.primaryComplete = discovery.primary.complete;
    this.reproductionComplete = discovery.reproduction.complete;
    this.reproducible = discovery.reproducibility.reproducible;
    this.freshAdoption = discovery.adopted === true;
    this.proofStatus = discovery.adopted === true ? 'PROVEN' : 'NONE';
    this.researchContext = discovery.proposalReport.researchContext;
    this.improvedFromArchive = usesHarnessFactoryImprovementMemory(
      this.researchContext
    );
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

function researchPlanExecutionArchiveLocators(result) {
  const locators = [];
  const addArchive = (archive) => {
    if (archive === null) {
      return;
    }
    const normalized = archiveLocator(archive);
    if (!arraySome(locators, ({ sequence }) => sequence === normalized.sequence)) {
      arrayPush(locators, normalized);
    }
  };
  if (isTrustedHarnessFactoryReport(result)) {
    addArchive(result.archive);
    addArchive(result.agentArchive);
  } else if (isTrustedHarnessFactoryValidationReport(result)) {
    addArchive(result.archive);
  } else if (isTrustedHarnessFactoryBenchmarkCampaignValidationReport(result)) {
    addArchive(result.archive);
  } else if (
    isTrustedHarnessFactoryBenchmarkFrontierValidationResearchExecutionReport(result)
    || isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport(
      result
    )
  ) {
    addArchive(result.campaignArchive);
    arrayForEach(result.validationArchives, addArchive);
  } else {
    throw new TypeError(
      'Harness Factory research plan execution requires a trusted execution result'
    );
  }
  return objectFreeze(arraySort(
    locators,
    (left, right) => left.sequence - right.sequence
  ));
}

function researchPlanExecutionResultSummary(result) {
  let resultType;
  let resultStatus;
  let targetResolved = true;
  if (isTrustedHarnessFactoryReport(result)) {
    resultType = HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.FACTORY_REPORT;
    resultStatus = result.status;
  } else if (isTrustedHarnessFactoryValidationReport(result)) {
    resultType = HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.VALIDATION;
    resultStatus = result.status;
  } else if (isTrustedHarnessFactoryBenchmarkCampaignValidationReport(result)) {
    resultType = HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.BENCHMARK_VALIDATION;
    resultStatus = result.status;
  } else if (isTrustedHarnessFactoryBenchmarkFrontierValidationResearchExecutionReport(result)) {
    resultType = HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.BENCHMARK_FRONTIER_VALIDATION_RESEARCH;
    resultStatus = result.frontierStatus;
    targetResolved = result.targetResolved;
  } else if (
    isTrustedHarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport(
      result
    )
  ) {
    resultType = HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH;
    resultStatus = result.frontierStatus;
    targetResolved = result.targetResolved;
  } else {
    throw new TypeError(
      'Harness Factory research plan execution requires a trusted execution result'
    );
  }
  if (result.dataOnly !== true || result.authorityTransferred !== false) {
    throw new TypeError(
      'Harness Factory research plan execution result must be data-only and non-authoritative'
    );
  }
  if (
    typeof resultStatus !== 'string'
    || stringTrim(resultStatus) === ''
    || typeof targetResolved !== 'boolean'
  ) {
    throw new TypeError(
      'Harness Factory research plan execution result summary is invalid'
    );
  }
  const resultArchiveLocators = researchPlanExecutionArchiveLocators(result);
  return objectFreeze({
    authorityTransferred: false,
    dataOnly: true,
    resultArchiveLocators,
    resultArchiveSequences: objectFreeze(
      arrayMap(resultArchiveLocators, ({ sequence }) => sequence)
    ),
    resultStatus,
    resultType,
    targetResolved
  });
}

export class HarnessFactoryResearchPlanExecutionReport {
  constructor({
    factory,
    plan,
    result,
    archive = null,
    token
  }) {
    const summary = researchPlanExecutionResultSummary(result);
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isTrustedHarnessFactoryResearchPlanItem(plan, factory)
      || plan.factoryId !== factory.factoryId
      || archive !== null
        && (
          !isPlainObject(archive)
          || archive.kind !== 'harness-factory-research-plan-execution'
          || !isSafeInteger(archive.sequence)
          || archive.sequence <= 0
          || typeof archive.hash !== 'string'
          || stringTrim(archive.hash) === ''
        )
    ) {
      throw new TypeError(
        'Harness Factory research plan execution receipt requires matching trusted evidence'
      );
    }
    this.factoryId = factory.factoryId;
    this.planId = plan.id;
    this.agendaItemId = plan.agendaItemId;
    this.target = plan.target;
    this.bridge = plan.bridge;
    this.executionMethod = plan.executionMethod;
    this.resultType = summary.resultType;
    this.resultStatus = summary.resultStatus;
    this.targetResolved = summary.targetResolved;
    this.resultArchiveLocators = summary.resultArchiveLocators;
    this.resultArchiveSequences = summary.resultArchiveSequences;
    this.result = result;
    this.completed = true;
    this.archive = archive === null ? null : archiveLocator(archive);
    this.archived = this.archive !== null;
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTIONS, this);
    weakMapSet(
      TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_FACTORIES,
      this,
      factory
    );
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryResearchPlanExecutionReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTIONS, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryResearchPlanExecutionReport.prototype;
}

const RESEARCH_PLAN_EXECUTION_HISTORY_ITEM_KEYS = objectFreeze([
  'agendaItemId',
  'archive',
  'authorityTransferred',
  'bridge',
  'dataOnly',
  'factoryId',
  'planId',
  'resultArchiveLocators',
  'resultArchiveSequences',
  'resultStatus',
  'resultType',
  'target',
  'targetResolved'
]);

export class HarnessFactoryResearchPlanExecutionHistoryReport {
  constructor({
    factory,
    consideredExecutionCount,
    executions,
    truncated,
    token
  }) {
    if (
      token !== FACTORY_TOKEN
      || !isTrustedHarnessFactory(factory)
      || !isSafeInteger(consideredExecutionCount)
      || consideredExecutionCount < 0
      || !arrayIsArray(executions)
      || executions.length > MAX_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_HISTORY_ENTRIES
      || executions.length > consideredExecutionCount
      || typeof truncated !== 'boolean'
      || truncated !== (
        consideredExecutionCount > MAX_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_HISTORY_ENTRIES
      )
      || arraySome(
        executions,
        (execution) => (
          !isPlainObject(execution)
          || reflectOwnKeys(execution).length !== RESEARCH_PLAN_EXECUTION_HISTORY_ITEM_KEYS.length
          || arraySome(
            reflectOwnKeys(execution),
            (key) => !arrayIncludes(RESEARCH_PLAN_EXECUTION_HISTORY_ITEM_KEYS, key)
          )
          || execution.factoryId !== factory.factoryId
          || typeof execution.agendaItemId !== 'string'
          || stringTrim(execution.agendaItemId) === ''
          || execution.planId !== `harness-factory-research-plan:${execution.agendaItemId}`
          || !arrayIncludes(
            [
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.BENCHMARK_FRONTIER_VALIDATION,
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.BENCHMARK_VALIDATION,
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FACTORY_RECOMMENDATION,
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FRONTIER_STABILITY,
              HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.HOLDOUT_VALIDATION
            ],
            execution.bridge
          )
          || !arrayIncludes(
            [
              HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.BENCHMARK_FRONTIER_VALIDATION_RESEARCH,
              HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.BENCHMARK_VALIDATION,
              HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH,
              HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.FACTORY_REPORT,
              HARNESS_FACTORY_RESEARCH_PLAN_RESULT_TYPES.VALIDATION
            ],
            execution.resultType
          )
          || typeof execution.target !== 'string'
          || stringTrim(execution.target) === ''
          || typeof execution.resultStatus !== 'string'
          || stringTrim(execution.resultStatus) === ''
          || typeof execution.targetResolved !== 'boolean'
          || !arrayIsArray(execution.resultArchiveSequences)
          || setSize(setFromArray(execution.resultArchiveSequences))
            !== execution.resultArchiveSequences.length
          || !arrayEvery(
            execution.resultArchiveSequences,
            (sequence) => isSafeInteger(sequence) && sequence > 0
          )
          || !arrayIsArray(execution.resultArchiveLocators)
          || execution.resultArchiveLocators.length !== execution.resultArchiveSequences.length
          || !arrayEvery(
            execution.resultArchiveLocators,
            (archive) => isValidArchiveLocator(archive)
          )
          || setSize(setFromArray(arrayMap(
            execution.resultArchiveLocators,
            ({ sequence }) => sequence
          ))) !== execution.resultArchiveLocators.length
          || jsonStringify(arrayMap(
            arraySort(
              arraySlice(execution.resultArchiveLocators),
              (left, right) => left.sequence - right.sequence
            ),
            ({ sequence }) => sequence
          )) !== jsonStringify(execution.resultArchiveSequences)
          || !isPlainObject(execution.archive)
          || execution.archive.kind !== 'harness-factory-research-plan-execution'
          || !isSafeInteger(execution.archive.sequence)
          || execution.archive.sequence <= 0
          || typeof execution.archive.hash !== 'string'
          || stringTrim(execution.archive.hash) === ''
          || execution.dataOnly !== true
          || execution.authorityTransferred !== false
        )
      )
    ) {
      throw new TypeError(
        'Harness Factory research plan execution history requires trusted data-only evidence'
      );
    }
    this.factoryId = factory.factoryId;
    this.consideredExecutionCount = consideredExecutionCount;
    this.returnedExecutionCount = executions.length;
    this.maxEntries = MAX_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_HISTORY_ENTRIES;
    this.truncated = truncated;
    this.complete = truncated === false;
    this.executions = objectFreeze(arrayMap(
      executions,
      (execution) => objectFreeze({
        ...execution,
        archive: objectFreeze({ ...execution.archive }),
        resultArchiveLocators: objectFreeze(arrayMap(
          execution.resultArchiveLocators,
          (archive) => objectFreeze({ ...archive })
        )),
        resultArchiveSequences: objectFreeze(arraySlice(execution.resultArchiveSequences))
      })
    ));
    this.dataOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_HISTORIES, this);
    objectFreeze(this);
  }
}

export function isTrustedHarnessFactoryResearchPlanExecutionHistoryReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_HISTORIES, report)
    && objectGetPrototypeOf(report)
      === HarnessFactoryResearchPlanExecutionHistoryReport.prototype;
}

function factoryResearchPlanExecutionHistoryReportFromLedger(ledger, factory) {
  const restored = ledger.restoreHarnessFactoryResearchPlanExecutions();
  const scoped = arrayFilter(
    restored,
    (execution) => execution.factoryId === factory.factoryId
  );
  const truncated = scoped.length
    > MAX_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_HISTORY_ENTRIES;
  const executions = truncated
    ? arraySlice(
      scoped,
      scoped.length - MAX_HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION_HISTORY_ENTRIES
    )
    : scoped;
  return new HarnessFactoryResearchPlanExecutionHistoryReport({
    factory,
    consideredExecutionCount: scoped.length,
    executions,
    truncated,
    token: FACTORY_TOKEN
  });
}

function factoryImprovementRejectionHistoryReportFromLedger(ledger, factory) {
  const restored = ledger.restoreHarnessFactoryImprovementRejections();
  const scoped = arrayFilter(
    restored,
    (rejection) => rejection.factoryId === factory.factoryId
  );
  const truncated = scoped.length
    > MAX_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORY_ENTRIES;
  const rejections = truncated
    ? arraySlice(
      scoped,
      scoped.length - MAX_HARNESS_FACTORY_IMPROVEMENT_REJECTION_HISTORY_ENTRIES
    )
    : scoped;
  return new HarnessFactoryImprovementRejectionHistoryReport({
    factory,
    consideredRejectionCount: scoped.length,
    rejections,
    truncated,
    token: FACTORY_TOKEN
  });
}

function factoryArchitectureCoverageReportFromLedger(ledger, factory) {
  const discoveries = ledger.restoreArchitectureDiscoveries();
  const rejections = ledger.restoreHarnessFactoryImprovementRejections();
  const attempts = [];
  const seenFingerprints = [];
  let discoveryIndex = 0;
  let rejectionIndex = 0;
  let novelAttemptCount = 0;
  let repeatedAttemptCount = 0;
  let unknownArchitectureCount = 0;
  let adoptedAttemptCount = 0;
  let rejectedAttemptCount = 0;

  arrayForEach(ledger.records, (record) => {
    let factoryId = null;
    let architectureId = null;
    let architectureFingerprint = null;
    let attemptedGeneration = null;
    let outcome = null;
    let source = null;

    if (record.kind === 'architecture-discovery') {
      const discovery = discoveries[discoveryIndex];
      discoveryIndex += 1;
      if (discovery === undefined) {
        throw new Error('Harness Factory architecture coverage discovery order is inconsistent');
      }
      if (discovery.factory !== null) {
        factoryId = discovery.factory.factoryId;
        architectureId = discovery.winnerId;
        architectureFingerprint = discovery.winnerArchitectureFingerprint ?? null;
        attemptedGeneration = discovery.factory.generation;
        outcome = discovery.factory.status;
        source = HARNESS_FACTORY_ARCHITECTURE_ATTEMPT_SOURCES.GENERATION;
      }
    } else if (record.kind === 'harness-factory-improvement-rejection') {
      const rejection = rejections[rejectionIndex];
      rejectionIndex += 1;
      if (rejection === undefined) {
        throw new Error('Harness Factory architecture coverage rejection order is inconsistent');
      }
      factoryId = rejection.factoryId;
      architectureId = rejection.candidate.architectureId;
      architectureFingerprint = rejection.candidate.architectureFingerprint;
      attemptedGeneration = rejection.attemptedGeneration;
      outcome = HARNESS_FACTORY_STATUSES.REJECTED;
      source = HARNESS_FACTORY_ARCHITECTURE_ATTEMPT_SOURCES.IMPROVEMENT_REJECTION;
    }

    if (factoryId !== factory.factoryId) {
      return;
    }
    const hasFingerprint = architectureFingerprint !== null;
    let novel = false;
    let repeated = false;
    if (!hasFingerprint) {
      unknownArchitectureCount += 1;
    } else if (arrayIncludes(seenFingerprints, architectureFingerprint)) {
      repeated = true;
      repeatedAttemptCount += 1;
    } else {
      novel = true;
      novelAttemptCount += 1;
      arrayPush(seenFingerprints, architectureFingerprint);
    }
    if (outcome === HARNESS_FACTORY_STATUSES.ADOPTED) {
      adoptedAttemptCount += 1;
    } else if (outcome === HARNESS_FACTORY_STATUSES.REJECTED) {
      rejectedAttemptCount += 1;
    }
    arrayPush(attempts, objectFreeze({
      archive: archiveLocator(record),
      architectureFingerprint,
      architectureId,
      attemptedGeneration,
      novel,
      outcome,
      repeated,
      source
    }));
  });

  const truncated = attempts.length > MAX_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_ENTRIES;
  const returnedAttempts = truncated
    ? arraySlice(
      attempts,
      attempts.length - MAX_HARNESS_FACTORY_ARCHITECTURE_COVERAGE_ENTRIES
    )
    : attempts;
  return new HarnessFactoryArchitectureCoverageReport({
    factory,
    consideredAttemptCount: attempts.length,
    uniqueArchitectureCount: seenFingerprints.length,
    novelAttemptCount,
    repeatedAttemptCount,
    unknownArchitectureCount,
    adoptedAttemptCount,
    rejectedAttemptCount,
    attempts: returnedAttempts,
    truncated,
    token: FACTORY_TOKEN
  });
}

function factoryArchitectureProposalHistoryReportFromLedger(ledger, factory) {
  const restored = ledger.restoreHarnessFactoryArchitectureProposals();
  const scoped = arrayFilter(
    restored,
    (batch) => batch.factoryId === factory.factoryId
  );
  const truncated = scoped.length
    > MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORY_ENTRIES;
  const batches = truncated
    ? arraySlice(
      scoped,
      scoped.length - MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_HISTORY_ENTRIES
    )
    : scoped;
  return new HarnessFactoryArchitectureProposalHistoryReport({
    factory,
    consideredBatchCount: scoped.length,
    batches,
    truncated,
    token: FACTORY_TOKEN
  });
}

function factoryArchitectureProposalConversionReportFromLedger(ledger, factory) {
  const archivedBatches = arrayFilter(
    ledger.restoreHarnessFactoryArchitectureProposals(),
    (batch) => batch.factoryId === factory.factoryId
  );
  const attempts = [];
  const replayArchives = [];
  arrayForEach(
    factoryHistoryFromLedger(ledger, factory.factoryId),
    ({ discovery, record }) => {
      arrayPush(attempts, {
        fingerprint: discovery.winnerArchitectureFingerprint ?? null,
        sequence: record.sequence
      });
      const proposalArchive = discovery.factory?.proposalArchive ?? null;
      if (proposalArchive !== null) {
        arrayPush(replayArchives, proposalArchive);
      }
    }
  );
  arrayForEach(
    ledger.restoreHarnessFactoryImprovementRejections(),
    (rejection) => {
      if (rejection.factoryId !== factory.factoryId) {
        return;
      }
      arrayPush(attempts, {
        fingerprint: rejection.candidate?.architectureFingerprint ?? null,
        sequence: rejection.archive?.sequence ?? 0
      });
    }
  );

  const evaluatedFingerprints = [];
  arrayForEach(attempts, ({ fingerprint }) => {
    if (
      typeof fingerprint === 'string'
      && stringTrim(fingerprint) !== ''
      && !arrayIncludes(evaluatedFingerprints, fingerprint)
    ) {
      arrayPush(evaluatedFingerprints, fingerprint);
    }
  });

  const archivedFingerprints = [];
  arrayForEach(archivedBatches, (batch) => {
    arrayForEach(batch.proposals, (proposal) => {
      const fingerprint = proposal.architectureFingerprint;
      if (typeof fingerprint !== 'string' || stringTrim(fingerprint) === '') {
        return;
      }
      const existing = arrayFind(
        archivedFingerprints,
        (entry) => entry.fingerprint === fingerprint
      );
      if (existing === undefined) {
        arrayPush(archivedFingerprints, {
          fingerprint,
          firstArchiveSequence: batch.archive.sequence
        });
      } else if (batch.archive.sequence < existing.firstArchiveSequence) {
        existing.firstArchiveSequence = batch.archive.sequence;
      }
    });
  });

  const convertedFingerprints = [];
  arrayForEach(archivedFingerprints, ({ fingerprint, firstArchiveSequence }) => {
    if (
      arrayIncludes(evaluatedFingerprints, fingerprint)
      && arraySome(
        attempts,
        (attempt) => attempt.fingerprint === fingerprint
          && attempt.sequence > firstArchiveSequence
      )
    ) {
      arrayPush(convertedFingerprints, fingerprint);
    }
  });

  let replayedBatchCount = 0;
  let convertedBatchCount = 0;
  let untestedBatchCount = 0;
  let archivedProposalCount = 0;
  const items = [];
  arrayForEach(archivedBatches, (batch) => {
    const distinct = [];
    arrayForEach(batch.proposals, (proposal) => {
      if (!arrayIncludes(distinct, proposal.architectureFingerprint)) {
        arrayPush(distinct, proposal.architectureFingerprint);
      }
    });
    const batchConvertedFingerprintCount = arrayFilter(
      distinct,
      (fingerprint) => arraySome(
        attempts,
        (attempt) => attempt.fingerprint === fingerprint
          && attempt.sequence > batch.archive.sequence
      )
    ).length;
    const replayed = arraySome(
      replayArchives,
      (locator) => sameArchiveLocator(locator, batch.archive)
    );
    let status = HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUSES.UNTESTED;
    if (replayed) {
      status = HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUSES.REPLAYED;
      replayedBatchCount += 1;
    } else if (batchConvertedFingerprintCount > 0) {
      status = HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_STATUSES.CONVERTED;
      convertedBatchCount += 1;
    } else {
      untestedBatchCount += 1;
    }
    archivedProposalCount += batch.proposalCount;
    arrayPush(items, objectFreeze({
      archive: archiveLocator({
        kind: batch.archive.kind,
        sequence: batch.archive.sequence,
        hash: batch.archive.hash
      }),
      convertedFingerprintCount: batchConvertedFingerprintCount,
      distinctFingerprintCount: distinct.length,
      novelProposalCount: batch.novelProposalCount,
      proposalCount: batch.proposalCount,
      replayed,
      repeatedProposalCount: batch.repeatedProposalCount,
      status,
      untestedFingerprintCount: distinct.length - batchConvertedFingerprintCount
    }));
  });

  const truncated = items.length
    > MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES;
  const returnedBatches = truncated
    ? arraySlice(
      items,
      items.length - MAX_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION_ENTRIES
    )
    : items;
  const archivedFingerprintCount = archivedFingerprints.length;
  const convertedFingerprintCount = convertedFingerprints.length;
  return new HarnessFactoryArchitectureProposalConversionReport({
    factory,
    consideredBatchCount: items.length,
    archivedProposalCount,
    archivedFingerprintCount,
    evaluatedFingerprintCount: evaluatedFingerprints.length,
    convertedFingerprintCount,
    untestedFingerprintCount: archivedFingerprintCount - convertedFingerprintCount,
    conversionRate: archivedFingerprintCount === 0
      ? 0
      : convertedFingerprintCount / archivedFingerprintCount,
    replayedBatchCount,
    convertedBatchCount,
    untestedBatchCount,
    batches: returnedBatches,
    truncated,
    token: FACTORY_TOKEN
  });
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

  manufactureFromArchivedProposals(proposalReport, options = {}) {
    requireDataObject(
      options,
      'Harness Factory archived-proposal manufacture options',
      ARCHIVED_PROPOSAL_MANUFACTURE_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    const archived = agentArchitectureProposalReportFromArchivedFactoryReport(
      this,
      proposalReport,
      historicalLedger
    );
    const normalizedGoal = options.goal === undefined
      ? archived.report.goal
      : requireNonEmptyString(options.goal, 'Harness Factory archived-proposal goal');
    if (normalizedGoal !== archived.report.goal) {
      throw new Error(
        'Harness Factory archived-proposal manufacture goal must match the archived proposal goal'
      );
    }
    const {
      plannerCandidates,
      cases,
      productionBudget,
      researchBudget,
      skepticBudget,
      holdoutCases = null,
      holdoutProductionBudget = null,
      holdoutResearchBudget = null,
      holdoutSkepticBudget = null,
      agentGoal = null,
      agentContext = null,
      agentReproduction = 'HarnessFactory.manufactureFromArchivedProposals',
      toolRegistry = null
    } = options;
    const discovery = this.discoveryRunner.discoverFromProposalReport({
      proposalReport: archived.report,
      plannerCandidates,
      cases,
      productionBudget,
      researchBudget,
      skepticBudget
    });
    return manufactureFactory(this, {
      goal: normalizedGoal,
      plannerCandidates,
      cases,
      productionBudget,
      researchBudget,
      skepticBudget,
      researchContext: archived.report.researchContext,
      holdoutCases,
      holdoutProductionBudget,
      holdoutResearchBudget,
      holdoutSkepticBudget,
      archive: true,
      agentGoal,
      agentContext,
      agentReproduction,
      toolRegistry
    }, null, archived.archive, discovery);
  }

  proposeArchitectures(options = {}) {
    requireDataObject(
      options,
      'Harness Factory architecture proposal options',
      ARCHITECTURE_PROPOSAL_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const {
      goal,
      plannerCandidates,
      memoryQuery = null,
      maxMemoryEntries = MAX_STRUCTURED_MEMORY_ENTRIES,
      researchContext = null,
      archive = false
    } = options;
    if (typeof archive !== 'boolean') {
      throw new TypeError('Harness Factory architecture proposal archive must be boolean');
    }
    const normalizedPlannerCandidates = requireTrustedFactoryPlannerCandidates(
      plannerCandidates
    );
    if (
      researchContext !== null
      && !isTrustedStructuredMemoryContext(researchContext)
    ) {
      throw new TypeError(
        'Harness Factory architecture proposal researchContext requires a trusted structured memory context'
      );
    }
    if (memoryQuery !== null && researchContext !== null) {
      throw new TypeError(
        'Harness Factory architecture proposal cannot use researchContext and memoryQuery together'
      );
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    const effectiveResearchContext = memoryQuery === null
      ? researchContext
      : buildStructuredMemoryContext({
        memory: memoryFromLedger({
          ledger: historicalLedger,
          maxEntries: maxMemoryEntries,
          idPrefix: 'harness-factory-architecture-proposal'
        }),
        query: normalizedHarnessFactoryProposalMemoryQuery(memoryQuery)
      });
    if (
      memoryQuery !== null
      && effectiveResearchContext.resultCount === 0
    ) {
      throw new Error(
        'Harness Factory architecture proposal memoryQuery found no matching archive history'
      );
    }
    const proposalRunner = this.discoveryRunner.proposalRunner;
    const proposalReport = proposalRunner.propose({
      goal,
      plannerCandidateIds: arrayMap(
        normalizedPlannerCandidates,
        ({ id }) => id
      ),
      researchContext: effectiveResearchContext
    });
    const resolvedCandidates = proposalRunner.resolve({
      report: proposalReport,
      plannerCandidates: normalizedPlannerCandidates
    });
    const report = factoryArchitectureProposalReportFromProcess({
      factory: this,
      ledger: historicalLedger,
      proposalReport,
      resolvedCandidates
    });
    return archive
      ? this.archiveArchitectureProposals(report)
      : report;
  }

  archiveArchitectureProposals(report) {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (
      !isTrustedHarnessFactoryArchitectureProposalReport(report)
      || weakMapGet(TRUSTED_HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_FACTORIES, report)
        !== this
    ) {
      throw new TypeError(
        'Harness Factory architecture proposal archival requires an exact report from this factory'
      );
    }
    if (
      weakSetHas(ARCHIVED_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS, report)
      || report.archived !== false
      || report.archive !== null
    ) {
      throw new Error('Harness Factory architecture proposal batch has already been archived');
    }
    verifiedLedgerSnapshot(this.ledger);
    const record = this.ledger.appendHarnessFactoryArchitectureProposals(report);
    weakSetAdd(ARCHIVED_HARNESS_FACTORY_ARCHITECTURE_PROPOSALS, report);
    return new HarnessFactoryArchitectureProposalReport({
      factory: this,
      goal: report.goal,
      source: report.source,
      researchContext: report.researchContext,
      proposals: report.proposals,
      archive: record,
      token: FACTORY_TOKEN
    });
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
    const requestedMemorySources = memoryQuery.sources === undefined
      || memoryQuery.sources === null
      ? null
      : snapshotProcessData(memoryQuery.sources);
    if (
      memoryQuery.source !== undefined
      && memoryQuery.source !== null
      && !arrayIncludes(
        HARNESS_FACTORY_IMPROVEMENT_MEMORY_SOURCES,
        memoryQuery.source
      )
    ) {
      throw new TypeError(
        'Harness Factory improvement memoryQuery must use ARCHITECTURE_DISCOVERY source, '
        + 'HARNESS_FACTORY_BENCHMARK_CAMPAIGN source, or '
        + 'HARNESS_FACTORY_BENCHMARK_VALIDATION source, or '
        + 'HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION source, or '
        + 'HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY source, or '
        + 'HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION source, or '
        + 'HARNESS_FACTORY_IMPROVEMENT_REJECTION source, or '
        + 'HARNESS_FACTORY_ARCHITECTURE_COVERAGE source, or '
        + 'HARNESS_FACTORY_ARCHITECTURE_PROPOSAL source, or '
        + 'HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION source'
      );
    }
    if (requestedMemorySources !== null) {
      if (
        !arrayIsArray(requestedMemorySources)
        || requestedMemorySources.length === 0
        || setSize(setFromArray(requestedMemorySources))
          !== requestedMemorySources.length
        || arraySome(
          requestedMemorySources,
          (source) => !arrayIncludes(
            HARNESS_FACTORY_IMPROVEMENT_MEMORY_SOURCES,
            source
          )
        )
      ) {
        throw new TypeError(
          'Harness Factory improvement memoryQuery sources must contain unique supported sources'
        );
      }
      if (memoryQuery.source !== undefined && memoryQuery.source !== null) {
        throw new TypeError(
          'Harness Factory improvement memoryQuery cannot use source and sources together'
        );
      }
    }
    const normalizedMemoryQuery = {
      ...memoryQuery,
      ...(requestedMemorySources === null
        ? {
          source: memoryQuery.source === undefined
            ? MEMORY_SOURCES.ARCHITECTURE_DISCOVERY
            : memoryQuery.source
        }
        : {
          sources: requestedMemorySources
        })
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

  improvementRejections() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryImprovementRejectionHistoryReportFromLedger(
      historicalLedger,
      this
    );
  }

  architectureCoverage() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryArchitectureCoverageReportFromLedger(
      historicalLedger,
      this
    );
  }

  architectureProposalHistory() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryArchitectureProposalHistoryReportFromLedger(
      historicalLedger,
      this
    );
  }

  architectureProposalConversion() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryArchitectureProposalConversionReportFromLedger(
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

  benchmarkFrontierValidationScorecard() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryBenchmarkFrontierValidationScorecardFromLedger(
      historicalLedger,
      this
    );
  }

  benchmarkFrontierValidationStability() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryBenchmarkFrontierValidationStabilityFromLedger(
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
    const benchmarkFrontierValidationScorecard =
      factoryBenchmarkFrontierValidationScorecardFromLedger(
        historicalLedger,
        this
      );
    const benchmarkFrontierValidationStability =
      factoryBenchmarkFrontierValidationStabilityFromLedger(
        historicalLedger,
        this
      );
    return factoryResearchAgendaFromHistory({
      factory: this,
      history,
      validations,
      benchmarkValidations,
      benchmarkFrontierValidationScorecard,
      benchmarkFrontierValidationStability,
      maxItems
    });
  }

  researchPlan(options = {}) {
    requireDataObject(
      options,
      'Harness Factory research plan options',
      RESEARCH_PLAN_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    return factoryResearchPlanFromAgenda({
      factory: this,
      agenda: this.researchAgenda(options)
    });
  }

  executeResearchPlan(plan, options = {}) {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    return this.executeResearchPlanReceipt(plan, options).result;
  }

  executeResearchPlanReceipt(plan, options = {}) {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const result = this.#executeResearchPlanCore(plan, options);
    const pending = new HarnessFactoryResearchPlanExecutionReport({
      factory: this,
      plan,
      result,
      token: FACTORY_TOKEN
    });
    verifiedLedgerSnapshot(this.ledger);
    const record = this.ledger.appendHarnessFactoryResearchPlanExecution(pending);
    return new HarnessFactoryResearchPlanExecutionReport({
      factory: this,
      plan,
      result,
      archive: record,
      token: FACTORY_TOKEN
    });
  }

  researchPlanExecutions() {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    const historicalLedger = verifiedLedgerSnapshot(this.ledger);
    return factoryResearchPlanExecutionHistoryReportFromLedger(
      historicalLedger,
      this
    );
  }

  #executeResearchPlanCore(plan, options = {}) {
    requireDataObject(
      options,
      'Harness Factory research plan execution options',
      RESEARCH_PLAN_EXECUTION_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (!isTrustedHarnessFactoryResearchPlanItem(plan, this)) {
      throw new TypeError(
        'Harness Factory research plan execution requires an exact plan from this factory'
      );
    }
    const currentPlan = this.researchPlan();
    const currentPlanItem = arrayFind(
      currentPlan.plans,
      ({ id }) => id === plan.id
    );
    if (
      currentPlanItem === undefined
      || jsonStringify(currentPlanItem) !== jsonStringify(plan)
    ) {
      throw new Error('Harness Factory research plan is stale');
    }
    const currentAgenda = this.researchAgenda();
    const target = arrayFind(
      currentAgenda.items,
      ({ id }) => id === plan.agendaItemId
    );
    if (target === undefined) {
      throw new Error('Harness Factory research plan agenda item is stale');
    }
    if (plan.bridge === HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FACTORY_RECOMMENDATION) {
      const recommendation = this.recommend();
      const expectedStatus = plan.target === HARNESS_FACTORY_RESEARCH_TARGETS.RECOVER_FAILED_HOLDOUT
        ? HARNESS_FACTORY_RECOMMENDATION_STATUSES.RECOVER_FAILED_HOLDOUT
        : HARNESS_FACTORY_RECOMMENDATION_STATUSES.IMPROVE_LATEST_GENERATION;
      if (recommendation.status !== expectedStatus) {
        throw new Error('Harness Factory research plan recommendation is stale');
      }
      return this.executeRecommendation(recommendation, options);
    }
    if (plan.bridge === HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.HOLDOUT_VALIDATION) {
      const recommendation = this.recommend();
      if (
        recommendation.status
          !== HARNESS_FACTORY_RECOMMENDATION_STATUSES.VALIDATE_LATEST_HOLDOUT
      ) {
        throw new Error('Harness Factory research plan holdout recommendation is stale');
      }
      const validation = this.validateRecommendation(recommendation, options);
      return this.archiveValidation(validation);
    }
    if (
      plan.bridge === HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.BENCHMARK_VALIDATION
    ) {
      return this.executeBenchmarkValidationResearch(target, options);
    }
    if (
      plan.bridge === HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.BENCHMARK_FRONTIER_VALIDATION
    ) {
      return this.executeBenchmarkFrontierValidationResearch(target, options);
    }
    if (plan.bridge === HARNESS_FACTORY_RESEARCH_PLAN_BRIDGES.FRONTIER_STABILITY) {
      return this.executeBenchmarkFrontierValidationStabilityResearch(target, options);
    }
    throw new Error(
      'Harness Factory research plan requires an operator-supplied experiment for this target'
    );
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

  executeBenchmarkFrontierValidationResearch(target, options = {}) {
    requireDataObject(
      options,
      'Harness Factory frontier validation research execution options',
      BENCHMARK_FRONTIER_VALIDATION_RESEARCH_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (!isTrustedHarnessFactoryResearchAgendaItem(target, this)) {
      throw new TypeError(
        'Harness Factory frontier validation research requires an exact agenda item from this factory'
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
      throw new Error(
        'Harness Factory frontier validation research target is stale'
      );
    }
    if (
      target.target
        !== HARNESS_FACTORY_RESEARCH_TARGETS.COMPLETE_BENCHMARK_FRONTIER_VALIDATION
    ) {
      throw new Error(
        'Harness Factory frontier validation research target is not executable by the frontier bridge'
      );
    }
    const {
      campaign,
      points,
      cases,
      holdoutCases,
      holdoutProductionBudget,
      holdoutResearchBudget,
      holdoutSkepticBudget,
      archive = true
    } = options;
    if (archive !== true) {
      throw new TypeError(
        'Harness Factory frontier validation research execution requires archive true'
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
        'Harness Factory frontier validation research requires an exact archived campaign from this factory'
      );
    }
    if (
      !sameArchiveLocator(
        campaign.archive,
        target.frontierValidation.campaignArchive
      )
    ) {
      throw new Error(
        'Harness Factory frontier validation research campaign does not match the target'
      );
    }
    const normalizedPoints = requireTrustedBenchmarkFrontierValidationResearchPoints(
      points,
      target,
      campaign
    );
    const validations = arrayMap(
      normalizedPoints,
      ({ candidate, levelId }) => validateFactoryBenchmarkCampaign({
        factory: this,
        campaign,
        candidate,
        levelId,
        cases,
        holdoutCases,
        holdoutProductionBudget,
        holdoutResearchBudget,
        holdoutSkepticBudget
      })
    );
    const archivedValidations = arrayMap(
      validations,
      (validation) => this.archiveBenchmarkCampaignValidation(validation)
    );
    const scorecard = this.benchmarkFrontierValidationScorecard();
    return new HarnessFactoryBenchmarkFrontierValidationResearchExecutionReport({
      factory: this,
      target,
      campaign,
      validations: archivedValidations,
      scorecard,
      token: FACTORY_TOKEN
    });
  }

  executeBenchmarkFrontierValidationStabilityResearch(target, options = {}) {
    requireDataObject(
      options,
      'Harness Factory frontier stability research execution options',
      BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (!isTrustedHarnessFactoryResearchAgendaItem(target, this)) {
      throw new TypeError(
        'Harness Factory frontier stability research requires an exact agenda item from this factory'
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
      throw new Error(
        'Harness Factory frontier stability research target is stale'
      );
    }
    if (
      target.target
        !== HARNESS_FACTORY_RESEARCH_TARGETS.INVESTIGATE_BENCHMARK_FRONTIER_STABILITY
    ) {
      throw new Error(
        'Harness Factory frontier stability research target is not executable by the stability bridge'
      );
    }
    if (
      target.frontierStability.stabilityStatus
        !== HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_STATUSES.UNSTABLE
    ) {
      throw new Error(
        'Harness Factory frontier stability research target is not unstable'
      );
    }
    const {
      campaign,
      points,
      cases,
      holdoutCases,
      holdoutProductionBudget,
      holdoutResearchBudget,
      holdoutSkepticBudget,
      archive = true
    } = options;
    if (archive !== true) {
      throw new TypeError(
        'Harness Factory frontier stability research execution requires archive true'
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
        'Harness Factory frontier stability research requires an exact archived campaign from this factory'
      );
    }
    if (
      !sameArchiveLocator(
        campaign.archive,
        target.frontierStability.latestCampaignArchive
      )
    ) {
      throw new Error(
        'Harness Factory frontier stability research campaign does not match the target'
      );
    }
    const normalizedPoints =
      requireTrustedBenchmarkFrontierValidationStabilityResearchPoints(
        points,
        target,
        campaign
      );
    const validations = arrayMap(
      normalizedPoints,
      ({ candidate, levelId }) => validateFactoryBenchmarkCampaign({
        factory: this,
        campaign,
        candidate,
        levelId,
        cases,
        holdoutCases,
        holdoutProductionBudget,
        holdoutResearchBudget,
        holdoutSkepticBudget
      })
    );
    const archivedValidations = arrayMap(
      validations,
      (validation) => this.archiveBenchmarkCampaignValidation(validation)
    );
    const stability = this.benchmarkFrontierValidationStability();
    return new HarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport({
      factory: this,
      target,
      campaign,
      validations: archivedValidations,
      stability,
      token: FACTORY_TOKEN
    });
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

  validateBenchmarkCampaignFrontier(options = {}) {
    requireDataObject(
      options,
      'Harness Factory benchmark frontier validation options',
      BENCHMARK_CAMPAIGN_FRONTIER_VALIDATION_OPTIONS_KEYS
    );
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    return validateFactoryBenchmarkCampaignFrontier({
      factory: this,
      campaign: options.campaign,
      points: options.points,
      cases: options.cases,
      holdoutCases: options.holdoutCases,
      holdoutProductionBudget: options.holdoutProductionBudget,
      holdoutResearchBudget: options.holdoutResearchBudget,
      holdoutSkepticBudget: options.holdoutSkepticBudget
    });
  }

  archiveBenchmarkCampaignFrontierValidations(frontierValidation) {
    if (!isTrustedHarnessFactory(this)) {
      throw new TypeError('Harness Factory requires an exact trusted factory');
    }
    if (
      !isTrustedHarnessFactoryBenchmarkFrontierValidationReport(frontierValidation)
      || weakMapGet(
        TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_FACTORIES,
        frontierValidation
      ) !== this
    ) {
      throw new TypeError(
        'Harness Factory benchmark frontier archival requires an exact validation from this factory'
      );
    }
    if (
      weakSetHas(
        ARCHIVED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATIONS,
        frontierValidation
      )
      || frontierValidation.archived !== false
    ) {
      throw new Error(
        'Harness Factory benchmark frontier validation has already been archived'
      );
    }
    const campaign = weakMapGet(
      TRUSTED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_CAMPAIGNS,
      frontierValidation
    );
    if (!isTrustedHarnessFactoryBenchmarkCampaignReport(campaign)) {
      throw new TypeError(
        'Harness Factory benchmark frontier validation source campaign is not trusted'
      );
    }
    const ledger = verifiedLedgerSnapshot(this.ledger);
    verifyArchivedBenchmarkCampaign({ factory: this, campaign, ledger });
    if (arraySome(frontierValidation.validations, ({ archived }) => archived)) {
      throw new Error(
        'Harness Factory benchmark frontier validation contains an archived point'
      );
    }
    const archivedValidations = arrayMap(
      frontierValidation.validations,
      (validation) => this.archiveBenchmarkCampaignValidation(validation)
    );
    weakSetAdd(
      ARCHIVED_HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATIONS,
      frontierValidation
    );
    return new HarnessFactoryBenchmarkFrontierValidationReport({
      factory: this,
      campaign,
      validations: archivedValidations,
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
objectFreeze(HarnessFactoryResearchPlanReport.prototype);
objectFreeze(HarnessFactoryBenchmarkReport.prototype);
objectFreeze(HarnessFactoryBenchmarkCampaignReport.prototype);
objectFreeze(HarnessFactoryBenchmarkCampaignHistoryReport.prototype);
objectFreeze(HarnessFactoryBenchmarkCampaignValidationHistoryReport.prototype);
objectFreeze(HarnessFactoryBenchmarkValidationScorecardReport.prototype);
objectFreeze(HarnessFactoryBenchmarkValidationStabilityReport.prototype);
objectFreeze(HarnessFactoryBenchmarkFrontierValidationScorecardReport.prototype);
objectFreeze(HarnessFactoryBenchmarkFrontierValidationStabilityReport.prototype);
objectFreeze(HarnessFactoryBenchmarkCampaignValidationReport.prototype);
objectFreeze(HarnessFactoryBenchmarkFrontierValidationReport.prototype);
objectFreeze(HarnessFactoryBenchmarkFrontierValidationResearchExecutionReport.prototype);
objectFreeze(HarnessFactoryBenchmarkFrontierValidationStabilityResearchExecutionReport.prototype);
objectFreeze(HarnessFactoryValidationReport.prototype);
objectFreeze(HarnessFactoryImprovementRejectionReport.prototype);
objectFreeze(HarnessFactoryImprovementRejectionHistoryReport.prototype);
objectFreeze(HarnessFactoryArchitectureProposalReport.prototype);
objectFreeze(HarnessFactoryArchitectureProposalHistoryReport.prototype);
objectFreeze(HarnessFactoryArchitectureProposalConversionReport.prototype);
objectFreeze(HarnessFactoryArchitectureCoverageReport.prototype);
objectFreeze(HarnessFactoryReport.prototype);
objectFreeze(HarnessFactory.prototype);
