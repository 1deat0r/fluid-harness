import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  arrayForEach,
  arrayIncludes,
  arrayIsArray,
  arrayMap,
  arrayPush,
  isFiniteNumber,
  isPlainObject,
  isSafeInteger,
  jsonParse,
  jsonStringify,
  objectDefineProperty,
  objectFreeze,
  objectGetOwnPropertyDescriptor,
  objectGetPrototypeOf,
  objectHasOwn,
  reflectOwnKeys,
  stringFrom,
  stringTrim,
  toNumber,
  weakMapCreate,
  weakMapGet,
  weakMapSet,
  weakSetAdd,
  weakSetCreate,
  weakSetDelete,
  weakSetHas,
  highResolutionTime
} from './intrinsics.mjs';
import {
  REPRESENTATIONS,
  RepresentationSelection,
  isTrustedTask
} from './representation.mjs';
import { createExecutionResult, normalizeInputForStrategy } from './executor.mjs';

const NODE_EXECUTABLE = process.execPath;
const NODE_PATH = process.env.PATH ?? '';
const CHILD_ENTRYPOINT = fileURLToPath(
  new URL('../scripts/process-boundary-child.mjs', import.meta.url)
);
const TRUSTED_PROCESS_RUNNERS = weakSetCreate();

export const PROCESS_BOUNDARY_CODES = objectFreeze({
  INPUT_LIMIT: 'INPUT_LIMIT',
  OUTPUT_LIMIT: 'OUTPUT_LIMIT',
  TIMEOUT: 'TIMEOUT',
  CHILD_ERROR: 'CHILD_ERROR',
  CHILD_EXIT: 'CHILD_EXIT',
  PROTOCOL: 'PROTOCOL'
});

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

function snapshotData(value, seen = weakMapCreate(), ancestors = weakSetCreate()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!isFiniteNumber(value)) {
      throw new TypeError('Process-boundary data must contain finite numbers');
    }
    return value;
  }
  if (
    value === undefined
    || typeof value === 'function'
    || typeof value === 'symbol'
    || typeof value === 'bigint'
  ) {
    throw new TypeError('Process-boundary data must be JSON-compatible');
  }
  if (weakSetHas(ancestors, value)) {
    throw new TypeError('Process-boundary data must not contain cycles');
  }
  const existing = weakMapGet(seen, value);
  if (existing !== undefined) {
    return existing;
  }
  if (!arrayIsArray(value) && !isPlainObject(value)) {
    throw new TypeError('Process-boundary data must use plain objects and arrays');
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
          'Process-boundary data must contain enumerable data properties only'
        );
      }
      if (arrayIsArray(value)) {
        const index = toNumber(key);
        if (
          !isSafeInteger(index)
          || index < 0
          || index >= value.length
          || stringFrom(index) !== key
        ) {
          throw new TypeError('Process-boundary arrays must be dense and index-only');
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
          throw new TypeError('Process-boundary arrays must be dense');
        }
      }
    }
  } finally {
    weakSetDelete(ancestors, value);
  }
  return objectFreeze(copy);
}

export function snapshotProcessData(value) {
  return snapshotData(value);
}

function normalizedPath(value, field) {
  const path = requireNonEmptyString(value, field);
  if (path.includes(',')) {
    throw new TypeError(`${field} must not contain commas`);
  }
  return resolve(path);
}

function normalizedReadRoots({ modulePath, workingDirectory, readRoots }) {
  if (readRoots !== undefined && !arrayIsArray(readRoots)) {
    throw new TypeError('Process-boundary readRoots must be an array');
  }
  const roots = [];
  const add = (value, field) => {
    const root = normalizedPath(value, field);
    if (!arrayIncludes(roots, root)) {
      arrayPush(roots, root);
    }
  };
  add(dirname(modulePath), 'Process-boundary module directory');
  add(dirname(CHILD_ENTRYPOINT), 'Process-boundary child directory');
  add(workingDirectory, 'Process-boundary workingDirectory');
  arrayForEach(readRoots ?? [], (root, index) => add(root, `Process-boundary readRoots[${index}]`));
  return objectFreeze(roots);
}

function inputRequest(input, maxInputBytes) {
  const normalizedInput = snapshotData(input);
  const serialized = jsonStringify({ input: normalizedInput });
  const inputBytes = Buffer.byteLength(serialized, 'utf8');
  if (inputBytes > maxInputBytes) {
    throw new ProcessBoundaryError(
      PROCESS_BOUNDARY_CODES.INPUT_LIMIT,
      `Process-boundary input is ${inputBytes} bytes; maximum is ${maxInputBytes}`
    );
  }
  return serialized;
}

