import {
  POLICY_MODES
} from './evaluation.mjs';
import {
  CognitiveCycleRunner,
  isTrustedCycleReport,
  isTrustedCycleRunner
} from './cycle.mjs';
import {
  arrayIncludes,
  arrayEvery,
  arrayFind,
  arrayForEach,
  arrayIsArray,
  arrayMap,
  arrayFilter,
  arraySlice,
  arrayPush,
  arraySome,
  isFrozenObject,
  isInstanceOf,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectHasOwn,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectValues,
  reflectOwnKeys,
  stringFrom,
  stringTrim,
  weakMapCreate,
  weakMapGet,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';
import {
  isCompleteSearchReport,
  isTrustedSearchReport
} from './search.mjs';
import {
  TOOL_INVOCATION_STATUSES,
  isTrustedToolInvocationReport,
  isTrustedToolRegistry
} from './tool.mjs';
import { isTrustedAgentEpisodePlan } from './agent-plan.mjs';
import {
  AgentPolicy,
  isTrustedAgentPolicy
} from './evolution.mjs';
import {
  BoundedResearchScheduler,
  isTrustedResearchSchedule
} from './research-scheduler.mjs';

export const AGENT_STOP_REASONS = objectFreeze({
  COMPLETED: 'COMPLETED',
  RESEARCH_REQUIRED: 'RESEARCH_REQUIRED',
  SHUTDOWN: 'SHUTDOWN',
  TOOL_FAILURE: 'TOOL_FAILURE',
  ERROR: 'ERROR'
});

export const AGENT_RESEARCH_STATUSES = objectFreeze({
  RESOLVED: 'RESOLVED',
  INCOMPLETE: 'INCOMPLETE',
  SHUTDOWN: 'SHUTDOWN',
  ERROR: 'ERROR'
});

export const AGENT_RESEARCH_BATCH_STATUSES = objectFreeze({
  COMPLETED: 'COMPLETED',
  INCOMPLETE: 'INCOMPLETE',
  SHUTDOWN: 'SHUTDOWN',
  ERROR: 'ERROR'
});

const TRUSTED_AGENT_RUNNERS = weakSetCreate();
const TRUSTED_AGENT_REPORTS = weakSetCreate();
const TRUSTED_AGENT_REPORT_RUNNERS = weakMapCreate();
const TRUSTED_AGENT_RESEARCH_RESOLUTIONS = weakSetCreate();
const TRUSTED_AGENT_RESEARCH_BATCHES = weakSetCreate();
const TRUSTED_AGENT_RESEARCH_BATCH_RUNNERS = weakMapCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function errorMessage(error) {
  return isInstanceOf(error, Error) ? error.message : stringFrom(error);
}

function enforcePolicyBounds(episodes, policy) {
  if (episodes.length > policy.maxEpisodes) {
    throw new RangeError(
      `BoundedAgentRunner received ${episodes.length} episodes; maximum is ${policy.maxEpisodes}`
    );
  }
  for (let index = 0; index < episodes.length; index += 1) {
    const episode = episodes[index];
    if (
      episode
      && typeof episode === 'object'
      && objectHasOwn(episode, 'toolCalls')
      && arrayIsArray(episode.toolCalls)
      && episode.toolCalls.length > policy.maxToolCallsPerEpisode
    ) {
      throw new RangeError(
        `Agent episode ${index} has ${episode.toolCalls.length} tool calls; `
        + `maximum is ${policy.maxToolCallsPerEpisode}`
      );
    }
  }
}

export class AgentRunReport {
  constructor({
    cycles,
    attemptedEpisodes,
    completed,
    stopReason,
    error = null,
    coreStatus,
    pendingResearch,
    auditValid,
    toolInvocations = [],
    plannerId = null,
    policy = null
  }) {
    if (!arrayIsArray(cycles) || arraySome(cycles, (cycle) => !isTrustedCycleReport(cycle))) {
      throw new TypeError('AgentRunReport requires trusted cognitive cycle reports');
    }
    if (!isSafeInteger(attemptedEpisodes) || attemptedEpisodes < 0) {
      throw new TypeError('AgentRunReport attemptedEpisodes must be non-negative');
    }
    if (typeof completed !== 'boolean') {
      throw new TypeError('AgentRunReport completed must be boolean');
    }
    if (!arrayIncludes(objectValues(AGENT_STOP_REASONS), stopReason)) {
      throw new TypeError('AgentRunReport stopReason is invalid');
    }
    if (error !== null && typeof error !== 'string') {
      throw new TypeError('AgentRunReport error must be a string or null');
    }
    if (plannerId !== null && (typeof plannerId !== 'string' || stringTrim(plannerId) === '')) {
      throw new TypeError('AgentRunReport plannerId must be a non-empty string or null');
    }
    if (policy !== null && !isTrustedAgentPolicy(policy)) {
      throw new TypeError('AgentRunReport policy must be a trusted AgentPolicy or null');
    }
    if (!coreStatus || typeof coreStatus !== 'object' || !arrayIsArray(pendingResearch)) {
      throw new TypeError('AgentRunReport requires core status and pending research snapshots');
    }
    if (!arrayIsArray(toolInvocations) || arraySome(
      toolInvocations,
      (invocation) => !isTrustedToolInvocationReport(invocation)
    )) {
      throw new TypeError('AgentRunReport requires trusted tool invocation reports');
    }

    this.cycles = objectFreeze(arraySlice(cycles));
    this.attemptedEpisodes = attemptedEpisodes;
    this.completed = completed;
    this.stopReason = stopReason;
    this.error = error;
    this.plannerId = plannerId === null ? null : stringTrim(plannerId);
    this.coreStatus = objectFreeze({ ...coreStatus });
    this.pendingResearch = objectFreeze(arraySlice(pendingResearch));
    this.toolInvocations = objectFreeze(arraySlice(toolInvocations));
    this.policy = policy;
    this.auditValid = auditValid === true;
    objectFreeze(this);
  }
}

export function isTrustedAgentRunReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_REPORTS, report)
    && isFrozenObject(report)
    && objectGetPrototypeOf(report) === AgentRunReport.prototype;
}

