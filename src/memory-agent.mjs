import {
  isTrustedAgentRunReport,
  isTrustedAgentResearchBatchResolutionReport,
  isTrustedAgentResearchResolutionReport,
  isTrustedAgentRunner
} from './agent.mjs';
import {
  isTrustedAgentEpisodePlan,
  isTrustedAgentPlanner
} from './agent-plan.mjs';
import {
  isTrustedAgentPlannerPromotion,
  plannerFromPromotedSearch
} from './agent-search.mjs';
import {
  agentFromAdoptedArchitecture,
  isTrustedAgentArchitectureAgent
} from './agent-architecture-runtime.mjs';
import { isTrustedAgentArchitectureAdoption } from './agent-architecture.mjs';
import {
  isTrustedAgentArchitectureDiscoveryReport
} from './agent-architecture-discovery.mjs';
import {
  continueBoundedAgentFromLedger,
  isTrustedAgentContinuation
} from './agent-continuation.mjs';
import {
  buildStructuredMemoryContext,
  isTrustedBoundedStructuredMemory,
  isTrustedStructuredMemoryContext,
  memoryFromLedger,
  planWithStructuredMemory
} from './memory.mjs';
import { isTrustedEvidenceLedger } from './evidence-ledger.mjs';
import { isTrustedResearchSchedule } from './research-scheduler.mjs';
import {
  arrayMap,
  arrayForEach,
  arrayIncludes,
  isFrozenObject,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  reflectOwnKeys,
  stringTrim,
  weakMapCreate,
  weakMapGet,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

const MEMORY_AGENT_OPTIONS_KEYS = objectFreeze([
  'memory',
  'planner',
  'runner',
  'historicalWorldModelHistoryLength',
  'architectureId',
  'previousArchitectureId',
  'factoryToken'
]);
const MEMORY_AGENT_RUN_KEYS = objectFreeze([
  'goal',
  'query',
  'context',
  'reproduction',
  'stopOnResearchRequired'
]);
const MEMORY_AGENT_RESEARCH_KEYS = objectFreeze(['taskId', 'research']);
const MEMORY_AGENT_SCHEDULE_KEYS = objectFreeze(['maxItems']);
const MEMORY_AGENT_BATCH_KEYS = objectFreeze(['researches', 'maxItems']);
const MEMORY_AGENT_PERSIST_KEYS = objectFreeze(['ledger']);
const MEMORY_AGENT_PROMOTION_KEYS = objectFreeze([
  'promotion',
  'ledger',
  'runner',
  'toolRegistry',
  'policy',
  'constitution',
  'maxEntries',
  'idPrefix'
]);
const MEMORY_AGENT_ARCHITECTURE_KEYS = objectFreeze([
  'adoption',
  'ledger',
  'toolRegistry',
  'maxEntries',
  'idPrefix'
]);
const MEMORY_AGENT_DISCOVERY_KEYS = objectFreeze([
  'discovery',
  'ledger',
  'toolRegistry',
  'maxEntries',
  'idPrefix'
]);
const MEMORY_AGENT_LEDGER_KEYS = objectFreeze([
  'ledger',
  'planner',
  'runner',
  'toolRegistry',
  'policy',
  'constitution',
  'maxEntries',
  'idPrefix'
]);
const TRUSTED_MEMORY_AGENTS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_REPORTS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_RUNS = weakMapCreate();
const TRUSTED_MEMORY_AGENT_RESEARCH_RECEIPTS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_SCHEDULES = weakMapCreate();
const TRUSTED_MEMORY_AGENT_SCHEDULE_RECEIPTS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_BATCH_RECEIPTS = weakSetCreate();
const TRUSTED_MEMORY_AGENT_LEDGER_WRITES = weakMapCreate();
const TRUSTED_MEMORY_AGENT_LEDGER_RECEIPTS = weakSetCreate();
const MEMORY_AGENT_FACTORY_TOKEN = objectFreeze({});

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
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
      || !arrayIncludes(allowedKeys, key)
    ) {
      throw new TypeError(`${field} must contain only enumerable data properties`);
    }
  });
  return value;
}

