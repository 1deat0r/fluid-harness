import { EVIDENCE_LEVELS } from './evidence.mjs';
import {
  isTrustedAgentPlanner
} from './agent-plan.mjs';
import { isTrustedAgentRunReport } from './agent.mjs';
import { isTrustedEvidenceLedger } from './evidence-ledger.mjs';
import { snapshotProcessData } from './process-boundary.mjs';
import { SURPRISE_BANDS } from './world-model.mjs';
import {
  arrayEvery,
  arrayFilter,
  arrayFind,
  arrayForEach,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  arraySlice,
  arraySort,
  isFiniteNumber,
  isFrozenObject,
  isInstanceOf,
  isPlainObject,
  isSafeInteger,
  jsonStringify,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectHasOwn,
  objectValues,
  minNumbers,
  positiveInfinity,
  reflectOwnKeys,
  setFromArray,
  setHas,
  stringFrom,
  stringLocaleCompare,
  stringToLowerCase,
  stringTrim,
  toNumber,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const MEMORY_SOURCES = objectFreeze({
  AGENT_RUN: 'AGENT_RUN',
  ADVERSARIAL_LINEAGE: 'ADVERSARIAL_LINEAGE',
  ARCHITECTURE_DISCOVERY: 'ARCHITECTURE_DISCOVERY',
  HARNESS_FACTORY_BENCHMARK_CAMPAIGN: 'HARNESS_FACTORY_BENCHMARK_CAMPAIGN',
  HARNESS_FACTORY_BENCHMARK_VALIDATION: 'HARNESS_FACTORY_BENCHMARK_VALIDATION',
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION: 'HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION',
  COORDINATION: 'COORDINATION',
  DISTRIBUTION_SHIFT: 'DISTRIBUTION_SHIFT',
  ENSEMBLE: 'ENSEMBLE',
  RESEARCH: 'RESEARCH',
  SESSION: 'SESSION',
  LEDGER: 'LEDGER',
  CALLER: 'CALLER'
});

export const MAX_STRUCTURED_MEMORY_ENTRIES = 128;
export const MAX_STRUCTURED_MEMORY_KEYWORDS = 16;
export const MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH = 64;
export const MAX_STRUCTURED_MEMORY_DESCRIPTION_LENGTH = 256;
export const MAX_STRUCTURED_MEMORY_QUERY_RESULTS = 32;
export const STRUCTURED_MEMORY_CONTEXT_SOURCE = 'STRUCTURED_MEMORY';

const VALID_EVIDENCE = setFromArray(objectValues(EVIDENCE_LEVELS));
const VALID_SURPRISE_BANDS = setFromArray(objectValues(SURPRISE_BANDS));
const VALID_MEMORY_SOURCES = setFromArray(objectValues(MEMORY_SOURCES));
const MEMORY_ENTRY_KEYS = objectFreeze([
  'architectureId',
  'id',
  'taskId',
  'description',
  'strategyKey',
  'evidence',
  'surpriseBand',
  'surpriseNats',
  'predictionError',
  'actionNumber',
  'source',
  'keywords',
  'provenance'
]);
const MEMORY_PROVENANCE_KEYS = objectFreeze(['hash', 'kind', 'sequence']);
const MEMORY_OPTIONS_KEYS = objectFreeze(['entries', 'maxEntries']);
const MEMORY_QUERY_KEYS = objectFreeze([
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
const MEMORY_CONTEXT_KEYS = objectFreeze(['retrieval']);
const MEMORY_CONTEXT_FACTORY_KEYS = objectFreeze(['memory', 'query']);
const MEMORY_PLANNER_KEYS = objectFreeze(['planner', 'goal', 'memoryContext', 'context']);
const TRUSTED_MEMORY_ENTRIES = weakSetCreate();
const TRUSTED_STRUCTURED_MEMORIES = weakSetCreate();
const TRUSTED_MEMORY_RETRIEVALS = weakSetCreate();
const TRUSTED_MEMORY_CONTEXTS = weakSetCreate();

function requireNonEmptyString(value, field, maximum = positiveInfinity()) {
  if (typeof value !== 'string') {
    throw new TypeError(`${field} must be a string`);
  }
  const normalized = stringTrim(value);
  if (normalized === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  if (normalized.length > maximum) {
    throw new RangeError(`${field} must not exceed ${maximum} characters`);
  }
  return normalized;
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
      || (allowedKeys !== null && !arrayIncludes(allowedKeys, key))
    ) {
      throw new TypeError(`${field} must contain only enumerable data properties`);
    }
  });
  return value;
}

function normalizeMemoryProvenance(value) {
  if (value === null) {
    return null;
  }
  requireDataObject(value, 'Memory entry provenance', MEMORY_PROVENANCE_KEYS);
  const keys = reflectOwnKeys(value);
  if (
    keys.length !== MEMORY_PROVENANCE_KEYS.length
    || !arrayIncludes(keys, 'hash')
    || !arrayIncludes(keys, 'kind')
    || !arrayIncludes(keys, 'sequence')
  ) {
    throw new TypeError(
      'Memory entry provenance must contain exactly hash, kind, and sequence'
    );
  }
  if (!isSafeInteger(value.sequence) || value.sequence <= 0) {
    throw new TypeError('Memory entry provenance sequence must be a positive integer');
  }
  return objectFreeze({
    hash: requireNonEmptyString(value.hash, 'Memory entry provenance hash', 256),
    kind: requireNonEmptyString(value.kind, 'Memory entry provenance kind', 64),
    sequence: value.sequence
  });
}

function provenanceForLedgerRecord(record) {
  if (!isPlainObject(record)) {
    throw new TypeError('Ledger-derived memory requires a plain ledger record provenance');
  }
  return normalizeMemoryProvenance({
    hash: record.hash,
    kind: record.kind,
    sequence: record.sequence
  });
}

function ledgerRecordsOfKind(ledger, kind) {
  return arrayFilter(ledger.records, (record) => record.kind === kind);
}

function latestLedgerRecordOfKind(ledger, kind) {
  const records = ledgerRecordsOfKind(ledger, kind);
  return records.length === 0 ? null : records[records.length - 1];
}

function requireDenseDataArray(value, field, maximum) {
  if (!arrayIsArray(value)) {
    throw new TypeError(`${field} must be an array`);
  }
  if (value.length > maximum) {
    throw new RangeError(`${field} cannot contain more than ${maximum} entries`);
  }
  arrayForEach(reflectOwnKeys(value), (key) => {
    if (key === 'length') {
      return;
    }
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (typeof key === 'symbol' || !descriptor?.enumerable || descriptor.get || descriptor.set) {
      throw new TypeError(`${field} must contain only enumerable data entries`);
    }
    const numericKey = toNumber(key);
    if (!isSafeInteger(numericKey) || numericKey < 0 || stringFrom(numericKey) !== key) {
      throw new TypeError(`${field} must contain only dense numeric entries`);
    }
  });
  for (let index = 0; index < value.length; index += 1) {
    if (!objectHasOwn(value, index)) {
      throw new TypeError(`${field} must be dense`);
    }
  }
  return value;
}

function normalizeKeywords(value, field = 'Memory keywords') {
  requireDenseDataArray(value, field, MAX_STRUCTURED_MEMORY_KEYWORDS);
  const normalized = [];
  arrayForEach(value, (keyword, index) => {
    const candidate = stringToLowerCase(
      requireNonEmptyString(keyword, `${field} entry ${index}`, MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH)
    );
    if (!arrayIncludes(normalized, candidate)) {
      arrayPush(normalized, candidate);
    }
  });
  arraySort(normalized, (left, right) => stringLocaleCompare(left, right));
  return objectFreeze(normalized);
}

function normalizeMemoryEntry(entry, index) {
  if (isTrustedStructuredMemoryEntry(entry)) {
    return entry;
  }
  try {
    return new StructuredMemoryEntry(entry);
  } catch (error) {
    if (isInstanceOf(error, Error)) {
      error.message = `Memory entry ${index}: ${error.message}`;
    }
    throw error;
  }
}

function compareRetrieved(left, right) {
  return right.score - left.score
    || right.entry.surpriseNats - left.entry.surpriseNats
    || (right.entry.actionNumber ?? -1) - (left.entry.actionNumber ?? -1)
    || stringLocaleCompare(left.entry.id, right.entry.id);
}

function cycleMemoryEntry(
  cycle,
  prefix,
  source = MEMORY_SOURCES.AGENT_RUN,
  architectureId = null,
  provenance = null
) {
  const description = cycle?.stages?.understand?.description;
  const strategyKey = cycle?.action?.prediction?.strategyKey;
  if (
    !cycle
    || typeof cycle !== 'object'
    || typeof description !== 'string'
    || typeof strategyKey !== 'string'
  ) {
    throw new TypeError('Agent run cycle cannot be converted into structured memory');
  }
  const representation = cycle.stages.represent?.representation;
  const reasoningEngine = cycle.stages.represent?.reasoningEngine;
  const keywords = [cycle.taskId, strategyKey];
  if (typeof representation === 'string') {
    arrayPush(keywords, representation);
  }
  if (typeof reasoningEngine === 'string') {
    arrayPush(keywords, reasoningEngine);
  }
  const normalizedArchitectureId = architectureId === null
    ? null
    : requireNonEmptyString(
      architectureId,
      'Memory entry architectureId',
      128
    );
  return new StructuredMemoryEntry({
    architectureId: normalizedArchitectureId,
    id: `${prefix}:${cycle.actionNumber}:${cycle.taskId}`,
    taskId: cycle.taskId,
    description,
    strategyKey,
    evidence: cycle.action.evidence,
    surpriseBand: cycle.action.surpriseBand,
    surpriseNats: cycle.action.surpriseNats,
    predictionError: cycle.action.predictionError,
    actionNumber: cycle.actionNumber,
    source,
    keywords,
    provenance
  });
}

function architectureDiscoveryMemoryEntry(discovery, prefix, index, provenance = null) {
  const winnerId = requireNonEmptyString(
    discovery.winnerId,
    `Architecture discovery ${index} winnerId`
  );
  const architectureId = winnerId.length <= 128 ? winnerId : null;
  const status = discovery.factory?.status === 'REJECTED'
    ? 'rejected'
    : discovery.adopted
      ? 'adopted'
      : 'rejected';
  const reproducibility = discovery.reproducibility?.reproducible === true
    ? 'reproducible'
    : 'not-reproducible';
  const completeness = discovery.complete === true ? 'complete' : 'incomplete';
  const keywords = [
    'architecture-discovery',
    status,
    reproducibility,
    completeness
  ];
  if (discovery.factory !== undefined) {
    arrayPush(
      keywords,
      discovery.factory.holdout === undefined
        ? 'holdout-not-run'
        : discovery.factory.holdout.passed === true
          ? 'holdout-passed'
        : 'holdout-failed'
    );
    if (isSafeInteger(discovery.factory.generation) && discovery.factory.generation > 0) {
      arrayPush(keywords, `factory-generation-${discovery.factory.generation}`);
    }
  }
  if (winnerId.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH) {
    arrayPush(keywords, winnerId);
  }
  const taskId = isSafeInteger(provenance?.sequence) && provenance.sequence > 0
    ? `architecture-discovery:${provenance.sequence}`
    : `architecture-discovery:${index}`;
  return new StructuredMemoryEntry({
    architectureId,
    id: `${prefix}:architecture-discovery:${index}`,
    taskId,
    description: `Architecture discovery ${status} candidate`,
    strategyKey: 'architecture-discovery',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.ARCHITECTURE_DISCOVERY,
    keywords,
    provenance
  });
}

function harnessFactoryBenchmarkCampaignMemoryEntry(campaign, prefix, index, provenance = null) {
  const completeness = campaign.complete ? 'complete' : 'incomplete';
  const reproducibility = campaign.reproducible ? 'reproducible' : 'not-reproducible';
  const independence = campaign.independent ? 'independent' : 'dependent';
  const keywords = [
    'harness-factory-benchmark-campaign',
    completeness,
    reproducibility,
    independence,
    `candidates-${campaign.candidateIds.length}`,
    `frontier-${campaign.frontier.length}`
  ];
  arrayForEach(campaign.candidateIds, (candidateId) => {
    if (
      keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
      && candidateId.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
    ) {
      arrayPush(keywords, candidateId);
    }
  });
  const taskId = isSafeInteger(provenance?.sequence) && provenance.sequence > 0
    ? `harness-factory-benchmark-campaign:${provenance.sequence}`
    : `harness-factory-benchmark-campaign:${index}`;
  return new StructuredMemoryEntry({
    id: `${prefix}:harness-factory-benchmark-campaign:${index}`,
    taskId,
    description: `Historical Harness Factory benchmark campaign ${completeness} across ${campaign.candidateIds.length} candidates`,
    strategyKey: 'harness-factory-benchmark-campaign',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_CAMPAIGN,
    keywords,
    provenance
  });
}

function harnessFactoryBenchmarkValidationMemoryEntry(
  validation,
  prefix,
  index,
  provenance = null
) {
  const validationStatus = validation.passed ? 'passed' : 'failed';
  const holdoutStatus = validation.holdout.passed ? 'passed' : 'failed';
  const completeness = validation.complete ? 'complete' : 'incomplete';
  const reproducibility = validation.reproducible
    ? 'reproducible'
    : 'not-reproducible';
  const independence = validation.independent ? 'independent' : 'dependent';
  const keywords = [
    'harness-factory-benchmark-validation',
    `validation-${validationStatus}`,
    `holdout-${holdoutStatus}`,
    completeness,
    reproducibility,
    independence,
    'benchmark-match'
  ];
  const levelKeyword = `level-${validation.levelId}`;
  if (
    keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
    && levelKeyword.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
  ) {
    arrayPush(keywords, levelKeyword);
  }
  if (
    keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
    && validation.candidateId.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
  ) {
    arrayPush(keywords, validation.candidateId);
  }
  const taskId = isSafeInteger(provenance?.sequence) && provenance.sequence > 0
    ? `harness-factory-benchmark-validation:${provenance.sequence}`
    : `harness-factory-benchmark-validation:${index}`;
  return new StructuredMemoryEntry({
    id: `${prefix}:harness-factory-benchmark-validation:${index}`,
    taskId,
    description: `Historical Harness Factory benchmark validation ${validationStatus} for ${validation.candidateId}`,
    strategyKey: 'harness-factory-benchmark-validation',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_VALIDATION,
    architectureId: validation.candidateId,
    keywords,
    provenance
  });
}

function harnessFactoryBenchmarkFrontierValidationMemoryEntry(
  campaign,
  validations,
  prefix,
  index,
  provenance
) {
  const campaignValidations = arrayFilter(
    validations,
    (validation) => validation.factoryId === campaign.factoryId
      && isPlainObject(validation.campaignArchive)
      && validation.campaignArchive.kind === campaign.archive.kind
      && validation.campaignArchive.sequence === campaign.archive.sequence
      && validation.campaignArchive.hash === campaign.archive.hash
  );
  if (campaignValidations.length === 0) {
    return null;
  }
  const pointScores = [];
  arrayForEach(campaignValidations, (validation) => {
    const frontierPoint = arrayFind(
      campaign.frontier,
      (point) => point.architectureId === validation.candidateId
        && point.levelId === validation.levelId
    );
    if (
      frontierPoint === undefined
      || validation.caseFingerprint !== campaign.caseFingerprint
      || validation.caseIds.length !== campaign.caseIds.length
      || !arrayEvery(
        validation.caseIds,
        (caseId, caseIndex) => caseId === campaign.caseIds[caseIndex]
      )
      || jsonStringify(frontierPoint) !== jsonStringify(validation.campaignPoint)
    ) {
      throw new Error(
        'Structured memory found inconsistent Harness Factory frontier validation evidence'
      );
    }
    let pointScore = arrayFind(
      pointScores,
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
      arrayPush(pointScores, pointScore);
    }
    pointScore.validationCount += 1;
    pointScore.latest = validation;
  });
  const frontierCount = campaign.frontier.length;
  const coveredCount = pointScores.length;
  const validationCount = campaignValidations.length;
  const passedCount = arrayFilter(
    pointScores,
    ({ latest }) => latest.passed === true
  ).length;
  const complete = coveredCount === frontierCount
    && arrayEvery(pointScores, ({ latest }) => latest.complete === true);
  const reproducible = coveredCount === frontierCount
    && arrayEvery(pointScores, ({ latest }) => latest.reproducible === true);
  const independent = coveredCount === frontierCount
    && arrayEvery(pointScores, ({ latest }) => latest.independent === true);
  const status = coveredCount < frontierCount
    ? 'incomplete'
    : passedCount === coveredCount && complete && reproducible && independent
      ? 'passed'
      : 'failed';
  const keywords = [
    'harness-factory-benchmark-frontier-validation',
    `frontier-validation-${status}`,
    `coverage-${coveredCount}-of-${frontierCount}`,
    `validations-${validationCount}`,
    `duplicates-${validationCount - coveredCount}`,
    `passed-${passedCount}`,
    `failed-${coveredCount - passedCount}`,
    complete ? 'complete' : 'incomplete',
    reproducible ? 'reproducible' : 'not-reproducible',
    independent ? 'independent' : 'dependent'
  ];
  const factoryKeyword = `factory-${campaign.factoryId}`;
  if (factoryKeyword.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH) {
    arrayPush(keywords, factoryKeyword);
  }
  return new StructuredMemoryEntry({
    id: `${prefix}:harness-factory-benchmark-frontier-validation:${index}`,
    taskId: isSafeInteger(provenance?.sequence) && provenance.sequence > 0
      ? `harness-factory-benchmark-frontier-validation:${provenance.sequence}`
      : `harness-factory-benchmark-frontier-validation:${index}`,
    description: `Historical Harness Factory frontier validation ${status} with ${coveredCount}/${frontierCount} points covered`,
    strategyKey: 'harness-factory-benchmark-frontier-validation',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION,
    keywords,
    provenance
  });
}

function researchQuestionMemoryEntry(question, prefix, index, provenance = null) {
  const strategyKey = question.action.strategyKey;
  const keywords = [
    'research-question',
    'research-required',
    question.researchRequested ? 'research-requested' : 'research-automatic',
    question.surpriseBand,
    question.action.predictionError ? 'prediction-error' : 'prediction-aligned'
  ];
  if (typeof strategyKey === 'string' && strategyKey.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH) {
    arrayPush(keywords, strategyKey);
  }
  return new StructuredMemoryEntry({
    id: `${prefix}:research:${index}`,
    taskId: `research-question:${index}`,
    description: 'Historical bounded research question',
    strategyKey: 'research-question',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: question.surpriseBand,
    surpriseNats: question.action.surpriseNats,
    predictionError: question.action.predictionError,
    actionNumber: null,
    source: MEMORY_SOURCES.RESEARCH,
    keywords,
    provenance
  });
}

function sameResearchQuestion(left, right) {
  return left.actionNumber === right.actionNumber
    && left.taskId === right.taskId
    && left.policyMode === right.policyMode
    && left.reason === right.reason
    && left.evidence === right.evidence
    && left.researchRequested === right.researchRequested
    && left.researchRequired === right.researchRequired
    && left.surpriseBand === right.surpriseBand
    && left.action.strategyKey === right.action.strategyKey
    && left.action.predictionError === right.action.predictionError
    && left.action.surpriseNats === right.action.surpriseNats
    && left.action.evidence === right.action.evidence;
}

function researchResultMemoryEntry(cycle, prefix, index, provenance = null) {
  const research = cycle?.research;
  const action = cycle?.action;
  if (
    !isPlainObject(research)
    || research.complete !== true
    || typeof research.allAuditsValid !== 'boolean'
    || !isPlainObject(action)
    || !setHas(VALID_SURPRISE_BANDS, action.surpriseBand)
    || !isFiniteNumber(action.surpriseNats)
    || action.surpriseNats < 0
    || typeof action.predictionError !== 'boolean'
  ) {
    throw new TypeError('Completed research cycle cannot be converted into structured memory');
  }
  const winnerId = research.winner === null
    ? null
    : requireNonEmptyString(research.winner, 'Research result winnerId', 128);
  const promotedId = research.promoted === null
    ? null
    : requireNonEmptyString(research.promoted, 'Research result promotedId', 128);
  const keywords = [
    'research-result',
    'research-complete',
    research.allAuditsValid ? 'audited' : 'audit-failed',
    promotedId === null ? 'not-promoted' : 'promoted',
    winnerId === null ? 'no-winner' : 'winner-present'
  ];
  if (winnerId !== null && winnerId.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH) {
    arrayPush(keywords, winnerId);
  }
  if (promotedId !== null && promotedId.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH) {
    arrayPush(keywords, promotedId);
  }
  return new StructuredMemoryEntry({
    id: `${prefix}:research-result:${index}`,
    taskId: `research-result:${index}`,
    description: 'Historical completed research result',
    strategyKey: 'research-result',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: action.surpriseBand,
    surpriseNats: action.surpriseNats,
    predictionError: action.predictionError,
    actionNumber: null,
    source: MEMORY_SOURCES.RESEARCH,
    keywords,
    provenance
  });
}

function memoryAwareSessionMemoryEntry(session, prefix, index, provenance = null) {
  const quorumStatus = session.finalQuorumMet ? 'quorum' : 'non-quorum';
  const persistenceStatus = session.persistenceComplete
    ? 'persisted'
    : 'partial-persistence';
  const completionStatus = session.finalQuorumMet
    && session.allRoundsProven
    && session.persistenceComplete
    ? 'complete'
    : 'incomplete';
  const architectureId = session.architectureId.length <= 128
    ? session.architectureId
    : null;
  const keywords = [
    'memory-aware-session',
    'adopted',
    quorumStatus,
    persistenceStatus,
    completionStatus
  ];
  if (architectureId !== null && architectureId.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH) {
    arrayPush(keywords, architectureId);
  }
  return new StructuredMemoryEntry({
    architectureId,
    id: `${prefix}:session:${index}`,
    taskId: `memory-aware-session:${index}`,
    description: `Memory-aware session ${quorumStatus} architecture`,
    strategyKey: 'memory-aware-session',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.SESSION,
    keywords,
    provenance
  });
}

function memoryAwareCoordinationMemoryEntry(coordination, prefix, index, provenance = null) {
  const quorumStatus = coordination.finalQuorumMet ? 'quorum' : 'non-quorum';
  const persistenceStatus = coordination.persistenceComplete
    ? 'persisted'
    : 'partial-persistence';
  const completionStatus = coordination.finalQuorumMet
    && coordination.allRoundsProven
    && coordination.persistenceComplete
    ? 'complete'
    : 'incomplete';
  const firstRound = coordination.rounds[0];
  const agentCount = firstRound.members.length;
  return new StructuredMemoryEntry({
    id: `${prefix}:coordination:${index}`,
    taskId: `memory-aware-coordination:${index}`,
    description: `Memory-aware coordination ${quorumStatus} across ${coordination.roundCount} rounds`,
    strategyKey: 'memory-aware-coordination',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.COORDINATION,
    keywords: [
      'memory-aware-coordination',
      quorumStatus,
      persistenceStatus,
      completionStatus,
      `rounds-${coordination.roundCount}`,
      `agents-${agentCount}`
    ],
    provenance
  });
}

function memoryAwareEnsembleMemoryEntry(ensemble, prefix, index, provenance = null) {
  const quorumStatus = ensemble.quorumMet ? 'quorum' : 'non-quorum';
  const completionStatus = ensemble.allComplete ? 'complete' : 'incomplete';
  const proofStatus = ensemble.allProven ? 'all-proven' : 'partial-proof';
  const keywords = [
    'memory-aware-agent-ensemble',
    quorumStatus,
    completionStatus,
    proofStatus,
    `agents-${ensemble.attemptedAgents}`,
    `proven-${ensemble.provenAgents}`,
    `quorum-${ensemble.quorum}`
  ];
  if (ensemble.goal.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH) {
    arrayPush(keywords, ensemble.goal);
  }
  return new StructuredMemoryEntry({
    id: `${prefix}:memory-aware-ensemble:${index}`,
    taskId: `memory-aware-ensemble:${index}`,
    description: `Historical memory-aware ensemble ${quorumStatus}`,
    strategyKey: 'memory-aware-agent-ensemble',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.ENSEMBLE,
    keywords,
    provenance
  });
}

function adversarialLineageMemoryEntry(lineage, prefix, index, provenance = null) {
  const weaknessStatus = lineage.weaknessesExposed > 0
    ? 'weakness-exposed'
    : 'no-weakness-exposed';
  const completenessStatus = lineage.complete ? 'complete' : 'incomplete';
  const architectureId = lineage.candidateId.length <= 128
    ? lineage.candidateId
    : null;
  const keywords = [
    'adversarial-lineage',
    'skeptic',
    weaknessStatus,
    completenessStatus,
    `cases-${lineage.attemptedCases}`,
    `weaknesses-${lineage.weaknessesExposed}`,
    `successes-${lineage.successes}`
  ];
  if (architectureId !== null && architectureId.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH) {
    arrayPush(keywords, architectureId);
  }
  return new StructuredMemoryEntry({
    architectureId,
    id: `${prefix}:adversarial-lineage:${index}`,
    taskId: `adversarial-lineage:${index}`,
    description: `Historical skeptic lineage ${weaknessStatus}`,
    strategyKey: 'adversarial-lineage',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE,
    keywords,
    provenance
  });
}

function adversarialLineageEnsembleMemoryEntry(ensemble, prefix, index, provenance = null) {
  const weaknessStatus = ensemble.weaknessesExposed > 0
    ? 'weakness-exposed'
    : 'no-weakness-exposed';
  const completenessStatus = ensemble.complete ? 'complete' : 'incomplete';
  const architectureId = ensemble.candidateId.length <= 128
    ? ensemble.candidateId
    : null;
  const keywords = [
    'adversarial-lineage-ensemble',
    'independent',
    'skeptic',
    weaknessStatus,
    completenessStatus,
    `lineages-${ensemble.lineageCount}`,
    `cases-${ensemble.evaluatedCases}`,
    `weaknesses-${ensemble.weaknessesExposed}`,
    `successes-${ensemble.successes}`
  ];
  if (architectureId !== null && architectureId.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH) {
    arrayPush(keywords, architectureId);
  }
  return new StructuredMemoryEntry({
    architectureId,
    id: `${prefix}:adversarial-lineage-ensemble:${index}`,
    taskId: `adversarial-lineage-ensemble:${index}`,
    description: `Historical skeptic lineage ensemble ${weaknessStatus}`,
    strategyKey: 'adversarial-lineage-ensemble',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.ADVERSARIAL_LINEAGE,
    keywords,
    provenance
  });
}

function distributionShiftMemoryEntry(shift, prefix, index, provenance = null) {
  const status = shift.robust ? 'robust' : 'weakness-exposed';
  const baselineStatus = shift.baselineSuccess ? 'baseline-success' : 'baseline-failed';
  const candidateId = shift.candidateId.length <= 128 ? shift.candidateId : null;
  const keywords = [
    'distribution-shift',
    status,
    baselineStatus,
    `shifts-${shift.shiftCount}`,
    `shift-successes-${shift.shiftSuccesses}`,
    `weaknesses-${shift.weaknessesExposed}`
  ];
  if (candidateId !== null && candidateId.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH) {
    arrayPush(keywords, candidateId);
  }
  return new StructuredMemoryEntry({
    architectureId: candidateId,
    id: `${prefix}:distribution-shift:${index}`,
    taskId: `distribution-shift:${index}`,
    description: `Historical distribution-shift ${status}`,
    strategyKey: 'distribution-shift',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.DISTRIBUTION_SHIFT,
    keywords,
    provenance
  });
}

export class StructuredMemoryEntry {
  constructor(options = {}) {
    requireDataObject(options, 'StructuredMemoryEntry options', MEMORY_ENTRY_KEYS);
    const {
      id,
      taskId,
      description,
      strategyKey,
      evidence,
      surpriseBand,
      surpriseNats,
      predictionError,
      actionNumber = null,
      source = MEMORY_SOURCES.CALLER,
      architectureId = null,
      keywords = [],
      provenance = null
    } = options;
    this.id = requireNonEmptyString(id, 'Memory entry id', 128);
    this.taskId = requireNonEmptyString(taskId, 'Memory entry taskId', 128);
    this.description = requireNonEmptyString(
      description,
      'Memory entry description',
      MAX_STRUCTURED_MEMORY_DESCRIPTION_LENGTH
    );
    this.strategyKey = requireNonEmptyString(strategyKey, 'Memory entry strategyKey', 128);
    if (!setHas(VALID_EVIDENCE, evidence)) {
      throw new TypeError('Memory entry evidence is invalid');
    }
    if (!setHas(VALID_SURPRISE_BANDS, surpriseBand)) {
      throw new TypeError('Memory entry surpriseBand is invalid');
    }
    if (!isFiniteNumber(surpriseNats) || surpriseNats < 0) {
      throw new TypeError('Memory entry surpriseNats must be a non-negative finite number');
    }
    if (typeof predictionError !== 'boolean') {
      throw new TypeError('Memory entry predictionError must be boolean');
    }
    if (
      actionNumber !== null
      && (!isSafeInteger(actionNumber) || actionNumber <= 0)
    ) {
      throw new TypeError('Memory entry actionNumber must be a positive integer or null');
    }
    if (!setHas(VALID_MEMORY_SOURCES, source)) {
      throw new TypeError('Memory entry source is invalid');
    }
    this.evidence = evidence;
    this.surpriseBand = surpriseBand;
    this.surpriseNats = surpriseNats;
    this.predictionError = predictionError;
    this.actionNumber = actionNumber;
    this.architectureId = architectureId === null
      ? null
      : requireNonEmptyString(architectureId, 'Memory entry architectureId', 128);
    this.source = source;
    this.keywords = normalizeKeywords(keywords);
    this.provenance = normalizeMemoryProvenance(provenance);
    this.dataOnly = true;
    this.historicalOnly = true;
    weakSetAdd(TRUSTED_MEMORY_ENTRIES, this);
    objectFreeze(this);
  }
}

export function isTrustedStructuredMemoryEntry(entry) {
  return typeof entry === 'object'
    && entry !== null
    && weakSetHas(TRUSTED_MEMORY_ENTRIES, entry)
    && isFrozenObject(entry)
    && objectGetPrototypeOf(entry) === StructuredMemoryEntry.prototype;
}

export class BoundedStructuredMemory {
  constructor(options = {}) {
    requireDataObject(options, 'BoundedStructuredMemory options', MEMORY_OPTIONS_KEYS);
    const {
      entries = [],
      maxEntries = MAX_STRUCTURED_MEMORY_ENTRIES
    } = options;
    if (
      !isSafeInteger(maxEntries)
      || maxEntries <= 0
      || maxEntries > MAX_STRUCTURED_MEMORY_ENTRIES
    ) {
      throw new RangeError(
        `BoundedStructuredMemory maxEntries must be a positive integer no greater than ${MAX_STRUCTURED_MEMORY_ENTRIES}`
      );
    }
    requireDenseDataArray(entries, 'BoundedStructuredMemory entries', maxEntries);
    const normalized = arrayMap(entries, normalizeMemoryEntry);
    const ids = [];
    arrayForEach(normalized, (entry) => {
      if (arrayIncludes(ids, entry.id)) {
        throw new TypeError(`BoundedStructuredMemory entry id is duplicated: ${entry.id}`);
      }
      arrayPush(ids, entry.id);
    });
    this.entries = objectFreeze(arraySlice(normalized));
    this.maxEntries = maxEntries;
    this.size = normalized.length;
    this.dataOnly = true;
    this.historicalOnly = true;
    weakSetAdd(TRUSTED_STRUCTURED_MEMORIES, this);
    objectFreeze(this);
  }

  add(entry) {
    if (!isTrustedBoundedStructuredMemory(this)) {
      throw new TypeError('Structured memory add requires an exact trusted memory');
    }
    const normalized = normalizeMemoryEntry(entry, this.entries.length);
    if (arrayFind(this.entries, (candidate) => candidate.id === normalized.id)) {
      throw new TypeError(`Structured memory entry id already exists: ${normalized.id}`);
    }
    if (this.entries.length >= this.maxEntries) {
      throw new RangeError('Structured memory capacity is exhausted');
    }
    const entries = arraySlice(this.entries);
    arrayPush(entries, normalized);
    return new BoundedStructuredMemory({
      entries,
      maxEntries: this.maxEntries
    });
  }

  rememberAgentRun(options = {}) {
    if (!isTrustedBoundedStructuredMemory(this)) {
      throw new TypeError('Structured memory restore requires an exact trusted memory');
    }
    requireDataObject(options, 'Structured memory agent-run options', ['runReport', 'idPrefix']);
    const {
      runReport,
      idPrefix = 'agent-run'
    } = options;
    if (!isTrustedAgentRunReport(runReport)) {
      throw new TypeError('Structured memory requires a trusted agent run report');
    }
    const prefix = requireNonEmptyString(idPrefix, 'Structured memory agent-run idPrefix', 64);
    if (runReport.cycles.length > this.maxEntries - this.entries.length) {
      throw new RangeError('Structured memory agent-run import exceeds remaining capacity');
    }
    const entries = arraySlice(this.entries);
    arrayForEach(runReport.cycles, (cycle) => {
      arrayPush(entries, cycleMemoryEntry(cycle, prefix));
    });
    return new BoundedStructuredMemory({
      entries,
      maxEntries: this.maxEntries
    });
  }

  rememberLedger(options = {}) {
    if (!isTrustedBoundedStructuredMemory(this)) {
      throw new TypeError('Structured memory ledger import requires an exact trusted memory');
    }
    requireDataObject(options, 'Structured memory ledger options', ['ledger', 'idPrefix']);
    const {
      ledger,
      idPrefix = 'evidence-ledger'
    } = options;
    if (!isTrustedEvidenceLedger(ledger)) {
      throw new TypeError('Structured memory requires a trusted evidence ledger');
    }
    const prefix = requireNonEmptyString(idPrefix, 'Structured memory ledger idPrefix', 64);
    const runs = ledger.restoreAgentRuns();
    const agentRunRecords = ledgerRecordsOfKind(ledger, 'agent-run');
    const discoveries = ledger.restoreArchitectureDiscoveries();
    const discoveryRecords = ledgerRecordsOfKind(ledger, 'architecture-discovery');
    const benchmarkCampaigns = ledger.restoreHarnessFactoryBenchmarkCampaigns();
    const benchmarkCampaignRecords = ledgerRecordsOfKind(
      ledger,
      'harness-factory-benchmark-campaign'
    );
    const benchmarkValidations = ledger.restoreHarnessFactoryBenchmarkValidations();
    const benchmarkValidationRecords = ledgerRecordsOfKind(
      ledger,
      'harness-factory-benchmark-validation'
    );
    const benchmarkFrontierValidationMemoryEntries = [];
    arrayForEach(benchmarkCampaigns, (campaign, campaignIndex) => {
      const relatedValidations = arrayFilter(
        benchmarkValidations,
        (validation) => validation.factoryId === campaign.factoryId
          && validation.campaignArchive.kind === campaign.archive.kind
          && validation.campaignArchive.sequence === campaign.archive.sequence
          && validation.campaignArchive.hash === campaign.archive.hash
      );
      if (relatedValidations.length === 0) {
        return;
      }
      const latestValidation = relatedValidations[relatedValidations.length - 1];
      const latestValidationRecord = arrayFind(
        benchmarkValidationRecords,
        (record) => record.kind === latestValidation.archive.kind
          && record.sequence === latestValidation.archive.sequence
          && record.hash === latestValidation.archive.hash
      );
      const entry = harnessFactoryBenchmarkFrontierValidationMemoryEntry(
        campaign,
        relatedValidations,
        prefix,
        campaignIndex,
        provenanceForLedgerRecord(latestValidationRecord)
      );
      if (entry !== null) {
        arrayPush(benchmarkFrontierValidationMemoryEntries, entry);
      }
    });
    const coordinations = ledger.restoreMemoryAwareCoordination();
    const coordinationRecords = ledgerRecordsOfKind(ledger, 'memory-aware-coordination');
    const sessions = ledger.restoreMemoryAwareSessions();
    const sessionRecords = ledgerRecordsOfKind(ledger, 'memory-aware-session');
    const ensembles = ledger.restoreMemoryAwareAgentEnsembles();
    const ensembleRecords = ledgerRecordsOfKind(ledger, 'memory-aware-ensemble');
    const adversarialLineages = ledger.restoreAdversarialLineages();
    const adversarialLineageRecords = ledgerRecordsOfKind(ledger, 'adversarial-lineage');
    const adversarialLineageEnsembles = ledger.restoreAdversarialLineageEnsembles();
    const adversarialLineageEnsembleRecords = ledgerRecordsOfKind(
      ledger,
      'adversarial-lineage-ensemble'
    );
    const distributionShifts = ledger.restoreDistributionShifts();
    const distributionShiftRecords = ledgerRecordsOfKind(ledger, 'distribution-shift');
    const coreResearchRecord = latestLedgerRecordOfKind(ledger, 'core');
    const researchQuestions = [];
    arrayForEach(ledger.restoreResearchQueue(), (question) => {
      arrayPush(researchQuestions, {
        question,
        provenance: provenanceForLedgerRecord(coreResearchRecord)
      });
    });
    arrayForEach(runs, (run, runIndex) => {
      const provenance = provenanceForLedgerRecord(agentRunRecords[runIndex]);
      arrayForEach(run.pendingResearch, (question) => {
        const duplicate = arrayFind(
          researchQuestions,
          (candidate) => sameResearchQuestion(candidate.question, question)
        );
        if (duplicate === undefined) {
          arrayPush(researchQuestions, { question, provenance });
        }
      });
    });
    const researchResults = [];
    arrayForEach(runs, (run, runIndex) => {
      const provenance = provenanceForLedgerRecord(agentRunRecords[runIndex]);
      arrayForEach(run.cycles, (cycle, cycleIndex) => {
        if (cycle.research !== null && cycle.research !== undefined) {
          arrayPush(researchResults, {
            cycle,
            prefix: `${prefix}:${runIndex}`,
            index: cycleIndex,
            provenance
          });
        }
      });
    });
    let cycleCount = 0;
    arrayForEach(runs, (run) => {
      cycleCount += run.cycles.length;
    });
    if (
      cycleCount
      + discoveries.length
      + benchmarkCampaigns.length
      + benchmarkValidations.length
      + benchmarkFrontierValidationMemoryEntries.length
      + coordinations.length
      + researchQuestions.length
      + researchResults.length
      + sessions.length
      + ensembles.length
      + adversarialLineages.length
      + adversarialLineageEnsembles.length
      + distributionShifts.length
      > this.maxEntries - this.entries.length
    ) {
      throw new RangeError('Structured memory ledger import exceeds remaining capacity');
    }
    const entries = arraySlice(this.entries);
    arrayForEach(runs, (run, runIndex) => {
      const provenance = provenanceForLedgerRecord(agentRunRecords[runIndex]);
      arrayForEach(run.cycles, (cycle) => {
        arrayPush(
          entries,
          cycleMemoryEntry(
            cycle,
            `${prefix}:${runIndex}`,
            MEMORY_SOURCES.LEDGER,
            run.architectureId,
            provenance
          )
        );
      });
    });
    arrayForEach(discoveries, (discovery, discoveryIndex) => {
      arrayPush(
        entries,
        architectureDiscoveryMemoryEntry(
          discovery,
          prefix,
          discoveryIndex,
          provenanceForLedgerRecord(discoveryRecords[discoveryIndex])
        )
      );
    });
    arrayForEach(benchmarkCampaigns, (campaign, campaignIndex) => {
      arrayPush(
        entries,
        harnessFactoryBenchmarkCampaignMemoryEntry(
          campaign,
          prefix,
          campaignIndex,
          provenanceForLedgerRecord(benchmarkCampaignRecords[campaignIndex])
        )
      );
    });
    arrayForEach(benchmarkValidations, (validation, validationIndex) => {
      arrayPush(
        entries,
        harnessFactoryBenchmarkValidationMemoryEntry(
          validation,
          prefix,
          validationIndex,
          provenanceForLedgerRecord(benchmarkValidationRecords[validationIndex])
        )
      );
    });
    arrayForEach(benchmarkFrontierValidationMemoryEntries, (entry) => {
      arrayPush(entries, entry);
    });
    arrayForEach(coordinations, (coordination, coordinationIndex) => {
      arrayPush(
        entries,
        memoryAwareCoordinationMemoryEntry(
          coordination,
          prefix,
          coordinationIndex,
          provenanceForLedgerRecord(coordinationRecords[coordinationIndex])
        )
      );
    });
    arrayForEach(researchQuestions, ({ question, provenance }, questionIndex) => {
      arrayPush(
        entries,
        researchQuestionMemoryEntry(
          question,
          prefix,
          questionIndex,
          provenance
        )
      );
    });
    arrayForEach(researchResults, ({ cycle, prefix: resultPrefix, index, provenance }) => {
      arrayPush(
        entries,
        researchResultMemoryEntry(
          cycle,
          resultPrefix,
          index,
          provenance
        )
      );
    });
    arrayForEach(sessions, (session, sessionIndex) => {
      arrayPush(
        entries,
        memoryAwareSessionMemoryEntry(
          session,
          prefix,
          sessionIndex,
          provenanceForLedgerRecord(sessionRecords[sessionIndex])
        )
      );
    });
    arrayForEach(ensembles, (ensemble, ensembleIndex) => {
      arrayPush(
        entries,
        memoryAwareEnsembleMemoryEntry(
          ensemble,
          prefix,
          ensembleIndex,
          provenanceForLedgerRecord(ensembleRecords[ensembleIndex])
        )
      );
    });
    arrayForEach(adversarialLineages, (lineage, lineageIndex) => {
      arrayPush(
        entries,
        adversarialLineageMemoryEntry(
          lineage,
          prefix,
          lineageIndex,
          provenanceForLedgerRecord(adversarialLineageRecords[lineageIndex])
        )
      );
    });
    arrayForEach(adversarialLineageEnsembles, (ensemble, ensembleIndex) => {
      arrayPush(
        entries,
        adversarialLineageEnsembleMemoryEntry(
          ensemble,
          prefix,
          ensembleIndex,
          provenanceForLedgerRecord(adversarialLineageEnsembleRecords[ensembleIndex])
        )
      );
    });
    arrayForEach(distributionShifts, (shift, shiftIndex) => {
      arrayPush(
        entries,
        distributionShiftMemoryEntry(
          shift,
          prefix,
          shiftIndex,
          provenanceForLedgerRecord(distributionShiftRecords[shiftIndex])
        )
      );
    });
    return new BoundedStructuredMemory({
      entries,
      maxEntries: this.maxEntries
    });
  }

  query(options = {}) {
    if (!isTrustedBoundedStructuredMemory(this)) {
      throw new TypeError('Structured memory query requires an exact trusted memory');
    }
    requireDataObject(options, 'Structured memory query', MEMORY_QUERY_KEYS);
    const keywords = normalizeKeywords(options.keywords ?? [], 'Structured memory query keywords');
    const taskId = options.taskId === undefined || options.taskId === null
      ? null
      : requireNonEmptyString(options.taskId, 'Structured memory query taskId', 128);
    const strategyKey = options.strategyKey === undefined || options.strategyKey === null
      ? null
      : requireNonEmptyString(options.strategyKey, 'Structured memory query strategyKey', 128);
    const source = options.source === undefined || options.source === null
      ? null
      : options.source;
    if (source !== null && !setHas(VALID_MEMORY_SOURCES, source)) {
      throw new TypeError('Structured memory query source is invalid');
    }
    const architectureId = options.architectureId === undefined || options.architectureId === null
      ? null
      : requireNonEmptyString(
        options.architectureId,
        'Structured memory query architectureId',
        128
      );
    const evidence = options.evidence === undefined || options.evidence === null
      ? null
      : options.evidence;
    if (evidence !== null && !setHas(VALID_EVIDENCE, evidence)) {
      throw new TypeError('Structured memory query evidence is invalid');
    }
    const surpriseBand = options.surpriseBand === undefined || options.surpriseBand === null
      ? null
      : options.surpriseBand;
    if (surpriseBand !== null && !setHas(VALID_SURPRISE_BANDS, surpriseBand)) {
      throw new TypeError('Structured memory query surpriseBand is invalid');
    }
    const minSurpriseNats = options.minSurpriseNats === undefined
      ? 0
      : options.minSurpriseNats;
    if (!isFiniteNumber(minSurpriseNats) || minSurpriseNats < 0) {
      throw new TypeError('Structured memory query minSurpriseNats must be non-negative');
    }
    const limit = options.limit === undefined
      ? minNumbers([8, this.maxEntries])
      : options.limit;
    if (
      !isSafeInteger(limit)
      || limit <= 0
      || limit > MAX_STRUCTURED_MEMORY_QUERY_RESULTS
    ) {
      throw new RangeError(
        `Structured memory query limit must be a positive integer no greater than ${MAX_STRUCTURED_MEMORY_QUERY_RESULTS}`
      );
    }

    const ranked = [];
    arrayForEach(this.entries, (entry) => {
      if (
        (taskId !== null && entry.taskId !== taskId)
        || (strategyKey !== null && entry.strategyKey !== strategyKey)
        || (source !== null && entry.source !== source)
        || (architectureId !== null && entry.architectureId !== architectureId)
        || (evidence !== null && entry.evidence !== evidence)
        || (surpriseBand !== null && entry.surpriseBand !== surpriseBand)
        || entry.surpriseNats < minSurpriseNats
      ) {
        return;
      }
      const matchedKeywords = arrayFilter(
        keywords,
        (keyword) => arrayIncludes(entry.keywords, keyword)
      );
      if (keywords.length > 0 && matchedKeywords.length === 0) {
        return;
      }
      arrayPush(ranked, {
        entry,
        matchedKeywords,
        score: keywords.length === 0 ? 0 : matchedKeywords.length / keywords.length
      });
    });
    arraySort(ranked, compareRetrieved);
    const selected = arraySlice(ranked, 0, limit);
    const results = arrayMap(selected, ({ entry, matchedKeywords, score }) => objectFreeze({
      id: entry.id,
      taskId: entry.taskId,
      description: entry.description,
      architectureId: entry.architectureId,
      strategyKey: entry.strategyKey,
      evidence: entry.evidence,
      surpriseBand: entry.surpriseBand,
      surpriseNats: entry.surpriseNats,
      predictionError: entry.predictionError,
      actionNumber: entry.actionNumber,
      source: entry.source,
      keywords: entry.keywords,
      provenance: entry.provenance,
      matchedKeywords: objectFreeze(arraySlice(matchedKeywords)),
      score,
      dataOnly: true,
      historicalOnly: true
    }));
    const retrieval = objectFreeze({
      query: objectFreeze({
        keywords,
        architectureId,
        taskId,
        strategyKey,
        source,
        evidence,
        surpriseBand,
        minSurpriseNats,
        limit
      }),
      results: objectFreeze(results),
      totalMatches: ranked.length,
      returnedCount: results.length,
      truncated: ranked.length > limit,
      dataOnly: true,
      historicalOnly: true
    });
    weakSetAdd(TRUSTED_MEMORY_RETRIEVALS, retrieval);
    return retrieval;
  }
}

export function isTrustedBoundedStructuredMemory(memory) {
  return typeof memory === 'object'
    && memory !== null
    && weakSetHas(TRUSTED_STRUCTURED_MEMORIES, memory)
    && isFrozenObject(memory)
    && objectGetPrototypeOf(memory) === BoundedStructuredMemory.prototype;
}

export function isTrustedStructuredMemoryRetrieval(retrieval) {
  return typeof retrieval === 'object'
    && retrieval !== null
    && weakSetHas(TRUSTED_MEMORY_RETRIEVALS, retrieval)
    && isFrozenObject(retrieval);
}

export class StructuredMemoryContext {
  constructor(options = {}) {
    requireDataObject(options, 'Structured memory context options', MEMORY_CONTEXT_KEYS);
    const { retrieval } = options;
    if (!isTrustedStructuredMemoryRetrieval(retrieval)) {
      throw new TypeError('Structured memory context requires a trusted retrieval');
    }
    this.source = STRUCTURED_MEMORY_CONTEXT_SOURCE;
    this.query = retrieval.query;
    this.results = retrieval.results;
    this.resultCount = retrieval.returnedCount;
    this.dataOnly = true;
    this.historicalOnly = true;
    this.authorityTransferred = false;
    weakSetAdd(TRUSTED_MEMORY_CONTEXTS, this);
    objectFreeze(this);
  }

  toPlannerData() {
    if (!isTrustedStructuredMemoryContext(this)) {
      throw new TypeError('Structured memory planner data requires an exact trusted context');
    }
    return objectFreeze({
      source: this.source,
      query: this.query,
      results: this.results,
      resultCount: this.resultCount,
      dataOnly: true,
      historicalOnly: true,
      authorityTransferred: false
    });
  }
}

export function isTrustedStructuredMemoryContext(context) {
  return typeof context === 'object'
    && context !== null
    && weakSetHas(TRUSTED_MEMORY_CONTEXTS, context)
    && isFrozenObject(context)
    && objectGetPrototypeOf(context) === StructuredMemoryContext.prototype;
}

export function buildStructuredMemoryContext(options = {}) {
  requireDataObject(options, 'Structured memory context factory options', MEMORY_CONTEXT_FACTORY_KEYS);
  const {
    memory,
    query = {}
  } = options;
  if (!isTrustedBoundedStructuredMemory(memory)) {
    throw new TypeError('Structured memory context requires a trusted memory');
  }
  const retrieval = memory.query(query);
  return new StructuredMemoryContext({ retrieval });
}

export function planWithStructuredMemory(options = {}) {
  requireDataObject(options, 'Structured memory planner options', MEMORY_PLANNER_KEYS);
  const {
    planner,
    goal,
    memoryContext,
    context = null
  } = options;
  if (!isTrustedAgentPlanner(planner)) {
    throw new TypeError('Structured memory planner handoff requires a trusted agent planner');
  }
  if (!isTrustedStructuredMemoryContext(memoryContext)) {
    throw new TypeError('Structured memory planner handoff requires a trusted memory context');
  }
  const safeContext = context === null
    ? {}
    : snapshotProcessData(context);
  if (!isPlainObject(safeContext)) {
    throw new TypeError('Structured memory planner context must be a plain data object or null');
  }
  return planner.plan({
    goal: requireNonEmptyString(goal, 'Structured memory planner goal', 256),
    context: {
      ...safeContext,
      memory: memoryContext.toPlannerData()
    }
  });
}

export function memoryFromAgentRun(options = {}) {
  requireDataObject(options, 'Structured memory factory options', [
    'runReport',
    'maxEntries',
    'idPrefix'
  ]);
  const {
    runReport,
    maxEntries = MAX_STRUCTURED_MEMORY_ENTRIES,
    idPrefix = 'agent-run'
  } = options;
  const memory = new BoundedStructuredMemory({ maxEntries });
  return memory.rememberAgentRun({ runReport, idPrefix });
}

export function memoryFromLedger(options = {}) {
  requireDataObject(options, 'Structured memory ledger factory options', [
    'ledger',
    'maxEntries',
    'idPrefix'
  ]);
  const {
    ledger,
    maxEntries = MAX_STRUCTURED_MEMORY_ENTRIES,
    idPrefix = 'evidence-ledger'
  } = options;
  const memory = new BoundedStructuredMemory({ maxEntries });
  return memory.rememberLedger({ ledger, idPrefix });
}

objectFreeze(StructuredMemoryEntry.prototype);
objectFreeze(BoundedStructuredMemory.prototype);
