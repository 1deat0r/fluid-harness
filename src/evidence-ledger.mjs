import { createHash } from 'node:crypto';

import {
  AGENT_STOP_REASONS,
  isTrustedAgentRunReport
} from './agent.mjs';
import {
  isTrustedAgentArchitectureCoordinationReport
} from './agent-architecture-coordination.mjs';
import {
  isTrustedAgentArchitectureDiscoveryReport
} from './agent-architecture-discovery.mjs';
import {
  isTrustedHarnessFactoryBenchmarkCampaignReport,
  isTrustedHarnessFactoryBenchmarkCampaignValidationReport,
  isTrustedHarnessFactoryValidationReport
} from './harness-factory.mjs';
import {
  isTrustedMemoryAwareAgentCoordinationReport
} from './memory-agent-coordination.mjs';
import {
  isTrustedMemoryAwareAgentSessionReport
} from './memory-agent-session.mjs';
import {
  MAXIMUM_MEMORY_AGENT_ENSEMBLE_SIZE,
  MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE,
  isTrustedMemoryAwareAgentEnsembleReport
} from './memory-agent-ensemble.mjs';
import {
  ADVERSARIAL_LINEAGE_TYPES,
  isTrustedAdversarialLineageReport
} from './adversarial-lineage.mjs';
import {
  MAX_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE,
  MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE,
  isTrustedAdversarialLineageEnsembleReport
} from './adversarial-lineage-ensemble.mjs';
import {
  DISTRIBUTION_SHIFT_STATUSES,
  MAX_DISTRIBUTION_SHIFT_CASES,
  MIN_DISTRIBUTION_SHIFT_CASES,
  isTrustedDistributionShiftReport
} from './distribution-shift.mjs';
import { isTrustedConstitutionalCore } from './constitution.mjs';
import { isTrustedCycleReport } from './cycle.mjs';
import { EVIDENCE_LEVELS } from './evidence.mjs';
import { AGENT_POLICY_LIMITS } from './evolution.mjs';
import { POLICY_MODES } from './evaluation.mjs';
import { isTrustedActionReport } from './harness.mjs';
import {
  TOOL_INVOCATION_STATUSES,
  isTrustedToolInvocationReport
} from './tool.mjs';
import {
  SURPRISE_BANDS,
  WorldModel,
  surpriseFromLikelihood
} from './world-model.mjs';
import {
  arrayAt,
  arrayEvery,
  arrayFind,
  arrayForEach,
  arrayFilter,
  arrayIncludes,
  arrayIsArray,
  arrayJoin,
  arrayMap,
  arrayPush,
  arraySlice,
  arraySort,
  arraySome,
  isFiniteNumber,
  isInteger,
  isSafeInteger,
  isPlainObject,
  jsonParse,
  jsonStringify,
  objectDefineProperty,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectHasOwn,
  objectIs,
  objectKeys,
  objectValues,
  reflectOwnKeys,
  setFromArray,
  setSize,
  stringFrom,
  stringTrim,
  toNumber,
  weakMapCreate,
  weakMapGet,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetDelete,
  weakSetHas
} from './intrinsics.mjs';

export const EVIDENCE_LEDGER_FORMAT = 'fluid-evidence-ledger/v1';

const LEDGER_SCHEMA_VERSION = 1;
const GENESIS_HASH = 'genesis';
const LEDGER_KINDS = objectFreeze([
  'action',
  'cycle',
  'core',
  'agent-run',
  'adversarial-lineage',
  'adversarial-lineage-ensemble',
  'distribution-shift',
  'architecture-coordination',
  'architecture-discovery',
  'harness-factory-benchmark-campaign',
  'harness-factory-benchmark-validation',
  'harness-factory-validation',
  'memory-aware-ensemble',
  'memory-aware-coordination',
  'memory-aware-session'
]);
const MODEL_HISTORY_KEYS = objectFreeze([
  'actualObservation',
  'evidence',
  'expectedLikelihood',
  'observationLikelihood',
  'predictionError',
  'strategyKey',
  'surpriseBand',
  'surpriseNats',
  'verified'
]);
const RESEARCH_QUEUE_KEYS = objectFreeze([
  'action',
  'actionNumber',
  'evidence',
  'policyMode',
  'reason',
  'researchRequested',
  'researchRequired',
  'surpriseBand',
  'taskId'
]);
const RESEARCH_QUEUE_ACTION_KEYS = objectFreeze([
  'environmentHash',
  'evidence',
  'predictionError',
  'strategyKey',
  'surpriseNats'
]);
const AGENT_RUN_KEYS = objectFreeze([
  'architectureId',
  'attemptedEpisodes',
  'auditValid',
  'completed',
  'coreStatus',
  'cycles',
  'error',
  'pendingResearch',
  'plannerId',
  'policy',
  'stopReason',
  'toolInvocations'
]);
const LEGACY_AGENT_RUN_KEYS = objectFreeze([
  'attemptedEpisodes',
  'auditValid',
  'completed',
  'coreStatus',
  'cycles',
  'error',
  'pendingResearch',
  'plannerId',
  'policy',
  'stopReason',
  'toolInvocations'
]);
const AGENT_POLICY_KEYS = objectFreeze([
  'dataOnly',
  'maxEpisodes',
  'maxToolCallsPerEpisode'
]);
const AGENT_TOOL_INVOCATION_KEYS = objectFreeze([
  'callId',
  'durationMs',
  'error',
  'evidence',
  'input',
  'isolated',
  'output',
  'status',
  'stderr',
  'toolId',
  'verified'
]);
const ADVERSARIAL_LINEAGE_KEYS = objectFreeze([
  'adversarialCases',
  'adversarialSuccessRate',
  'adversarialSuccesses',
  'attemptedCases',
  'authorityTransferred',
  'candidateId',
  'complete',
  'dataOnly',
  'eligibleCases',
  'historicalOnly',
  'lineageId',
  'lineageType',
  'mode',
  'productionEligible',
  'proofEligibleCases',
  'proven',
  'results',
  'skippedCases',
  'successRate',
  'successes',
  'weaknessesExposed'
]);
const ADVERSARIAL_LINEAGE_RESULT_KEYS = objectFreeze([
  'adversarial',
  'caseId',
  'domain',
  'error',
  'expected',
  'proven',
  'representation',
  'requiresProof',
  'success',
  'surpriseBand',
  'surpriseNats',
  'verifierId'
]);
const ADVERSARIAL_LINEAGE_ENSEMBLE_KEYS = objectFreeze([
  'adversarialCases',
  'adversarialSuccessRate',
  'adversarialSuccesses',
  'attemptedCases',
  'authorityTransferred',
  'candidateId',
  'complete',
  'dataOnly',
  'eligibleCases',
  'eligibleEvaluations',
  'ensembleId',
  'evaluatedCases',
  'historicalOnly',
  'independent',
  'lineageCount',
  'lineageType',
  'lineages',
  'mode',
  'productionEligible',
  'proofEligibleCases',
  'proven',
  'skippedCases',
  'successRate',
  'successes',
  'weaknessesExposed'
]);
const DISTRIBUTION_SHIFT_KEYS = objectFreeze([
  'attemptedCases',
  'authorityTransferred',
  'baseline',
  'baselineSuccess',
  'candidateId',
  'complete',
  'dataOnly',
  'domain',
  'evidence',
  'historicalOnly',
  'independent',
  'productionEligible',
  'requiresReview',
  'robust',
  'shiftCount',
  'shiftSuccessRate',
  'shiftSuccesses',
  'shifts',
  'status',
  'successRate',
  'successes',
  'suiteId',
  'taskId',
  'weaknessesExposed'
]);
const DISTRIBUTION_SHIFT_RESULT_KEYS = objectFreeze([
  'adversarial',
  'caseId',
  'domain',
  'error',
  'expected',
  'proven',
  'representation',
  'requiresProof',
  'role',
  'success',
  'surpriseBand',
  'surpriseNats',
  'taskId',
  'verifierId'
]);
const ARCHITECTURE_COORDINATION_KEYS = objectFreeze([
  'allRoundsComplete',
  'allRoundsProven',
  'allRoundsQuorumMet',
  'context',
  'dataOnly',
  'deployed',
  'finalQuorumMet',
  'goal',
  'messagesDataOnly',
  'peerMessages',
  'reproduction',
  'roundCount',
  'rounds',
  'transcriptFingerprint'
]);
const ARCHITECTURE_COORDINATION_ROUND_KEYS = objectFreeze([
  'allComplete',
  'allProven',
  'attemptedAgents',
  'auditValid',
  'completedAgents',
  'context',
  'goal',
  'members',
  'provenAgents',
  'quorum',
  'quorumMet',
  'reproduction',
  'round'
]);
const ARCHITECTURE_COORDINATION_MEMBER_KEYS = objectFreeze([
  'agentId',
  'auditValid',
  'completed',
  'error',
  'index',
  'proven',
  'stopReason'
]);
const ARCHITECTURE_COORDINATION_PEER_KEYS = objectFreeze([
  'agentId',
  'auditValid',
  'completed',
  'error',
  'memberIndex',
  'proven',
  'round',
  'stopReason'
]);
const ARCHITECTURE_DISCOVERY_KEYS = objectFreeze([
  'adopted',
  'adoptedArchitectureFingerprint',
  'adoptionCandidateId',
  'adoptionReasons',
  'allAuditsValid',
  'authorityTransferred',
  'candidates',
  'complete',
  'dataOnly',
  'deployed',
  'goal',
  'primary',
  'proposalSource',
  'proposals',
  'reproducibility',
  'reproduction',
  'transcriptFingerprint',
  'winnerArchitectureFingerprint',
  'winnerId'
]);
const ARCHITECTURE_DISCOVERY_FACTORY_KEYS = objectFreeze([
  'benchmark',
  'dataOnly',
  'factoryId',
  'generation',
  'improvement',
  'predecessor',
  'status'
]);
const ARCHITECTURE_DISCOVERY_FACTORY_BENCHMARK_KEYS = objectFreeze([
  'budgets',
  'caseCount',
  'fingerprint'
]);
const ARCHITECTURE_DISCOVERY_FACTORY_BUDGET_KEYS = objectFreeze([
  'production',
  'research',
  'skeptic'
]);
const ARCHITECTURE_DISCOVERY_FACTORY_IMPROVEMENT_KEYS = objectFreeze([
  'accepted',
  'baselineSequence',
  'benchmarkStable',
  'nonRegressing',
  'strictlyImproved'
]);
const ARCHITECTURE_DISCOVERY_FACTORY_HOLDOUT_KEYS = objectFreeze([
  'architectureId',
  'attemptedCases',
  'authorityTransferred',
  'caseCount',
  'caseIds',
  'complete',
  'dataOnly',
  'independent',
  'passed',
  'primaryComplete',
  'proofEligibleCases',
  'proven',
  'provenRate',
  'reproducibilityReasons',
  'reproducible',
  'reproductionComplete',
  'successRate',
  'successes'
]);
const ARCHITECTURE_DISCOVERY_FACTORY_KEYS_WITH_HOLDOUT = objectFreeze([
  'benchmark',
  'dataOnly',
  'factoryId',
  'generation',
  'holdout',
  'improvement',
  'predecessor',
  'status'
]);
const ARCHITECTURE_DISCOVERY_FACTORY_PREDECESSOR_KEYS = objectFreeze([
  'hash',
  'kind',
  'sequence'
]);
const HARNESS_FACTORY_VALIDATION_KEYS = objectFreeze([
  'architectureFingerprint',
  'architectureId',
  'authorityTransferred',
  'baseline',
  'baselineGeneration',
  'dataOnly',
  'factoryId',
  'holdout',
  'status'
]);
const HARNESS_FACTORY_VALIDATION_BASELINE_KEYS = objectFreeze([
  'hash',
  'kind',
  'sequence'
]);
const HARNESS_FACTORY_BENCHMARK_CAMPAIGN_KEYS = objectFreeze([
  'authorityTransferred',
  'candidateIds',
  'caseFingerprint',
  'caseIds',
  'complete',
  'dataOnly',
  'deployed',
  'factoryId',
  'frontier',
  'independent',
  'points',
  'reproducible'
]);
const HARNESS_FACTORY_BENCHMARK_CAMPAIGN_POINT_KEYS = objectFreeze([
  'architectureFingerprint',
  'architectureId',
  'authorityTransferred',
  'budgets',
  'complete',
  'computeUnits',
  'dataOnly',
  'elapsedMs',
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
const HARNESS_FACTORY_BENCHMARK_CAMPAIGN_BUDGET_KEYS = objectFreeze([
  'production',
  'research',
  'skeptic'
]);
const HARNESS_FACTORY_BENCHMARK_VALIDATION_KEYS = objectFreeze([
  'architectureFingerprint',
  'authorityTransferred',
  'benchmarkMatch',
  'benchmarkPoint',
  'campaignArchive',
  'campaignPoint',
  'candidateId',
  'caseFingerprint',
  'caseIds',
  'complete',
  'dataOnly',
  'deployed',
  'factoryId',
  'holdout',
  'independent',
  'levelId',
  'passed',
  'reproducible',
  'status'
]);
const ARCHITECTURE_DISCOVERY_KEYS_WITH_FACTORY = objectFreeze([
  'adopted',
  'adoptedArchitectureFingerprint',
  'adoptionCandidateId',
  'adoptionReasons',
  'allAuditsValid',
  'authorityTransferred',
  'candidates',
  'complete',
  'dataOnly',
  'deployed',
  'factory',
  'goal',
  'primary',
  'proposalSource',
  'proposals',
  'reproducibility',
  'reproduction',
  'transcriptFingerprint',
  'winnerArchitectureFingerprint',
  'winnerId'
]);
const ARCHITECTURE_DISCOVERY_PROPOSAL_KEYS = objectFreeze([
  'components',
  'dataOnly',
  'id',
  'plannerCandidateId',
  'policy'
]);
const ARCHITECTURE_DISCOVERY_CANDIDATE_KEYS = objectFreeze([
  'architectureFingerprint',
  'components',
  'description',
  'id',
  'plannerCandidateId',
  'policyDefinitionFingerprint'
]);
const ARCHITECTURE_DISCOVERY_SEARCH_KEYS = objectFreeze([
  'allAuditsValid',
  'complete',
  'results',
  'winnerId'
]);
const ARCHITECTURE_DISCOVERY_RESULT_KEYS = objectFreeze([
  'architectureFingerprint',
  'architectureId',
  'complete',
  'description',
  'error',
  'fitness',
  'planner',
  'policyDefinitionFingerprint'
]);
const ARCHITECTURE_DISCOVERY_FITNESS_KEYS = objectFreeze([
  'productionProvenRate',
  'productionSuccessRate',
  'researchProvenRate',
  'researchSuccessRate',
  'skepticSuccessRate',
  'skepticWeaknessesExposed',
  'transferSuccessRate'
]);
const ARCHITECTURE_DISCOVERY_PLANNER_KEYS = objectFreeze([
  'allAuditsValid',
  'complete',
  'results',
  'winnerId'
]);
const ARCHITECTURE_DISCOVERY_PLANNER_RESULT_KEYS = objectFreeze([
  'candidateId',
  'complete',
  'definitionFingerprint',
  'error',
  'fitness',
  'production',
  'research',
  'skeptic'
]);
const ARCHITECTURE_DISCOVERY_PLANNER_FITNESS_KEYS = objectFreeze([
  'productionProvenRate',
  'productionSuccessRate',
  'researchProvenRate',
  'researchSuccessRate',
  'skepticSuccessRate',
  'skepticWeaknessesExposed',
  'transferProvenRate',
  'transferSuccessRate'
]);
const ARCHITECTURE_DISCOVERY_MODE_KEYS = objectFreeze([
  'adversarialCases',
  'adversarialSuccessRate',
  'adversarialSuccesses',
  'attemptedCases',
  'budgetMaxCases',
  'candidateId',
  'complete',
  'definitionFingerprint',
  'eligibleCases',
  'mode',
  'proofEligibleCases',
  'proven',
  'provenRate',
  'results',
  'skippedCases',
  'successRate',
  'successes',
  'transferMatrix',
  'weaknessesExposed'
]);
const ARCHITECTURE_DISCOVERY_MODE_RESULT_KEYS = objectFreeze([
  'adversarial',
  'caseId',
  'domain',
  'error',
  'expected',
  'plannerId',
  'proven',
  'requiresProof',
  'stopReason',
  'success'
]);
const ARCHITECTURE_DISCOVERY_TRANSFER_KEYS = objectFreeze([
  'cases',
  'domain',
  'provenRate',
  'successRate',
  'successes'
]);
const ARCHITECTURE_DISCOVERY_REPRODUCIBILITY_KEYS = objectFreeze([
  'architectureFingerprint',
  'candidateId',
  'reasons',
  'reproducible'
]);
const MEMORY_AWARE_COORDINATION_KEYS = objectFreeze([
  'allRoundsComplete',
  'allRoundsProven',
  'allRoundsQuorumMet',
  'authorityTransferred',
  'context',
  'dataOnly',
  'expectedPersistedRuns',
  'finalQuorumMet',
  'goal',
  'ledgerLengthAfter',
  'ledgerLengthBefore',
  'messagesDataOnly',
  'peerMessages',
  'persistedRuns',
  'persistence',
  'persistenceComplete',
  'query',
  'reproduction',
  'roundConsensus',
  'roundCount',
  'rounds',
  'transcriptFingerprint'
]);
const MEMORY_AWARE_ENSEMBLE_KEYS = objectFreeze([
  'allComplete',
  'allProven',
  'attemptedAgents',
  'auditValid',
  'authorityTransferred',
  'completedAgents',
  'context',
  'dataOnly',
  'goal',
  'members',
  'provenAgents',
  'query',
  'quorum',
  'quorumMet',
  'reproduction'
]);
const MEMORY_AWARE_ENSEMBLE_MEMBER_KEYS = objectFreeze([
  'actionEvidence',
  'actionsUsed',
  'architectureId',
  'auditValid',
  'authorityTransferred',
  'completed',
  'dataOnly',
  'error',
  'index',
  'memoryResultCount',
  'plannerId',
  'previousArchitectureId',
  'proven'
]);
const MEMORY_AWARE_COORDINATION_ROUND_KEYS = objectFreeze([
  'allComplete',
  'allProven',
  'attemptedAgents',
  'auditValid',
  'completedAgents',
  'context',
  'dataOnly',
  'goal',
  'members',
  'provenAgents',
  'quorum',
  'quorumMet',
  'reproduction',
  'round'
]);
const MEMORY_AWARE_COORDINATION_MEMBER_KEYS = objectFreeze([
  'actionsUsed',
  'architectureId',
  'auditValid',
  'authorityTransferred',
  'completed',
  'dataOnly',
  'error',
  'index',
  'memoryResultCount',
  'plannerId',
  'previousArchitectureId',
  'proven'
]);
const MEMORY_AWARE_COORDINATION_PEER_KEYS = objectFreeze([
  'actionsUsed',
  'architectureId',
  'auditValid',
  'authorityTransferred',
  'completed',
  'dataOnly',
  'error',
  'memberIndex',
  'memoryResultCount',
  'plannerId',
  'previousArchitectureId',
  'proven',
  'round'
]);
const MEMORY_AWARE_COORDINATION_PERSISTENCE_KEYS = objectFreeze([
  'architectureId',
  'error',
  'index',
  'ledgerLength',
  'persisted',
  'sequence'
]);
const MEMORY_AWARE_COORDINATION_CONSENSUS_KEYS = objectFreeze([
  'allComplete',
  'allProven',
  'attemptedAgents',
  'auditValidAgents',
  'authorityTransferred',
  'completedAgents',
  'dataOnly',
  'failedAgents',
  'provenAgents',
  'quorum',
  'quorumMet',
  'round'
]);
const MEMORY_AWARE_SESSION_KEYS = objectFreeze([
  'adopted',
  'agentGoal',
  'allRoundsProven',
  'architectureFingerprint',
  'architectureGoal',
  'architectureId',
  'authorityTransferred',
  'constitutionalMutation',
  'context',
  'coordination',
  'dataOnly',
  'deployed',
  'discoverySummary',
  'finalQuorumMet',
  'freshAgents',
  'ledgerLengthAfter',
  'ledgerLengthBefore',
  'persistenceComplete',
  'query',
  'reproduction',
  'transcriptFingerprint'
]);
const MEMORY_AWARE_SESSION_DISCOVERY_KEYS = objectFreeze([
  'adopted',
  'architectureFingerprint',
  'architectureId',
  'authorityTransferred',
  'candidateCount',
  'complete',
  'dataOnly',
  'goal',
  'proposalCount',
  'reproducible',
  'winnerId'
]);
const TRUSTED_EVIDENCE_LEDGERS = weakSetCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requireKind(value) {
  const kind = requireNonEmptyString(value, 'Evidence ledger kind');
  if (!arrayIncludes(LEDGER_KINDS, kind)) {
    throw new RangeError(`Unknown evidence ledger kind: ${kind}`);
  }
  return kind;
}

function snapshotData(value, seen = weakMapCreate(), ancestors = weakSetCreate()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!isFiniteNumber(value)) {
      throw new TypeError('Evidence ledger values must contain finite numbers');
    }
    return value;
  }
  if (
    value === undefined
    || typeof value === 'function'
    || typeof value === 'symbol'
    || typeof value === 'bigint'
  ) {
    throw new TypeError('Evidence ledger values must be JSON-compatible data');
  }
  if (weakSetHas(ancestors, value)) {
    throw new TypeError('Evidence ledger values must not contain cycles');
  }
  const existing = weakMapGet(seen, value);
  if (existing !== undefined) {
    return existing;
  }
  if (!arrayIsArray(value) && !isPlainObject(value)) {
    throw new TypeError('Evidence ledger values must use plain objects and arrays');
  }

  const copy = arrayIsArray(value) ? [] : {};
  weakMapSet(seen, value, copy);
  weakSetAdd(ancestors, value);
  try {
    arrayForEach(reflectOwnKeys(value), (key) => {
      if (arrayIsArray(value) && key === 'length') {
        return;
      }
      const descriptor = objectGetOwnPropertyDescriptor(value, key);
      if (
        typeof key === 'symbol'
        || !descriptor?.enumerable
        || descriptor.get
        || descriptor.set
      ) {
        throw new TypeError(
          'Evidence ledger values must contain enumerable data properties only'
        );
      }
      if (arrayIsArray(value)) {
        const index = toNumber(key);
        if (
          !isInteger(index)
          || index < 0
          || index >= value.length
          || stringFrom(index) !== key
        ) {
          throw new TypeError('Evidence ledger arrays must be dense and index-only');
        }
      }
      objectDefineProperty(copy, key, {
        value: snapshotData(descriptor.value, seen, ancestors),
        enumerable: true,
        writable: true,
        configurable: true
      });
    });
    if (arrayIsArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!objectHasOwn(value, stringFrom(index))) {
          throw new TypeError('Evidence ledger arrays must be dense');
        }
      }
    }
  } finally {
    weakSetDelete(ancestors, value);
  }
  return objectFreeze(copy);
}

function stableSerialize(value, ancestors = weakSetCreate()) {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return jsonStringify(value);
  }
  if (typeof value === 'number') {
    if (!isFiniteNumber(value)) {
      throw new TypeError('Evidence ledger hashes require finite numbers');
    }
    return jsonStringify(value);
  }
  if (arrayIsArray(value)) {
    if (weakSetHas(ancestors, value)) {
      throw new TypeError('Evidence ledger values must not contain cycles');
    }
    weakSetAdd(ancestors, value);
    try {
      return `[${arrayJoin(arrayMap(value, (entry) => stableSerialize(entry, ancestors)), ',')}]`;
    } finally {
      weakSetDelete(ancestors, value);
    }
  }
  if (typeof value === 'object') {
    if (weakSetHas(ancestors, value)) {
      throw new TypeError('Evidence ledger values must not contain cycles');
    }
    weakSetAdd(ancestors, value);
    try {
      return `{${arrayJoin(arrayMap(arraySort(objectKeys(value)), (key) => (
        `${jsonStringify(key)}:${stableSerialize(value[key], ancestors)}`
      )), ',')}}`;
    } finally {
      weakSetDelete(ancestors, value);
    }
  }
  throw new TypeError('Evidence ledger values must be JSON-compatible data');
}

function hashFor({ schemaVersion, sequence, kind, payload, previousHash }) {
  const material = stableSerialize({
    schemaVersion,
    sequence,
    kind,
    payload,
    previousHash
  });
  return `sha256:${createHash('sha256').update(material).digest('hex')}`;
}

function strategySnapshot(strategy) {
  return {
    representation: strategy.representation,
    reasoningEngine: strategy.reasoningEngine,
    executionSubstrate: strategy.executionSubstrate,
    selection: {
      representation: strategy.selection.representation,
      confidence: strategy.selection.confidence,
      ambiguous: strategy.selection.ambiguous,
      candidates: strategy.selection.candidates
    }
  };
}

function actionPayload(report) {
  return snapshotData({
    taskId: report.taskId,
    strategy: strategySnapshot(report.strategy),
    prediction: {
      expectedObservation: report.prediction.expectedObservation,
      expectedLikelihood: report.prediction.expectedLikelihood,
      mismatchLikelihood: report.prediction.mismatchLikelihood,
      strategyKey: report.prediction.strategyKey
    },
    observation: report.observation.actualObservation,
    input: report.input,
    result: report.result,
    predictionError: report.predictionError,
    surpriseNats: report.surpriseNats,
    surpriseBand: report.surpriseBand,
    evidence: report.evidence,
    verification: report.verification === null
      ? null
      : {
        verifierId: report.verification.verifierId,
        passed: report.verification.passed,
        deterministic: report.verification.deterministic,
        checks: report.verification.checks,
        environmentHash: report.verification.environmentHash,
        reproduction: report.verification.reproduction
      },
    invariantsChecked: report.invariantsChecked,
    environmentHash: report.environmentHash,
    reproduction: report.reproduction,
    priorStrategyProfile: report.priorStrategyProfile,
    strategyProfile: report.strategyProfile
  });
}

function researchPayload(research) {
  if (research === null) {
    return null;
  }
  return {
    complete: research.complete,
    allAuditsValid: research.allAuditsValid,
    winner: research.winner?.candidateId ?? null,
    promoted: research.promoted?.candidateId ?? null,
    results: arrayMap(research.results, (result) => ({
      candidateId: result.candidateId,
      promoted: result.promoted,
      auditValid: result.auditValid,
      error: result.error,
      fitness: result.fitness,
      decision: result.decision
    }))
  };
}

function cyclePayload(cycle) {
  return snapshotData({
    taskId: cycle.taskId,
    actionNumber: cycle.actionNumber,
    action: actionPayload(cycle.action),
    stages: cycle.stages,
    questionDecision: {
      requested: cycle.questionDecision.requested,
      reason: cycle.questionDecision.reason,
      automatic: cycle.questionDecision.automatic,
      researchRequested: cycle.questionDecision.researchRequested,
      researchCompleted: cycle.questionDecision.researchCompleted,
      researchRequired: cycle.questionDecision.researchRequired,
      evidence: cycle.questionDecision.evidence,
      surpriseBand: cycle.questionDecision.surpriseBand
    },
    research: researchPayload(cycle.research),
    coreStatus: cycle.coreStatus
  });
}

function agentPolicyPayload(policy) {
  if (policy === null) {
    return null;
  }
  return {
    dataOnly: policy.dataOnly,
    maxEpisodes: policy.maxEpisodes,
    maxToolCallsPerEpisode: policy.maxToolCallsPerEpisode
  };
}

function toolInvocationPayload(invocation) {
  return {
    callId: invocation.callId,
    durationMs: invocation.durationMs,
    error: invocation.error,
    evidence: invocation.evidence,
    input: invocation.input,
    isolated: invocation.isolated,
    output: invocation.output,
    status: invocation.status,
    stderr: invocation.stderr,
    toolId: invocation.toolId,
    verified: invocation.verified
  };
}