export class AgentResearchResolutionReport {
  constructor({
    status,
    actionNumber,
    taskId,
    search,
    error = null,
    pendingResearch,
    auditValid
  }) {
    if (!arrayIncludes(objectValues(AGENT_RESEARCH_STATUSES), status)) {
      throw new TypeError('AgentResearchResolutionReport status is invalid');
    }
    if (!isSafeInteger(actionNumber) || actionNumber <= 0) {
      throw new TypeError('AgentResearchResolutionReport actionNumber must be positive');
    }
    this.taskId = requireNonEmptyString(taskId, 'Agent research taskId');
    if (search !== null) {
      if (!search || typeof search !== 'object') {
        throw new TypeError('AgentResearchResolutionReport search must be an object or null');
      }
      this.search = objectFreeze({ ...search });
    } else {
      this.search = null;
    }
    if (error !== null && typeof error !== 'string') {
      throw new TypeError('AgentResearchResolutionReport error must be a string or null');
    }
    if (!arrayIsArray(pendingResearch)) {
      throw new TypeError('AgentResearchResolutionReport requires pending research snapshots');
    }
    this.status = status;
    this.actionNumber = actionNumber;
    this.error = error;
    this.pendingResearch = objectFreeze(arraySlice(pendingResearch));
    this.auditValid = auditValid === true;
    objectFreeze(this);
  }
}

export function isTrustedAgentResearchResolutionReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_RESEARCH_RESOLUTIONS, report)
    && isFrozenObject(report)
    && objectGetPrototypeOf(report) === AgentResearchResolutionReport.prototype;
}