function freshRunnerRequired(runner) {
  const status = runner.cycleRunner.core.status;
  if (status.shutdown || status.actionsUsed !== 0 || runner.cycleRunner.core.auditTrail.length !== 0) {
    throw new TypeError('MemoryAwareAgent requires a fresh active bounded runner');
  }
}

export class MemoryAwareAgentRunReport {
  constructor({
    plan,
    runReport,
    memoryContext,
    priorWorldModelHistoryLength = 0,
    architectureId = null,
    previousArchitectureId = null
  }) {
    if (!isTrustedAgentEpisodePlan(plan)) {
      throw new TypeError('MemoryAwareAgentRunReport requires a trusted episode plan');
    }
    if (!isTrustedAgentRunReport(runReport)) {
      throw new TypeError('MemoryAwareAgentRunReport requires a trusted agent run report');
    }
    if (!isTrustedStructuredMemoryContext(memoryContext)) {
      throw new TypeError('MemoryAwareAgentRunReport requires a trusted memory context');
    }
    if (
      !isSafeInteger(priorWorldModelHistoryLength)
      || priorWorldModelHistoryLength < 0
    ) {
      throw new TypeError(
        'MemoryAwareAgentRunReport priorWorldModelHistoryLength must be a non-negative integer'
      );
    }
    const normalizedArchitectureId = architectureId === null
      ? null
      : requireNonEmptyString(
        architectureId,
        'MemoryAwareAgentRunReport architectureId'
      );
    const normalizedPreviousArchitectureId = previousArchitectureId === null
      ? null
      : requireNonEmptyString(
        previousArchitectureId,
        'MemoryAwareAgentRunReport previousArchitectureId'
      );
    const firstEpisode = plan.episodes[0];
    this.plannerId = plan.plannerId;
    this.architectureId = normalizedArchitectureId;
    this.previousArchitectureId = normalizedPreviousArchitectureId;
    this.plan = objectFreeze({
      plannerId: plan.plannerId,
      architectureId: normalizedArchitectureId,
      previousArchitectureId: normalizedPreviousArchitectureId,
      episodeCount: plan.episodes.length,
      firstTaskId: firstEpisode.task.id,
      firstTaskDescription: firstEpisode.task.description,
      dataOnly: true
    });
    this.memoryContext = objectFreeze({
      source: memoryContext.source,
      query: memoryContext.query,
      resultCount: memoryContext.resultCount,
      dataOnly: true,
      historicalOnly: true,
      authorityTransferred: false
    });
    this.run = objectFreeze({
      completed: runReport.completed,
      attemptedEpisodes: runReport.attemptedEpisodes,
      stopReason: runReport.stopReason,
      error: runReport.error,
      pendingResearch: runReport.pendingResearch,
      auditValid: runReport.auditValid,
      priorWorldModelHistoryLength,
      toolInvocationCount: runReport.toolInvocations.length,
      toolInvocationEvidence: objectFreeze(arrayMap(
        runReport.toolInvocations,
        (invocation) => invocation.evidence
      )),
      actionEvidence: objectFreeze(arrayMap(
        runReport.cycles,
        (cycle) => cycle.action.evidence
      )),
      actionsUsed: runReport.coreStatus.actionsUsed,
      dataOnly: true
    });
    this.dataOnly = true;
    this.authorityTransferred = false;
    objectFreeze(this);
  }
}

export function isTrustedMemoryAwareAgentRunReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_REPORTS, report)
    && isFrozenObject(report)
    && objectGetPrototypeOf(report) === MemoryAwareAgentRunReport.prototype;
}