function responseFrom(stdout) {
  let response;
  try {
    response = jsonParse(stdout);
  } catch (error) {
    throw new ProcessBoundaryError(
      PROCESS_BOUNDARY_CODES.PROTOCOL,
      `Process-boundary child returned invalid JSON: ${stringFrom(error)}`
    );
  }
  if (!isPlainObject(response) || typeof response.ok !== 'boolean') {
    throw new ProcessBoundaryError(
      PROCESS_BOUNDARY_CODES.PROTOCOL,
      'Process-boundary child returned an invalid response envelope'
    );
  }
  return response;
}

function childErrorMessage(response, fallback) {
  if (
    isPlainObject(response?.error)
    && typeof response.error.message === 'string'
    && stringTrim(response.error.message) !== ''
  ) {
    return response.error.message;
  }
  return fallback;
}

export class ProcessBoundaryError extends Error {
  constructor(code, message, { status = null, signal = null, stderr = '' } = {}) {
    super(message);
    this.name = 'ProcessBoundaryError';
    this.code = code;
    this.status = status;
    this.signal = signal;
    this.stderr = stderr;
    objectFreeze(this);
  }
}

export class ProcessIsolatedRunner {
  constructor({
    modulePath,
    exportName = 'default',
    timeoutMs = 1000,
    maxInputBytes = 64 * 1024,
    maxOutputBytes = 64 * 1024,
    workingDirectory = null,
    readRoots = []
  } = {}) {
    const normalizedModulePath = normalizedPath(modulePath, 'Process-boundary modulePath');
    const normalizedWorkingDirectory = workingDirectory === null
      ? dirname(normalizedModulePath)
      : normalizedPath(workingDirectory, 'Process-boundary workingDirectory');
    this.modulePath = normalizedModulePath;
    this.exportName = requireNonEmptyString(exportName, 'Process-boundary exportName');
    this.timeoutMs = requirePositiveInteger(timeoutMs, 'Process-boundary timeoutMs');
    this.maxInputBytes = requirePositiveInteger(maxInputBytes, 'Process-boundary maxInputBytes');
    this.maxOutputBytes = requirePositiveInteger(maxOutputBytes, 'Process-boundary maxOutputBytes');
    this.workingDirectory = normalizedWorkingDirectory;
    this.readRoots = normalizedReadRoots({
      modulePath: normalizedModulePath,
      workingDirectory: normalizedWorkingDirectory,
      readRoots
    });
    weakSetAdd(TRUSTED_PROCESS_RUNNERS, this);
    objectFreeze(this);
  }

  run(input = null) {
    const request = inputRequest(input, this.maxInputBytes);
    const started = highResolutionTime();
    const args = [
      '--permission',
      '--no-warnings',
      ...arrayMap(this.readRoots, (root) => `--allow-fs-read=${root}`),
      CHILD_ENTRYPOINT,
      this.modulePath,
      this.exportName
    ];
    const child = spawnSync(NODE_EXECUTABLE, args, {
      cwd: this.workingDirectory,
      env: {
        PATH: NODE_PATH,
        NODE_ENV: 'production',
        NODE_NO_WARNINGS: '1'
      },
      input: request,
      encoding: 'utf8',
      maxBuffer: this.maxOutputBytes,
      shell: false,
      timeout: this.timeoutMs,
      windowsHide: true
    });
    const durationMs = toNumber(highResolutionTime() - started) / 1_000_000;
    const stdout = typeof child.stdout === 'string' ? child.stdout : '';
    const stderr = typeof child.stderr === 'string' ? child.stderr : '';

    if (child.error?.code === 'ETIMEDOUT') {
      throw new ProcessBoundaryError(
        PROCESS_BOUNDARY_CODES.TIMEOUT,
        `Process-boundary child exceeded ${this.timeoutMs}ms`,
        { status: child.status, signal: child.signal, stderr }
      );
    }
    if (child.error?.code === 'ENOBUFS' || child.error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      throw new ProcessBoundaryError(
        PROCESS_BOUNDARY_CODES.OUTPUT_LIMIT,
        `Process-boundary child exceeded the ${this.maxOutputBytes}-byte output limit`,
        { status: child.status, signal: child.signal, stderr }
      );
    }
    if (child.error && child.status === null) {
      throw new ProcessBoundaryError(
        PROCESS_BOUNDARY_CODES.CHILD_ERROR,
        `Process-boundary child could not start: ${stringFrom(child.error)}`,
        { status: child.status, signal: child.signal, stderr }
      );
    }
    if (stdout === '') {
      throw new ProcessBoundaryError(
        PROCESS_BOUNDARY_CODES.CHILD_EXIT,
        `Process-boundary child exited without a response (status=${child.status}, signal=${child.signal ?? 'none'})`,
        { status: child.status, signal: child.signal, stderr }
      );
    }

    let response;
    try {
      response = responseFrom(stdout);
    } catch (error) {
      if (child.status !== 0) {
        throw new ProcessBoundaryError(
          PROCESS_BOUNDARY_CODES.CHILD_ERROR,
          `Process-boundary child failed: ${error.message}`,
          { status: child.status, signal: child.signal, stderr }
        );
      }
      throw error;
    }
    if (child.status !== 0 || response.ok !== true) {
      throw new ProcessBoundaryError(
        PROCESS_BOUNDARY_CODES.CHILD_ERROR,
        childErrorMessage(response, `Process-boundary child failed with status ${child.status}`),
        { status: child.status, signal: child.signal, stderr }
      );
    }
    if (!objectHasOwn(response, 'value')) {
      throw new ProcessBoundaryError(
        PROCESS_BOUNDARY_CODES.PROTOCOL,
        'Process-boundary child response omitted value',
        { status: child.status, signal: child.signal, stderr }
      );
    }

    return objectFreeze({
      value: snapshotData(response.value),
      status: 'completed',
      durationMs,
      stderr
    });
  }
}

