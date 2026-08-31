import { createHash } from 'node:crypto';
import { EVIDENCE_LEVELS } from './evidence.mjs';
import {
  MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS
} from './harness-factory-limits.mjs';
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
  arraySome,
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
  HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY: 'HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY',
  HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION: 'HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION',
  HARNESS_FACTORY_IMPROVEMENT_REJECTION: 'HARNESS_FACTORY_IMPROVEMENT_REJECTION',
  HARNESS_FACTORY_ARCHITECTURE_COVERAGE: 'HARNESS_FACTORY_ARCHITECTURE_COVERAGE',
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL: 'HARNESS_FACTORY_ARCHITECTURE_PROPOSAL',
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION: 'HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION',
  HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME: 'HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME',
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
export const MAX_STRUCTURED_MEMORY_QUERY_SOURCES = 8;
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
  'sources',
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

function normalizeSources(value, field = 'Memory query sources') {
  requireDenseDataArray(value, field, MAX_STRUCTURED_MEMORY_QUERY_SOURCES);
  if (value.length === 0) {
    throw new TypeError(`${field} must contain at least one source`);
  }
  const normalized = [];
  arrayForEach(value, (source, index) => {
    const candidate = requireNonEmptyString(
      source,
      `${field} entry ${index}`,
      MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
    );
    if (!setHas(VALID_MEMORY_SOURCES, candidate)) {
      throw new TypeError(`${field} entry ${index} is invalid`);
    }
    if (arrayIncludes(normalized, candidate)) {
      throw new TypeError(`${field} entries must be unique`);
    }
    arrayPush(normalized, candidate);
  });
  arraySort(normalized, (left, right) => stringLocaleCompare(left, right));
  return objectFreeze(normalized);
}