export class MemoryAwareAgentResearchReceipt {
  constructor({ resolution }) {
    if (!isTrustedAgentResearchResolutionReport(resolution)) {
      throw new TypeError(
        'MemoryAwareAgentResearchReceipt requires a trusted research resolution'
      );
    }
    this.status = resolution.status;
    this.actionNumber = resolution.actionNumber;
    this.taskId = resolution.taskId;
    this.search = resolution.search === null
      ? null
      : objectFreeze({ ...resolution.search });
    this.error = resolution.error;
    this.pendingResearchCount = resolution.pendingResearch.length;
    this.auditValid = resolution.auditValid;
    this.dataOnly = true;
    this.authorityTransferred = false;
    objectFreeze(this);
  }
}

export function isTrustedMemoryAwareAgentResearchReceipt(receipt) {
  return typeof receipt === 'object'
    && receipt !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_RESEARCH_RECEIPTS, receipt)
    && isFrozenObject(receipt)
    && objectGetPrototypeOf(receipt) === MemoryAwareAgentResearchReceipt.prototype;
}

export class MemoryAwareAgentResearchScheduleReceipt {
  constructor({ schedule }) {
    if (!isTrustedResearchSchedule(schedule)) {
      throw new TypeError(
        'MemoryAwareAgentResearchScheduleReceipt requires a trusted schedule'
      );
    }
    this.requestedItems = schedule.requestedItems;
    this.sourceCount = schedule.sourceCount;
    this.scheduledCount = schedule.scheduledCount;
    this.complete = schedule.complete;
    this.taskIds = objectFreeze(arrayMap(
      schedule.entries,
      (entry) => entry.taskId
    ));
    this.dataOnly = true;
    this.authorityTransferred = false;
    objectFreeze(this);
  }
}

export function isTrustedMemoryAwareAgentResearchScheduleReceipt(receipt) {
  return typeof receipt === 'object'
    && receipt !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_SCHEDULE_RECEIPTS, receipt)
    && isFrozenObject(receipt)
    && objectGetPrototypeOf(receipt) === MemoryAwareAgentResearchScheduleReceipt.prototype;
}

export class MemoryAwareAgentResearchBatchReceipt {
  constructor({ batch }) {
    if (!isTrustedAgentResearchBatchResolutionReport(batch)) {
      throw new TypeError(
        'MemoryAwareAgentResearchBatchReceipt requires a trusted batch resolution'
      );
    }
    this.status = batch.status;
    this.selectedCount = batch.selectedCount;
    this.taskIds = batch.taskIds;
    this.attemptedCount = batch.attemptedCount;
    this.resolvedCount = batch.resolvedCount;
    this.complete = batch.complete;
    this.error = batch.error;
    this.pendingResearchCount = batch.pendingResearch.length;
    this.auditValid = batch.auditValid;
    this.dataOnly = true;
    this.authorityTransferred = false;
    objectFreeze(this);
  }
}

export function isTrustedMemoryAwareAgentResearchBatchReceipt(receipt) {
  return typeof receipt === 'object'
    && receipt !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_BATCH_RECEIPTS, receipt)
    && isFrozenObject(receipt)
    && objectGetPrototypeOf(receipt) === MemoryAwareAgentResearchBatchReceipt.prototype;
}

