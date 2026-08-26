import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const task = {
  id: 'evaluation-task-immutability',
  description: 'Find a graph path',
  metadata: {
    tags: ['original'],
    nested: { value: 'stable' }
  }
};
const evaluationCase = new EvaluationCase({
  id: 'evaluation-task-immutability-case',
  domain: 'graph',
  task,
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
});

task.metadata.tags.push('caller-mutation');
task.metadata.nested.value = 'caller-mutation';
assert.deepEqual(evaluationCase.task.metadata, {
  tags: ['original'],
  nested: { value: 'stable' }
});
assert.equal(Object.isFrozen(evaluationCase.task), true);
assert.equal(Object.isFrozen(evaluationCase.task.metadata), true);
assert.equal(Object.isFrozen(evaluationCase.task.metadata.nested), true);

const harness = new FluidHarness();
let planMutationRejected = false;
const report = new EvaluationRunner({
  harness,
  plan: (taskInput) => {
    try {
      taskInput.metadata.nested.value = 'plan-mutation';
    } catch {
      planMutationRejected = true;
    }
    return harness.plan(taskInput);
  }
}).evaluate({
  cases: [evaluationCase],
  mode: POLICY_MODES.RESEARCH,
  budget: new EvaluationBudget({ maxCases: 1 })
});

assert.equal(report.successRate, 1);
assert.equal(planMutationRejected, true);
assert.equal(evaluationCase.task.metadata.nested.value, 'stable');

console.log('FLUID_EVALUATION_TASK_IMMUTABLE_OK');