function agentRunPayload(report, architectureId = null) {
  const normalizedArchitectureId = architectureId === null
    ? null
    : requireNonEmptyString(
      architectureId,
      'Evidence ledger agent-run architectureId'
    );
  return snapshotData({
    attemptedEpisodes: report.attemptedEpisodes,
    architectureId: normalizedArchitectureId,
    auditValid: report.auditValid,
    completed: report.completed,
    coreStatus: report.coreStatus,
    cycles: arrayMap(report.cycles, (cycle) => cyclePayload(cycle)),
    error: report.error,
    pendingResearch: report.pendingResearch,
    plannerId: report.plannerId,
    policy: agentPolicyPayload(report.policy),
    stopReason: report.stopReason,
    toolInvocations: arrayMap(report.toolInvocations, (invocation) => (
      toolInvocationPayload(invocation)
    ))
  });
}

function adversarialLineageResultPayload(result) {
  return {
    adversarial: result.adversarial,
    caseId: result.caseId,
    domain: result.domain,
    error: result.error,
    expected: result.expected,
    proven: result.proven,
    representation: result.representation,
    requiresProof: result.requiresProof,
    success: result.success,
    surpriseBand: result.surpriseBand,
    surpriseNats: result.surpriseNats,
    verifierId: result.verifierId
  };
}

function adversarialLineagePayload(report) {
  if (!isTrustedAdversarialLineageReport(report)) {
    throw new TypeError(
      'Evidence ledger adversarial-lineage entries require a trusted lineage report'
    );
  }
  return {
    adversarialCases: report.adversarialCases,
    adversarialSuccessRate: report.adversarialSuccessRate,
    adversarialSuccesses: report.adversarialSuccesses,
    attemptedCases: report.attemptedCases,
    authorityTransferred: report.authorityTransferred,
    candidateId: report.candidateId,
    complete: report.complete,
    dataOnly: report.dataOnly,
    eligibleCases: report.eligibleCases,
    historicalOnly: report.historicalOnly,
    lineageId: report.lineageId,
    lineageType: report.lineageType,
    mode: report.mode,
    productionEligible: report.productionEligible,
    proofEligibleCases: report.proofEligibleCases,
    proven: report.proven,
    results: arrayMap(report.results, adversarialLineageResultPayload),
    skippedCases: report.skippedCases,
    successRate: report.successRate,
    successes: report.successes,
    weaknessesExposed: report.weaknessesExposed
  };
}

function adversarialLineageSummaryPayload(lineage) {
  return {
    adversarialCases: lineage.adversarialCases,
    adversarialSuccessRate: lineage.adversarialSuccessRate,
    adversarialSuccesses: lineage.adversarialSuccesses,
    attemptedCases: lineage.attemptedCases,
    authorityTransferred: false,
    candidateId: lineage.candidateId,
    complete: lineage.complete,
    dataOnly: true,
    eligibleCases: lineage.eligibleCases,
    historicalOnly: true,
    lineageId: lineage.lineageId,
    lineageType: lineage.lineageType,
    mode: lineage.mode,
    productionEligible: false,
    proofEligibleCases: lineage.proofEligibleCases,
    proven: lineage.proven,
    results: arrayMap(lineage.results, adversarialLineageResultPayload),
    skippedCases: lineage.skippedCases,
    successRate: lineage.successRate,
    successes: lineage.successes,
    weaknessesExposed: lineage.weaknessesExposed
  };
}

function adversarialLineageEnsemblePayload(report) {
  if (!isTrustedAdversarialLineageEnsembleReport(report)) {
    throw new TypeError(
      'Evidence ledger adversarial-lineage-ensemble entries require a trusted ensemble report'
    );
  }
  return {
    adversarialCases: report.adversarialCases,
    adversarialSuccessRate: report.adversarialSuccessRate,
    adversarialSuccesses: report.adversarialSuccesses,
    attemptedCases: report.attemptedCases,
    authorityTransferred: report.authorityTransferred,
    candidateId: report.candidateId,
    complete: report.complete,
    dataOnly: report.dataOnly,
    eligibleCases: report.eligibleCases,
    eligibleEvaluations: report.eligibleEvaluations,
    ensembleId: report.ensembleId,
    evaluatedCases: report.evaluatedCases,
    historicalOnly: report.historicalOnly,
    independent: report.independent,
    lineageCount: report.lineageCount,
    lineageType: report.lineageType,
    lineages: arrayMap(report.lineages, adversarialLineageSummaryPayload),
    mode: report.mode,
    productionEligible: report.productionEligible,
    proofEligibleCases: report.proofEligibleCases,
    proven: report.proven,
    skippedCases: report.skippedCases,
    successRate: report.successRate,
    successes: report.successes,
    weaknessesExposed: report.weaknessesExposed
  };
}

function distributionShiftResultPayload(result) {
  return {
    adversarial: result.adversarial,
    caseId: result.caseId,
    domain: result.domain,
    error: result.error,
    expected: result.expected,
    proven: result.proven,
    representation: result.representation,
    requiresProof: result.requiresProof,
    role: result.role,
    success: result.success,
    surpriseBand: result.surpriseBand,
    surpriseNats: result.surpriseNats,
    taskId: result.taskId,
    verifierId: result.verifierId
  };
}

function distributionShiftPayload(report) {
  if (!isTrustedDistributionShiftReport(report)) {
    throw new TypeError(
      'Evidence ledger distribution-shift entries require a trusted distribution-shift report'
    );
  }
  return {
    attemptedCases: report.attemptedCases,
    authorityTransferred: false,
    baseline: distributionShiftResultPayload(report.baseline),
    baselineSuccess: report.baselineSuccess,
    candidateId: report.candidateId,
    complete: report.complete,
    dataOnly: true,
    domain: report.domain,
    evidence: report.evidence,
    historicalOnly: true,
    independent: report.independent,
    productionEligible: false,
    requiresReview: report.requiresReview,
    robust: report.robust,
    shiftCount: report.shiftCount,
    shiftSuccessRate: report.shiftSuccessRate,
    shiftSuccesses: report.shiftSuccesses,
    shifts: arrayMap(report.shifts, distributionShiftResultPayload),
    status: report.status,
    successRate: report.successRate,
    successes: report.successes,
    suiteId: report.suiteId,
    taskId: report.taskId,
    weaknessesExposed: report.weaknessesExposed
  };
}

function optionalString(value, field) {
  if (value !== null && typeof value !== 'string') {
    throw new TypeError(`${field} must be null or a string`);
  }
  return value;
}

function optionalNonEmptyString(value, field) {
  if (value !== null) {
    requireNonEmptyString(value, field);
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${field} must be boolean`);
  }
  return value;
}

function architectureCoordinationFingerprintBody(value) {
  return {
    allRoundsComplete: value.allRoundsComplete,
    allRoundsProven: value.allRoundsProven,
    allRoundsQuorumMet: value.allRoundsQuorumMet,
    context: value.context,
    dataOnly: value.dataOnly,
    deployed: value.deployed,
    finalQuorumMet: value.finalQuorumMet,
    goal: value.goal,
    messagesDataOnly: value.messagesDataOnly,
    peerMessages: value.peerMessages,
    reproduction: value.reproduction,
    roundCount: value.roundCount,
    rounds: value.rounds
  };
}

function architectureCoordinationFingerprint(value) {
  return `sha256:${createHash('sha256')
    .update(stableSerialize(architectureCoordinationFingerprintBody(value)))
    .digest('hex')}`;
}

function architectureCoordinationMemberPayload(member) {
  return {
    agentId: member.agentId,
    auditValid: member.auditValid,
    completed: member.completed,
    error: member.error,
    index: member.index,
    proven: member.proven,
    stopReason: member.runReport?.stopReason ?? null
  };
}

function architectureCoordinationPeerPayload(peer) {
  return {
    agentId: peer.agentId,
    auditValid: peer.auditValid,
    completed: peer.completed,
    error: peer.error,
    memberIndex: peer.memberIndex,
    proven: peer.proven,
    round: peer.round,
    stopReason: peer.stopReason
  };
}

function architectureCoordinationRoundPayload(round, index) {
  return {
    allComplete: round.allComplete,
    allProven: round.allProven,
    attemptedAgents: round.attemptedAgents,
    auditValid: round.auditValid,
    completedAgents: round.completedAgents,
    context: round.context,
    goal: round.goal,
    members: arrayMap(round.members, architectureCoordinationMemberPayload),
    provenAgents: round.provenAgents,
    quorum: round.quorum,
    quorumMet: round.quorumMet,
    reproduction: round.reproduction,
    round: index + 1
  };
}

function architectureCoordinationPayload(report) {
  if (!isTrustedAgentArchitectureCoordinationReport(report)) {
    throw new TypeError(
      'Evidence ledger architecture-coordination entries require a trusted coordination report'
    );
  }
  const body = architectureCoordinationFingerprintBody({
    allRoundsComplete: report.allRoundsComplete,
    allRoundsProven: report.allRoundsProven,
    allRoundsQuorumMet: report.allRoundsQuorumMet,
    context: report.context,
    dataOnly: true,
    deployed: report.deployed,
    finalQuorumMet: report.finalQuorumMet,
    goal: report.goal,
    messagesDataOnly: report.messagesDataOnly,
    peerMessages: arrayMap(
      report.peerMessages,
      (messages) => arrayMap(messages, architectureCoordinationPeerPayload)
    ),
    reproduction: report.reproduction,
    roundCount: report.roundCount,
    rounds: arrayMap(report.rounds, architectureCoordinationRoundPayload)
  });
  return {
    ...body,
    transcriptFingerprint: architectureCoordinationFingerprint(body)
  };
}

function normalizeArchitectureCoordinationMember(member, index) {
  const normalized = snapshotData(member);
  if (!isPlainObject(normalized) || !hasExactKeys(normalized, ARCHITECTURE_COORDINATION_MEMBER_KEYS)) {
    throw new TypeError(
      `Evidence ledger architecture-coordination member ${index} has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.agentId,
    `Evidence ledger architecture-coordination member ${index} agentId`
  );
  if (!isSafeInteger(normalized.index) || normalized.index < 0) {
    throw new TypeError(
      `Evidence ledger architecture-coordination member ${index} index is invalid`
    );
  }
  requireBoolean(normalized.auditValid, 'Evidence ledger architecture-coordination member auditValid');
  requireBoolean(normalized.completed, 'Evidence ledger architecture-coordination member completed');
  requireBoolean(normalized.proven, 'Evidence ledger architecture-coordination member proven');
  optionalString(normalized.error, 'Evidence ledger architecture-coordination member error');
  optionalString(
    normalized.stopReason,
    'Evidence ledger architecture-coordination member stopReason'
  );
  if (
    normalized.stopReason !== null
    && !arrayIncludes(objectValues(AGENT_STOP_REASONS), normalized.stopReason)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-coordination member ${index} stopReason is invalid`
    );
  }
  return objectFreeze({
    agentId: normalized.agentId,
    auditValid: normalized.auditValid,
    completed: normalized.completed,
    error: normalized.error,
    index: normalized.index,
    proven: normalized.proven,
    stopReason: normalized.stopReason
  });
}

function normalizeArchitectureCoordinationPeer(peer, index) {
  const normalized = snapshotData(peer);
  if (!isPlainObject(normalized) || !hasExactKeys(normalized, ARCHITECTURE_COORDINATION_PEER_KEYS)) {
    throw new TypeError(
      `Evidence ledger architecture-coordination peer message ${index} has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.agentId,
    `Evidence ledger architecture-coordination peer message ${index} agentId`
  );
  if (!isSafeInteger(normalized.memberIndex) || normalized.memberIndex < 0) {
    throw new TypeError(
      `Evidence ledger architecture-coordination peer message ${index} memberIndex is invalid`
    );
  }
  if (!isSafeInteger(normalized.round) || normalized.round <= 0) {
    throw new TypeError(
      `Evidence ledger architecture-coordination peer message ${index} round is invalid`
    );
  }
  requireBoolean(normalized.auditValid, 'Evidence ledger architecture-coordination peer auditValid');
  requireBoolean(normalized.completed, 'Evidence ledger architecture-coordination peer completed');
  requireBoolean(normalized.proven, 'Evidence ledger architecture-coordination peer proven');
  optionalString(normalized.error, 'Evidence ledger architecture-coordination peer error');
  optionalString(
    normalized.stopReason,
    'Evidence ledger architecture-coordination peer stopReason'
  );
  if (
    normalized.stopReason !== null
    && !arrayIncludes(objectValues(AGENT_STOP_REASONS), normalized.stopReason)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-coordination peer ${index} stopReason is invalid`
    );
  }
  return objectFreeze({
    agentId: normalized.agentId,
    auditValid: normalized.auditValid,
    completed: normalized.completed,
    error: normalized.error,
    memberIndex: normalized.memberIndex,
    proven: normalized.proven,
    round: normalized.round,
    stopReason: normalized.stopReason
  });
}

function trueCount(values, key) {
  let count = 0;
  arrayForEach(values, (value) => {
    if (value[key] === true) {
      count += 1;
    }
  });
  return count;
}

function normalizeArchitectureCoordinationRound(round, index, topGoal) {
  const normalized = snapshotData(round);
  if (!isPlainObject(normalized) || !hasExactKeys(normalized, ARCHITECTURE_COORDINATION_ROUND_KEYS)) {
    throw new TypeError(
      `Evidence ledger architecture-coordination round ${index + 1} has an invalid shape`
    );
  }
  const expectedRound = index + 1;
  if (normalized.round !== expectedRound) {
    throw new TypeError(
      `Evidence ledger architecture-coordination round ${index + 1} number is invalid`
    );
  }
  requireNonEmptyString(
    normalized.goal,
    `Evidence ledger architecture-coordination round ${index + 1} goal`
  );
  if (normalized.goal !== topGoal) {
    throw new TypeError(
      `Evidence ledger architecture-coordination round ${index + 1} goal does not match transcript`
    );
  }
  requireNonEmptyString(
    normalized.reproduction,
    `Evidence ledger architecture-coordination round ${index + 1} reproduction`
  );
  if (normalized.context !== null && !isPlainObject(normalized.context)) {
    throw new TypeError(
      `Evidence ledger architecture-coordination round ${index + 1} context is invalid`
    );
  }
  if (!arrayIsArray(normalized.members) || normalized.members.length === 0) {
    throw new TypeError(
      `Evidence ledger architecture-coordination round ${index + 1} members are invalid`
    );
  }
  const members = objectFreeze(arrayMap(
    normalized.members,
    normalizeArchitectureCoordinationMember
  ));
  if (
    !isSafeInteger(normalized.attemptedAgents)
    || normalized.attemptedAgents !== members.length
  ) {
    throw new TypeError(
      `Evidence ledger architecture-coordination round ${index + 1} attemptedAgents is invalid`
    );
  }
  if (
    !isSafeInteger(normalized.completedAgents)
    || normalized.completedAgents !== trueCount(members, 'completed')
    || !isSafeInteger(normalized.provenAgents)
    || normalized.provenAgents !== trueCount(members, 'proven')
  ) {
    throw new TypeError(
      `Evidence ledger architecture-coordination round ${index + 1} member counts are invalid`
    );
  }
  if (!isSafeInteger(normalized.quorum) || normalized.quorum < 1 || normalized.quorum > members.length) {
    throw new TypeError(
      `Evidence ledger architecture-coordination round ${index + 1} quorum is invalid`
    );
  }
  requireBoolean(normalized.auditValid, 'Evidence ledger architecture-coordination round auditValid');
  requireBoolean(normalized.allComplete, 'Evidence ledger architecture-coordination round allComplete');
  requireBoolean(normalized.allProven, 'Evidence ledger architecture-coordination round allProven');
  requireBoolean(normalized.quorumMet, 'Evidence ledger architecture-coordination round quorumMet');
  if (
    normalized.auditValid !== arrayEvery(members, (member) => member.auditValid)
    || normalized.allComplete !== (normalized.completedAgents === normalized.attemptedAgents)
    || normalized.allProven !== (normalized.provenAgents === normalized.attemptedAgents)
    || normalized.quorumMet !== (normalized.provenAgents >= normalized.quorum)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-coordination round summary is inconsistent`
    );
  }
  return objectFreeze({
    allComplete: normalized.allComplete,
    allProven: normalized.allProven,
    attemptedAgents: normalized.attemptedAgents,
    auditValid: normalized.auditValid,
    completedAgents: normalized.completedAgents,
    context: normalized.context,
    goal: normalized.goal,
    members,
    provenAgents: normalized.provenAgents,
    quorum: normalized.quorum,
    quorumMet: normalized.quorumMet,
    reproduction: normalized.reproduction,
    round: normalized.round
  });
}

function normalizeArchitectureCoordinationPayload(payload) {
  const normalized = snapshotData(payload);
  if (!isPlainObject(normalized) || !hasExactKeys(normalized, ARCHITECTURE_COORDINATION_KEYS)) {
    throw new TypeError('Evidence ledger architecture-coordination payload has an invalid shape');
  }
  requireNonEmptyString(normalized.goal, 'Evidence ledger architecture-coordination goal');
  requireNonEmptyString(
    normalized.reproduction,
    'Evidence ledger architecture-coordination reproduction'
  );
  if (normalized.context !== null && !isPlainObject(normalized.context)) {
    throw new TypeError('Evidence ledger architecture-coordination context is invalid');
  }
  requireBoolean(normalized.dataOnly, 'Evidence ledger architecture-coordination dataOnly');
  requireBoolean(normalized.deployed, 'Evidence ledger architecture-coordination deployed');
  requireBoolean(
    normalized.messagesDataOnly,
    'Evidence ledger architecture-coordination messagesDataOnly'
  );
  if (normalized.dataOnly !== true || normalized.deployed !== false || normalized.messagesDataOnly !== true) {
    throw new TypeError('Evidence ledger architecture-coordination proof boundary is invalid');
  }
  requireBoolean(
    normalized.allRoundsComplete,
    'Evidence ledger architecture-coordination allRoundsComplete'
  );
  requireBoolean(
    normalized.allRoundsProven,
    'Evidence ledger architecture-coordination allRoundsProven'
  );
  requireBoolean(
    normalized.allRoundsQuorumMet,
    'Evidence ledger architecture-coordination allRoundsQuorumMet'
  );
  requireBoolean(
    normalized.finalQuorumMet,
    'Evidence ledger architecture-coordination finalQuorumMet'
  );
  if (!isSafeInteger(normalized.roundCount) || normalized.roundCount <= 0) {
    throw new TypeError('Evidence ledger architecture-coordination roundCount is invalid');
  }
  if (!arrayIsArray(normalized.rounds) || normalized.rounds.length !== normalized.roundCount) {
    throw new TypeError('Evidence ledger architecture-coordination rounds are invalid');
  }
  if (!arrayIsArray(normalized.peerMessages) || normalized.peerMessages.length !== normalized.roundCount) {
    throw new TypeError('Evidence ledger architecture-coordination peerMessages are invalid');
  }
  const rounds = objectFreeze(arrayMap(
    normalized.rounds,
    (round, index) => normalizeArchitectureCoordinationRound(round, index, normalized.goal)
  ));
  const peerMessages = objectFreeze(arrayMap(
    normalized.peerMessages,
    (messages, roundIndex) => {
      if (!arrayIsArray(messages) || messages.length !== rounds[roundIndex].members.length) {
        throw new TypeError(
          `Evidence ledger architecture-coordination peer messages for round ${roundIndex + 1} are invalid`
        );
      }
      const peers = objectFreeze(arrayMap(messages, normalizeArchitectureCoordinationPeer));
      arrayForEach(peers, (peer, memberIndex) => {
        const member = rounds[roundIndex].members[memberIndex];
        if (
          peer.round !== rounds[roundIndex].round
          || peer.memberIndex !== member.index
          || peer.agentId !== member.agentId
          || peer.auditValid !== member.auditValid
          || peer.completed !== member.completed
          || peer.proven !== member.proven
          || peer.error !== member.error
          || peer.stopReason !== member.stopReason
        ) {
          throw new TypeError(
            `Evidence ledger architecture-coordination peer message ${memberIndex} does not match round ${roundIndex + 1}`
          );
        }
      });
      return peers;
    }
  ));
  const finalRound = rounds[rounds.length - 1];
  if (
    normalized.allRoundsComplete !== arrayEvery(rounds, (round) => round.allComplete)
    || normalized.allRoundsProven !== arrayEvery(rounds, (round) => round.allProven)
    || normalized.allRoundsQuorumMet !== arrayEvery(rounds, (round) => round.quorumMet)
    || normalized.finalQuorumMet !== finalRound.quorumMet
  ) {
    throw new TypeError('Evidence ledger architecture-coordination transcript summary is inconsistent');
  }
  const body = architectureCoordinationFingerprintBody({
    allRoundsComplete: normalized.allRoundsComplete,
    allRoundsProven: normalized.allRoundsProven,
    allRoundsQuorumMet: normalized.allRoundsQuorumMet,
    context: normalized.context,
    dataOnly: normalized.dataOnly,
    deployed: normalized.deployed,
    finalQuorumMet: normalized.finalQuorumMet,
    goal: normalized.goal,
    messagesDataOnly: normalized.messagesDataOnly,
    peerMessages,
    reproduction: normalized.reproduction,
    roundCount: normalized.roundCount,
    rounds
  });
  requireNonEmptyString(
    normalized.transcriptFingerprint,
    'Evidence ledger architecture-coordination transcriptFingerprint'
  );
  if (normalized.transcriptFingerprint !== architectureCoordinationFingerprint(body)) {
    throw new Error('Evidence ledger architecture-coordination fingerprint verification failed');
  }
  return objectFreeze({
    ...body,
    transcriptFingerprint: normalized.transcriptFingerprint
  });
}

function architectureDiscoveryFingerprintBody(value) {
  const body = {
    adopted: value.adopted,
    adoptedArchitectureFingerprint: value.adoptedArchitectureFingerprint,
    adoptionCandidateId: value.adoptionCandidateId,
    adoptionReasons: value.adoptionReasons,
    allAuditsValid: value.allAuditsValid,
    authorityTransferred: value.authorityTransferred,
    candidates: value.candidates,
    complete: value.complete,
    dataOnly: value.dataOnly,
    deployed: value.deployed,
    goal: value.goal,
    primary: value.primary,
    proposalSource: value.proposalSource,
    proposals: value.proposals,
    reproducibility: value.reproducibility,
    reproduction: value.reproduction,
    winnerArchitectureFingerprint: value.winnerArchitectureFingerprint,
    winnerId: value.winnerId
  };
  if (value.factory !== undefined) {
    body.factory = value.factory;
  }
  return body;
}

function architectureDiscoveryFingerprint(value) {
  return `sha256:${createHash('sha256')
    .update(stableSerialize(architectureDiscoveryFingerprintBody(value)))
    .digest('hex')}`;
}

function architectureDiscoveryProposalPayload(proposal) {
  return {
    components: proposal.components,
    dataOnly: proposal.dataOnly,
    id: proposal.id,
    plannerCandidateId: proposal.plannerCandidateId,
    policy: proposal.policy
  };
}

function architectureDiscoveryCandidatePayload(candidate, result) {
  return {
    architectureFingerprint: result?.architectureFingerprint ?? null,
    components: candidate.components,
    description: candidate.description,
    id: candidate.id,
    plannerCandidateId: candidate.plannerCandidate.id,
    policyDefinitionFingerprint: result?.policyDefinitionFingerprint ?? null
  };
}

function architectureDiscoveryModeResultPayload(result) {
  return {
    adversarial: result.adversarial,
    caseId: result.caseId,
    domain: result.domain,
    error: result.error,
    expected: result.expected,
    plannerId: result.plannerId,
    proven: result.proven,
    requiresProof: result.requiresProof,
    stopReason: result.stopReason,
    success: result.success
  };
}

function architectureDiscoveryTransferPayload(entry) {
  return {
    cases: entry.cases,
    domain: entry.domain,
    provenRate: entry.provenRate,
    successRate: entry.successRate,
    successes: entry.successes
  };
}

function architectureDiscoveryModePayload(report) {
  return {
    adversarialCases: report.adversarialCases,
    adversarialSuccessRate: report.adversarialSuccessRate,
    adversarialSuccesses: report.adversarialSuccesses,
    attemptedCases: report.attemptedCases,
    budgetMaxCases: report.budget.maxCases,
    candidateId: report.candidateId,
    complete: report.complete,
    definitionFingerprint: report.definitionFingerprint,
    eligibleCases: report.eligibleCases,
    mode: report.mode,
    proven: report.proven,
    provenRate: report.provenRate,
    proofEligibleCases: report.proofEligibleCases,
    results: arrayMap(report.results, architectureDiscoveryModeResultPayload),
    skippedCases: report.skippedCases,
    successRate: report.successRate,
    successes: report.successes,
    transferMatrix: arrayMap(report.transferMatrix, architectureDiscoveryTransferPayload),
    weaknessesExposed: report.weaknessesExposed
  };
}

function architectureDiscoveryPlannerFitnessPayload(fitness) {
  return {
    productionProvenRate: fitness.productionProvenRate,
    productionSuccessRate: fitness.productionSuccessRate,
    researchProvenRate: fitness.researchProvenRate,
    researchSuccessRate: fitness.researchSuccessRate,
    skepticSuccessRate: fitness.skepticSuccessRate,
    skepticWeaknessesExposed: fitness.skepticWeaknessesExposed,
    transferProvenRate: fitness.transferProvenRate,
    transferSuccessRate: fitness.transferSuccessRate
  };
}

function architectureDiscoveryPlannerResultPayload(result) {
  return {
    candidateId: result.candidateId,
    complete: result.complete,
    definitionFingerprint: result.definitionFingerprint,
    error: result.error,
    fitness: architectureDiscoveryPlannerFitnessPayload(result.fitness),
    production: architectureDiscoveryModePayload(result.production),
    research: architectureDiscoveryModePayload(result.research),
    skeptic: architectureDiscoveryModePayload(result.skeptic)
  };
}

function architectureDiscoveryPlannerPayload(report) {
  if (report === null) {
    return null;
  }
  return {
    allAuditsValid: report.allAuditsValid,
    complete: report.complete,
    results: arrayMap(report.results, architectureDiscoveryPlannerResultPayload),
    winnerId: report.winner.candidateId
  };
}

function architectureDiscoveryFitnessPayload(fitness) {
  return {
    productionProvenRate: fitness.productionProvenRate,
    productionSuccessRate: fitness.productionSuccessRate,
    researchProvenRate: fitness.researchProvenRate,
    researchSuccessRate: fitness.researchSuccessRate,
    skepticSuccessRate: fitness.skepticSuccessRate,
    skepticWeaknessesExposed: fitness.skepticWeaknessesExposed,
    transferSuccessRate: fitness.transferSuccessRate
  };
}

function architectureDiscoveryResultPayload(result) {
  return {
    architectureFingerprint: result.architectureFingerprint,
    architectureId: result.architectureId,
    complete: result.complete,
    description: result.description,
    error: result.error,
    fitness: architectureDiscoveryFitnessPayload(result.fitness),
    planner: architectureDiscoveryPlannerPayload(result.plannerReport),
    policyDefinitionFingerprint: result.policyDefinitionFingerprint
  };
}

function architectureDiscoverySearchPayload(report) {
  return {
    allAuditsValid: report.allAuditsValid,
    complete: report.complete,
    results: arrayMap(report.results, architectureDiscoveryResultPayload),
    winnerId: report.winner.architectureId
  };
}

function architectureDiscoveryReproducibilityPayload(report) {
  return {
    architectureFingerprint: report.architectureFingerprint,
    candidateId: report.candidateId,
    reasons: report.reasons,
    reproducible: report.reproducible
  };
}