export class AgentResearchBatchResolutionReport {
  constructor({
    status,
    schedule,
    selectedCount,
    resolutions,
    error = null,
    pendingResearch,
    auditValid
  }) {
    if (!arrayIncludes(objectValues(AGENT_RESEARCH_BATCH_STATUSES), status)) {
      throw new TypeError('AgentResearchBatchResolutionReport status is invalid');
    }
    if (!isTrustedResearchSchedule(schedule)) {
      throw new TypeError('AgentResearchBatchResolutionReport requires a trusted research schedule');
    }
    if (
      !isSafeInteger(selectedCount)
      || selectedCount <= 0
      || selectedCount > schedule.entries.length
    ) {
      throw new TypeError('AgentResearchBatchResolutionReport selected count is invalid');
    }
    if (!arrayIsArray(resolutions) || arraySome(
      resolutions,
      (resolution) => !isTrustedAgentResearchResolutionReport(resolution)
    )) {
      throw new TypeError('AgentResearchBatchResolutionReport requires trusted resolutions');
    }
    if (error !== null && typeof error !== 'string') {
      throw new TypeError('AgentResearchBatchResolutionReport error must be a string or null');
    }
    if (!arrayIsArray(pendingResearch)) {
      throw new TypeError('AgentResearchBatchResolutionReport requires pending research snapshots');
    }

    const complete = status === AGENT_RESEARCH_BATCH_STATUSES.COMPLETED;
    if (complete !== (
      resolutions.length === selectedCount
      && arrayEveryResolved(resolutions)
    )) {
      throw new TypeError('AgentResearchBatchResolutionReport completion is inconsistent');
    }

    this.status = status;
    this.schedule = schedule;
    this.selectedCount = selectedCount;
    this.taskIds = objectFreeze(arrayMap(resolutions, (resolution) => resolution.taskId));
    this.resolutions = objectFreeze(arraySlice(resolutions));
    this.attemptedCount = resolutions.length;
    this.resolvedCount = arrayFilter(resolutions, (
      (resolution) => resolution.status === AGENT_RESEARCH_STATUSES.RESOLVED
    )).length;
    this.complete = complete;
    this.error = error;
    this.pendingResearch = objectFreeze(arraySlice(pendingResearch));
    this.auditValid = auditValid === true;
    objectFreeze(this);
  }
}

function arrayEveryResolved(resolutions) {
  return arrayEvery(
    resolutions,
    (resolution) => resolution.status === AGENT_RESEARCH_STATUSES.RESOLVED
  );
}

export function isTrustedAgentResearchBatchResolutionReport(report) {
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_AGENT_RESEARCH_BATCHES, report)
    && isFrozenObject(report)
    && objectGetPrototypeOf(report) === AgentResearchBatchResolutionReport.prototype;
}

function searchSummary(report) {
  if (!isTrustedSearchReport(report)) {
    return null;
  }
  return objectFreeze({
    complete: report.complete === true,
    candidateCount: report.results.length,
    winner: report.winner?.candidateId ?? null,
    promoted: report.promoted?.candidateId ?? null,
    allAuditsValid: report.allAuditsValid === true
  });
}

function researchResolution({
  status,
  pending,
  search = null,
  error = null,
  core
}) {
  const report = new AgentResearchResolutionReport({
    status,
    actionNumber: pending.actionNumber,
    taskId: pending.taskId,
    search: searchSummary(search),
    error,
    pendingResearch: core.researchQueue,
    auditValid: core.verifyAudit()
  });
  weakSetAdd(TRUSTED_AGENT_RESEARCH_RESOLUTIONS, report);
  return report;
}

function validateResearchBatchEntry(entry, index) {
  if (!isPlainObject(entry)) {
    throw new TypeError(`Agent research batch entry ${index} must be a plain object`);
  }
  arrayForEach(reflectOwnKeys(entry), (key) => {
    const descriptor = objectGetOwnPropertyDescriptor(entry, key);
    if (
      typeof key === 'symbol'
      || !descriptor?.enumerable
      || descriptor.get
      || descriptor.set
      || (key !== 'taskId' && key !== 'research')
    ) {
      throw new TypeError(
        `Agent research batch entry ${index} must contain only enumerable taskId and research data`
      );
    }
  });
  if (!objectHasOwn(entry, 'taskId') || !objectHasOwn(entry, 'research')) {
    throw new TypeError(`Agent research batch entry ${index} requires taskId and research`);
  }
  const taskId = requireNonEmptyString(entry.taskId, `Agent research batch entry ${index} taskId`);
  if (!entry.research || typeof entry.research !== 'object') {
    throw new TypeError(`Agent research batch entry ${index} research must be an object`);
  }
  return objectFreeze({ taskId, research: entry.research });
}

export class BoundedAgentRunner {
  constructor({
    cycleRunner = new CognitiveCycleRunner(),
    toolRegistry = null,
    policy = new AgentPolicy()
  } = {}) {
    if (!isTrustedCycleRunner(cycleRunner)) {
      throw new TypeError('BoundedAgentRunner requires a trusted CognitiveCycleRunner');
    }
    if (toolRegistry !== null && !isTrustedToolRegistry(toolRegistry)) {
      throw new TypeError('BoundedAgentRunner requires a trusted ToolRegistry');
    }
    if (!isTrustedAgentPolicy(policy)) {
      throw new TypeError('BoundedAgentRunner requires a trusted AgentPolicy');
    }
    this.cycleRunner = cycleRunner;
    this.toolRegistry = toolRegistry;
    this.policy = policy;
    weakSetAdd(TRUSTED_AGENT_RUNNERS, this);
    objectFreeze(this);
  }

