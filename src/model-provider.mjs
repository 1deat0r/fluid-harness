import {
  createExecutionResult
} from './executor.mjs';
import {
  isTrustedProcessRunner,
  snapshotProcessData
} from './process-boundary.mjs';
import {
  isTrustedTask,
  REPRESENTATIONS
} from './representation.mjs';
import {
  isPlainObject,
  objectFreeze,
  objectGetPrototypeOf,
  stringTrim,
  weakSetAdd,
  weakSetCreate,
  weakSetHas
} from './intrinsics.mjs';

export const MODEL_PROVIDER_SOURCES = objectFreeze({
  PROCESS_ISOLATED: 'PROCESS_ISOLATED'
});

const TRUSTED_MODEL_PROVIDERS = weakSetCreate();

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || stringTrim(value) === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return stringTrim(value);
}

function normalizeModelResponse(value, field = 'Model provider response') {
  if (
    !value
    || !isPlainObject(value)
    || typeof value.text !== 'string'
    || stringTrim(value.text) === ''
  ) {
    throw new TypeError(`${field} requires non-empty text`);
  }
  const finishReason = value.finishReason ?? 'stop';
  if (typeof finishReason !== 'string' || stringTrim(finishReason) === '') {
    throw new TypeError(`${field} finishReason must be a non-empty string`);
  }
  return objectFreeze({
    text: value.text,
    finishReason: stringTrim(finishReason)
  });
}

export class ProcessBackedModelProvider {
  constructor({
    runner,
    providerId = 'process-isolated-model-provider',
    modelId = 'process-isolated-model'
  } = {}) {
    if (!isTrustedProcessRunner(runner)) {
      throw new TypeError('ProcessBackedModelProvider requires a trusted ProcessIsolatedRunner');
    }
    this.runner = runner;
    this.providerId = requireNonEmptyString(providerId, 'Model provider id');
    this.modelId = requireNonEmptyString(modelId, 'Model id');
    weakSetAdd(TRUSTED_MODEL_PROVIDERS, this);
    objectFreeze(this);
  }

  complete({ task, input = null, context = null } = {}) {
    if (!isTrustedModelProvider(this)) {
      throw new TypeError('ProcessBackedModelProvider requires an exact trusted instance');
    }
    if (!isTrustedTask(task)) {
      throw new TypeError('Model provider completion requires a trusted Task');
    }
    const request = snapshotProcessData({
      task: { id: task.id, description: task.description },
      input,
      context
    });
    const response = normalizeModelResponse(this.runner.run(request).value);
    return objectFreeze({
      providerId: this.providerId,
      modelId: this.modelId,
      source: MODEL_PROVIDER_SOURCES.PROCESS_ISOLATED,
      text: response.text,
      finishReason: response.finishReason
    });
  }
}

objectFreeze(ProcessBackedModelProvider.prototype);

export function isTrustedModelProvider(provider) {
  return typeof provider === 'object'
    && provider !== null
    && weakSetHas(TRUSTED_MODEL_PROVIDERS, provider)
    && objectGetPrototypeOf(provider) === ProcessBackedModelProvider.prototype;
}

export class ModelProviderExecutor {
  constructor({ provider } = {}) {
    if (!isTrustedModelProvider(provider)) {
      throw new TypeError('ModelProviderExecutor requires a trusted model provider');
    }
    this.provider = provider;
    objectFreeze(this);
  }

  canExecute(strategy) {
    return strategy?.representation === REPRESENTATIONS.NATURAL_LANGUAGE;
  }

  execute({ task, strategy, input, executionOptions = {} }) {
    if (!this.canExecute(strategy)) {
      throw new Error(`ModelProviderExecutor cannot execute ${strategy?.representation ?? 'unknown'} tasks`);
    }
    const response = this.provider.complete({
      task,
      input,
      context: executionOptions.modelContext ?? null
    });
    return createExecutionResult({
      taskId: task.id,
      representation: strategy.representation,
      reasoningEngine: strategy.reasoningEngine,
      status: 'success',
      observation: 'model response completed',
      deterministic: false,
      input,
      result: response
    }, this);
  }
}

objectFreeze(ModelProviderExecutor.prototype);