function normalizeArchitectureDiscoveryFactoryHoldout(value) {
  const normalized = snapshotData(value);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_FACTORY_HOLDOUT_KEYS)
  ) {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory holdout is invalid'
    );
  }
  requireNonEmptyString(
    normalized.architectureId,
    'Evidence ledger architecture-discovery factory holdout architectureId'
  );
  const caseCount = requireDiscoveryCount(
    normalized.caseCount,
    'Evidence ledger architecture-discovery factory holdout caseCount',
    1
  );
  const caseIds = requireDiscoveryStringArray(
    normalized.caseIds,
    'Evidence ledger architecture-discovery factory holdout caseIds'
  );
  if (
    caseIds.length !== caseCount
    || setSize(setFromArray(caseIds)) !== caseIds.length
  ) {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory holdout case identity is invalid'
    );
  }
  const attemptedCases = requireDiscoveryCount(
    normalized.attemptedCases,
    'Evidence ledger architecture-discovery factory holdout attemptedCases'
  );
  const successes = requireDiscoveryCount(
    normalized.successes,
    'Evidence ledger architecture-discovery factory holdout successes'
  );
  const proofEligibleCases = requireDiscoveryCount(
    normalized.proofEligibleCases,
    'Evidence ledger architecture-discovery factory holdout proofEligibleCases'
  );
  const proven = requireDiscoveryCount(
    normalized.proven,
    'Evidence ledger architecture-discovery factory holdout proven'
  );
  if (
    attemptedCases > caseCount
    || successes > attemptedCases
    || proofEligibleCases > attemptedCases
    || proven > proofEligibleCases
  ) {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory holdout counts are inconsistent'
    );
  }
  const successRate = requireDiscoveryRate(
    normalized.successRate,
    'Evidence ledger architecture-discovery factory holdout successRate'
  );
  const provenRate = requireDiscoveryRate(
    normalized.provenRate,
    'Evidence ledger architecture-discovery factory holdout provenRate',
    true
  );
  const reproducibilityReasons = requireDiscoveryStringArray(
    normalized.reproducibilityReasons,
    'Evidence ledger architecture-discovery factory holdout reproducibilityReasons'
  );
  arrayForEach(
    [
      'authorityTransferred',
      'complete',
      'dataOnly',
      'independent',
      'passed',
      'primaryComplete',
      'reproducible',
      'reproductionComplete'
    ],
    (field) => requireBoolean(
      normalized[field],
      `Evidence ledger architecture-discovery factory holdout ${field}`
    )
  );
  const productionComplete = attemptedCases === caseCount
    && successes === attemptedCases;
  const proofComplete = proofEligibleCases === 0 || proven === proofEligibleCases;
  const passed = normalized.complete === true
    && normalized.primaryComplete === true
    && normalized.reproductionComplete === true
    && normalized.reproducible === true
    && productionComplete
    && proofComplete;
  if (
    normalized.authorityTransferred !== false
    || normalized.dataOnly !== true
    || normalized.independent !== true
    || normalized.passed !== passed
    || normalized.reproducible && reproducibilityReasons.length !== 0
    || !normalized.reproducible && reproducibilityReasons.length === 0
    || !objectIs(successRate, attemptedCases === 0 ? 0 : successes / attemptedCases)
    || (proofEligibleCases === 0 && provenRate !== null)
    || (proofEligibleCases > 0 && !objectIs(provenRate, proven / proofEligibleCases))
  ) {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory holdout disposition is inconsistent'
    );
  }
  return objectFreeze({
    architectureId: normalized.architectureId,
    attemptedCases,
    authorityTransferred: false,
    caseCount,
    caseIds,
    complete: normalized.complete,
    dataOnly: true,
    independent: true,
    passed: normalized.passed,
    primaryComplete: normalized.primaryComplete,
    proofEligibleCases,
    proven,
    provenRate,
    reproducibilityReasons,
    reproducible: normalized.reproducible,
    reproductionComplete: normalized.reproductionComplete,
    successRate,
    successes
  });
}

function normalizeArchitectureDiscoveryFactoryMetadata(value) {
  const normalized = snapshotData(value);
  const legacyShape = isPlainObject(normalized)
    && hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_FACTORY_KEYS);
  const holdoutShape = isPlainObject(normalized)
    && hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_FACTORY_KEYS_WITH_HOLDOUT);
  if (
    !legacyShape
    && !holdoutShape
  ) {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory metadata has an invalid shape'
    );
  }
  if (normalized.dataOnly !== true) {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory metadata must be data-only'
    );
  }
  const benchmark = normalized.benchmark;
  if (
    !isPlainObject(benchmark)
    || !hasExactKeys(benchmark, ARCHITECTURE_DISCOVERY_FACTORY_BENCHMARK_KEYS)
  ) {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory benchmark is invalid'
    );
  }
  const budgets = benchmark.budgets;
  if (
    !isPlainObject(budgets)
    || !hasExactKeys(budgets, ARCHITECTURE_DISCOVERY_FACTORY_BUDGET_KEYS)
  ) {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory benchmark budgets are invalid'
    );
  }
  const normalizedBudgets = objectFreeze({
    production: requireDiscoveryCount(
      budgets.production,
      'Evidence ledger architecture-discovery factory production budget',
      1
    ),
    research: requireDiscoveryCount(
      budgets.research,
      'Evidence ledger architecture-discovery factory research budget',
      1
    ),
    skeptic: requireDiscoveryCount(
      budgets.skeptic,
      'Evidence ledger architecture-discovery factory skeptic budget',
      1
    )
  });
  const normalizedBenchmark = objectFreeze({
    budgets: normalizedBudgets,
    caseCount: requireDiscoveryCount(
      benchmark.caseCount,
      'Evidence ledger architecture-discovery factory benchmark caseCount',
      1
    ),
    fingerprint: requireNonEmptyString(
      benchmark.fingerprint,
      'Evidence ledger architecture-discovery factory benchmark fingerprint'
    )
  });
  const normalizedHoldout = holdoutShape
    ? normalizeArchitectureDiscoveryFactoryHoldout(normalized.holdout)
    : null;
  const predecessor = normalized.predecessor;
  let normalizedPredecessor = null;
  if (predecessor !== null) {
    if (
      !isPlainObject(predecessor)
      || !hasExactKeys(predecessor, ARCHITECTURE_DISCOVERY_FACTORY_PREDECESSOR_KEYS)
      || predecessor.kind !== 'architecture-discovery'
    ) {
      throw new TypeError(
        'Evidence ledger architecture-discovery factory predecessor is invalid'
      );
    }
    normalizedPredecessor = objectFreeze({
      hash: requireNonEmptyString(
        predecessor.hash,
        'Evidence ledger architecture-discovery factory predecessor hash'
      ),
      kind: predecessor.kind,
      sequence: requireDiscoveryCount(
        predecessor.sequence,
        'Evidence ledger architecture-discovery factory predecessor sequence',
        1
      )
    });
  }
  const improvement = normalized.improvement;
  let normalizedImprovement = null;
  if (improvement !== null) {
    if (
      !isPlainObject(improvement)
      || !hasExactKeys(improvement, ARCHITECTURE_DISCOVERY_FACTORY_IMPROVEMENT_KEYS)
    ) {
      throw new TypeError(
        'Evidence ledger architecture-discovery factory improvement is invalid'
      );
    }
    arrayForEach(
      ['accepted', 'benchmarkStable', 'nonRegressing', 'strictlyImproved'],
      (field) => requireBoolean(
        improvement[field],
        `Evidence ledger architecture-discovery factory improvement ${field}`
      )
    );
    if (
      improvement.baselineSequence !== null
      && (!isSafeInteger(improvement.baselineSequence) || improvement.baselineSequence <= 0)
    ) {
      throw new TypeError(
        'Evidence ledger architecture-discovery factory improvement baselineSequence is invalid'
      );
    }
    normalizedImprovement = objectFreeze({
      accepted: improvement.accepted,
      baselineSequence: improvement.baselineSequence,
      benchmarkStable: improvement.benchmarkStable,
      nonRegressing: improvement.nonRegressing,
      strictlyImproved: improvement.strictlyImproved
    });
  }
  const status = normalized.status;
  if (status !== 'ADOPTED' && status !== 'REJECTED') {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory status is invalid'
    );
  }
  if (
    normalizedImprovement !== null
    && normalizedImprovement.baselineSequence !== null
    && (
      normalizedPredecessor === null
      || normalizedImprovement.baselineSequence > normalizedPredecessor.sequence
    )
  ) {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory improvement baseline is newer than predecessor'
    );
  }
  const holdoutRejected = normalizedHoldout?.passed === false;
  if (
    normalizedImprovement !== null
    && (
      status === 'ADOPTED' && normalizedImprovement.accepted !== true
      || status === 'REJECTED'
        && normalizedImprovement.accepted === true
        && !holdoutRejected
    )
  ) {
    throw new TypeError(
      'Evidence ledger architecture-discovery factory improvement status is inconsistent'
    );
  }
  const result = {
    benchmark: normalizedBenchmark,
    dataOnly: true,
    factoryId: requireNonEmptyString(
      normalized.factoryId,
      'Evidence ledger architecture-discovery factoryId'
    ),
    generation: requireDiscoveryCount(
      normalized.generation,
      'Evidence ledger architecture-discovery factory generation',
      1
    ),
    improvement: normalizedImprovement,
    predecessor: normalizedPredecessor,
    status
  };
  if (holdoutShape) {
    result.holdout = normalizedHoldout;
  }
  return objectFreeze(result);
}

function normalizeHarnessFactoryValidationPayload(payload) {
  const normalized = snapshotData(payload);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, HARNESS_FACTORY_VALIDATION_KEYS)
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory validation payload has an invalid shape'
    );
  }
  const architectureFingerprint = requireNonEmptyString(
    normalized.architectureFingerprint,
    'Evidence ledger Harness Factory validation architectureFingerprint'
  );
  const architectureId = requireNonEmptyString(
    normalized.architectureId,
    'Evidence ledger Harness Factory validation architectureId'
  );
  if (
    normalized.authorityTransferred !== false
    || normalized.dataOnly !== true
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory validation proof boundary is invalid'
    );
  }
  const baseline = normalized.baseline;
  if (
    !isPlainObject(baseline)
    || !hasExactKeys(baseline, HARNESS_FACTORY_VALIDATION_BASELINE_KEYS)
    || baseline.kind !== 'architecture-discovery'
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory validation baseline is invalid'
    );
  }
  const normalizedBaseline = objectFreeze({
    hash: requireNonEmptyString(
      baseline.hash,
      'Evidence ledger Harness Factory validation baseline hash'
    ),
    kind: baseline.kind,
    sequence: requireDiscoveryCount(
      baseline.sequence,
      'Evidence ledger Harness Factory validation baseline sequence',
      1
    )
  });
  const baselineGeneration = requireDiscoveryCount(
    normalized.baselineGeneration,
    'Evidence ledger Harness Factory validation baselineGeneration',
    1
  );
  const factoryId = requireNonEmptyString(
    normalized.factoryId,
    'Evidence ledger Harness Factory validation factoryId'
  );
  const holdout = normalizeArchitectureDiscoveryFactoryHoldout(normalized.holdout);
  if (
    holdout.architectureId !== architectureId
    || holdout.passed !== (normalized.status === 'PASSED')
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory validation holdout is inconsistent'
    );
  }
  if (normalized.status !== 'PASSED' && normalized.status !== 'FAILED') {
    throw new TypeError(
      'Evidence ledger Harness Factory validation status is invalid'
    );
  }
  return objectFreeze({
    architectureFingerprint,
    architectureId,
    authorityTransferred: false,
    baseline: normalizedBaseline,
    baselineGeneration,
    dataOnly: true,
    factoryId,
    holdout,
    status: normalized.status
  });
}

function normalizeHarnessFactoryBenchmarkCampaignPoint(value, index, candidateIds) {
  const normalized = snapshotData(value);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, HARNESS_FACTORY_BENCHMARK_CAMPAIGN_POINT_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger Harness Factory benchmark campaign point ${index} is invalid`
    );
  }
  const architectureId = requireNonEmptyString(
    normalized.architectureId,
    `Evidence ledger Harness Factory benchmark campaign point ${index} architectureId`
  );
  if (!arrayIncludes(candidateIds, architectureId)) {
    throw new TypeError(
      `Evidence ledger Harness Factory benchmark campaign point ${index} candidate is unknown`
    );
  }
  const levelId = requireNonEmptyString(
    normalized.levelId,
    `Evidence ledger Harness Factory benchmark campaign point ${index} levelId`
  );
  const computeUnits = requireDiscoveryCount(
    normalized.computeUnits,
    `Evidence ledger Harness Factory benchmark campaign point ${index} computeUnits`,
    1
  );
  const budgets = normalized.budgets;
  if (
    !isPlainObject(budgets)
    || !hasExactKeys(budgets, HARNESS_FACTORY_BENCHMARK_CAMPAIGN_BUDGET_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger Harness Factory benchmark campaign point ${index} budgets are invalid`
    );
  }
  const normalizedBudgets = objectFreeze({
    production: requireDiscoveryCount(
      budgets.production,
      `Evidence ledger Harness Factory benchmark campaign point ${index} production budget`,
      1
    ),
    research: requireDiscoveryCount(
      budgets.research,
      `Evidence ledger Harness Factory benchmark campaign point ${index} research budget`,
      1
    ),
    skeptic: requireDiscoveryCount(
      budgets.skeptic,
      `Evidence ledger Harness Factory benchmark campaign point ${index} skeptic budget`,
      1
    )
  });
  const architectureFingerprint = optionalNonEmptyString(
    normalized.architectureFingerprint,
    `Evidence ledger Harness Factory benchmark campaign point ${index} architectureFingerprint`
  );
  const rates = objectFreeze({
    productionProvenRate: requireDiscoveryRate(
      normalized.productionProvenRate,
      `Evidence ledger Harness Factory benchmark campaign point ${index} productionProvenRate`
    ),
    productionSuccessRate: requireDiscoveryRate(
      normalized.productionSuccessRate,
      `Evidence ledger Harness Factory benchmark campaign point ${index} productionSuccessRate`
    ),
    researchProvenRate: requireDiscoveryRate(
      normalized.researchProvenRate,
      `Evidence ledger Harness Factory benchmark campaign point ${index} researchProvenRate`
    ),
    researchSuccessRate: requireDiscoveryRate(
      normalized.researchSuccessRate,
      `Evidence ledger Harness Factory benchmark campaign point ${index} researchSuccessRate`
    ),
    skepticSuccessRate: requireDiscoveryRate(
      normalized.skepticSuccessRate,
      `Evidence ledger Harness Factory benchmark campaign point ${index} skepticSuccessRate`
    ),
    transferSuccessRate: requireDiscoveryRate(
      normalized.transferSuccessRate,
      `Evidence ledger Harness Factory benchmark campaign point ${index} transferSuccessRate`
    )
  });
  const skepticWeaknessesExposed = requireDiscoveryCount(
    normalized.skepticWeaknessesExposed,
    `Evidence ledger Harness Factory benchmark campaign point ${index} skepticWeaknessesExposed`
  );
  const elapsedMs = normalized.elapsedMs;
  if (
    !isFiniteNumber(elapsedMs)
    || elapsedMs < 0
  ) {
    throw new TypeError(
      `Evidence ledger Harness Factory benchmark campaign point ${index} elapsedMs is invalid`
    );
  }
  const error = optionalString(
    normalized.error,
    `Evidence ledger Harness Factory benchmark campaign point ${index} error`
  );
  arrayForEach(
    ['complete', 'independent', 'reproducible'],
    (field) => requireBoolean(
      normalized[field],
      `Evidence ledger Harness Factory benchmark campaign point ${index} ${field}`
    )
  );
  if (
    normalized.dataOnly !== true
    || normalized.authorityTransferred !== false
    || normalized.independent !== true
  ) {
    throw new TypeError(
      `Evidence ledger Harness Factory benchmark campaign point ${index} proof boundary is invalid`
    );
  }
  return objectFreeze({
    architectureFingerprint,
    architectureId,
    authorityTransferred: false,
    budgets: normalizedBudgets,
    complete: normalized.complete,
    computeUnits,
    dataOnly: true,
    elapsedMs,
    error,
    independent: true,
    levelId,
    ...rates,
    reproducible: normalized.reproducible,
    skepticWeaknessesExposed
  });
}

const HARNESS_FACTORY_BENCHMARK_CAMPAIGN_RATE_KEYS = objectFreeze([
  'productionProvenRate',
  'productionSuccessRate',
  'researchProvenRate',
  'researchSuccessRate',
  'skepticSuccessRate',
  'transferSuccessRate'
]);

function harnessFactoryBenchmarkCampaignPointDominates(left, right) {
  const noWorse = arrayEvery(
    HARNESS_FACTORY_BENCHMARK_CAMPAIGN_RATE_KEYS,
    (key) => left[key] >= right[key]
  )
    && left.skepticWeaknessesExposed <= right.skepticWeaknessesExposed
    && left.computeUnits <= right.computeUnits;
  const strictlyBetter = arraySome(
    HARNESS_FACTORY_BENCHMARK_CAMPAIGN_RATE_KEYS,
    (key) => left[key] > right[key]
  )
    || left.skepticWeaknessesExposed < right.skepticWeaknessesExposed
    || left.computeUnits < right.computeUnits;
  return noWorse && strictlyBetter;
}

function normalizeHarnessFactoryBenchmarkCampaignPayload(payload) {
  const normalized = snapshotData(payload);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, HARNESS_FACTORY_BENCHMARK_CAMPAIGN_KEYS)
    || !arrayIsArray(normalized.points)
    || !arrayIsArray(normalized.frontier)
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark campaign payload has an invalid shape'
    );
  }
  const candidateIds = arrayMap(
    requireDiscoveryStringArray(
      normalized.candidateIds,
      'Evidence ledger Harness Factory benchmark campaign candidateIds'
    ),
    (candidateId, index) => requireNonEmptyString(
      candidateId,
      `Evidence ledger Harness Factory benchmark campaign candidateIds[${index}]`
    )
  );
  const caseIds = arrayMap(
    requireDiscoveryStringArray(
      normalized.caseIds,
      'Evidence ledger Harness Factory benchmark campaign caseIds'
    ),
    (caseId, index) => requireNonEmptyString(
      caseId,
      `Evidence ledger Harness Factory benchmark campaign caseIds[${index}]`
    )
  );
  const caseFingerprint = requireNonEmptyString(
    normalized.caseFingerprint,
    'Evidence ledger Harness Factory benchmark campaign caseFingerprint'
  );
  if (
    candidateIds.length < 2
    || candidateIds.length > 8
    || setSize(setFromArray(candidateIds)) !== candidateIds.length
    || caseIds.length === 0
    || setSize(setFromArray(caseIds)) !== caseIds.length
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark campaign identity is invalid'
    );
  }
  const points = arrayMap(
    normalized.points,
    (point, index) => normalizeHarnessFactoryBenchmarkCampaignPoint(
      point,
      index,
      candidateIds
    )
  );
  if (
    points.length === 0
    || points.length > 8 * 8
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark campaign points are invalid'
    );
  }
  const fingerprintByCandidate = [];
  arrayForEach(points, (point) => {
    if (arraySome(
      points,
      (other) => other !== point
        && other.architectureId === point.architectureId
        && other.levelId === point.levelId
    )) {
      throw new TypeError(
        'Evidence ledger Harness Factory benchmark campaign points are duplicated'
      );
    }
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
        'Evidence ledger Harness Factory benchmark campaign architecture definitions drifted'
      );
    }
  });
  arrayForEach(candidateIds, (candidateId) => {
    const candidatePoints = arrayFilter(
      points,
      (point) => point.architectureId === candidateId
    );
    if (
      candidatePoints.length === 0
      || candidatePoints.length > 8
      || setSize(setFromArray(arrayMap(candidatePoints, ({ levelId }) => levelId)))
        !== candidatePoints.length
      || setSize(setFromArray(arrayMap(candidatePoints, ({ computeUnits }) => computeUnits)))
        !== candidatePoints.length
    ) {
      throw new TypeError(
        'Evidence ledger Harness Factory benchmark campaign levels are invalid'
      );
    }
  });
  const frontier = arrayMap(
    normalized.frontier,
    (point, index) => normalizeHarnessFactoryBenchmarkCampaignPoint(
      point,
      `frontier ${index}`,
      candidateIds
    )
  );
  if (
    frontier.length === 0
    || frontier.length > points.length
    || setSize(setFromArray(arrayMap(
      frontier,
      (point) => `${point.architectureId}\u0000${point.levelId}`
    ))) !== frontier.length
    || !arrayEvery(
      frontier,
      (frontierPoint) => arraySome(
        points,
        (point) => jsonStringify(point) === jsonStringify(frontierPoint)
      )
    )
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark campaign frontier is invalid'
    );
  }
  const expectedFrontier = arrayFilter(
    points,
    (point, pointIndex) => arrayEvery(
      points,
      (other, otherIndex) => pointIndex === otherIndex
        || !harnessFactoryBenchmarkCampaignPointDominates(other, point)
    )
  );
  if (
    expectedFrontier.length !== frontier.length
    || !arrayEvery(
      expectedFrontier,
      (expectedPoint) => arraySome(
        frontier,
        (frontierPoint) => jsonStringify(expectedPoint) === jsonStringify(frontierPoint)
      )
    )
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark campaign frontier is not Pareto-complete'
    );
  }
  const complete = arrayEvery(points, (point) => point.complete);
  const reproducible = arrayEvery(points, (point) => point.reproducible);
  const independent = arrayEvery(points, (point) => point.independent);
  if (
    normalized.authorityTransferred !== false
    || normalized.dataOnly !== true
    || normalized.deployed !== false
    || normalized.complete !== complete
    || normalized.reproducible !== reproducible
    || normalized.independent !== independent
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark campaign status is inconsistent'
    );
  }
  return objectFreeze({
    authorityTransferred: false,
    candidateIds: objectFreeze(candidateIds),
    caseIds: objectFreeze(caseIds),
    caseFingerprint,
    complete,
    dataOnly: true,
    deployed: false,
    factoryId: requireNonEmptyString(
      normalized.factoryId,
      'Evidence ledger Harness Factory benchmark campaign factoryId'
    ),
    frontier: objectFreeze(frontier),
    independent,
    points: objectFreeze(points),
    reproducible
  });
}

function harnessFactoryBenchmarkCampaignPayload(report) {
  if (!isTrustedHarnessFactoryBenchmarkCampaignReport(report)) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark campaign entries require a trusted campaign report'
    );
  }
  return normalizeHarnessFactoryBenchmarkCampaignPayload({
    authorityTransferred: report.authorityTransferred,
    candidateIds: report.candidateIds,
    caseIds: report.caseIds,
    caseFingerprint: report.caseFingerprint,
    complete: report.complete,
    dataOnly: report.dataOnly,
    deployed: report.deployed,
    factoryId: report.factoryId,
    frontier: report.frontier,
    independent: report.independent,
    points: report.points,
    reproducible: report.reproducible
  });
}

function normalizeHarnessFactoryBenchmarkValidationArchive(value) {
  const normalized = snapshotData(value);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, HARNESS_FACTORY_VALIDATION_BASELINE_KEYS)
    || normalized.kind !== 'harness-factory-benchmark-campaign'
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark validation campaign archive is invalid'
    );
  }
  return objectFreeze({
    hash: requireNonEmptyString(
      normalized.hash,
      'Evidence ledger Harness Factory benchmark validation campaign archive hash'
    ),
    kind: normalized.kind,
    sequence: requireDiscoveryCount(
      normalized.sequence,
      'Evidence ledger Harness Factory benchmark validation campaign archive sequence',
      1
    )
  });
}

function sameHarnessFactoryBenchmarkValidationPoint(left, right, includeElapsedMs = false) {
  const keys = includeElapsedMs
    ? HARNESS_FACTORY_BENCHMARK_CAMPAIGN_POINT_KEYS
    : arrayFilter(
      HARNESS_FACTORY_BENCHMARK_CAMPAIGN_POINT_KEYS,
      (key) => key !== 'elapsedMs'
    );
  return arrayEvery(
    keys,
    (key) => jsonStringify(left[key]) === jsonStringify(right[key])
  );
}

function normalizeHarnessFactoryBenchmarkValidationPayload(payload) {
  const normalized = snapshotData(payload);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, HARNESS_FACTORY_BENCHMARK_VALIDATION_KEYS)
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark validation payload has an invalid shape'
    );
  }
  const factoryId = requireNonEmptyString(
    normalized.factoryId,
    'Evidence ledger Harness Factory benchmark validation factoryId'
  );
  const candidateId = requireNonEmptyString(
    normalized.candidateId,
    'Evidence ledger Harness Factory benchmark validation candidateId'
  );
  const levelId = requireNonEmptyString(
    normalized.levelId,
    'Evidence ledger Harness Factory benchmark validation levelId'
  );
  const architectureFingerprint = requireNonEmptyString(
    normalized.architectureFingerprint,
    'Evidence ledger Harness Factory benchmark validation architectureFingerprint'
  );
  const caseFingerprint = requireNonEmptyString(
    normalized.caseFingerprint,
    'Evidence ledger Harness Factory benchmark validation caseFingerprint'
  );
  const caseIds = arrayMap(
    requireDiscoveryStringArray(
      normalized.caseIds,
      'Evidence ledger Harness Factory benchmark validation caseIds'
    ),
    (caseId, index) => requireNonEmptyString(
      caseId,
      `Evidence ledger Harness Factory benchmark validation caseIds[${index}]`
    )
  );
  if (
    caseIds.length === 0
    || setSize(setFromArray(caseIds)) !== caseIds.length
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark validation case identity is invalid'
    );
  }
  const campaignArchive = normalizeHarnessFactoryBenchmarkValidationArchive(
    normalized.campaignArchive
  );
  const campaignPoint = normalizeHarnessFactoryBenchmarkCampaignPoint(
    normalized.campaignPoint,
    'validation campaign',
    [candidateId]
  );
  const benchmarkPoint = normalizeHarnessFactoryBenchmarkCampaignPoint(
    normalized.benchmarkPoint,
    'validation replay',
    [candidateId]
  );
  if (
    campaignPoint.architectureId !== candidateId
    || benchmarkPoint.architectureId !== candidateId
    || campaignPoint.levelId !== levelId
    || benchmarkPoint.levelId !== levelId
    || campaignPoint.architectureFingerprint !== architectureFingerprint
    || benchmarkPoint.architectureFingerprint !== architectureFingerprint
    || !sameHarnessFactoryBenchmarkValidationPoint(campaignPoint, benchmarkPoint)
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark validation point identity is inconsistent'
    );
  }
  const holdout = normalizeArchitectureDiscoveryFactoryHoldout(normalized.holdout);
  if (
    holdout.architectureId !== candidateId
    || normalized.benchmarkMatch !== true
    || normalized.dataOnly !== true
    || normalized.deployed !== false
    || normalized.authorityTransferred !== false
    || holdout.independent !== true
    || holdout.dataOnly !== true
    || holdout.authorityTransferred !== false
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark validation proof boundary is invalid'
    );
  }
  arrayForEach(
    [
      'benchmarkMatch',
      'complete',
      'dataOnly',
      'deployed',
      'independent',
      'passed',
      'reproducible',
      'authorityTransferred'
    ],
    (field) => requireBoolean(
      normalized[field],
      `Evidence ledger Harness Factory benchmark validation ${field}`
    )
  );
  const complete = benchmarkPoint.complete && holdout.complete;
  const reproducible = benchmarkPoint.reproducible && holdout.reproducible;
  const independent = benchmarkPoint.independent && holdout.independent;
  const passed = campaignPoint.complete
    && campaignPoint.reproducible
    && campaignPoint.independent
    && benchmarkPoint.complete
    && benchmarkPoint.reproducible
    && benchmarkPoint.independent
    && holdout.passed;
  if (
    normalized.complete !== complete
    || normalized.reproducible !== reproducible
    || normalized.independent !== independent
    || normalized.passed !== passed
    || (normalized.status !== 'PASSED' && normalized.status !== 'FAILED')
    || normalized.status !== (passed ? 'PASSED' : 'FAILED')
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark validation status is inconsistent'
    );
  }
  return objectFreeze({
    architectureFingerprint,
    authorityTransferred: false,
    benchmarkMatch: true,
    benchmarkPoint,
    campaignArchive,
    campaignPoint,
    candidateId,
    caseFingerprint,
    caseIds: objectFreeze(caseIds),
    complete,
    dataOnly: true,
    deployed: false,
    factoryId,
    holdout,
    independent,
    levelId,
    passed,
    reproducible,
    status: normalized.status
  });
}