  run({
    episodes,
    stopOnResearchRequired = true,
    reproduction = 'BoundedAgentRunner.run',
    plannerId = null
  } = {}) {
    if (!arrayIsArray(episodes) || episodes.length === 0) {
      throw new TypeError('BoundedAgentRunner requires at least one episode');
    }
    enforcePolicyBounds(episodes, this.policy);
    if (typeof stopOnResearchRequired !== 'boolean') {
      throw new TypeError('BoundedAgentRunner stopOnResearchRequired must be boolean');
    }
    if (plannerId !== null && (typeof plannerId !== 'string' || stringTrim(plannerId) === '')) {
      throw new TypeError('BoundedAgentRunner plannerId must be a non-empty string or null');
    }
    const normalizedReproduction = requireNonEmptyString(reproduction, 'Agent reproduction');
    const cycles = [];
    const toolInvocations = [];
    let attemptedEpisodes = 0;
    let stopReason = AGENT_STOP_REASONS.COMPLETED;
    let error = null;

    for (let index = 0; index < episodes.length; index += 1) {
      const episode = episodes[index];
      if (!episode || typeof episode !== 'object') {
        throw new TypeError(`Agent episode ${index} must be an object`);
      }
      attemptedEpisodes += 1;
      try {
        let episodeInput = episode.input;
        const toolCalls = objectHasOwn(episode, 'toolCalls') ? episode.toolCalls : null;
        if (toolCalls !== null) {
          if (!isTrustedToolRegistry(this.toolRegistry)) {
            throw new TypeError('Agent episode toolCalls require a configured ToolRegistry');
          }
          if (!arrayIsArray(toolCalls) || toolCalls.length === 0) {
            throw new TypeError('Agent episode toolCalls must be a non-empty array');
          }
          if (toolCalls.length > this.policy.maxToolCallsPerEpisode) {
            throw new RangeError(
              `Agent episode has ${toolCalls.length} tool calls; `
              + `maximum is ${this.policy.maxToolCallsPerEpisode}`
            );
          }
          const episodeToolInvocations = [];
          let toolFailed = false;
          for (let toolIndex = 0; toolIndex < toolCalls.length; toolIndex += 1) {
            const call = toolCalls[toolIndex];
            if (!call || typeof call !== 'object') {
              throw new TypeError(`Agent tool call ${toolIndex} must be an object`);
            }
            const invocation = this.toolRegistry.invoke({
              toolId: call.toolId,
              input: call.input,
              callId: call.callId
            });
            arrayPush(toolInvocations, invocation);
            arrayPush(episodeToolInvocations, invocation);
            if (invocation.status !== TOOL_INVOCATION_STATUSES.COMPLETED) {
              error = invocation.error?.message ?? 'Agent tool invocation failed';
              stopReason = AGENT_STOP_REASONS.TOOL_FAILURE;
              toolFailed = true;
              break;
            }
          }
          if (toolFailed) {
            break;
          }
          if (objectHasOwn(episode, 'inputFromToolCall')) {
            const inputCallId = requireNonEmptyString(
              episode.inputFromToolCall,
              'Agent inputFromToolCall'
            );
            const sourceInvocation = arrayFind(
              episodeToolInvocations,
              (invocation) => invocation.callId === inputCallId
            );
            if (!sourceInvocation) {
              throw new Error(`Agent inputFromToolCall was not invoked: ${inputCallId}`);
            }
            episodeInput = sourceInvocation.output;
          }
        } else if (objectHasOwn(episode, 'inputFromToolCall')) {
          throw new TypeError('Agent inputFromToolCall requires toolCalls');
        }
        const cycle = this.cycleRunner.run({
          task: episode.task,
          input: episodeInput,
          policyMode: episode.policyMode ?? POLICY_MODES.PRODUCTION,
          reproduction: `${normalizedReproduction}#${index + 1}`,
          executionOptions: episode.executionOptions ?? {},
          research: objectHasOwn(episode, 'research') ? episode.research : null
        });
        arrayPush(cycles, cycle);
        if (stopOnResearchRequired && cycle.questionDecision.researchRequired) {
          stopReason = AGENT_STOP_REASONS.RESEARCH_REQUIRED;
          break;
        }
        if (this.cycleRunner.core.status.shutdown) {
          stopReason = AGENT_STOP_REASONS.SHUTDOWN;
          break;
        }
      } catch (caught) {
        error = errorMessage(caught);
        stopReason = AGENT_STOP_REASONS.ERROR;
        break;
      }
    }

    const completed = stopReason === AGENT_STOP_REASONS.COMPLETED
      && attemptedEpisodes === episodes.length;
    const report = new AgentRunReport({
      cycles,
      attemptedEpisodes,
      completed,
      stopReason,
      error,
      coreStatus: this.cycleRunner.core.status,
      pendingResearch: this.cycleRunner.core.researchQueue,
      auditValid: this.cycleRunner.core.verifyAudit(),
      toolInvocations,
      plannerId,
      policy: this.policy
    });
    weakSetAdd(TRUSTED_AGENT_REPORTS, report);
    weakMapSet(TRUSTED_AGENT_REPORT_RUNNERS, report, this);
    return report;
  }