export class MemoryAwareAgentLedgerReceipt {
  constructor({ record, ledgerLength, factoryToken = null }) {
    if (factoryToken !== MEMORY_AGENT_FACTORY_TOKEN) {
      throw new TypeError('MemoryAwareAgentLedgerReceipt factory token is invalid');
    }
    if (!isPlainObject(record) || record.kind !== 'agent-run') {
      throw new TypeError('MemoryAwareAgentLedgerReceipt requires an agent-run record');
    }
    if (!isSafeInteger(record.sequence) || record.sequence <= 0) {
      throw new TypeError('MemoryAwareAgentLedgerReceipt record sequence is invalid');
    }
    if (!isSafeInteger(ledgerLength) || ledgerLength < record.sequence) {
      throw new TypeError('MemoryAwareAgentLedgerReceipt ledger length is invalid');
    }
    const architectureId = record.payload?.architectureId === undefined
      ? null
      : record.payload.architectureId;
    if (architectureId !== null) {
      requireNonEmptyString(
        architectureId,
        'MemoryAwareAgentLedgerReceipt architectureId'
      );
    }
    this.kind = 'agent-run';
    this.sequence = record.sequence;
    this.ledgerLength = ledgerLength;
    this.hash = requireNonEmptyString(record.hash, 'MemoryAwareAgentLedgerReceipt hash');
    this.architectureId = architectureId;
    this.dataOnly = true;
    this.authorityTransferred = false;
    objectFreeze(this);
  }
}

export function isTrustedMemoryAwareAgentLedgerReceipt(receipt) {
  return typeof receipt === 'object'
    && receipt !== null
    && weakSetHas(TRUSTED_MEMORY_AGENT_LEDGER_RECEIPTS, receipt)
    && isFrozenObject(receipt)
    && objectGetPrototypeOf(receipt) === MemoryAwareAgentLedgerReceipt.prototype;
}

export class MemoryAwareAgent {
  constructor(options = {}) {
    requireDataObject(options, 'MemoryAwareAgent options', MEMORY_AGENT_OPTIONS_KEYS);
    const {
      memory,
      planner,
      runner,
      historicalWorldModelHistoryLength = 0,
      architectureId = null,
      previousArchitectureId = null,
      factoryToken = null
    } = options;
    if (!isTrustedBoundedStructuredMemory(memory)) {
      throw new TypeError('MemoryAwareAgent requires a trusted structured memory');
    }
    if (!isTrustedAgentPlanner(planner)) {
      throw new TypeError('MemoryAwareAgent requires a trusted agent planner');
    }
    if (!isTrustedAgentRunner(runner)) {
      throw new TypeError('MemoryAwareAgent requires a trusted bounded runner');
    }
    if (
      !isSafeInteger(historicalWorldModelHistoryLength)
      || historicalWorldModelHistoryLength < 0
    ) {
      throw new TypeError(
        'MemoryAwareAgent historicalWorldModelHistoryLength must be a non-negative integer'
      );
    }
    if (factoryToken !== null && factoryToken !== MEMORY_AGENT_FACTORY_TOKEN) {
      throw new TypeError('MemoryAwareAgent factory token is invalid');
    }
    if (
      historicalWorldModelHistoryLength > 0
      && factoryToken !== MEMORY_AGENT_FACTORY_TOKEN
    ) {
      throw new TypeError(
        'MemoryAwareAgent historical world-model context requires the ledger factory'
      );
    }
    if (
      architectureId !== null
      && factoryToken !== MEMORY_AGENT_FACTORY_TOKEN
    ) {
      throw new TypeError(
        'MemoryAwareAgent architecture lineage requires the ledger factory'
      );
    }
    if (
      previousArchitectureId !== null
      && factoryToken !== MEMORY_AGENT_FACTORY_TOKEN
    ) {
      throw new TypeError(
        'MemoryAwareAgent predecessor lineage requires the ledger factory'
      );
    }
    const normalizedArchitectureId = architectureId === null
      ? null
      : requireNonEmptyString(architectureId, 'MemoryAwareAgent architectureId');
    const normalizedPreviousArchitectureId = previousArchitectureId === null
      ? null
      : requireNonEmptyString(
        previousArchitectureId,
        'MemoryAwareAgent previousArchitectureId'
      );
    freshRunnerRequired(runner);
    this.memory = memory;
    this.planner = planner;
    this.runner = runner;
    this.historicalWorldModelHistoryLength = historicalWorldModelHistoryLength;
    this.architectureId = normalizedArchitectureId;
    this.previousArchitectureId = normalizedPreviousArchitectureId;
    weakSetAdd(TRUSTED_MEMORY_AGENTS, this);
    objectFreeze(this);
  }