function validateHarnessFactoryBenchmarkValidationCampaign(records, payload) {
  const campaignRecord = arrayFind(
    records,
    (record) => record.sequence === payload.campaignArchive.sequence
      && record.kind === payload.campaignArchive.kind
      && record.hash === payload.campaignArchive.hash
  );
  if (campaignRecord === undefined) {
    throw new Error(
      'Evidence ledger Harness Factory benchmark validation campaign is not in the current chain'
    );
  }
  const campaign = normalizeHarnessFactoryBenchmarkCampaignPayload(campaignRecord.payload);
  const frontierPoint = arrayFind(
    campaign.frontier,
    (point) => point.architectureId === payload.candidateId
      && point.levelId === payload.levelId
  );
  if (
    campaign.factoryId !== payload.factoryId
    || campaign.caseFingerprint !== payload.caseFingerprint
    || jsonStringify(campaign.caseIds) !== jsonStringify(payload.caseIds)
    || frontierPoint === undefined
    || !sameHarnessFactoryBenchmarkValidationPoint(
      frontierPoint,
      payload.campaignPoint,
      true
    )
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark validation campaign does not match the source'
    );
  }
  return campaignRecord;
}

function harnessFactoryBenchmarkValidationPayload(report) {
  if (!isTrustedHarnessFactoryBenchmarkCampaignValidationReport(report)) {
    throw new TypeError(
      'Evidence ledger Harness Factory benchmark validation entries require a trusted validation report'
    );
  }
  return normalizeHarnessFactoryBenchmarkValidationPayload({
    architectureFingerprint: report.benchmarkPoint.architectureFingerprint,
    authorityTransferred: report.authorityTransferred,
    benchmarkMatch: report.benchmarkMatch,
    benchmarkPoint: report.benchmarkPoint,
    campaignArchive: report.campaignArchive,
    candidateId: report.candidateId,
    caseFingerprint: report.caseFingerprint,
    caseIds: report.caseIds,
    complete: report.complete,
    dataOnly: report.dataOnly,
    deployed: report.deployed,
    factoryId: report.factoryId,
    holdout: {
      architectureId: report.holdout.architectureId,
      attemptedCases: report.holdout.attemptedCases,
      authorityTransferred: report.holdout.authorityTransferred,
      caseCount: report.holdout.caseCount,
      caseIds: report.holdout.caseIds,
      complete: report.holdout.complete,
      dataOnly: report.holdout.dataOnly,
      independent: report.holdout.independent,
      passed: report.holdout.passed,
      primaryComplete: report.holdout.primaryComplete,
      proofEligibleCases: report.holdout.proofEligibleCases,
      proven: report.holdout.proven,
      provenRate: report.holdout.provenRate,
      reproducibilityReasons: report.holdout.reproducibilityReasons,
      reproducible: report.holdout.reproducible,
      reproductionComplete: report.holdout.reproductionComplete,
      successRate: report.holdout.successRate,
      successes: report.holdout.successes
    },
    independent: report.independent,
    levelId: report.levelId,
    passed: report.passed,
    reproducible: report.reproducible,
    status: report.status,
    campaignPoint: report.campaignPoint
  });
}

function validateHarnessFactoryValidationBaseline(records, payload) {
  const baselineRecord = arrayFind(
    records,
    (record) => record.sequence === payload.baseline.sequence
      && record.kind === payload.baseline.kind
      && record.hash === payload.baseline.hash
  );
  if (baselineRecord === undefined) {
    throw new Error(
      'Evidence ledger Harness Factory validation baseline is not in the current chain'
    );
  }
  const discovery = normalizeArchitectureDiscoveryPayload(baselineRecord.payload);
  const factory = discovery.factory;
  if (
    factory === null
    || factory.factoryId !== payload.factoryId
    || factory.generation !== payload.baselineGeneration
    || factory.holdout !== undefined
    || discovery.winnerId !== payload.architectureId
    || discovery.winnerArchitectureFingerprint !== payload.architectureFingerprint
  ) {
    throw new TypeError(
      'Evidence ledger Harness Factory validation baseline does not match the discovery'
    );
  }
  return baselineRecord;
}

function harnessFactoryValidationPayload(report) {
  if (!isTrustedHarnessFactoryValidationReport(report)) {
    throw new TypeError(
      'Evidence ledger Harness Factory validation entries require a trusted validation report'
    );
  }
  return normalizeHarnessFactoryValidationPayload({
    architectureFingerprint: report.architectureFingerprint,
    architectureId: report.architectureId,
    authorityTransferred: report.authorityTransferred,
    baseline: report.baseline.archive,
    baselineGeneration: report.baselineGeneration,
    dataOnly: report.dataOnly,
    factoryId: report.factoryId,
    holdout: report.holdout,
    status: report.status
  });
}

function architectureDiscoveryPayload(report, factoryMetadata = null) {
  if (!isTrustedAgentArchitectureDiscoveryReport(report)) {
    throw new TypeError(
      'Evidence ledger architecture-discovery entries require a trusted discovery report'
    );
  }
  const primary = architectureDiscoverySearchPayload(report.primary);
  const reproduction = architectureDiscoverySearchPayload(report.reproduction);
  const winner = arrayFind(
    report.primary.results,
    (result) => result.architectureId === report.winnerId
  );
  const normalizedFactoryMetadata = factoryMetadata === null
    ? null
    : normalizeArchitectureDiscoveryFactoryMetadata(factoryMetadata);
  const bodyInput = {
    adopted: report.adopted,
    adoptedArchitectureFingerprint: report.adopted
      ? report.adoption.adoption.architectureFingerprint
      : null,
    adoptionCandidateId: report.adoption.candidateId,
    adoptionReasons: report.adoption.reasons,
    allAuditsValid: primary.allAuditsValid && reproduction.allAuditsValid,
    authorityTransferred: false,
    candidates: arrayMap(
      report.candidates,
      (candidate) => architectureDiscoveryCandidatePayload(
        candidate,
        arrayFind(primary.results, (result) => result.architectureId === candidate.id)
      )
    ),
    complete: report.complete,
    dataOnly: true,
    deployed: report.deployed,
    goal: report.goal,
    primary,
    proposalSource: report.proposalReport.source,
    proposals: arrayMap(report.proposals, architectureDiscoveryProposalPayload),
    reproducibility: architectureDiscoveryReproducibilityPayload(report.reproducibility),
    reproduction,
    winnerArchitectureFingerprint: winner?.architectureFingerprint ?? null,
    winnerId: report.winnerId
  };
  if (normalizedFactoryMetadata !== null) {
    bodyInput.factory = normalizedFactoryMetadata;
  }
  const body = architectureDiscoveryFingerprintBody(bodyInput);
  return {
    ...body,
    ...(normalizedFactoryMetadata === null
      ? {}
      : { factory: normalizedFactoryMetadata }),
    transcriptFingerprint: architectureDiscoveryFingerprint(body)
  };
}

function requireDiscoveryRate(value, field, allowNull = false) {
  if (allowNull && value === null) {
    return value;
  }
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    throw new TypeError(`${field} must be a finite rate between 0 and 1`);
  }
  return value;
}

function requireDiscoveryCount(value, field, minimum = 0) {
  if (!isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${field} must be a safe integer at least ${minimum}`);
  }
  return value;
}

function requireDiscoveryStringArray(value, field) {
  if (!arrayIsArray(value) || arraySome(value, (entry) => typeof entry !== 'string')) {
    throw new TypeError(`${field} must be an array of strings`);
  }
  return objectFreeze(arrayMap(value, (entry) => stringFrom(entry)));
}

function requireDiscoveryDescription(value, field) {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string`);
  }
  return value;
}

function normalizeArchitectureDiscoveryProposal(proposal, index) {
  const normalized = snapshotData(proposal);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_PROPOSAL_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery proposal ${index} has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.id,
    `Evidence ledger architecture-discovery proposal ${index} id`
  );
  requireNonEmptyString(
    normalized.plannerCandidateId,
    `Evidence ledger architecture-discovery proposal ${index} plannerCandidateId`
  );
  if (!isPlainObject(normalized.policy) || !isPlainObject(normalized.components)) {
    throw new TypeError(
      `Evidence ledger architecture-discovery proposal ${index} data is invalid`
    );
  }
  requireBoolean(
    normalized.dataOnly,
    `Evidence ledger architecture-discovery proposal ${index} dataOnly`
  );
  if (normalized.dataOnly !== true) {
    throw new TypeError(
      `Evidence ledger architecture-discovery proposal ${index} proof boundary is invalid`
    );
  }
  return objectFreeze({
    components: normalized.components,
    dataOnly: true,
    id: normalized.id,
    plannerCandidateId: normalized.plannerCandidateId,
    policy: normalized.policy
  });
}

function normalizeArchitectureDiscoveryCandidate(candidate, index) {
  const normalized = snapshotData(candidate);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_CANDIDATE_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery candidate ${index} has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.id,
    `Evidence ledger architecture-discovery candidate ${index} id`
  );
  requireNonEmptyString(
    normalized.plannerCandidateId,
    `Evidence ledger architecture-discovery candidate ${index} plannerCandidateId`
  );
  requireDiscoveryDescription(
    normalized.description,
    `Evidence ledger architecture-discovery candidate ${index} description`
  );
  if (!isPlainObject(normalized.components)) {
    throw new TypeError(
      `Evidence ledger architecture-discovery candidate ${index} components are invalid`
    );
  }
  optionalNonEmptyString(
    normalized.architectureFingerprint,
    `Evidence ledger architecture-discovery candidate ${index} architectureFingerprint`
  );
  optionalNonEmptyString(
    normalized.policyDefinitionFingerprint,
    `Evidence ledger architecture-discovery candidate ${index} policyDefinitionFingerprint`
  );
  return objectFreeze({
    architectureFingerprint: normalized.architectureFingerprint,
    components: normalized.components,
    description: normalized.description,
    id: normalized.id,
    plannerCandidateId: normalized.plannerCandidateId,
    policyDefinitionFingerprint: normalized.policyDefinitionFingerprint
  });
}

function normalizeArchitectureDiscoveryModeResult(result, index, field) {
  const normalized = snapshotData(result);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_MODE_RESULT_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} result ${index} has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.caseId,
    `Evidence ledger architecture-discovery ${field} result ${index} caseId`
  );
  requireNonEmptyString(
    normalized.domain,
    `Evidence ledger architecture-discovery ${field} result ${index} domain`
  );
  optionalNonEmptyString(
    normalized.error,
    `Evidence ledger architecture-discovery ${field} result ${index} error`
  );
  optionalNonEmptyString(
    normalized.plannerId,
    `Evidence ledger architecture-discovery ${field} result ${index} plannerId`
  );
  optionalString(
    normalized.stopReason,
    `Evidence ledger architecture-discovery ${field} result ${index} stopReason`
  );
  if (
    normalized.stopReason !== null
    && !arrayIncludes(objectValues(AGENT_STOP_REASONS), normalized.stopReason)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} result ${index} stopReason is invalid`
    );
  }
  arrayForEach(
    ['adversarial', 'expected', 'proven', 'requiresProof', 'success'],
    (key) => requireBoolean(
      normalized[key],
      `Evidence ledger architecture-discovery ${field} result ${index} ${key}`
    )
  );
  return objectFreeze({
    adversarial: normalized.adversarial,
    caseId: normalized.caseId,
    domain: normalized.domain,
    error: normalized.error,
    expected: normalized.expected,
    plannerId: normalized.plannerId,
    proven: normalized.proven,
    requiresProof: normalized.requiresProof,
    stopReason: normalized.stopReason,
    success: normalized.success
  });
}

function normalizeArchitectureDiscoveryTransfer(entry, index, field) {
  const normalized = snapshotData(entry);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_TRANSFER_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} transfer ${index} has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.domain,
    `Evidence ledger architecture-discovery ${field} transfer ${index} domain`
  );
  requireDiscoveryCount(
    normalized.cases,
    `Evidence ledger architecture-discovery ${field} transfer ${index} cases`,
    1
  );
  requireDiscoveryCount(
    normalized.successes,
    `Evidence ledger architecture-discovery ${field} transfer ${index} successes`
  );
  if (normalized.successes > normalized.cases) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} transfer ${index} successes exceed cases`
    );
  }
  requireDiscoveryRate(
    normalized.successRate,
    `Evidence ledger architecture-discovery ${field} transfer ${index} successRate`
  );
  requireDiscoveryRate(
    normalized.provenRate,
    `Evidence ledger architecture-discovery ${field} transfer ${index} provenRate`,
    true
  );
  return objectFreeze({
    cases: normalized.cases,
    domain: normalized.domain,
    provenRate: normalized.provenRate,
    successRate: normalized.successRate,
    successes: normalized.successes
  });
}

function normalizeArchitectureDiscoveryMode(report, field) {
  const normalized = snapshotData(report);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_MODE_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} mode has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.candidateId,
    `Evidence ledger architecture-discovery ${field} candidateId`
  );
  if (!arrayIncludes(objectValues(POLICY_MODES), normalized.mode)) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} mode is invalid`
    );
  }
  optionalNonEmptyString(
    normalized.definitionFingerprint,
    `Evidence ledger architecture-discovery ${field} definitionFingerprint`
  );
  requireDiscoveryCount(
    normalized.budgetMaxCases,
    `Evidence ledger architecture-discovery ${field} budgetMaxCases`,
    1
  );
  requireDiscoveryCount(
    normalized.eligibleCases,
    `Evidence ledger architecture-discovery ${field} eligibleCases`,
    1
  );
  if (
    !arrayIsArray(normalized.results)
    || normalized.results.length === 0
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} results are invalid`
    );
  }
  const results = objectFreeze(arrayMap(
    normalized.results,
    (result, index) => normalizeArchitectureDiscoveryModeResult(result, index, field)
  ));
  const transferMatrix = objectFreeze(arrayMap(
    normalized.transferMatrix,
    (entry, index) => normalizeArchitectureDiscoveryTransfer(entry, index, field)
  ));
  const attemptedCases = results.length;
  const skippedCases = normalized.eligibleCases > attemptedCases
    ? normalized.eligibleCases - attemptedCases
    : 0;
  let successes = 0;
  let proofEligibleCases = 0;
  let proven = 0;
  let adversarialCases = 0;
  let adversarialSuccesses = 0;
  arrayForEach(results, (result) => {
    if (result.success) {
      successes += 1;
    }
    if (result.requiresProof) {
      proofEligibleCases += 1;
      if (result.proven) {
        proven += 1;
      }
    }
    if (result.adversarial) {
      adversarialCases += 1;
      if (result.success) {
        adversarialSuccesses += 1;
      }
    }
  });
  const expectedSuccessRate = successes / attemptedCases;
  const expectedProvenRate = proofEligibleCases === 0
    ? null
    : proven / proofEligibleCases;
  const expectedAdversarialSuccessRate = adversarialCases === 0
    ? null
    : adversarialSuccesses / adversarialCases;
  const expectedComplete = skippedCases === 0;
  requireBoolean(
    normalized.complete,
    `Evidence ledger architecture-discovery ${field} complete`
  );
  arrayForEach(
    [
      ['adversarialCases', adversarialCases],
      ['adversarialSuccesses', adversarialSuccesses],
      ['attemptedCases', attemptedCases],
      ['proven', proven],
      ['proofEligibleCases', proofEligibleCases],
      ['skippedCases', skippedCases],
      ['successes', successes],
      ['weaknessesExposed', adversarialCases - adversarialSuccesses]
    ],
    ([key, expected]) => {
      requireDiscoveryCount(
        normalized[key],
        `Evidence ledger architecture-discovery ${field} ${key}`
      );
      if (normalized[key] !== expected) {
        throw new TypeError(
          `Evidence ledger architecture-discovery ${field} ${key} is inconsistent`
        );
      }
    }
  );
  if (
    normalized.attemptedCases !== attemptedCases
    || normalized.complete !== expectedComplete
    || !objectIs(normalized.successRate, expectedSuccessRate)
    || !objectIs(normalized.provenRate, expectedProvenRate)
    || !objectIs(normalized.adversarialSuccessRate, expectedAdversarialSuccessRate)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} mode summary is inconsistent`
    );
  }
  const domains = [];
  arrayForEach(results, (result) => {
    if (!arrayIncludes(domains, result.domain)) {
      arrayPush(domains, result.domain);
    }
  });
  const sortedDomains = arraySort(domains);
  if (transferMatrix.length !== sortedDomains.length) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} transfer matrix is inconsistent`
    );
  }
  arrayForEach(sortedDomains, (domain, domainIndex) => {
    const transfer = transferMatrix[domainIndex];
    let cases = 0;
    let transferSuccesses = 0;
    let transferProofEligible = 0;
    let transferProven = 0;
    arrayForEach(results, (result) => {
      if (result.domain !== domain) {
        return;
      }
      cases += 1;
      if (result.success) {
        transferSuccesses += 1;
      }
      if (result.requiresProof) {
        transferProofEligible += 1;
        if (result.proven) {
          transferProven += 1;
        }
      }
    });
    const provenRate = transferProofEligible === 0
      ? null
      : transferProven / transferProofEligible;
    if (
      transfer.domain !== domain
      || transfer.cases !== cases
      || transfer.successes !== transferSuccesses
      || !objectIs(transfer.successRate, transferSuccesses / cases)
      || !objectIs(transfer.provenRate, provenRate)
    ) {
      throw new TypeError(
        `Evidence ledger architecture-discovery ${field} transfer matrix is inconsistent`
      );
    }
  });
  return objectFreeze({
    adversarialCases,
    adversarialSuccessRate: normalized.adversarialSuccessRate,
    adversarialSuccesses,
    attemptedCases,
    budgetMaxCases: normalized.budgetMaxCases,
    candidateId: normalized.candidateId,
    complete: expectedComplete,
    definitionFingerprint: normalized.definitionFingerprint,
    eligibleCases: normalized.eligibleCases,
    mode: normalized.mode,
    proven,
    provenRate: normalized.provenRate,
    proofEligibleCases,
    results,
    skippedCases,
    successRate: normalized.successRate,
    successes,
    transferMatrix,
    weaknessesExposed: adversarialCases - adversarialSuccesses
  });
}

function normalizeArchitectureDiscoveryPlannerFitness(fitness, field) {
  const normalized = snapshotData(fitness);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_PLANNER_FITNESS_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} fitness has an invalid shape`
    );
  }
  arrayForEach(
    [
      'productionProvenRate',
      'productionSuccessRate',
      'researchProvenRate',
      'researchSuccessRate',
      'skepticSuccessRate',
      'transferSuccessRate'
    ],
    (key) => requireDiscoveryRate(
      normalized[key],
      `Evidence ledger architecture-discovery ${field} ${key}`
    )
  );
  requireDiscoveryRate(
    normalized.transferProvenRate,
    `Evidence ledger architecture-discovery ${field} transferProvenRate`,
    true
  );
  requireDiscoveryCount(
    normalized.skepticWeaknessesExposed,
    `Evidence ledger architecture-discovery ${field} skepticWeaknessesExposed`
  );
  return objectFreeze({
    productionProvenRate: normalized.productionProvenRate,
    productionSuccessRate: normalized.productionSuccessRate,
    researchProvenRate: normalized.researchProvenRate,
    researchSuccessRate: normalized.researchSuccessRate,
    skepticSuccessRate: normalized.skepticSuccessRate,
    skepticWeaknessesExposed: normalized.skepticWeaknessesExposed,
    transferProvenRate: normalized.transferProvenRate,
    transferSuccessRate: normalized.transferSuccessRate
  });
}

function normalizeArchitectureDiscoveryPlannerResult(result, index, field) {
  const normalized = snapshotData(result);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_PLANNER_RESULT_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} planner result ${index} has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.candidateId,
    `Evidence ledger architecture-discovery ${field} planner result ${index} candidateId`
  );
  requireBoolean(
    normalized.complete,
    `Evidence ledger architecture-discovery ${field} planner result ${index} complete`
  );
  optionalNonEmptyString(
    normalized.definitionFingerprint,
    `Evidence ledger architecture-discovery ${field} planner result ${index} definitionFingerprint`
  );
  optionalNonEmptyString(
    normalized.error,
    `Evidence ledger architecture-discovery ${field} planner result ${index} error`
  );
  const production = normalizeArchitectureDiscoveryMode(
    normalized.production,
    `${field} planner result ${index} production`
  );
  const research = normalizeArchitectureDiscoveryMode(
    normalized.research,
    `${field} planner result ${index} research`
  );
  const skeptic = normalizeArchitectureDiscoveryMode(
    normalized.skeptic,
    `${field} planner result ${index} skeptic`
  );
  if (
    production.mode !== POLICY_MODES.PRODUCTION
    || research.mode !== POLICY_MODES.RESEARCH
    || skeptic.mode !== POLICY_MODES.SKEPTIC
    || production.candidateId !== normalized.candidateId
    || research.candidateId !== normalized.candidateId
    || skeptic.candidateId !== normalized.candidateId
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} planner mode identity is inconsistent`
    );
  }
  const definitionFingerprint = production.definitionFingerprint !== null
    && production.definitionFingerprint === research.definitionFingerprint
    && production.definitionFingerprint === skeptic.definitionFingerprint
    ? production.definitionFingerprint
    : null;
  if (normalized.definitionFingerprint !== definitionFingerprint) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} planner definition fingerprint is inconsistent`
    );
  }
  const expectedComplete = normalized.error === null
    && production.complete
    && research.complete
    && skeptic.complete;
  const transferSuccessRate = research.transferMatrix.length === 0
    ? 0
    : arrayReduceDiscoveryTransfer(research.transferMatrix);
  const expectedFitness = {
    productionProvenRate: production.provenRate ?? 0,
    productionSuccessRate: production.successRate,
    researchProvenRate: research.provenRate ?? 0,
    researchSuccessRate: research.successRate,
    skepticSuccessRate: skeptic.adversarialSuccessRate ?? 0,
    skepticWeaknessesExposed: skeptic.weaknessesExposed,
    transferProvenRate: null,
    transferSuccessRate
  };
  const fitness = normalizeArchitectureDiscoveryPlannerFitness(
    normalized.fitness,
    `${field} planner result ${index}`
  );
  if (
    !arrayEvery(
      objectKeys(expectedFitness),
      (key) => objectIs(fitness[key], expectedFitness[key])
    )
    || normalized.complete !== expectedComplete
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} planner result is inconsistent`
    );
  }
  return objectFreeze({
    candidateId: normalized.candidateId,
    complete: expectedComplete,
    definitionFingerprint,
    error: normalized.error,
    fitness,
    production,
    research,
    skeptic
  });
}

function arrayReduceDiscoveryTransfer(entries) {
  let total = 0;
  arrayForEach(entries, (entry) => {
    total += entry.successRate;
  });
  return total / entries.length;
}

function normalizeArchitectureDiscoveryPlanner(report, field) {
  const normalized = snapshotData(report);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_PLANNER_KEYS)
    || !arrayIsArray(normalized.results)
    || normalized.results.length === 0
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} planner has an invalid shape`
    );
  }
  const results = objectFreeze(arrayMap(
    normalized.results,
    (result, index) => normalizeArchitectureDiscoveryPlannerResult(result, index, field)
  ));
  if (setSize(setFromArray(arrayMap(results, ({ candidateId }) => candidateId))) !== results.length) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} planner candidate ids are invalid`
    );
  }
  requireNonEmptyString(
    normalized.winnerId,
    `Evidence ledger architecture-discovery ${field} planner winnerId`
  );
  requireBoolean(
    normalized.complete,
    `Evidence ledger architecture-discovery ${field} planner complete`
  );
  requireBoolean(
    normalized.allAuditsValid,
    `Evidence ledger architecture-discovery ${field} planner allAuditsValid`
  );
  const expectedComplete = arrayEvery(results, (result) => result.complete);
  if (
    normalized.winnerId !== results[0].candidateId
    || normalized.complete !== expectedComplete
    || normalized.allAuditsValid !== expectedComplete
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} planner summary is inconsistent`
    );
  }
  return objectFreeze({
    allAuditsValid: expectedComplete,
    complete: expectedComplete,
    results,
    winnerId: normalized.winnerId
  });
}

function normalizeArchitectureDiscoveryFitness(fitness, field) {
  const normalized = snapshotData(fitness);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_FITNESS_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} fitness has an invalid shape`
    );
  }
  arrayForEach(
    [
      'productionProvenRate',
      'productionSuccessRate',
      'researchProvenRate',
      'researchSuccessRate',
      'skepticSuccessRate',
      'transferSuccessRate'
    ],
    (key) => requireDiscoveryRate(
      normalized[key],
      `Evidence ledger architecture-discovery ${field} ${key}`
    )
  );
  requireDiscoveryCount(
    normalized.skepticWeaknessesExposed,
    `Evidence ledger architecture-discovery ${field} skepticWeaknessesExposed`
  );
  return objectFreeze({
    productionProvenRate: normalized.productionProvenRate,
    productionSuccessRate: normalized.productionSuccessRate,
    researchProvenRate: normalized.researchProvenRate,
    researchSuccessRate: normalized.researchSuccessRate,
    skepticSuccessRate: normalized.skepticSuccessRate,
    skepticWeaknessesExposed: normalized.skepticWeaknessesExposed,
    transferSuccessRate: normalized.transferSuccessRate
  });
}

