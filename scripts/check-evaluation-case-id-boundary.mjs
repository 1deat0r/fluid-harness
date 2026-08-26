import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

const makeCase = (description) => new EvaluationCase({
  id: 'duplicate-evaluation-case-id',
  domain: 'identity',
  task: { id: `duplicate-task-${description}`, description },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
});
const cases = [makeCase('Find a graph path'), makeCase('Find another graph path')];
let executedCases = 0;
const runner = new EvaluationRunner({
  harness: new FluidHarness(),
  plan: (task) => {
    executedCases += 1;
    return runner.harness.plan(task);
  }
});

assert.throws(
  () => runner.evaluate({
    cases,
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 2 })
  }),
  /case ids must be unique/
);
assert.equal(executedCases, 0);

console.log('FLUID_EVALUATION_CASE_ID_BOUNDARY_OK');
