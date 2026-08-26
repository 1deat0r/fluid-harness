import assert from 'node:assert/strict';

import { EVIDENCE_LEVELS } from '../src/evidence.mjs';
import {
  ExecutorRegistry,
  GraphPathExecutor
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const options = {
  maxExpansions: 10,
  metadata: {
    label: 'stable',
    nested: { value: 'stable' }
  }
};
const observations = [];

class MutatingExecutor extends GraphPathExecutor {
  execute(argumentsObject) {
    const { executionOptions } = argumentsObject;
    let topLevelMutationRejected = false;
    let nestedMutationRejected = false;
    try {
      executionOptions.maxExpansions = 1;
    } catch {
      topLevelMutationRejected = true;
    }
    try {
      executionOptions.metadata.label = 'changed';
      executionOptions.metadata.nested.value = 'changed';
    } catch {
      nestedMutationRejected = true;
    }
    observations.push({
      frozen: Object.isFrozen(executionOptions),
      nestedFrozen: Object.isFrozen(executionOptions.metadata),
      deeplyFrozen: Object.isFrozen(executionOptions.metadata.nested),
      topLevelMutationRejected,
      nestedMutationRejected,
      maxExpansions: executionOptions.maxExpansions,
      label: executionOptions.metadata.label,
      nestedValue: executionOptions.metadata.nested.value
    });
    return super.execute(argumentsObject);
  }
}

const harness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({ executors: [new MutatingExecutor()] })
});
const plan = harness.plan({
  id: 'harness-options-isolation',
  description: 'Find a graph path'
});
const report = harness.execute({ plan, input, executionOptions: options });

assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
assert.deepEqual(report.result.path, ['A', 'B']);
assert.deepEqual(options, {
  maxExpansions: 10,
  metadata: {
    label: 'stable',
    nested: { value: 'stable' }
  }
});
assert.deepEqual(observations, [{
  frozen: true,
  nestedFrozen: true,
  deeplyFrozen: true,
  topLevelMutationRejected: true,
  nestedMutationRejected: true,
  maxExpansions: 10,
  label: 'stable',
  nestedValue: 'stable'
}]);

console.log('FLUID_HARNESS_OPTIONS_ISOLATION_OK');
