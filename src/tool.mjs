import {
  EVIDENCE_LEVELS
} from './evidence.mjs';
import {
  ProcessBoundaryError,
  isTrustedProcessRunner,
  snapshotProcessData
} from './process-boundary.mjs';
import {
  arrayEvery,
  arrayFind,
  arrayForEach,
  arrayIncludes,
  arrayIsArray,
  arraySlice,
  isFiniteNumber,
  isInstanceOf,
  isSafeInteger,
  objectFreeze,
  objectGetPrototypeOf,
  objectValues,
  setAdd,
  setFromArray,
  setHas,
  stringFrom,
  stringTrim,
  weakMapCreate,
  weakMapGet,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const TOOL_INVOCATION_STATUSES = objectFreeze({
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
});

const TRUSTED_TOOL_DEFINITIONS = weakSetCreate();
const TRUSTED_TOOL_REGISTRIES = weakSetCreate();
const TRUSTED_TOOL_REPORTS = weakSetCreate();
const TRUSTED_TOOL_REPORT_REGISTRIES = weakMapCreate();
const TOOL_REGISTRY_CALLS = weakMapCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function errorSummary(error) {
  const message = isInstanceOf(error, Error) ? error.message : stringFrom(error);
  const code = typeof error?.code === 'string' && stringTrim(error.code) !== ''
    ? stringTrim(error.code)
    : 'TOOL_ERROR';
  return objectFreeze({
    code,
    message,
    status: isSafeInteger(error?.status) ? error.status : null,
    signal: typeof error?.signal === 'string' ? error.signal : null
  });
}

function requireDuration(value) {
  if (value !== null && (!isFiniteNumber(value) || value < 0)) {
    throw new TypeError('ToolInvocationReport durationMs must be null or non-negative');
  }
  return value;
}

export class ToolDefinition {
  constructor({ id, description, runner } = {}) {
    this.id = requireNonEmptyString(id, 'Tool id');
    this.description = requireNonEmptyString(description, 'Tool description');
    if (!isTrustedProcessRunner(runner)) {
      throw new TypeError('ToolDefinition requires a trusted ProcessIsolatedRunner');
    }
    this.runner = runner;
    weakSetAdd(TRUSTED_TOOL_DEFINITIONS, this);
    objectFreeze(this);
  }
}

export function isTrustedToolDefinition(tool) {
  return typeof tool === 'object'
    && tool !== null
    && weakSetHas(TRUSTED_TOOL_DEFINITIONS, tool)
    && objectGetPrototypeOf(tool) === ToolDefinition.prototype;
}

export class ToolInvocationReport {
  constructor({
    callId,
    tool,
    input,
    output = null,
    status,
    error = null,
    durationMs = null,
    stderr = ''
  } = {}) {
    if (!isTrustedToolDefinition(tool)) {
      throw new TypeError('ToolInvocationReport requires a trusted ToolDefinition');
    }
    if (!arrayIncludes(objectValues(TOOL_INVOCATION_STATUSES), status)) {
      throw new TypeError('ToolInvocationReport status is invalid');
    }
    if (status === TOOL_INVOCATION_STATUSES.COMPLETED && error !== null) {
      throw new TypeError('Completed tool invocation cannot contain an error');
    }
    if (status === TOOL_INVOCATION_STATUSES.FAILED && error === null) {
      throw new TypeError('Failed tool invocation requires an error');
    }
    if (error !== null && (!error || typeof error !== 'object')) {
      throw new TypeError('ToolInvocationReport error must be an object or null');
    }
    if (typeof stderr !== 'string') {
      throw new TypeError('ToolInvocationReport stderr must be a string');
    }
    this.callId = requireNonEmptyString(callId, 'Tool callId');
    this.toolId = tool.id;
    this.input = snapshotProcessData(input);
    this.output = output === null ? null : snapshotProcessData(output);
    this.status = status;
    this.error = error === null ? null : objectFreeze({ ...error });
    this.durationMs = requireDuration(durationMs);
    this.stderr = stderr;
    this.evidence = EVIDENCE_LEVELS.OBSERVED;
    this.verified = false;
    this.isolated = true;
    objectFreeze(this);
  }
}

export function isTrustedToolInvocationReport(report, registry = null) {
  const owner = typeof report === 'object' && report !== null
    ? weakMapGet(TRUSTED_TOOL_REPORT_REGISTRIES, report)
    : undefined;
  return typeof report === 'object'
    && report !== null
    && weakSetHas(TRUSTED_TOOL_REPORTS, report)
    && objectGetPrototypeOf(report) === ToolInvocationReport.prototype
    && (registry === null || owner === registry);
}

export class ToolRegistry {
  constructor({ tools } = {}) {
    if (!arrayIsArray(tools) || tools.length === 0) {
      throw new TypeError('ToolRegistry requires at least one ToolDefinition');
    }
    if (!arrayEvery(tools, (tool) => isTrustedToolDefinition(tool))) {
      throw new TypeError('ToolRegistry requires trusted ToolDefinition instances');
    }
    const ids = setFromArray([]);
    arrayForEach(tools, (tool) => {
      if (setHas(ids, tool.id)) {
        throw new TypeError(`ToolRegistry requires unique tool ids: ${tool.id}`);
      }
      setAdd(ids, tool.id);
    });
    this.tools = objectFreeze(arraySlice(tools));
    weakSetAdd(TRUSTED_TOOL_REGISTRIES, this);
    weakMapSet(TOOL_REGISTRY_CALLS, this, setFromArray([]));
    objectFreeze(this);
  }

  resolve(toolId) {
    const normalizedId = requireNonEmptyString(toolId, 'Tool id');
    const tool = arrayFind(this.tools, (candidate) => candidate.id === normalizedId);
    if (!tool) {
      throw new Error(`Tool is not registered: ${normalizedId}`);
    }
    return tool;
  }

  invoke({ toolId, input, callId } = {}) {
    if (!isTrustedToolRegistry(this)) {
      throw new TypeError('ToolRegistry requires an exact trusted instance');
    }
    const tool = this.resolve(toolId);
    const normalizedCallId = requireNonEmptyString(callId, 'Tool callId');
    const calls = weakMapGet(TOOL_REGISTRY_CALLS, this);
    if (setHas(calls, normalizedCallId)) {
      throw new Error(`Tool callId has already been consumed: ${normalizedCallId}`);
    }
    const normalizedInput = snapshotProcessData(input);
    setAdd(calls, normalizedCallId);

    try {
      const result = tool.runner.run(normalizedInput);
      const report = new ToolInvocationReport({
        callId: normalizedCallId,
        tool,
        input: normalizedInput,
        output: result.value,
        status: TOOL_INVOCATION_STATUSES.COMPLETED,
        durationMs: result.durationMs,
        stderr: result.stderr
      });
      weakSetAdd(TRUSTED_TOOL_REPORTS, report);
      weakMapSet(TRUSTED_TOOL_REPORT_REGISTRIES, report, this);
      return report;
    } catch (error) {
      const report = new ToolInvocationReport({
        callId: normalizedCallId,
        tool,
        input: normalizedInput,
        status: TOOL_INVOCATION_STATUSES.FAILED,
        error: errorSummary(error),
        stderr: isInstanceOf(error, ProcessBoundaryError) ? error.stderr : ''
      });
      weakSetAdd(TRUSTED_TOOL_REPORTS, report);
      weakMapSet(TRUSTED_TOOL_REPORT_REGISTRIES, report, this);
      return report;
    }
  }
}

objectFreeze(ToolDefinition.prototype);
objectFreeze(ToolInvocationReport.prototype);
objectFreeze(ToolRegistry.prototype);

export function isTrustedToolRegistry(registry) {
  return typeof registry === 'object'
    && registry !== null
    && weakSetHas(TRUSTED_TOOL_REGISTRIES, registry)
    && objectGetPrototypeOf(registry) === ToolRegistry.prototype;
}