  run(options = {}) {
    if (!isTrustedMemoryAwareAgent(this)) {
      throw new TypeError('MemoryAwareAgent run requires an exact trusted agent');
    }
    requireDataObject(options, 'MemoryAwareAgent run options', MEMORY_AGENT_RUN_KEYS);
    freshRunnerRequired(this.runner);
    const {
      goal,
      query = {},
      context = null,
      reproduction = 'MemoryAwareAgent.run',
      stopOnResearchRequired = true
    } = options;
    if (typeof stopOnResearchRequired !== 'boolean') {
      throw new TypeError('MemoryAwareAgent stopOnResearchRequired must be boolean');
    }
    const memoryContext = buildStructuredMemoryContext({
      memory: this.memory,
      query
    });
    const plan = planWithStructuredMemory({
      planner: this.planner,
      goal: requireNonEmptyString(goal, 'MemoryAwareAgent goal'),
      memoryContext,
      context
    });
    const report = this.runner.runPlan({
      plan,
      reproduction: requireNonEmptyString(reproduction, 'MemoryAwareAgent reproduction'),
      stopOnResearchRequired
    });
    const result = new MemoryAwareAgentRunReport({
      plan,
      runReport: report,
      memoryContext,
      priorWorldModelHistoryLength: this.historicalWorldModelHistoryLength,
      architectureId: this.architectureId,
      previousArchitectureId: this.previousArchitectureId
    });
    weakSetAdd(TRUSTED_MEMORY_AGENT_REPORTS, result);
    weakMapSet(TRUSTED_MEMORY_AGENT_RUNS, this, report);
    return result;
  }

  resolveResearch(options = {}) {
    if (!isTrustedMemoryAwareAgent(this)) {
      throw new TypeError('MemoryAwareAgent research requires an exact trusted agent');
    }
    requireDataObject(options, 'MemoryAwareAgent research options', MEMORY_AGENT_RESEARCH_KEYS);
    const runReport = weakMapGet(TRUSTED_MEMORY_AGENT_RUNS, this);
    if (!isTrustedAgentRunReport(runReport)) {
      throw new Error('MemoryAwareAgent research requires a prior bounded run');
    }
    const {
      taskId = null,
      research
    } = options;
    const normalizedTaskId = taskId === null
      ? null
      : requireNonEmptyString(taskId, 'MemoryAwareAgent research taskId');
    if (research === null || typeof research !== 'object') {
      throw new TypeError('MemoryAwareAgent research requires a data object');
    }
    const resolution = this.runner.resolveResearch({
      runReport,
      taskId: normalizedTaskId,
      research
    });
    const receipt = new MemoryAwareAgentResearchReceipt({ resolution });
    weakSetAdd(TRUSTED_MEMORY_AGENT_RESEARCH_RECEIPTS, receipt);
    return receipt;
  }

  scheduleResearch(options = {}) {
    if (!isTrustedMemoryAwareAgent(this)) {
      throw new TypeError('MemoryAwareAgent research scheduling requires an exact trusted agent');
    }
    requireDataObject(options, 'MemoryAwareAgent schedule options', MEMORY_AGENT_SCHEDULE_KEYS);
    const runReport = weakMapGet(TRUSTED_MEMORY_AGENT_RUNS, this);
    if (!isTrustedAgentRunReport(runReport)) {
      throw new Error('MemoryAwareAgent research scheduling requires a prior bounded run');
    }
    const { maxItems } = options;
    const schedule = maxItems === undefined
      ? this.runner.scheduleResearch()
      : this.runner.scheduleResearch({ maxItems });
    if (!isTrustedResearchSchedule(schedule)) {
      throw new TypeError('MemoryAwareAgent research scheduler returned an untrusted schedule');
    }
    weakMapSet(TRUSTED_MEMORY_AGENT_SCHEDULES, this, schedule);
    const receipt = new MemoryAwareAgentResearchScheduleReceipt({ schedule });
    weakSetAdd(TRUSTED_MEMORY_AGENT_SCHEDULE_RECEIPTS, receipt);
    return receipt;
  }

