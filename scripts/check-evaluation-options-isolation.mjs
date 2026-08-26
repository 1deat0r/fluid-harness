import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import {
  ExecutorRegistry,
  GraphPathExecutor
} from '../src/executor.mjs';
import { FluidHarness } from '../src/harness.mjs';

const input = {
  nodes: ['A', 'B', 'C'],
  edges: [['A', 'B'], ['B', 'C']],
  start: 'A',
  goal: 'C'
};
const options = {
  maxExpansions: 10,
  metadata: { label: 'stable' }
};
const observations = [];
class MutatingExecutor extends GraphPathExecutor {
  execute(argumentsObject) {
    const { executionOptions } = argumentsObject;
    let mutationRejected = false;
    try {
      executionOptions.maxExpansions = 1;
      executionOptions.metadata.label = 'changed';
    } catch {
      mutationRejected = true;
    }
    observations.push({
      frozen: Object.isFrozen(executionOptions),
      nestedFrozen: Object.isFrozen(executionOptions.metadata),
      mutationRejected,
      maxExpansions: executionOptions.maxExpansions,
      label: executionOptions.metadata.label
    });
    return super.execute(argumentsObject);
  }
}
const cases = [1, 2].map((number) => new EvaluationCase({
  id: `evaluation-options-${number}`,
  domain: 'graph',
  task: { id: `evaluation-options-${number}`, description: 'Find a graph path' },
  input,
  expected: (report) => report.result.path.join('>') === 'A>B>C'
}));
const report = new EvaluationRunner({
  harness: new FluidHarness({
    executorRegistry: new ExecutorRegistry({ executors: [new MutatingExecutor()] })
  })
}).evaluate({
  cases,
  mode: POLICY_MODES.RESEARCH,
  budget: new EvaluationBudget({ maxCases: 2 }),
  executionOptions: options
});

assert.equal(report.successes, 2);
assert.deepEqual(options, { maxExpansions: 10, metadata: { label: 'stable' } });
assert.deepEqual(observations, [
  { frozen: true, nestedFrozen: true, mutationRejected: true, maxExpansions: 10, label: 'stable' },
  { frozen: true, nestedFrozen: true, mutationRejected: true, maxExpansions: 10, label: 'stable' }
]);

console.log('FLUID_EVALUATION_OPTIONS_ISOLATION_OK');