objectFreeze(ProcessIsolatedRunner.prototype);

export function isTrustedProcessRunner(runner) {
  return typeof runner === 'object'
    && runner !== null
    && weakSetHas(TRUSTED_PROCESS_RUNNERS, runner)
    && objectGetPrototypeOf(runner) === ProcessIsolatedRunner.prototype;
}

export class ProcessBackedSelector {
  constructor({ runner } = {}) {
    if (!isTrustedProcessRunner(runner)) {
      throw new TypeError('ProcessBackedSelector requires a trusted ProcessIsolatedRunner');
    }
    this.runner = runner;
    objectFreeze(this);
  }

  select(task) {
    if (!isTrustedTask(task)) {
      throw new TypeError('Process-backed representation selection requires a trusted Task');
    }
    const result = this.runner.run({ id: task.id, description: task.description }).value;
    if (typeof result === 'string') {
      return new RepresentationSelection({
        representation: result,
        confidence: 0,
        ambiguous: false,
        candidates: []
      });
    }
    if (!isPlainObject(result)) {
      throw new TypeError('Process-backed selector must return a selection string or object');
    }
    return new RepresentationSelection({
      representation: result.representation,
      confidence: result.confidence,
      ambiguous: result.ambiguous,
      candidates: result.candidates ?? []
    });
  }
}

objectFreeze(ProcessBackedSelector.prototype);

export class ProcessBackedExecutor {
  constructor({ runner, representation = REPRESENTATIONS.GRAPH } = {}) {
    if (!isTrustedProcessRunner(runner)) {
      throw new TypeError('ProcessBackedExecutor requires a trusted ProcessIsolatedRunner');
    }
    if (typeof representation !== 'string' || stringTrim(representation) === '') {
      throw new TypeError('ProcessBackedExecutor representation must be a non-empty string');
    }
    this.runner = runner;
    this.representation = stringTrim(representation);
    objectFreeze(this);
  }

  canExecute(strategy) {
    return strategy?.representation === this.representation;
  }

  execute({ task, strategy, input, executionOptions = {} }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`ProcessBackedExecutor cannot execute ${strategy?.representation ?? 'unknown'} tasks`);
    }
    const result = this.runner.run({
      task: { id: task.id, description: task.description },
      strategy: {
        representation: strategy.representation,
        reasoningEngine: strategy.reasoningEngine
      },
      input,
      executionOptions
    }).value;
    if (
      !isPlainObject(result)
      || typeof result.status !== 'string'
      || stringTrim(result.status) === ''
      || typeof result.observation !== 'string'
      || stringTrim(result.observation) === ''
      || typeof result.deterministic !== 'boolean'
      || !isPlainObject(result.result)
    ) {
      throw new TypeError(
        'Process-backed executor must return status, observation, deterministic, and result data'
      );
    }
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: stringTrim(result.status),
      observation: stringTrim(result.observation),
      deterministic: result.deterministic,
      input: normalizeInputForStrategy(strategy, input),
      result: result.result
    }, this);
  }
}

objectFreeze(ProcessBackedExecutor.prototype);