  resolveResearchBatch(options = {}) {
    if (!isTrustedMemoryAwareAgent(this)) {
      throw new TypeError('MemoryAwareAgent research batch requires an exact trusted agent');
    }
    requireDataObject(options, 'MemoryAwareAgent research batch options', MEMORY_AGENT_BATCH_KEYS);
    const runReport = weakMapGet(TRUSTED_MEMORY_AGENT_RUNS, this);
    if (!isTrustedAgentRunReport(runReport)) {
      throw new Error('MemoryAwareAgent research batch requires a prior bounded run');
    }
    const schedule = weakMapGet(TRUSTED_MEMORY_AGENT_SCHEDULES, this);
    if (!isTrustedResearchSchedule(schedule) || schedule.entries.length === 0) {
      throw new Error('MemoryAwareAgent research batch requires a scheduled handoff');
    }
    const {
      researches,
      maxItems
    } = options;
    const runnerOptions = {
      runReport,
      schedule,
      researches
    };
    if (maxItems !== undefined) {
      runnerOptions.maxItems = maxItems;
    }
    const batch = this.runner.resolveScheduledResearch(runnerOptions);
    const receipt = new MemoryAwareAgentResearchBatchReceipt({ batch });
    weakSetAdd(TRUSTED_MEMORY_AGENT_BATCH_RECEIPTS, receipt);
    if (batch.complete) {
      weakMapSet(TRUSTED_MEMORY_AGENT_SCHEDULES, this, null);
    }
    return receipt;
  }

  persistRun(options = {}) {
    if (!isTrustedMemoryAwareAgent(this)) {
      throw new TypeError('MemoryAwareAgent persistence requires an exact trusted agent');
    }
    requireDataObject(options, 'MemoryAwareAgent persistence options', MEMORY_AGENT_PERSIST_KEYS);
    const runReport = weakMapGet(TRUSTED_MEMORY_AGENT_RUNS, this);
    if (!isTrustedAgentRunReport(runReport)) {
      throw new Error('MemoryAwareAgent persistence requires a prior bounded run');
    }
    const { ledger } = options;
    if (!isTrustedEvidenceLedger(ledger)) {
      throw new TypeError('MemoryAwareAgent persistence requires a trusted evidence ledger');
    }
    let writtenLedgers = weakMapGet(TRUSTED_MEMORY_AGENT_LEDGER_WRITES, this);
    if (writtenLedgers === undefined) {
      writtenLedgers = weakSetCreate();
      weakMapSet(TRUSTED_MEMORY_AGENT_LEDGER_WRITES, this, writtenLedgers);
    }
    if (weakSetHas(writtenLedgers, ledger)) {
      throw new Error('MemoryAwareAgent persistence already wrote this ledger');
    }
    const record = ledger.appendAgentRun(runReport, this.architectureId);
    weakSetAdd(writtenLedgers, ledger);
    const receipt = new MemoryAwareAgentLedgerReceipt({
      record,
      ledgerLength: ledger.length,
      factoryToken: MEMORY_AGENT_FACTORY_TOKEN
    });
    weakSetAdd(TRUSTED_MEMORY_AGENT_LEDGER_RECEIPTS, receipt);
    return receipt;
  }
}

export function isTrustedMemoryAwareAgent(agent) {
  return typeof agent === 'object'
    && agent !== null
    && weakSetHas(TRUSTED_MEMORY_AGENTS, agent)
    && isFrozenObject(agent)
    && objectGetPrototypeOf(agent) === MemoryAwareAgent.prototype;
}