function normalizeArchitectureDiscoveryResult(result, index, field) {
  const normalized = snapshotData(result);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_RESULT_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} result ${index} has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.architectureId,
    `Evidence ledger architecture-discovery ${field} result ${index} architectureId`
  );
  requireDiscoveryDescription(
    normalized.description,
    `Evidence ledger architecture-discovery ${field} result ${index} description`
  );
  requireBoolean(
    normalized.complete,
    `Evidence ledger architecture-discovery ${field} result ${index} complete`
  );
  optionalNonEmptyString(
    normalized.architectureFingerprint,
    `Evidence ledger architecture-discovery ${field} result ${index} architectureFingerprint`
  );
  optionalNonEmptyString(
    normalized.error,
    `Evidence ledger architecture-discovery ${field} result ${index} error`
  );
  optionalNonEmptyString(
    normalized.policyDefinitionFingerprint,
    `Evidence ledger architecture-discovery ${field} result ${index} policyDefinitionFingerprint`
  );
  const planner = normalized.planner === null
    ? null
    : normalizeArchitectureDiscoveryPlanner(
      normalized.planner,
      `${field} result ${index}`
    );
  const fitness = normalizeArchitectureDiscoveryFitness(
    normalized.fitness,
    `${field} result ${index}`
  );
  let expectedFitness = {
    productionProvenRate: 0,
    productionSuccessRate: 0,
    researchProvenRate: 0,
    researchSuccessRate: 0,
    skepticSuccessRate: 0,
    skepticWeaknessesExposed: 0,
    transferSuccessRate: 0
  };
  let expectedComplete = false;
  if (planner !== null) {
    if (planner.results.length !== 1) {
      throw new TypeError(
        `Evidence ledger architecture-discovery ${field} result ${index} planner result count is invalid`
      );
    }
    const plannerResult = planner.results[0];
    expectedFitness = {
      productionProvenRate: plannerResult.fitness.productionProvenRate,
      productionSuccessRate: plannerResult.fitness.productionSuccessRate,
      researchProvenRate: plannerResult.fitness.researchProvenRate,
      researchSuccessRate: plannerResult.fitness.researchSuccessRate,
      skepticSuccessRate: plannerResult.fitness.skepticSuccessRate,
      skepticWeaknessesExposed: plannerResult.fitness.skepticWeaknessesExposed,
      transferSuccessRate: plannerResult.fitness.transferSuccessRate
    };
    let plannerHasErrors = false;
    arrayForEach(
      [plannerResult.production, plannerResult.research, plannerResult.skeptic],
      (mode) => {
        if (arraySome(mode.results, (modeResult) => modeResult.error !== null)) {
          plannerHasErrors = true;
        }
      }
    );
    expectedComplete = normalized.error === null
      && planner.complete
      && plannerResult.complete
      && !plannerHasErrors;
  }
  if (
    normalized.complete !== expectedComplete
    || !arrayEvery(
      objectKeys(expectedFitness),
      (key) => objectIs(fitness[key], expectedFitness[key])
    )
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} result ${index} is inconsistent`
    );
  }
  return objectFreeze({
    architectureFingerprint: normalized.architectureFingerprint,
    architectureId: normalized.architectureId,
    complete: expectedComplete,
    description: normalized.description,
    error: normalized.error,
    fitness,
    planner,
    policyDefinitionFingerprint: normalized.policyDefinitionFingerprint
  });
}

function normalizeArchitectureDiscoverySearch(report, field) {
  const normalized = snapshotData(report);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_SEARCH_KEYS)
    || !arrayIsArray(normalized.results)
    || normalized.results.length === 0
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} search has an invalid shape`
    );
  }
  const results = objectFreeze(arrayMap(
    normalized.results,
    (result, index) => normalizeArchitectureDiscoveryResult(result, index, field)
  ));
  if (setSize(setFromArray(arrayMap(results, ({ architectureId }) => architectureId))) !== results.length) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} architecture ids are invalid`
    );
  }
  requireNonEmptyString(
    normalized.winnerId,
    `Evidence ledger architecture-discovery ${field} winnerId`
  );
  requireBoolean(
    normalized.complete,
    `Evidence ledger architecture-discovery ${field} complete`
  );
  requireBoolean(
    normalized.allAuditsValid,
    `Evidence ledger architecture-discovery ${field} allAuditsValid`
  );
  const expectedAllAuditsValid = arrayEvery(
    results,
    (result) => result.planner !== null && result.planner.allAuditsValid
  );
  const expectedComplete = expectedAllAuditsValid
    && arrayEvery(results, (result) => result.complete);
  if (
    normalized.winnerId !== results[0].architectureId
    || normalized.allAuditsValid !== expectedAllAuditsValid
    || normalized.complete !== expectedComplete
  ) {
    throw new TypeError(
      `Evidence ledger architecture-discovery ${field} search summary is inconsistent`
    );
  }
  return objectFreeze({
    allAuditsValid: expectedAllAuditsValid,
    complete: expectedComplete,
    results,
    winnerId: normalized.winnerId
  });
}

function normalizeArchitectureDiscoveryReproducibility(report) {
  const normalized = snapshotData(report);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_REPRODUCIBILITY_KEYS)
  ) {
    throw new TypeError(
      'Evidence ledger architecture-discovery reproducibility has an invalid shape'
    );
  }
  requireNonEmptyString(
    normalized.candidateId,
    'Evidence ledger architecture-discovery reproducibility candidateId'
  );
  optionalNonEmptyString(
    normalized.architectureFingerprint,
    'Evidence ledger architecture-discovery reproducibility architectureFingerprint'
  );
  requireBoolean(
    normalized.reproducible,
    'Evidence ledger architecture-discovery reproducibility reproducible'
  );
  const reasons = requireDiscoveryStringArray(
    normalized.reasons,
    'Evidence ledger architecture-discovery reproducibility reasons'
  );
  if ((normalized.reproducible && reasons.length !== 0)
    || (!normalized.reproducible && reasons.length === 0)) {
    throw new TypeError(
      'Evidence ledger architecture-discovery reproducibility reasons are inconsistent'
    );
  }
  return objectFreeze({
    architectureFingerprint: normalized.architectureFingerprint,
    candidateId: normalized.candidateId,
    reasons,
    reproducible: normalized.reproducible
  });
}

function normalizeArchitectureDiscoveryPayload(payload) {
  const normalized = snapshotData(payload);
  const legacyShape = isPlainObject(normalized)
    && hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_KEYS);
  const factoryShape = isPlainObject(normalized)
    && hasExactKeys(normalized, ARCHITECTURE_DISCOVERY_KEYS_WITH_FACTORY);
  if (
    !legacyShape
    && !factoryShape
  ) {
    throw new TypeError('Evidence ledger architecture-discovery payload has an invalid shape');
  }
  const factory = factoryShape
    ? normalizeArchitectureDiscoveryFactoryMetadata(normalized.factory)
    : null;
  arrayForEach(
    [
      'adopted',
      'allAuditsValid',
      'authorityTransferred',
      'complete',
      'dataOnly',
      'deployed'
    ],
    (field) => requireBoolean(
      normalized[field],
      `Evidence ledger architecture-discovery ${field}`
    )
  );
  if (
    normalized.authorityTransferred !== false
    || normalized.dataOnly !== true
    || normalized.deployed !== false
  ) {
    throw new TypeError('Evidence ledger architecture-discovery proof boundary is invalid');
  }
  requireNonEmptyString(normalized.goal, 'Evidence ledger architecture-discovery goal');
  requireNonEmptyString(
    normalized.proposalSource,
    'Evidence ledger architecture-discovery proposalSource'
  );
  requireNonEmptyString(
    normalized.adoptionCandidateId,
    'Evidence ledger architecture-discovery adoptionCandidateId'
  );
  requireNonEmptyString(
    normalized.winnerId,
    'Evidence ledger architecture-discovery winnerId'
  );
  optionalNonEmptyString(
    normalized.adoptedArchitectureFingerprint,
    'Evidence ledger architecture-discovery adoptedArchitectureFingerprint'
  );
  optionalNonEmptyString(
    normalized.winnerArchitectureFingerprint,
    'Evidence ledger architecture-discovery winnerArchitectureFingerprint'
  );
  const adoptionReasons = requireDiscoveryStringArray(
    normalized.adoptionReasons,
    'Evidence ledger architecture-discovery adoptionReasons'
  );
  if (!arrayIsArray(normalized.proposals) || normalized.proposals.length === 0) {
    throw new TypeError('Evidence ledger architecture-discovery proposals are invalid');
  }
  const proposals = objectFreeze(arrayMap(
    normalized.proposals,
    normalizeArchitectureDiscoveryProposal
  ));
  if (!arrayIsArray(normalized.candidates) || normalized.candidates.length === 0) {
    throw new TypeError('Evidence ledger architecture-discovery candidates are invalid');
  }
  const candidates = objectFreeze(arrayMap(
    normalized.candidates,
    normalizeArchitectureDiscoveryCandidate
  ));
  if (
    setSize(setFromArray(arrayMap(proposals, ({ id }) => id))) !== proposals.length
    || setSize(setFromArray(arrayMap(candidates, ({ id }) => id))) !== candidates.length
    || proposals.length !== candidates.length
  ) {
    throw new TypeError('Evidence ledger architecture-discovery candidate identity is invalid');
  }
  const primary = normalizeArchitectureDiscoverySearch(normalized.primary, 'primary');
  const reproduction = normalizeArchitectureDiscoverySearch(
    normalized.reproduction,
    'reproduction'
  );
  const reproducibility = normalizeArchitectureDiscoveryReproducibility(
    normalized.reproducibility
  );
  if (
    primary.results.length !== candidates.length
    || reproduction.results.length !== candidates.length
  ) {
    throw new TypeError('Evidence ledger architecture-discovery result count is inconsistent');
  }
  arrayForEach(candidates, (candidate, index) => {
    const proposal = proposals[index];
    const primaryResult = arrayFind(
      primary.results,
      (result) => result.architectureId === candidate.id
    );
    if (
      proposal.id !== candidate.id
      || proposal.plannerCandidateId !== candidate.plannerCandidateId
      || stableSerialize(proposal.components) !== stableSerialize(candidate.components)
      || primaryResult === undefined
      || candidate.architectureFingerprint !== primaryResult.architectureFingerprint
      || candidate.policyDefinitionFingerprint !== primaryResult.policyDefinitionFingerprint
    ) {
      throw new TypeError(
        `Evidence ledger architecture-discovery candidate ${index} is inconsistent`
      );
    }
  });
  const primaryIds = arrayMap(primary.results, ({ architectureId }) => architectureId);
  const reproductionIds = arrayMap(
    reproduction.results,
    ({ architectureId }) => architectureId
  );
  if (
    primaryIds.length !== reproductionIds.length
    || arraySome(primaryIds, (id) => !arrayIncludes(reproductionIds, id))
  ) {
    throw new TypeError('Evidence ledger architecture-discovery replay candidates are inconsistent');
  }
  if (primary.winnerId !== normalized.winnerId) {
    throw new TypeError('Evidence ledger architecture-discovery winner is inconsistent');
  }
  const winner = arrayFind(
    primary.results,
    (result) => result.architectureId === normalized.winnerId
  );
  const reproducedWinner = arrayFind(
    reproduction.results,
    (result) => result.architectureId === normalized.winnerId
  );
  if (
    winner === undefined
    || reproducedWinner === undefined
    || reproducibility.candidateId !== normalized.winnerId
    || reproducibility.architectureFingerprint !== winner.architectureFingerprint
    || normalized.winnerArchitectureFingerprint !== winner.architectureFingerprint
  ) {
    throw new TypeError('Evidence ledger architecture-discovery reproducibility identity is inconsistent');
  }
  if (reproducibility.reproducible) {
    if (stableSerialize(winner) !== stableSerialize(reproducedWinner)) {
      throw new TypeError(
        'Evidence ledger architecture-discovery reproducibility evidence is inconsistent'
      );
    }
  }
  if (
    normalized.allAuditsValid !== (primary.allAuditsValid && reproduction.allAuditsValid)
    || normalized.complete !== (
      primary.complete
      && reproduction.complete
      && reproducibility.reproducible
    )
    || normalized.adoptionCandidateId !== normalized.winnerId
  ) {
    throw new TypeError('Evidence ledger architecture-discovery summary is inconsistent');
  }
  if (factory !== null) {
    const factoryAccepted = normalized.adopted
      && (factory.holdout === undefined || factory.holdout.passed === true);
    if (factory.status !== (factoryAccepted ? 'ADOPTED' : 'REJECTED')) {
      throw new TypeError(
        'Evidence ledger architecture-discovery factory status is inconsistent'
      );
    }
    if (!normalized.adopted && factory.holdout !== undefined) {
      throw new TypeError(
        'Evidence ledger architecture-discovery rejected factory cannot carry holdout evidence'
      );
    }
  }
  if (normalized.adopted) {
    if (
      !reproducibility.reproducible
      || adoptionReasons.length !== 0
      || normalized.adoptedArchitectureFingerprint === null
      || normalized.adoptedArchitectureFingerprint !== reproducibility.architectureFingerprint
    ) {
      throw new TypeError('Evidence ledger architecture-discovery adoption is inconsistent');
    }
  } else if (
    normalized.adoptedArchitectureFingerprint !== null
    || adoptionReasons.length === 0
  ) {
    throw new TypeError('Evidence ledger architecture-discovery rejection is inconsistent');
  }
  const bodyInput = {
    adopted: normalized.adopted,
    adoptedArchitectureFingerprint: normalized.adoptedArchitectureFingerprint,
    adoptionCandidateId: normalized.adoptionCandidateId,
    adoptionReasons,
    allAuditsValid: normalized.allAuditsValid,
    authorityTransferred: normalized.authorityTransferred,
    candidates,
    complete: normalized.complete,
    dataOnly: normalized.dataOnly,
    deployed: normalized.deployed,
    goal: normalized.goal,
    primary,
    proposalSource: normalized.proposalSource,
    proposals,
    reproducibility,
    reproduction,
    winnerArchitectureFingerprint: normalized.winnerArchitectureFingerprint,
    winnerId: normalized.winnerId
  };
  if (factory !== null) {
    bodyInput.factory = factory;
  }
  const body = architectureDiscoveryFingerprintBody(bodyInput);
  requireNonEmptyString(
    normalized.transcriptFingerprint,
    'Evidence ledger architecture-discovery transcriptFingerprint'
  );
  if (normalized.transcriptFingerprint !== architectureDiscoveryFingerprint(body)) {
    throw new Error('Evidence ledger architecture-discovery fingerprint verification failed');
  }
  return objectFreeze({
    ...body,
    ...(factory === null ? {} : { factory }),
    transcriptFingerprint: normalized.transcriptFingerprint
  });
}

function memoryAwareCoordinationFingerprintBody(value) {
  return {
    allRoundsComplete: value.allRoundsComplete,
    allRoundsProven: value.allRoundsProven,
    allRoundsQuorumMet: value.allRoundsQuorumMet,
    authorityTransferred: value.authorityTransferred,
    context: value.context,
    dataOnly: value.dataOnly,
    expectedPersistedRuns: value.expectedPersistedRuns,
    finalQuorumMet: value.finalQuorumMet,
    goal: value.goal,
    ledgerLengthAfter: value.ledgerLengthAfter,
    ledgerLengthBefore: value.ledgerLengthBefore,
    messagesDataOnly: value.messagesDataOnly,
    peerMessages: value.peerMessages,
    persistence: value.persistence,
    persistenceComplete: value.persistenceComplete,
    persistedRuns: value.persistedRuns,
    query: value.query,
    reproduction: value.reproduction,
    roundConsensus: value.roundConsensus,
    roundCount: value.roundCount,
    rounds: value.rounds
  };
}

function memoryAwareCoordinationFingerprint(value) {
  return `sha256:${createHash('sha256')
    .update(stableSerialize(memoryAwareCoordinationFingerprintBody(value)))
    .digest('hex')}`;
}

function memoryAwareEnsembleMemberPayload(member) {
  return {
    actionEvidence: arraySlice(member.actionEvidence),
    actionsUsed: member.actionsUsed,
    architectureId: member.architectureId,
    auditValid: member.auditValid,
    authorityTransferred: false,
    completed: member.completed,
    dataOnly: true,
    error: member.error,
    index: member.index,
    memoryResultCount: member.memoryResultCount,
    plannerId: member.plannerId,
    previousArchitectureId: member.previousArchitectureId,
    proven: member.proven
  };
}

function memoryAwareEnsemblePayload(report) {
  if (!isTrustedMemoryAwareAgentEnsembleReport(report)) {
    throw new TypeError(
      'Evidence ledger memory-aware-ensemble entries require a trusted ensemble report'
    );
  }
  return {
    allComplete: report.allComplete,
    allProven: report.allProven,
    attemptedAgents: report.attemptedAgents,
    auditValid: report.auditValid,
    authorityTransferred: false,
    completedAgents: report.completedAgents,
    context: report.context,
    dataOnly: true,
    goal: report.goal,
    members: arrayMap(report.members, memoryAwareEnsembleMemberPayload),
    provenAgents: report.provenAgents,
    quorum: report.quorum,
    quorumMet: report.quorumMet,
    query: report.query,
    reproduction: report.reproduction
  };
}

function memoryAwareCoordinationMemberPayload(member) {
  return {
    actionsUsed: member.actionsUsed,
    architectureId: member.architectureId,
    auditValid: member.auditValid,
    authorityTransferred: false,
    completed: member.completed,
    dataOnly: true,
    error: member.error,
    index: member.index,
    memoryResultCount: member.memoryResultCount,
    plannerId: member.plannerId,
    previousArchitectureId: member.previousArchitectureId,
    proven: member.proven
  };
}

function memoryAwareCoordinationPeerPayload(peer) {
  return {
    actionsUsed: peer.actionsUsed,
    architectureId: peer.architectureId,
    auditValid: peer.auditValid,
    authorityTransferred: false,
    completed: peer.completed,
    dataOnly: true,
    error: peer.error,
    memberIndex: peer.memberIndex,
    memoryResultCount: peer.memoryResultCount,
    plannerId: peer.plannerId,
    previousArchitectureId: peer.previousArchitectureId,
    proven: peer.proven,
    round: peer.round
  };
}

function memoryAwareCoordinationPersistencePayload(entry) {
  return {
    architectureId: entry.architectureId,
    error: entry.error,
    index: entry.index,
    ledgerLength: entry.ledgerLength,
    persisted: entry.persisted,
    sequence: entry.sequence
  };
}

function memoryAwareCoordinationConsensusPayload(summary) {
  return {
    allComplete: summary.allComplete,
    allProven: summary.allProven,
    attemptedAgents: summary.attemptedAgents,
    auditValidAgents: summary.auditValidAgents,
    completedAgents: summary.completedAgents,
    dataOnly: true,
    failedAgents: summary.failedAgents,
    provenAgents: summary.provenAgents,
    quorum: summary.quorum,
    quorumMet: summary.quorumMet,
    round: summary.round,
    authorityTransferred: false
  };
}

function memoryAwareCoordinationRoundPayload(round, index) {
  return {
    allComplete: round.allComplete,
    allProven: round.allProven,
    attemptedAgents: round.attemptedAgents,
    auditValid: round.auditValid,
    completedAgents: round.completedAgents,
    context: round.context,
    dataOnly: true,
    goal: round.goal,
    members: arrayMap(round.members, memoryAwareCoordinationMemberPayload),
    provenAgents: round.provenAgents,
    quorum: round.quorum,
    quorumMet: round.quorumMet,
    reproduction: round.reproduction,
    round: index + 1
  };
}

function memoryAwareCoordinationPayload(report) {
  if (!isTrustedMemoryAwareAgentCoordinationReport(report)) {
    throw new TypeError(
      'Evidence ledger memory-aware-coordination entries require a trusted coordination report'
    );
  }
  const body = memoryAwareCoordinationFingerprintBody({
    allRoundsComplete: report.allRoundsComplete,
    allRoundsProven: report.allRoundsProven,
    allRoundsQuorumMet: report.allRoundsQuorumMet,
    authorityTransferred: false,
    context: report.context,
    dataOnly: true,
    expectedPersistedRuns: report.expectedPersistedRuns,
    finalQuorumMet: report.finalQuorumMet,
    goal: report.goal,
    ledgerLengthAfter: report.ledgerLengthAfter,
    ledgerLengthBefore: report.ledgerLengthBefore,
    messagesDataOnly: true,
    peerMessages: arrayMap(
      report.peerMessages,
      (messages) => arrayMap(messages, memoryAwareCoordinationPeerPayload)
    ),
    persistence: arrayMap(
      report.persistence,
      (round) => arrayMap(round, memoryAwareCoordinationPersistencePayload)
    ),
    persistenceComplete: report.persistenceComplete,
    persistedRuns: report.persistedRuns,
    query: report.query,
    reproduction: report.reproduction,
    roundConsensus: arrayMap(
      report.roundConsensus,
      memoryAwareCoordinationConsensusPayload
    ),
    roundCount: report.roundCount,
    rounds: arrayMap(report.rounds, memoryAwareCoordinationRoundPayload)
  });
  return {
    ...body,
    transcriptFingerprint: memoryAwareCoordinationFingerprint(body)
  };
}

function normalizeMemoryAwareEnsembleMember(member, index) {
  const normalized = snapshotData(member);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, MEMORY_AWARE_ENSEMBLE_MEMBER_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-ensemble member ${index} has an invalid shape`
    );
  }
  if (!isSafeInteger(normalized.index) || normalized.index !== index) {
    throw new TypeError(
      `Evidence ledger memory-aware-ensemble member ${index} index is invalid`
    );
  }
  requireNonEmptyString(
    normalized.plannerId,
    `Evidence ledger memory-aware-ensemble member ${index} plannerId`
  );
  optionalNonEmptyString(
    normalized.architectureId,
    `Evidence ledger memory-aware-ensemble member ${index} architectureId`
  );
  optionalNonEmptyString(
    normalized.previousArchitectureId,
    `Evidence ledger memory-aware-ensemble member ${index} previousArchitectureId`
  );
  optionalString(
    normalized.error,
    `Evidence ledger memory-aware-ensemble member ${index} error`
  );
  arrayForEach(
    ['auditValid', 'authorityTransferred', 'completed', 'dataOnly', 'proven'],
    (key) => requireBoolean(
      normalized[key],
      `Evidence ledger memory-aware-ensemble member ${index} ${key}`
    )
  );
  if (
    normalized.authorityTransferred !== false
    || normalized.dataOnly !== true
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-ensemble member ${index} proof boundary is invalid`
    );
  }
  if (
    !isSafeInteger(normalized.actionsUsed)
    || normalized.actionsUsed < 0
    || !isSafeInteger(normalized.memoryResultCount)
    || normalized.memoryResultCount < 0
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-ensemble member ${index} counters are invalid`
    );
  }
  if (!arrayIsArray(normalized.actionEvidence)) {
    throw new TypeError(
      `Evidence ledger memory-aware-ensemble member ${index} action evidence is invalid`
    );
  }
  if (!arrayEvery(
    normalized.actionEvidence,
    (evidence) => arrayIncludes(objectValues(EVIDENCE_LEVELS), evidence)
  )) {
    throw new TypeError(
      `Evidence ledger memory-aware-ensemble member ${index} action evidence is invalid`
    );
  }
  if (
    (normalized.proven && (
      !normalized.completed
      || !normalized.auditValid
      || normalized.actionEvidence.length === 0
      || !arrayEvery(
        normalized.actionEvidence,
        (evidence) => evidence === EVIDENCE_LEVELS.PROVEN
      )
    ))
    || (normalized.error !== null && (normalized.completed || normalized.proven))
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-ensemble member ${index} summary is inconsistent`
    );
  }
  return objectFreeze({
    actionEvidence: objectFreeze(arraySlice(normalized.actionEvidence)),
    actionsUsed: normalized.actionsUsed,
    architectureId: normalized.architectureId,
    auditValid: normalized.auditValid,
    authorityTransferred: false,
    completed: normalized.completed,
    dataOnly: true,
    error: normalized.error,
    index: normalized.index,
    memoryResultCount: normalized.memoryResultCount,
    plannerId: normalized.plannerId,
    previousArchitectureId: normalized.previousArchitectureId,
    proven: normalized.proven
  });
}

function normalizeMemoryAwareEnsemblePayload(payload) {
  const normalized = snapshotData(payload);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, MEMORY_AWARE_ENSEMBLE_KEYS)
  ) {
    throw new TypeError('Evidence ledger memory-aware-ensemble payload has an invalid shape');
  }
  arrayForEach(
    [
      'allComplete',
      'allProven',
      'auditValid',
      'authorityTransferred',
      'dataOnly',
      'quorumMet'
    ],
    (key) => requireBoolean(
      normalized[key],
      `Evidence ledger memory-aware-ensemble ${key}`
    )
  );
  if (
    normalized.authorityTransferred !== false
    || normalized.dataOnly !== true
  ) {
    throw new TypeError('Evidence ledger memory-aware-ensemble proof boundary is invalid');
  }
  requireNonEmptyString(normalized.goal, 'Evidence ledger memory-aware-ensemble goal');
  requireNonEmptyString(
    normalized.reproduction,
    'Evidence ledger memory-aware-ensemble reproduction'
  );
  if (
    !isPlainObject(normalized.query)
    || (normalized.context !== null && !isPlainObject(normalized.context))
  ) {
    throw new TypeError('Evidence ledger memory-aware-ensemble query or context is invalid');
  }
  const members = arrayIsArray(normalized.members)
    ? objectFreeze(arrayMap(
      normalized.members,
      normalizeMemoryAwareEnsembleMember
    ))
    : null;
  if (
    members === null
    || members.length < MINIMUM_MEMORY_AGENT_ENSEMBLE_SIZE
    || members.length > MAXIMUM_MEMORY_AGENT_ENSEMBLE_SIZE
  ) {
    throw new TypeError('Evidence ledger memory-aware-ensemble members are invalid');
  }
  const attemptedAgents = members.length;
  const completedAgents = trueCount(members, 'completed');
  const provenAgents = trueCount(members, 'proven');
  const auditValid = arrayEvery(members, (member) => member.auditValid);
  const allComplete = completedAgents === attemptedAgents;
  const allProven = provenAgents === attemptedAgents;
  arrayForEach(
    [
      ['attemptedAgents', attemptedAgents],
      ['completedAgents', completedAgents],
      ['provenAgents', provenAgents]
    ],
    ([key, expected]) => {
      if (!isSafeInteger(normalized[key]) || normalized[key] !== expected) {
        throw new TypeError(
          `Evidence ledger memory-aware-ensemble ${key} is inconsistent`
        );
      }
    }
  );
  if (
    !isSafeInteger(normalized.quorum)
    || normalized.quorum < 1
    || normalized.quorum > attemptedAgents
    || normalized.auditValid !== auditValid
    || normalized.allComplete !== allComplete
    || normalized.allProven !== allProven
    || normalized.quorumMet !== (provenAgents >= normalized.quorum)
  ) {
    throw new TypeError('Evidence ledger memory-aware-ensemble summary is inconsistent');
  }
  return objectFreeze({
    allComplete,
    allProven,
    attemptedAgents,
    auditValid,
    authorityTransferred: false,
    completedAgents,
    context: normalized.context,
    dataOnly: true,
    goal: normalized.goal,
    members,
    provenAgents,
    quorum: normalized.quorum,
    quorumMet: provenAgents >= normalized.quorum,
    query: normalized.query,
    reproduction: normalized.reproduction
  });
}

function normalizeMemoryAwareCoordinationMember(member, index, roundIndex) {
  const normalized = snapshotData(member);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, MEMORY_AWARE_COORDINATION_MEMBER_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} has an invalid shape`
    );
  }
  if (!isSafeInteger(normalized.index) || normalized.index !== index) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} index is invalid`
    );
  }
  requireNonEmptyString(
    normalized.plannerId,
    `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} plannerId`
  );
  optionalNonEmptyString(
    normalized.architectureId,
    `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} architectureId`
  );
  optionalNonEmptyString(
    normalized.previousArchitectureId,
    `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} previousArchitectureId`
  );
  optionalString(
    normalized.error,
    `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} error`
  );
  requireBoolean(
    normalized.auditValid,
    `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} auditValid`
  );
  requireBoolean(
    normalized.completed,
    `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} completed`
  );
  requireBoolean(
    normalized.dataOnly,
    `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} dataOnly`
  );
  requireBoolean(
    normalized.authorityTransferred,
    `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} authorityTransferred`
  );
  requireBoolean(
    normalized.proven,
    `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} proven`
  );
  if (normalized.dataOnly !== true || normalized.authorityTransferred !== false) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} proof boundary is invalid`
    );
  }
  if (
    !isSafeInteger(normalized.actionsUsed)
    || normalized.actionsUsed < 0
    || !isSafeInteger(normalized.memoryResultCount)
    || normalized.memoryResultCount < 0
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} counters are invalid`
    );
  }
  if (
    (normalized.proven && (!normalized.completed || !normalized.auditValid))
    || (normalized.error !== null && (normalized.completed || normalized.proven))
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination member ${roundIndex + 1}:${index} summary is inconsistent`
    );
  }
  return objectFreeze({
    actionsUsed: normalized.actionsUsed,
    architectureId: normalized.architectureId,
    auditValid: normalized.auditValid,
    authorityTransferred: false,
    completed: normalized.completed,
    dataOnly: true,
    error: normalized.error,
    index: normalized.index,
    memoryResultCount: normalized.memoryResultCount,
    plannerId: normalized.plannerId,
    previousArchitectureId: normalized.previousArchitectureId,
    proven: normalized.proven
  });
}