function sourceCountsForQuery({ source, sources }, results) {
  const counts = [];
  const addSource = (candidate) => {
    if (
      candidate !== null
      && arrayFind(counts, ({ source: existing }) => existing === candidate) === undefined
    ) {
      arrayPush(counts, { source: candidate, count: 0 });
    }
  };
  if (sources !== null) {
    arrayForEach(sources, addSource);
  } else {
    addSource(source);
  }
  arrayForEach(results, ({ source: resultSource }) => {
    const existing = arrayFind(
      counts,
      ({ source: candidate }) => candidate === resultSource
    );
    if (existing === undefined) {
      arrayPush(counts, { source: resultSource, count: 1 });
    } else {
      existing.count += 1;
    }
  });
  arraySort(counts, (left, right) => stringLocaleCompare(left.source, right.source));
  const summary = {};
  arrayForEach(counts, ({ source: resultSource, count }) => {
    summary[resultSource] = count;
  });
  return objectFreeze(summary);
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

function harnessFactoryBenchmarkFrontierValidationIdentity(campaign) {
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

function harnessFactoryBenchmarkFrontierValidationCampaignScore(campaign, validations) {
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
        'Structured memory found inconsistent Harness Factory frontier stability evidence'
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
  const points = arrayMap(campaign.frontier, (frontierPoint) => {
    const pointScore = arrayFind(
      pointScores,
      (candidatePoint) => candidatePoint.candidateId === frontierPoint.architectureId
        && candidatePoint.levelId === frontierPoint.levelId
    );
    const latest = pointScore?.latest ?? null;
    return {
      candidateId: frontierPoint.architectureId,
      levelId: frontierPoint.levelId,
      validationCount: pointScore?.validationCount ?? 0,
      status: latest === null
        ? 'incomplete'
        : latest.passed === true
            && latest.complete === true
            && latest.reproducible === true
            && latest.independent === true
          ? 'passed'
          : 'failed',
      complete: latest?.complete === true,
      reproducible: latest?.reproducible === true,
      independent: latest?.independent === true
    };
  });
  return {
    frontierFingerprint: harnessFactoryBenchmarkFrontierValidationIdentity(campaign),
    frontierCount,
    validationCount: campaignValidations.length,
    passed: status === 'passed',
    complete,
    reproducible,
    independent,
    status,
    points,
    latestValidation: campaignValidations[campaignValidations.length - 1]
  };
}

function harnessFactoryBenchmarkFrontierValidationStabilityMemoryEntries(
  campaigns,
  validations,
  validationRecords,
  prefix
) {
  const groups = [];
  arrayForEach(campaigns, (campaign) => {
    const campaignScore = harnessFactoryBenchmarkFrontierValidationCampaignScore(
      campaign,
      validations
    );
    if (campaignScore === null) {
      return;
    }
    const groupKey = `${campaign.factoryId}\u0000${campaignScore.frontierFingerprint}`;
    let group = arrayFind(
      groups,
      (candidateGroup) => candidateGroup.groupKey === groupKey
    );
    if (group === undefined) {
      group = {
        factoryId: campaign.factoryId,
        frontierFingerprint: campaignScore.frontierFingerprint,
        frontierCount: campaignScore.frontierCount,
        validationCount: 0,
        campaignCount: 0,
        passedCount: 0,
        failedCount: 0,
        incompleteCount: 0,
        completeCount: 0,
        reproducibleCount: 0,
        independentCount: 0,
        latestValidation: null,
        groupKey,
        statuses: [],
        pointGroups: []
      };
      arrayPush(groups, group);
    }
    if (group.frontierCount !== campaignScore.frontierCount) {
      throw new Error(
        'Structured memory found inconsistent Harness Factory frontier stability identities'
      );
    }
    group.validationCount += campaignScore.validationCount;
    group.campaignCount += 1;
    if (campaignScore.status === 'passed') {
      group.passedCount += 1;
    } else if (campaignScore.status === 'failed') {
      group.failedCount += 1;
    } else {
      group.incompleteCount += 1;
    }
    if (campaignScore.complete) {
      group.completeCount += 1;
    }
    if (campaignScore.reproducible) {
      group.reproducibleCount += 1;
    }
    if (campaignScore.independent) {
      group.independentCount += 1;
    }
    arrayPush(group.statuses, campaignScore.status);
    arrayForEach(campaignScore.points, (point) => {
      let pointGroup = arrayFind(
        group.pointGroups,
        (candidatePoint) => candidatePoint.candidateId === point.candidateId
          && candidatePoint.levelId === point.levelId
      );
      if (pointGroup === undefined) {
        pointGroup = {
          candidateId: point.candidateId,
          levelId: point.levelId,
          campaignCount: 0,
          validationCount: 0,
          variableCount: 0
        };
        arrayPush(group.pointGroups, pointGroup);
      }
      pointGroup.campaignCount += 1;
      pointGroup.validationCount += point.validationCount;
      if (point.status !== 'passed'
        || point.complete !== true
        || point.reproducible !== true
        || point.independent !== true
      ) {
        pointGroup.variableCount += 1;
      }
    });
    if (
      group.latestValidation === null
      || campaignScore.latestValidation.archive.sequence
        > group.latestValidation.archive.sequence
    ) {
      group.latestValidation = campaignScore.latestValidation;
    }
  });
  const repeatedGroups = arrayFilter(groups, ({ campaignCount }) => campaignCount >= 2);
  return arrayMap(repeatedGroups, (group, index) => {
    const stable = group.passedCount === group.campaignCount
      && group.completeCount === group.campaignCount
      && group.reproducibleCount === group.campaignCount
      && group.independentCount === group.campaignCount;
    const stability = stable ? 'stable' : 'unstable';
    const variablePointCount = arrayFilter(
      group.pointGroups,
      ({ variableCount }) => variableCount > 0
    ).length;
    const variablePointKeywords = arrayMap(
      arraySort(
        arrayFilter(
          group.pointGroups,
          ({ variableCount }) => variableCount > 0
        ),
        (left, right) => stringLocaleCompare(
          `${left.candidateId}\u0000${left.levelId}`,
          `${right.candidateId}\u0000${right.levelId}`
        )
      ),
      ({ candidateId, levelId }) => `variable-point-${candidateId}-${levelId}`
    );
    const keywords = [
      'harness-factory-benchmark-frontier-validation-stability',
      `frontier-stability-${stability}`,
      `frontier-campaigns-${group.campaignCount}`,
      `frontier-${group.frontierCount}`,
      `frontier-validations-${group.validationCount}`,
      `frontier-passed-${group.passedCount}`,
      `frontier-failed-${group.failedCount}`,
      `frontier-incomplete-${group.incompleteCount}`,
      `complete-${group.completeCount}-of-${group.campaignCount}`,
      `reproducible-${group.reproducibleCount}-of-${group.campaignCount}`,
      `independent-${group.independentCount}-of-${group.campaignCount}`,
      `variable-points-${variablePointCount}`
    ];
    arrayForEach(variablePointKeywords, (keyword) => {
      if (
        keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
        && keyword.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
      ) {
        arrayPush(keywords, keyword);
      }
    });
    const factoryKeyword = `factory-${group.factoryId}`;
    if (
      keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
      && factoryKeyword.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
    ) {
      arrayPush(keywords, factoryKeyword);
    }
    const latestRecord = arrayFind(
      validationRecords,
      (record) => record.kind === group.latestValidation.archive.kind
        && record.sequence === group.latestValidation.archive.sequence
        && record.hash === group.latestValidation.archive.hash
    );
    return new StructuredMemoryEntry({
      id: `${prefix}:harness-factory-benchmark-frontier-validation-stability:${index}`,
      taskId: isSafeInteger(latestRecord?.sequence) && latestRecord.sequence > 0
        ? `harness-factory-benchmark-frontier-validation-stability:${latestRecord.sequence}`
        : `harness-factory-benchmark-frontier-validation-stability:${index}`,
      description: `Historical Harness Factory frontier validation stability ${stability} across ${group.campaignCount} campaigns`,
      strategyKey: 'harness-factory-benchmark-frontier-validation-stability',
      evidence: EVIDENCE_LEVELS.OBSERVED,
      surpriseBand: SURPRISE_BANDS.LOW,
      surpriseNats: 0,
      predictionError: false,
      actionNumber: null,
      source: MEMORY_SOURCES.HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY,
      keywords,
      provenance: provenanceForLedgerRecord(latestRecord)
    });
  });
}

function harnessFactoryResearchPlanExecutionMemoryEntry(
  execution,
  prefix,
  index,
  provenance = null
) {
  const resolutionStatus = execution.targetResolved ? 'resolved' : 'unresolved';
  const resultKind = execution.resultType === 'HARNESS_FACTORY_REPORT'
    ? 'factory'
    : execution.resultType === 'HARNESS_FACTORY_VALIDATION'
      ? 'validation'
      : execution.resultType === 'HARNESS_FACTORY_BENCHMARK_VALIDATION'
        ? 'benchmark-validation'
        : execution.resultType
          === 'HARNESS_FACTORY_BENCHMARK_FRONTIER_VALIDATION_STABILITY_RESEARCH'
          ? 'frontier-stability'
          : 'frontier-validation';
  const keywords = [
    'harness-factory-research-plan-execution',
    `target-${execution.target}`,
    `bridge-${execution.bridge}`,
    `result-${resultKind}`,
    `status-${execution.resultStatus}`,
    resolutionStatus,
    `archives-${execution.resultArchiveSequences.length}`
  ];
  const factoryKeyword = `factory-${execution.factoryId}`;
  if (
    factoryKeyword.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
  ) {
    arrayPush(keywords, factoryKeyword);
  }
  return new StructuredMemoryEntry({
    id: `${prefix}:harness-factory-research-plan-execution:${index}`,
    taskId: isSafeInteger(provenance?.sequence) && provenance.sequence > 0
      ? `harness-factory-research-plan-execution:${provenance.sequence}`
      : `harness-factory-research-plan-execution:${index}`,
    description: `Historical Harness Factory research plan execution ${execution.resultStatus} for ${execution.target}`,
    strategyKey: 'harness-factory-research-plan-execution',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.HARNESS_FACTORY_RESEARCH_PLAN_EXECUTION,
    keywords,
    provenance
  });
}

function harnessFactoryImprovementRejectionMemoryEntry(
  rejection,
  prefix,
  index,
  provenance = null
) {
  const keywords = [
    'harness-factory-improvement-rejection',
    'improvement-rejected'
  ];
  const addKeyword = (keyword) => {
    if (
      typeof keyword === 'string'
      && keyword.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
      && keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
      && !arrayIncludes(keywords, keyword)
    ) {
      arrayPush(keywords, keyword);
    }
  };
  if (!rejection.improvement.strictlyImproved) {
    addKeyword('strict-improvement-failed');
  }
  if (!rejection.improvement.nonRegressing) {
    addKeyword('regression-detected');
  }
  if (!rejection.improvement.benchmarkStable) {
    addKeyword('benchmark-drift');
  }
  addKeyword(`generation-${rejection.attemptedGeneration}`);
  addKeyword(`factory-${rejection.factoryId}`);
  addKeyword(rejection.candidate.architectureId);
  return new StructuredMemoryEntry({
    architectureId: rejection.candidate.architectureId.length <= 128
      ? rejection.candidate.architectureId
      : null,
    id: `${prefix}:harness-factory-improvement-rejection:${index}`,
    taskId: isSafeInteger(provenance?.sequence) && provenance.sequence > 0
      ? `harness-factory-improvement-rejection:${provenance.sequence}`
      : `harness-factory-improvement-rejection:${index}`,
    description: 'Historical Harness Factory improvement rejected by safety guards',
    strategyKey: 'harness-factory-improvement-rejection',
    evidence: EVIDENCE_LEVELS.OBSERVED,
    surpriseBand: SURPRISE_BANDS.LOW,
    surpriseNats: 0,
    predictionError: false,
    actionNumber: null,
    source: MEMORY_SOURCES.HARNESS_FACTORY_IMPROVEMENT_REJECTION,
    keywords,
    provenance
  });
}

function harnessFactoryArchitectureProposalMemoryEntries(
  batch,
  prefix,
  batchIndex,
  provenance = null
) {
  return arrayMap(batch.proposals, (proposal, proposalIndex) => {
    const status = proposal.novel ? 'novel' : 'repeated';
    const keywords = [
      'harness-factory-architecture-proposal',
      'proposal-untested',
      `proposal-${status}`,
      `historical-matches-${proposal.historicalMatchCount}`,
      `batch-${batchIndex + 1}`
    ];
    const addKeyword = (keyword) => {
      if (
        typeof keyword === 'string'
        && keyword.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
        && keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
        && !arrayIncludes(keywords, keyword)
      ) {
        arrayPush(keywords, keyword);
      }
    };
    addKeyword(`factory-${batch.factoryId}`);
    addKeyword(proposal.id);
    addKeyword(proposal.plannerCandidateId);
    return new StructuredMemoryEntry({
      architectureId: proposal.id.length <= 128 ? proposal.id : null,
      id: `${prefix}:harness-factory-architecture-proposal:${batchIndex}:${proposalIndex}`,
      taskId: isSafeInteger(provenance?.sequence) && provenance.sequence > 0
        ? `harness-factory-architecture-proposal:${provenance.sequence}:${proposalIndex}`
        : `harness-factory-architecture-proposal:${batchIndex}:${proposalIndex}`,
      description: `Historical Harness Factory architecture proposal ${status}`,
      strategyKey: 'harness-factory-architecture-proposal',
      evidence: EVIDENCE_LEVELS.OBSERVED,
      surpriseBand: SURPRISE_BANDS.LOW,
      surpriseNats: 0,
      predictionError: false,
      actionNumber: null,
      source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL,
      keywords,
      provenance
    });
  });
}

function harnessFactoryArchitectureProposalConversionMemoryEntries(ledger, prefix) {
  const proposalBatches = ledger.restoreHarnessFactoryArchitectureProposals();
  const proposalRecords = ledgerRecordsOfKind(
    ledger,
    'harness-factory-architecture-proposals'
  );
  const discoveries = ledger.restoreArchitectureDiscoveries();
  const discoveryRecords = ledgerRecordsOfKind(
    ledger,
    'architecture-discovery'
  );
  const improvementRejections = ledger.restoreHarnessFactoryImprovementRejections();
  const groups = [];
  const findGroup = (factoryId) => {
    let group = arrayFind(
      groups,
      (candidate) => candidate.factoryId === factoryId
    );
    if (group === undefined) {
      group = {
        archived: [],
        attempts: [],
        batchCount: 0,
        exhaustedBatchCount: 0,
        factoryId,
        latestRecord: null,
        proposalCount: 0,
        replayedBatchCount: 0,
        replays: [],
        untestedBatchCount: 0
      };
      arrayPush(groups, group);
    }
    return group;
  };
  arrayForEach(discoveries, (discovery, index) => {
    const record = discoveryRecords[index];
    const factoryId = discovery.factory?.factoryId ?? null;
    if (factoryId === null) {
      return;
    }
    if (record === undefined) {
      throw new Error(
        'Structured memory proposal conversion discovery order is inconsistent'
      );
    }
    const group = findGroup(factoryId);
    const evaluatedFingerprints = [];
    arrayForEach(discovery.candidates ?? [], (candidate) => {
      const fingerprint = candidate?.architectureFingerprint ?? null;
      if (
        typeof fingerprint === 'string'
        && !arrayIncludes(evaluatedFingerprints, fingerprint)
      ) {
        arrayPush(evaluatedFingerprints, fingerprint);
        arrayPush(group.attempts, { fingerprint, sequence: record.sequence });
      }
    });
    if (
      typeof discovery.winnerArchitectureFingerprint === 'string'
      && !arrayIncludes(evaluatedFingerprints, discovery.winnerArchitectureFingerprint)
    ) {
      arrayPush(group.attempts, {
        fingerprint: discovery.winnerArchitectureFingerprint,
        sequence: record.sequence
      });
    }
    const replayArchive = discovery.factory?.proposalArchive ?? null;
    if (replayArchive !== null) {
      arrayPush(group.replays, {
        hash: replayArchive.hash,
        sequence: replayArchive.sequence
      });
    }
  });
  arrayForEach(improvementRejections, (rejection) => {
    const fingerprint = rejection.candidate?.architectureFingerprint;
    const sequence = rejection.archive?.sequence ?? null;
    if (
      typeof fingerprint !== 'string'
      || !isSafeInteger(sequence)
    ) {
      return;
    }
    arrayPush(findGroup(rejection.factoryId).attempts, {
      fingerprint,
      sequence
    });
  });
  arrayForEach(proposalBatches, (batch, batchIndex) => {
    const record = proposalRecords[batchIndex];
    if (
      record === undefined
      || record.sequence !== batch.archive.sequence
      || record.hash !== batch.archive.hash
    ) {
      throw new Error(
        'Structured memory proposal conversion batch order is inconsistent'
      );
    }
    const group = findGroup(batch.factoryId);
    group.batchCount += 1;
    group.proposalCount += batch.proposalCount;
    if (group.latestRecord === null || record.sequence > group.latestRecord.sequence) {
      group.latestRecord = record;
    }
    const distinct = [];
    arrayForEach(batch.proposals, (proposal) => {
      const fingerprint = proposal.architectureFingerprint;
      if (typeof fingerprint !== 'string' || arrayIncludes(distinct, fingerprint)) {
        return;
      }
      arrayPush(distinct, fingerprint);
      const existing = arrayFind(
        group.archived,
        (entry) => entry.fingerprint === fingerprint
      );
      if (existing === undefined) {
        arrayPush(group.archived, {
          firstArchiveSequence: batch.archive.sequence,
          fingerprint
        });
      } else if (batch.archive.sequence < existing.firstArchiveSequence) {
        existing.firstArchiveSequence = batch.archive.sequence;
      }
    });
    const replayCount = arrayFilter(
      group.replays,
      (locator) => locator.sequence === batch.archive.sequence
        && locator.hash === batch.archive.hash
    ).length;
    const replayed = replayCount > 0;
    const converted = arrayFilter(
      distinct,
      (fingerprint) => arraySome(
        group.attempts,
        (attempt) => attempt.fingerprint === fingerprint
          && attempt.sequence > batch.archive.sequence
      )
    ).length;
    if (replayed) {
      group.replayedBatchCount += 1;
    }
    if (
      replayCount >= MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS
      && converted < distinct.length
    ) {
      group.exhaustedBatchCount += 1;
    }
    if (replayed === false && converted === 0) {
      group.untestedBatchCount += 1;
    }
  });
  const archivedGroups = arrayFilter(
    groups,
    (group) => group.batchCount > 0 && group.latestRecord !== null
  );
  return arrayMap(archivedGroups, (group, index) => {
    const convertedArchitectures = arrayFilter(
      group.archived,
      (entry) => arraySome(
        group.attempts,
        (attempt) => attempt.fingerprint === entry.fingerprint
          && attempt.sequence > entry.firstArchiveSequence
      )
    ).length;
    const keywords = [
      'harness-factory-proposal-conversion',
      `archived-batches-${group.batchCount}`,
      `archived-proposals-${group.proposalCount}`,
      `archived-architectures-${group.archived.length}`,
      `converted-architectures-${convertedArchitectures}`,
      `untested-architectures-${group.archived.length - convertedArchitectures}`,
      `replayed-batches-${group.replayedBatchCount}`,
      `exhausted-batches-${group.exhaustedBatchCount}`,
      `replay-attempt-limit-${MAX_HARNESS_FACTORY_ARCHIVED_PROPOSAL_REPLAY_ATTEMPTS}`,
      `untested-batches-${group.untestedBatchCount}`
    ];
    const addKeyword = (keyword) => {
      if (
        typeof keyword === 'string'
        && keyword.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
        && keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
        && !arrayIncludes(keywords, keyword)
      ) {
        arrayPush(keywords, keyword);
      }
    };
    addKeyword(`factory-${group.factoryId}`);
    return new StructuredMemoryEntry({
      id: `${prefix}:harness-factory-proposal-conversion:${index}`,
      taskId: isSafeInteger(group.latestRecord?.sequence)
        ? `harness-factory-proposal-conversion:${group.latestRecord.sequence}`
        : `harness-factory-proposal-conversion:${index}`,
      description: `Historical Harness Factory proposal conversion across ${group.batchCount} archived batches`,
      strategyKey: 'harness-factory-proposal-conversion',
      evidence: EVIDENCE_LEVELS.OBSERVED,
      surpriseBand: SURPRISE_BANDS.LOW,
      surpriseNats: 0,
      predictionError: false,
      actionNumber: null,
      source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_CONVERSION,
      keywords,
      provenance: provenanceForLedgerRecord(group.latestRecord)
    });
  });
}

function harnessFactoryArchitectureProposalReplayOutcomeMemoryEntries(ledger, prefix) {
  const proposalBatches = ledger.restoreHarnessFactoryArchitectureProposals();
  const proposalRecords = ledgerRecordsOfKind(
    ledger,
    'harness-factory-architecture-proposals'
  );
  const discoveries = ledger.restoreArchitectureDiscoveries();
  const discoveryRecords = ledgerRecordsOfKind(ledger, 'architecture-discovery');
  const improvementRejections = ledger.restoreHarnessFactoryImprovementRejections();
  const groups = [];
  const findGroup = (factoryId) => {
    let group = arrayFind(
      groups,
      (candidate) => candidate.factoryId === factoryId
    );
    if (group === undefined) {
      group = {
        adoptedReplayCount: 0,
        attributedReplayCount: 0,
        batchCount: 0,
        downstreamGainCount: 0,
        downstreamImprovementCount: 0,
        factoryId,
        latestRecord: null,
        pendingValidationReplayCount: 0,
        replayedBatchCount: 0,
        replays: [],
        rejectedReplayCount: 0,
        validatedReplayCount: 0
      };
      arrayPush(groups, group);
    }
    return group;
  };
  const rememberRecord = (group, record) => {
    if (
      record !== undefined
      && (group.latestRecord === null || record.sequence > group.latestRecord.sequence)
    ) {
      group.latestRecord = record;
    }
  };
  const sameBatchLocator = (replay, batchArchive) =>
    replay.batchSequence === batchArchive.sequence
      && replay.batchHash === batchArchive.hash;
  arrayForEach(discoveries, (discovery, index) => {
    const factoryId = discovery.factory?.factoryId ?? null;
    const proposalArchive = discovery.factory?.proposalArchive ?? null;
    if (factoryId === null || proposalArchive === null) {
      return;
    }
    const record = discoveryRecords[index];
    if (record === undefined) {
      throw new Error(
        'Structured memory proposal replay outcome discovery order is inconsistent'
      );
    }
    const group = findGroup(factoryId);
    const holdout = discovery.factory?.holdout ?? null;
    arrayPush(group.replays, {
      adopted: discovery.factory?.status === 'ADOPTED',
      batchHash: proposalArchive.hash,
      batchSequence: proposalArchive.sequence,
      holdoutPassed: holdout !== null && holdout.passed === true,
      holdoutRun: holdout !== null,
      sequence: record.sequence,
      winnerArchitectureFingerprint: discovery.winnerArchitectureFingerprint ?? null
    });
    rememberRecord(group, record);
  });
  arrayForEach(proposalBatches, (batch, batchIndex) => {
    const record = proposalRecords[batchIndex];
    if (
      record === undefined
      || record.sequence !== batch.archive.sequence
      || record.hash !== batch.archive.hash
    ) {
      throw new Error(
        'Structured memory proposal replay outcome batch order is inconsistent'
      );
    }
    const group = findGroup(batch.factoryId);
    group.batchCount += 1;
    rememberRecord(group, record);
    const fingerprints = [];
    arrayForEach(batch.proposals, (proposal) => {
      const fingerprint = proposal.architectureFingerprint;
      if (typeof fingerprint === 'string' && !arrayIncludes(fingerprints, fingerprint)) {
        arrayPush(fingerprints, fingerprint);
      }
    });
    const replays = arrayFilter(
      group.replays,
      (replay) => sameBatchLocator(replay, batch.archive)
    );
    if (replays.length === 0) {
      return;
    }
    group.replayedBatchCount += 1;
    arrayForEach(replays, (replay) => {
      if (!replay.adopted) {
        group.rejectedReplayCount += 1;
        return;
      }
      group.adoptedReplayCount += 1;
      if (
        typeof replay.winnerArchitectureFingerprint === 'string'
        && arrayIncludes(fingerprints, replay.winnerArchitectureFingerprint)
      ) {
        group.attributedReplayCount += 1;
      }
      if (replay.holdoutRun && replay.holdoutPassed) {
        group.validatedReplayCount += 1;
      } else {
        group.pendingValidationReplayCount += 1;
      }
    });
  });
  arrayForEach(discoveries, (discovery) => {
    const factoryId = discovery.factory?.factoryId ?? null;
    const improvement = discovery.factory?.improvement ?? null;
    if (factoryId === null || improvement === null) {
      return;
    }
    const group = findGroup(factoryId);
    const replay = arrayFind(
      group.replays,
      (candidate) => candidate.sequence === improvement.baselineSequence
    );
    if (replay === undefined) {
      return;
    }
    group.downstreamImprovementCount += 1;
    if (improvement.accepted === true) {
      group.downstreamGainCount += 1;
    }
  });
  arrayForEach(improvementRejections, (rejection) => {
    const group = arrayFind(
      groups,
      (candidate) => candidate.factoryId === rejection.factoryId
    );
    if (group === undefined) {
      return;
    }
    const baselineSequence = rejection.baseline?.archive?.sequence ?? null;
    const replay = arrayFind(
      group.replays,
      (candidate) => candidate.sequence === baselineSequence
    );
    if (replay !== undefined) {
      group.downstreamImprovementCount += 1;
    }
  });
  const replayGroups = arrayFilter(
    groups,
    (group) => group.replayedBatchCount > 0 && group.latestRecord !== null
  );
  return arrayMap(replayGroups, (group, index) => {
    const keywords = [
      'harness-factory-proposal-replay-outcome',
      `archived-batches-${group.batchCount}`,
      `replayed-batches-${group.replayedBatchCount}`,
      `unreplayed-batches-${group.batchCount - group.replayedBatchCount}`,
      `replay-attempts-${group.replays.length}`,
      `adopted-replays-${group.adoptedReplayCount}`,
      `rejected-replays-${group.rejectedReplayCount}`,
      `attributed-replays-${group.attributedReplayCount}`,
      `validated-replays-${group.validatedReplayCount}`,
      `pending-validation-replays-${group.pendingValidationReplayCount}`,
      `downstream-improvements-${group.downstreamImprovementCount}`,
      `downstream-gains-${group.downstreamGainCount}`
    ];
    const addKeyword = (keyword) => {
      if (
        typeof keyword === 'string'
        && keyword.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
        && keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
        && !arrayIncludes(keywords, keyword)
      ) {
        arrayPush(keywords, keyword);
      }
    };
    addKeyword(`factory-${group.factoryId}`);
    return new StructuredMemoryEntry({
      id: `${prefix}:harness-factory-proposal-replay-outcome:${index}`,
      taskId: isSafeInteger(group.latestRecord?.sequence)
        ? `harness-factory-proposal-replay-outcome:${group.latestRecord.sequence}`
        : `harness-factory-proposal-replay-outcome:${index}`,
      description: `Historical Harness Factory proposal replay outcomes across ${group.replayedBatchCount} replayed batches`,
      strategyKey: 'harness-factory-proposal-replay-outcome',
      evidence: EVIDENCE_LEVELS.OBSERVED,
      surpriseBand: SURPRISE_BANDS.LOW,
      surpriseNats: 0,
      predictionError: false,
      actionNumber: null,
      source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_PROPOSAL_REPLAY_OUTCOME,
      keywords,
      provenance: provenanceForLedgerRecord(group.latestRecord)
    });
  });
}

function harnessFactoryArchitectureCoverageMemoryEntries(ledger, prefix) {
  const discoveries = ledger.restoreArchitectureDiscoveries();
  const discoveryRecords = ledgerRecordsOfKind(ledger, 'architecture-discovery');
  const improvementRejections = ledger.restoreHarnessFactoryImprovementRejections();
  const improvementRejectionRecords = ledgerRecordsOfKind(
    ledger,
    'harness-factory-improvement-rejection'
  );
  const groups = [];
  let discoveryIndex = 0;
  let rejectionIndex = 0;
  arrayForEach(ledger.records, (record) => {
    let factoryId = null;
    let architectureFingerprint = null;
    let outcome = null;
    let source = null;
    if (record.kind === 'architecture-discovery') {
      const discovery = discoveries[discoveryIndex];
      const discoveryRecord = discoveryRecords[discoveryIndex];
      discoveryIndex += 1;
      if (
        discovery === undefined
        || discoveryRecord?.sequence !== record.sequence
      ) {
        throw new Error('Structured memory architecture coverage discovery order is inconsistent');
      }
      factoryId = discovery.factory?.factoryId ?? null;
      architectureFingerprint = discovery.winnerArchitectureFingerprint ?? null;
      outcome = discovery.factory?.status ?? null;
      source = 'GENERATION';
    } else if (record.kind === 'harness-factory-improvement-rejection') {
      const rejection = improvementRejections[rejectionIndex];
      const rejectionRecord = improvementRejectionRecords[rejectionIndex];
      rejectionIndex += 1;
      if (
        rejection === undefined
        || rejectionRecord?.sequence !== record.sequence
      ) {
        throw new Error('Structured memory architecture coverage rejection order is inconsistent');
      }
      factoryId = rejection.factoryId;
      architectureFingerprint = rejection.candidate.architectureFingerprint;
      outcome = 'REJECTED';
      source = 'IMPROVEMENT_REJECTION';
    }
    if (factoryId === null) {
      return;
    }
    let group = arrayFind(groups, (candidate) => candidate.factoryId === factoryId);
    if (group === undefined) {
      group = {
        factoryId,
        adoptedAttemptCount: 0,
        rejectedAttemptCount: 0,
        novelAttemptCount: 0,
        repeatedAttemptCount: 0,
        unknownArchitectureCount: 0,
        fingerprints: [],
        latestRecord: record,
        sources: []
      };
      arrayPush(groups, group);
    }
    if (record.sequence > group.latestRecord.sequence) {
      group.latestRecord = record;
    }
    if (outcome === 'ADOPTED') {
      group.adoptedAttemptCount += 1;
    } else if (outcome === 'REJECTED') {
      group.rejectedAttemptCount += 1;
    }
    if (source !== null && !arrayIncludes(group.sources, source)) {
      arrayPush(group.sources, source);
    }
    if (architectureFingerprint === null) {
      group.unknownArchitectureCount += 1;
    } else if (arrayIncludes(group.fingerprints, architectureFingerprint)) {
      group.repeatedAttemptCount += 1;
    } else {
      group.novelAttemptCount += 1;
      arrayPush(group.fingerprints, architectureFingerprint);
    }
  });
  return arrayMap(groups, (group, index) => {
    const attemptCount = group.adoptedAttemptCount + group.rejectedAttemptCount;
    const keywords = [
      'harness-factory-architecture-coverage',
      `attempts-${attemptCount}`,
      `unique-architectures-${group.fingerprints.length}`,
      `novel-attempts-${group.novelAttemptCount}`,
      `repeated-attempts-${group.repeatedAttemptCount}`,
      `unknown-fingerprint-attempts-${group.unknownArchitectureCount}`,
      `adopted-attempts-${group.adoptedAttemptCount}`,
      `rejected-attempts-${group.rejectedAttemptCount}`
    ];
    arrayForEach(group.sources, (source) => {
      if (
        keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
        && source.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
      ) {
        arrayPush(keywords, `source-${stringToLowerCase(source)}`);
      }
    });
    const factoryKeyword = `factory-${group.factoryId}`;
    if (
      keywords.length < MAX_STRUCTURED_MEMORY_KEYWORDS
      && factoryKeyword.length <= MAX_STRUCTURED_MEMORY_KEYWORD_LENGTH
    ) {
      arrayPush(keywords, factoryKeyword);
    }
    return new StructuredMemoryEntry({
      id: `${prefix}:harness-factory-architecture-coverage:${index}`,
      taskId: `harness-factory-architecture-coverage:${group.latestRecord.sequence}`,
      description: `Historical Harness Factory architecture coverage across ${attemptCount} attempts`,
      strategyKey: 'harness-factory-architecture-coverage',
      evidence: EVIDENCE_LEVELS.OBSERVED,
      surpriseBand: SURPRISE_BANDS.LOW,
      surpriseNats: 0,
      predictionError: false,
      actionNumber: null,
      source: MEMORY_SOURCES.HARNESS_FACTORY_ARCHITECTURE_COVERAGE,
      keywords,
      provenance: provenanceForLedgerRecord(group.latestRecord)
    });
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
    const researchPlanExecutions = ledger.restoreHarnessFactoryResearchPlanExecutions();
    const researchPlanExecutionRecords = ledgerRecordsOfKind(
      ledger,
      'harness-factory-research-plan-execution'
    );
    const researchPlanExecutionMemoryEntries = arrayMap(
      researchPlanExecutions,
      (execution, executionIndex) => harnessFactoryResearchPlanExecutionMemoryEntry(
        execution,
        prefix,
        executionIndex,
        provenanceForLedgerRecord(researchPlanExecutionRecords[executionIndex])
      )
    );
    const improvementRejections = ledger.restoreHarnessFactoryImprovementRejections();
    const improvementRejectionRecords = ledgerRecordsOfKind(
      ledger,
      'harness-factory-improvement-rejection'
    );
    const improvementRejectionMemoryEntries = arrayMap(
      improvementRejections,
      (rejection, rejectionIndex) => harnessFactoryImprovementRejectionMemoryEntry(
        rejection,
        prefix,
        rejectionIndex,
        provenanceForLedgerRecord(improvementRejectionRecords[rejectionIndex])
      )
    );
    const architectureProposalArchives =
      ledger.restoreHarnessFactoryArchitectureProposals();
    const architectureProposalRecords = ledgerRecordsOfKind(
      ledger,
      'harness-factory-architecture-proposals'
    );
    const architectureProposalMemoryEntries = [];
    arrayForEach(
      architectureProposalArchives,
      (batch, batchIndex) => {
        const record = architectureProposalRecords[batchIndex];
        const entries = harnessFactoryArchitectureProposalMemoryEntries(
          batch,
          prefix,
          batchIndex,
          provenanceForLedgerRecord(record)
        );
        arrayForEach(entries, (entry) => arrayPush(architectureProposalMemoryEntries, entry));
      }
    );
    const architectureCoverageMemoryEntries =
      harnessFactoryArchitectureCoverageMemoryEntries(ledger, prefix);
    const proposalConversionMemoryEntries =
      harnessFactoryArchitectureProposalConversionMemoryEntries(ledger, prefix);
    const proposalReplayOutcomeMemoryEntries =
      harnessFactoryArchitectureProposalReplayOutcomeMemoryEntries(ledger, prefix);
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
    const benchmarkFrontierValidationStabilityMemoryEntries =
      harnessFactoryBenchmarkFrontierValidationStabilityMemoryEntries(
        benchmarkCampaigns,
        benchmarkValidations,
        benchmarkValidationRecords,
        prefix
      );
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
      + researchPlanExecutionMemoryEntries.length
      + improvementRejectionMemoryEntries.length
      + architectureProposalMemoryEntries.length
      + architectureCoverageMemoryEntries.length
      + proposalConversionMemoryEntries.length
      + proposalReplayOutcomeMemoryEntries.length
      + benchmarkFrontierValidationMemoryEntries.length
      + benchmarkFrontierValidationStabilityMemoryEntries.length
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
    arrayForEach(researchPlanExecutionMemoryEntries, (entry) => {
      arrayPush(entries, entry);
    });
    arrayForEach(improvementRejectionMemoryEntries, (entry) => {
      arrayPush(entries, entry);
    });
    arrayForEach(architectureProposalMemoryEntries, (entry) => {
      arrayPush(entries, entry);
    });
    arrayForEach(architectureCoverageMemoryEntries, (entry) => {
      arrayPush(entries, entry);
    });
    arrayForEach(proposalConversionMemoryEntries, (entry) => {
      arrayPush(entries, entry);
    });
    arrayForEach(proposalReplayOutcomeMemoryEntries, (entry) => {
      arrayPush(entries, entry);
    });
    arrayForEach(benchmarkFrontierValidationMemoryEntries, (entry) => {
      arrayPush(entries, entry);
    });
    arrayForEach(benchmarkFrontierValidationStabilityMemoryEntries, (entry) => {
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
    const sources = options.sources === undefined || options.sources === null
      ? null
      : normalizeSources(options.sources);
    if (source !== null && sources !== null) {
      throw new TypeError(
        'Structured memory query cannot use source and sources together'
      );
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
        || (sources !== null && !arrayIncludes(sources, entry.source))
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
    const sourceCounts = sourceCountsForQuery({ source, sources }, results);
    const retrieval = objectFreeze({
      query: objectFreeze({
        keywords,
        architectureId,
        taskId,
        strategyKey,
        source,
        sources,
        evidence,
        surpriseBand,
        minSurpriseNats,
        limit
      }),
      results: objectFreeze(results),
      sourceCounts,
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
    this.sourceCounts = retrieval.sourceCounts;
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
      sourceCounts: this.sourceCounts,
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