function memoryAwareAgentFromLedgerInternal(
  options = {},
  architectureId = null,
  previousArchitectureId = null
) {
  requireDataObject(options, 'MemoryAwareAgent ledger options', MEMORY_AGENT_LEDGER_KEYS);
  const {
    ledger,
    planner,
    runner,
    toolRegistry = null,
    policy = null,
    constitution,
    maxEntries,
    idPrefix
  } = options;
  if (!isTrustedEvidenceLedger(ledger)) {
    throw new TypeError('MemoryAwareAgent ledger factory requires a trusted evidence ledger');
  }
  const normalizedArchitectureId = architectureId === null
    ? null
    : requireNonEmptyString(
      architectureId,
      'MemoryAwareAgent ledger factory architectureId'
    );
  const normalizedPreviousArchitectureId = previousArchitectureId === null
    ? null
    : requireNonEmptyString(
      previousArchitectureId,
      'MemoryAwareAgent ledger factory previousArchitectureId'
    );
  const memory = memoryFromLedger({
    ledger,
    ...(maxEntries === undefined ? {} : { maxEntries }),
    ...(idPrefix === undefined ? {} : { idPrefix })
  });
  let effectiveRunner = runner;
  let historicalWorldModelHistoryLength = 0;
  if (effectiveRunner === undefined) {
    const continuationOptions = { ledger };
    if (toolRegistry !== null) {
      continuationOptions.toolRegistry = toolRegistry;
    }
    if (policy !== null) {
      continuationOptions.policy = policy;
    }
    if (constitution !== undefined) {
      continuationOptions.constitution = constitution;
    }
    const continuation = continueBoundedAgentFromLedger(continuationOptions);
    if (!isTrustedAgentContinuation(continuation)) {
      throw new TypeError('MemoryAwareAgent ledger factory built an untrusted continuation');
    }
    effectiveRunner = continuation.runner;
    historicalWorldModelHistoryLength = continuation.context.priorWorldModelHistoryLength;
  }
  const agentOptions = {
    memory,
    planner,
    runner: effectiveRunner,
    historicalWorldModelHistoryLength,
    architectureId: normalizedArchitectureId,
    previousArchitectureId: normalizedPreviousArchitectureId
  };
  if (
    historicalWorldModelHistoryLength > 0
    || normalizedArchitectureId !== null
    || normalizedPreviousArchitectureId !== null
  ) {
    agentOptions.factoryToken = MEMORY_AGENT_FACTORY_TOKEN;
  }
  return new MemoryAwareAgent(agentOptions);
}

export function memoryAwareAgentFromLedger(options = {}) {
  return memoryAwareAgentFromLedgerInternal(options);
}

export function memoryAwareAgentFromPlannerPromotion(options = {}) {
  requireDataObject(options, 'MemoryAwareAgent promotion options', MEMORY_AGENT_PROMOTION_KEYS);
  const {
    promotion,
    ledger,
    runner,
    toolRegistry,
    policy,
    constitution,
    maxEntries,
    idPrefix
  } = options;
  if (!isTrustedAgentPlannerPromotion(promotion)) {
    throw new TypeError('MemoryAwareAgent promotion factory requires trusted promotion evidence');
  }
  if (!isTrustedEvidenceLedger(ledger)) {
    throw new TypeError('MemoryAwareAgent promotion factory requires a trusted evidence ledger');
  }
  const planner = plannerFromPromotedSearch(promotion);
  const factoryOptions = {
    ledger,
    planner
  };
  if (runner !== undefined) {
    factoryOptions.runner = runner;
  }
  if (toolRegistry !== undefined) {
    factoryOptions.toolRegistry = toolRegistry;
  }
  if (policy !== undefined) {
    factoryOptions.policy = policy;
  }
  if (constitution !== undefined) {
    factoryOptions.constitution = constitution;
  }
  if (maxEntries !== undefined) {
    factoryOptions.maxEntries = maxEntries;
  }
  if (idPrefix !== undefined) {
    factoryOptions.idPrefix = idPrefix;
  }
  return memoryAwareAgentFromLedger(factoryOptions);
}