function normalizeMemoryAwareCoordinationPeer(peer, index, roundIndex) {
  const normalized = snapshotData(peer);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, MEMORY_AWARE_COORDINATION_PEER_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} has an invalid shape`
    );
  }
  if (!isSafeInteger(normalized.memberIndex) || normalized.memberIndex < 0) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} memberIndex is invalid`
    );
  }
  if (!isSafeInteger(normalized.round) || normalized.round !== roundIndex + 1) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} round is invalid`
    );
  }
  requireNonEmptyString(
    normalized.plannerId,
    `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} plannerId`
  );
  optionalNonEmptyString(
    normalized.architectureId,
    `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} architectureId`
  );
  optionalNonEmptyString(
    normalized.previousArchitectureId,
    `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} previousArchitectureId`
  );
  optionalString(
    normalized.error,
    `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} error`
  );
  requireBoolean(
    normalized.auditValid,
    `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} auditValid`
  );
  requireBoolean(
    normalized.completed,
    `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} completed`
  );
  requireBoolean(
    normalized.dataOnly,
    `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} dataOnly`
  );
  requireBoolean(
    normalized.authorityTransferred,
    `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} authorityTransferred`
  );
  requireBoolean(
    normalized.proven,
    `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} proven`
  );
  if (normalized.dataOnly !== true || normalized.authorityTransferred !== false) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} proof boundary is invalid`
    );
  }
  if (
    !isSafeInteger(normalized.actionsUsed)
    || normalized.actionsUsed < 0
    || !isSafeInteger(normalized.memoryResultCount)
    || normalized.memoryResultCount < 0
    || (normalized.proven && (!normalized.completed || !normalized.auditValid))
    || (normalized.error !== null && (normalized.completed || normalized.proven))
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination peer ${roundIndex + 1}:${index} summary is invalid`
    );
  }
  return objectFreeze({
    actionsUsed: normalized.actionsUsed,
    architectureId: normalized.architectureId,
    auditValid: normalized.auditValid,
    authorityTransferred: false,
    completed: normalized.completed,
    dataOnly: true,
    error: normalized.error,
    memberIndex: normalized.memberIndex,
    memoryResultCount: normalized.memoryResultCount,
    plannerId: normalized.plannerId,
    previousArchitectureId: normalized.previousArchitectureId,
    proven: normalized.proven,
    round: normalized.round
  });
}

function normalizeMemoryAwareCoordinationPersistence(entry, index, roundIndex) {
  const normalized = snapshotData(entry);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, MEMORY_AWARE_COORDINATION_PERSISTENCE_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination persistence ${roundIndex + 1}:${index} has an invalid shape`
    );
  }
  optionalNonEmptyString(
    normalized.architectureId,
    `Evidence ledger memory-aware-coordination persistence ${roundIndex + 1}:${index} architectureId`
  );
  optionalString(
    normalized.error,
    `Evidence ledger memory-aware-coordination persistence ${roundIndex + 1}:${index} error`
  );
  if (!isSafeInteger(normalized.index) || normalized.index !== index) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination persistence ${roundIndex + 1}:${index} index is invalid`
    );
  }
  if (!isSafeInteger(normalized.ledgerLength) || normalized.ledgerLength < 0) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination persistence ${roundIndex + 1}:${index} ledgerLength is invalid`
    );
  }
  requireBoolean(
    normalized.persisted,
    `Evidence ledger memory-aware-coordination persistence ${roundIndex + 1}:${index} persisted`
  );
  if (
    normalized.sequence !== null
    && (!isSafeInteger(normalized.sequence) || normalized.sequence <= 0)
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination persistence ${roundIndex + 1}:${index} sequence is invalid`
    );
  }
  if (
    (normalized.persisted && (
      normalized.sequence === null
      || normalized.error !== null
      || normalized.ledgerLength < normalized.sequence
    ))
    || (!normalized.persisted && (
      normalized.sequence !== null
      || normalized.error === null
    ))
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination persistence ${roundIndex + 1}:${index} summary is inconsistent`
    );
  }
  return objectFreeze({
    architectureId: normalized.architectureId,
    error: normalized.error,
    index: normalized.index,
    ledgerLength: normalized.ledgerLength,
    persisted: normalized.persisted,
    sequence: normalized.sequence
  });
}

function normalizeMemoryAwareCoordinationConsensus(summary, index, round) {
  const normalized = snapshotData(summary);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, MEMORY_AWARE_COORDINATION_CONSENSUS_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination consensus ${index + 1} has an invalid shape`
    );
  }
  if (!isSafeInteger(normalized.round) || normalized.round !== index + 1) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination consensus ${index + 1} round is invalid`
    );
  }
  arrayForEach([
    ['attemptedAgents', normalized.attemptedAgents],
    ['completedAgents', normalized.completedAgents],
    ['provenAgents', normalized.provenAgents],
    ['auditValidAgents', normalized.auditValidAgents],
    ['failedAgents', normalized.failedAgents],
    ['quorum', normalized.quorum]
  ], ([field, value]) => {
    if (!isSafeInteger(value) || value < 0) {
      throw new TypeError(
        `Evidence ledger memory-aware-coordination consensus ${index + 1} ${field} is invalid`
      );
    }
  });
  arrayForEach([
    ['dataOnly', normalized.dataOnly],
    ['authorityTransferred', normalized.authorityTransferred],
    ['allComplete', normalized.allComplete],
    ['allProven', normalized.allProven],
    ['quorumMet', normalized.quorumMet]
  ], ([field, value]) => {
    requireBoolean(
      value,
      `Evidence ledger memory-aware-coordination consensus ${index + 1} ${field}`
    );
  });
  if (
    normalized.dataOnly !== true
    || normalized.authorityTransferred !== false
    || normalized.attemptedAgents !== round.attemptedAgents
    || normalized.completedAgents !== round.completedAgents
    || normalized.provenAgents !== round.provenAgents
    || normalized.auditValidAgents !== trueCount(round.members, 'auditValid')
    || normalized.failedAgents !== round.attemptedAgents - round.completedAgents
    || normalized.quorum !== round.quorum
    || normalized.quorumMet !== (normalized.provenAgents >= normalized.quorum)
    || normalized.allComplete !== round.allComplete
    || normalized.allProven !== round.allProven
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination consensus ${index + 1} is inconsistent`
    );
  }
  return objectFreeze({
    allComplete: normalized.allComplete,
    allProven: normalized.allProven,
    attemptedAgents: normalized.attemptedAgents,
    auditValidAgents: normalized.auditValidAgents,
    completedAgents: normalized.completedAgents,
    dataOnly: true,
    failedAgents: normalized.failedAgents,
    provenAgents: normalized.provenAgents,
    quorum: normalized.quorum,
    quorumMet: normalized.quorumMet,
    round: normalized.round,
    authorityTransferred: false
  });
}

function normalizeMemoryAwareCoordinationRound(round, index, topGoal) {
  const normalized = snapshotData(round);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, MEMORY_AWARE_COORDINATION_ROUND_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination round ${index + 1} has an invalid shape`
    );
  }
  if (!isSafeInteger(normalized.round) || normalized.round !== index + 1) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination round ${index + 1} number is invalid`
    );
  }
  requireNonEmptyString(
    normalized.goal,
    `Evidence ledger memory-aware-coordination round ${index + 1} goal`
  );
  if (normalized.goal !== topGoal) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination round ${index + 1} goal does not match transcript`
    );
  }
  requireNonEmptyString(
    normalized.reproduction,
    `Evidence ledger memory-aware-coordination round ${index + 1} reproduction`
  );
  if (normalized.context !== null && !isPlainObject(normalized.context)) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination round ${index + 1} context is invalid`
    );
  }
  requireBoolean(
    normalized.dataOnly,
    `Evidence ledger memory-aware-coordination round ${index + 1} dataOnly`
  );
  if (normalized.dataOnly !== true) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination round ${index + 1} proof boundary is invalid`
    );
  }
  if (!arrayIsArray(normalized.members) || normalized.members.length === 0) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination round ${index + 1} members are invalid`
    );
  }
  const members = objectFreeze(arrayMap(
    normalized.members,
    (member, memberIndex) => normalizeMemoryAwareCoordinationMember(
      member,
      memberIndex,
      index
    )
  ));
  if (
    !isSafeInteger(normalized.attemptedAgents)
    || normalized.attemptedAgents !== members.length
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination round ${index + 1} attemptedAgents is invalid`
    );
  }
  if (
    !isSafeInteger(normalized.completedAgents)
    || normalized.completedAgents !== trueCount(members, 'completed')
    || !isSafeInteger(normalized.provenAgents)
    || normalized.provenAgents !== trueCount(members, 'proven')
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination round ${index + 1} member counts are invalid`
    );
  }
  if (
    !isSafeInteger(normalized.quorum)
    || normalized.quorum < 1
    || normalized.quorum > members.length
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination round ${index + 1} quorum is invalid`
    );
  }
  requireBoolean(
    normalized.auditValid,
    `Evidence ledger memory-aware-coordination round ${index + 1} auditValid`
  );
  requireBoolean(
    normalized.allComplete,
    `Evidence ledger memory-aware-coordination round ${index + 1} allComplete`
  );
  requireBoolean(
    normalized.allProven,
    `Evidence ledger memory-aware-coordination round ${index + 1} allProven`
  );
  requireBoolean(
    normalized.quorumMet,
    `Evidence ledger memory-aware-coordination round ${index + 1} quorumMet`
  );
  if (
    normalized.auditValid !== arrayEvery(members, (member) => member.auditValid)
    || normalized.allComplete !== (normalized.completedAgents === normalized.attemptedAgents)
    || normalized.allProven !== (normalized.provenAgents === normalized.attemptedAgents)
    || normalized.quorumMet !== (normalized.provenAgents >= normalized.quorum)
  ) {
    throw new TypeError(
      `Evidence ledger memory-aware-coordination round ${index + 1} summary is inconsistent`
    );
  }
  return objectFreeze({
    allComplete: normalized.allComplete,
    allProven: normalized.allProven,
    attemptedAgents: normalized.attemptedAgents,
    auditValid: normalized.auditValid,
    completedAgents: normalized.completedAgents,
    context: normalized.context,
    dataOnly: true,
    goal: normalized.goal,
    members,
    provenAgents: normalized.provenAgents,
    quorum: normalized.quorum,
    quorumMet: normalized.quorumMet,
    reproduction: normalized.reproduction,
    round: normalized.round
  });
}

function memoryAwareCoordinationPersistedCount(persistence) {
  let count = 0;
  arrayForEach(persistence, (round) => {
    count += trueCount(round, 'persisted');
  });
  return count;
}

function memoryAwareCoordinationExpectedRuns(rounds) {
  let count = 0;
  arrayForEach(rounds, (round) => {
    count += round.members.length;
  });
  return count;
}

function normalizeMemoryAwareCoordinationPayload(payload) {
  const normalized = snapshotData(payload);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, MEMORY_AWARE_COORDINATION_KEYS)
  ) {
    throw new TypeError('Evidence ledger memory-aware-coordination payload has an invalid shape');
  }
  requireNonEmptyString(normalized.goal, 'Evidence ledger memory-aware-coordination goal');
  requireNonEmptyString(
    normalized.reproduction,
    'Evidence ledger memory-aware-coordination reproduction'
  );
  if (normalized.context !== null && !isPlainObject(normalized.context)) {
    throw new TypeError('Evidence ledger memory-aware-coordination context is invalid');
  }
  if (!isPlainObject(normalized.query)) {
    throw new TypeError('Evidence ledger memory-aware-coordination query is invalid');
  }
  arrayForEach([
    ['dataOnly', normalized.dataOnly],
    ['authorityTransferred', normalized.authorityTransferred],
    ['messagesDataOnly', normalized.messagesDataOnly],
    ['allRoundsComplete', normalized.allRoundsComplete],
    ['allRoundsProven', normalized.allRoundsProven],
    ['allRoundsQuorumMet', normalized.allRoundsQuorumMet],
    ['finalQuorumMet', normalized.finalQuorumMet],
    ['persistenceComplete', normalized.persistenceComplete]
  ], ([field, value]) => {
    requireBoolean(value, `Evidence ledger memory-aware-coordination ${field}`);
  });
  if (
    normalized.dataOnly !== true
    || normalized.authorityTransferred !== false
    || normalized.messagesDataOnly !== true
  ) {
    throw new TypeError('Evidence ledger memory-aware-coordination proof boundary is invalid');
  }
  arrayForEach([
    ['ledgerLengthBefore', normalized.ledgerLengthBefore],
    ['ledgerLengthAfter', normalized.ledgerLengthAfter],
    ['persistedRuns', normalized.persistedRuns],
    ['expectedPersistedRuns', normalized.expectedPersistedRuns],
    ['roundCount', normalized.roundCount]
  ], ([field, value]) => {
    if (!isSafeInteger(value) || value < 0) {
      throw new TypeError(`Evidence ledger memory-aware-coordination ${field} is invalid`);
    }
  });
  if (
    normalized.ledgerLengthAfter < normalized.ledgerLengthBefore
    || normalized.roundCount <= 0
  ) {
    throw new TypeError('Evidence ledger memory-aware-coordination ledger summary is invalid');
  }
  if (
    !arrayIsArray(normalized.rounds)
    || normalized.rounds.length !== normalized.roundCount
    || !arrayIsArray(normalized.peerMessages)
    || normalized.peerMessages.length !== normalized.roundCount
    || !arrayIsArray(normalized.roundConsensus)
    || normalized.roundConsensus.length !== normalized.roundCount
    || !arrayIsArray(normalized.persistence)
    || normalized.persistence.length !== normalized.roundCount
  ) {
    throw new TypeError('Evidence ledger memory-aware-coordination rounds are invalid');
  }
  const rounds = objectFreeze(arrayMap(
    normalized.rounds,
    (round, index) => normalizeMemoryAwareCoordinationRound(round, index, normalized.goal)
  ));
  const roundConsensus = objectFreeze(arrayMap(
    normalized.roundConsensus,
    (summary, index) => normalizeMemoryAwareCoordinationConsensus(
      summary,
      index,
      rounds[index]
    )
  ));
  const peerMessages = objectFreeze(arrayMap(
    normalized.peerMessages,
    (messages, roundIndex) => {
      if (!arrayIsArray(messages) || messages.length !== rounds[roundIndex].members.length) {
        throw new TypeError(
          `Evidence ledger memory-aware-coordination peer messages for round ${roundIndex + 1} are invalid`
        );
      }
      const peers = objectFreeze(arrayMap(
        messages,
        (peer, memberIndex) => normalizeMemoryAwareCoordinationPeer(
          peer,
          memberIndex,
          roundIndex
        )
      ));
      arrayForEach(peers, (peer, memberIndex) => {
        const member = rounds[roundIndex].members[memberIndex];
        if (
          peer.round !== rounds[roundIndex].round
          || peer.memberIndex !== member.index
          || peer.plannerId !== member.plannerId
          || peer.architectureId !== member.architectureId
          || peer.previousArchitectureId !== member.previousArchitectureId
          || peer.auditValid !== member.auditValid
          || peer.completed !== member.completed
          || peer.proven !== member.proven
          || peer.memoryResultCount !== member.memoryResultCount
          || peer.actionsUsed !== member.actionsUsed
          || peer.error !== member.error
        ) {
          throw new TypeError(
            `Evidence ledger memory-aware-coordination peer ${memberIndex} does not match round ${roundIndex + 1}`
          );
        }
      });
      return peers;
    }
  ));
  const persistence = objectFreeze(arrayMap(
    normalized.persistence,
    (entries, roundIndex) => {
      if (!arrayIsArray(entries) || entries.length !== rounds[roundIndex].members.length) {
        throw new TypeError(
          `Evidence ledger memory-aware-coordination persistence for round ${roundIndex + 1} is invalid`
        );
      }
      const normalizedEntries = objectFreeze(arrayMap(
        entries,
        (entry, memberIndex) => normalizeMemoryAwareCoordinationPersistence(
          entry,
          memberIndex,
          roundIndex
        )
      ));
      arrayForEach(normalizedEntries, (entry, memberIndex) => {
        const member = rounds[roundIndex].members[memberIndex];
        if (
          entry.architectureId !== member.architectureId
          || entry.index !== member.index
        ) {
          throw new TypeError(
            `Evidence ledger memory-aware-coordination persistence ${memberIndex} does not match round ${roundIndex + 1}`
          );
        }
      });
      return normalizedEntries;
    }
  ));
  const finalRound = rounds[rounds.length - 1];
  const expectedPersistedRuns = memoryAwareCoordinationExpectedRuns(rounds);
  const persistedRuns = memoryAwareCoordinationPersistedCount(persistence);
  if (
    normalized.allRoundsComplete !== arrayEvery(rounds, (round) => round.allComplete)
    || normalized.allRoundsProven !== arrayEvery(rounds, (round) => round.allProven)
    || normalized.allRoundsQuorumMet !== arrayEvery(rounds, (round) => round.quorumMet)
    || normalized.finalQuorumMet !== finalRound.quorumMet
    || normalized.expectedPersistedRuns !== expectedPersistedRuns
    || normalized.persistedRuns !== persistedRuns
    || normalized.persistenceComplete !== (persistedRuns === expectedPersistedRuns)
  ) {
    throw new TypeError('Evidence ledger memory-aware-coordination transcript summary is inconsistent');
  }
  const body = memoryAwareCoordinationFingerprintBody({
    allRoundsComplete: normalized.allRoundsComplete,
    allRoundsProven: normalized.allRoundsProven,
    allRoundsQuorumMet: normalized.allRoundsQuorumMet,
    authorityTransferred: normalized.authorityTransferred,
    context: normalized.context,
    dataOnly: normalized.dataOnly,
    expectedPersistedRuns: normalized.expectedPersistedRuns,
    finalQuorumMet: normalized.finalQuorumMet,
    goal: normalized.goal,
    ledgerLengthAfter: normalized.ledgerLengthAfter,
    ledgerLengthBefore: normalized.ledgerLengthBefore,
    messagesDataOnly: normalized.messagesDataOnly,
    peerMessages,
    persistence,
    persistenceComplete: normalized.persistenceComplete,
    persistedRuns: normalized.persistedRuns,
    query: normalized.query,
    reproduction: normalized.reproduction,
    roundConsensus,
    roundCount: normalized.roundCount,
    rounds
  });
  requireNonEmptyString(
    normalized.transcriptFingerprint,
    'Evidence ledger memory-aware-coordination transcriptFingerprint'
  );
  if (normalized.transcriptFingerprint !== memoryAwareCoordinationFingerprint(body)) {
    throw new Error('Evidence ledger memory-aware-coordination fingerprint verification failed');
  }
  return objectFreeze({
    ...body,
    transcriptFingerprint: normalized.transcriptFingerprint
  });
}

function memoryAwareSessionFingerprintBody(value) {
  return {
    adopted: value.adopted,
    agentGoal: value.agentGoal,
    allRoundsProven: value.allRoundsProven,
    architectureFingerprint: value.architectureFingerprint,
    architectureGoal: value.architectureGoal,
    architectureId: value.architectureId,
    authorityTransferred: value.authorityTransferred,
    constitutionalMutation: value.constitutionalMutation,
    context: value.context,
    coordination: value.coordination,
    dataOnly: value.dataOnly,
    deployed: value.deployed,
    discoverySummary: value.discoverySummary,
    finalQuorumMet: value.finalQuorumMet,
    freshAgents: value.freshAgents,
    ledgerLengthAfter: value.ledgerLengthAfter,
    ledgerLengthBefore: value.ledgerLengthBefore,
    persistenceComplete: value.persistenceComplete,
    query: value.query,
    reproduction: value.reproduction
  };
}

function memoryAwareSessionFingerprint(value) {
  return `sha256:${createHash('sha256')
    .update(stableSerialize(memoryAwareSessionFingerprintBody(value)))
    .digest('hex')}`;
}

function memoryAwareSessionDiscoveryPayload(summary) {
  return snapshotData({
    adopted: summary.adopted,
    architectureFingerprint: summary.architectureFingerprint,
    architectureId: summary.architectureId,
    authorityTransferred: false,
    candidateCount: summary.candidateCount,
    complete: summary.complete,
    dataOnly: true,
    goal: summary.goal,
    proposalCount: summary.proposalCount,
    reproducible: summary.reproducible,
    winnerId: summary.winnerId
  });
}

function memoryAwareSessionPayload(report) {
  if (!isTrustedMemoryAwareAgentSessionReport(report)) {
    throw new TypeError(
      'Evidence ledger memory-aware-session entries require a trusted session report'
    );
  }
  const discoverySummary = memoryAwareSessionDiscoveryPayload(report.discoverySummary);
  const coordination = memoryAwareCoordinationPayload(report.coordination);
  const body = memoryAwareSessionFingerprintBody({
    adopted: report.adopted,
    agentGoal: report.agentGoal,
    allRoundsProven: report.allRoundsProven,
    architectureFingerprint: report.architectureFingerprint,
    architectureGoal: report.architectureGoal,
    architectureId: report.architectureId,
    authorityTransferred: false,
    constitutionalMutation: report.constitutionalMutation,
    context: snapshotData(report.context),
    coordination,
    dataOnly: true,
    deployed: report.deployed,
    discoverySummary,
    finalQuorumMet: report.finalQuorumMet,
    freshAgents: report.freshAgents,
    ledgerLengthAfter: report.ledgerLengthAfter,
    ledgerLengthBefore: report.ledgerLengthBefore,
    persistenceComplete: report.persistenceComplete,
    query: snapshotData(report.query),
    reproduction: report.reproduction
  });
  return {
    ...body,
    transcriptFingerprint: memoryAwareSessionFingerprint(body)
  };
}

function normalizeMemoryAwareSessionDiscoverySummary(summary) {
  const normalized = snapshotData(summary);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, MEMORY_AWARE_SESSION_DISCOVERY_KEYS)
  ) {
    throw new TypeError('Evidence ledger memory-aware-session discovery summary has an invalid shape');
  }
  requireNonEmptyString(
    normalized.goal,
    'Evidence ledger memory-aware-session discovery goal'
  );
  requireNonEmptyString(
    normalized.winnerId,
    'Evidence ledger memory-aware-session discovery winnerId'
  );
  requireNonEmptyString(
    normalized.architectureFingerprint,
    'Evidence ledger memory-aware-session discovery architectureFingerprint'
  );
  requireNonEmptyString(
    normalized.architectureId,
    'Evidence ledger memory-aware-session discovery architectureId'
  );
  arrayForEach([
    ['adopted', normalized.adopted],
    ['complete', normalized.complete],
    ['dataOnly', normalized.dataOnly],
    ['reproducible', normalized.reproducible],
    ['authorityTransferred', normalized.authorityTransferred]
  ], ([field, value]) => {
    requireBoolean(
      value,
      `Evidence ledger memory-aware-session discovery ${field}`
    );
  });
  if (
    normalized.adopted !== true
    || normalized.complete !== true
    || normalized.dataOnly !== true
    || normalized.reproducible !== true
    || normalized.authorityTransferred !== false
  ) {
    throw new TypeError('Evidence ledger memory-aware-session discovery proof boundary is invalid');
  }
  arrayForEach([
    ['proposalCount', normalized.proposalCount],
    ['candidateCount', normalized.candidateCount]
  ], ([field, value]) => {
    if (!isSafeInteger(value) || value <= 0) {
      throw new TypeError(
        `Evidence ledger memory-aware-session discovery ${field} is invalid`
      );
    }
  });
  return objectFreeze({
    adopted: true,
    architectureFingerprint: normalized.architectureFingerprint,
    architectureId: normalized.architectureId,
    authorityTransferred: false,
    candidateCount: normalized.candidateCount,
    complete: true,
    dataOnly: true,
    goal: normalized.goal,
    proposalCount: normalized.proposalCount,
    reproducible: true,
    winnerId: normalized.winnerId
  });
}

function normalizeMemoryAwareSessionPayload(payload) {
  const normalized = snapshotData(payload);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, MEMORY_AWARE_SESSION_KEYS)
  ) {
    throw new TypeError('Evidence ledger memory-aware-session payload has an invalid shape');
  }
  arrayForEach([
    ['adopted', normalized.adopted],
    ['allRoundsProven', normalized.allRoundsProven],
    ['authorityTransferred', normalized.authorityTransferred],
    ['constitutionalMutation', normalized.constitutionalMutation],
    ['dataOnly', normalized.dataOnly],
    ['deployed', normalized.deployed],
    ['finalQuorumMet', normalized.finalQuorumMet],
    ['freshAgents', normalized.freshAgents],
    ['persistenceComplete', normalized.persistenceComplete]
  ], ([field, value]) => {
    requireBoolean(value, `Evidence ledger memory-aware-session ${field}`);
  });
  if (
    normalized.adopted !== true
    || normalized.authorityTransferred !== false
    || normalized.constitutionalMutation !== false
    || normalized.dataOnly !== true
    || normalized.deployed !== false
    || normalized.freshAgents !== true
  ) {
    throw new TypeError('Evidence ledger memory-aware-session proof boundary is invalid');
  }
  requireNonEmptyString(
    normalized.architectureFingerprint,
    'Evidence ledger memory-aware-session architectureFingerprint'
  );
  requireNonEmptyString(
    normalized.architectureGoal,
    'Evidence ledger memory-aware-session architectureGoal'
  );
  requireNonEmptyString(
    normalized.agentGoal,
    'Evidence ledger memory-aware-session agentGoal'
  );
  requireNonEmptyString(
    normalized.architectureId,
    'Evidence ledger memory-aware-session architectureId'
  );
  requireNonEmptyString(
    normalized.reproduction,
    'Evidence ledger memory-aware-session reproduction'
  );
  if (!isPlainObject(normalized.context) || !isPlainObject(normalized.query)) {
    throw new TypeError('Evidence ledger memory-aware-session context or query is invalid');
  }
  arrayForEach([
    ['ledgerLengthBefore', normalized.ledgerLengthBefore],
    ['ledgerLengthAfter', normalized.ledgerLengthAfter]
  ], ([field, value]) => {
    if (!isSafeInteger(value) || value < 0) {
      throw new TypeError(`Evidence ledger memory-aware-session ${field} is invalid`);
    }
  });
  if (normalized.ledgerLengthAfter < normalized.ledgerLengthBefore) {
    throw new TypeError('Evidence ledger memory-aware-session ledger summary is invalid');
  }
  const discoverySummary = normalizeMemoryAwareSessionDiscoverySummary(
    normalized.discoverySummary
  );
  const coordination = normalizeMemoryAwareCoordinationPayload(normalized.coordination);
  if (
    normalized.architectureGoal !== discoverySummary.goal
    || normalized.architectureFingerprint !== discoverySummary.architectureFingerprint
    || normalized.architectureId !== discoverySummary.architectureId
    || normalized.agentGoal !== coordination.goal
    || stableSerialize(normalized.context) !== stableSerialize(coordination.context)
    || stableSerialize(normalized.query) !== stableSerialize(coordination.query)
    || normalized.reproduction !== coordination.reproduction
    || normalized.allRoundsProven !== coordination.allRoundsProven
    || normalized.finalQuorumMet !== coordination.finalQuorumMet
    || normalized.persistenceComplete !== coordination.persistenceComplete
    || normalized.ledgerLengthBefore !== coordination.ledgerLengthBefore
    || normalized.ledgerLengthAfter !== coordination.ledgerLengthAfter
  ) {
    throw new TypeError('Evidence ledger memory-aware-session summary is inconsistent');
  }
  const body = memoryAwareSessionFingerprintBody({
    adopted: normalized.adopted,
    agentGoal: normalized.agentGoal,
    allRoundsProven: normalized.allRoundsProven,
    architectureFingerprint: normalized.architectureFingerprint,
    architectureGoal: normalized.architectureGoal,
    architectureId: normalized.architectureId,
    authorityTransferred: normalized.authorityTransferred,
    constitutionalMutation: normalized.constitutionalMutation,
    context: normalized.context,
    coordination,
    dataOnly: normalized.dataOnly,
    deployed: normalized.deployed,
    discoverySummary,
    finalQuorumMet: normalized.finalQuorumMet,
    freshAgents: normalized.freshAgents,
    ledgerLengthAfter: normalized.ledgerLengthAfter,
    ledgerLengthBefore: normalized.ledgerLengthBefore,
    persistenceComplete: normalized.persistenceComplete,
    query: normalized.query,
    reproduction: normalized.reproduction
  });
  requireNonEmptyString(
    normalized.transcriptFingerprint,
    'Evidence ledger memory-aware-session transcriptFingerprint'
  );
  if (normalized.transcriptFingerprint !== memoryAwareSessionFingerprint(body)) {
    throw new Error('Evidence ledger memory-aware-session fingerprint verification failed');
  }
  return objectFreeze({
    ...body,
    transcriptFingerprint: normalized.transcriptFingerprint
  });
}

