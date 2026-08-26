import assert from 'node:assert/strict';

import {
  EvaluationBudget,
  EvaluationCase,
  EvaluationRunner,
  POLICY_MODES
} from '../src/evaluation.mjs';
import { FluidHarness } from '../src/harness.mjs';

let executions = 0;
class CountingHarness extends FluidHarness {
  execute(argumentsObject) {
    executions += 1;
    return super.execute(argumentsObject);
  }
}

const evaluationCase = new EvaluationCase({
  id: 'evaluation-candidate-boundary-case',
  domain: 'graph',
  task: { id: 'evaluation-candidate-boundary-task', description: 'Find a graph path' },
  input: {
    nodes: ['A', 'B'],
    edges: [['A', 'B']],
    start: 'A',
    goal: 'B'
  },
  expected: (report) => report.result.path.join('>') === 'A>B'
});

const runner = new EvaluationRunner({ harness: new CountingHarness() });
assert.throws(
  () => runner.evaluate({
    candidateId: '   ',
    cases: [evaluationCase],
    mode: POLICY_MODES.RESEARCH,
    budget: new EvaluationBudget({ maxCases: 1 })
  }),
  /Candidate id/
);
assert.equal(executions, 0);

console.log('FLUID_EVALUATION_CANDIDATE_BOUNDARY_OK');
