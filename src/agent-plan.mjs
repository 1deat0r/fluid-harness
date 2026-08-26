import { POLICY_MODES } from './evaluation.mjs';
import {
  isTrustedProcessRunner,
  snapshotProcessData
} from './process-boundary.mjs';
import {
  arrayEvery,
  arrayFind,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  isPlainObject,
  isSafeInteger,
  objectFreeze,
  objectGetPrototypeOf,
  objectHasOwn,
  objectKeys,
  objectValues,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const AGENT_PLAN_SOURCES = objectFreeze({
  PROCESS_ISOLATED: 'PROCESS_ISOLATED'
});

const TRUSTED_AGENT_EPISODE_PLANS = weakSetCreate();
const TRUSTED_AGENT_PLANNERS = weakSetCreate();
const DEFAULT_MAX_EPISODES = 32;
const DEFAULT_MAX_TOOL_CALLS_PER_EPISODE = 8;
const EPISODE_KEYS = objectFreeze([
  'task',
  'input',
  'policyMode',
  'executionOptions',
  'toolCalls',
  'inputFromToolCall'
]);
const TOOL_CALL_KEYS = objectFreeze(['toolId', 'callId', 'input']);

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function requirePositiveInteger(value, field) {
  if (!isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`);
  }
  return value;
}

function requireAllowedKeys(value, allowed, field) {
  if (!arrayEvery(objectKeys(value), (key) => arrayIncludes(allowed, key))) {
    throw new TypeError(`${field} contains an unsupported property`);
  }
}

function normalizeTask(task, index) {
  if (!isPlainObject(task)) {
    throw new TypeError(`Agent plan episode ${index} task must be a plain object`);
  }
  requireAllowedKeys(task, ['id', 'description'], `Agent plan episode ${index} task`);
  return objectFreeze({
    id: requireNonEmptyString(task.id, `Agent plan episode ${index} task.id`),
    description: requireNonEmptyString(
      task.description,
      `Agent plan episode ${index} task.description`
    )
  });
}

function normalizeToolCalls(toolCalls, index, maxToolCallsPerEpisode) {
  if (!arrayIsArray(toolCalls) || toolCalls.length === 0) {
    throw new TypeError(`Agent plan episode ${index} toolCalls must be a non-empty array`);
  }
  if (toolCalls.length > maxToolCallsPerEpisode) {
    throw new RangeError(
      `Agent plan episode ${index} has ${toolCalls.length} tool calls; maximum is ${maxToolCallsPerEpisode}`
    );
  }
  const callIds = [];
  return objectFreeze(arrayMap(toolCalls, (call, callIndex) => {
    if (!isPlainObject(call)) {
      throw new TypeError(`Agent plan episode ${index} tool call ${callIndex} must be a plain object`);
    }
    requireAllowedKeys(call, TOOL_CALL_KEYS, `Agent plan episode ${index} tool call ${callIndex}`);
    const callId = requireNonEmptyString(
      call.callId,
      `Agent plan episode ${index} tool call ${callIndex}.callId`
    );
    if (arrayIncludes(callIds, callId)) {
      throw new TypeError(`Agent plan episode ${index} tool call ids must be unique`);
    }
    arrayPush(callIds, callId);
    return objectFreeze({
      toolId: requireNonEmptyString(
        call.toolId,
        `Agent plan episode ${index} tool call ${callIndex}.toolId`
      ),
      callId,
      input: call.input
    });
  }));
}

function normalizeEpisode(episode, index, maxToolCallsPerEpisode) {
  const normalized = snapshotProcessData(episode);
  if (!isPlainObject(normalized)) {
    throw new TypeError(`Agent plan episode ${index} must be a plain object`);
  }
  requireAllowedKeys(normalized, EPISODE_KEYS, `Agent plan episode ${index}`);
  if (!objectHasOwn(normalized, 'task') || !objectHasOwn(normalized, 'input')) {
    throw new TypeError(`Agent plan episode ${index} requires task and input`);
  }

  const normalizedEpisode = {
    task: normalizeTask(normalized.task, index),
    input: normalized.input,
    policyMode: normalized.policyMode ?? POLICY_MODES.PRODUCTION,
    executionOptions: normalized.executionOptions ?? {}
  };
  if (!arrayIncludes(objectValues(POLICY_MODES), normalizedEpisode.policyMode)) {
    throw new RangeError(`Agent plan episode ${index} has an invalid policyMode`);
  }
  if (!isPlainObject(normalizedEpisode.executionOptions)) {
    throw new TypeError(`Agent plan episode ${index} executionOptions must be a plain object`);
  }

  if (objectHasOwn(normalized, 'toolCalls')) {
    normalizedEpisode.toolCalls = normalizeToolCalls(
      normalized.toolCalls,
      index,
      maxToolCallsPerEpisode
    );
    if (objectHasOwn(normalized, 'inputFromToolCall')) {
      const inputCallId = requireNonEmptyString(
        normalized.inputFromToolCall,
        `Agent plan episode ${index} inputFromToolCall`
      );
      if (!arrayFind(normalizedEpisode.toolCalls, ({ callId }) => callId === inputCallId)) {
        throw new Error(`Agent plan episode ${index} inputFromToolCall was not declared`);
      }
      normalizedEpisode.inputFromToolCall = inputCallId;
    }
  } else if (objectHasOwn(normalized, 'inputFromToolCall')) {
    throw new TypeError(`Agent plan episode ${index} inputFromToolCall requires toolCalls`);
  }
  return objectFreeze(normalizedEpisode);
}

export class AgentEpisodePlan {
  constructor({
    episodes,
    plannerId,
    source = AGENT_PLAN_SOURCES.PROCESS_ISOLATED,
    maxEpisodes = DEFAULT_MAX_EPISODES,
    maxToolCallsPerEpisode = DEFAULT_MAX_TOOL_CALLS_PER_EPISODE
  } = {}) {
    if (!arrayIsArray(episodes) || episodes.length === 0) {
      throw new TypeError('AgentEpisodePlan requires at least one episode');
    }
    const episodeLimit = requirePositiveInteger(maxEpisodes, 'Agent plan maxEpisodes');
    const toolCallLimit = requirePositiveInteger(
      maxToolCallsPerEpisode,
      'Agent plan maxToolCallsPerEpisode'
    );
    if (episodes.length > episodeLimit) {
      throw new RangeError(
        `Agent plan contains ${episodes.length} episodes; maximum is ${episodeLimit}`
      );
    }
    if (!arrayIncludes(objectValues(AGENT_PLAN_SOURCES), source)) {
      throw new TypeError('Agent plan source is invalid');
    }
    this.plannerId = requireNonEmptyString(plannerId, 'Agent plannerId');
    this.source = source;
    this.episodes = objectFreeze(arrayMap(
      episodes,
      (episode, index) => normalizeEpisode(episode, index, toolCallLimit)
    ));
    this.maxEpisodes = episodeLimit;
    this.maxToolCallsPerEpisode = toolCallLimit;
    this.dataOnly = true;
    weakSetAdd(TRUSTED_AGENT_EPISODE_PLANS, this);
    objectFreeze(this);
  }
}

export function isTrustedAgentEpisodePlan(plan) {
  return typeof plan === 'object'
    && plan !== null
    && weakSetHas(TRUSTED_AGENT_EPISODE_PLANS, plan)
    && objectGetPrototypeOf(plan) === AgentEpisodePlan.prototype;
}

export class ProcessBackedAgentPlanner {
  constructor({
    runner,
    plannerId = 'process-backed-agent-planner',
    maxEpisodes = DEFAULT_MAX_EPISODES,
    maxToolCallsPerEpisode = DEFAULT_MAX_TOOL_CALLS_PER_EPISODE
  } = {}) {
    if (!isTrustedProcessRunner(runner)) {
      throw new TypeError('ProcessBackedAgentPlanner requires a trusted ProcessIsolatedRunner');
    }
    this.runner = runner;
    this.plannerId = requireNonEmptyString(plannerId, 'Agent plannerId');
    this.maxEpisodes = requirePositiveInteger(maxEpisodes, 'Agent planner maxEpisodes');
    this.maxToolCallsPerEpisode = requirePositiveInteger(
      maxToolCallsPerEpisode,
      'Agent planner maxToolCallsPerEpisode'
    );
    weakSetAdd(TRUSTED_AGENT_PLANNERS, this);
    objectFreeze(this);
  }

  plan({ goal, context = null } = {}) {
    if (!isTrustedAgentPlanner(this)) {
      throw new TypeError('ProcessBackedAgentPlanner requires an exact trusted instance');
    }
    const request = snapshotProcessData({
      goal: requireNonEmptyString(goal, 'Agent planner goal'),
      context
    });
    const response = this.runner.run(request).value;
    if (!isPlainObject(response) || !arrayIsArray(response.episodes)) {
      throw new TypeError('Process-backed agent planner must return an episodes array');
    }
    return new AgentEpisodePlan({
      episodes: response.episodes,
      plannerId: this.plannerId,
      source: AGENT_PLAN_SOURCES.PROCESS_ISOLATED,
      maxEpisodes: this.maxEpisodes,
      maxToolCallsPerEpisode: this.maxToolCallsPerEpisode
    });
  }
}

objectFreeze(AgentEpisodePlan.prototype);
objectFreeze(ProcessBackedAgentPlanner.prototype);

export function isTrustedAgentPlanner(planner) {
  return typeof planner === 'object'
    && planner !== null
    && weakSetHas(TRUSTED_AGENT_PLANNERS, planner)
    && objectGetPrototypeOf(planner) === ProcessBackedAgentPlanner.prototype;
}