function corePayload(core) {
  if (!core.verifyAudit()) {
    throw new Error('Evidence ledger requires a core with a valid audit chain');
  }
  return snapshotData({
    status: core.status,
    auditTrail: core.auditTrail,
    learningHistory: core.learningHistory,
    researchQueue: core.researchQueue
  });
}

function normalizeModelHistoryEntry(entry, field = 'Evidence ledger learning history') {
  const normalized = snapshotData(entry);
  if (!isPlainObject(normalized)) {
    throw new TypeError(`${field} entries must be plain objects`);
  }
  const keys = arraySort(objectKeys(normalized));
  if (
    keys.length !== MODEL_HISTORY_KEYS.length
    || !arrayEvery(keys, (key, index) => key === MODEL_HISTORY_KEYS[index])
  ) {
    throw new TypeError(`${field} entries have an invalid shape`);
  }

  const strategyKey = requireNonEmptyString(normalized.strategyKey, `${field} strategyKey`);
  if (typeof normalized.predictionError !== 'boolean') {
    throw new TypeError(`${field} predictionError must be boolean`);
  }
  if (!isFiniteNumber(normalized.surpriseNats) || normalized.surpriseNats < 0) {
    throw new TypeError(`${field} surpriseNats must be a non-negative finite number`);
  }
  if (!arrayIncludes(objectValues(SURPRISE_BANDS), normalized.surpriseBand)) {
    throw new TypeError(`${field} surpriseBand is invalid`);
  }
  if (!isFiniteNumber(normalized.expectedLikelihood)
    || normalized.expectedLikelihood <= 0
    || normalized.expectedLikelihood > 1) {
    throw new TypeError(`${field} expectedLikelihood must be greater than 0 and at most 1`);
  }
  if (!isFiniteNumber(normalized.observationLikelihood)
    || normalized.observationLikelihood <= 0
    || normalized.observationLikelihood > 1) {
    throw new TypeError(`${field} observationLikelihood must be greater than 0 and at most 1`);
  }
  if (normalized.predictionError === false
    && normalized.observationLikelihood !== normalized.expectedLikelihood) {
    throw new TypeError(`${field} matching observations must use expectedLikelihood`);
  }
  if (normalized.surpriseNats !== surpriseFromLikelihood(normalized.observationLikelihood)) {
    throw new TypeError(`${field} surpriseNats must match observationLikelihood`);
  }
  if (!arrayIncludes(objectValues(EVIDENCE_LEVELS), normalized.evidence)) {
    throw new TypeError(`${field} evidence level is invalid`);
  }
  if (typeof normalized.verified !== 'boolean') {
    throw new TypeError(`${field} verified must be boolean`);
  }
  if (normalized.verified !== (normalized.evidence === EVIDENCE_LEVELS.PROVEN)) {
    throw new TypeError(`${field} verified must match evidence level`);
  }

  return objectFreeze({
    strategyKey,
    predictionError: normalized.predictionError,
    surpriseNats: normalized.surpriseNats,
    surpriseBand: normalized.surpriseBand,
    actualObservation: normalized.actualObservation,
    expectedLikelihood: normalized.expectedLikelihood,
    observationLikelihood: normalized.observationLikelihood,
    evidence: normalized.evidence,
    verified: normalized.verified
  });
}

function historyEntryFromActionPayload(payload, field = 'Evidence ledger action') {
  if (!isPlainObject(payload) || !isPlainObject(payload.prediction)) {
    throw new TypeError(`${field} payload cannot restore world-model history`);
  }
  const predictionError = payload.predictionError;
  if (typeof predictionError !== 'boolean') {
    throw new TypeError(`${field} predictionError must be boolean`);
  }
  const observationLikelihood = predictionError
    ? payload.prediction.mismatchLikelihood
    : payload.prediction.expectedLikelihood;
  return normalizeModelHistoryEntry({
    strategyKey: payload.prediction.strategyKey,
    predictionError,
    surpriseNats: payload.surpriseNats,
    surpriseBand: payload.surpriseBand,
    actualObservation: payload.observation,
    expectedLikelihood: payload.prediction.expectedLikelihood,
    observationLikelihood,
    evidence: payload.evidence,
    verified: payload.evidence === EVIDENCE_LEVELS.PROVEN
  }, field);
}

function historyEntriesFromRecord(record) {
  if (record.kind === 'action') {
    return [historyEntryFromActionPayload(record.payload)];
  }
  if (record.kind === 'cycle') {
    return [historyEntryFromActionPayload(record.payload.action, 'Evidence ledger cycle action')];
  }
  if (record.kind === 'core') {
    if (!isPlainObject(record.payload) || !arrayIsArray(record.payload.learningHistory)) {
      throw new TypeError('Evidence ledger core payload cannot restore world-model history');
    }
    return arrayMap(
      record.payload.learningHistory,
      (entry) => normalizeModelHistoryEntry(entry, 'Evidence ledger core learning history')
    );
  }
  if (record.kind === 'agent-run') {
    return arrayMap(
      record.payload.cycles,
      (cycle) => historyEntryFromActionPayload(cycle.action, 'Evidence ledger agent-run cycle action')
    );
  }
  return [];
}

function appendUniqueHistory(history, keys, entry) {
  const key = stableSerialize(entry);
  if (!arrayIncludes(keys, key)) {
    arrayPush(keys, key);
    arrayPush(history, entry);
  }
}

function normalizeResearchQueue(queue) {
  const normalizedQueue = snapshotData(queue);
  if (!arrayIsArray(normalizedQueue)) {
    throw new TypeError('Evidence ledger research queue must be an array');
  }
  return objectFreeze(arrayMap(normalizedQueue, (entry, index) => {
    if (!isPlainObject(entry)) {
      throw new TypeError(`Evidence ledger research queue entry ${index} must be an object`);
    }
    const keys = arraySort(objectKeys(entry));
    if (
      keys.length !== RESEARCH_QUEUE_KEYS.length
      || !arrayEvery(keys, (key, keyIndex) => key === RESEARCH_QUEUE_KEYS[keyIndex])
    ) {
      throw new TypeError(`Evidence ledger research queue entry ${index} has an invalid shape`);
    }
    if (!isInteger(entry.actionNumber) || entry.actionNumber <= 0) {
      throw new TypeError(`Evidence ledger research queue entry ${index} actionNumber is invalid`);
    }
    requireNonEmptyString(entry.taskId, `Evidence ledger research queue entry ${index} taskId`);
    requireNonEmptyString(entry.policyMode, `Evidence ledger research queue entry ${index} policyMode`);
    requireNonEmptyString(entry.reason, `Evidence ledger research queue entry ${index} reason`);
    if (!arrayIncludes(objectValues(EVIDENCE_LEVELS), entry.evidence)) {
      throw new TypeError(`Evidence ledger research queue entry ${index} evidence is invalid`);
    }
    if (!arrayIncludes(objectValues(SURPRISE_BANDS), entry.surpriseBand)) {
      throw new TypeError(`Evidence ledger research queue entry ${index} surpriseBand is invalid`);
    }
    if (typeof entry.researchRequested !== 'boolean' || entry.researchRequired !== true) {
      throw new TypeError(`Evidence ledger research queue entry ${index} must require research`);
    }
    if (!isPlainObject(entry.action)) {
      throw new TypeError(`Evidence ledger research queue entry ${index} action is invalid`);
    }
    const actionKeys = arraySort(objectKeys(entry.action));
    if (
      actionKeys.length !== RESEARCH_QUEUE_ACTION_KEYS.length
      || !arrayEvery(actionKeys, (key, keyIndex) => key === RESEARCH_QUEUE_ACTION_KEYS[keyIndex])
    ) {
      throw new TypeError(`Evidence ledger research queue entry ${index} action shape is invalid`);
    }
    requireNonEmptyString(
      entry.action.strategyKey,
      `Evidence ledger research queue entry ${index} action strategyKey`
    );
    if (typeof entry.action.predictionError !== 'boolean') {
      throw new TypeError(`Evidence ledger research queue entry ${index} action predictionError is invalid`);
    }
    if (!isFiniteNumber(entry.action.surpriseNats) || entry.action.surpriseNats < 0) {
      throw new TypeError(`Evidence ledger research queue entry ${index} action surpriseNats is invalid`);
    }
    if (!arrayIncludes(objectValues(EVIDENCE_LEVELS), entry.action.evidence)) {
      throw new TypeError(`Evidence ledger research queue entry ${index} action evidence is invalid`);
    }
    if (entry.action.evidence !== entry.evidence) {
      throw new TypeError(`Evidence ledger research queue entry ${index} evidence provenance is inconsistent`);
    }
    if (entry.action.environmentHash !== null && typeof entry.action.environmentHash !== 'string') {
      throw new TypeError(`Evidence ledger research queue entry ${index} environmentHash is invalid`);
    }
    return objectFreeze(entry);
  }));
}

function hasExactKeys(value, expectedKeys) {
  const keys = arraySort(objectKeys(value));
  return keys.length === expectedKeys.length
    && arrayEvery(keys, (key, index) => key === expectedKeys[index]);
}

function normalizeAdversarialLineageResult(result, index) {
  const normalized = snapshotData(result);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ADVERSARIAL_LINEAGE_RESULT_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger adversarial-lineage result ${index} has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.caseId,
    `Evidence ledger adversarial-lineage result ${index} caseId`
  );
  requireNonEmptyString(
    normalized.domain,
    `Evidence ledger adversarial-lineage result ${index} domain`
  );
  optionalNonEmptyString(
    normalized.error,
    `Evidence ledger adversarial-lineage result ${index} error`
  );
  requireBoolean(
    normalized.expected,
    `Evidence ledger adversarial-lineage result ${index} expected`
  );
  requireBoolean(
    normalized.proven,
    `Evidence ledger adversarial-lineage result ${index} proven`
  );
  optionalNonEmptyString(
    normalized.representation,
    `Evidence ledger adversarial-lineage result ${index} representation`
  );
  requireBoolean(
    normalized.requiresProof,
    `Evidence ledger adversarial-lineage result ${index} requiresProof`
  );
  requireBoolean(
    normalized.success,
    `Evidence ledger adversarial-lineage result ${index} success`
  );
  requireBoolean(
    normalized.adversarial,
    `Evidence ledger adversarial-lineage result ${index} adversarial`
  );
  if (normalized.adversarial !== true) {
    throw new TypeError(
      `Evidence ledger adversarial-lineage result ${index} must be adversarial`
    );
  }
  optionalString(
    normalized.surpriseBand,
    `Evidence ledger adversarial-lineage result ${index} surpriseBand`
  );
  if (
    normalized.surpriseBand !== null
    && !arrayIncludes(objectValues(SURPRISE_BANDS), normalized.surpriseBand)
  ) {
    throw new TypeError(
      `Evidence ledger adversarial-lineage result ${index} surpriseBand is invalid`
    );
  }
  if (
    normalized.surpriseNats !== null
    && (!isFiniteNumber(normalized.surpriseNats) || normalized.surpriseNats < 0)
  ) {
    throw new TypeError(
      `Evidence ledger adversarial-lineage result ${index} surpriseNats is invalid`
    );
  }
  optionalNonEmptyString(
    normalized.verifierId,
    `Evidence ledger adversarial-lineage result ${index} verifierId`
  );
  return objectFreeze({
    adversarial: true,
    caseId: normalized.caseId,
    domain: normalized.domain,
    error: normalized.error,
    expected: normalized.expected,
    proven: normalized.proven,
    representation: normalized.representation,
    requiresProof: normalized.requiresProof,
    success: normalized.success,
    surpriseBand: normalized.surpriseBand,
    surpriseNats: normalized.surpriseNats,
    verifierId: normalized.verifierId
  });
}

function normalizeAdversarialLineagePayload(payload) {
  const normalized = snapshotData(payload);
  if (!isPlainObject(normalized) || !hasExactKeys(normalized, ADVERSARIAL_LINEAGE_KEYS)) {
    throw new TypeError('Evidence ledger adversarial-lineage payload has an invalid shape');
  }
  requireNonEmptyString(normalized.lineageId, 'Evidence ledger adversarial-lineage lineageId');
  requireNonEmptyString(normalized.candidateId, 'Evidence ledger adversarial-lineage candidateId');
  if (normalized.lineageType !== ADVERSARIAL_LINEAGE_TYPES.SKEPTIC) {
    throw new TypeError('Evidence ledger adversarial-lineage lineageType is invalid');
  }
  if (normalized.mode !== POLICY_MODES.SKEPTIC) {
    throw new TypeError('Evidence ledger adversarial-lineage mode is invalid');
  }
  arrayForEach(
    [
      'authorityTransferred',
      'complete',
      'dataOnly',
      'historicalOnly',
      'productionEligible'
    ],
    (key) => requireBoolean(
      normalized[key],
      `Evidence ledger adversarial-lineage ${key}`
    )
  );
  if (
    normalized.authorityTransferred !== false
    || normalized.complete !== (normalized.skippedCases === 0)
    || normalized.dataOnly !== true
    || normalized.historicalOnly !== true
    || normalized.productionEligible !== false
  ) {
    throw new TypeError('Evidence ledger adversarial-lineage proof boundary is invalid');
  }
  const results = arrayIsArray(normalized.results)
    ? objectFreeze(arrayMap(
      normalized.results,
      normalizeAdversarialLineageResult
    ))
    : null;
  if (results === null || results.length === 0) {
    throw new TypeError('Evidence ledger adversarial-lineage results are invalid');
  }
  if (setSize(setFromArray(arrayMap(results, ({ caseId }) => caseId))) !== results.length) {
    throw new TypeError('Evidence ledger adversarial-lineage result case IDs are duplicated');
  }
  const attemptedCases = results.length;
  const eligibleCases = requireDiscoveryCount(
    normalized.eligibleCases,
    'Evidence ledger adversarial-lineage eligibleCases',
    attemptedCases
  );
  const skippedCases = eligibleCases - attemptedCases;
  const successes = arrayFilter(results, (result) => result.success).length;
  const proofEligibleCases = arrayFilter(
    results,
    (result) => result.requiresProof
  ).length;
  const proven = arrayFilter(
    results,
    (result) => result.requiresProof && result.proven
  ).length;
  const adversarialCases = results.length;
  const adversarialSuccesses = successes;
  const weaknessesExposed = adversarialCases - adversarialSuccesses;
  arrayForEach(
    [
      ['adversarialCases', adversarialCases],
      ['adversarialSuccesses', adversarialSuccesses],
      ['attemptedCases', attemptedCases],
      ['proofEligibleCases', proofEligibleCases],
      ['proven', proven],
      ['skippedCases', skippedCases],
      ['successes', successes],
      ['weaknessesExposed', weaknessesExposed]
    ],
    ([key, expected]) => {
      requireDiscoveryCount(
        normalized[key],
        `Evidence ledger adversarial-lineage ${key}`
      );
      if (normalized[key] !== expected) {
        throw new TypeError(
          `Evidence ledger adversarial-lineage ${key} is inconsistent`
        );
      }
    }
  );
  const expectedSuccessRate = successes / attemptedCases;
  const expectedAdversarialSuccessRate = adversarialSuccesses / adversarialCases;
  if (
    normalized.attemptedCases !== attemptedCases
    || normalized.complete !== (skippedCases === 0)
    || !objectIs(normalized.successRate, expectedSuccessRate)
    || !objectIs(normalized.adversarialSuccessRate, expectedAdversarialSuccessRate)
  ) {
    throw new TypeError('Evidence ledger adversarial-lineage metrics are inconsistent');
  }
  requireDiscoveryRate(
    normalized.successRate,
    'Evidence ledger adversarial-lineage successRate'
  );
  requireDiscoveryRate(
    normalized.adversarialSuccessRate,
    'Evidence ledger adversarial-lineage adversarialSuccessRate'
  );
  return objectFreeze({
    adversarialCases,
    adversarialSuccessRate: expectedAdversarialSuccessRate,
    adversarialSuccesses,
    attemptedCases,
    authorityTransferred: false,
    candidateId: normalized.candidateId,
    complete: skippedCases === 0,
    dataOnly: true,
    eligibleCases,
    historicalOnly: true,
    lineageId: normalized.lineageId,
    lineageType: ADVERSARIAL_LINEAGE_TYPES.SKEPTIC,
    mode: POLICY_MODES.SKEPTIC,
    productionEligible: false,
    proofEligibleCases,
    proven,
    results,
    skippedCases,
    successRate: expectedSuccessRate,
    successes,
    weaknessesExposed
  });
}

function normalizeAdversarialLineageEnsemblePayload(payload) {
  const normalized = snapshotData(payload);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, ADVERSARIAL_LINEAGE_ENSEMBLE_KEYS)
  ) {
    throw new TypeError(
      'Evidence ledger adversarial-lineage-ensemble payload has an invalid shape'
    );
  }
  requireNonEmptyString(
    normalized.ensembleId,
    'Evidence ledger adversarial-lineage-ensemble ensembleId'
  );
  requireNonEmptyString(
    normalized.candidateId,
    'Evidence ledger adversarial-lineage-ensemble candidateId'
  );
  if (normalized.lineageType !== ADVERSARIAL_LINEAGE_TYPES.SKEPTIC) {
    throw new TypeError(
      'Evidence ledger adversarial-lineage-ensemble lineageType is invalid'
    );
  }
  if (normalized.mode !== POLICY_MODES.SKEPTIC) {
    throw new TypeError('Evidence ledger adversarial-lineage-ensemble mode is invalid');
  }
  arrayForEach(
    [
      'authorityTransferred',
      'complete',
      'dataOnly',
      'historicalOnly',
      'independent',
      'productionEligible'
    ],
    (key) => requireBoolean(
      normalized[key],
      `Evidence ledger adversarial-lineage-ensemble ${key}`
    )
  );
  if (
    normalized.authorityTransferred !== false
    || normalized.dataOnly !== true
    || normalized.historicalOnly !== true
    || normalized.independent !== true
    || normalized.productionEligible !== false
  ) {
    throw new TypeError(
      'Evidence ledger adversarial-lineage-ensemble proof boundary is invalid'
    );
  }
  const lineages = arrayIsArray(normalized.lineages)
    ? objectFreeze(arrayMap(
      normalized.lineages,
      normalizeAdversarialLineagePayload
    ))
    : null;
  if (
    lineages === null
    || lineages.length < MIN_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE
    || lineages.length > MAX_ADVERSARIAL_LINEAGE_ENSEMBLE_SIZE
  ) {
    throw new TypeError(
      'Evidence ledger adversarial-lineage-ensemble lineages are invalid'
    );
  }
  if (setSize(setFromArray(arrayMap(lineages, ({ lineageId }) => lineageId))) !== lineages.length) {
    throw new TypeError(
      'Evidence ledger adversarial-lineage-ensemble lineage IDs are duplicated'
    );
  }
  const first = lineages[0];
  const firstResultIds = arrayMap(first.results, ({ caseId }) => caseId);
  if (
    !arrayEvery(
      lineages,
      (lineage) => lineage.candidateId === normalized.candidateId
        && lineage.lineageType === ADVERSARIAL_LINEAGE_TYPES.SKEPTIC
        && lineage.mode === POLICY_MODES.SKEPTIC
        && lineage.eligibleCases === first.eligibleCases
        && lineage.attemptedCases === first.attemptedCases
        && lineage.skippedCases === first.skippedCases
        && lineage.results.length === firstResultIds.length
        && arrayEvery(
          lineage.results,
          (result, index) => result.caseId === firstResultIds[index]
        )
    )
  ) {
    throw new TypeError(
      'Evidence ledger adversarial-lineage-ensemble case suite is inconsistent'
    );
  }
  const lineageCount = lineages.length;
  const eligibleCases = first.eligibleCases;
  const attemptedCases = first.attemptedCases;
  const skippedCases = first.skippedCases;
  const evaluatedCases = attemptedCases * lineageCount;
  const eligibleEvaluations = eligibleCases * lineageCount;
  let successes = 0;
  let proofEligibleCases = 0;
  let proven = 0;
  arrayForEach(lineages, (lineage) => {
    successes += lineage.successes;
    proofEligibleCases += lineage.proofEligibleCases;
    proven += lineage.proven;
  });
  const adversarialCases = evaluatedCases;
  const adversarialSuccesses = successes;
  const weaknessesExposed = adversarialCases - adversarialSuccesses;
  const complete = arrayEvery(lineages, (lineage) => lineage.complete);
  const expectedSuccessRate = evaluatedCases === 0
    ? 0
    : successes / evaluatedCases;
  const expectedAdversarialSuccessRate = adversarialCases === 0
    ? null
    : adversarialSuccesses / adversarialCases;
  arrayForEach(
    [
      ['adversarialCases', adversarialCases],
      ['adversarialSuccesses', adversarialSuccesses],
      ['attemptedCases', attemptedCases],
      ['eligibleCases', eligibleCases],
      ['eligibleEvaluations', eligibleEvaluations],
      ['evaluatedCases', evaluatedCases],
      ['lineageCount', lineageCount],
      ['proven', proven],
      ['proofEligibleCases', proofEligibleCases],
      ['skippedCases', skippedCases],
      ['successes', successes],
      ['weaknessesExposed', weaknessesExposed]
    ],
    ([key, expected]) => {
      requireDiscoveryCount(
        normalized[key],
        `Evidence ledger adversarial-lineage-ensemble ${key}`
      );
      if (normalized[key] !== expected) {
        throw new TypeError(
          `Evidence ledger adversarial-lineage-ensemble ${key} is inconsistent`
        );
      }
    }
  );
  if (
    normalized.complete !== complete
    || !objectIs(normalized.successRate, expectedSuccessRate)
    || !objectIs(normalized.adversarialSuccessRate, expectedAdversarialSuccessRate)
  ) {
    throw new TypeError(
      'Evidence ledger adversarial-lineage-ensemble metrics are inconsistent'
    );
  }
  requireDiscoveryRate(
    normalized.successRate,
    'Evidence ledger adversarial-lineage-ensemble successRate'
  );
  requireDiscoveryRate(
    normalized.adversarialSuccessRate,
    'Evidence ledger adversarial-lineage-ensemble adversarialSuccessRate'
  );
  return objectFreeze({
    adversarialCases,
    adversarialSuccessRate: expectedAdversarialSuccessRate,
    adversarialSuccesses,
    attemptedCases,
    authorityTransferred: false,
    candidateId: normalized.candidateId,
    complete,
    dataOnly: true,
    eligibleCases,
    eligibleEvaluations,
    ensembleId: normalized.ensembleId,
    evaluatedCases,
    historicalOnly: true,
    independent: true,
    lineageCount,
    lineageType: ADVERSARIAL_LINEAGE_TYPES.SKEPTIC,
    lineages,
    mode: POLICY_MODES.SKEPTIC,
    productionEligible: false,
    proofEligibleCases,
    proven,
    skippedCases,
    successRate: expectedSuccessRate,
    successes,
    weaknessesExposed
  });
}

function normalizeDistributionShiftResult(result, role, taskId, domain, index) {
  const normalized = snapshotData(result);
  if (
    !isPlainObject(normalized)
    || !hasExactKeys(normalized, DISTRIBUTION_SHIFT_RESULT_KEYS)
  ) {
    throw new TypeError(
      `Evidence ledger distribution-shift ${role} result ${index} has an invalid shape`
    );
  }
  requireNonEmptyString(
    normalized.caseId,
    `Evidence ledger distribution-shift ${role} result ${index} caseId`
  );
  requireNonEmptyString(
    normalized.domain,
    `Evidence ledger distribution-shift ${role} result ${index} domain`
  );
  requireNonEmptyString(
    normalized.taskId,
    `Evidence ledger distribution-shift ${role} result ${index} taskId`
  );
  if (normalized.taskId !== taskId || normalized.domain !== domain) {
    throw new TypeError(
      `Evidence ledger distribution-shift ${role} result ${index} task identity is inconsistent`
    );
  }
  if (normalized.role !== role) {
    throw new TypeError(
      `Evidence ledger distribution-shift ${role} result ${index} role is invalid`
    );
  }
  arrayForEach(
    ['adversarial', 'expected', 'proven', 'requiresProof', 'success'],
    (key) => requireBoolean(
      normalized[key],
      `Evidence ledger distribution-shift ${role} result ${index} ${key}`
    )
  );
  if (role === 'shift' && normalized.adversarial !== true) {
    throw new TypeError(
      `Evidence ledger distribution-shift shift result ${index} must be adversarial`
    );
  }
  if (normalized.requiresProof !== true) {
    throw new TypeError(
      `Evidence ledger distribution-shift ${role} result ${index} must require proof`
    );
  }
  optionalNonEmptyString(
    normalized.error,
    `Evidence ledger distribution-shift ${role} result ${index} error`
  );
  optionalNonEmptyString(
    normalized.representation,
    `Evidence ledger distribution-shift ${role} result ${index} representation`
  );
  optionalString(
    normalized.surpriseBand,
    `Evidence ledger distribution-shift ${role} result ${index} surpriseBand`
  );
  if (
    normalized.surpriseBand !== null
    && !arrayIncludes(objectValues(SURPRISE_BANDS), normalized.surpriseBand)
  ) {
    throw new TypeError(
      `Evidence ledger distribution-shift ${role} result ${index} surpriseBand is invalid`
    );
  }
  if (
    normalized.surpriseNats !== null
    && (!isFiniteNumber(normalized.surpriseNats) || normalized.surpriseNats < 0)
  ) {
    throw new TypeError(
      `Evidence ledger distribution-shift ${role} result ${index} surpriseNats is invalid`
    );
  }
  optionalNonEmptyString(
    normalized.verifierId,
    `Evidence ledger distribution-shift ${role} result ${index} verifierId`
  );
  return objectFreeze({
    adversarial: normalized.adversarial,
    caseId: normalized.caseId,
    domain: normalized.domain,
    error: normalized.error,
    expected: normalized.expected,
    proven: normalized.proven,
    representation: normalized.representation,
    requiresProof: true,
    role,
    success: normalized.success,
    surpriseBand: normalized.surpriseBand,
    surpriseNats: normalized.surpriseNats,
    taskId: normalized.taskId,
    verifierId: normalized.verifierId
  });
}