  runPlan({ plan, ...options } = {}) {
    if (!isTrustedAgentEpisodePlan(plan)) {
      throw new TypeError('BoundedAgentRunner requires a trusted AgentEpisodePlan');
    }
    return this.run({
      ...options,
      episodes: plan.episodes,
      plannerId: plan.plannerId
    });
  }

  scheduleResearch({ maxItems } = {}) {
    const options = {
      pendingResearch: this.cycleRunner.core.researchQueue
    };
    if (maxItems !== undefined) {
      options.maxItems = maxItems;
    }
    return new BoundedResearchScheduler().schedule(options);
  }

  resolveScheduledResearch({
    runReport,
    schedule,
    researches,
    maxItems = null
  } = {}) {
    if (!isTrustedAgentRunReport(runReport)) {
      throw new TypeError('BoundedAgentRunner scheduled research requires a trusted run report');
    }
    if (weakMapGet(TRUSTED_AGENT_REPORT_RUNNERS, runReport) !== this) {
      throw new TypeError('BoundedAgentRunner scheduled research requires its own run report');
    }
    if (!isTrustedResearchSchedule(schedule)) {
      throw new TypeError('BoundedAgentRunner scheduled research requires a trusted schedule');
    }
    if (schedule.entries.length === 0) {
      throw new TypeError('BoundedAgentRunner scheduled research requires selected entries');
    }
    const selectedCount = maxItems === null ? schedule.entries.length : maxItems;
    if (
      !isSafeInteger(selectedCount)
      || selectedCount <= 0
      || selectedCount > schedule.entries.length
    ) {
      throw new RangeError(
        'BoundedAgentRunner scheduled research maxItems must be a positive selected-entry count'
      );
    }
    if (!arrayIsArray(researches) || researches.length !== selectedCount) {
      throw new TypeError(
        'BoundedAgentRunner scheduled research requires one research specification per selected task'
      );
    }
    for (let index = 0; index < researches.length; index += 1) {
      if (!objectHasOwn(researches, index)) {
        throw new TypeError('BoundedAgentRunner scheduled research requires a dense specification array');
      }
    }

    const selected = arraySlice(schedule.entries, 0, selectedCount);
    const normalized = arrayMap(researches, validateResearchBatchEntry);
    for (let index = 0; index < selected.length; index += 1) {
      const scheduled = selected[index];
      const specification = normalized[index];
      if (specification.taskId !== scheduled.taskId) {
        throw new Error(
          `BoundedAgentRunner scheduled research order mismatch at rank ${scheduled.rank}`
        );
      }
      const pending = arrayFind(
        runReport.pendingResearch,
        (entry) => entry.actionNumber === scheduled.actionNumber && entry.taskId === scheduled.taskId
      );
      if (!pending) {
        throw new Error(`BoundedAgentRunner scheduled research has no pending task: ${scheduled.taskId}`);
      }
      if (index > 0 && arrayFind(
        arraySlice(normalized, 0, index),
        (entry) => entry.taskId === specification.taskId
      )) {
        throw new TypeError('BoundedAgentRunner scheduled research task IDs must be unique');
      }
    }

    const resolutions = [];
    let status = AGENT_RESEARCH_BATCH_STATUSES.COMPLETED;
    let error = null;
    for (let index = 0; index < normalized.length; index += 1) {
      const specification = normalized[index];
      const resolution = this.resolveResearch({
        runReport,
        taskId: specification.taskId,
        research: specification.research
      });
      arrayPush(resolutions, resolution);
      if (resolution.status !== AGENT_RESEARCH_STATUSES.RESOLVED) {
        status = resolution.status === AGENT_RESEARCH_STATUSES.INCOMPLETE
          ? AGENT_RESEARCH_BATCH_STATUSES.INCOMPLETE
          : resolution.status === AGENT_RESEARCH_STATUSES.SHUTDOWN
            ? AGENT_RESEARCH_BATCH_STATUSES.SHUTDOWN
            : AGENT_RESEARCH_BATCH_STATUSES.ERROR;
        error = resolution.error;
        break;
      }
    }

    const report = new AgentResearchBatchResolutionReport({
      status,
      schedule,
      selectedCount,
      resolutions,
      error,
      pendingResearch: this.cycleRunner.core.researchQueue,
      auditValid: this.cycleRunner.core.verifyAudit()
    });
    weakSetAdd(TRUSTED_AGENT_RESEARCH_BATCHES, report);
    weakMapSet(TRUSTED_AGENT_RESEARCH_BATCH_RUNNERS, report, this);
    return report;
  }