function latestPersistedArchitectureId(ledger) {
  let latestArchitectureId = null;
  arrayForEach(ledger.restoreAgentRuns(), (run) => {
    if (run.architectureId !== null) {
      latestArchitectureId = run.architectureId;
    }
  });
  return latestArchitectureId;
}

export function memoryAwareAgentFromArchitectureAdoption(options = {}) {
  requireDataObject(
    options,
    'MemoryAwareAgent architecture options',
    MEMORY_AGENT_ARCHITECTURE_KEYS
  );
  const {
    adoption,
    ledger,
    toolRegistry,
    maxEntries,
    idPrefix
  } = options;
  if (!isTrustedAgentArchitectureAdoption(adoption)) {
    throw new TypeError(
      'MemoryAwareAgent architecture factory requires trusted adoption evidence'
    );
  }
  if (!isTrustedEvidenceLedger(ledger)) {
    throw new TypeError(
      'MemoryAwareAgent architecture factory requires a trusted evidence ledger'
    );
  }
  const previousArchitectureId = latestPersistedArchitectureId(ledger);
  const architectureAgent = agentFromAdoptedArchitecture(adoption, {
    toolRegistry
  });
  if (!isTrustedAgentArchitectureAgent(architectureAgent)) {
    throw new TypeError(
      'MemoryAwareAgent architecture factory built an untrusted architecture agent'
    );
  }
  const factoryOptions = {
    ledger,
    planner: architectureAgent.planner,
    policy: architectureAgent.policy
  };
  if (toolRegistry !== undefined) {
    factoryOptions.toolRegistry = toolRegistry;
  }
  if (maxEntries !== undefined) {
    factoryOptions.maxEntries = maxEntries;
  }
  if (idPrefix !== undefined) {
    factoryOptions.idPrefix = idPrefix;
  }
  return memoryAwareAgentFromLedgerInternal(
    factoryOptions,
    architectureAgent.architectureId,
    previousArchitectureId
  );
}

export function memoryAwareAgentFromArchitectureDiscovery(options = {}) {
  requireDataObject(
    options,
    'MemoryAwareAgent discovery options',
    MEMORY_AGENT_DISCOVERY_KEYS
  );
  const {
    discovery,
    ledger,
    toolRegistry,
    maxEntries,
    idPrefix
  } = options;
  if (!isTrustedAgentArchitectureDiscoveryReport(discovery)) {
    throw new TypeError(
      'MemoryAwareAgent discovery factory requires a trusted discovery report'
    );
  }
  if (
    discovery.complete !== true
    || discovery.adopted !== true
    || !isTrustedAgentArchitectureAdoption(discovery.adoption?.adoption)
  ) {
    throw new TypeError(
      'MemoryAwareAgent discovery factory requires complete trusted adoption evidence'
    );
  }
  const factoryOptions = {
    adoption: discovery.adoption.adoption,
    ledger
  };
  if (toolRegistry !== undefined) {
    factoryOptions.toolRegistry = toolRegistry;
  }
  if (maxEntries !== undefined) {
    factoryOptions.maxEntries = maxEntries;
  }
  if (idPrefix !== undefined) {
    factoryOptions.idPrefix = idPrefix;
  }
  return memoryAwareAgentFromArchitectureAdoption(factoryOptions);
}

objectFreeze(MemoryAwareAgentRunReport.prototype);
objectFreeze(MemoryAwareAgentResearchReceipt.prototype);
objectFreeze(MemoryAwareAgentResearchScheduleReceipt.prototype);
objectFreeze(MemoryAwareAgentResearchBatchReceipt.prototype);
objectFreeze(MemoryAwareAgentLedgerReceipt.prototype);
objectFreeze(MemoryAwareAgent.prototype);