function normalizeDistributionShiftPayload(payload) {
  const normalized = snapshotData(payload);
  if (!isPlainObject(normalized) || !hasExactKeys(normalized, DISTRIBUTION_SHIFT_KEYS)) {
    throw new TypeError('Evidence ledger distribution-shift payload has an invalid shape');
  }
  requireNonEmptyString(normalized.suiteId, 'Evidence ledger distribution-shift suiteId');
  requireNonEmptyString(
    normalized.candidateId,
    'Evidence ledger distribution-shift candidateId'
  );
  requireNonEmptyString(normalized.taskId, 'Evidence ledger distribution-shift taskId');
  requireNonEmptyString(normalized.domain, 'Evidence ledger distribution-shift domain');
  if (!arrayIncludes(objectValues(DISTRIBUTION_SHIFT_STATUSES), normalized.status)) {
    throw new TypeError('Evidence ledger distribution-shift status is invalid');
  }
  if (normalized.evidence !== EVIDENCE_LEVELS.OBSERVED) {
    throw new TypeError('Evidence ledger distribution-shift evidence must be OBSERVED');
  }
  arrayForEach(
    [
      'authorityTransferred',
      'baselineSuccess',
      'complete',
      'dataOnly',
      'historicalOnly',
      'independent',
      'productionEligible',
      'requiresReview',
      'robust'
    ],
    (key) => requireBoolean(
      normalized[key],
      `Evidence ledger distribution-shift ${key}`
    )
  );
  if (
    normalized.authorityTransferred !== false
    || normalized.complete !== true
    || normalized.dataOnly !== true
    || normalized.historicalOnly !== true
    || normalized.independent !== true
    || normalized.productionEligible !== false
  ) {
    throw new TypeError('Evidence ledger distribution-shift proof boundary is invalid');
  }
  const baseline = isPlainObject(normalized.baseline)
    ? normalizeDistributionShiftResult(
      normalized.baseline,
      'baseline',
      normalized.taskId,
      normalized.domain,
      0
    )
    : null;
  const shifts = arrayIsArray(normalized.shifts)
    ? objectFreeze(arrayMap(
      normalized.shifts,
      (result, index) => normalizeDistributionShiftResult(
        result,
        'shift',
        normalized.taskId,
        normalized.domain,
        index
      )
    ))
    : null;
  if (
    baseline === null
    || shifts === null
    || shifts.length < MIN_DISTRIBUTION_SHIFT_CASES
    || shifts.length > MAX_DISTRIBUTION_SHIFT_CASES
  ) {
    throw new TypeError('Evidence ledger distribution-shift cases are invalid');
  }
  const caseIds = [baseline.caseId];
  arrayForEach(shifts, ({ caseId }) => arrayPush(caseIds, caseId));
  if (setSize(setFromArray(caseIds)) !== caseIds.length) {
    throw new TypeError('Evidence ledger distribution-shift case IDs are duplicated');
  }
  const shiftCount = shifts.length;
  const attemptedCases = shiftCount + 1;
  const baselineSuccess = baseline.success;
  const shiftSuccesses = arrayFilter(shifts, (shift) => shift.success).length;
  const successes = (baselineSuccess ? 1 : 0) + shiftSuccesses;
  const weaknessesExposed = shiftCount - shiftSuccesses;
  const expectedStatus = !baselineSuccess
    ? DISTRIBUTION_SHIFT_STATUSES.BASELINE_FAILED
    : weaknessesExposed > 0
      ? DISTRIBUTION_SHIFT_STATUSES.WEAKNESS_EXPOSED
      : DISTRIBUTION_SHIFT_STATUSES.ROBUST;
  const expectedSuccessRate = successes / attemptedCases;
  const expectedShiftSuccessRate = shiftSuccesses / shiftCount;
  arrayForEach(
    [
      ['attemptedCases', attemptedCases],
      ['baselineSuccess', baselineSuccess],
      ['shiftCount', shiftCount],
      ['shiftSuccesses', shiftSuccesses],
      ['successes', successes],
      ['weaknessesExposed', weaknessesExposed]
    ],
    ([key, expected]) => {
      if (normalized[key] !== expected) {
        throw new TypeError(
          `Evidence ledger distribution-shift ${key} is inconsistent`
        );
      }
    }
  );
  if (
    normalized.status !== expectedStatus
    || normalized.robust !== (expectedStatus === DISTRIBUTION_SHIFT_STATUSES.ROBUST)
    || normalized.requiresReview !== (expectedStatus !== DISTRIBUTION_SHIFT_STATUSES.ROBUST)
    || !objectIs(normalized.successRate, expectedSuccessRate)
    || !objectIs(normalized.shiftSuccessRate, expectedShiftSuccessRate)
  ) {
    throw new TypeError('Evidence ledger distribution-shift metrics are inconsistent');
  }
  requireDiscoveryRate(
    normalized.successRate,
    'Evidence ledger distribution-shift successRate'
  );
  requireDiscoveryRate(
    normalized.shiftSuccessRate,
    'Evidence ledger distribution-shift shiftSuccessRate'
  );
  return objectFreeze({
    attemptedCases,
    authorityTransferred: false,
    baseline,
    baselineSuccess,
    candidateId: normalized.candidateId,
    complete: true,
    dataOnly: true,
    domain: normalized.domain,
    evidence: EVIDENCE_LEVELS.OBSERVED,
    historicalOnly: true,
    independent: true,
    productionEligible: false,
    requiresReview: expectedStatus !== DISTRIBUTION_SHIFT_STATUSES.ROBUST,
    robust: expectedStatus === DISTRIBUTION_SHIFT_STATUSES.ROBUST,
    shiftCount,
    shiftSuccessRate: expectedShiftSuccessRate,
    shiftSuccesses,
    shifts,
    status: expectedStatus,
    successRate: expectedSuccessRate,
    successes,
    suiteId: normalized.suiteId,
    taskId: normalized.taskId,
    weaknessesExposed
  });
}

function normalizeAgentPolicyPayload(policy) {
  if (policy === null) {
    return null;
  }
  if (!isPlainObject(policy) || !hasExactKeys(policy, AGENT_POLICY_KEYS)) {
    throw new TypeError('Evidence ledger agent-run policy has an invalid shape');
  }
  if (policy.dataOnly !== true) {
    throw new TypeError('Evidence ledger agent-run policy must be data-only');
  }
  if (
    !isSafeInteger(policy.maxEpisodes)
    || policy.maxEpisodes < AGENT_POLICY_LIMITS.MIN_EPISODES
    || policy.maxEpisodes > AGENT_POLICY_LIMITS.MAX_EPISODES
  ) {
    throw new TypeError('Evidence ledger agent-run policy maxEpisodes is invalid');
  }
  if (
    !isSafeInteger(policy.maxToolCallsPerEpisode)
    || policy.maxToolCallsPerEpisode < AGENT_POLICY_LIMITS.MIN_TOOL_CALLS_PER_EPISODE
    || policy.maxToolCallsPerEpisode > AGENT_POLICY_LIMITS.MAX_TOOL_CALLS_PER_EPISODE
  ) {
    throw new TypeError('Evidence ledger agent-run policy maxToolCallsPerEpisode is invalid');
  }
  return objectFreeze({
    dataOnly: true,
    maxEpisodes: policy.maxEpisodes,
    maxToolCallsPerEpisode: policy.maxToolCallsPerEpisode
  });
}

function normalizeAgentToolInvocationPayload(invocation, index) {
  if (!isPlainObject(invocation) || !hasExactKeys(invocation, AGENT_TOOL_INVOCATION_KEYS)) {
    throw new TypeError(`Evidence ledger agent-run tool invocation ${index} has an invalid shape`);
  }
  requireNonEmptyString(invocation.callId, `Evidence ledger agent-run tool invocation ${index} callId`);
  requireNonEmptyString(invocation.toolId, `Evidence ledger agent-run tool invocation ${index} toolId`);
  if (!arrayIncludes(objectValues(TOOL_INVOCATION_STATUSES), invocation.status)) {
    throw new TypeError(`Evidence ledger agent-run tool invocation ${index} status is invalid`);
  }
  if (invocation.status === TOOL_INVOCATION_STATUSES.COMPLETED && invocation.error !== null) {
    throw new TypeError(`Evidence ledger agent-run tool invocation ${index} completed with an error`);
  }
  if (invocation.status === TOOL_INVOCATION_STATUSES.FAILED && invocation.error === null) {
    throw new TypeError(`Evidence ledger agent-run tool invocation ${index} failure has no error`);
  }
  if (invocation.error !== null && !isPlainObject(invocation.error)) {
    throw new TypeError(`Evidence ledger agent-run tool invocation ${index} error is invalid`);
  }
  if (
    invocation.durationMs !== null
    && (!isFiniteNumber(invocation.durationMs) || invocation.durationMs < 0)
  ) {
    throw new TypeError(`Evidence ledger agent-run tool invocation ${index} duration is invalid`);
  }
  if (invocation.evidence !== EVIDENCE_LEVELS.OBSERVED || invocation.verified !== false) {
    throw new TypeError(`Evidence ledger agent-run tool invocation ${index} proof boundary is invalid`);
  }
  if (invocation.isolated !== true || typeof invocation.stderr !== 'string') {
    throw new TypeError(`Evidence ledger agent-run tool invocation ${index} isolation metadata is invalid`);
  }
  return objectFreeze({
    callId: invocation.callId,
    durationMs: invocation.durationMs,
    error: invocation.error,
    evidence: invocation.evidence,
    input: invocation.input,
    isolated: true,
    output: invocation.output,
    status: invocation.status,
    stderr: invocation.stderr,
    toolId: invocation.toolId,
    verified: false
  });
}

function normalizeAgentRunPayload(payload) {
  const normalized = snapshotData(payload);
  const currentShape = isPlainObject(normalized)
    && hasExactKeys(normalized, AGENT_RUN_KEYS);
  const legacyShape = isPlainObject(normalized)
    && hasExactKeys(normalized, LEGACY_AGENT_RUN_KEYS);
  if (!currentShape && !legacyShape) {
    throw new TypeError('Evidence ledger agent-run payload has an invalid shape');
  }
  if (!isSafeInteger(normalized.attemptedEpisodes) || normalized.attemptedEpisodes < 0) {
    throw new TypeError('Evidence ledger agent-run attemptedEpisodes is invalid');
  }
  if (typeof normalized.auditValid !== 'boolean' || typeof normalized.completed !== 'boolean') {
    throw new TypeError('Evidence ledger agent-run completion metadata is invalid');
  }
  if (!arrayIncludes(objectValues(AGENT_STOP_REASONS), normalized.stopReason)) {
    throw new TypeError('Evidence ledger agent-run stopReason is invalid');
  }
  if (normalized.error !== null && typeof normalized.error !== 'string') {
    throw new TypeError('Evidence ledger agent-run error is invalid');
  }
  if (normalized.plannerId !== null) {
    requireNonEmptyString(normalized.plannerId, 'Evidence ledger agent-run plannerId');
  }
  const architectureId = normalized.architectureId === undefined
    ? null
    : normalized.architectureId;
  if (architectureId !== null) {
    requireNonEmptyString(
      architectureId,
      'Evidence ledger agent-run architectureId'
    );
  }
  if (!isPlainObject(normalized.coreStatus) || !arrayIsArray(normalized.cycles)) {
    throw new TypeError('Evidence ledger agent-run core or cycle data is invalid');
  }
  if (!arrayEvery(normalized.cycles, (cycle) => isPlainObject(cycle))) {
    throw new TypeError('Evidence ledger agent-run cycles must be data-only objects');
  }
  if (!arrayIsArray(normalized.toolInvocations)) {
    throw new TypeError('Evidence ledger agent-run tool invocations must be an array');
  }
  const pendingResearch = normalizeResearchQueue(normalized.pendingResearch);
  const toolInvocations = objectFreeze(arrayMap(
    normalized.toolInvocations,
    (invocation, index) => normalizeAgentToolInvocationPayload(invocation, index)
  ));
  return objectFreeze({
    attemptedEpisodes: normalized.attemptedEpisodes,
    architectureId,
    auditValid: normalized.auditValid,
    completed: normalized.completed,
    coreStatus: objectFreeze({ ...normalized.coreStatus }),
    cycles: objectFreeze(arrayMap(normalized.cycles, (cycle) => objectFreeze({ ...cycle }))),
    error: normalized.error,
    pendingResearch,
    plannerId: normalized.plannerId,
    policy: normalizeAgentPolicyPayload(normalized.policy),
    stopReason: normalized.stopReason,
    toolInvocations
  });
}

function expectedRecordKeys(record) {
  return arraySort(['schemaVersion', 'sequence', 'kind', 'payload', 'previousHash', 'hash']);
}

export class EvidenceLedger {
  #records = objectFreeze([]);

  constructor() {
    weakSetAdd(TRUSTED_EVIDENCE_LEDGERS, this);
  }

  static fromSerialized(serialized) {
    if (typeof serialized !== 'string') {
      throw new TypeError('Evidence ledger serialization must be a string');
    }
    let parsed;
    try {
      parsed = jsonParse(serialized);
    } catch (error) {
      throw new TypeError(`Evidence ledger serialization is invalid: ${stringFrom(error)}`);
    }
    if (
      !isPlainObject(parsed)
      || parsed.format !== EVIDENCE_LEDGER_FORMAT
      || !arrayIsArray(parsed.records)
    ) {
      throw new TypeError('Evidence ledger serialization has an unknown format');
    }

    const ledger = new EvidenceLedger();
    arrayForEach(parsed.records, (record) => ledger.#appendPersisted(record));
    return ledger;
  }

  get length() {
    return this.#records.length;
  }

  get records() {
    return objectFreeze(arraySlice(this.#records));
  }

  appendAction(report) {
    if (!isTrustedActionReport(report)) {
      throw new TypeError('Evidence ledger action entries require a trusted action report');
    }
    return this.#append('action', actionPayload(report));
  }

  appendCycle(cycle) {
    if (!isTrustedCycleReport(cycle)) {
      throw new TypeError('Evidence ledger cycle entries require a trusted cycle report');
    }
    return this.#append('cycle', cyclePayload(cycle));
  }

  appendCore(core) {
    if (!isTrustedConstitutionalCore(core)) {
      throw new TypeError('Evidence ledger core entries require a trusted constitutional core');
    }
    return this.#append('core', corePayload(core));
  }

  appendAgentRun(report, architectureId = null) {
    if (!isTrustedAgentRunReport(report)) {
      throw new TypeError('Evidence ledger agent-run entries require a trusted agent run report');
    }
    return this.#append('agent-run', agentRunPayload(report, architectureId));
  }

  appendAdversarialLineage(report) {
    if (!isTrustedAdversarialLineageReport(report)) {
      throw new TypeError(
        'Evidence ledger adversarial-lineage entries require a trusted lineage report'
      );
    }
    return this.#append('adversarial-lineage', adversarialLineagePayload(report));
  }

  appendAdversarialLineageEnsemble(report) {
    if (!isTrustedAdversarialLineageEnsembleReport(report)) {
      throw new TypeError(
        'Evidence ledger adversarial-lineage-ensemble entries require a trusted ensemble report'
      );
    }
    return this.#append(
      'adversarial-lineage-ensemble',
      adversarialLineageEnsemblePayload(report)
    );
  }

  appendDistributionShift(report) {
    if (!isTrustedDistributionShiftReport(report)) {
      throw new TypeError(
        'Evidence ledger distribution-shift entries require a trusted distribution-shift report'
      );
    }
    return this.#append('distribution-shift', distributionShiftPayload(report));
  }

  appendMemoryAwareAgentEnsemble(report) {
    if (!isTrustedMemoryAwareAgentEnsembleReport(report)) {
      throw new TypeError(
        'Evidence ledger memory-aware-ensemble entries require a trusted ensemble report'
      );
    }
    return this.#append(
      'memory-aware-ensemble',
      memoryAwareEnsemblePayload(report)
    );
  }

  appendArchitectureDiscovery(report, factoryMetadata = null) {
    return this.#append(
      'architecture-discovery',
      architectureDiscoveryPayload(report, factoryMetadata)
    );
  }

  appendHarnessFactoryBenchmarkCampaign(report) {
    return this.#append(
      'harness-factory-benchmark-campaign',
      harnessFactoryBenchmarkCampaignPayload(report)
    );
  }

  appendHarnessFactoryBenchmarkValidation(report) {
    const payload = harnessFactoryBenchmarkValidationPayload(report);
    validateHarnessFactoryBenchmarkValidationCampaign(this.#records, payload);
    return this.#append('harness-factory-benchmark-validation', payload);
  }

  appendHarnessFactoryValidation(report) {
    const payload = harnessFactoryValidationPayload(report);
    validateHarnessFactoryValidationBaseline(this.#records, payload);
    return this.#append('harness-factory-validation', payload);
  }

  appendArchitectureCoordination(report) {
    return this.#append(
      'architecture-coordination',
      architectureCoordinationPayload(report)
    );
  }

  appendMemoryAwareCoordination(report) {
    if (!isTrustedMemoryAwareAgentCoordinationReport(report)) {
      throw new TypeError(
        'Evidence ledger memory-aware-coordination entries require a trusted coordination report'
      );
    }
    if (report.ledgerLengthAfter !== this.#records.length) {
      throw new TypeError(
        'Evidence ledger memory-aware-coordination report must match the current ledger length'
      );
    }
    return this.#append(
      'memory-aware-coordination',
      memoryAwareCoordinationPayload(report)
    );
  }

  appendMemoryAwareSession(report) {
    if (!isTrustedMemoryAwareAgentSessionReport(report)) {
      throw new TypeError(
        'Evidence ledger memory-aware-session entries require a trusted session report'
      );
    }
    if (report.ledgerLengthAfter !== this.#records.length) {
      throw new TypeError(
        'Evidence ledger memory-aware-session report must match the current ledger length'
      );
    }
    return this.#append(
      'memory-aware-session',
      memoryAwareSessionPayload(report)
    );
  }

  verify() {
    let previousHash = GENESIS_HASH;
    return arrayEvery(this.#records, (record, index) => {
      if (
        record.schemaVersion !== LEDGER_SCHEMA_VERSION
        || record.sequence !== index + 1
        || record.previousHash !== previousHash
        || record.hash !== hashFor(record)
      ) {
        return false;
      }
      previousHash = record.hash;
      return true;
    });
  }

  serialize() {
    return jsonStringify({
      format: EVIDENCE_LEDGER_FORMAT,
      records: this.#records
    });
  }

  restoreResearchQueue() {
    if (!this.verify()) {
      throw new Error('Evidence ledger cannot restore research queue from an invalid chain');
    }
    let latestCore = null;
    arrayForEach(this.#records, (record) => {
      if (record.kind === 'core') {
        latestCore = record;
      }
    });
    if (latestCore === null) {
      return objectFreeze([]);
    }
    const queue = latestCore.payload?.researchQueue ?? [];
    return normalizeResearchQueue(queue);
  }

  restoreAgentRuns() {
    if (!this.verify()) {
      throw new Error('Evidence ledger cannot restore agent runs from an invalid chain');
    }
    const runs = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind === 'agent-run') {
        arrayPush(runs, normalizeAgentRunPayload(record.payload));
      }
    });
    return objectFreeze(runs);
  }

  restoreAdversarialLineages() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore adversarial lineages from an invalid chain'
      );
    }
    const lineages = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind === 'adversarial-lineage') {
        arrayPush(lineages, normalizeAdversarialLineagePayload(record.payload));
      }
    });
    return objectFreeze(lineages);
  }

  restoreAdversarialLineageEnsembles() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore adversarial-lineage ensembles from an invalid chain'
      );
    }
    const ensembles = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind === 'adversarial-lineage-ensemble') {
        arrayPush(ensembles, normalizeAdversarialLineageEnsemblePayload(record.payload));
      }
    });
    return objectFreeze(ensembles);
  }

  restoreDistributionShifts() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore distribution-shift reports from an invalid chain'
      );
    }
    const reports = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind === 'distribution-shift') {
        arrayPush(reports, normalizeDistributionShiftPayload(record.payload));
      }
    });
    return objectFreeze(reports);
  }

  restoreMemoryAwareAgentEnsembles() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore memory-aware ensembles from an invalid chain'
      );
    }
    const ensembles = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind === 'memory-aware-ensemble') {
        arrayPush(ensembles, normalizeMemoryAwareEnsemblePayload(record.payload));
      }
    });
    return objectFreeze(ensembles);
  }

  restoreArchitectureCoordination() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore architecture coordination from an invalid chain'
      );
    }
    const transcripts = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind === 'architecture-coordination') {
        arrayPush(transcripts, normalizeArchitectureCoordinationPayload(record.payload));
      }
    });
    return objectFreeze(transcripts);
  }

  restoreArchitectureDiscoveries() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore architecture discoveries from an invalid chain'
      );
    }
    const discoveries = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind === 'architecture-discovery') {
        arrayPush(discoveries, normalizeArchitectureDiscoveryPayload(record.payload));
      }
    });
    return objectFreeze(discoveries);
  }

  restoreHarnessFactoryBenchmarkCampaigns() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore Harness Factory benchmark campaigns from an invalid chain'
      );
    }
    const campaigns = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind !== 'harness-factory-benchmark-campaign') {
        return;
      }
      const campaign = normalizeHarnessFactoryBenchmarkCampaignPayload(record.payload);
      arrayPush(campaigns, objectFreeze({
        ...campaign,
        archive: objectFreeze({
          kind: record.kind,
          sequence: record.sequence,
          hash: record.hash
        })
      }));
    });
    return objectFreeze(campaigns);
  }

  restoreHarnessFactoryBenchmarkValidations() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore Harness Factory benchmark validations from an invalid chain'
      );
    }
    const validations = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind !== 'harness-factory-benchmark-validation') {
        return;
      }
      const validation = normalizeHarnessFactoryBenchmarkValidationPayload(record.payload);
      validateHarnessFactoryBenchmarkValidationCampaign(this.#records, validation);
      arrayPush(validations, objectFreeze({
        ...validation,
        archive: objectFreeze({
          kind: record.kind,
          sequence: record.sequence,
          hash: record.hash
        })
      }));
    });
    return objectFreeze(validations);
  }

  restoreHarnessFactoryValidations() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore Harness Factory validations from an invalid chain'
      );
    }
    const validations = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind !== 'harness-factory-validation') {
        return;
      }
      const validation = normalizeHarnessFactoryValidationPayload(record.payload);
      validateHarnessFactoryValidationBaseline(this.#records, validation);
      arrayPush(validations, objectFreeze({
        ...validation,
        archive: objectFreeze({
          kind: record.kind,
          sequence: record.sequence,
          hash: record.hash
        })
      }));
    });
    return objectFreeze(validations);
  }

  restoreMemoryAwareCoordination() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore memory-aware coordination from an invalid chain'
      );
    }
    const transcripts = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind === 'memory-aware-coordination') {
        arrayPush(transcripts, normalizeMemoryAwareCoordinationPayload(record.payload));
      }
    });
    return objectFreeze(transcripts);
  }

  restoreMemoryAwareSessions() {
    if (!this.verify()) {
      throw new Error(
        'Evidence ledger cannot restore memory-aware sessions from an invalid chain'
      );
    }
    const sessions = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind === 'memory-aware-session') {
        arrayPush(sessions, normalizeMemoryAwareSessionPayload(record.payload));
      }
    });
    return objectFreeze(sessions);
  }

  restoreWorldModel({ highSurpriseThreshold = 1 } = {}) {
    if (!this.verify()) {
      throw new Error('Evidence ledger cannot restore world-model history from an invalid chain');
    }

    let latestCoreSequence = 0;
    let history = [];
    let keys = [];
    arrayForEach(this.#records, (record) => {
      if (record.kind !== 'core') {
        return;
      }
      history = [];
      keys = [];
      arrayForEach(historyEntriesFromRecord(record), (entry) => {
        appendUniqueHistory(history, keys, entry);
      });
      latestCoreSequence = record.sequence;
    });

    arrayForEach(this.#records, (record) => {
      if (record.sequence <= latestCoreSequence || record.kind === 'core') {
        return;
      }
      arrayForEach(historyEntriesFromRecord(record), (entry) => {
        appendUniqueHistory(history, keys, entry);
      });
    });

    return new WorldModel({ highSurpriseThreshold, history });
  }

  #append(kind, payload) {
    const sequence = this.#records.length + 1;
    const previousHash = arrayAt(this.#records, -1)?.hash ?? GENESIS_HASH;
    const record = objectFreeze({
      schemaVersion: LEDGER_SCHEMA_VERSION,
      sequence,
      kind: requireKind(kind),
      payload: snapshotData(payload),
      previousHash,
      hash: null
    });
    const hashed = objectFreeze({
      ...record,
      hash: hashFor(record)
    });
    const nextRecords = arraySlice(this.#records);
    arrayPush(nextRecords, hashed);
    this.#records = objectFreeze(nextRecords);
    return hashed;
  }

  #appendPersisted(record) {
    if (!isPlainObject(record)) {
      throw new TypeError('Evidence ledger records must be plain objects');
    }
    const keys = arraySort(objectKeys(record));
    if (
      keys.length !== expectedRecordKeys(record).length
      || !arrayEvery(keys, (key, index) => key === expectedRecordKeys(record)[index])
    ) {
      throw new TypeError('Evidence ledger record shape is invalid');
    }
    if (
      record.schemaVersion !== LEDGER_SCHEMA_VERSION
      || record.sequence !== this.#records.length + 1
      || record.kind !== requireKind(record.kind)
    ) {
      throw new Error('Evidence ledger record sequence or schema is invalid');
    }
    const previousHash = arrayAt(this.#records, -1)?.hash ?? GENESIS_HASH;
    if (record.previousHash !== previousHash) {
      throw new Error('Evidence ledger previous hash does not match the chain');
    }
    const payload = record.kind === 'architecture-coordination'
      ? normalizeArchitectureCoordinationPayload(record.payload)
      : record.kind === 'adversarial-lineage'
        ? normalizeAdversarialLineagePayload(record.payload)
        : record.kind === 'adversarial-lineage-ensemble'
          ? normalizeAdversarialLineageEnsemblePayload(record.payload)
        : record.kind === 'distribution-shift'
          ? normalizeDistributionShiftPayload(record.payload)
          : record.kind === 'architecture-discovery'
            ? normalizeArchitectureDiscoveryPayload(record.payload)
          : record.kind === 'harness-factory-benchmark-campaign'
            ? normalizeHarnessFactoryBenchmarkCampaignPayload(record.payload)
          : record.kind === 'harness-factory-benchmark-validation'
            ? normalizeHarnessFactoryBenchmarkValidationPayload(record.payload)
          : record.kind === 'harness-factory-validation'
            ? normalizeHarnessFactoryValidationPayload(record.payload)
          : record.kind === 'memory-aware-ensemble'
            ? normalizeMemoryAwareEnsemblePayload(record.payload)
          : record.kind === 'memory-aware-coordination'
            ? normalizeMemoryAwareCoordinationPayload(record.payload)
            : record.kind === 'memory-aware-session'
              ? normalizeMemoryAwareSessionPayload(record.payload)
              : snapshotData(record.payload);
    if (record.kind === 'harness-factory-validation') {
      validateHarnessFactoryValidationBaseline(this.#records, payload);
    }
    if (record.kind === 'harness-factory-benchmark-validation') {
      validateHarnessFactoryBenchmarkValidationCampaign(this.#records, payload);
    }
    const expectedHash = hashFor({
      schemaVersion: record.schemaVersion,
      sequence: record.sequence,
      kind: record.kind,
      payload,
      previousHash: record.previousHash
    });
    if (record.hash !== expectedHash) {
      throw new Error('Evidence ledger hash verification failed');
    }
    const canonical = objectFreeze({
      schemaVersion: record.schemaVersion,
      sequence: record.sequence,
      kind: record.kind,
      payload,
      previousHash: record.previousHash,
      hash: record.hash
    });
    const nextRecords = arraySlice(this.#records);
    arrayPush(nextRecords, canonical);
    this.#records = objectFreeze(nextRecords);
  }
}

objectFreeze(EvidenceLedger.prototype);

export function isTrustedEvidenceLedger(ledger) {
  return typeof ledger === 'object'
    && ledger !== null
    && weakSetHas(TRUSTED_EVIDENCE_LEDGERS, ledger)
    && objectGetPrototypeOf(ledger) === EvidenceLedger.prototype;
}