  resolveResearch({
    runReport,
    research,
    taskId = null
  } = {}) {
    if (!isTrustedAgentRunReport(runReport)) {
      throw new TypeError('BoundedAgentRunner research resolution requires a trusted run report');
    }
    if (weakMapGet(TRUSTED_AGENT_REPORT_RUNNERS, runReport) !== this) {
      throw new TypeError('BoundedAgentRunner research resolution requires its own run report');
    }
    if (runReport.pendingResearch.length === 0) {
      throw new Error('BoundedAgentRunner research resolution requires pending research');
    }
    if (taskId !== null && (typeof taskId !== 'string' || stringTrim(taskId) === '')) {
      throw new TypeError('BoundedAgentRunner research resolution taskId must be a non-empty string or null');
    }

    const core = this.cycleRunner.core;
    const pending = taskId === null
      ? runReport.pendingResearch[0]
      : arrayFind(runReport.pendingResearch, (entry) => entry.taskId === stringTrim(taskId));
    if (!pending) {
      throw new Error(`BoundedAgentRunner research resolution has no pending task: ${taskId}`);
    }
    const livePending = arrayFind(
      core.researchQueue,
      (entry) => entry.actionNumber === pending.actionNumber && entry.taskId === pending.taskId
    );
    if (!livePending) {
      throw new Error('BoundedAgentRunner research resolution received a stale run report');
    }
    const cycle = arrayFind(
      runReport.cycles,
      (candidate) => candidate.actionNumber === pending.actionNumber
        && candidate.taskId === pending.taskId
        && candidate.questionDecision.researchRequired === true
    );
    if (!cycle) {
      throw new Error('BoundedAgentRunner research resolution cannot locate the pending cycle');
    }
    if (core.status.shutdown) {
      return researchResolution({
        status: AGENT_RESEARCH_STATUSES.SHUTDOWN,
        pending,
        core
      });
    }

    let researchReport = null;
    try {
      researchReport = this.cycleRunner.searchRunner.evaluate(research);
    } catch (caught) {
      return researchResolution({
        status: AGENT_RESEARCH_STATUSES.ERROR,
        pending,
        error: errorMessage(caught),
        core
      });
    }
    if (!isTrustedSearchReport(researchReport)) {
      return researchResolution({
        status: AGENT_RESEARCH_STATUSES.ERROR,
        pending,
        error: 'Research runner returned an untrusted search report',
        core
      });
    }
    if (!isCompleteSearchReport(researchReport)) {
      return researchResolution({
        status: AGENT_RESEARCH_STATUSES.INCOMPLETE,
        pending,
        search: researchReport,
        error: 'Research search report is incomplete',
        core
      });
    }

    try {
      core.recordResearchCompletion({
        actionReport: cycle.action,
        researchReport
      });
    } catch (caught) {
      return researchResolution({
        status: AGENT_RESEARCH_STATUSES.ERROR,
        pending,
        search: researchReport,
        error: errorMessage(caught),
        core
      });
    }
    return researchResolution({
      status: AGENT_RESEARCH_STATUSES.RESOLVED,
      pending,
      search: researchReport,
      core
    });
  }
}

objectFreeze(BoundedAgentRunner.prototype);
objectFreeze(AgentResearchBatchResolutionReport.prototype);

export function isTrustedAgentRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_AGENT_RUNNERS, runner)
    && isFrozenObject(runner)
    && objectGetPrototypeOf(runner) === BoundedAgentRunner.prototype;
}
