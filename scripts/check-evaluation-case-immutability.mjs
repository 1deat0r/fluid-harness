import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const input = {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
};
const evaluationCase = new EvaluationCase({
  id: 'evaluation-case-immutability',
  domain: 'graph',
  task: { id: 'evaluation-case-immutability-task', description: 'Find a graph path' },
  input,
  expected: (report) => report.result.path.join('>') === 'A>B'
});

input.nodes.push('C');
input.edges[0][0] = 'C';
input.start = 'C';

assert.deepEqual(evaluationCase.input, {
  nodes: ['A', 'B'],
  edges: [['A', 'B']],
  start: 'A',
  goal: 'B'
});
assert.equal(Object.isFrozen(evaluationCase.input), true);
assert.equal(Object.isFrozen(evaluationCase.input.nodes), true);
assert.equal(Object.isFrozen(evaluationCase.input.edges[0]), true);

const report = new EvaluationRunner({ harness: new FluidHarness() }).evaluate({
  candidateId: 'evaluation-case-immutability',
  cases: [evaluationCase],
  mode: POLICY_MODES.RESEARCH,
  budget: new EvaluationBudget({ maxCases: 1 })
});
assert.equal(report.successRate, 1);

console.log('FLUID_EVALUATION_CASE_IMMUTABLE_OK');
