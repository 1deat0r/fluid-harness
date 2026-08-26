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
const observations = [];

class MutatingExecutor extends GraphPathExecutor {
  execute(argumentsObject) {
    let mutationRejected = false;
    try {
      argumentsObject.input.edges.pop();
    } catch {
      mutationRejected = true;
    }
    observations.push({
      frozen: Object.isFrozen(argumentsObject.input),
      edgesFrozen: Object.isFrozen(argumentsObject.input.edges),
      mutationRejected,
      edgeCount: argumentsObject.input.edges.length
    });
    return super.execute(argumentsObject);
  }
}

const harness = new FluidHarness({
  executorRegistry: new ExecutorRegistry({ executors: [new MutatingExecutor()] })
});
const plan = harness.plan({
  id: 'harness-input-isolation',
  description: 'Find a graph path'
});
const report = harness.execute({ plan, input });

assert.equal(report.evidence, EVIDENCE_LEVELS.PROVEN);
assert.deepEqual(report.result.path, ['A', 'B']);
assert.deepEqual(report.input.edges, [['A', 'B']]);
assert.deepEqual(input, {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
});
assert.deepEqual(observations, [{
  frozen: true,
  edgesFrozen: true,
  mutationRejected: true,
  edgeCount: 1
}]);

console.log('FLUID_HARNESS_INPUT_ISOLATION_OK');
